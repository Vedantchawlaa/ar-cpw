import { NextResponse } from "next/server";
import { z } from "zod";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { applySyncBatch, SyncOpSchema } from "@/lib/mobile/sync-upload";

const BodySchema = z.object({ batch: z.array(SyncOpSchema).max(500) });

export async function POST(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Malformed sync batch" }, { status: 400 });
    }

    try {
        const results = await applySyncBatch(actor, parsed.data.batch);
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error("Sync upload failed:", error);
        return NextResponse.json({ success: false, error: "Sync failed, will retry" }, { status: 500 });
    }
}
