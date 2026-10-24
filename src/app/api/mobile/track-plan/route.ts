import { NextResponse } from "next/server";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { planTracksWithStock } from "@/lib/services/stock-service";
import { optimizeTrackCutting, purchaseSummary } from "@/lib/track-optimizer";
import { TrackPlanBodySchema } from "@/lib/mobile/track-plan-schema";

export async function POST(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    const parsed = TrackPlanBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid track list" }, { status: 400 });
    }
    const { pieces, settings = {}, withStock } = parsed.data;

    if (withStock) {
        const result = await planTracksWithStock(pieces, settings);
        const purchases = Object.fromEntries(result.groups.map(g => [g.productId ?? "", purchaseSummary(g.plan)]));
        return NextResponse.json({ success: true, result, purchases });
    }

    const plan = optimizeTrackCutting(pieces, settings);
    return NextResponse.json({ success: true, plan, purchase: purchaseSummary(plan) });
}
