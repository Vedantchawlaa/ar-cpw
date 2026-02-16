require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
    });

    try {
        console.log("Connecting to database using DIRECT_URL...");
        await client.connect();
        console.log("Connected successfully!");

        const res = await client.query('SELECT NOW()');
        console.log("Query successful:", res.rows[0]);

    } catch (err) {
        console.error("Connection failed:", err.message);
    } finally {
        await client.end();
    }
}

testConnection();
