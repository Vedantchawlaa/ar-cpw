"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORK_STATUS_INFO, formatDuration, type WorkStatus } from "@/lib/sales-crm";
import { EmptyState, WorkStatusPill, fmtTime, useQueryUpdate } from "./ui";

interface Row {
    id: string; name: string;
    current: { status: string; since: Date | null; sessionStartedAt: Date | null; stale: boolean };
    work: { workedSec: number; loggedInSec: number; breakSec: number; breaks: number; firstLogin: Date | null; lastLogout: Date | null };
}
interface TimelineRow { at: Date; label: string; status: string; until: Date | null }

export function WorkBoard({ rows, label, person, day, timeline }: { rows: Row[]; label: string; person: string | null; day: string; timeline: TimelineRow[] }) {
    const { update } = useQueryUpdate();
    const counts = rows.reduce<Record<string, number>>((m, r) => { const s = r.current.stale ? "OFFLINE" : r.current.status; m[s] = (m[s] ?? 0) + 1; return m; }, {});
    const selected = rows.find((r) => r.id === person);
    if (!rows.length) return <EmptyState title="No team members to show" />;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {(["AVAILABLE", "ON_CALL", "BREAK", "LUNCH", "MEETING", "OFFLINE"] as const).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm shadow-sm">
                        <span className={cn("h-2 w-2 rounded-full", WORK_STATUS_INFO[s].dot)} />{WORK_STATUS_INFO[s].label}<b className="tabular-nums">{counts[s] ?? 0}</b>
                    </span>
                ))}
            </div>
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                            <th className="px-3 py-2">Name</th><th className="px-3 py-2">Current status</th><th className="px-3 py-2">Login</th><th className="px-3 py-2">Logout</th>
                            <th className="px-3 py-2 text-right">Working hours</th><th className="px-3 py-2 text-right">Breaks</th><th className="px-3 py-2 text-right">Break time</th><th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className={cn("border-t", person === r.id && "bg-blue-50/40")}>
                                <td className="px-3 py-2 font-semibold text-slate-800">{r.name}</td>
                                <td className="px-3 py-2">
                                    <WorkStatusPill status={r.current.stale ? "OFFLINE" : r.current.status} since={r.current.stale ? null : r.current.since} />
                                    {r.current.stale && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="h-3 w-3" />End Work not pressed since {fmtTime(r.current.sessionStartedAt)}</div>}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-600">{fmtTime(r.work.firstLogin)}</td>
                                <td className="px-3 py-2 text-xs text-slate-600">{r.work.firstLogin ? (r.work.lastLogout ? fmtTime(r.work.lastLogout) : <span className="text-green-700">Still working</span>) : "–"}</td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDuration(r.work.workedSec)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{r.work.breaks}</td>
                                <td className={cn("px-3 py-2 text-right tabular-nums", r.work.breakSec > 5400 && "font-semibold text-amber-700")}>{formatDuration(r.work.breakSec)}</td>
                                <td className="px-3 py-2 text-right"><button onClick={() => update({ person: person === r.id ? null : r.id }, false)} className="text-xs text-blue-600 hover:underline">{person === r.id ? "Hide" : "History"}</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[11px] text-slate-400">Totals are for {label}. Working hours = Start Work to End Work, minus breaks and lunch. Every status change is stored with its time.</p>

            {selected && (
                <section className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-semibold text-slate-800">{selected.name} · status history</h3>
                        <input type="date" value={day} onChange={(e) => update({ day: e.target.value || null }, false)} className="h-8 rounded-md border px-2 text-sm" aria-label="Day" />
                    </div>
                    {timeline.length === 0 ? <p className="text-sm text-slate-400">No activity on this day.</p> : (
                        <ol className="relative space-y-3 border-l border-slate-200 pl-5">
                            {timeline.map((t, i) => {
                                const info = WORK_STATUS_INFO[t.status as WorkStatus];
                                return (
                                    <li key={i} className="relative text-sm">
                                        <span className={cn("absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", t.status === "START" ? "bg-green-600" : t.status === "END" ? "bg-slate-700" : info?.dot ?? "bg-slate-300")} />
                                        <span className="font-mono text-xs text-slate-500">{fmtTime(t.at)}</span>{" "}
                                        <span className="font-medium text-slate-800">{info?.label ?? t.label}</span>
                                        {info && <span className="text-xs text-slate-500"> · {t.until ? `until ${fmtTime(t.until)} (${formatDuration((new Date(t.until).getTime() - new Date(t.at).getTime()) / 1000)})` : "now"}</span>}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            )}
        </div>
    );
}
