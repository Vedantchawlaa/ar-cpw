const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'QuotationItem'
    `;
        console.log('Columns in QuotationItem:');
        console.table(columns);

        const quotationColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Quotation'
    `;
        console.log('Columns in Quotation:');
        console.table(quotationColumns);
    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
