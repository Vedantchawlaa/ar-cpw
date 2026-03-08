const fs = require('fs');
require('dotenv').config();
const keys = Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DIRECT') || k.includes('AUTH'));
let output = "";
keys.forEach(k => {
    output += `${k}: ${process.env[k] ? "SET (length: " + process.env[k].length + ")" : "NOT SET"}\n`;
});
if (process.env.DATABASE_URL) {
    output += "DATABASE_URL start: " + process.env.DATABASE_URL.substring(0, 30) + "\n";
}
fs.writeFileSync('tmp/env-output.txt', output);
