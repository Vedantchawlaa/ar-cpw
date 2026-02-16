import { LeadDashboard } from "@/components/leads/LeadDashboard";
import { getLeads } from "@/lib/actions/lead-actions";

export default async function LeadsPage() {
    const leads = await getLeads();

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Leads Management</h2>
            </div>
            <LeadDashboard initialLeads={leads as any} />
        </div>
    );
}
