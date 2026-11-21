"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    CALL_STATUS_INFO, PRIORITY_TONE, RANGE_LABEL, RANGE_PRESETS, STATUS_INFO, WORK_STATUS_INFO, formatDuration,
    type CallStatus, type LeadStatus, type WorkStatus,
} from "@/lib/sales-crm";

export const CRM_BASE = "/sales-funnel/call-manager/leads";
export const leadHref = (id: string) => `${CRM_BASE}/lead/${id}`;

// ------------------------------------------------------------------ badges

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const info = STATUS_INFO[status as LeadStatus];
    return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", info?.tone ?? "bg-slate-100 text-slate-600", className)}>{info?.label ?? status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
    return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", PRIORITY_TONE[priority] ?? "bg-slate-50 text-slate-600 ring-slate-200")}>{priority}</span>;
}

export function CallStatusBadge({ status }: { status: string }) {
    const info = CALL_STATUS_INFO[status as CallStatus];
    return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", info?.tone ?? "bg-slate-100 text-slate-600")}>{info?.label ?? status}</span>;
}

export function SourceTag({ source }: { source: string }) {
    if (source === "MANUAL") return <span title="Written in by the salesperson; not verified, no talk time counted" className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Self-reported</span>;
    return <span title={source === "DEVICE" ? "From the phone's call log" : "From the telephony provider"} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">{source === "DEVICE" ? "Phone log" : "Provider"}</span>;
}

export function WorkStatusPill({ status, since }: { status: string; since?: Date | string | null }) {
    const info = WORK_STATUS_INFO[status as WorkStatus | "OFFLINE"] ?? WORK_STATUS_INFO.OFFLINE;
    return (
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", info.tone)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", info.dot)} />
            {info.label}
            {since && status !== "OFFLINE" && <Since at={since} />}
        </span>
    );
}

/** "for 12m", ticking every 30s. */
export function Since({ at }: { at: Date | string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
    return <span className="font-normal opacity-75">· {formatDuration(Math.max(0, (now - new Date(at).getTime()) / 1000)).replace(/ \d+s$/, "")}</span>;
}

// ------------------------------------------------------------------ cards

export function StatCard({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "green" | "amber" | "blue"; icon?: ReactNode }) {
    const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : tone === "blue" ? "text-blue-700" : "text-slate-900";
    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                {icon && <span className="text-slate-300">{icon}</span>}
            </div>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
    );
}

export function Panel({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cn("rounded-xl border bg-white shadow-sm", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                {action}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="rounded-xl border border-dashed bg-slate-50/50 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            {children && <div className="mx-auto mt-1 max-w-md text-xs text-slate-500">{children}</div>}
        </div>
    );
}

export const fmtDateTime = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–";
export const fmtDate = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "–";
export const fmtTime = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : "–";

/** Value for <input type="datetime-local"> in India time. */
export function toLocalInput(d: Date) {
    return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 16);
}
/** <input type="datetime-local"> value (India time) -> ISO instant. */
export function fromLocalInput(v: string) {
    return v ? new Date(`${v}:00+05:30`).toISOString() : "";
}

// ------------------------------------------------------------------ URL-driven filters

