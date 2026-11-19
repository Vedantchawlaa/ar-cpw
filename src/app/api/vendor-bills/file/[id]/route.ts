import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/auth";

// Serves an uploaded vendor bill to admins only (?download=1 saves it instead of opening it).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const email = session?.user?.email;
    const role = (session?.user as { role?: string } | undefined)?.role;
    const admin = role === "admin" || (email ? (await db.user.findUnique({ where: { email }, select: { role: true } }))?.role === "admin" : false);
    if (!admin) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const bill = await db.vendorBill.findFirst({ where: { attachmentId: id }, select: { id: true } });
    if (!bill) return new NextResponse("Bill not found", { status: 404 });
    const file = await db.attachment.findUnique({ where: { id } });
    if (!file) return new NextResponse("File not found", { status: 404 });

    const download = request.nextUrl.searchParams.get("download") === "1";
    const name = file.filename.replace(/["\r\n]/g, "");
    return new NextResponse(new Uint8Array(file.data), {
        headers: {
            "Content-Type": file.mimeType,
            "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
            "Cache-Control": "private, max-age=3600",
        },
    });
}
