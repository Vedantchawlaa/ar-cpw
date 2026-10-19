import { NextRequest, NextResponse } from "next/server";
import { saveAttachment } from "@/lib/services/file-service";

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("file") as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        // Save to database instead of filesystem
        const attachment = await saveAttachment(file);

        // Return URL to the serving API
        return NextResponse.json({
            success: true,
            url: attachment.url
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
