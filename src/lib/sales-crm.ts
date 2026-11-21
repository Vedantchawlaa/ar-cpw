// Sales CRM (Sales Funnel > Call Manager > Lead Management): constants and pure
// functions only (no DB, no path aliases) so they can be unit tested.
//
// Call honesty rule: only calls that came from the phone's own call log (DEVICE)
// or a cloud telephony provider (PROVIDER) are "verified". They are the only
// ones that count towards calls made, connected calls and talk time. A call the
// salesperson writes in by hand (MANUAL) is shown as self-reported, never with
// talk time. Clicking "Call" only opens the dialer; it never creates a call.

// ------------------------------------------------------------------ leads

export const LEAD_STATUSES = ["NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "QUOTATION_SENT", "FOLLOW_UP", "NEGOTIATION", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_INFO: Record<LeadStatus, { label: string; tone: string }> = {
    NEW: { label: "New", tone: "bg-slate-100 text-slate-700" },
    ASSIGNED: { label: "Assigned", tone: "bg-indigo-100 text-indigo-700" },
    CONTACTED: { label: "Contacted", tone: "bg-sky-100 text-sky-700" },
    INTERESTED: { label: "Interested", tone: "bg-teal-100 text-teal-700" },
    QUOTATION_SENT: { label: "Quotation Sent", tone: "bg-violet-100 text-violet-700" },
    FOLLOW_UP: { label: "Follow-up Required", tone: "bg-amber-100 text-amber-800" },
    NEGOTIATION: { label: "Negotiation", tone: "bg-orange-100 text-orange-800" },
    CONVERTED: { label: "Converted", tone: "bg-green-100 text-green-700" },
    LOST: { label: "Lost", tone: "bg-red-100 text-red-700" },
};

