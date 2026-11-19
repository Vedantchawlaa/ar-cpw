"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Upload, Loader2, Paperclip, Plus, Trash2, X, ScanText, CopyX } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { BillInfo, WorkRow } from "@/lib/vendor-ledger";
import { parseBillText, type ParsedBill } from "@/lib/bill-text-parser";
import { checkVendorBillDuplicate, saveVendorBill, type DuplicateBill } from "@/lib/actions/vendor-ledger-actions";

interface Item { type: string; nos: string; price: string }
const emptyItem = (): Item => ({ type: "", nos: "", price: "" });
const round2 = (n: number) => Math.round(n * 100) / 100;

const GST_RATES = [5, 12, 18, 28];

export function BillDialog({ vendor, labels, today, bill, lines, defaultGst, onClose }: {
    vendor: string;
    labels: { qty: string; item: string; itemHint: string };
    today: string;
    bill?: BillInfo; // editing an existing bill
    lines?: WorkRow[];
    defaultGst: number | null;
    onClose: () => void;
}) {
    const router = useRouter();
    const fileInput = useRef<HTMLInputElement>(null);
    const [refNo, setRefNo] = useState(bill?.refNo ?? "");
    const [date, setDate] = useState(bill?.date ?? today);
    const initialGst = bill ? bill.gstPercent : defaultGst;
    const [gstOn, setGstOn] = useState(!!initialGst);
    const [gst, setGst] = useState(initialGst ? String(initialGst) : "");
    const [notes, setNotes] = useState(bill?.notes ?? "");
    // null = automatic (to the nearest rupee); a saved bill keeps its own round off
    const [roundOffText, setRoundOffText] = useState<string | null>(bill ? String(bill.roundOff ?? 0) : null);
    const [items, setItems] = useState<Item[]>(lines?.length ? lines.map((l) => ({ type: l.type, nos: String(l.nos), price: String(l.price) })) : [emptyItem(), emptyItem()]);
    const [file, setFile] = useState<{ attachmentId: string; fileName: string } | null>(bill?.attachmentId ? { attachmentId: bill.attachmentId, fileName: bill.fileName ?? "bill" } : null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null); // photo reading, %
    const [note, setNote] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dup, setDup] = useState<DuplicateBill | null>(null); // looks already entered
    const [isPending, startTransition] = useTransition();

    const subtotal = round2(items.reduce((s, i) => s + (parseFloat(i.nos) || 0) * (parseFloat(i.price) || 0), 0));
    const gstAmount = gstOn ? round2(subtotal * (parseFloat(gst) || 0) / 100) : 0;
    const beforeRound = round2(subtotal + gstAmount);
    const roundOff = roundOffText === null ? round2(Math.round(beforeRound) - beforeRound) : round2(parseFloat(roundOffText) || 0);
    const billTotal = round2(beforeRound + roundOff);

    const setItem = (n: number, patch: Partial<Item>) => setItems(items.map((it, i) => (i === n ? { ...it, ...patch } : it)));

    // Photos are read in the browser (OCR, no AI); PDFs are read on the server from their text.
    async function upload(f: File) {
        setUploading(true);
        setError(null);
        setNote(null);
        setDup(null);
        const isImage = f.type.startsWith("image/");
        try {
            const body = new FormData();
            body.append("file", f);
            body.append("read", isImage ? "0" : "1");
            const [out, photoText] = await Promise.all([
                fetch("/api/vendor-bills/upload", { method: "POST", body }).then((r) => r.json()),
                isImage ? readPhoto(f).catch((e) => { console.error("OCR failed:", e); return null; }) : Promise.resolve(null),
            ]);
            if (!out.ok) { setError(out.error || "Upload failed."); return; }
            setFile({ attachmentId: out.attachmentId, fileName: out.fileName });

            const p: ParsedBill | null = isImage ? (photoText ? parseBillText(photoText) : null) : out.parsed;
            checkVendorBillDuplicate({ vendor, refNo: p?.billNo || refNo, attachmentId: out.attachmentId, excludeId: bill?.id })
                .then(setDup).catch(() => {});
            if (p && (p.items.length > 0 || p.billNo || p.date)) {
                if (p.billNo) setRefNo(p.billNo);
                if (p.date) setDate(p.date);
                if (p.gstPercent > 0) { setGstOn(true); setGst(String(p.gstPercent)); }
                setRoundOffText(p.roundOff ? String(p.roundOff) : null);
                if (p.items.length > 0) setItems(p.items.map((i) => ({ type: i.item, nos: String(i.qty), price: String(i.price) })));
                setNote(p.items.length > 0
                    ? { tone: "info", text: `Read ${p.items.length} item(s)${p.billNo ? `, bill no. ${p.billNo}` : ""}. Check them against the bill before saving.` }
                    : { tone: "warn", text: "Read the bill no. / date, but no item lines (qty x rate = amount). Enter the items by hand." });
            } else if (!isImage && out.readError) {
                setNote({ tone: "warn", text: out.readError });
            } else {
                setNote({ tone: "warn", text: isImage
                    ? "Could not read items from this photo. It is attached; enter the items by hand. A straight, well-lit photo reads best."
                    : "No item lines found in this PDF. It is attached; enter the items by hand." });
            }
        } catch {
            setError("Upload failed. Check your connection and try again.");
        } finally {
            setUploading(false);
            setProgress(null);
        }
    }

    async function readPhoto(f: File): Promise<string> {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", undefined, {
            logger: (m: { status: string; progress: number }) => {
                if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
            },
        });
        try {
            await worker.setParameters({ preserve_interword_spaces: "1" });
            return (await worker.recognize(f)).data.text;
        } finally {
            await worker.terminate();
        }
    }

    function save(allowDuplicate = false) {
        setError(null);
        const gstPercent = gstOn ? parseFloat(gst) : null;
        if (gstOn && !(gstPercent! > 0)) return setError("Enter the GST %.");
        startTransition(async () => {
            const res = await saveVendorBill({
                vendor, refNo, date, gstPercent, roundOff, notes,
                attachmentId: file?.attachmentId ?? null, fileName: file?.fileName ?? null,
                items: items.map((i) => ({ type: i.type, nos: parseFloat(i.nos), price: parseFloat(i.price) })).filter((i) => i.type.trim() || i.nos || i.price),
                allowDuplicate,
            }, bill?.id);
            if (!res.ok) {
                if ("duplicate" in res && res.duplicate) return setDup(res.duplicate);
                return setError(res.error);
            }
            router.refresh();
            onClose();
        });
    }

    return (
        <Dialog open onOpenChange={(open) => { if (!open && !isPending && !uploading) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{bill ? "Edit bill" : "New bill"} · {vendor}</DialogTitle>
                    <DialogDescription>Upload the bill to fill the items automatically and keep a copy, or type them in.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Bill file */}
                    <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
                    {file ? (
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                            <span className="flex items-center gap-2 min-w-0"><Paperclip className="h-4 w-4 text-slate-400 shrink-0" /><span className="truncate">{file.fileName}</span></span>
                            <div className="flex items-center gap-2 shrink-0">
                                {bill?.attachmentId === file.attachmentId && <a href={`/api/vendor-bills/file/${file.attachmentId}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>}
                                <button onClick={() => fileInput.current?.click()} disabled={uploading} className="text-blue-600 hover:underline">Replace</button>
                                <button onClick={() => setFile(null)} disabled={uploading} title="Remove file" className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => fileInput.current?.click()} disabled={uploading}
                            className="w-full rounded-lg border-2 border-dashed border-slate-300 p-5 text-center hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-60">
                            {uploading ? (
                                <span className="flex items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> {progress !== null ? `Reading the photo… ${progress}%` : "Uploading and reading the bill…"}</span>
                            ) : (
                                <span className="flex flex-col items-center gap-1 text-sm text-slate-600">
                                    <Upload className="h-5 w-5 text-slate-400" />
                                    <span className="font-semibold">Upload bill (photo or PDF)</span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1"><ScanText className="h-3 w-3" /> Items are read from the bill for you to check</span>
                                </span>
                            )}
                        </button>
                    )}
                    {uploading && file && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> {progress !== null ? `Reading the photo… ${progress}%` : "Uploading and reading the bill…"}</p>}
                    {note && <p className={`text-xs rounded px-3 py-2 ${note.tone === "info" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{note.text}</p>}

                    {/* Header */}
                    <div className="grid gap-2 sm:grid-cols-3">
                        <label className="space-y-1 text-xs font-semibold text-slate-500">Bill no. (optional)
                            <Input value={refNo} onChange={(e) => { setRefNo(e.target.value); setDup(null); }} placeholder="e.g. 1042" className="font-normal" />
                        </label>
                        <label className="space-y-1 text-xs font-semibold text-slate-500">Date
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-normal" />
                        </label>
                        <div className="space-y-1 text-xs font-semibold text-slate-500">GST
                            {gstOn ? (
                                <div className="flex items-center gap-1">
                                    <Input list="bill-gst-rates" type="number" min={0} max={100} value={gst} onChange={(e) => setGst(e.target.value)} placeholder="%" autoFocus={!gst} className="font-normal text-right" />
                                    <span className="text-slate-500">%</span>
                                    <button onClick={() => setGstOn(false)} title="Remove GST" className="p-1 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                                    <datalist id="bill-gst-rates">{GST_RATES.map((r) => <option key={r} value={r} />)}</datalist>
                                </div>
                            ) : (
                                <button onClick={() => setGstOn(true)} className="h-10 w-full rounded-md border border-dashed font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600">+ GST</button>
                            )}
                        </div>
                    </div>

                    {/* Items */}
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="text-left px-2 py-1.5">{labels.item}</th>
                                    <th className="text-right px-2 py-1.5 w-20">{labels.qty}</th>
                                    <th className="text-right px-2 py-1.5 w-24">Price</th>
                                    <th className="text-right px-2 py-1.5 w-24">Amount</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it, n) => (
                                    <tr key={n} className="border-t">
                                        <td className="px-1 py-1"><Input value={it.type} onChange={(e) => setItem(n, { type: e.target.value })} placeholder={labels.itemHint} className="h-8 text-sm" /></td>
                                        <td className="px-1 py-1"><Input type="number" min={0} value={it.nos} onChange={(e) => setItem(n, { nos: e.target.value })} className="h-8 text-right text-sm" /></td>
                                        <td className="px-1 py-1"><Input type="number" min={0} value={it.price} onChange={(e) => setItem(n, { price: e.target.value })} className="h-8 text-right text-sm" /></td>
                                        <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(round2((parseFloat(it.nos) || 0) * (parseFloat(it.price) || 0)))}</td>
                                        <td className="px-1 py-1">
                                            <button onClick={() => setItems(items.length > 1 ? items.filter((_, i) => i !== n) : [emptyItem()])} title="Remove item" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={() => setItems([...items, emptyItem()])} className="w-full border-t px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50/50 flex items-center gap-1"><Plus className="h-4 w-4" /> Add item</button>
                    </div>

                    {/* Totals */}
                    <div className="ml-auto w-full sm:w-64 space-y-1 text-sm">
                        <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{formatCurrency(subtotal)}</span></div>
                        {gstOn && <div className="flex justify-between text-slate-600"><span>GST {gst ? `${gst}%` : ""}</span><span>+ ₹{formatCurrency(gstAmount)}</span></div>}
                        <div className="flex items-center justify-between gap-2 text-slate-600">
                            <span>Round off {roundOffText === null
                                ? <span className="text-xs text-slate-400">(auto)</span>
                                : <button type="button" onClick={() => setRoundOffText(null)} className="text-xs text-blue-600 hover:underline">auto</button>}</span>
                            <Input type="number" step="0.01" value={roundOffText ?? String(roundOff)} onChange={(e) => setRoundOffText(e.target.value)} className="h-7 w-24 text-right text-sm" />
                        </div>
                        <div className="flex justify-between border-t pt-1 font-bold"><span>Bill total</span><span>₹{formatCurrency(billTotal)}</span></div>
                    </div>

                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-sm" />
                    {dup && (
                        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            <CopyX className="mt-0.5 h-4 w-4 shrink-0" />
                            <span><b>Possible duplicate.</b> {dup.reason}: bill {dup.refNo || "(no number)"} of {dup.vendor}, dated {dup.date}. Check before saving it again.</span>
                        </div>
                    )}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <DialogFooter>
                    <button onClick={onClose} disabled={isPending || uploading} className="px-4 py-2 rounded-md border text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button onClick={() => save(!!dup)} disabled={isPending || uploading} className={`px-4 py-2 rounded-md text-white text-sm font-semibold disabled:opacity-60 ${dup ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                        {isPending ? "Saving..." : dup ? "Save anyway" : "Save bill"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
