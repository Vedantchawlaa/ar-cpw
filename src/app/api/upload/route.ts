import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { writeFile, mkdir } from "fs/promises";

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("file") as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize filename
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

        // Ensure directory exists
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e: any) {
            if (e.code !== 'EEXIST') {
                console.error("Error creating upload directory:", e);
                throw e;
            }
        }

        const filepath = path.join(uploadDir, filename);

        await writeFile(filepath, buffer);

        return NextResponse.json({ success: true, url: `/uploads/${filename}` });
    } catch (error: any) {
        console.error("Error saving file:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to save file",
            details: error.message
        }, { status: 500 });
    }
}
