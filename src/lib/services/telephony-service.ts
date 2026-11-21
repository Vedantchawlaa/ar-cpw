import { encodeCustomField } from "@/lib/telephony";

// Which call-tracking sources are switched on, from environment variables.
//
//   Phone call log (CPW Team Android app)    always available; the app uploads to /api/mobile/calls
//   Cloud telephony webhook                 TELEPHONY_WEBHOOK_SECRET
//   Click-to-call through Exotel            EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID
//                                           (+ EXOTEL_SUBDOMAIN, default api.exotel.com; use api.in.exotel.com for the Mumbai cluster)

const EXOTEL_VARS = ["EXOTEL_ACCOUNT_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_CALLER_ID"] as const;

export interface TelephonyStatus {
    webhook: boolean;
    clickToCall: "exotel" | null;
    missing: string[]; // env vars still needed for click-to-call + webhook
    appUrl: string | null;
    deviceCallsAll: boolean; // the phone app may upload calls with unknown numbers too
}

export function telephonyStatus(): TelephonyStatus {
    const missing = [...EXOTEL_VARS.filter((v) => !process.env[v])] as string[];
    if (!process.env.TELEPHONY_WEBHOOK_SECRET) missing.push("TELEPHONY_WEBHOOK_SECRET");
    return {
        webhook: !!process.env.TELEPHONY_WEBHOOK_SECRET,
        clickToCall: EXOTEL_VARS.every((v) => process.env[v]) && process.env.TELEPHONY_WEBHOOK_SECRET ? "exotel" : null,
        missing,
        appUrl: appUrl(),
        deviceCallsAll: process.env.CRM_DEVICE_CALLS === "all",
    };
}

function appUrl() {
    const u = process.env.APP_URL || process.env.AUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
    return u ? u.replace(/\/+$/, "").replace(/\/api\/auth$/, "") : null;
}

/**
 * Exotel Connect API: rings the salesperson's phone first, then bridges the
 * customer. The call record is written only when Exotel posts its status
 * callback to /api/telephony/exotel, so nothing is claimed here.
 */
export async function startExotelCall(opts: { agentPhone: string; customerPhone: string; userId: string; leadId: string }): Promise<{ ok: true; sid: string | null } | { ok: false; error: string }> {
    const base = appUrl();
    if (!base) return { ok: false, error: "APP_URL is not set, so Exotel cannot reach the status callback." };
    const sid = process.env.EXOTEL_ACCOUNT_SID!;
    const host = process.env.EXOTEL_SUBDOMAIN || "api.exotel.com";
    const body = new URLSearchParams({
        From: opts.agentPhone,
        To: opts.customerPhone,
        CallerId: process.env.EXOTEL_CALLER_ID!,
        Record: "true",
        StatusCallback: `${base}/api/telephony/exotel?token=${encodeURIComponent(process.env.TELEPHONY_WEBHOOK_SECRET!)}`,
        "StatusCallbackEvents[0]": "terminal",
        StatusCallbackContentType: "application/json",
        CustomField: encodeCustomField(opts.userId, opts.leadId),
    });
    try {
        const res = await fetch(`https://${host}/v1/Accounts/${encodeURIComponent(sid)}/Calls/connect.json`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(`${process.env.EXOTEL_API_KEY}:${process.env.EXOTEL_API_TOKEN}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
            signal: AbortSignal.timeout(15000),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return { ok: false, error: json?.RestException?.Message || `Exotel refused the call (HTTP ${res.status}).` };
        return { ok: true, sid: json?.Call?.Sid ?? null };
    } catch {
        return { ok: false, error: "Could not reach Exotel. Try again, or call from your phone." };
    }
}
