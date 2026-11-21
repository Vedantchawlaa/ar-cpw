"use client";

import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { ALL_TIME, monthPeriod, prevMonth, type Period } from "@/lib/vendor-ledger";

export type PeriodMode = "all" | "this" | "last" | "month" | "range";

export interface PeriodState { mode: PeriodMode; month: string; from: string; to: string }

const MODES: Array<{ mode: PeriodMode; label: string }> = [
    { mode: "all", label: "All time" },
    { mode: "this", label: "This month" },
    { mode: "last", label: "Last month" },
    { mode: "month", label: "Pick month" },
    { mode: "range", label: "Dates" },
];

export const initialPeriod = (today: string): PeriodState => ({ mode: "all", month: today.slice(0, 7), from: `${today.slice(0, 7)}-01`, to: today });

/** The date range the filter stands for. */
export function periodOf(s: PeriodState, today: string): Period {
    const thisMonth = today.slice(0, 7);
    switch (s.mode) {
        case "this": return monthPeriod(thisMonth);
        case "last": return monthPeriod(prevMonth(thisMonth));
        case "month": return s.month ? monthPeriod(s.month) : ALL_TIME;
        case "range": return { from: s.from || null, to: s.to || null };
        default: return ALL_TIME;
    }
}

const fmt = (d: string, withYear = true) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });

/** Words for the range, e.g. "November 2026" or "1 Nov – 15 Nov 2026". */
export function periodLabel(s: PeriodState, today: string): string {
    const p = periodOf(s, today);
    if (!p.from && !p.to) return "All time";
    if (s.mode !== "range") return monthName(p.from!.slice(0, 7));
    if (p.from && p.to) return `${fmt(p.from, p.from.slice(0, 4) !== p.to.slice(0, 4))} – ${fmt(p.to)}`;
    return p.from ? `From ${fmt(p.from)}` : `Up to ${fmt(p.to!)}`;
}

/** All time / this month / last month / any month / a date range. */
export function PeriodFilter({ value, onChange }: { value: PeriodState; onChange: (s: PeriodState) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-2 no-print">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
                {MODES.map(({ mode, label }) => (
                    <button key={mode} type="button" onClick={() => onChange({ ...value, mode })}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${value.mode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                        {label}
                    </button>
                ))}
            </div>
            {value.mode === "month" && (
                <Input type="month" value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })} className="h-8 w-40 text-sm" />
            )}
            {value.mode === "range" && (
                <span className="flex items-center gap-1.5">
                    <Input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-8 w-36 text-sm" title="From" />
                    <span className="text-xs text-slate-400">to</span>
                    <Input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-8 w-36 text-sm" title="To" />
                </span>
            )}
        </div>
    );
}
