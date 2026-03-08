require('dotenv').config();
const dbUrl = process.env.DATABASE_URL;
console.log("DB URL start:", dbUrl.substring(0, 15));
console.log("Starts with quote?", dbUrl.startsWith('"') || dbUrl.startsWith("'"));
console.log("Ends with quote?", dbUrl.endsWith('"') || dbUrl.endsWith("'"));
if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
    console.log("LITERAL QUOTES DETECTED!");
}
