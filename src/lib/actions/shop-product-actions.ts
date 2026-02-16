"use server";

import { z } from "zod";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const ReviewSchema = z.object({
    shopProductId: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
});

export async function getShopProductById(id: string) {
    try {
        const product = await (db as any).shopProduct.findUnique({
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
        console.error("Failed to fetch shop product:", error);
        return null;
    }
}

export async function getAllShopProducts() {
    try {
        const products = await (db as any).shopProduct.findMany({
            orderBy: { createdAt: "desc" },
        });
        return products;
    } catch (error) {
        console.error("Failed to fetch shop products:", error);
        return [];
    }
}

export async function addShopReview(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user) {
        return "Please sign in to submit a review.";
    }

    const validatedFields = ReviewSchema.safeParse({
        shopProductId: formData.get("productId"),
        rating: Number(formData.get("rating")),
        comment: formData.get("comment"),
    });

    if (!validatedFields.success) {
        return "Invalid input. Please check your review.";
    }

    const { shopProductId, rating, comment } = validatedFields.data;

    try {
        await (db as any).shopReview.create({
            data: {
                shopProductId,
                userId: session.user.id!,
                rating,
                comment,
            },
        });

        const reviews = await (db as any).shopReview.findMany({
            where: { shopProductId },
            select: { rating: true },
        });

        const avgRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;

        await (db as any).shopProduct.update({
            where: { id: shopProductId },
            data: {
                rating: avgRating,
                reviewCount: reviews.length,
            },
        });

        revalidatePath(`/shop/${shopProductId}`);
        return "success";
    } catch (error) {
        console.error("Failed to add review:", error);
        return "Failed to submit review.";
    }
}

export async function createShopProduct(data: {
    name: string;
    rate: number;
    description?: string;
    category: string;
    tag?: string;
    images: string[];
    stock: number;
    specifications?: any;
}) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const product = await (db as any).shopProduct.create({
            data,
        });
        revalidatePath("/shop");
        return { success: true, data: product };
    } catch (error) {
        console.error("Failed to create shop product:", error);
        return { success: false, error: "Failed to create product" };
    }
}
