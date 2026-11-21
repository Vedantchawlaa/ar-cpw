"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDuration, type CallStats } from "@/lib/sales-crm";
import { BarList, DailyColumns, EmptyState, Panel, WorkStatusPill, useQueryUpdate, CRM_BASE } from "./ui";

export interface Person {
    id: string; name: string; salesRole: string; assignedLeads: number; calls: CallStats; followUpsDone: number; followUpsPending: number; followUpsOverdue: number;
    followUpRate: number; convertedInRange: number; convertedTotal: number; conversionPct: number;
    work: { workedSec: number; breakSec: number; breaks: number };
    current: { status: string; since: Date | null; stale: boolean };
    daily: Array<{ day: string; calls: number; connected: number; talkSec: number }>;
}

const ROLE: Record<string, string> = { ADMIN: "Admin", MANAGER: "Manager", EXECUTIVE: "Executive" };

const METRICS: Array<{ label: string; get: (p: Person) => number; fmt?: (n: number) => string; better?: "high" | "low" }> = [
    { label: "Assigned leads", get: (p) => p.assignedLeads },
    { label: "Calls made (outgoing)", get: (p) => p.calls.outgoing, better: "high" },
    { label: "Incoming calls", get: (p) => p.calls.incoming },
    { label: "Connected calls", get: (p) => p.calls.connected, better: "high" },
    { label: "Missed calls", get: (p) => p.calls.missed, better: "low" },
    { label: "Not answered", get: (p) => p.calls.notAnswered },
    { label: "Total talk time", get: (p) => p.calls.talkSec, fmt: formatDuration, better: "high" },
    { label: "Average talk time", get: (p) => p.calls.avgTalkSec, fmt: formatDuration },
    { label: "Follow-ups completed", get: (p) => p.followUpsDone, better: "high" },
    { label: "Follow-ups pending", get: (p) => p.followUpsPending },
    { label: "Overdue follow-ups", get: (p) => p.followUpsOverdue, better: "low" },
    { label: "Follow-up completion", get: (p) => p.followUpRate, fmt: (n) => `${n}%`, better: "high" },
    { label: "Converted (period)", get: (p) => p.convertedInRange, better: "high" },
    { label: "Conversion % (all time)", get: (p) => p.conversionPct, fmt: (n) => `${n}%`, better: "high" },
    { label: "Worked", get: (p) => p.work.workedSec, fmt: formatDuration },
    { label: "Break time", get: (p) => p.work.breakSec, fmt: formatDuration },
];

