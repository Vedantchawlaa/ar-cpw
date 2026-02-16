import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids")?.split(",") || [];

    if (ids.length === 0) {
        return NextResponse.json([]);
    }

    try {
        const products = await (db as any).shopProduct.findMany({
            where: {
                id: {
                    in: ids
                }
            },
            select: {
                id: true,
                name: true,
                rate: true,
                images: true,
                category: true
            }
        });

        return NextResponse.json(products);
    } catch (error) {
        console.error("Error fetching shop products:", error);
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}
