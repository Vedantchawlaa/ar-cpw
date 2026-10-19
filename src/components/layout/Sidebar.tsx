"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// @ts-ignore
import { Bell, LayoutDashboard, LineChart, Package, Settings, Users, FileText, Zap, Smartphone, DollarSign, ShoppingBag, Store, Ruler, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { getReminderCount } from "@/lib/actions/reminder-actions";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [reminderCount, setReminderCount] = useState(0);
    const role = (session?.user as any)?.role;

    useEffect(() => {
        const fetchCount = async () => {
            const count = await getReminderCount();
            setReminderCount(count);
        };
        fetchCount();
        const interval = setInterval(fetchCount, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        {
            href: "/dashboard",
            icon: LayoutDashboard,
            label: "Dashboard",
            adminOnly: true,
        },
        {
            href: "/leads",
            icon: Users,
            label: "Leads",
        },
        {
            href: "/measurements",
            icon: Ruler,
            label: "Measurements",
        },
        {
            href: "/quotations",
            icon: FileText,
            label: "Quotations",
        },
        {
            href: "/reminders",
            icon: Bell,
            label: "Reminders",
            hasBadge: reminderCount > 0,
        },
        {
            href: "/products",
            icon: Package,
            label: "Products",
            adminOnly: false,
        },
        {
            href: "/vendors",
            icon: Store,
            label: "Vendors",
            adminOnly: true,
        },
        {
            href: "/stock",
            icon: Package,
            label: "Stock",
            adminOnly: true,
        },
        {
            href: "/orders",
            icon: ShoppingBag,
            label: "Web Orders",
            adminOnly: false,
        },
        {
            href: "/processing-orders",
            icon: FileText,
            label: "Orders",
            adminOnly: true,
        },
        {
            href: "/sales",
            icon: DollarSign,
            label: "Sales",
            adminOnly: true,
        },

        {
            href: "/settings/users",
            icon: Users,
            label: "Team",
            adminOnly: true,
        },
        {
            href: "/staff",
            icon: Clock,
            label: "Staff Attendance",
            adminOnly: true,
        },
        {
            href: "/settings",
            icon: Settings,
            label: "Settings",
        },
        {
            href: "/transactions",
            icon: DollarSign,
            label: "Transactions",
            adminOnly: true,
        },
        {
            href: "/ar",
            icon: Smartphone,
            label: "AR",
        },
    ];

    const filteredNavItems = navItems.filter(item => !item.adminOnly || role === 'admin');
    const userName = session?.user?.name || "User";
    const userRoleText = role === 'admin' ? "Administrator" : "Team Member";
    const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    return (
        <div className="hidden border-r bg-slate-50/50 md:block h-screen sticky top-0 backdrop-blur-xl">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-16 items-center border-b px-6 lg:h-[64px]">
                    <Link href="/" className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                        <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-tight leading-none">CHAWLA</span>
                            <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                        </div>
                    </Link>
                    <Link href="/reminders">
                        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground relative">
                            <Bell className="h-4 w-4" />
                            {reminderCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 border-2 border-slate-50" />
                            )}
                            <span className="sr-only">View reminders</span>
                        </Button>
                    </Link>
                </div>
                <div className="flex-1 overflow-auto py-4">
                    <nav className="grid items-start px-4 text-sm font-medium lg:px-4 space-y-1">
                        {filteredNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2.5 transition-all relative group",
                                    pathname === item.href
                                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                                        : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50"
                                )}
                            >
                                {item.icon && <item.icon className={cn("h-4 w-4", pathname === item.href ? "text-primary" : "text-muted-foreground")} />}
                                <span>{item.label}</span>
                                {item.hasBadge && (
                                    <span className="ml-auto h-2 w-2 rounded-full bg-blue-500 ring-4 ring-slate-50/50 group-hover:ring-slate-100/50" />
                                )}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t bg-slate-50/50">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                            <span className="text-xs font-semibold">{userInitials}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">{userName}</span>
                            <span className="text-xs text-muted-foreground capitalize">{userRoleText}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
