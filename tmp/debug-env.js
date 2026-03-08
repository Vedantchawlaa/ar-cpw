require('dotenv').config();
const keys = Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DIRECT') || k.includes('AUTH'));
keys.forEach(k => {
    console.log(`${k}: ${process.env[k] ? "SET (length: " + process.env[k].length + ")" : "NOT SET"}`);
});
if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL snippet:", process.env.DATABASE_URL.substring(0, 30) + "...");
}
