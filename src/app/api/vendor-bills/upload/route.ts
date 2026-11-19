import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/auth";
import { parseBillText, type ParsedBill } from "@/lib/bill-text-parser";

async function readPdfText(buffer: Buffer): Promise<string> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
        return (await parser.getText()).text;
    } finally {
        await parser.destroy();
    }
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function isAdmin() {
    const session = await auth();
    if (!session?.user?.email) return false;
    if ((session.user as { role?: string }).role === "admin") return true;
    const dbUser = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true } });
    return dbUser?.role === "admin";
}

// Stores an uploaded bill (kept for reference). For a PDF it also reads the
// printed text into lines so the bill form can be filled in; photos are read in
// the browser (OCR) instead. The bill itself is saved by saveVendorBill().
export async function POST(request: NextRequest) {
    if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Only admins can upload bills." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const read = form.get("read") !== "0";
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "Choose a bill file." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "File is over 10 MB. Use a smaller photo or PDF." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const attachment = await db.attachment.create({ data: { filename: file.name || "bill", mimeType, data: buffer } });

    let parsed: ParsedBill | null = null;
    let readError: string | null = null;
    if (read && mimeType === "application/pdf") {
        try {
            const text = await readPdfText(buffer);
            if (text.replace(/\s/g, "").length < 20) readError = "This PDF is a scanned image with no text. Upload a photo of the bill instead, or enter the items by hand.";
            else parsed = parseBillText(text);
        } catch (e) {
            console.error("Failed to read vendor bill PDF:", e);
            readError = "Could not read this PDF. It is attached; enter the items by hand.";
        }
    }

    return NextResponse.json({ ok: true, attachmentId: attachment.id, fileName: attachment.filename, parsed, readError });
}
