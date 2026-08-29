import { NextRequest, NextResponse } from "next/server";
import { parseMeasurementDocumentWithAi } from "@/lib/ai-measurement-parser";

const SUPPORTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("file") as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        if (!SUPPORTED_TYPES.includes(file.type)) {
            return NextResponse.json({
                success: false,
                error: `Unsupported file type: ${file.type}. Use a PDF, PNG, JPEG, or WEBP.`
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const { floors, itemCount, unitNote } = await parseMeasurementDocumentWithAi(buffer, file.type);

        return NextResponse.json({ success: true, floors, itemCount, unitNote });
    } catch (error: any) {
        console.error("Failed to AI-parse measurement document:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to read this file",
            details: error.message
        }, { status: 500 });
    }
}
