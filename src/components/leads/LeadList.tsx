"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { Trash2, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { deleteLead } from "@/lib/actions/lead-actions";
import { Lead } from "@prisma/client";
import { cn, formatDate, formatCurrency } from "@/lib/utils";

interface LeadListProps {
    leads: Lead[];
    onEdit: (lead: Lead) => void;
}

type SortConfig = {
    key: keyof Lead | "nextContactDate" | "description" | "quotationShared";
    direction: 'asc' | 'desc' | null;
};

export function LeadList({ leads, onEdit }: LeadListProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: null });

    const sortedLeads = useMemo(() => {
        if (!sortConfig.direction) return leads;

        return [...leads].sort((a: any, b: any) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === bValue) return 0;
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (sortConfig.direction === 'asc') {
                return aValue < bValue ? -1 : 1;
            } else {
                return aValue > bValue ? -1 : 1;
            }
        });
    }, [leads, sortConfig]);

    const handleSort = (key: SortConfig['key']) => {
        let direction: SortConfig['direction'] = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortConfig['key']) => {
        if (sortConfig.key !== key || !sortConfig.direction) {
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
        }
        return sortConfig.direction === 'asc' ?
            <ArrowUp className="h-3 w-3 ml-1 text-blue-600" /> :
            <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />;
    };

    if (leads.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    No leads found. Add one to get started!
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block rounded-md border bg-white shadow-sm overflow-hidden text-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b text-slate-500 font-medium">
                            <tr>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Name {getSortIcon('name')}</div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('city')}>
                                    <div className="flex items-center">City {getSortIcon('city')}</div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('phone')}>
                                    <div className="flex items-center">Contact {getSortIcon('phone')}</div>
                                </th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('type')}>
                                    <div className="flex items-center">Type {getSortIcon('type')}</div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('lastContacted')}>
                                    <div className="flex items-center">Last Contacted {getSortIcon('lastContacted')}</div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('nextContactDate')}>
                                    <div className="flex items-center">Next Contact {getSortIcon('nextContactDate')}</div>
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('expectedOrderValue')}>
                                    <div className="flex items-center justify-end">Value {getSortIcon('expectedOrderValue')}</div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('quotationShared')}>
                                    <div className="flex items-center justify-center">Quote Shared {getSortIcon('quotationShared')}</div>
                                </th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                            {sortedLeads.map((lead) => {
                                const nextDate = (lead as any).nextContactDate ? new Date((lead as any).nextContactDate) : null;
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                const rowBg = nextDate ? (nextDate < today ? "bg-red-50/50" : "bg-blue-50/30") : "bg-green-50/30";

                                return (
                                    <tr key={lead.id} className={cn("transition-colors hover:bg-slate-50/50", rowBg)}>
                                        <td className="px-4 py-3 font-medium text-slate-900">{lead.name}</td>
                                        <td className="px-4 py-3 text-slate-600">{lead.city}</td>
                                        <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                                        <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={(lead as any).description || ""}>
                                            {(lead as any).description || "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant={
                                                    lead.type === "Hot"
                                                        ? "destructive"
                                                        : lead.type === "Warm"
                                                            ? "secondary"
                                                            : "outline"
                                                }
                                                className={
                                                    lead.type === "Hot" ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200" :
                                                        lead.type === "Warm" ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200" :
                                                            "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                                }
                                            >
                                                {lead.type}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {formatDate(lead.lastContacted)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {(lead as any).nextContactDate ? (
                                                <span className={`font-medium ${new Date((lead as any).nextContactDate) < new Date() ? "text-red-600" : "text-blue-600"}`}>
                                                    {formatDate((lead as any).nextContactDate)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">Not set</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            ₹{formatCurrency(Math.round(lead.expectedOrderValue))}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {(lead as any).quotationShared ? (
                                                <span className="inline-flex items-center justify-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEdit(lead)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a href={`/leads/${lead.id}`}>
                                                        <span className="sr-only">Measurements</span>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ruler"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" /></svg>
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={async () => {
                                                        if (confirm("Are you sure you want to delete this lead?")) {
                                                            await deleteLead(lead.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 gap-4">
                {sortedLeads.map((lead) => {
                    const nextDate = (lead as any).nextContactDate ? new Date((lead as any).nextContactDate) : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const cardBorder = nextDate ? (nextDate < today ? "border-l-4 border-l-red-500" : "border-l-4 border-l-blue-500") : "border-l-4 border-l-green-500";

                    return (
                        <Card key={lead.id} className={cn("overflow-hidden text-slate-800", cardBorder)}>
                            <CardContent className="p-4 space-y-3 font-medium">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900 leading-tight">{lead.name}</h3>
                                        <p className="text-sm text-slate-500">{lead.city}</p>
                                    </div>
                                    <Badge
                                        variant={
                                            lead.type === "Hot"
                                                ? "destructive"
                                                : lead.type === "Warm"
                                                    ? "secondary"
                                                    : "outline"
                                        }
                                        className={cn(
                                            "capitalize text-xs",
                                            lead.type === "Hot" ? "bg-red-100 text-red-700" :
                                                lead.type === "Warm" ? "bg-amber-100 text-amber-700" :
                                                    "bg-blue-50 text-blue-700"
                                        )}
                                    >
                                        {lead.type}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 text-sm border-t pt-3">
                                    <div>
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Contact</p>
                                        <p className="font-semibold text-slate-700">{lead.phone}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Estimated Value</p>
                                        <p className="font-bold text-slate-900">₹{formatCurrency(Math.round(lead.expectedOrderValue))}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Next Follow-up</p>
                                        <p className={cn(
                                            "font-semibold",
                                            nextDate && nextDate < today ? "text-red-600" : "text-blue-600"
                                        )}>
                                            {nextDate ? formatDate(nextDate) : "Not set"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Quote Sent</p>
                                        <span className={cn(
                                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
                                            (lead as any).quotationShared ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                        )}>
                                            {(lead as any).quotationShared ? "Yes" : "No"}
                                        </span>
                                    </div>
                                </div>

                                {(lead as any).description && (
                                    <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 italic border border-slate-100">
                                        {(lead as any).description}
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2 border-t mt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-2 h-9"
                                        onClick={() => onEdit(lead)}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-2 h-9"
                                        asChild
                                    >
                                        <a href={`/leads/${lead.id}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" /></svg>
                                            Measure
                                        </a>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={async () => {
                                            if (confirm("Are you sure?")) {
                                                await deleteLead(lead.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
