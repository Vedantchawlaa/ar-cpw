'use server'

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { upsertProduct } from "./product-actions";
import { auth } from "@/auth";

import { Quotation, QuotationItem } from "@prisma/client";

export type QuotationWithRelations = Quotation & {
    items: QuotationItem[];
    lead: { name: string; city: string; phone: string };
};

export async function getQuotations() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;
        const userId = session.user.id;
        const where = role === 'admin' ? {} : { userId };

        const quotations = await (prisma as any).quotation.findMany({
            where: where as any,
            include: {
                lead: {
                    select: { name: true, city: true, phone: true },
                },
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: quotations };
    } catch (error) {
        console.error("Failed to fetch quotations:", error);
        return { success: false, error: "Failed to fetch quotations" };
    }
}
export async function updateOrderStatus(id: string, status: string, deadline?: Date | string | null) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;
        // Check ownership if needed (simplified for now)

        await (prisma as any).quotation.update({
            where: { id },
            data: {
                status,
                ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {})
            }
        });

        revalidatePath("/processing-orders");
        return { success: true };
    } catch (error) {
        console.error("Failed to update order status:", error);
        return { success: false, error: "Failed to update status" };
    }
}

export async function getActiveOrders() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;
        const userId = session.user.id;
        const where = role === 'admin' ? {} : { userId };

        const quotations = await (prisma as any).quotation.findMany({
            where: {
                ...where,
                status: {
                    not: 'DRAFT'
                }
            },
            include: {
                lead: {
                    select: { name: true, city: true, phone: true },
                },
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: quotations };
    } catch (error) {
        console.error("Failed to fetch active orders:", error);
        return { success: false, error: "Failed to fetch active orders" };
    }
}

export async function createQuotation(data: {
    number?: string;
    leadId: string;
    items: { description: string; quantity: number; rate: number; amount: number }[];
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
}) {
    try {
        const session = await auth();
        console.log("Session in createQuotation:", JSON.stringify(session, null, 2));
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        let number = data.number;
        if (!number) {
            // Generate a simple number if not provided
            const count = await (prisma as any).quotation.count();
            number = `EST-${new Date().getFullYear()}-${(count + 1).toString().padStart(3, '0')}`;
        }

        // Check if number exists
        const existing = await (prisma as any).quotation.findUnique({ where: { number } });
        if (existing) {
            return { success: false, error: `Quotation number ${number} already exists.` };
        }

        const quotation = await prisma.$transaction(async (tx) => {
            const q = await (tx as any).quotation.create({
                data: {
                    number,
                    leadId: data.leadId,
                    userId: session.user?.id,
                    subtotal: data.subtotal,
                    tax: data.tax || 0,
                    discount: data.discount || 0,
                    total: data.total,
                    items: {
                        create: data.items.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            rate: item.rate,
                            amount: item.amount,
                        })),
                    },
                },
                include: { items: true }
            });

            // Automatic upsert removed based on user preference. 
            // Users now use the "Save to Catalog" button in the UI for explicit catalog management.

            return q;
        });

        revalidatePath("/quotations");
        revalidatePath("/products");
        return { success: true, data: quotation as any };
    } catch (error) {
        console.error("Failed to create quotation:", error);
        return { success: false, error: "Failed to create quotation" };
    }
}

