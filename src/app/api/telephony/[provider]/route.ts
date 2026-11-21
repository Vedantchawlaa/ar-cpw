import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import db from "@/lib/db";
import { ingestCalls } from "@/lib/services/crm-service";
import { PROVIDER_PARSERS, type ParsedProviderCall } from "@/lib/telephony";
import { phoneKey } from "@/lib/sales-crm";

// Cloud telephony status callbacks: POST /api/telephony/exotel?token=SECRET
// (or /api/telephony/generic). Configure the same URL in the provider's
// dashboard for incoming calls on your virtual number.

function tokenOk(request: Request) {
    const secret = process.env.TELEPHONY_WEBHOOK_SECRET;
    if (!secret) return false;
    const given = new URL(request.url).searchParams.get("token") || request.headers.get("x-webhook-token") || "";
    const a = Buffer.from(given), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
    const type = request.headers.get("content-type") || "";
    try {
        if (type.includes("application/json")) return await request.json();
        const form = await request.formData();
        return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    } catch {
        return null;
    }
}

/** The salesperson behind the call: our own user id echoed back, else their phone, else email. */
async function resolveAgent(agent: ParsedProviderCall["agent"]): Promise<string | null> {
    if (agent.userId) {
        const u = await db.user.findUnique({ where: { id: agent.userId }, select: { id: true } });
        if (u) return u.id;
    }
    const key = phoneKey(agent.phone);
    if (key.length === 10) {
        const staff = await db.user.findMany({ where: { role: { in: ["admin", "user"] }, phone: { not: null } }, select: { id: true, phone: true } });
        const hit = staff.find((s) => phoneKey(s.phone) === key);
        if (hit) return hit.id;
    }
    if (agent.email) {
        const u = await db.user.findUnique({ where: { email: agent.email }, select: { id: true } });
        if (u) return u.id;
    }
    return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
    const { provider } = await params;
    const parse = PROVIDER_PARSERS[provider];
    if (!parse) return NextResponse.json({ success: false, error: "Unknown provider" }, { status: 404 });
    if (!tokenOk(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await readBody(request);
    const items = Array.isArray(body) ? body : body ? [body] : [];
    const calls = items.map((b) => parse(b as Record<string, unknown>)).filter((c): c is ParsedProviderCall => !!c && phoneKey(c.customerPhone).length > 0);
    if (!calls.length) return NextResponse.json({ success: false, error: "No call in the payload" }, { status: 400 });

    try {
        const rows = await Promise.all(calls.map(async (c) => ({
            externalId: c.externalId, userId: await resolveAgent(c.agent), phone: c.customerPhone, direction: c.direction, status: c.status,
            startedAt: c.startedAt, answeredAt: c.answeredAt, endedAt: c.endedAt, durationSec: c.durationSec, talkSec: c.talkSec,
            recordingUrl: c.recordingUrl, leadId: c.leadId,
        })));
        const result = await ingestCalls("PROVIDER", provider, rows);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error(`Telephony webhook (${provider}) failed:`, error);
        return NextResponse.json({ success: false, error: "Could not store the call" }, { status: 500 });
    }
}
