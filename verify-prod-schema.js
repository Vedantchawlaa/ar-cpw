require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Use DIRECT_URL if available for direct schema inspection
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: url
        }
    }
});

async function verifySchema() {
    console.log(`\n🔍 Verifying Schema for: ${url.split('@')[1]}\n`);

    try {
        // Check Quotation
        console.log("Checking table 'Quotation'...");
        const qCols = await prisma.$queryRaw`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'Quotation';
        `;
        const qNames = qCols.map(c => c.column_name);
        const qMissing = ['description', 'services'].filter(c => !qNames.includes(c));

        if (qMissing.length === 0) {
            console.log("✅ 'Quotation' table has all required columns.");
        } else {
            console.log(`❌ 'Quotation' table is MISSING: ${qMissing.join(', ')}`);
        }

        // Check QuotationItem
        console.log("\nChecking table 'QuotationItem'...");
        const qiCols = await prisma.$queryRaw`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'QuotationItem';
        `;
        const qiNames = qiCols.map(c => c.column_name);
        const qiMissing = ['details'].filter(c => !qiNames.includes(c));

        if (qiMissing.length === 0) {
            console.log("✅ 'QuotationItem' table has all required columns.");
        } else {
            console.log(`❌ 'QuotationItem' table is MISSING: ${qiMissing.join(', ')}`);
        }

        if (qMissing.length > 0 || qiMissing.length > 0) {
            console.log("\n🚀 ACTION REQUIRED: Please run the following command to sync your database:");
            console.log("   npx prisma db push\n");
        } else {
            console.log("\n🎉 Schema is perfectly in sync! If you still see the error, check your Vercel logs/env vars.\n");
        }

    } catch (error) {
        console.error("\n❌ Connection Failed:", error.message);
        console.log("\n💡 TIP: Ensure your IP is whitelisted in Supabase or that you are using the correct DIRECT_URL.\n");
    } finally {
        await prisma.$disconnect();
    }
}

verifySchema();
