'use server'

import prisma from "@/lib/db";
import { Product } from "@/lib/types/quotation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { z } from "zod";

const ReviewSchema = z.object({
    productId: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
});


export async function getProducts() {
    try {
        const products = await (prisma as any).product.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, data: products as Product[] };
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return { success: false, error: "Failed to fetch products" };
    }
}

export async function upsertProduct(name: string, rate: number, stockQuantity: number = 0, category: string = "") {
    if (!name) return { success: false, error: "Name is required" };
    try {
        await (prisma as any).product.upsert({
            where: { name },
            update: { rate, stockQuantity, category },
            create: { name, rate, stockQuantity, category }
        });
        revalidatePath("/products");
        revalidatePath("/quotations/new");
        revalidatePath("/stock");
        return { success: true };
    } catch (error) {
        console.error("Error upserting product:", error);
        return { success: false, error: "Database error while saving product" };
    }
}

export async function updateProduct(id: string, data: { name: string; rate: number }) {
    try {
        await (prisma as any).product.update({
            where: { id },
            data
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to update product:", error);
        return { success: false, error: "Failed to update product" };
    }
}

export async function deleteProduct(id: string) {
    try {
        await (prisma as any).product.delete({
            where: { id }
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to delete product:", error);
        return { success: false, error: "Failed to delete product" };
    }
}

// Shop-specific product actions
export async function getProductById(id: string) {
    try {
        const product = await (prisma as any).product.findUnique({
            where: { id },
            include: {
                reviews: {
                    include: {
                        user: {
                            select: { name: true, email: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        return product;
    } catch (error) {
        console.error("Failed to fetch product:", error);
        return null;
    }
}

export async function getAllProducts() {
    try {
        const products = await (prisma as any).product.findMany({
            orderBy: { createdAt: "desc" },
        });
        return products;
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return [];
    }
}

export async function addReview(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user) {
        return "Please sign in to submit a review.";
    }

    const validatedFields = ReviewSchema.safeParse({
        productId: formData.get("productId"),
        rating: Number(formData.get("rating")),
        comment: formData.get("comment"),
    });

    if (!validatedFields.success) {
        return "Invalid input. Please check your review.";
    }

    const { productId, rating, comment } = validatedFields.data;

    try {
        await (prisma as any).review.create({
            data: {
                productId,
                userId: session.user.id!,
                rating,
                comment,
            },
        });

        const reviews = await (prisma as any).review.findMany({
            where: { productId },
            select: { rating: true },
        });

        const avgRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;

        await (prisma as any).product.update({
            where: { id: productId },
            data: {
                rating: avgRating,
                reviewCount: reviews.length,
            },
        });

        revalidatePath(`/shop/${productId}`);
        return "success";
    } catch (error) {
        console.error("Failed to add review:", error);
        return "Failed to submit review.";
    }
}
