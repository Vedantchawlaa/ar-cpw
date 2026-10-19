import { NextResponse } from "next/server";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { saveAttachment } from "@/lib/services/file-service";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    try {
        const data = await request.formData();
        const file = data.get("file") as unknown as File | null;

        if (!file || typeof file === "string") {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ success: false, error: "File is larger than 15 MB" }, { status: 413 });
        }

        const attachment = await saveAttachment(file);
        return NextResponse.json({ success: true, url: attachment.url, name: file.name });
    } catch (error: any) {
        console.error("Mobile upload failed:", error);
        return NextResponse.json({ success: false, error: "Failed to save file" }, { status: 500 });
    }
}