export async function updateQuotation(id: string, data: {
    number?: string;
    leadId: string;
    items: { description: string; quantity: number; rate: number; amount: number }[];
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    receivedAmount?: number;
    status?: string;
    deadline?: Date | string | null;
}) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;

        // Check ownership
        if (role !== 'admin') {
            const existing = await (prisma as any).quotation.findUnique({ where: { id } });
            if (existing && existing.userId !== session.user.id) {
                return { success: false, error: "Unauthorized access to this quotation" };
            }
        }

        // Check if new number collides, if changed
        if (data.number) {
            const existingWithNumber = await (prisma as any).quotation.findUnique({ where: { number: data.number } });
            if (existingWithNumber && existingWithNumber.id !== id) {
                return { success: false, error: `Quotation number ${data.number} already exists.` };
            }
        }

        const quotation = await prisma.$transaction(async (tx) => {
            await (tx as any).quotationItem.deleteMany({
                where: { quotationId: id }
            });

            const updated = await (tx as any).quotation.update({
                where: { id },
                data: {
                    number: data.number, // Update number if provided
                    // leadId: data.leadId, // Removing leadId update to avoid Prisma error
                    subtotal: data.subtotal,
                    tax: data.tax || 0,
                    discount: data.discount || 0,
                    total: data.total,
                    receivedAmount: data.receivedAmount || 0,
                    status: data.status,
                    deadline: data.deadline ? new Date(data.deadline) : null,
                    items: {
                        create: data.items.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            rate: item.rate,
                            amount: item.amount,
                        })),
                    },
                },
                include: {
                    lead: { select: { name: true, city: true, phone: true } },
                    items: true,
                }
            });

            // Automatic upsert removed based on user preference.

            return updated;
        });

        revalidatePath("/quotations");
        revalidatePath(`/quotations/${id}`);
        return { success: true, data: quotation as any };
    } catch (error) {
        console.error("Failed to update quotation:", error);
        return { success: false, error: "Failed to update quotation" };
    }
}

export async function deleteQuotation(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;
        if (role !== 'admin') {
            const existing = await (prisma as any).quotation.findUnique({ where: { id } });
            if (existing && existing.userId !== session.user.id) {
                return { success: false, error: "Unauthorized access" };
            }
        }

        await (prisma as any).quotation.delete({ where: { id } });
        revalidatePath("/quotations");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete quotation:", error);
        return { success: false, error: "Failed to delete quotation" };
    }
}

export async function getQuotation(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const quotation = await (prisma as any).quotation.findUnique({
            where: { id },
            include: {
                lead: {
                    select: { name: true, city: true, phone: true },
                },
                items: true,
            },
        });
        if (!quotation) return { success: false, error: "Quotation not found" };

        const role = (session.user as any).role;
        if (role !== 'admin' && quotation.userId !== session.user.id) {
            return { success: false, error: "Unauthorized access" };
        }

        return { success: true, data: quotation };
    } catch (error) {
        console.error("Failed to fetch quotation:", error);
        return { success: false, error: "Failed to fetch quotation" };
    }
}

export async function markAsSale(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;
        if (role !== 'admin') {
            const existing = await (prisma as any).quotation.findUnique({ where: { id } });
            if (existing && existing.userId !== session.user.id) {
                return { success: false, error: "Unauthorized access" };
            }
        }

        // Get quotation with items before updating
        const quotation = await (prisma as any).quotation.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!quotation) {
            return { success: false, error: "Quotation not found" };
        }

        // Update quotation status to SALE
        await (prisma as any).quotation.update({
            where: { id },
            data: { status: 'SALE' },
        });

        // Deduct stock for each item in the quotation
        for (const item of quotation.items) {
            // Try to find matching product by name (description in quotation item)
            const product = await (prisma as any).product.findFirst({
                where: {
                    name: {
                        equals: item.description,
                        mode: 'insensitive'
                    }
                }
            });

            if (product) {
                // Calculate new stock quantity (can go negative for backorders)
                const newQuantity = product.stockQuantity - item.quantity;

                // Update product stock
                await (prisma as any).product.update({
                    where: { id: product.id },
                    data: { stockQuantity: newQuantity }
                });

                console.log(`✅ Stock updated for ${product.name}: ${product.stockQuantity} → ${newQuantity}`);
            } else {
                console.warn(`⚠️ Product not found in inventory: ${item.description}`);
            }
        }

        revalidatePath("/sales");
        revalidatePath("/quotations");
        revalidatePath("/dashboard");
        revalidatePath("/stock");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark as sale:", error);
        return { success: false, error: "Failed to mark as sale" };
    }
}

