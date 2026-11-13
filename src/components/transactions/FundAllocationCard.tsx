"use client";

import { useState, useTransition } from "react";
import { PieChart, Pencil, Check, Undo2, Plus, Trash2, AlertTriangle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency, cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/transaction-import";
import type { AllocationSummary, BucketAllocation, FundBucketConfig } from "@/lib/fund-allocation";
import { saveFundBuckets, setFundTransfer } from "@/lib/actions/fund-allocation-actions";

interface Props {
    summary: AllocationSummary;
    month: number;
    year: number;
    monthLabel: string;
}

const STATUS_BAR = { ok: "bg-emerald-500", near: "bg-amber-500", over: "bg-red-500" } as const;

export function FundAllocationCard({ summary, month, year, monthLabel }: Props) {
    const [editing, setEditing] = useState(false);

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                        <PieChart className="h-4 w-4" /> Fund Allocation
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {monthLabel} income of <span className="font-semibold text-slate-900">₹{formatCurrency(summary.income)}</span> split across your buckets
                    </p>
                </div>
                {!editing && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit split
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {editing ? (
                    <BucketEditor buckets={summary.buckets} onDone={() => setEditing(false)} />
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {summary.buckets.map((b) => (
                                <BucketTile key={b.id ?? b.name} bucket={b} month={month} year={year} />
                            ))}
                        </div>
                        {summary.unassignedTotal > 0 && (
                            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <div>
                                    <span className="font-semibold">₹{formatCurrency(summary.unassignedTotal)} of expenses are not linked to any bucket: </span>
                                    {summary.unassigned.map((u) => `${u.category} (₹${formatCurrency(u.amount)})`).join(", ")}.{" "}
                                    <button className="underline font-semibold" onClick={() => setEditing(true)}>Link them</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function BucketTile({ bucket: b, month, year }: { bucket: BucketAllocation; month: number; year: number }) {
    const [pending, startTransition] = useTransition();
    const [editingAmount, setEditingAmount] = useState(false);
    const [amount, setAmount] = useState("");
    const [error, setError] = useState<string | null>(null);

    const save = (value: number | null) => {
        if (!b.id) return;
        setError(null);
        startTransition(async () => {
            const res = await setFundTransfer(b.id!, month, year, value);
            // On success the action's revalidatePath already re-renders the page
            if (!res.ok) setError(res.error);
            else setEditingAmount(false);
        });
    };

    const width = Math.min(100, Number.isFinite(b.usedRatio) ? b.usedRatio * 100 : 100);
    const usedLabel = b.kind === "SAVE" ? "Moved" : "Spent";
    const fullyMoved = b.toMove === 0 && b.moved > 0;

    return (
        <div className={cn("rounded-lg border p-3 space-y-2", b.status === "over" && "border-red-200 bg-red-50/40")}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{b.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {b.percent}% · {b.kind === "SAVE" ? "Move to account" : "Spending"}
                    </p>
                </div>
                <p className="text-sm font-bold text-slate-900">₹{formatCurrency(b.allocated)}</p>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={cn("h-full rounded-full transition-all", STATUS_BAR[b.status])} style={{ width: `${width}%` }} />
            </div>

            <div className="flex justify-between text-xs">
                <span className="text-slate-500">{usedLabel} ₹{formatCurrency(b.used)}</span>
                <span className={cn("font-semibold", b.remaining < 0 ? "text-red-600" : "text-slate-700")}>
                    {b.remaining < 0 ? `Over by ₹${formatCurrency(-b.remaining)}` : `₹${formatCurrency(b.remaining)} left`}
                </span>
            </div>

            {b.kind === "SPEND" && (
                <div className="flex justify-between border-t pt-2 text-xs">
                    <span className="text-slate-500">Moved to account ₹{formatCurrency(b.moved)}</span>
                    <span className={cn("font-semibold", fullyMoved ? "text-emerald-600" : "text-slate-700")}>
                        {fullyMoved ? "✓ All moved" : b.toMove === 0 ? "Nothing left to move" : `₹${formatCurrency(b.toMove)} to move`}
                    </span>
                </div>
            )}

            {b.id && (
                <div className="pt-1">
                    {editingAmount ? (
                        <form
                            className="flex gap-1"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const n = Number(amount);
                                if (!Number.isFinite(n) || n < 0) return setError("Enter a valid amount.");
                                save(n);
                            }}
                        >
                            <Input autoFocus type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-xs" placeholder="Amount moved" />
                            <Button type="submit" size="sm" className="h-8 px-2" disabled={pending}><Check className="h-3 w-3" /></Button>
                            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingAmount(false)}><X className="h-3 w-3" /></Button>
                        </form>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {b.toMove > 0 && (
                                <Button size="sm" className="h-7 text-xs" disabled={pending} onClick={() => save(b.moved + b.toMove)}>
                                    <Check className="mr-1 h-3 w-3" /> Mark ₹{formatCurrency(b.toMove)} moved
                                </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => { setAmount(b.moved ? String(b.moved) : ""); setEditingAmount(true); }}>
                                {b.moved ? "Edit amount" : "Other amount"}
                            </Button>
                            {b.moved > 0 && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending} onClick={() => save(null)}>
                                    <Undo2 className="mr-1 h-3 w-3" /> Undo
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

function BucketEditor({ buckets, onDone }: { buckets: BucketAllocation[]; onDone: () => void }) {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<(FundBucketConfig & { percentText: string })[]>(
        buckets.map((b) => ({ id: b.id, name: b.name, percent: b.percent, percentText: String(b.percent), kind: b.kind, categories: [...b.categories] })),
    );

    const allCategories = [...new Set([...EXPENSE_CATEGORIES, ...rows.flatMap((r) => r.categories)])];
    const total = Math.round(rows.reduce((s, r) => s + (Number(r.percentText) || 0), 0) * 100) / 100;
    const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const ownerOf = (category: string) => rows.findIndex((r) => r.kind === "SPEND" && r.categories.includes(category));

    const toggleCategory = (i: number, category: string) => {
        setRows((rs) =>
            rs.map((r, j) => {
                // A category belongs to one bucket: linking it here unlinks it elsewhere
                if (j === i) return { ...r, categories: r.categories.includes(category) ? r.categories.filter((c) => c !== category) : [...r.categories, category] };
                return { ...r, categories: r.categories.filter((c) => c !== category) };
            }),
        );
    };

    const submit = () => {
        setError(null);
        startTransition(async () => {
            const res = await saveFundBuckets(rows.map(({ percentText, ...r }) => ({ ...r, percent: Number(percentText) })));
            if (!res.ok) setError(res.error);
            else onDone();
        });
    };

    return (
        <div className="space-y-4">
            {rows.map((r, i) => (
                <div key={r.id ?? `new-${i}`} className="rounded-lg border p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="h-9 flex-1 min-w-[160px]" placeholder="Bucket name" />
                        <div className="flex items-center gap-1">
                            <Input value={r.percentText} onChange={(e) => update(i, { percentText: e.target.value })} type="number" step="0.5" min="0" max="100" className="h-9 w-20" />
                            <span className="text-sm text-slate-500">%</span>
                        </div>
                        <select
                            value={r.kind}
                            onChange={(e) => update(i, { kind: e.target.value as FundBucketConfig["kind"] })}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                            <option value="SPEND">Spending (track expenses)</option>
                            <option value="SAVE">Move to account (track transfers)</option>
                        </select>
                        <Button variant="ghost" size="sm" className="h-9 px-2 text-red-600" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove bucket">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    {r.kind === "SPEND" ? (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Expense categories counted here</p>
                            <div className="flex flex-wrap gap-1">
                                {allCategories.map((c) => {
                                    const on = r.categories.includes(c);
                                    const owner = ownerOf(c);
                                    const elsewhere = !on && owner !== -1;
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => toggleCategory(i, c)}
                                            title={elsewhere ? `Currently in "${rows[owner].name}", click to move here` : undefined}
                                            className={cn(
                                                "rounded-full border px-2 py-0.5 text-xs transition-colors",
                                                on ? "border-blue-600 bg-blue-600 text-white" : elsewhere ? "border-slate-200 text-slate-300" : "border-slate-300 text-slate-600 hover:bg-slate-50",
                                            )}
                                        >
                                            {c}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Counts as used once you mark it moved into this account.</p>
                    )}
                </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { name: "", percent: 0, percentText: "0", kind: "SPEND", categories: [] }])}>
                    <Plus className="mr-1 h-3 w-3" /> Add bucket
                </Button>
                <p className={cn("text-sm font-semibold", total === 100 ? "text-emerald-600" : "text-red-600")}>
                    Total: {total}% {total !== 100 && `(must be 100%)`}
                </p>
            </div>
            <p className="text-xs text-muted-foreground">Removing a bucket also deletes its record of money moved.</p>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onDone} disabled={pending}>Cancel</Button>
                <Button onClick={submit} disabled={pending || total !== 100}>{pending ? "Saving..." : "Save split"}</Button>
            </div>
        </div>
    );
}
