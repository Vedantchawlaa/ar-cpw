require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Use DIRECT_URL for stable debugging connection
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL
        }
    }
});

async function testUpdate() {
    try {
        // Get an existing quotation
        const quotation = await prisma.quotation.findFirst({
            include: { items: true }
        });

        if (!quotation) {
            console.log("No quotation found to test update.");
            return;
        }

        console.log(`Testing update for quotation: ${quotation.id}`);

        const result = await prisma.$transaction(async (tx) => {
            // Check if we can delete items
            const deleteCount = await tx.quotationItem.deleteMany({
                where: { quotationId: quotation.id }
            });
            console.log(`Deleted ${deleteCount.count} existing items.`);

            return await tx.quotation.update({
                where: { id: quotation.id },
                data: {
                    subtotal: quotation.subtotal,
                    total: quotation.total,
                    description: "Test Update Description - " + new Date().toISOString(),
                    services: [{ label: "Test Service", enabled: true }],
                    items: {
                        create: quotation.items.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            rate: item.rate,
                            amount: item.amount,
                        })),
                    },
                },
            });
        });

        console.log("Update successful!");
        console.log("Updated ID:", result.id);
    } catch (error) {
        console.error("Update failed with detailed error:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testUpdate();