export function TeamPerformance({ people, daily, label, personId, compareIds, single }: {
    people: Person[]; daily: Person["daily"]; label: string; personId: string | null; compareIds: string[]; single: boolean;
}) {
    const { update } = useQueryUpdate();
    if (!people.length) return <EmptyState title="No team members yet">Add staff in Team, then set their sales roles in Setup.</EmptyState>;

    const person = personId ? people.find((p) => p.id === personId) : single ? people[0] : null;
    const compare = people.filter((p) => compareIds.includes(p.id));
    const toggleCompare = (id: string) => {
        const next = compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id].slice(-4);
        update({ compare: next.join(",") || null });
    };

    if (person) {
        const totals = person.calls;
        return (
            <div className="space-y-4">
                {!single && <button onClick={() => update({ person: null })} className="text-sm text-slate-500 hover:text-slate-800">← Whole team</button>}
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">{person.name}</h2>
                    <span className="text-xs text-slate-400">{ROLE[person.salesRole]}</span>
                    <WorkStatusPill status={person.current.stale ? "OFFLINE" : person.current.status} since={person.current.stale ? null : person.current.since} />
                    <Link href={`${CRM_BASE}/list?assignee=${person.id}`} className="ml-auto text-xs text-blue-600 hover:underline">Their leads</Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {METRICS.slice(0, 16).map((m) => (
                        <div key={m.label} className="rounded-xl border bg-white p-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{m.label}</p>
                            <p className="text-xl font-bold tabular-nums text-slate-900">{(m.fmt ?? String)(m.get(person))}</p>
                        </div>
                    ))}
                </div>
                <Panel title={`Daily calling activity · ${label}`}><DailyColumns days={person.daily} /></Panel>
                {totals.selfReported > 0 && <p className="text-xs text-slate-500">{totals.selfReported} self-reported call{totals.selfReported === 1 ? "" : "s"} not counted.</p>}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                <table className="w-full min-w-[1100px] text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                            <th className="px-3 py-2">Compare</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Status now</th>
                            <th className="px-3 py-2 text-right">Assigned</th><th className="px-3 py-2 text-right">Calls</th><th className="px-3 py-2 text-right">Connected</th>
                            <th className="px-3 py-2 text-right">Missed</th><th className="px-3 py-2 text-right">Talk time</th><th className="px-3 py-2 text-right">Avg talk</th>
                            <th className="px-3 py-2 text-right">F/U done</th><th className="px-3 py-2 text-right">Pending</th><th className="px-3 py-2 text-right">Overdue</th>
                            <th className="px-3 py-2 text-right">Converted</th><th className="px-3 py-2 text-right">Conv. %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {people.map((p) => (
                            <tr key={p.id} className="border-t hover:bg-slate-50/60">
                                <td className="px-3 py-2"><input type="checkbox" aria-label={`Compare ${p.name}`} checked={compareIds.includes(p.id)} onChange={() => toggleCompare(p.id)} /></td>
                                <td className="px-3 py-2"><button onClick={() => update({ person: p.id })} className="font-semibold text-slate-800 hover:text-blue-700">{p.name}</button><div className="text-[11px] text-slate-400">{ROLE[p.salesRole]}</div></td>
                                <td className="px-3 py-2"><WorkStatusPill status={p.current.stale ? "OFFLINE" : p.current.status} since={p.current.stale ? null : p.current.since} /></td>
                                <td className="px-3 py-2 text-right tabular-nums">{p.assignedLeads}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{p.calls.total}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-green-700">{p.calls.connected}</td>
                                <td className={cn("px-3 py-2 text-right tabular-nums", p.calls.missed && "text-red-600")}>{p.calls.missed}</td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDuration(p.calls.talkSec)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatDuration(p.calls.avgTalkSec)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{p.followUpsDone}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{p.followUpsPending}</td>
                                <td className={cn("px-3 py-2 text-right tabular-nums", p.followUpsOverdue && "font-semibold text-red-600")}>{p.followUpsOverdue}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{p.convertedInRange}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{p.conversionPct}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[11px] text-slate-400">Calls, talk time, follow-ups done and converted are for {label}. Assigned, pending, overdue and conversion % are as of now. Conversion % = converted ÷ all leads assigned to them. Only verified calls (phone log or provider) are counted.</p>

            {compare.length >= 2 && (
                <Panel title={`Comparison · ${label}`} action={<button onClick={() => update({ compare: null })} className="text-xs text-slate-500 hover:text-slate-800">Clear</button>}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1.5 pr-3">Metric</th>{compare.map((p) => <th key={p.id} className="px-3 py-1.5 text-right">{p.name}</th>)}</tr></thead>
                            <tbody>
                                {METRICS.map((m) => {
                                    const vals = compare.map((p) => m.get(p));
                                    const best = m.better === "high" ? Math.max(...vals) : m.better === "low" ? Math.min(...vals) : null;
                                    return (
                                        <tr key={m.label} className="border-t">
                                            <td className="py-1.5 pr-3 text-slate-600">{m.label}</td>
                                            {compare.map((p, i) => <td key={p.id} className={cn("px-3 py-1.5 text-right tabular-nums", best !== null && vals[i] === best && new Set(vals).size > 1 && "font-bold text-green-700")}>{(m.fmt ?? String)(vals[i])}</td>)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}
            {compare.length === 1 && <p className="text-xs text-slate-500">Tick one more person to compare.</p>}

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Calls per employee"><BarList rows={people.map((p) => ({ label: p.name, value: p.calls.total, sub: `· ${p.calls.connected} connected` }))} empty="No verified calls in this period." /></Panel>
                <Panel title="Talk time per employee"><BarList rows={people.map((p) => ({ label: p.name, value: p.calls.talkSec }))} format="duration" color="bg-emerald-500" empty="No talk time in this period." /></Panel>
                <Panel title={`Daily calling activity · team · ${label}`} className="lg:col-span-2"><DailyColumns days={daily} /></Panel>
                <Panel title="Lead conversion"><BarList rows={people.map((p) => ({ label: p.name, value: p.conversionPct, sub: `· ${p.convertedTotal}/${p.assignedLeads}` }))} format="percent" color="bg-violet-500" empty="No conversions yet." /></Panel>
                <Panel title="Follow-up completion rate"><BarList rows={people.map((p) => ({ label: p.name, value: p.followUpRate, sub: `· ${p.followUpsDone} done, ${p.followUpsOverdue} overdue` }))} format="percent" color="bg-amber-500" empty="No follow-ups completed in this period." /></Panel>
            </div>
            <p className="text-[11px] text-slate-400">Follow-up completion rate = completed in the period ÷ (completed + currently overdue).</p>
        </div>
    );
}

