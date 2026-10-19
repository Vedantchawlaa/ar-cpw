import { NextResponse } from "next/server";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { parseMeasurementPdfText } from "@/lib/pdf-measurement-parser";
import { parseMeasurementDocumentWithAi } from "@/lib/ai-measurement-parser";

const AI_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

// Reads a measurement sheet from an uploaded PDF or photo. Same three tiers
// the web editor runs, done here so the app needs no parsing libraries:
//  1. "embedded" - a PDF exported by this app carries its exact data
//  2. "text"     - best-effort read of this app's own table layout
//  3. "ai"       - any other layout or a photo (only name/type/width/height/notes)
export async function POST(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    try {
        const data = await request.formData();
        const file = data.get("file") as unknown as File | null;
        if (!file || typeof file === "string") {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const mimeType = isPdf ? "application/pdf" : file.type;

        if (isPdf) {
            const match = buffer.toString("latin1").match(/CPW_DATA_START:([A-Za-z0-9+/=]+):CPW_DATA_END/);
            if (match) {
                const payload = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
                return NextResponse.json({
                    success: true,
                    source: "embedded",
                    floors: payload.data?.floors || [],
                    panelWidth: payload.data?.panelWidth ?? null,
                    notes: payload.notes || "",
                    title: payload.title || "",
                    customerName: payload.customerName || "",
                });
            }

            const text = await parseMeasurementPdfText(buffer).catch(() => null);
            if (text && text.itemCount > 0) {
                return NextResponse.json({ success: true, source: "text", ...text });
            }
        }

        if (!AI_TYPES.includes(mimeType)) {
            return NextResponse.json({
                success: false,
                error: `Unsupported file type: ${file.type || "unknown"}. Use a PDF, PNG, JPEG, or WEBP.`
            }, { status: 400 });
        }

        const ai = await parseMeasurementDocumentWithAi(buffer, mimeType);
        return NextResponse.json({ success: true, source: "ai", ...ai });
    } catch (error: any) {
        console.error("Failed to parse measurement document:", error);
        return NextResponse.json({ success: false, error: "Failed to read this file", details: error.message }, { status: 500 });
    }
}