/** Sets / clears search params and navigates, keeping the rest. */
export function useQueryUpdate() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [pending, start] = useTransition();
    const update = (changes: Record<string, string | null | undefined>, resetPage = true) => {
        const next = new URLSearchParams(params.toString());
        for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
        if (resetPage && !("page" in changes)) next.delete("page");
        start(() => router.push(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
    };
    return { params, update, pending };
}

export function RangeFilter({ defaultPreset = "today" }: { defaultPreset?: string }) {
    const { params, update, pending } = useQueryUpdate();
    const preset = params.get("range") || defaultPreset;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
                {RANGE_PRESETS.map((p) => (
                    <button key={p} type="button" onClick={() => update({ range: p === defaultPreset ? null : p, from: p === "custom" ? params.get("from") : null, to: p === "custom" ? params.get("to") : null })}
                        className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", preset === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}>
                        {RANGE_LABEL[p]}
                    </button>
                ))}
            </div>
            {preset === "custom" && (
                <span className="flex items-center gap-1.5">
                    <input type="date" aria-label="From" value={params.get("from") ?? ""} onChange={(e) => update({ range: "custom", from: e.target.value })} className="h-8 rounded-md border px-2 text-sm" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="date" aria-label="To" value={params.get("to") ?? ""} onChange={(e) => update({ range: "custom", to: e.target.value })} className="h-8 rounded-md border px-2 text-sm" />
                </span>
            )}
            {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
    );
}

export function SelectFilter({ name, label, options, allLabel = "All" }: { name: string; label: string; options: Array<{ value: string; label: string }>; allLabel?: string }) {
    const { params, update } = useQueryUpdate();
    return (
        <select aria-label={label} value={params.get(name) ?? ""} onChange={(e) => update({ [name]: e.target.value || null })}
            className="h-9 rounded-md border bg-white px-2 text-sm text-slate-700">
            <option value="">{label}: {allLabel}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

/** Re-reads the page's server data every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
    const router = useRouter();
    useEffect(() => {
        const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
        return () => clearInterval(t);
    }, [router, seconds]);
    return null;
}

// ------------------------------------------------------------------ charts (no library)

const BAR_FORMAT = { number: (n: number) => String(n), duration: formatDuration, percent: (n: number) => `${n}%` };

/** Horizontal bars, one per person. `format` is a name so server components can pass it. */
export function BarList({ rows, format: formatName = "number", color = "bg-blue-500", empty = "No data yet." }: { rows: Array<{ label: string; value: number; sub?: string }>; format?: keyof typeof BAR_FORMAT; color?: string; empty?: string }) {
    const format = BAR_FORMAT[formatName];
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (!rows.length || rows.every((r) => r.value === 0)) return <p className="py-6 text-center text-xs text-slate-400">{empty}</p>;
    return (
        <ul className="space-y-2.5">
            {rows.map((r) => (
                <li key={r.label} className="text-xs">
                    <div className="mb-1 flex justify-between gap-2"><span className="truncate font-medium text-slate-700">{r.label}</span><span className="shrink-0 tabular-nums text-slate-500">{format(r.value)}{r.sub && <span className="ml-1 text-slate-400">{r.sub}</span>}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", color)} style={{ width: `${(r.value / max) * 100}%` }} /></div>
                </li>
            ))}
        </ul>
    );
}

/** Daily columns: total calls with the connected part darker. */
export function DailyColumns({ days }: { days: Array<{ day: string; calls: number; connected: number; talkSec: number }> }) {
    const max = Math.max(1, ...days.map((d) => d.calls));
    if (days.every((d) => d.calls === 0)) return <p className="py-10 text-center text-xs text-slate-400">No verified calls in this period.</p>;
    const label = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
    const step = Math.ceil(days.length / 10);
    return (
        <div>
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Calls per day">
                {days.map((d) => (
                    <div key={d.day} className="flex h-full flex-1 flex-col justify-end overflow-hidden rounded-t" title={`${label(d.day)}: ${d.calls} calls, ${d.connected} connected, ${formatDuration(d.talkSec)} talk`}>
                        <div className="w-full bg-blue-200" style={{ height: `${((d.calls - d.connected) / max) * 100}%` }} />
                        <div className="w-full bg-blue-600" style={{ height: `${(d.connected / max) * 100}%` }} />
                    </div>
                ))}
            </div>
            <div className="mt-1 flex gap-1">
                {days.map((d, i) => <span key={d.day} className="flex-1 truncate text-center text-[10px] text-slate-400">{i % step === 0 ? label(d.day) : ""}</span>)}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" />Connected</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-200" />Not connected</span>
            </div>
        </div>
    );
}

export function Pager({ page, pages, total }: { page: number; pages: number; total: number }) {
    const { update } = useQueryUpdate();
    if (pages <= 1) return <p className="text-xs text-slate-400">{total} total</p>;
    return (
        <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{total} total · page {page} of {pages}</span>
            <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)} className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-slate-50">Previous</button>
            <button disabled={page >= pages} onClick={() => update({ page: String(page + 1) }, false)} className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-slate-50">Next</button>
        </div>
    );
}