export const asStatus = (s: unknown): LeadStatus | null => {
    const v = String(s ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    if ((LEAD_STATUSES as readonly string[]).includes(v)) return v as LeadStatus;
    const byLabel = LEAD_STATUSES.find((k) => STATUS_INFO[k].label.toUpperCase().replace(/[\s-]+/g, "_") === v);
    return byLabel ?? (v === "FOLLOW_UP_REQUIRED" ? "FOLLOW_UP" : null);
};

/** Lead is still being worked (not converted or lost). */
export const isOpenStatus = (s: string) => s !== "CONVERTED" && s !== "LOST";

export const PRIORITIES = ["Hot", "Warm", "Cold"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_TONE: Record<string, string> = {
    Hot: "bg-red-50 text-red-700 ring-red-200",
    Warm: "bg-amber-50 text-amber-700 ring-amber-200",
    Cold: "bg-sky-50 text-sky-700 ring-sky-200",
};
export const asPriority = (p: unknown): Priority | null => PRIORITIES.find((x) => x.toLowerCase() === String(p ?? "").trim().toLowerCase()) ?? null;

export const LEAD_SOURCES = ["Walk-in", "Phone Call", "WhatsApp", "Website", "Instagram", "Facebook", "Google", "Referral", "Architect / Designer", "Existing Customer", "Other"];
export const PRODUCTS = ["Curtains", "Blinds", "Wallpaper", "Tracks", "Sofa Fabric", "Mattress", "Flooring", "Other"];

/** The Lead ID people read, e.g. L-1024. */
export const leadCode = (leadNo: number) => `L-${leadNo}`;

/** Last 10 digits of a phone number: how calls are matched to leads (+91 / 0 prefixes and spaces ignored). */
export function phoneKey(phone: string | null | undefined): string {
    const digits = String(phone ?? "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
}

/** A usable Indian mobile / landline: 10+ digits. */
export const isValidPhone = (phone: string | null | undefined) => phoneKey(phone).length === 10;

// ------------------------------------------------------------------ calls

export const CALL_STATUSES = ["CONNECTED", "MISSED", "REJECTED", "NOT_ANSWERED", "BUSY", "FAILED"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const CALL_STATUS_INFO: Record<CallStatus, { label: string; tone: string }> = {
    CONNECTED: { label: "Connected", tone: "bg-green-100 text-green-700" },
    MISSED: { label: "Missed", tone: "bg-red-100 text-red-700" },
    REJECTED: { label: "Rejected", tone: "bg-rose-100 text-rose-700" },
    NOT_ANSWERED: { label: "Not answered", tone: "bg-amber-100 text-amber-800" },
    BUSY: { label: "Busy", tone: "bg-orange-100 text-orange-800" },
    FAILED: { label: "Failed", tone: "bg-slate-200 text-slate-700" },
};
export type CallDirection = "OUTGOING" | "INCOMING";
export type CallSource = "DEVICE" | "PROVIDER" | "MANUAL";
export const isVerifiedSource = (s: string) => s === "DEVICE" || s === "PROVIDER";

export interface CallRow {
    userId: string | null;
    leadId?: string | null;
    direction: string;
    status: string;
    source: string;
    startedAt: Date;
    durationSec: number | null;
    talkSec: number | null;
}

export interface CallStats {
    total: number; // verified calls
    outgoing: number;
    incoming: number;
    connected: number;
    missed: number; // incoming calls not picked up
    rejected: number;
    notAnswered: number; // outgoing calls the customer did not pick up (incl. busy / failed)
    durationSec: number; // ring + talk
    talkSec: number;
    avgTalkSec: number; // per connected call
    lastCallAt: Date | null;
    selfReported: number; // MANUAL entries, not in any number above
}

export function callStats(calls: CallRow[]): CallStats {
    const s: CallStats = { total: 0, outgoing: 0, incoming: 0, connected: 0, missed: 0, rejected: 0, notAnswered: 0, durationSec: 0, talkSec: 0, avgTalkSec: 0, lastCallAt: null, selfReported: 0 };
    for (const c of calls) {
        if (!isVerifiedSource(c.source)) { s.selfReported++; continue; }
        s.total++;
        if (c.direction === "INCOMING") s.incoming++; else s.outgoing++;
        if (c.status === "CONNECTED") s.connected++;
        else if (c.status === "MISSED") s.missed++;
        else if (c.status === "REJECTED") s.rejected++;
        else s.notAnswered++;
        s.durationSec += c.durationSec ?? 0;
        s.talkSec += c.status === "CONNECTED" ? c.talkSec ?? 0 : 0;
        if (!s.lastCallAt || c.startedAt > s.lastCallAt) s.lastCallAt = c.startedAt;
    }
    s.avgTalkSec = s.connected ? Math.round(s.talkSec / s.connected) : 0;
    return s;
}

/** Android CallLog.Calls.TYPE values. */
const ANDROID_TYPE: Record<number, { direction: CallDirection; status: CallStatus }> = {
    1: { direction: "INCOMING", status: "CONNECTED" },
    2: { direction: "OUTGOING", status: "CONNECTED" }, // NOT_ANSWERED when duration is 0
    3: { direction: "INCOMING", status: "MISSED" },
    4: { direction: "INCOMING", status: "CONNECTED" }, // voicemail
    5: { direction: "INCOMING", status: "REJECTED" },
    6: { direction: "INCOMING", status: "REJECTED" }, // blocked
    7: { direction: "INCOMING", status: "CONNECTED" }, // answered on another device
};

export interface DeviceCall {
    id: string; // CallLog._ID on the phone
    number: string;
    type: number; // CallLog.Calls.TYPE
    date: number; // epoch ms when the call started
    duration: number; // seconds the call was connected (Android reports talk time, 0 when unanswered)
}

/**
 * A row read from the phone's call log as a CallLog record. Android only
 * records how long the call was connected, so talk time = duration and the
 * ring time is unknown.
 */
export function fromDeviceCall(c: DeviceCall) {
    const t = ANDROID_TYPE[c.type];
    if (!t) return null;
    const duration = Math.max(0, Math.round(c.duration || 0));
    const status: CallStatus = t.direction === "OUTGOING" && duration === 0 ? "NOT_ANSWERED" : t.status === "CONNECTED" && duration === 0 ? "MISSED" : t.status;
    const startedAt = new Date(c.date);
    const connected = status === "CONNECTED";
    return {
        direction: t.direction,
        status,
        startedAt,
        endedAt: new Date(c.date + duration * 1000),
        durationSec: duration,
        talkSec: connected ? duration : 0,
    };
}

// ------------------------------------------------------------------ time (India)

const IST_OFFSET_MS = 330 * 60 * 1000; // Asia/Kolkata, no daylight saving

/** India date (YYYY-MM-DD) of an instant. */
export const istDay = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
/** The instant an India day starts. */
export const istStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export const RANGE_PRESETS = ["today", "yesterday", "7d", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const RANGE_LABEL: Record<RangePreset, string> = { today: "Today", yesterday: "Yesterday", "7d": "Last 7 Days", "30d": "Last 30 Days", custom: "Custom" };

export interface DateRange { preset: RangePreset; from: string; to: string; start: Date; end: Date } // end exclusive

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

/** India-day range for a preset ("Last 7 Days" includes today). Bad custom dates fall back to today. */
export function resolveRange(preset: unknown, today: string, from?: unknown, to?: unknown): DateRange {
    let p: RangePreset = (RANGE_PRESETS as readonly string[]).includes(String(preset)) ? (preset as RangePreset) : "today";
    let f = today, t = today;
    if (p === "yesterday") f = t = addDays(today, -1);
    else if (p === "7d") f = addDays(today, -6);
    else if (p === "30d") f = addDays(today, -29);
    else if (p === "custom") {
        if (isDay(from) && isDay(to)) { f = from <= to ? from : to; t = from <= to ? to : from; }
        else if (isDay(from)) f = t = from;
        else p = "today";
    }
    return { preset: p, from: f, to: t, start: istStart(f), end: istStart(addDays(t, 1)) };
}

/** Every India day from..to inclusive (capped at 366). */
export function daysIn(from: string, to: string): string[] {
    const out: string[] = [];
    for (let d = from; d <= to && out.length < 366; d = addDays(d, 1)) out.push(d);
    return out;
}

/** Calls per day for a chart. */
export function dailyCalls(calls: CallRow[], from: string, to: string) {
    const days = new Map(daysIn(from, to).map((d) => [d, { day: d, calls: 0, connected: 0, talkSec: 0 }]));
    for (const c of calls) {
        if (!isVerifiedSource(c.source)) continue;
        const row = days.get(istDay(c.startedAt));
        if (!row) continue;
        row.calls++;
        if (c.status === "CONNECTED") { row.connected++; row.talkSec += c.talkSec ?? 0; }
    }
    return [...days.values()];
}

/** 75 -> "1m 15s", 3900 -> "1h 05m". */
export function formatDuration(sec: number | null | undefined): string {
    const s = Math.max(0, Math.round(sec ?? 0));
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(r).padStart(2, "0")}s`;
}

// ------------------------------------------------------------------ work status

export const WORK_STATUSES = ["AVAILABLE", "ON_CALL", "BREAK", "LUNCH", "MEETING"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];
export const WORK_STATUS_INFO: Record<WorkStatus | "OFFLINE", { label: string; dot: string; tone: string }> = {
    AVAILABLE: { label: "Available", dot: "bg-green-500", tone: "bg-green-50 text-green-700 ring-green-200" },
    ON_CALL: { label: "On Call", dot: "bg-blue-500", tone: "bg-blue-50 text-blue-700 ring-blue-200" },
    BREAK: { label: "On Break", dot: "bg-amber-500", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
    LUNCH: { label: "Lunch Break", dot: "bg-orange-500", tone: "bg-orange-50 text-orange-800 ring-orange-200" },
    MEETING: { label: "Meeting", dot: "bg-violet-500", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
    OFFLINE: { label: "Offline", dot: "bg-slate-300", tone: "bg-slate-50 text-slate-500 ring-slate-200" },
};
export const isBreakStatus = (s: string) => s === "BREAK" || s === "LUNCH";
export const asWorkStatus = (s: unknown): WorkStatus | null => (WORK_STATUSES as readonly string[]).includes(String(s)) ? (s as WorkStatus) : null;

export interface Interval { startedAt: Date; endedAt: Date | null }
export interface StatusInterval extends Interval { status: string }

/** Seconds of [a, b) inside [start, end); open intervals run until `now`. */
function overlapSec(i: Interval, start: Date, end: Date, now: Date): number {
    const a = Math.max(i.startedAt.getTime(), start.getTime());
    const b = Math.min((i.endedAt ?? now).getTime(), end.getTime(), now.getTime());
    return b > a ? Math.round((b - a) / 1000) : 0;
}

export interface WorkSummary {
    workedSec: number; // logged in, minus breaks
    loggedInSec: number; // Start Work .. End Work
    breakSec: number;
    breaks: number; // breaks that started inside the range
    firstLogin: Date | null;
    lastLogout: Date | null; // null while still working
}

export function workSummary(sessions: Interval[], events: StatusInterval[], start: Date, end: Date, now: Date = new Date()): WorkSummary {
    const inRange = sessions.filter((s) => overlapSec(s, start, end, now) > 0 || (s.startedAt >= start && s.startedAt < end));
    const loggedInSec = inRange.reduce((t, s) => t + overlapSec(s, start, end, now), 0);
    const breakEvents = events.filter((e) => isBreakStatus(e.status));
    const breakSec = breakEvents.reduce((t, e) => t + overlapSec(e, start, end, now), 0);
    const starts = inRange.map((s) => s.startedAt.getTime());
    const open = inRange.some((s) => !s.endedAt);
    const ends = inRange.filter((s) => s.endedAt).map((s) => s.endedAt!.getTime());
    return {
        loggedInSec,
        breakSec,
        workedSec: Math.max(0, loggedInSec - breakSec),
        breaks: breakEvents.filter((e) => e.startedAt >= start && e.startedAt < end).length,
        firstLogin: starts.length ? new Date(Math.min(...starts)) : null,
        lastLogout: open || !ends.length ? null : new Date(Math.max(...ends)),
    };
}

// ------------------------------------------------------------------ follow-ups

export type FollowUpBucket = "OVERDUE" | "TODAY" | "UPCOMING";

/** Overdue once the due time has passed; Today if due later today (India). */
export function followUpBucket(dueAt: Date, now: Date = new Date()): FollowUpBucket {
    if (dueAt < now) return "OVERDUE";
    return istDay(dueAt) === istDay(now) ? "TODAY" : "UPCOMING";
}

export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

// ------------------------------------------------------------------ import

export interface LeadImportRow {
    name: string;
    phone: string;
    altPhone: string | null;
    whatsapp: string | null;
    email: string | null;
    city: string;
    address: string | null;
    source: string | null;
    productInterest: string[];
    budget: number;
    priority: Priority;
    status: LeadStatus | null;
    notes: string | null;
    assignee: string | null; // email or name, resolved on the server
    nextFollowUp: string | null; // YYYY-MM-DD
}

const HEADER_ALIASES: Record<keyof LeadImportRow, string[]> = {
    name: ["name", "customer name", "customer", "client", "client name", "lead name", "full name"],
    phone: ["phone", "mobile", "mobile number", "mobile no", "phone number", "contact", "contact number", "number"],
    altPhone: ["alternate mobile", "alternate mobile number", "alternate phone", "alt phone", "alt mobile", "alternate number", "phone 2"],
    whatsapp: ["whatsapp", "whatsapp number", "whatsapp no"],
    email: ["email", "email address", "e-mail", "mail"],
    city: ["city", "town", "location"],
    address: ["address", "full address"],
    source: ["source", "lead source"],
    productInterest: ["product", "products", "product interest", "interest", "requirement"],
    budget: ["budget", "estimated budget", "expected value", "expected order value", "value", "amount"],
    priority: ["priority", "type", "lead type", "temperature"],
    status: ["status", "lead status", "stage"],
    notes: ["notes", "note", "remarks", "remark", "description", "comments"],
    assignee: ["assigned to", "assignee", "sales executive", "executive", "salesperson", "owner"],
    nextFollowUp: ["next follow-up", "next follow up", "follow-up date", "follow up date", "next follow-up date", "next contact"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, " ").replace(/[^a-z0-9 -]/g, "").trim();
const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Excel serial day (1900 system) or a date-ish string -> YYYY-MM-DD. */
function toDay(v: unknown): string | null {
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
    const s = cell(v);
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // Indian order: day/month/year
    if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
}

/** Spreadsheet row (header -> value) to a lead, or the reason it can't be imported. */
export function mapImportRow(raw: Record<string, unknown>): { ok: true; row: LeadImportRow } | { ok: false; error: string } {
    const byHeader = new Map<string, unknown>();
    for (const [k, v] of Object.entries(raw)) byHeader.set(norm(k), v);
    const get = (field: keyof LeadImportRow) => {
        for (const alias of HEADER_ALIASES[field]) if (byHeader.has(alias)) return byHeader.get(alias);
        return undefined;
    };
    const name = cell(get("name"));
    const phone = cell(get("phone"));
    if (!name) return { ok: false, error: "Customer name is missing" };
    if (!isValidPhone(phone)) return { ok: false, error: `Mobile number "${phone}" is not a valid 10-digit number` };
    const email = cell(get("email")) || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: `Email "${email}" is not valid` };
    const statusText = cell(get("status"));
    const status = statusText ? asStatus(statusText) : null;
    if (statusText && !status) return { ok: false, error: `Unknown status "${statusText}"` };
    const budgetText = cell(get("budget")).replace(/[₹,\s]/g, "").replace(/rs\.?/i, "");
    const budget = budgetText ? Number(budgetText) : 0;
    if (!Number.isFinite(budget) || budget < 0) return { ok: false, error: `Budget "${cell(get("budget"))}" is not a number` };
    const products = cell(get("productInterest")).split(/[,/;|]+/).map((p) => p.trim()).filter(Boolean)
        .map((p) => PRODUCTS.find((x) => x.toLowerCase() === p.toLowerCase()) ?? p);
    return {
        ok: true,
        row: {
            name: name.slice(0, 200),
            phone,
            altPhone: cell(get("altPhone")) || null,
            whatsapp: cell(get("whatsapp")) || null,
            email,
            city: cell(get("city")).slice(0, 200),
            address: cell(get("address")) || null,
            source: cell(get("source")) || null,
            productInterest: [...new Set(products)],
            budget,
            priority: asPriority(get("priority")) ?? "Warm",
            status,
            notes: cell(get("notes")) || null,
            assignee: cell(get("assignee")) || null,
            nextFollowUp: toDay(get("nextFollowUp")),
        },
    };
}
