require("dotenv/config");
const { google } = require("googleapis");

async function testGmail() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const query = '5953 (debited OR credited) ("INR" OR "Rs") newer_than:1d';

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
    });
    console.log("Success! Messages:", res.data.messages ? res.data.messages.length : 0);
  } catch (error) {
    console.error("Gmail API Error:", error.message);
  }
}

testGmail();
