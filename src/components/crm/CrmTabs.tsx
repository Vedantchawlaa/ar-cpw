"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarClock, PhoneCall, BarChart3, Coffee, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRM_BASE } from "./ui";

const TABS = [
    { href: CRM_BASE, label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "EXECUTIVE"] },
    { href: `${CRM_BASE}/list`, label: "Leads", icon: Users, roles: ["ADMIN", "MANAGER", "EXECUTIVE"] },
    { href: `${CRM_BASE}/follow-ups`, label: "Follow-ups", icon: CalendarClock, roles: ["ADMIN", "MANAGER", "EXECUTIVE"] },
    { href: `${CRM_BASE}/calls`, label: "Call Logs", icon: PhoneCall, roles: ["ADMIN", "MANAGER", "EXECUTIVE"] },
    { href: `${CRM_BASE}/team`, label: "Performance", icon: BarChart3, roles: ["ADMIN", "MANAGER", "EXECUTIVE"] },
    { href: `${CRM_BASE}/work`, label: "Work Status", icon: Coffee, roles: ["ADMIN", "MANAGER"] },
    { href: `${CRM_BASE}/setup`, label: "Setup", icon: Settings2, roles: ["ADMIN"] },
];

export function CrmTabs({ role, followUpCount }: { role: string; followUpCount: number }) {
    const pathname = usePathname();
    return (
        <nav className="-mx-1 flex gap-1 overflow-x-auto border-b px-1" aria-label="Lead Management">
            {TABS.filter((t) => t.roles.includes(role)).map(({ href, label, icon: Icon }) => {
                const active = href === CRM_BASE ? pathname === href : pathname.startsWith(href);
                return (
                    <Link key={href} href={href}
                        className={cn("-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                            active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}>
                        <Icon className="h-4 w-4" />
                        {label}
                        {label === "Follow-ups" && followUpCount > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{followUpCount}</span>}
                    </Link>
                );
            })}
        </nav>
    );
}
