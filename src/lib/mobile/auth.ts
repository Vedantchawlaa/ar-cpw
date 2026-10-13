import { NextResponse } from "next/server";
import db from "@/lib/db";
import { Actor, isStaff } from "@/lib/services/types";
import { verifySessionToken } from "./jwt";

/**
 * Resolves the staff member behind a mobile request from its Bearer token.
 * The role is re-read from the database on every call, so a role change or a
 * deleted user takes effect without waiting for the token to expire.
 */
export async function getMobileActor(request: Request): Promise<Actor | null> {
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return null;

    const claims = await verifySessionToken(token);
    if (!claims) return null;

    const user = await db.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, role: true, email: true },
    });
    if (!user) return null;

    const actor: Actor = { id: user.id, role: user.role, email: user.email };
    // The app is staff-only; customers keep using the website
    return isStaff(actor) ? actor : null;
}

export const unauthorized = () =>
    NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
