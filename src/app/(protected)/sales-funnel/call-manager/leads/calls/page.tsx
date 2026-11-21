import { getCallLogs } from "@/lib/services/crm-queries";
import { canManage } from "@/lib/services/crm-service";
import { one, pageActor, pageRange, teamOptions, type SearchParams } from "@/lib/services/crm-page";
import { CALL_STATUSES, CALL_STATUS_INFO, formatDuration } from "@/lib/sales-crm";
import { CallLogTable } from "@/components/crm/CallLogTable";
import { RangeFilter, SelectFilter, StatCard } from "@/components/crm/ui";

export default async function CallLogsPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const sa = await pageActor();
    const range = pageRange(sp);
    const [data, options] = await Promise.all([
        getCallLogs(sa, range, { userId: canManage(sa) ? one(sp.user) || null : null, status: one(sp.status), direction: one(sp.direction), source: one(sp.source), q: one(sp.q), page: Number(one(sp.page)) || 1 }),
        canManage(sa) ? teamOptions(sa) : Promise.resolve([]),
    ]);
    const s = data.stats;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <RangeFilter />
                {canManage(sa) && <SelectFilter name="user" label="Salesperson" options={options} allLabel="Everyone" />}
                <SelectFilter name="direction" label="Type" options={[{ value: "OUTGOING", label: "Outgoing" }, { value: "INCOMING", label: "Incoming" }]} />
                <SelectFilter name="status" label="Status" options={CALL_STATUSES.map((c) => ({ value: c, label: CALL_STATUS_INFO[c].label }))} />
                <SelectFilter name="source" label="Source" options={[{ value: "verified", label: "Verified (phone log / provider)" }, { value: "manual", label: "Self-reported" }]} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                <StatCard label="Outgoing" value={s.outgoing} />
                <StatCard label="Incoming" value={s.incoming} />
                <StatCard label="Connected" value={s.connected} tone="green" />
                <StatCard label="Missed" value={s.missed} tone={s.missed ? "red" : undefined} />
                <StatCard label="Rejected" value={s.rejected} />
                <StatCard label="Not answered" value={s.notAnswered} />
                <StatCard label="Talk time" value={formatDuration(s.talkSec)} hint={`of ${formatDuration(s.durationSec)} total`} />
                <StatCard label="Avg talk" value={formatDuration(s.avgTalkSec)} hint="per connected call" />
            </div>
            {s.selfReported > 0 && <p className="text-xs text-slate-500">{s.selfReported} self-reported call{s.selfReported === 1 ? "" : "s"} in the list are not included in these numbers.</p>}
            <CallLogTable rows={data.rows} total={data.total} page={data.page} pages={data.pages} meId={sa.id} canManage={canManage(sa)} />
        </div>
    );
}
