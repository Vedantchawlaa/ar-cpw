import { google } from "googleapis";

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const code = urlObj.searchParams.get("code");
  // Reconstruct the base URL (works for both localhost and Vercel)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const callbackUrl = `${baseUrl}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );

  const { tokens } = await oauth2Client.getToken(code!);

  console.log("REFRESH TOKEN:", tokens.refresh_token);

  return new Response("Connected! Check console for refresh token.");
}
