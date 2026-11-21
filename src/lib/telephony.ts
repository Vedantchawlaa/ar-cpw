// Cloud telephony webhooks -> call records. Pure (no DB, no path aliases) so
// it can be unit tested. The webhook route resolves the agent to a user and
// stores the result through crm-service.ingestCalls.
//
// A call counts as CONNECTED only when the provider reports conversation time.

import type { CallStatus } from "./sales-crm";

export interface ParsedProviderCall {
    externalId: string;
    customerPhone: string;
    agent: { userId?: string | null; phone?: string | null; email?: string | null };
    leadId: string | null;
    direction: "OUTGOING" | "INCOMING";
    status: CallStatus;
    startedAt: Date;
    answeredAt: Date | null;
    endedAt: Date | null;
    durationSec: number | null;
    talkSec: number | null;
    recordingUrl: string | null;
    final: boolean; // false = an in-progress event; stored, but may be updated later
}

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Exotel timestamps are India time "YYYY-MM-DD HH:mm:ss" (ISO with offset also accepted). */
export function parseProviderTime(v: unknown): Date | null {
    const s = str(v);
    if (!s) return null;
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - 330 * 60000);
}

/** What our click-to-call puts in Exotel's CustomField, echoed back in the callback. */
export const encodeCustomField = (userId: string, leadId: string | null) => JSON.stringify({ u: userId, l: leadId });
function decodeCustomField(v: unknown): { u?: string; l?: string | null } {
    try { const o = JSON.parse(str(v)); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

/**
 * Exotel call status callback (Connect API "StatusCallback", or an ExoPhone
 * passthru for incoming calls). Body may be JSON or form fields.
 */
export function parseExotel(body: Record<string, unknown>): ParsedProviderCall | null {
    const sid = str(body.CallSid);
    if (!sid) return null;
    const exoStatus = str(body.Status || body.CallStatus || body.DialCallStatus).toLowerCase();
    const inbound = str(body.Direction).toLowerCase().startsWith("inbound") || (!body.Direction && !!body.DialWhomNumber);
    const talk = num(body.ConversationDuration ?? body.DialCallDuration);
    const started = parseProviderTime(body.StartTime ?? body.DateCreated);
    const ended = parseProviderTime(body.EndTime ?? (["completed", "busy", "failed", "no-answer", "canceled"].includes(exoStatus) ? body.DateUpdated : null));
    const final = ["completed", "busy", "failed", "no-answer", "canceled"].includes(exoStatus) || !!ended;
    const connected = (talk ?? 0) > 0;
    let status: CallStatus;
    if (connected) status = "CONNECTED";
    else if (inbound) status = exoStatus === "busy" ? "REJECTED" : "MISSED";
    else status = exoStatus === "busy" ? "BUSY" : exoStatus === "failed" ? "FAILED" : "NOT_ANSWERED";
    const custom = decodeCustomField(body.CustomField);
    const startedAt = started ?? new Date();
    const durationSec = ended && started ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : num(body.Duration ?? body.DialCallDuration);
    return {
        externalId: sid,
        customerPhone: inbound ? str(body.From || body.CallFrom) : str(body.To || body.CallTo),
        agent: { userId: custom.u ?? null, phone: inbound ? str(body.DialWhomNumber) || null : str(body.From) || null },
        leadId: custom.l ?? null,
        direction: inbound ? "INCOMING" : "OUTGOING",
        status,
        startedAt,
        answeredAt: connected && ended && talk ? new Date(ended.getTime() - talk * 1000) : null,
        endedAt: ended,
        durationSec,
        talkSec: connected ? talk : 0,
        recordingUrl: str(body.RecordingUrl) || null,
        final,
    };
}

const GENERIC_STATUS: Record<string, CallStatus> = {
    connected: "CONNECTED", answered: "CONNECTED", completed: "CONNECTED",
    missed: "MISSED", rejected: "REJECTED", declined: "REJECTED", busy: "BUSY", failed: "FAILED",
    "no-answer": "NOT_ANSWERED", no_answer: "NOT_ANSWERED", not_answered: "NOT_ANSWERED", unanswered: "NOT_ANSWERED", canceled: "NOT_ANSWERED", cancelled: "NOT_ANSWERED",
};

/**
 * Our own format, for any provider / middleware (Zapier, a dialer app, ...):
 * { externalId, customerPhone, direction: "OUTGOING"|"INCOMING", status, startedAt,
 *   endedAt?, durationSec?, talkSec?, recordingUrl?, leadId?, agentEmail? | agentPhone? | userId? }
 * A "completed"/"connected" call with no talk time is stored as not answered / missed.
 */
export function parseGeneric(body: Record<string, unknown>): ParsedProviderCall | null {
    const externalId = str(body.externalId || body.id);
    const customerPhone = str(body.customerPhone || body.phone);
    const startedAt = parseProviderTime(body.startedAt);
    if (!externalId || !customerPhone || !startedAt) return null;
    const direction = str(body.direction).toUpperCase().startsWith("IN") ? "INCOMING" : "OUTGOING";
    const endedAt = parseProviderTime(body.endedAt);
    const talk = num(body.talkSec);
    let status = GENERIC_STATUS[str(body.status).toLowerCase()] ?? "NOT_ANSWERED";
    if (status === "CONNECTED" && !(talk && talk > 0)) status = direction === "INCOMING" ? "MISSED" : "NOT_ANSWERED";
    return {
        externalId,
        customerPhone,
        agent: { userId: str(body.userId) || null, phone: str(body.agentPhone) || null, email: str(body.agentEmail) || null },
        leadId: str(body.leadId) || null,
        direction,
        status,
        startedAt,
        answeredAt: null,
        endedAt,
        durationSec: num(body.durationSec) ?? (endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null),
        talkSec: status === "CONNECTED" ? talk : 0,
        recordingUrl: str(body.recordingUrl) || null,
        final: true,
    };
}

export const PROVIDER_PARSERS: Record<string, (b: Record<string, unknown>) => ParsedProviderCall | null> = {
    exotel: parseExotel,
    generic: parseGeneric,
};
