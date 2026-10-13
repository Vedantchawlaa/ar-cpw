import { NextResponse } from "next/server";
import { z } from "zod";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { optimizeTrackCutting, purchaseSummary } from "@/lib/track-optimizer";

const BodySchema = z.object({
    pieces: z.array(z.object({ label: z.string().max(200), length: z.number() })).max(500),
    settings: z.object({
        stockLength: z.number().positive(),
        kerf: z.number().min(0),
        keepThreshold: z.number().min(0),
    }).partial().optional(),
});

export async function POST(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid track list" }, { status: 400 });
    }

    const plan = optimizeTrackCutting(parsed.data.pieces, parsed.data.settings ?? {});
    return NextResponse.json({ success: true, plan, purchase: purchaseSummary(plan) });
}
