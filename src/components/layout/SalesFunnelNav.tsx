"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Filter, PhoneCall, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyFollowUpBadge } from "@/lib/actions/crm-actions";

const LEADS = "/sales-funnel/call-manager/leads";

/** Sales Funnel > Call Manager > Lead Management, with the signed-in person's due follow-ups. */
export function SalesFunnelNav({ onNavigate, large }: { onNavigate?: () => void; large?: boolean }) {
    const pathname = usePathname();
    const inside = pathname.startsWith("/sales-funnel");
    const [open, setOpen] = useState(true);
    const [due, setDue] = useState(0);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            const b = await getMyFollowUpBadge();
            if (alive) setDue(b ? b.overdue + b.today : 0);
        };
        load();
        const t = setInterval(load, 5 * 60 * 1000);
        return () => { alive = false; clearInterval(t); };
    }, [pathname]);

    const py = large ? "py-3" : "py-2.5";
    return (
        <div>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                className={cn("flex w-full items-center gap-3 rounded-md px-3 text-left transition-all", py, inside ? "text-foreground" : "text-muted-foreground hover:bg-slate-100/50 hover:text-foreground")}>
                <Filter className={cn(large ? "h-5 w-5" : "h-4 w-4", inside ? "text-primary" : "text-muted-foreground")} />
                <span>Sales Funnel</span>
                <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
            </button>
            {open && (
                <div className="ml-5 border-l pl-2">
                    <div className={cn("flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400", large ? "py-2" : "py-1.5")}>
                        <PhoneCall className="h-3.5 w-3.5" />Call Manager
                    </div>
                    <Link href={LEADS} onClick={onNavigate}
                        className={cn("ml-3 flex items-center gap-2 rounded-md px-3 transition-all", large ? "py-2.5" : "py-2",
                            inside ? "bg-white text-primary shadow-sm ring-1 ring-slate-200" : "text-muted-foreground hover:bg-slate-100/50 hover:text-foreground")}>
                        <Users className={cn("h-4 w-4", inside ? "text-primary" : "text-muted-foreground")} />
                        <span>Lead Management</span>
                        {due > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white" title="Your overdue and due-today follow-ups">{due}</span>}
                    </Link>
                </div>
            )}
        </div>
    );
}
