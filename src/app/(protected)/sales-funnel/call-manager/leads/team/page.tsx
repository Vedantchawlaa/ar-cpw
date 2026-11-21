import { getTeamPerformance } from "@/lib/services/crm-queries";
import { one, pageActor, pageRange, type SearchParams } from "@/lib/services/crm-page";
import { RANGE_LABEL } from "@/lib/sales-crm";
import { TeamPerformance } from "@/components/crm/TeamPerformance";
import { AutoRefresh, RangeFilter } from "@/components/crm/ui";

export default async function TeamPerformancePage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const sa = await pageActor();
    const range = pageRange(sp, "7d");
    const data = await getTeamPerformance(sa, range);
    const label = range.preset === "custom" ? `${range.from} to ${range.to}` : RANGE_LABEL[range.preset];
    return (
        <div className="space-y-4">
            <AutoRefresh seconds={120} />
            <RangeFilter defaultPreset="7d" />
            <TeamPerformance people={data.people} daily={data.daily} label={label} personId={one(sp.person) || null}
                compareIds={one(sp.compare).split(",").filter(Boolean)} single={sa.role === "EXECUTIVE"} />
        </div>
    );
}
