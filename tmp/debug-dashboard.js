const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDashboard() {
    const userId = "9c2a00c6-4fcb-410d-8b03-f244aca8c0e4";
    const now = new Date();
    // Current month start
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);

    const dateFilter = {
        gte: startDate,
    };

    const visibilityFilter = { userId };

    console.log("Testing with dateFilter:", dateFilter);
    console.log("Testing with visibilityFilter:", visibilityFilter);

    try {
        console.log("1. Testing totalRevenue aggregate...");
        const totalRevenueResult = await prisma.quotation.aggregate({
            where: {
                status: 'SALE',
                ...visibilityFilter,
                createdAt: dateFilter
            },
            _sum: { receivedAmount: true }
        });
        console.log("Result:", totalRevenueResult);

        console.log("2. Testing leadsCount...");
        const lCount = await prisma.lead.count({
            where: {
                ...visibilityFilter,
                createdAt: dateFilter
            }
        });
        console.log("Result:", lCount);

        console.log("3. Testing convertedLeadsCount...");
        const clCount = await prisma.lead.count({
            where: {
                ...visibilityFilter,
                createdAt: dateFilter,
                quotations: {
                    some: {
                        status: 'SALE',
                        ...visibilityFilter, // This might be the issue if Quotation doesn't use the same userId field correctly or if it's null
                        createdAt: dateFilter
                    }
                }
            }
        });
        console.log("Result:", clCount);

        console.log("4. Testing recentQuotations...");
        const rQuotations = await prisma.quotation.findMany({
            take: 5,
            where: {
                ...visibilityFilter,
                createdAt: dateFilter
            },
            orderBy: { createdAt: 'desc' },
            include: { lead: { select: { name: true } } }
        });
        console.log("Result count:", rQuotations.length);

    } catch (error) {
        console.error("DEBUG ERROR CAPTURED:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

debugDashboard();
