"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pencil, Trash2, Plus, X, Check, Wallet, Printer, ReceiptText, Paperclip, Download, CopyX, ChevronRight } from "lucide-react";
import { BillDialog } from "@/components/vendors/BillDialog";
import { formatCurrency } from "@/lib/utils";
import { KIND_INFO, VENDOR_KINDS, duplicateBills, lastGst, lastPrice, ledgerEntries, lineGst, lineTotal, looseLineTotal, sameVendor, summarizeVendor, vendorNames, type BillInfo, type WorkRow } from "@/lib/vendor-ledger";
import { deleteVendorBill, deleteVendorWork, saveVendorWork, type VendorLedgerData } from "@/lib/actions/vendor-ledger-actions";

const rs = (n: number) => `₹${formatCurrency(n)}`;
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "2-digit" });

interface Draft { nos: string; type: string; date: string; price: string; notes: string; gstOn: boolean; gst: string; ref: string }

const GST_RATES = [5, 12, 18, 28];

export function VendorLedger({ data, today, initialVendor }: { data: VendorLedgerData; today: string; initialVendor?: string }) {
    const router = useRouter();
    const vendors = data.vendors;
    const [vendor, setVendor] = useState(vendors.find((v) => initialVendor && sameVendor(v.name, initialVendor))?.name ?? vendors[0]?.name ?? "");
    const info = KIND_INFO[vendors.find((v) => sameVendor(v.name, vendor))?.kind ?? "OTHER"];
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openBills, setOpenBills] = useState<Set<string>>(() => new Set()); // bills shown with their items
    const toggleBill = (id: string) => setOpenBills((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const [isPending, startTransition] = useTransition();
    const [billDialog, setBillDialog] = useState<null | { bill?: BillInfo; lines?: WorkRow[] }>(null);

    // A new line starts with GST on when the vendor's latest line had GST, at that %.
    const blank = (forVendor = vendor): Draft => {
        const g = forVendor ? lastGst(data.work, forVendor) : null;
        return { nos: "", type: "", date: today, price: "", notes: "", gstOn: g !== null, gst: g !== null ? String(g) : "", ref: "" };
    };
    const [draft, setDraft] = useState<Draft>(() => blank());
    const [edit, setEdit] = useState<Draft>(() => blank());

    const summary = useMemo(() => (vendor ? summarizeVendor(vendor, data.work, data.payouts, data.bills) : null), [vendor, data]);
    const typeOptions = useMemo(() => {
        // this vendor's items first, then items of other vendors of the same type
        const kindOf = (name: string) => vendors.find((v) => sameVendor(v.name, name))?.kind ?? "OTHER";
        const kind = kindOf(vendor);
        return vendorNames(data.work.filter((w) => sameVendor(w.vendor, vendor)).map((w) => w.type), data.work.filter((w) => kindOf(w.vendor) === kind).map((w) => w.type));
    }, [data, vendor, vendors]);

    function setType(d: Draft, type: string): Draft {
        const p = vendor ? lastPrice(data.work, vendor, type) : null;
        return { ...d, type, price: p !== null && (d.price === "" || d.type !== type) ? String(p) : d.price };
    }

    function save(d: Draft, id?: string) {
        setError(null);
        const gstPercent = d.gstOn ? parseFloat(d.gst) : null;
        if (d.gstOn && !(gstPercent! > 0)) return setError("Enter the GST %.");
        startTransition(async () => {
            const res = await saveVendorWork({ vendor, nos: parseFloat(d.nos), type: d.type, date: d.date, price: parseFloat(d.price), notes: d.notes, gstPercent, refNo: d.ref }, id);
            if (!res.ok) return setError(res.error);
            if (id) setEditingId(null);
            else setDraft({ ...blank(), type: d.type, price: d.price, date: d.date, gstOn: d.gstOn, gst: d.gst, ref: d.ref }); // same bill: keep these for the next line
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


    function removeBill(bill: BillInfo, count: number) {
        if (!confirm(`Delete bill ${bill.refNo || "(no number)"} with its ${count} item(s)${bill.attachmentId ? " and the uploaded file" : ""}?`)) return;
        startTransition(async () => {
            const res = await deleteVendorBill(bill.id);
            if (!res.ok) return setError(res.error);
            router.refresh();
        });
    }

    const entries = summary ? ledgerEntries(summary.rows, data.bills) : [];
    const dupes = duplicateBills(data.bills);

    // a closed bill's items stay hidden on screen but are always printed
    const renderLine = (r: WorkRow, inBill: boolean, hidden = false) => (
        <tr key={r.id} className={`border-t hover:bg-slate-50/60 ${inBill ? "text-slate-700" : ""} ${hidden ? "hidden print:table-row" : ""}`}>
                                            <td className="px-3 py-2 text-slate-600">{inBill ? <span className="pl-2 text-slate-300">└</span> : r.refNo || <span className="text-slate-300">–</span>}</td>
                                            <td className="text-right px-3 py-2 font-medium">{r.nos}</td>
                                            <td className="px-3 py-2">{r.type}{r.notes && <span className="block text-[11px] text-slate-400">{r.notes}</span>}</td>
                                            <td className="px-3 py-2 text-slate-600">{shortDay(r.date)}</td>
                                            <td className="text-right px-3 py-2">{formatCurrency(r.price)}</td>
                                            <td className="text-right px-3 py-2 text-slate-600">
                                                {r.gstPercent ? <>{formatCurrency(lineGst(r))} <span className="text-[11px] text-slate-400">({r.gstPercent}%)</span></> : <span className="text-slate-300">–</span>}
                                            </td>
                                            <td className="text-right px-3 py-2 font-semibold">{formatCurrency(inBill ? lineTotal(r) : looseLineTotal(r))}</td>
                                            <td className="px-2 py-2 no-print">
                                                {!inBill && <div className="flex justify-end gap-1">
                                                    <button title="Edit" className="p-1 text-slate-400 hover:text-blue-600" onClick={() => { setEditingId(r.id); setEdit({ nos: String(r.nos), type: r.type, date: r.date, price: String(r.price), notes: r.notes ?? "", gstOn: !!r.gstPercent, gst: r.gstPercent ? String(r.gstPercent) : "", ref: r.refNo ?? "" }); }}><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button title="Delete" className="p-1 text-slate-400 hover:text-red-600" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div>}
                                            </td>
                                        </tr>
    );

    return (
        <div className="space-y-4">
            <style>{`@media print { body * { visibility: hidden; } #vendor-bill, #vendor-bill * { visibility: visible; } #vendor-bill { position: absolute; inset: 0; } .no-print { display: none !important; } }`}</style>

            {/* Vendor picker */}
            <div className="space-y-2 no-print">
                {VENDOR_KINDS.map((kind) => {
                    const group = vendors.filter((v) => v.kind === kind);
                    if (group.length === 0) return null;
                    return (
                        <div key={kind} className="flex flex-wrap items-center gap-2">
                            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">{KIND_INFO[kind].label}</span>
                            {group.map((v) => (
                                <button
                                    key={v.name}
                                    onClick={() => { setVendor(v.name); setEditingId(null); setError(null); setDraft(blank(v.name)); }}
                                    className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${v.name === vendor ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                                >
                                    {v.name}
                                </button>
                            ))}
                        </div>
                    );
                })}
                <Link href="/vendors?tab=directory" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><Plus className="h-4 w-4" /> Add vendor or source</Link>
            </div>

            {!vendor || !summary ? (
                <p className="text-sm text-slate-500 p-8 text-center border border-dashed rounded-lg">Add a vendor in the <Link href="/vendors?tab=directory" className="text-blue-600 underline">Directory</Link> to start their ledger.</p>
            ) : (
                <>
                    {/* Totals */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
                        <Stat label={info.qty === "Mtrs" ? "Metres" : "Pieces"} value={formatCurrency(summary.pieces)} />
                        <Stat label="Grand Total" value={rs(summary.workTotal)} />
                        <Stat label="Paid" value={rs(summary.paid)} tone="green" />
                        <Stat label={summary.due < 0 ? "Advance" : "Balance Due"} value={rs(Math.abs(summary.due))} tone={summary.due > 0 ? "red" : "green"} />
                    </div>

                    <Card id="vendor-bill" className="shadow-sm overflow-hidden">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">{vendor} — Work Ledger</CardTitle>
                            <div className="no-print flex gap-2">
                                <button onClick={() => setBillDialog({})} className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-blue-600 rounded-md px-3 py-1 hover:bg-blue-700"><ReceiptText className="h-4 w-4" /> New bill</button>
                                <button onClick={() => window.print()} className="inline-flex items-center gap-1 text-sm text-slate-600 border rounded-md px-2 py-1 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                    <tr>
                                        <th className="text-left px-3 py-2 w-24">Bill no.</th>
                                        <th className="text-right px-3 py-2 w-16">{info.qty}</th>
                                        <th className="text-left px-3 py-2">{info.item}</th>
                                        <th className="text-left px-3 py-2 w-28">Date</th>
                                        <th className="text-right px-3 py-2 w-24">Price</th>
                                        <th className="text-right px-3 py-2 w-28">GST</th>
                                        <th className="text-right px-3 py-2 w-28">Total</th>
                                        <th className="w-20 no-print" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((e) => e.kind === "line" ? (
                                        editingId === e.row.id ? (
                                            <DraftRow key={e.row.id} d={edit} types={typeOptions} labels={info} onChange={setEdit} onType={(t) => setEdit(setType(edit, t))} pending={isPending}
                                                onSave={() => save(edit, e.row.id)} onCancel={() => setEditingId(null)} />
                                        ) : renderLine(e.row, false)
                                    ) : (
                                        <Fragment key={e.bill.id}>
                                            <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                                                <td colSpan={8} className="px-3 py-1.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                            <button type="button" onClick={() => toggleBill(e.bill.id)} aria-expanded={openBills.has(e.bill.id)} title={openBills.has(e.bill.id) ? "Hide items" : "Show items"}
                                                                className="font-bold text-slate-800 flex items-center gap-1 rounded hover:text-blue-700">
                                                                <ChevronRight className={`no-print h-3.5 w-3.5 text-slate-400 transition-transform ${openBills.has(e.bill.id) ? "rotate-90" : ""}`} />
                                                                <ReceiptText className="h-3.5 w-3.5 text-slate-400" />Bill {e.bill.refNo || "(no number)"}
                                                            </button>
                                                            {dupes.has(e.bill.id) && <span title={dupes.get(e.bill.id)} className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700"><CopyX className="h-3 w-3" />Possible duplicate: {dupes.get(e.bill.id)!.toLowerCase()}</span>}
                                                            <span className="text-slate-500">{shortDay(e.bill.date)} · {e.lines.length} item{e.lines.length === 1 ? "" : "s"}{e.bill.gstPercent ? ` · GST ${e.bill.gstPercent}%` : ""}{e.roundOff ? ` · R/O ${e.roundOff > 0 ? "+" : ""}${e.roundOff}` : ""}</span>
                                                            {e.bill.attachmentId && (
                                                                <span className="flex items-center gap-2">
                                                                    <a href={`/api/vendor-bills/file/${e.bill.attachmentId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><Paperclip className="h-3 w-3" />{e.bill.fileName || "bill"}</a>
                                                                    <a href={`/api/vendor-bills/file/${e.bill.attachmentId}?download=1`} title="Download bill" className="no-print text-slate-400 hover:text-blue-600"><Download className="h-3.5 w-3.5" /></a>
                                                                </span>
                                                            )}
                                                            {e.bill.notes && <span className="text-slate-400">{e.bill.notes}</span>}
                                                        </span>
                                                        <span className="flex items-center gap-3">
                                                            <span className="text-xs font-bold text-slate-800">₹{formatCurrency(e.total)}</span>
                                                            <span className="no-print flex gap-1">
                                                                <button title="Edit bill" className="p-1 text-slate-400 hover:text-blue-600" onClick={() => setBillDialog({ bill: e.bill, lines: e.lines })}><Pencil className="h-3.5 w-3.5" /></button>
                                                                <button title="Delete bill" className="p-1 text-slate-400 hover:text-red-600" onClick={() => removeBill(e.bill, e.lines.length)}><Trash2 className="h-3.5 w-3.5" /></button>
                                                            </span>
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {e.lines.map((r) => renderLine(r, true, !openBills.has(e.bill.id)))}
                                        </Fragment>
                                    ))}
                                    <DraftRow d={draft} types={typeOptions} labels={info} onChange={setDraft} onType={(t) => setDraft(setType(draft, t))} pending={isPending} onSave={() => save(draft)} isNew />
                                </tbody>
                                <tfoot className="border-t-2 bg-slate-50 font-bold">
                                    {(summary.gst > 0 || summary.roundOff !== 0) && (
                                        <tr className="font-medium text-slate-600"><td colSpan={2} /><td className="px-3 py-1" colSpan={4}>Subtotal{summary.gst > 0 && " (before GST)"}</td><td className="text-right px-3 py-1">{formatCurrency(summary.subtotal)}</td><td className="no-print" /></tr>
                                    )}
                                    {summary.gst > 0 && (
                                        <tr className="font-medium text-slate-600"><td colSpan={2} /><td className="px-3 py-1" colSpan={4}>GST</td><td className="text-right px-3 py-1">+ {formatCurrency(summary.gst)}</td><td className="no-print" /></tr>
                                    )}
                                    {summary.roundOff !== 0 && (
                                        <tr className="font-medium text-slate-600"><td colSpan={2} /><td className="px-3 py-1" colSpan={4}>Round off</td><td className="text-right px-3 py-1">{summary.roundOff < 0 ? "−" : "+"} {formatCurrency(Math.abs(summary.roundOff))}</td><td className="no-print" /></tr>
                                    )}
                                    <tr>
                                        <td />
                                        <td className="text-right px-3 py-2">{formatCurrency(summary.pieces)}</td>
                                        <td className="px-3 py-2" colSpan={4}>Grand Total{summary.gst > 0 && " (incl. GST)"}</td>
                                        <td className="text-right px-3 py-2">{formatCurrency(summary.workTotal)}</td>
                                        <td className="no-print" />
                                    </tr>
                                    {summary.paid > 0 && (
                                        <>
                                            <tr className="font-medium text-green-700"><td colSpan={2} /><td className="px-3 py-1" colSpan={4}>Paid</td><td className="text-right px-3 py-1">− {formatCurrency(summary.paid)}</td><td className="no-print" /></tr>
                                            <tr className={summary.due > 0 ? "text-red-700" : "text-green-700"}><td colSpan={2} /><td className="px-3 py-2" colSpan={4}>{summary.due < 0 ? "Advance" : "Balance Due"}</td><td className="text-right px-3 py-2">{formatCurrency(Math.abs(summary.due))}</td><td className="no-print" /></tr>
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
                                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-slate-500">By {info.item.toLowerCase()}</CardTitle></CardHeader>
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
                                    <p className="text-slate-500 text-xs">No payments yet. Add an expense in <b>Transactions</b> (any category) with &quot;{vendor}&quot; in the description — it shows here automatically.</p>
                                ) : summary.payments.map((p) => (
                                    <div key={p.id} className="flex justify-between gap-2"><span className="text-slate-600 truncate">{shortDay(p.date)} · {p.description}</span><span className="font-semibold text-green-700 shrink-0">{rs(p.amount)}</span></div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {billDialog && vendor && (
                <BillDialog vendor={vendor} labels={info} today={today} bill={billDialog.bill} lines={billDialog.lines}
                    defaultGst={lastGst(data.work, vendor)} onClose={() => setBillDialog(null)} />
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

function DraftRow({ d, types, labels, onChange, onType, onSave, onCancel, pending, isNew }: {
    d: Draft; types: string[]; labels: { qty: string; itemHint: string }; onChange: (d: Draft) => void; onType: (t: string) => void; onSave: () => void; onCancel?: () => void; pending: boolean; isNew?: boolean;
}) {
    const base = (parseFloat(d.nos) || 0) * (parseFloat(d.price) || 0);
    const gst = d.gstOn ? base * (parseFloat(d.gst) || 0) / 100 : 0;
    const total = base + gst;
    const enter = (e: React.KeyboardEvent) => e.key === "Enter" && onSave();
    const listId = isNew ? "vendor-types-new" : "vendor-types-edit";
    return (
        <tr className={`border-t no-print ${isNew ? "bg-blue-50/40" : "bg-amber-50/50"}`}>
            <td className="px-1 py-1.5"><Input value={d.ref} onChange={(e) => onChange({ ...d, ref: e.target.value })} onKeyDown={enter} placeholder="Bill no." title="Optional" className="h-8 text-sm" /></td>
            <td className="px-1 py-1.5"><Input type="number" min={0} value={d.nos} onChange={(e) => onChange({ ...d, nos: e.target.value })} onKeyDown={enter} placeholder={labels.qty} className="h-8 text-right text-sm" /></td>
            <td className="px-1 py-1.5">
                <Input list={listId} value={d.type} onChange={(e) => onType(e.target.value)} onKeyDown={enter} placeholder={labels.itemHint} className="h-8 text-sm" />
                <datalist id={listId}>{types.map((t) => <option key={t} value={t} />)}</datalist>
            </td>
            <td className="px-1 py-1.5"><Input type="date" value={d.date} onChange={(e) => onChange({ ...d, date: e.target.value })} className="h-8 text-sm" /></td>
            <td className="px-1 py-1.5"><Input type="number" min={0} value={d.price} onChange={(e) => onChange({ ...d, price: e.target.value })} onKeyDown={enter} placeholder="Price" className="h-8 text-right text-sm" /></td>
            <td className="px-1 py-1.5">
                {d.gstOn ? (
                    <div className="flex items-center gap-1">
                        <Input autoFocus={!d.gst} list={`${listId}-gst`} type="number" min={0} max={100} value={d.gst} onChange={(e) => onChange({ ...d, gst: e.target.value })} onKeyDown={enter} placeholder="%" title="GST %" className="h-8 w-16 text-right text-sm" />
                        <span className="text-xs text-slate-500">%</span>
                        <button onClick={() => onChange({ ...d, gstOn: false })} title="Remove GST" className="p-0.5 text-slate-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                        <datalist id={`${listId}-gst`}>{GST_RATES.map((r) => <option key={r} value={r} />)}</datalist>
                    </div>
                ) : (
                    <button onClick={() => onChange({ ...d, gstOn: true })} className="h-8 w-full rounded-md border border-dashed text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600">+ GST</button>
                )}
            </td>
            <td className="text-right px-3 py-1.5 text-slate-500">
                {total ? formatCurrency(Math.round(total * 100) / 100) : "–"}
                {gst > 0 && <span className="block text-[10px] text-slate-400">incl. {formatCurrency(Math.round(gst * 100) / 100)} GST</span>}
            </td>
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
