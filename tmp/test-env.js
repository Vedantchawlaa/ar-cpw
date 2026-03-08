require('dotenv').config();
console.log("DATABASE_URL status:", process.env.DATABASE_URL ? "FOUND" : "NOT FOUND");
if (process.env.DATABASE_URL) {
    console.log("URL Length:", process.env.DATABASE_URL.length);
    console.log("URL Protocol:", process.env.DATABASE_URL.split(':')[0]);
}
