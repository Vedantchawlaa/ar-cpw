import { pageActor } from "@/lib/services/crm-page";
import { visibleTeam } from "@/lib/services/crm-service";
import { telephonyStatus } from "@/lib/services/telephony-service";
import { SetupPanel } from "@/components/crm/SetupPanel";
import { EmptyState } from "@/components/crm/ui";

export default async function CrmSetupPage() {
    const sa = await pageActor();
    if (sa.role !== "ADMIN") return <EmptyState title="Only an admin can change Lead Management setup" />;
    const members = await visibleTeam(sa);
    return <SetupPanel members={members} telephony={telephonyStatus()} />;
}
