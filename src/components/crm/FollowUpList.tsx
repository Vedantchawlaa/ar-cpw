"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { followUpBucket, leadCode } from "@/lib/sales-crm";
import { EmptyState, PriorityBadge, StatusBadge, fmtDateTime, leadHref, useQueryUpdate } from "./ui";
import { CancelFollowUpDialog, CompleteFollowUpDialog, RescheduleFollowUpDialog, type FollowUpLite } from "./FollowUpDialogs";

interface Row {
    id: string; dueAt: Date; notes: string | null; status: string; outcome: string | null; completedAt: Date | null;
    lead: { id: string; leadNo: number; name: string; phone: string; status: string; type: string };
    assignedTo: { id: string; name: string } | null;
}

const VIEWS = [
    { key: "today", label: "Today" },
    { key: "overdue", label: "Overdue" },
    { key: "upcoming", label: "Upcoming" },
    { key: "done", label: "Closed (30 days)" },
] as const;

export function FollowUpList({ rows, counts, view, showAssignee }: { rows: Row[]; counts: { overdue: number; today: number; upcoming: number }; view: string; showAssignee: boolean }) {
    const { update } = useQueryUpdate();
    const [dialog, setDialog] = useState<null | { kind: "done" | "move" | "cancel"; fu: FollowUpLite }>(null);
    return (
        <div className="space-y-3">
            <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
                {VIEWS.map((v) => {
                    const n = v.key === "done" ? null : counts[v.key];
                    return (
                        <button key={v.key} onClick={() => update({ view: v.key === "today" ? null : v.key })}
                            className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", view === v.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}>
                            {v.label}
                            {n !== null && n > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-bold", v.key === "overdue" ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700")}>{n}</span>}
                        </button>
                    );
                })}
            </div>
            {view === "today" && counts.overdue > 0 && (
                <button onClick={() => update({ view: "overdue" })} className="flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4" />{counts.overdue} overdue follow-up{counts.overdue === 1 ? "" : "s"} need attention first.
                </button>
            )}
            {rows.length === 0 ? (
                <EmptyState title={view === "overdue" ? "Nothing overdue" : view === "today" ? "No more follow-ups today" : view === "upcoming" ? "Nothing scheduled ahead" : "Nothing closed recently"}>
                    {view === "today" && "Open a lead and use Follow-up to schedule the next call."}
                </EmptyState>
            ) : (
                <ul className="space-y-2">
                    {rows.map((r) => {
                        const overdue = r.status === "PENDING" && followUpBucket(new Date(r.dueAt)) === "OVERDUE";
                        const lite = { id: r.id, dueAt: r.dueAt, notes: r.notes, lead: { name: r.lead.name } };
                        return (
                            <li key={r.id} className={cn("flex flex-col gap-2 rounded-xl border bg-white p-3 shadow-sm sm:flex-row sm:items-center", overdue && "border-red-200 bg-red-50/40")}>
                                <div className="w-36 shrink-0">
                                    <p className={cn("text-sm font-semibold", overdue ? "text-red-700" : "text-slate-800")}>{fmtDateTime(r.dueAt)}</p>
                                    {overdue && <p className="text-[10px] font-bold uppercase text-red-600">Overdue</p>}
                                    {r.status !== "PENDING" && <p className="text-[11px] text-slate-500">{r.status.charAt(0) + r.status.slice(1).toLowerCase()} {fmtDateTime(r.completedAt)}</p>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link href={leadHref(r.lead.id)} className="font-semibold text-slate-800 hover:text-blue-700">{r.lead.name}</Link>
                                        <span className="font-mono text-[11px] text-slate-400">{leadCode(r.lead.leadNo)}</span>
                                        <StatusBadge status={r.lead.status} /><PriorityBadge priority={r.lead.type} />
                                    </div>
                                    {r.notes && <p className="text-xs text-slate-600">{r.notes}</p>}
                                    {r.outcome && <p className="text-xs text-slate-500">→ {r.outcome}</p>}
                                    {showAssignee && <p className="text-[11px] text-slate-400">{r.assignedTo?.name ?? "Unassigned"}</p>}
                                </div>
                                {r.status === "PENDING" && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <a href={`tel:${r.lead.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 rounded-md border bg-white px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"><Phone className="h-3.5 w-3.5" />Call</a>
                                        <button onClick={() => setDialog({ kind: "done", fu: lite })} className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Done</button>
                                        <button onClick={() => setDialog({ kind: "move", fu: lite })} className="rounded-md border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Reschedule</button>
                                        <button onClick={() => setDialog({ kind: "cancel", fu: lite })} className="px-1 text-xs text-slate-400 hover:text-red-600">Cancel</button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {dialog?.kind === "done" && <CompleteFollowUpDialog fu={dialog.fu} onClose={() => setDialog(null)} />}
            {dialog?.kind === "move" && <RescheduleFollowUpDialog fu={dialog.fu} onClose={() => setDialog(null)} />}
            {dialog?.kind === "cancel" && <CancelFollowUpDialog fu={dialog.fu} onClose={() => setDialog(null)} />}
        </div>
    );
}
