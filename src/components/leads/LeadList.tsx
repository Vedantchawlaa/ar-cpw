"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { Trash2, Pencil } from "lucide-react";
import { deleteLead } from "@/lib/actions/lead-actions";
import { Lead } from "@prisma/client";
import { cn, formatDate } from "@/lib/utils";

interface LeadListProps {
    leads: Lead[];
    onEdit: (lead: Lead) => void;
}

export function LeadList({ leads, onEdit }: LeadListProps) {
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
        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">City</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Last Contacted</th>
                            <th className="px-4 py-3">Next Contact</th>
                            <th className="px-4 py-3 text-right">Value</th>
                            <th className="px-4 py-3 text-center">Quote Shared</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leads.map((lead) => {
                            const nextDate = (lead as any).nextContactDate ? new Date((lead as any).nextContactDate) : null;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);

                            const rowBg = nextDate ? (nextDate < today ? "bg-red-50" : "bg-blue-50/30") : "bg-green-50/30";

                            return (
                                <tr key={lead.id} className={cn("transition-colors", rowBg)}>
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
                                        ₹{lead.expectedOrderValue.toLocaleString()}
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
    );
}
