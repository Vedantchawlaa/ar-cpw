import { getLeadsPage, leadSources } from "@/lib/services/crm-queries";
import { canManage } from "@/lib/services/crm-service";
import { one, pageActor, teamOptions, type SearchParams } from "@/lib/services/crm-page";
import { LeadTable } from "@/components/crm/LeadTable";

export default async function LeadListPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const sa = await pageActor();
    const filters = {
        q: one(sp.q), status: one(sp.status), priority: one(sp.priority), assignee: canManage(sa) ? one(sp.assignee) : "", source: one(sp.source),
        product: one(sp.product), followUp: one(sp.followUp), from: one(sp.from), to: one(sp.to), sort: one(sp.sort), page: Number(one(sp.page)) || 1,
    };
    const [data, team, sources] = await Promise.all([getLeadsPage(sa, filters), teamOptions(sa), leadSources(sa)]);
    return <LeadTable rows={data.rows} total={data.total} page={data.page} pages={data.pages} team={team} sources={sources} canManage={canManage(sa)} />;
}
