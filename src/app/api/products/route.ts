import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
    try {
        const products = await (prisma as any).product.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json({ success: true, count: products.length, data: products });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
