"use server";

import db from "@/lib/db";
import { lowStockProducts } from "@/lib/services/stock-service";
import { formatStockQuantity } from "@/lib/stock-units";
import { revalidatePath } from "next/cache";

export async function getReminders() {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const reminders = await (db as any).lead.findMany({
            where: {
                OR: [
                    {
                        nextContactDate: {
                            not: null,
                            lte: tomorrow
                        }
                    },
                    {
                        AND: [
                            { nextContactDate: null },
                            { updatedAt: { gte: last24h } }
                        ]
                    }
                ]
            },
            orderBy: [
                { nextContactDate: { sort: 'asc', nulls: 'last' } },
                { updatedAt: 'desc' }
            ],
        });

        // Products at or below the alert level set for them on the Stock page
        const lowStock = await lowStockProducts();

        const stockReminders = lowStock.map(product => ({
            id: `stock-${product.id}`,
            name: `Low Stock: ${product.name}`,
            phone: `In stock: ${formatStockQuantity(product.stockKind, product.total)}`,
            email: "Restock required",
            city: product.category || "Inventory",
            nextContactDate: new Date(), // Show as current
            type: 'stock',
            isStock: true
        }));

        // Get orders with deadline today
        const deadlineQuotations = await (db as any).quotation.findMany({
            where: {
                deadline: {
                    gte: new Date(now.setHours(0, 0, 0, 0)),
                    lte: new Date(now.setHours(23, 59, 59, 999))
                },
                status: {
                    not: "COMPLETED" // Don't remind if completed
                }
            },
            include: { lead: { select: { name: true } } }
        });

        const deadlineReminders = deadlineQuotations.map((q: any) => ({
            id: `deadline-${q.id}`,
            name: `Deadline: ${q.number}`,
            phone: `Customer: ${q.lead.name}`,
            email: "Order Deadline Today",
            city: q.status,
            nextContactDate: new Date(),
            type: 'deadline',
            isDeadline: true
        }));

        return [...stockReminders, ...deadlineReminders, ...reminders];
    } catch (error) {
        console.error("Failed to fetch reminders:", error);
        return [];
    }
}

export async function getUpcomingReminders() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);

        const leads = await (db as any).lead.findMany({
            where: {
                nextContactDate: {
                    gte: today,
                    lte: threeDaysFromNow
                }
            },
            orderBy: {
                nextContactDate: "asc"
            },
            take: 5
        });

        const lowStock = await lowStockProducts();

        // Transform to reminder format
        const stockReminders = lowStock.map(product => ({
            id: `stock-${product.id}`,
            name: `Restock: ${product.name}`,
            phone: `Current: ${formatStockQuantity(product.stockKind, product.total)}`,
            nextContactDate: new Date(), // Show as today
            type: 'stock' as const,
            stockQuantity: product.total
        }));

        return [...stockReminders, ...leads];
    } catch (error) {
        console.error("Failed to get upcoming reminders:", error);
        return [];
    }
}
export async function getReminderCount() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);

        const upcomingReminders = await (db as any).lead.count({
            where: {
                nextContactDate: {
                    gte: today,
                    lte: threeDaysFromNow
                }
            }
        });

        const lowStockCount = (await lowStockProducts()).length;

        // Get deadline count (today)
        const deadlineCount = await (db as any).quotation.count({
            where: {
                deadline: {
                    gte: today,
                    lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
                },
                status: {
                    not: "COMPLETED"
                }
            }
        });

        return upcomingReminders + lowStockCount + deadlineCount;
    } catch (error) {
        console.error("Failed to get reminder count:", error);
        return 0;
    }
}

export async function completeFollowUp(id: string) {
    try {
        if (id.startsWith('deadline-')) {
            const quotationId = id.replace('deadline-', '');
            await (db as any).quotation.update({
                where: { id: quotationId },
                data: { status: 'COMPLETED' }
            });
            revalidatePath("/processing-orders");
        } else {
            await (db as any).lead.update({
                where: { id },
                data: { nextContactDate: null },
            });
        }

        revalidatePath("/reminders");
        revalidatePath("/leads");
        return { success: true };
    } catch (error) {
        console.error("Failed to complete follow up:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: "Failed to update reminder: " + errorMessage };
    }
}
