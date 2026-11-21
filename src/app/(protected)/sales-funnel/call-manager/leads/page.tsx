import Link from "next/link";
import { Users, PhoneCall, PhoneIncoming, Clock, Timer, CalendarClock, AlertTriangle, Trophy, XCircle, UserPlus, UserCheck, Sparkles } from "lucide-react";
import { getDashboard, getTeamPerformance } from "@/lib/services/crm-queries";
import { canManage } from "@/lib/services/crm-service";
import { one, pageActor, pageRange, teamOptions, type SearchParams } from "@/lib/services/crm-page";
import { RANGE_LABEL, STATUS_INFO, formatDuration } from "@/lib/sales-crm";
import { AutoRefresh, BarList, CRM_BASE, DailyColumns, Panel, RangeFilter, SelectFilter, StatCard, WorkStatusPill } from "@/components/crm/ui";

export default async function LeadDashboardPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const sa = await pageActor();
    const range = pageRange(sp);
    const userId = canManage(sa) ? one(sp.user) || null : null;
    const [d, team, options] = await Promise.all([
        getDashboard(sa, range, userId),
        canManage(sa) ? getTeamPerformance(sa, range) : Promise.resolve(null),
        canManage(sa) ? teamOptions(sa) : Promise.resolve([]),
    ]);
    const label = range.preset === "custom" ? `${range.from} to ${range.to}` : RANGE_LABEL[range.preset];
    const people = (team?.people ?? []).filter((p) => !userId || p.id === userId);

    return (
        <div className="space-y-5">
            <AutoRefresh seconds={60} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <RangeFilter />
                {canManage(sa) && <SelectFilter name="user" label="Salesperson" options={options} allLabel="Everyone" />}
            </div>

            <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Leads · {label}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <StatCard label="Total Leads" value={d.leads.total} hint="created" icon={<Users className="h-4 w-4" />} />
                    <StatCard label="New Leads" value={d.leads.new} hint="created, not yet assigned" icon={<Sparkles className="h-4 w-4" />} />
                    <StatCard label="Assigned" value={d.leads.assigned} hint="given to a salesperson" icon={<UserPlus className="h-4 w-4" />} />
                    <StatCard label="Contacted" value={d.leads.contacted} hint="connected call or marked" icon={<UserCheck className="h-4 w-4" />} />
                    <StatCard label="Interested" value={d.leads.interested} hint="moved to Interested" tone="blue" />
                    <StatCard label="Converted" value={d.leads.converted} tone="green" icon={<Trophy className="h-4 w-4" />} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Lost Leads" value={d.leads.lost} tone={d.leads.lost ? "red" : undefined} icon={<XCircle className="h-4 w-4" />} hint={label} />
                <Link href={`${CRM_BASE}/follow-ups`}><StatCard label="Follow-ups Due Today" value={d.followUps.dueToday} tone={d.followUps.dueToday ? "amber" : undefined} hint="right now" icon={<CalendarClock className="h-4 w-4" />} /></Link>
                <Link href={`${CRM_BASE}/follow-ups?view=overdue`}><StatCard label="Overdue Follow-ups" value={d.followUps.overdue} tone={d.followUps.overdue ? "red" : undefined} hint="right now" icon={<AlertTriangle className="h-4 w-4" />} /></Link>
                <StatCard label="Total Calls Made" value={d.calls.outgoing} hint={`${d.calls.incoming} incoming · ${d.calls.connected} connected`} icon={<PhoneCall className="h-4 w-4" />} />
                <StatCard label="Total Talk Time" value={formatDuration(d.calls.talkSec)} icon={<Clock className="h-4 w-4" />} hint={label} />
                <StatCard label="Avg Call Duration" value={formatDuration(d.calls.avgTalkSec)} hint="per connected call" icon={<Timer className="h-4 w-4" />} />
            </div>
            {d.calls.selfReported > 0 && (
                <p className="text-xs text-slate-500"><PhoneIncoming className="mr-1 inline h-3.5 w-3.5" />{d.calls.selfReported} call{d.calls.selfReported === 1 ? " was" : "s were"} logged by hand (self-reported). They are not counted above.</p>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title={`Daily calling activity · ${label}`} className="lg:col-span-2">
                    <DailyColumns days={d.daily} />
                </Panel>
                <Panel title="Pipeline now" action={<Link href={`${CRM_BASE}/list`} className="text-xs text-blue-600 hover:underline">All leads</Link>}>
                    <ul className="space-y-1.5 text-sm">
                        {d.pipeline.map((p) => (
                            <li key={p.status}>
                                <Link href={`${CRM_BASE}/list?status=${p.status}${userId ? `&assignee=${userId}` : ""}`} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
                                    <span className="text-slate-600">{STATUS_INFO[p.status].label}</span>
                                    <span className="font-semibold tabular-nums text-slate-800">{p.count}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            {team && (
                <div className="grid gap-4 lg:grid-cols-3">
                    <Panel title="Team right now" action={<Link href={`${CRM_BASE}/work`} className="text-xs text-blue-600 hover:underline">Work status</Link>}>
                        <ul className="divide-y text-sm">
                            {people.map((p) => (
                                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                                    <span className="truncate font-medium text-slate-700">{p.name}</span>
                                    <WorkStatusPill status={p.current.stale ? "OFFLINE" : p.current.status} since={p.current.stale ? null : p.current.since} />
                                </li>
                            ))}
                        </ul>
                    </Panel>
                    <Panel title="Calls per salesperson">
                        <BarList rows={people.map((p) => ({ label: p.name, value: p.calls.total, sub: `${p.calls.connected} conn.` }))} empty="No verified calls in this period." />
                    </Panel>
                    <Panel title="Talk time per salesperson" action={<Link href={`${CRM_BASE}/team`} className="text-xs text-blue-600 hover:underline">Full report</Link>}>
                        <BarList rows={people.map((p) => ({ label: p.name, value: p.calls.talkSec }))} format="duration" color="bg-emerald-500" empty="No talk time in this period." />
                    </Panel>
                </div>
            )}
        </div>
    );
}
