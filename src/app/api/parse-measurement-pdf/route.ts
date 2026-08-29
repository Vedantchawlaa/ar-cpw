import { NextRequest, NextResponse } from "next/server";
import { parseMeasurementPdfText } from "@/lib/pdf-measurement-parser";

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("file") as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const { floors, itemCount, warnings } = await parseMeasurementPdfText(buffer);

        return NextResponse.json({ success: true, floors, itemCount, warnings });
    } catch (error: any) {
        console.error("Failed to parse measurement PDF:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to read this PDF",
            details: error.message
        }, { status: 500 });
    }
}
