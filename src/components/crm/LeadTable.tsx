"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Upload, Download, Search, Trash2, UserPlus, Loader2, Phone, SlidersHorizontal, X } from "lucide-react";
import { assignLeads, deleteLeads, exportLeads } from "@/lib/actions/crm-actions";
import { LEAD_STATUSES, PRIORITIES, PRODUCTS, STATUS_INFO, followUpBucket, leadCode } from "@/lib/sales-crm";
import { formatCurrency, cn } from "@/lib/utils";
import { EmptyState, Pager, PriorityBadge, SelectFilter, StatusBadge, fmtDate, fmtDateTime, leadHref, useQueryUpdate } from "./ui";
import { LeadFormDialog } from "./LeadFormDialog";
import { ImportDialog } from "./ImportDialog";

export interface LeadRow {
    id: string; leadNo: number; name: string; phone: string; city: string; productInterest: string[]; expectedOrderValue: number; type: string; status: string;
    lastContacted: Date | null; nextContactDate: Date | null; createdAt: Date; assignedTo: { id: string; name: string } | null; source: string | null;
}

export function LeadTable({ rows, total, page, pages, team, sources, canManage }: {
    rows: LeadRow[]; total: number; page: number; pages: number; team: Array<{ value: string; label: string }>; sources: string[]; canManage: boolean;
}) {
    const router = useRouter();
    const { params, update, pending: navPending } = useQueryUpdate();
    const [q, setQ] = useState(params.get("q") ?? "");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [dialog, setDialog] = useState<"add" | "import" | null>(null);
    const [more, setMore] = useState(!!(params.get("from") || params.get("to") || params.get("source") || params.get("product")));
    const [pending, start] = useTransition();
    const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

    // search as you type
    useEffect(() => {
        if ((params.get("q") ?? "") === q) return;
        const t = setTimeout(() => update({ q: q.trim() || null }), 350);
        return () => clearTimeout(t);
    }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => setSelected(new Set()), [rows]);

    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

    const bulkAssign = (userId: string) => start(async () => {
        const res = await assignLeads([...selected], userId === "none" ? null : userId);
        setMsg(res.ok ? { text: `${res.updated} lead${res.updated === 1 ? "" : "s"} assigned.` } : { text: res.error, error: true });
        router.refresh();
    });
    const bulkDelete = () => {
        if (!confirm(`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"} with their calls, follow-ups and history? This cannot be undone.`)) return;
        start(async () => {
            const res = await deleteLeads([...selected]);
            setMsg(res.ok ? { text: `${res.deleted} deleted.` } : { text: res.error, error: true });
            router.refresh();
        });
    };
    const doExport = (format: "xlsx" | "csv") => start(async () => {
        const filters = Object.fromEntries(params.entries());
        const res = await exportLeads(filters);
        if (!res.ok) return setMsg({ text: res.error, error: true });
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(res.rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.${format}`, { bookType: format });
    });

    const now = new Date();

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, city, email or L-1024"
                        className="h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDialog("add")} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add lead</button>
                    {canManage && <>
                        <button onClick={() => setDialog("import")} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4" />Import</button>
                        <div className="inline-flex rounded-md border bg-white">
                            <button disabled={pending} onClick={() => doExport("xlsx")} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Excel</button>
                            <button disabled={pending} onClick={() => doExport("csv")} className="border-l px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">CSV</button>
                        </div>
                    </>}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <SelectFilter name="status" label="Status" options={[{ value: "open", label: "Open (not converted / lost)" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_INFO[s].label }))]} />
                <SelectFilter name="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
                {canManage && <SelectFilter name="assignee" label="Assigned" options={[{ value: "none", label: "Unassigned" }, ...team]} />}
                <SelectFilter name="followUp" label="Follow-up" options={[{ value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "none", label: "None scheduled" }]} />
                <SelectFilter name="sort" label="Sort" allLabel="Newest" options={[{ value: "followup", label: "Next follow-up" }, { value: "updated", label: "Recently updated" }, { value: "budget", label: "Budget" }, { value: "name", label: "Name" }]} />
                <button onClick={() => setMore(!more)} className="inline-flex h-9 items-center gap-1 rounded-md border bg-white px-2.5 text-sm text-slate-600 hover:bg-slate-50"><SlidersHorizontal className="h-4 w-4" />More</button>
                {[...params.keys()].some((k) => k !== "page") && <button onClick={() => { setQ(""); update(Object.fromEntries([...params.keys()].map((k) => [k, null]))); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><X className="h-3.5 w-3.5" />Clear</button>}
                {(navPending || pending) && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            {more && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2">
                    <SelectFilter name="source" label="Source" options={sources.map((s) => ({ value: s, label: s }))} />
                    <SelectFilter name="product" label="Product" options={PRODUCTS.map((p) => ({ value: p, label: p }))} />
                    <span className="text-xs text-slate-500">Created</span>
                    <input type="date" aria-label="Created from" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} className="h-9 rounded-md border px-2 text-sm" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="date" aria-label="Created to" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} className="h-9 rounded-md border px-2 text-sm" />
                </div>
            )}

            {msg && <p className={cn("text-sm", msg.error ? "text-red-600" : "text-green-700")}>{msg.text}</p>}

            {canManage && selected.size > 0 && (
                <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm shadow-sm">
                    <b className="text-blue-800">{selected.size} selected</b>
                    <UserPlus className="ml-2 h-4 w-4 text-blue-700" />
                    <select disabled={pending} defaultValue="" onChange={(e) => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ""; }} className="h-8 rounded-md border bg-white px-2 text-sm">
                        <option value="">Assign to…</option>
                        <option value="none">Unassign</option>
                        {team.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button disabled={pending} onClick={bulkDelete} className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500">Clear</button>
                </div>
            )}

            {rows.length === 0 ? (
                <EmptyState title={params.toString() ? "No leads match these filters" : "No leads yet"}>
                    {params.toString() ? "Try clearing a filter." : "Add a lead, or import your existing list from Excel."}
                </EmptyState>
            ) : (
                <>
                    {/* desktop table */}
                    <div className="hidden overflow-x-auto rounded-xl border bg-white shadow-sm md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                                <tr>
                                    {canManage && <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
                                    <th className="px-3 py-2">Lead</th>
                                    <th className="px-3 py-2">Customer</th>
                                    <th className="px-3 py-2">Interest</th>
                                    <th className="px-3 py-2 text-right">Budget</th>
                                    <th className="px-3 py-2">Assigned</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Last contact</th>
                                    <th className="px-3 py-2">Next follow-up</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const bucket = r.nextContactDate ? followUpBucket(new Date(r.nextContactDate), now) : null;
                                    return (
                                        <tr key={r.id} className={cn("border-t hover:bg-slate-50/70", selected.has(r.id) && "bg-blue-50/40")}>
                                            {canManage && <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                                            <td className="px-3 py-2 align-top">
                                                <Link href={leadHref(r.id)} className="font-mono text-xs font-semibold text-blue-700 hover:underline">{leadCode(r.leadNo)}</Link>
                                                <div className="mt-0.5"><PriorityBadge priority={r.type} /></div>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <Link href={leadHref(r.id)} className="font-semibold text-slate-800 hover:text-blue-700">{r.name}</Link>
                                                <div className="flex items-center gap-2 text-xs text-slate-500"><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-blue-600"><Phone className="h-3 w-3" />{r.phone}</a>{r.city && <span>· {r.city}</span>}</div>
                                            </td>
                                            <td className="px-3 py-2 align-top text-xs text-slate-600">{r.productInterest.join(", ") || "–"}{r.source && <div className="text-slate-400">{r.source}</div>}</td>
                                            <td className="px-3 py-2 text-right align-top tabular-nums text-slate-700">{r.expectedOrderValue ? `₹${formatCurrency(r.expectedOrderValue)}` : "–"}</td>
                                            <td className="px-3 py-2 align-top text-xs text-slate-600">{r.assignedTo?.name ?? <span className="text-amber-700">Unassigned</span>}</td>
                                            <td className="px-3 py-2 align-top"><StatusBadge status={r.status} /></td>
                                            <td className="px-3 py-2 align-top text-xs text-slate-500">{r.lastContacted ? fmtDate(r.lastContacted) : "Never"}</td>
                                            <td className={cn("px-3 py-2 align-top text-xs", bucket === "OVERDUE" ? "font-semibold text-red-600" : bucket === "TODAY" ? "font-semibold text-amber-700" : "text-slate-500")}>
                                                {r.nextContactDate ? fmtDateTime(r.nextContactDate) : "–"}{bucket === "OVERDUE" && <div className="text-[10px] uppercase">Overdue</div>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* mobile cards */}
                    <ul className="space-y-2 md:hidden">
                        {rows.map((r) => {
                            const bucket = r.nextContactDate ? followUpBucket(new Date(r.nextContactDate), now) : null;
                            return (
                                <li key={r.id} className="rounded-xl border bg-white p-3 shadow-sm">
                                    <div className="flex items-start gap-2">
                                        {canManage && <input type="checkbox" className="mt-1" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
                                        <Link href={leadHref(r.id)} className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate font-semibold text-slate-800">{r.name}</span>
                                                <StatusBadge status={r.status} />
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-500">{leadCode(r.leadNo)} · {r.phone}{r.city && ` · ${r.city}`}</div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                <PriorityBadge priority={r.type} />
                                                <span className="text-slate-500">{r.assignedTo?.name ?? "Unassigned"}</span>
                                                {r.nextContactDate && <span className={bucket === "OVERDUE" ? "font-semibold text-red-600" : "text-slate-500"}>Follow-up {fmtDateTime(r.nextContactDate)}</span>}
                                            </div>
                                        </Link>
                                        <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${r.name}`} className="rounded-full bg-green-50 p-2 text-green-700"><Phone className="h-4 w-4" /></a>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            <Pager page={page} pages={pages} total={total} />

            {dialog === "add" && <LeadFormDialog team={team} canAssign={canManage} onClose={() => setDialog(null)} />}
            {dialog === "import" && <ImportDialog team={team} onClose={() => setDialog(null)} />}
        </div>
    );
}
