import { getTeamPerformance, workTimeline } from "@/lib/services/crm-queries";
import { canManage } from "@/lib/services/crm-service";
import { one, pageActor, pageRange, type SearchParams } from "@/lib/services/crm-page";
import { RANGE_LABEL, istDay } from "@/lib/sales-crm";
import { WorkBoard } from "@/components/crm/WorkBoard";
import { AutoRefresh, EmptyState, RangeFilter } from "@/components/crm/ui";

export default async function WorkStatusPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const sa = await pageActor();
    if (!canManage(sa)) return <EmptyState title="Only admins and sales managers can see the team's work status">Your own status and hours are in the bar above.</EmptyState>;
    const range = pageRange(sp);
    const person = one(sp.person) || null;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.day)) ? one(sp.day) : range.to <= istDay(new Date()) ? range.to : istDay(new Date());
    const [team, timeline] = await Promise.all([getTeamPerformance(sa, range), person ? workTimeline(sa, person, day) : Promise.resolve([])]);
    const label = range.preset === "custom" ? `${range.from} to ${range.to}` : RANGE_LABEL[range.preset];
    return (
        <div className="space-y-4">
            <AutoRefresh seconds={30} />
            <RangeFilter />
            <WorkBoard rows={team.people.map((p) => ({ id: p.id, name: p.name, current: { status: p.current.status, since: p.current.since, sessionStartedAt: p.current.sessionStartedAt, stale: p.current.stale }, work: p.work }))}
                label={label} person={person} day={day} timeline={timeline} />
        </div>
    );
}
