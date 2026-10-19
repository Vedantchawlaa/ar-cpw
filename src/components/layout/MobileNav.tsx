"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Bell, LayoutDashboard, Users, FileText, Package, ShoppingBag, DollarSign, Settings, Smartphone, Ruler, Store, Clock, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface MobileNavProps {
    role?: string;
    userName?: string;
    reminderCount?: number;
}

export function MobileNav({ role, userName, reminderCount = 0 }: MobileNavProps) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

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
            icon: UserCog,
            label: "Staff",
            adminOnly: true,
        },
        {
            href: "/attendance",
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

    return (
        <div className="md:hidden">
            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-slate-600"
                onClick={() => setIsOpen(true)}
            >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
            </Button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-300 ease-in-out transform",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    <div className="flex h-16 items-center border-b px-6">
                        <Link href="/" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
                            <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                            <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight leading-none">CHAWLA</span>
                                <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                            </div>
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-8 w-8 text-slate-500"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4">
                        <nav className="grid items-start px-4 text-sm font-medium space-y-1">
                            {filteredNavItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-3 transition-all",
                                        pathname === item.href
                                            ? "bg-slate-100 text-primary font-semibold"
                                            : "text-muted-foreground hover:text-foreground hover:bg-slate-50"
                                    )}
                                >
                                    {item.icon && <item.icon className={cn("h-5 w-5", pathname === item.href ? "text-primary" : "text-muted-foreground")} />}
                                    <span>{item.label}</span>
                                    {item.hasBadge && (
                                        <span className="ml-auto h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
                                    )}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-auto p-4 border-t bg-slate-50">
                        <div className="flex items-center gap-3 px-2 py-2">
                            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                                <span className="text-sm font-semibold">{userName?.substring(0, 2).toUpperCase() || "U"}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{userName || "User"}</span>
                                <span className="text-xs text-muted-foreground capitalize">{role || "Team Member"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
