const { Client } = require('pg');
require('dotenv').config();

async function testConnection(url, name) {
    if (!url) {
        console.log(`${name} NOT FOUND in env`);
        return;
    }
    console.log(`Connecting to ${name}...`);
    const client = new Client({ connectionString: url });
    try {
        await client.connect();
        const res = await client.query('SELECT NOW()');
        console.log(`${name} SUCCESS:`, res.rows[0]);
    } catch (e) {
        console.error(`${name} ERROR:`, e.message);
    } finally {
        await client.end();
    }
}

async function runTests() {
    await testConnection(process.env.DATABASE_URL, "DATABASE_URL");
    await testConnection(process.env.DIRECT_URL, "DIRECT_URL");
}

runTests();
