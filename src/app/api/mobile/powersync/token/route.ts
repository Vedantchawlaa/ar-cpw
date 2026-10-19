import { NextResponse } from "next/server";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { signPowerSyncToken } from "@/lib/mobile/jwt";

// Exchanges the app's session token for a short-lived PowerSync token.
export async function GET(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    const powersync = await signPowerSyncToken({ sub: actor.id, role: actor.role });
    if (!powersync) {
        return NextResponse.json(
            { success: false, error: "Sync is not configured on the server (POWERSYNC_URL / POWERSYNC_JWT_SECRET / POWERSYNC_JWT_KID)." },
            { status: 503 }
        );
    }

    return NextResponse.json({ success: true, ...powersync, user: { id: actor.id, role: actor.role, email: actor.email } });
}
