'use server'

import { revalidatePath } from "next/cache";
import db from "@/lib/db";

export async function updateProductStock(productId: string, quantity: number) {
    try {
        const product = await (db as any).product.update({
            where: { id: productId },
            data: { stockQuantity: quantity }
        });
        revalidatePath("/stock");
        return { success: true, product };
    } catch (error) {
        console.error("Failed to update stock:", error);
        return { success: false, error: "Failed to update stock" };
    }
}

export async function adjustProductStock(productId: string, adjustment: number) {
    try {
        const product = await (db as any).product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            return { success: false, error: "Product not found" };
        }

        const newQuantity = product.stockQuantity + adjustment;

        const updated = await (db as any).product.update({
            where: { id: productId },
            data: { stockQuantity: newQuantity }
        });

        revalidatePath("/stock");
        return { success: true, product: updated };
    } catch (error) {
        console.error("Failed to adjust stock:", error);
        return { success: false, error: "Failed to adjust stock" };
    }
}

export async function getAllProductsWithStock() {
    try {
        const products = await (db as any).product.findMany({
            orderBy: { name: 'asc' }
        });
        return products;
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return [];
    }
}

export async function getLowStockProducts(threshold: number = 10) {
    try {
        const products = await (db as any).product.findMany({
            where: {
                stockQuantity: {
                    lte: threshold,
                    gte: 0
                }
            },
            orderBy: { stockQuantity: 'asc' }
        });
        return products;
    } catch (error) {
        console.error("Failed to fetch low stock products:", error);
        return [];
    }
}
