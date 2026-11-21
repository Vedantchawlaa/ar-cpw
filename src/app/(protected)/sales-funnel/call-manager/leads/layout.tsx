import Link from "next/link";
import { ChevronRight, AlertTriangle, CalendarClock } from "lucide-react";
import { auth } from "@/auth";
import { toActor } from "@/lib/services/types";
import { getSalesActor } from "@/lib/services/crm-service";
import { myFollowUpAlert, myWorkState } from "@/lib/services/crm-queries";
import { CrmTabs } from "@/components/crm/CrmTabs";
import { MyWorkBar } from "@/components/crm/MyWorkBar";
import { CRM_BASE } from "@/components/crm/ui";

export const dynamic = "force-dynamic";

export default async function LeadManagementLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    const sa = session?.user ? await getSalesActor(toActor(session.user)) : null;
    if (!sa) {
        return <p className="m-6 rounded-lg border bg-red-50 p-6 text-sm text-red-700">You do not have access to Lead Management. Ask an admin to add you to the team.</p>;
    }
    let work: Awaited<ReturnType<typeof myWorkState>> | null = null;
    let alert = { overdue: 0, today: 0 };
    let loadError = false;
    try {
        [work, alert] = await Promise.all([myWorkState(sa.id), myFollowUpAlert(sa.id)]);
    } catch (e) {
        console.error("Lead Management header failed:", e);
        loadError = true;
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-4">
            <div className="space-y-1">
                <nav className="flex items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
                    <span>Sales Funnel</span><ChevronRight className="h-3 w-3" /><span>Call Manager</span><ChevronRight className="h-3 w-3" /><span className="text-slate-600">Lead Management</span>
                </nav>
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Lead Management</h1>
                    <span className="text-xs text-slate-400">{sa.role === "ADMIN" ? "Admin · whole team" : sa.role === "MANAGER" ? `Sales manager · ${sa.visibleUserIds!.length - 1} in team` : "Sales executive · your leads"}</span>
                </div>
            </div>

            {loadError && <p className="rounded-lg border bg-red-50 p-3 text-sm text-red-700">Could not load your status. If this keeps happening, the database migration for Lead Management may not be applied yet.</p>}
            {work && <MyWorkBar state={{ status: work.status, since: work.since, sessionStartedAt: work.sessionStartedAt, stale: work.stale, today: work.today }} />}

            {(alert.overdue > 0 || alert.today > 0) && (
                <Link href={`${CRM_BASE}/follow-ups${alert.overdue ? "?view=overdue" : ""}`}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${alert.overdue ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                    {alert.overdue ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CalendarClock className="h-4 w-4 shrink-0" />}
                    <span>
                        {alert.overdue > 0 && <b>{alert.overdue} overdue follow-up{alert.overdue === 1 ? "" : "s"}</b>}
                        {alert.overdue > 0 && alert.today > 0 && " and "}
                        {alert.today > 0 && <>{alert.today} due later today</>}
                        {" "}assigned to you.
                    </span>
                    <span className="ml-auto text-xs underline">Open</span>
                </Link>
            )}

            <CrmTabs role={sa.role} followUpCount={alert.overdue + alert.today} />
            {children}
        </div>
    );
}
