import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { applyTrackPlan } from "@/lib/services/stock-service";
import { isAdmin } from "@/lib/services/types";
import { TrackPlanBodySchema } from "@/lib/mobile/track-plan-schema";

// Books a job's track cutting plan in stock (admin only, once per measurement).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();
    if (!isAdmin(actor)) {
        return NextResponse.json({ success: false, error: "Only an admin can change stock." }, { status: 403 });
    }

    const parsed = TrackPlanBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid track list" }, { status: 400 });
    }

    try {
        const { id } = await params;
        const result = await applyTrackPlan(actor, id, parsed.data.pieces, parsed.data.settings ?? {});
        if (result.success) {
            revalidatePath("/stock");
            revalidatePath("/measurements");
        }
        return NextResponse.json(result, { status: result.success ? 200 : 409 });
    } catch (error) {
        console.error("Applying track plan to stock failed:", error);
        return NextResponse.json({ success: false, error: "Could not update stock. Please try again." }, { status: 500 });
    }
}
