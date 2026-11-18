"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pencil, Trash2, Plus, X, Check, Wallet, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { lastPrice, lineTotal, summarizeVendor, vendorNames, type WorkRow } from "@/lib/vendor-ledger";
import { deleteVendorWork, saveVendorWork, type VendorLedgerData } from "@/lib/actions/vendor-ledger-actions";

const rs = (n: number) => `₹${formatCurrency(n)}`;
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "2-digit" });

interface Draft { nos: string; type: string; date: string; price: string; notes: string }

export function VendorLedger({ data, today }: { data: VendorLedgerData; today: string }) {
    const router = useRouter();
    const vendors = useMemo(() => vendorNames(data.work.map((w) => w.vendor), data.vendors), [data]);
    const [vendor, setVendor] = useState(vendors[0] ?? "");
    const [newVendor, setNewVendor] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const blank = (): Draft => ({ nos: "", type: "", date: today, price: "", notes: "" });
    const [draft, setDraft] = useState<Draft>(blank);
    const [edit, setEdit] = useState<Draft>(blank);

    const summary = useMemo(() => (vendor ? summarizeVendor(vendor, data.work, data.payouts) : null), [vendor, data]);
    const typeOptions = useMemo(() => vendorNames(data.work.filter((w) => !vendor || w.vendor.trim().toLowerCase() === vendor.toLowerCase()).map((w) => w.type), data.work.map((w) => w.type)), [data, vendor]);

    function setType(d: Draft, type: string): Draft {
        const p = vendor ? lastPrice(data.work, vendor, type) : null;
        return { ...d, type, price: p !== null && (d.price === "" || d.type !== type) ? String(p) : d.price };
    }

    function save(d: Draft, id?: string) {
        setError(null);
        startTransition(async () => {
            const res = await saveVendorWork({ vendor, nos: parseFloat(d.nos), type: d.type, date: d.date, price: parseFloat(d.price), notes: d.notes }, id);
            if (!res.ok) return setError(res.error);
            if (id) setEditingId(null);
            else setDraft({ ...blank(), type: d.type, price: d.price, date: d.date }); // keep type/price/date for the next line
            router.refresh();
        });
    }

    function remove(r: WorkRow) {
        if (!confirm(`Delete ${r.nos} x ${r.type} on ${shortDay(r.date)}?`)) return;
        startTransition(async () => {
            const res = await deleteVendorWork(r.id);
            if (!res.ok) return setError(res.error);
            router.refresh();
        });
    }

    function addVendor() {
        const name = newVendor.trim();
        if (!name) return;
        setVendor(vendors.find((v) => v.toLowerCase() === name.toLowerCase()) ?? name);
        setNewVendor("");
    }

    const allVendors = vendor && !vendors.some((v) => v.toLowerCase() === vendor.toLowerCase()) ? [...vendors, vendor] : vendors;

    return (
        <div className="space-y-4">
            <style>{`@media print { body * { visibility: hidden; } #vendor-bill, #vendor-bill * { visibility: visible; } #vendor-bill { position: absolute; inset: 0; } .no-print { display: none !important; } }`}</style>

            {/* Vendor picker */}
            <div className="flex flex-wrap items-center gap-2 no-print">
                {allVendors.map((v) => (
                    <button
                        key={v}
                        onClick={() => { setVendor(v); setEditingId(null); setError(null); }}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${v === vendor ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                        {v}
                    </button>
                ))}
                <div className="flex items-center gap-1">
                    <Input value={newVendor} onChange={(e) => setNewVendor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVendor()} placeholder="New vendor" className="h-8 w-36 text-sm" />
                    <button onClick={addVendor} className="h-8 px-2 rounded-md border text-sm text-slate-600 hover:bg-slate-50" title="Add vendor"><Plus className="h-4 w-4" /></button>
                </div>
            </div>

            {!vendor || !summary ? (
                <p className="text-sm text-slate-500 p-8 text-center border border-dashed rounded-lg">Add a vendor to start their ledger.</p>
            ) : (
                <>
                    {/* Totals */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
                        <Stat label="Pieces" value={formatCurrency(summary.pieces)} />
                        <Stat label="Grand Total" value={rs(summary.workTotal)} />
                        <Stat label="Paid" value={rs(summary.paid)} tone="green" />
                        <Stat label={summary.due < 0 ? "Advance" : "Balance Due"} value={rs(Math.abs(summary.due))} tone={summary.due > 0 ? "red" : "green"} />
                    </div>

                    <Card id="vendor-bill" className="shadow-sm overflow-hidden">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">{vendor} — Work Ledger</CardTitle>
                            <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1 text-sm text-slate-600 border rounded-md px-2 py-1 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                    <tr>
                                        <th className="text-right px-3 py-2 w-16">Nos</th>
                                        <th className="text-left px-3 py-2">Type</th>
                                        <th className="text-left px-3 py-2 w-28">Date</th>
                                        <th className="text-right px-3 py-2 w-24">Price</th>
                                        <th className="text-right px-3 py-2 w-28">Total</th>
                                        <th className="w-20 no-print" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.rows.map((r) => editingId === r.id ? (
                                        <DraftRow key={r.id} d={edit} types={typeOptions} onChange={setEdit} onType={(t) => setEdit(setType(edit, t))} pending={isPending}
                                            onSave={() => save(edit, r.id)} onCancel={() => setEditingId(null)} />
                                    ) : (
                                        <tr key={r.id} className="border-t hover:bg-slate-50/60">
                                            <td className="text-right px-3 py-2 font-medium">{r.nos}</td>
                                            <td className="px-3 py-2">{r.type}{r.notes && <span className="block text-[11px] text-slate-400">{r.notes}</span>}</td>
                                            <td className="px-3 py-2 text-slate-600">{shortDay(r.date)}</td>
                                            <td className="text-right px-3 py-2">{formatCurrency(r.price)}</td>
                                            <td className="text-right px-3 py-2 font-semibold">{formatCurrency(lineTotal(r))}</td>
                                            <td className="px-2 py-2 no-print">
                                                <div className="flex justify-end gap-1">
                                                    <button title="Edit" className="p-1 text-slate-400 hover:text-blue-600" onClick={() => { setEditingId(r.id); setEdit({ nos: String(r.nos), type: r.type, date: r.date, price: String(r.price), notes: r.notes ?? "" }); }}><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button title="Delete" className="p-1 text-slate-400 hover:text-red-600" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    <DraftRow d={draft} types={typeOptions} onChange={setDraft} onType={(t) => setDraft(setType(draft, t))} pending={isPending} onSave={() => save(draft)} isNew />
                                </tbody>
                                <tfoot className="border-t-2 bg-slate-50 font-bold">
                                    <tr>
                                        <td className="text-right px-3 py-2">{formatCurrency(summary.pieces)}</td>
                                        <td className="px-3 py-2" colSpan={3}>Grand Total</td>
                                        <td className="text-right px-3 py-2">{formatCurrency(summary.workTotal)}</td>
                                        <td className="no-print" />
                                    </tr>
                                    {summary.paid > 0 && (
                                        <>
                                            <tr className="font-medium text-green-700"><td /><td className="px-3 py-1" colSpan={3}>Paid</td><td className="text-right px-3 py-1">− {formatCurrency(summary.paid)}</td><td className="no-print" /></tr>
                                            <tr className={summary.due > 0 ? "text-red-700" : "text-green-700"}><td /><td className="px-3 py-2" colSpan={3}>{summary.due < 0 ? "Advance" : "Balance Due"}</td><td className="text-right px-3 py-2">{formatCurrency(Math.abs(summary.due))}</td><td className="no-print" /></tr>
                                        </>
                                    )}
                                </tfoot>
                            </table>
                            {error && <p className="text-sm text-red-600 px-3 py-2 no-print">{error}</p>}
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2 no-print">
                        {summary.byType.length > 0 && (
                            <Card className="shadow-sm">
                                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-slate-500">By type</CardTitle></CardHeader>
                                <CardContent className="space-y-1.5 text-sm">
                                    {summary.byType.map((t) => (
                                        <div key={t.type} className="flex justify-between"><span>{t.type} <span className="text-slate-400">x {t.nos}</span></span><span className="font-semibold">{rs(t.total)}</span></div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-slate-500 flex items-center gap-2"><Wallet className="h-4 w-4" /> Payments</CardTitle></CardHeader>
                            <CardContent className="space-y-1.5 text-sm">
                                {summary.payments.length === 0 ? (
                                    <p className="text-slate-500 text-xs">No payments yet. Add an expense in <b>Transactions</b> with category <b>Vendor&apos;s payout</b> and &quot;{vendor}&quot; in the description — it shows here automatically.</p>
                                ) : summary.payments.map((p) => (
                                    <div key={p.id} className="flex justify-between gap-2"><span className="text-slate-600 truncate">{shortDay(p.date)} · {p.description}</span><span className="font-semibold text-green-700 shrink-0">{rs(p.amount)}</span></div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
    const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : "text-slate-900";
    return (
        <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
    );
}

function DraftRow({ d, types, onChange, onType, onSave, onCancel, pending, isNew }: {
    d: Draft; types: string[]; onChange: (d: Draft) => void; onType: (t: string) => void; onSave: () => void; onCancel?: () => void; pending: boolean; isNew?: boolean;
}) {
    const total = (parseFloat(d.nos) || 0) * (parseFloat(d.price) || 0);
    const enter = (e: React.KeyboardEvent) => e.key === "Enter" && onSave();
    const listId = isNew ? "vendor-types-new" : "vendor-types-edit";
    return (
        <tr className={`border-t no-print ${isNew ? "bg-blue-50/40" : "bg-amber-50/50"}`}>
            <td className="px-1 py-1.5"><Input type="number" min={0} value={d.nos} onChange={(e) => onChange({ ...d, nos: e.target.value })} onKeyDown={enter} placeholder="Nos" className="h-8 text-right text-sm" /></td>
            <td className="px-1 py-1.5">
                <Input list={listId} value={d.type} onChange={(e) => onType(e.target.value)} onKeyDown={enter} placeholder="Type (e.g. pinch pleat)" className="h-8 text-sm" />
                <datalist id={listId}>{types.map((t) => <option key={t} value={t} />)}</datalist>
            </td>
            <td className="px-1 py-1.5"><Input type="date" value={d.date} onChange={(e) => onChange({ ...d, date: e.target.value })} className="h-8 text-sm" /></td>
            <td className="px-1 py-1.5"><Input type="number" min={0} value={d.price} onChange={(e) => onChange({ ...d, price: e.target.value })} onKeyDown={enter} placeholder="Price" className="h-8 text-right text-sm" /></td>
            <td className="text-right px-3 py-1.5 text-slate-500">{total ? formatCurrency(total) : "–"}</td>
            <td className="px-2 py-1.5">
                <div className="flex justify-end gap-1">
                    <button onClick={onSave} disabled={pending} title={isNew ? "Add" : "Save"} className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                        {isNew ? <Plus className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    {onCancel && <button onClick={onCancel} title="Cancel" className="p-1.5 rounded border text-slate-500 hover:bg-slate-50"><X className="h-3.5 w-3.5" /></button>}
                </div>
            </td>
        </tr>
    );
}
