import { AllLeadsDashboard } from "@/components/leads/AllLeadsDashboard";
import { getLeads } from "@/lib/actions/lead-actions";

export default async function AllLeadsPage() {
    const leads = await getLeads();

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <AllLeadsDashboard initialLeads={leads as any} />
        </div>
    );
}
