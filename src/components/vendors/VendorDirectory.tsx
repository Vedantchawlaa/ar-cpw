"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pencil, Trash2, Plus, Phone, MapPin, NotebookPen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, initialPeriod, periodLabel, periodOf } from "@/components/vendors/PeriodFilter";
import { KIND_INFO, VENDOR_KINDS, isAllTime, summarizeVendor, vendorStatement, type VendorInfo, type VendorKind } from "@/lib/vendor-ledger";
import { deleteVendor, saveVendor, type VendorLedgerData } from "@/lib/actions/vendor-ledger-actions";

interface Form { name: string; kind: VendorKind; phone: string; address: string; notes: string }
const empty = (kind: VendorKind = "FABRIC"): Form => ({ name: "", kind, phone: "", address: "", notes: "" });

export function VendorDirectory({ data, today }: { data: VendorLedgerData; today: string }) {
    const router = useRouter();
    const [form, setForm] = useState<Form | null>(null);
    const [editing, setEditing] = useState<VendorInfo | null>(null); // the vendor being edited; null = adding
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const due = useMemo(() => new Map(data.vendors.map((v) => [v.name, summarizeVendor(v.name, data.work, data.payouts, data.bills)])), [data]);

    // Bills and payments inside the chosen period
    const [periodState, setPeriodState] = useState(() => initialPeriod(today));
    const period = useMemo(() => periodOf(periodState, today), [periodState, today]);
    const filtered = !isAllTime(period);
    const label = periodLabel(periodState, today);
    const inRange = useMemo(() => new Map(filtered ? data.vendors.map((v) => [v.name, vendorStatement(v.name, data.work, data.payouts, data.bills, period).period]) : []), [data, filtered, period]);
    const rangeTotal = (names: string[]) => names.reduce((t, n) => {
        const s = inRange.get(n);
        return { bills: r2(t.bills + (s?.workTotal ?? 0)), paid: r2(t.paid + (s?.paid ?? 0)) };
    }, { bills: 0, paid: 0 });

    function open(v?: VendorInfo, kind?: VendorKind) {
        setError(null);
        setEditing(v ?? null);
        setForm(v ? { name: v.name, kind: v.kind, phone: v.phone ?? "", address: v.address ?? "", notes: v.notes ?? "" } : empty(kind));
    }

    function save() {
        if (!form) return;
        setError(null);
        startTransition(async () => {
            const res = await saveVendor(form, editing?.id ?? undefined);
            if (!res.ok) return setError(res.error);
            setForm(null);
            router.refresh();
        });
    }

    function remove(v: VendorInfo) {
        if (!v.id || !confirm(`Remove ${v.name} from the directory? Their ledger rows are kept.`)) return;
        startTransition(async () => {
            const res = await deleteVendor(v.id!);
            if (!res.ok) return setError(res.error);
            router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            {form ? (
                <Card className="border-2 border-blue-300 bg-blue-50/40 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-base">{editing ? `Edit ${editing.name}` : "Add vendor / source"}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {VENDOR_KINDS.map((k) => (
                                <button key={k} onClick={() => setForm({ ...form, kind: k })}
                                    className={`rounded-full px-3 py-1.5 text-sm font-medium border ${form.kind === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
                                    {KIND_INFO[k].label}
                                </button>
                            ))}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name *" />
                            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" inputMode="tel" />
                            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address / market" />
                            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (catalogues, brands, rates…)" />
                        </div>
                        {editing && editing.id === null && <p className="text-xs text-slate-500">This name is used in ledger rows but not saved in the directory yet; saving adds it.</p>}
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => setForm(null)} disabled={isPending} className="flex-1 sm:flex-none px-4 py-2 rounded-md border text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={save} disabled={isPending} className="flex-1 sm:flex-none px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{isPending ? "Saving..." : "Save"}</button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <button onClick={() => open()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                    <Plus className="h-4 w-4" /> Add vendor / source
                </button>
            )}
            {!form && error && <p className="text-sm text-red-600">{error}</p>}

            <PeriodFilter value={periodState} onChange={setPeriodState} />

            {filtered && (() => {
                const t = rangeTotal(data.vendors.map((v) => v.name));
                return (
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 shadow-sm">
                        <span className="text-sm font-semibold text-slate-600">{label}, all vendors</span>
                        <span className="text-sm text-slate-600">Bills <b className="text-lg text-slate-900">₹{formatCurrency(t.bills)}</b></span>
                        <span className="text-sm text-slate-600">Paid <b className="text-lg text-green-700">₹{formatCurrency(t.paid)}</b></span>
                    </div>
                );
            })()}

            {(() => {
                const all = sumDue(data.vendors.map((v) => due.get(v.name)?.due ?? 0));
                return all.due > 0 || all.advance > 0 ? (
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border bg-white px-4 py-3 shadow-sm">
                        <span className="text-sm font-semibold text-slate-600">Total balance due, all vendors</span>
                        <span className="text-lg font-bold text-red-600">₹{formatCurrency(all.due)}</span>
                        {all.advance > 0 && <span className="text-xs font-semibold text-green-600">Advance given ₹{formatCurrency(all.advance)}</span>}
                    </div>
                ) : null;
            })()}

            {VENDOR_KINDS.map((kind) => {
                const group = data.vendors.filter((v) => v.kind === kind);
                const groupDue = sumDue(group.map((v) => due.get(v.name)?.due ?? 0));
                return (
                    <Card key={kind} className="shadow-sm overflow-hidden">
                        <CardHeader className="pb-2 bg-slate-50 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-sm uppercase tracking-wider text-slate-600">{KIND_INFO[kind].label} <span className="text-slate-400">({group.length})</span></CardTitle>
                            <div className="flex items-center gap-4">
                                {filtered && (() => {
                                    const t = rangeTotal(group.map((v) => v.name));
                                    return (t.bills > 0 || t.paid > 0) && (
                                        <span className="text-right text-xs leading-tight text-slate-500">
                                            <span className="block">Bills ₹{formatCurrency(t.bills)}</span>
                                            <span className="block text-green-700">Paid ₹{formatCurrency(t.paid)}</span>
                                        </span>
                                    );
                                })()}
                                {(groupDue.due > 0 || groupDue.advance > 0) && (
                                    <span className="text-right text-xs leading-tight">
                                        <span className={`block font-bold ${groupDue.due > 0 ? "text-red-600" : "text-green-600"}`}>Balance due ₹{formatCurrency(groupDue.due)}</span>
                                        {groupDue.advance > 0 && <span className="block text-[11px] font-medium text-green-600">Advance ₹{formatCurrency(groupDue.advance)}</span>}
                                    </span>
                                )}
                                <button onClick={() => open(undefined, kind)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {group.length === 0 ? (
                                <p className="text-xs text-slate-400 px-4 py-3">None yet.</p>
                            ) : group.map((v) => {
                                const s = due.get(v.name);
                                const ps = inRange.get(v.name);
                                return (
                                    <div key={v.name} className="flex items-start justify-between gap-3 px-4 py-3 border-t first:border-t-0">
                                        <div className="min-w-0 space-y-0.5">
                                            <p className="font-semibold text-slate-800">{v.name}{v.id === null && <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">not saved</span>}</p>
                                            {v.phone && <a href={`tel:${v.phone}`} className="text-xs text-blue-600 flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</a>}
                                            {v.address && <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{v.address}</p>}
                                            {v.notes && <p className="text-xs text-slate-500">{v.notes}</p>}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {ps && (ps.workTotal > 0 || ps.paid > 0) && (
                                                <div className="text-right text-xs border-r pr-3" title={label}>
                                                    <p className="text-slate-500">Bills ₹{formatCurrency(ps.workTotal)}</p>
                                                    <p className="text-green-700">Paid ₹{formatCurrency(ps.paid)}</p>
                                                </div>
                                            )}
                                            {s && (s.workTotal > 0 || s.paid > 0) && (
                                                <div className="text-right text-xs">
                                                    <p className="text-slate-500">Total ₹{formatCurrency(s.workTotal)}</p>
                                                    <p className={`font-semibold ${s.due > 0 ? "text-red-600" : "text-green-600"}`}>{s.due < 0 ? "Advance" : "Due"} ₹{formatCurrency(Math.abs(s.due))}</p>
                                                </div>
                                            )}
                                            <Link href={`/vendors?tab=ledger&vendor=${encodeURIComponent(v.name)}`} title="Open ledger" className="p-1.5 text-slate-400 hover:text-blue-600"><NotebookPen className="h-4 w-4" /></Link>
                                            <button title={v.id ? "Edit" : "Save to directory"} onClick={() => open(v)} className="p-1.5 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                                            {v.id && <button title="Remove" onClick={() => remove(v)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Dues of several vendors: what is owed, and advances kept apart (one vendor's advance doesn't cancel another's due). */
function sumDue(dues: number[]) {
    const r = (n: number) => Math.round(n * 100) / 100;
    return { due: r(dues.filter((d) => d > 0).reduce((s, d) => s + d, 0)), advance: r(-dues.filter((d) => d < 0).reduce((s, d) => s + d, 0)) };
}
