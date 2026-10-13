import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/services/auth-service";
import { isStaff } from "@/lib/services/types";
import { signPowerSyncToken, signSessionToken } from "@/lib/mobile/jwt";

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(request: Request) {
    try {
        const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 401 });
        }

        const user = await verifyCredentials(parsed.data.email.trim().toLowerCase(), parsed.data.password)
            ?? await verifyCredentials(parsed.data.email.trim(), parsed.data.password);
        if (!user) {
            return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 401 });
        }
        if (!isStaff(user)) {
            return NextResponse.json(
                { success: false, error: "This app is for team members. Please use the website." },
                { status: 403 }
            );
        }

        const claims = { sub: user.id, role: user.role };
        const token = await signSessionToken(claims);
        const powersync = await signPowerSyncToken(claims);

        return NextResponse.json({ success: true, token, user, powersync });
    } catch (error) {
        console.error("Mobile login failed:", error);
        return NextResponse.json({ success: false, error: "Login failed. Please try again." }, { status: 500 });
    }
}
