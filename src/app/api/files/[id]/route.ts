import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const attachment = await db.attachment.findUnique({
            where: { id },
        });

        if (!attachment) {
            return new NextResponse("File not found", { status: 404 });
        }

        // Return the binary data with correct headers
        return new NextResponse(attachment.data, {
            headers: {
                "Content-Type": attachment.mimeType,
                "Content-Disposition": `inline; filename="${attachment.filename}"`,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("Error serving file:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
