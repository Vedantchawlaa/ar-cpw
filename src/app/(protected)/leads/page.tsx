import { LeadDashboard } from "@/components/leads/LeadDashboard";
import { getLeads } from "@/lib/actions/lead-actions";
import { LeadsTabs } from "@/components/leads/LeadsTabs";

export default async function LeadsPage() {
    const leads = await getLeads();

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Leads Management</h2>
                <LeadsTabs />
            </div>
            <LeadDashboard initialLeads={leads as any} />
        </div>
    );
}
