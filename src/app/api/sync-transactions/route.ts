import { google } from "googleapis";
import { addTransaction } from "@/lib/actions/transaction-actions";
import db from "@/lib/db";
import { auth } from "@/auth";

// 🧠 SIMPLE PARSER
function parseTransaction(text: string) {
  const amountMatch = text.match(/(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

  const type = /credited/i.test(text) ? "INCOME" : "EXPENSE";

  const nameMatch = text.match(/to\s+([A-Za-z0-9\s@\.\*]+)|from\s+([A-Za-z0-9\s@\.\*]+)/i);
  let name = nameMatch ? (nameMatch[1] || nameMatch[2]).trim() : "Bank Transaction";

  // Sanitize the description
  name = name.replace(/(?:your\s+)?a\/?c(?:count)?\s*\**5953\s*(?:by|to|from)?\s*(?:VPA\s+)?/gi, "")
             .replace(/^\s*(to|from|by)\s+/i, "")
             .trim();

  // Sometimes it appends " on 29" or dates, we can optionally strip " on \d{2}" at the end
  name = name.replace(/\s+on\s+\d{1,2}$/i, "");

  if (!name) name = "Bank Transaction";

  return {
    type,
    amount,
    description: name,
  };
}

export async function GET(request: Request) {
  try {
    // Security: Allow execution if it's the CRON script OR an Admin user clicking in the UI
    const authHeader = request.headers.get('authorization');
    const hasValidCronSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const session = await auth();
    const isAdmin = session?.user && (session.user as any).role === 'admin';

    if (!hasValidCronSecret && !isAdmin) {
      return Response.json({ success: false, error: 'Unauthorized context. Provide CRON secret or log in as Admin.' }, { status: 401 });
    }


    // 🔐 Auth
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // ✅ YOUR FILTER (FINAL)
    const query = '5953 (debited OR credited) ("INR" OR "Rs") newer_than:1d';
    console.log("Searching Gmail with query:", query);
    
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
    });

    const messages = res.data.messages || [];
    console.log(`Found ${messages.length} matching emails.`);
    let syncedCount = 0;

    for (const msg of messages) {
      if (!msg.id) continue;

      // 🚫 VERY IMPORTANT: Avoid Duplicate Transactions
      const existing = await db.transaction.findUnique({
        where: { emailId: msg.id }
      });
      if (existing) {
        console.log("Skipping duplicate email:", msg.id);
        continue;
      }

      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });

      // 🧠 Extract body safely
      function getEmailBody(payload: any): string {
        if (!payload) return "";
        if (payload.body && payload.body.data) {
          return Buffer.from(payload.body.data, "base64url").toString("utf-8");
        } else if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === "text/plain") {
              return Buffer.from(part.body?.data || "", "base64url").toString("utf-8");
            } else if (part.parts) {
              const nested = getEmailBody(part);
              if (nested) return nested;
            }
          }
          // Fallback to HTML if no plain text
          for (const part of payload.parts) {
            if (part.mimeType === "text/html") {
               return Buffer.from(part.body?.data || "", "base64url").toString("utf-8");
            }
          }
        }
        return "";
      }

      let body = getEmailBody(fullMsg.data.payload);
      
      const snippet = fullMsg.data.snippet || "";
      const textToDecode = body || snippet;

      // ❌ Skip non-transaction
      if (!textToDecode.includes("INR") && !textToDecode.includes("Rs")) {
        console.log("Skipping email (No INR or Rs found in body or snippet):", snippet);
        continue;
      }

      // 💡 PARSE: Try body first, then fallback to snippet
      let parsed = parseTransaction(body);
      if (!parsed) {
        parsed = parseTransaction(snippet);
      }
      
      if (!parsed) {
        console.log("Parser returned null! Raw snippet:", snippet);
        continue;
      }

      console.log("Successfully parsed:", parsed);

      // 💾 SAVE
      const emailDate = fullMsg.data.internalDate 
        ? new Date(parseInt(fullMsg.data.internalDate)) 
        : new Date();

      await db.transaction.create({
        data: {
          type: parsed.type,
          amount: parsed.amount,
          category: "Other",
          description: parsed.description,
          date: emailDate,
          emailId: msg.id,
        }
      });
      syncedCount++;
    }

    console.log("Sync complete! Inserted count:", syncedCount);
    return Response.json({ success: true, count: syncedCount, totalMessages: messages.length });
  } catch (error) {
    console.error("CRITICAL ERROR during sync:", error);
    return Response.json({ success: false, error: String(error) });
  }
}
