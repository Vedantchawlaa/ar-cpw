require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

async function checkSchema() {
    try {
        console.log("Checking columns for table 'Quotation'...");
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Quotation';
        `;
        console.table(columns);

        const hasDescription = columns.some(c => c.column_name === 'description');
        const hasServices = columns.some(c => c.column_name === 'services');

        console.log(`Has description: ${hasDescription}`);
        console.log(`Has services: ${hasServices}`);

        if (!hasDescription || !hasServices) {
            console.log("CRITICAL: Schema is MISSING new columns. Running db push is required.");
        }
    } catch (error) {
        console.error("Failed to check schema:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSchema();
