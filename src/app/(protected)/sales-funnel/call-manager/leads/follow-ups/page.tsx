import { getFollowUps } from "@/lib/services/crm-queries";
import { canManage } from "@/lib/services/crm-service";
import { one, pageActor, teamOptions, type SearchParams } from "@/lib/services/crm-page";
import { FollowUpList } from "@/components/crm/FollowUpList";
import { SelectFilter } from "@/components/crm/ui";

export default async function FollowUpsPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const sa = await pageActor();
    const view = ["overdue", "upcoming", "done"].includes(one(sp.view)) ? one(sp.view) : "today";
    // executives see their own; managers/admins can narrow to one person
    const userId = canManage(sa) ? one(sp.user) || null : sa.id;
    const [data, options] = await Promise.all([getFollowUps(sa, view, userId), canManage(sa) ? teamOptions(sa) : Promise.resolve([])]);
    return (
        <div className="space-y-3">
            {canManage(sa) && <SelectFilter name="user" label="Salesperson" options={options} allLabel="Everyone" />}
            <FollowUpList rows={data.rows} counts={data.counts} view={view} showAssignee={canManage(sa)} />
        </div>
    );
}
