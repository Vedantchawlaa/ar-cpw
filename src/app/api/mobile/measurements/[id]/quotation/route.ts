import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { generateQuotationFromMeasurement } from "@/lib/services/measurement-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    try {
        const { id } = await params;
        const result = await generateQuotationFromMeasurement(actor, id);
        if (result.success) revalidatePath("/quotations");
        return NextResponse.json(result, { status: result.success ? 200 : 422 });
    } catch (error: any) {
        console.error("Failed to generate quotation:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to generate quotation" }, { status: 500 });
    }
}
