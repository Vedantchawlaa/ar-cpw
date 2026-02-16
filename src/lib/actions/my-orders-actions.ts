"use server";

import db from "@/lib/db";

export async function getMyOrders(userEmail: string) {
    try {
        const orders = await (db as any).order.findMany({
            where: {
                customerEmail: userEmail
            },
            include: {
                items: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        return orders;
    } catch (error) {
        console.error("Failed to fetch user orders:", error);
        return [];
    }
}
