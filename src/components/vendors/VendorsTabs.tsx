import Link from "next/link";
import { Store, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
    { tab: "orders", label: "Orders", icon: Store },
    { tab: "ledger", label: "Work Ledger", icon: NotebookPen },
] as const;

export type VendorsTab = (typeof TABS)[number]["tab"];

/** Sub-tabs at the top of the Vendors page. */
export function VendorsTabs({ active }: { active: VendorsTab }) {
    return (
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {TABS.map(({ tab, label, icon: Icon }) => (
                <Link
                    key={tab}
                    href={tab === "orders" ? "/vendors" : `/vendors?tab=${tab}`}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        active === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
                    )}
                >
                    <Icon className="h-4 w-4" />
                    {label}
                </Link>
            ))}
        </div>
    );
}
