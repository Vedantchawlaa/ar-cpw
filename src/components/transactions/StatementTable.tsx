"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditModal } from "@/components/transactions/TransactionList";
import { bulkDeleteTransactions, bulkUpdateTransactions, deleteTransaction } from "@/lib/actions/transaction-actions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/transaction-import";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Transaction {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string | null;
    date: Date;
    user?: { name: string | null } | null;
}

type SortKey = "date" | "amount" | "category";
const fieldClass = "h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";

export function StatementTable({ transactions }: { transactions: Transaction[] }) {
    const router = useRouter();
    const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [text, setText] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortAsc, setSortAsc] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [busy, setBusy] = useState(false);

    const categories = useMemo(
        () => Array.from(new Set(transactions.map(t => t.category))).sort((a, b) => a.localeCompare(b)),
        [transactions]
    );
    const allCategories = useMemo(
        () => Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...categories])),
        [categories]
    );

    const visible = useMemo(() => {
        const min = parseFloat(minAmount);
        const max = parseFloat(maxAmount);
        const needle = text.trim().toLowerCase();
        const rows = transactions.filter(t =>
            (typeFilter === "ALL" || t.type === typeFilter)
            && (!categoryFilter || t.category === categoryFilter)
            && (Number.isNaN(min) || t.amount >= min)
            && (Number.isNaN(max) || t.amount <= max)
            && (!needle || `${t.description || ""} ${t.category}`.toLowerCase().includes(needle))
        );
        const direction = sortAsc ? 1 : -1;
        return rows.sort((a, b) => {
            if (sortKey === "amount") return (a.amount - b.amount) * direction;
            if (sortKey === "category") return a.category.localeCompare(b.category) * direction;
            return (new Date(a.date).getTime() - new Date(b.date).getTime()) * direction;
        });
    }, [transactions, typeFilter, categoryFilter, text, minAmount, maxAmount, sortKey, sortAsc]);

    const income = visible.filter(t => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
    const expense = visible.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);
    const filtersActive = typeFilter !== "ALL" || categoryFilter !== "" || text !== "" || minAmount !== "" || maxAmount !== "";

    // Only rows still on screen count as selected
    const selectedIds = visible.filter(t => selected.has(t.id)).map(t => t.id);
    const allSelected = visible.length > 0 && selectedIds.length === visible.length;

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const clearFilters = () => {
        setTypeFilter("ALL");
        setCategoryFilter("");
        setText("");
        setMinAmount("");
        setMaxAmount("");
    };

    const sortBy = (key: SortKey) => {
        if (key === sortKey) setSortAsc(prev => !prev);
        else { setSortKey(key); setSortAsc(key === "category"); }
    };

    const run = async (action: () => Promise<{ success: boolean; count?: number; error?: string }>, done: (count: number) => string) => {
        setBusy(true);
        try {
            const result = await action();
            if (result.success) {
                toast.success(done(result.count ?? 0));
                setSelected(new Set());
                router.refresh();
            } else {
                toast.error(result.error || "Something went wrong");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    };

    const SortIcon = ({ column }: { column: SortKey }) =>
        sortKey !== column ? null : sortAsc ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />;

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 border-b bg-white p-4">
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</label>
                    <div className="flex overflow-hidden rounded-md border border-slate-200">
                        {(["ALL", "INCOME", "EXPENSE"] as const).map(option => (
                            <button
                                key={option}
                                onClick={() => setTypeFilter(option)}
                                className={`h-9 px-3 text-sm font-medium transition-colors ${typeFilter === option ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                            >
                                {option === "ALL" ? "All" : option === "INCOME" ? "Income" : "Expense"}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
                    <select className={`${fieldClass} w-52`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        <option value="">All categories</option>
                        {categories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Details contain</label>
                    <input className={`${fieldClass} w-48`} placeholder="e.g. Super Industries" value={text} onChange={e => setText(e.target.value)} />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</label>
                    <div className="flex items-center gap-1">
                        <input type="number" min="0" className={`${fieldClass} w-24`} placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                        <span className="text-slate-400">–</span>
                        <input type="number" min="0" className={`${fieldClass} w-24`} placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
                    </div>
                </div>
                {filtersActive && (
                    <Button variant="ghost" size="sm" className="h-9 gap-1 text-slate-500" onClick={clearFilters}>
                        <X className="h-4 w-4" /> Clear filters
                    </Button>
                )}
            </div>

            {/* Totals of what is shown, or bulk actions for what is ticked */}
            {selectedIds.length === 0 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50 px-4 py-2 text-sm text-slate-600">
                    <span>Showing <b>{visible.length}</b> of {transactions.length}</span>
                    <span className="text-green-700">Income ₹{formatCurrency(income)}</span>
                    <span className="text-red-700">Expense ₹{formatCurrency(expense)}</span>
                    <span className="font-semibold text-blue-700">Net {income - expense < 0 ? "-" : ""}₹{formatCurrency(Math.abs(income - expense))}</span>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-3 border-b bg-blue-50 px-4 py-2 text-sm">
                    <span className="font-semibold text-blue-900">{selectedIds.length} selected</span>
                    <select
                        className={`${fieldClass} w-52`}
                        value=""
                        disabled={busy}
                        onChange={e => {
                            const category = e.target.value;
                            if (category) run(() => bulkUpdateTransactions(selectedIds, { category }), count => `Moved ${count} transaction(s) to ${category}.`);
                        }}
                    >
                        <option value="">Change category to...</option>
                        {allCategories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <select
                        className={`${fieldClass} w-44`}
                        value=""
                        disabled={busy}
                        onChange={e => {
                            const type = e.target.value;
                            if (type) run(() => bulkUpdateTransactions(selectedIds, { type }), count => `Marked ${count} transaction(s) as ${type === "INCOME" ? "income" : "expense"}.`);
                        }}
                    >
                        <option value="">Mark as...</option>
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expense</option>
                    </select>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-9 gap-1"
                        disabled={busy}
                        onClick={() => {
                            if (confirm(`Delete ${selectedIds.length} transaction(s)? This cannot be undone.`)) {
                                run(() => bulkDeleteTransactions(selectedIds), count => `Deleted ${count} transaction(s).`);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9" onClick={() => setSelected(new Set())}>Clear selection</Button>
                </div>
            )}

            {visible.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                    {transactions.length === 0 ? "No transactions in this period." : "No transactions match these filters."}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="w-10 px-4 py-2">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={e => setSelected(e.target.checked ? new Set(visible.map(t => t.id)) : new Set())}
                                        title="Select all shown"
                                    />
                                </th>
                                <th className="w-28 cursor-pointer px-2 py-2" onClick={() => sortBy("date")}>Date <SortIcon column="date" /></th>
                                <th className="px-2 py-2">Details</th>
                                <th className="w-52 cursor-pointer px-2 py-2" onClick={() => sortBy("category")}>Category <SortIcon column="category" /></th>
                                <th className="w-32 cursor-pointer px-2 py-2 text-right" onClick={() => sortBy("amount")}>Amount <SortIcon column="amount" /></th>
                                <th className="w-24 px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(t => (
                                <tr key={t.id} className={`border-t hover:bg-slate-50 ${selected.has(t.id) ? "bg-blue-50/60" : ""}`}>
                                    <td className="px-4 py-2">
                                        <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-2 text-slate-600">{formatDate(t.date)}</td>
                                    <td className="px-2 py-2 text-slate-900">{t.description || t.user?.name || <span className="text-slate-400">No description</span>}</td>
                                    <td className="px-2 py-2">
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{t.category}</span>
                                    </td>
                                    <td className={`whitespace-nowrap px-2 py-2 text-right font-bold ${t.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                                        {t.type === "INCOME" ? "+" : "-"}₹{formatCurrency(t.amount)}
                                    </td>
                                    <td className="px-2 py-1">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="Edit" onClick={() => setEditing(t)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                                title="Delete"
                                                disabled={busy}
                                                onClick={() => {
                                                    if (confirm("Delete this transaction? This cannot be undone.")) {
                                                        run(async () => ({ ...(await deleteTransaction(t.id)), count: 1 }), () => "Transaction deleted.");
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <EditModal
                transaction={editing}
                onClose={() => setEditing(null)}
                expenseCategories={EXPENSE_CATEGORIES}
                incomeCategories={INCOME_CATEGORIES}
            />
        </div>
    );
}
