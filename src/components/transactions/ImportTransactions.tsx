"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importTransactions } from "@/lib/actions/transaction-actions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ImportedTransaction, TransactionType, todayIso } from "@/lib/transaction-import";
import { formatCurrency } from "@/lib/utils";

interface PreviewRow extends ImportedTransaction {
    key: number;
    selected: boolean;
    duplicate: boolean;
}

const ACCEPT = ".csv,.xlsx,.xls,.pdf";
const fieldClass = "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";

const isValid = (row: PreviewRow) => row.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.category.trim() !== "";

export function ImportTransactions() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<PreviewRow[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [source, setSource] = useState("");
    const [aiAvailable, setAiAvailable] = useState(false);
    const [error, setError] = useState("");
    const [reading, setReading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);

    const reset = () => {
        setFile(null);
        setRows([]);
        setWarnings([]);
        setSource("");
        setError("");
    };

    const close = () => {
        if (saving) return;
        setOpen(false);
        reset();
    };

    const readFile = async (selected: File, mode?: "ai") => {
        reset();
        setFile(selected);
        setReading(true);
        try {
            const formData = new FormData();
            formData.append("file", selected);
            formData.append("today", todayIso());
            if (mode) formData.append("mode", mode);
            const res = await fetch("/api/parse-transactions", { method: "POST", body: formData });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || "Failed to read this file");
                return;
            }
            setRows(data.rows.map((row: ImportedTransaction & { duplicate: boolean }, key: number) => ({ ...row, key, selected: !row.duplicate })));
            setWarnings(data.warnings || []);
            setSource(data.source);
            setAiAvailable(Boolean(data.aiAvailable));
        } catch (err: any) {
            setError("Failed to read this file: " + err.message);
        } finally {
            setReading(false);
        }
    };

    const updateRow = (key: number, changes: Partial<PreviewRow>) => {
        setRows(prev => prev.map(row => {
            if (row.key !== key) return row;
            const next = { ...row, ...changes };
            // Switching income/expense: move to that side's default category if the old one no longer applies
            if (changes.type && changes.type !== row.type) {
                const allowed = changes.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                if (!allowed.includes(next.category)) next.category = changes.type === "INCOME" ? "Sales" : "Other";
                next.needsReview = false;
            }
            return next;
        }));
    };

    const selected = rows.filter(row => row.selected);
    const invalidCount = selected.filter(row => !isValid(row)).length;
    const totalIncome = selected.filter(row => row.type === "INCOME").reduce((sum, row) => sum + (row.amount || 0), 0);
    const totalExpense = selected.filter(row => row.type === "EXPENSE").reduce((sum, row) => sum + (row.amount || 0), 0);
    const duplicateCount = rows.filter(row => row.duplicate).length;
    const reviewCount = rows.filter(row => row.needsReview).length;
    const allSelected = rows.length > 0 && selected.length === rows.length;

    const handleImport = async () => {
        if (selected.length === 0 || invalidCount > 0) return;
        setSaving(true);
        try {
            const result = await importTransactions(selected.map(({ date, type, amount, category, description }) => ({ date, type, amount, category, description })));
            if (result.success) {
                toast.success(`Imported ${result.count} transaction${result.count === 1 ? "" : "s"}.`);
                setOpen(false);
                reset();
                router.refresh();
            } else {
                toast.error(result.error || "Failed to import transactions.");
            }
        } catch (err: any) {
            toast.error("Failed to import: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-100 h-9 px-4 py-2 gap-2 whitespace-nowrap"
            >
                <Upload className="h-4 w-4" />
                Import File
            </button>

            {open && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
                    <div className="relative z-[101] flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border bg-white shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b p-5">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">Import transactions from a file</h2>
                                <p className="text-sm text-slate-500">
                                    Upload a CSV, Excel or PDF with amounts and details. Check the rows, then import them in one go.
                                </p>
                            </div>
                            <button onClick={close} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto p-5">
                            <input
                                ref={inputRef}
                                type="file"
                                accept={ACCEPT}
                                className="hidden"
                                onChange={e => {
                                    const picked = e.target.files?.[0];
                                    if (picked) readFile(picked);
                                    e.target.value = "";
                                }}
                            />

                            {rows.length === 0 && !reading && (
                                <div
                                    onClick={() => inputRef.current?.click()}
                                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={e => {
                                        e.preventDefault();
                                        setDragging(false);
                                        const dropped = e.dataTransfer.files?.[0];
                                        if (dropped) readFile(dropped);
                                    }}
                                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:bg-slate-50"}`}
                                >
                                    <FileUp className="h-8 w-8 text-slate-400" />
                                    <p className="text-sm font-medium text-slate-700">Drop a file here, or click to choose</p>
                                    <p className="text-xs text-slate-500">CSV, Excel (.xlsx / .xls) or PDF, up to 10 MB</p>
                                    <p className="mt-2 max-w-xl text-xs text-slate-500">
                                        Works with bank statements and with your own sheets. Useful columns: Date, Details, Amount, Type (Income / Expense) or separate
                                        Debit and Credit columns, and Category. Only an amount is required; missing dates use today.
                                    </p>
                                </div>
                            )}

                            {reading && (
                                <div className="flex flex-col items-center justify-center gap-2 p-10 text-sm text-slate-600">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                    Reading {file?.name}...
                                </div>
                            )}

                            {error && (
                                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                            )}

                            {!reading && rows.length === 0 && warnings.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                    {warnings.map((warning, i) => <p key={i}>{warning}</p>)}
                                </div>
                            )}

                            {rows.length > 0 && (
                                <>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm text-slate-600">
                                            <span className="font-semibold text-slate-900">{file?.name}</span>
                                            {" · "}{rows.length} row{rows.length === 1 ? "" : "s"} found
                                            {source === "pdf-ai" && " · read with AI"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {source === "pdf" && aiAvailable && file && (
                                                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => readFile(file, "ai")}>
                                                    <Sparkles className="h-4 w-4 text-purple-600" /> Re-read with AI
                                                </Button>
                                            )}
                                            <Button variant="outline" size="sm" className="h-8" onClick={() => { reset(); inputRef.current?.click(); }}>
                                                Choose another file
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Selected</div>
                                            <div className="text-xl font-bold text-slate-800">{selected.length} of {rows.length}</div>
                                        </div>
                                        <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                                            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Income</div>
                                            <div className="text-xl font-bold text-green-700">₹{formatCurrency(totalIncome)}</div>
                                        </div>
                                        <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                                            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Expense</div>
                                            <div className="text-xl font-bold text-red-700">₹{formatCurrency(totalExpense)}</div>
                                        </div>
                                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                                            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Net</div>
                                            <div className="text-xl font-bold text-blue-700">
                                                {totalIncome - totalExpense < 0 ? "-" : ""}₹{formatCurrency(Math.abs(totalIncome - totalExpense))}
                                            </div>
                                        </div>
                                    </div>

                                    {(warnings.length > 0 || duplicateCount > 0) && (
                                        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div className="space-y-0.5">
                                                {warnings.map((warning, i) => <p key={i}>{warning}</p>)}
                                                {duplicateCount > 0 && (
                                                    <p>
                                                        {duplicateCount} row(s) match a transaction already saved (same type and amount within a day). They are marked
                                                        &quot;Duplicate&quot; and unticked. Tick them only if they are really separate payments.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto rounded-md border">
                                        <table className="w-full min-w-[860px] text-left text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                <tr>
                                                    <th className="w-10 px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={allSelected}
                                                            onChange={e => setRows(prev => prev.map(row => ({ ...row, selected: e.target.checked })))}
                                                            title="Select all"
                                                        />
                                                    </th>
                                                    <th className="w-36 px-2 py-2">Date</th>
                                                    <th className="w-28 px-2 py-2">Type</th>
                                                    <th className="w-28 px-2 py-2">Amount</th>
                                                    <th className="w-48 px-2 py-2">Category</th>
                                                    <th className="px-2 py-2">Details</th>
                                                    <th className="w-24 px-2 py-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(row => {
                                                    const categories = row.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                                                    const invalid = row.selected && !isValid(row);
                                                    return (
                                                        <tr key={row.key} className={`border-t ${!row.selected ? "bg-slate-50 opacity-60" : invalid ? "bg-red-50" : ""}`}>
                                                            <td className="px-3 py-1.5">
                                                                <input type="checkbox" checked={row.selected} onChange={e => updateRow(row.key, { selected: e.target.checked })} />
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <input type="date" className={fieldClass} value={row.date} onChange={e => updateRow(row.key, { date: e.target.value })} />
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <select
                                                                    className={`${fieldClass} font-medium ${row.type === "INCOME" ? "text-green-700" : "text-red-700"}`}
                                                                    value={row.type}
                                                                    onChange={e => updateRow(row.key, { type: e.target.value as TransactionType })}
                                                                >
                                                                    <option value="INCOME">Income</option>
                                                                    <option value="EXPENSE">Expense</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    className={`${fieldClass} text-right`}
                                                                    value={Number.isFinite(row.amount) ? row.amount : ""}
                                                                    onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) })}
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <select className={fieldClass} value={row.category} onChange={e => updateRow(row.key, { category: e.target.value })}>
                                                                    {!categories.includes(row.category) && <option value={row.category}>{row.category}</option>}
                                                                    {categories.map(category => <option key={category} value={category}>{category}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <input className={fieldClass} value={row.description} onChange={e => updateRow(row.key, { description: e.target.value })} />
                                                            </td>
                                                            <td className="px-2 py-1.5 text-xs font-semibold">
                                                                {row.duplicate && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Duplicate</span>}
                                                                {!row.duplicate && row.needsReview && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">Check</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                            <p className="text-xs text-slate-500">
                                {invalidCount > 0
                                    ? <span className="font-semibold text-red-600">{invalidCount} selected row(s) need a valid date and an amount above 0.</span>
                                    : reviewCount > 0
                                        ? `${reviewCount} row(s) marked "Check": confirm Income or Expense before importing.`
                                        : rows.length > 0 ? "Nothing is saved until you press Import." : ""}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
                                <Button onClick={handleImport} disabled={saving || selected.length === 0 || invalidCount > 0} className="gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    {saving ? "Importing..." : `Import ${selected.length} transaction${selected.length === 1 ? "" : "s"}`}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
