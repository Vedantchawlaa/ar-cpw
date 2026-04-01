import { google } from "googleapis";

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const callbackUrl = `${baseUrl}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    prompt: "consent",
  });

  return Response.redirect(url);
}
