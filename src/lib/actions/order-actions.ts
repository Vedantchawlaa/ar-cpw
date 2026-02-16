"use server";

import { z } from "zod";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";

const OrderSchema = z.object({
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    customerPhone: z.string().min(10),
    address: z.string().min(1),
    notes: z.string().optional(),
    subtotal: z.number().positive(),
    tax: z.number(),
    total: z.number().positive(),
    paymentMethod: z.enum(["razorpay", "cod"]),
    paymentId: z.string().optional(),
    items: z.array(z.object({
        productId: z.string(),
        productName: z.string(),
        productRate: z.number(),
        quantity: z.number().int().positive(),
        subtotal: z.number()
    }))
});

export async function createOrder(data: z.infer<typeof OrderSchema>) {
    try {
        const validated = OrderSchema.parse(data);
        console.log("Creating order with data:", JSON.stringify(validated, null, 2));

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const order = await (db as any).order.create({
            data: {
                orderNumber,
                customerName: validated.customerName,
                customerEmail: validated.customerEmail,
                customerPhone: validated.customerPhone,
                address: validated.address,
                notes: validated.notes,
                subtotal: validated.subtotal,
                tax: validated.tax,
                total: validated.total,
                paymentMethod: validated.paymentMethod,
                paymentId: validated.paymentId,
                status: validated.paymentMethod === "razorpay" ? "confirmed" : "pending",
                items: {
                    create: validated.items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productRate: item.productRate,
                        quantity: item.quantity,
                        subtotal: item.subtotal
                    }))
                }
            },
            include: {
                items: true
            }
        });

        revalidatePath("/orders");
        return { success: true, order };
    } catch (error) {
        console.error("Failed to create order:", error);
        const errorMessage = error instanceof Error ? error.message : "Known error";
        // Check for Zod error
        if (error instanceof z.ZodError) {
            const zodError = error as any;
            console.error("Zod Validation Error:", zodError.errors);
            return { success: false, error: "Validation Error: " + JSON.stringify(zodError.errors) };
        }
        return { success: false, error: "Failed to create order: " + errorMessage };
    }
}

export async function getAllOrders() {
    try {
        const orders = await (db as any).order.findMany({
            include: {
                items: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        return orders;
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

export async function updateOrderStatus(orderId: string, status: string) {
    try {
        const order = await (db as any).order.update({
            where: { id: orderId },
            data: { status }
        });
        revalidatePath("/orders");
        return { success: true, order };
    } catch (error) {
        console.error("Failed to update order status:", error);
        return { success: false, error: "Failed to update order status" };
    }
}
