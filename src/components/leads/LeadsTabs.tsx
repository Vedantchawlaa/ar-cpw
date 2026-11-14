"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/leads/client-files", label: "Client Files", icon: FolderOpen },
];

/** Sub-tabs shown at the top of the Leads section. */
export function LeadsTabs() {
    const pathname = usePathname();
    return (
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {TABS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
