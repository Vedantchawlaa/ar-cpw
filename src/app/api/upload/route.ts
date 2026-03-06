import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("file") as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to database instead of filesystem
        const attachment = await db.attachment.create({
            data: {
                filename: file.name,
                mimeType: file.type || "application/octet-stream",
                data: buffer,
            },
        });

        // Return URL to the serving API
        return NextResponse.json({
            success: true,
            url: `/api/files/${attachment.id}`
        });
    } catch (error: any) {
        console.error("Error saving file to database:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to save file",
            details: error.message
        }, { status: 500 });
    }
}
