import { getLeadDetail } from "@/lib/services/crm-queries";
import { canManage } from "@/lib/services/crm-service";
import { pageActor, teamOptions } from "@/lib/services/crm-page";
import { telephonyStatus } from "@/lib/services/telephony-service";
import { LeadDetail } from "@/components/crm/LeadDetail";
import { EmptyState } from "@/components/crm/ui";

export default async function LeadProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const sa = await pageActor();
    const [detail, team] = await Promise.all([getLeadDetail(sa, id), teamOptions(sa)]);
    if (!detail) return <EmptyState title="Lead not found">It may have been deleted, or it is not assigned to you.</EmptyState>;
    return <LeadDetail lead={detail.lead} names={detail.names} team={team} canManage={canManage(sa)} telephony={telephonyStatus().clickToCall} />;
}
