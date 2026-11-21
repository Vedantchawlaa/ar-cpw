import { NextResponse } from "next/server";
import { z } from "zod";
import { getMobileActor, unauthorized } from "@/lib/mobile/auth";
import { ingestCalls, matchLeadsByPhone, type IncomingCall } from "@/lib/services/crm-service";
import { telephonyStatus } from "@/lib/services/telephony-service";
import { fromDeviceCall, phoneKey } from "@/lib/sales-crm";

// The CPW Team Android app reads the phone's call log (READ_CALL_LOG) and posts
// new rows here. These are the phone's own records of each call, so they count
// as verified calls. Safe to resend: rows are keyed by user + device + call id.
//
// By default only calls with a number that belongs to a lead are kept, so a
// salesperson's personal calls never reach the server. Set CRM_DEVICE_CALLS=all
// to keep every call (e.g. company SIMs, to catch enquiries from new numbers).

const BodySchema = z.object({
    deviceId: z.string().min(1).max(100),
    calls: z.array(z.object({
        id: z.union([z.string(), z.number()]).transform(String),
        number: z.string().max(40),
        type: z.number().int(),
        date: z.number().int().positive(), // epoch ms
        duration: z.number().min(0).max(86400),
    })).max(500),
});

export async function POST(request: Request) {
    const actor = await getMobileActor(request);
    if (!actor) return unauthorized();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Malformed call log batch" }, { status: 400 });
    const { deviceId, calls } = parsed.data;

    const keepAll = telephonyStatus().deviceCallsAll;
    const known = keepAll ? null : await matchLeadsByPhone(calls.map((c) => phoneKey(c.number)), actor.id);
    const rows: IncomingCall[] = [];
    let skipped = 0;
    for (const c of calls) {
        const call = fromDeviceCall(c);
        if (!call || !phoneKey(c.number) || (known && !known.has(phoneKey(c.number)))) { skipped++; continue; }
        rows.push({ externalId: `${actor.id}:${deviceId}:${c.id}`, userId: actor.id, phone: c.number, ...call });
    }

    try {
        const result = await ingestCalls("DEVICE", null, rows);
        const latest = calls.reduce((m, c) => Math.max(m, c.date), 0);
        // the app sends calls after `since` next time
        return NextResponse.json({ success: true, ...result, skipped, since: latest || null });
    } catch (error) {
        console.error("Call log upload failed:", error);
        return NextResponse.json({ success: false, error: "Upload failed, will retry" }, { status: 500 });
    }
}
