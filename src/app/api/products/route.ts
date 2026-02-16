import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    const session = await auth();

    // Check if user is admin
    if (!session?.user || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, rate, description, category, tag, images, stock, specifications } = body;

        const product = await (db as any).shopProduct.create({
            data: {
                name,
                rate,
                description,
                category,
                tag,
                images,
                stock,
                specifications,
            },
        });

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        console.error("Error creating shop product:", error);
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }
}
