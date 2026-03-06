"use client";

import * as React from "react";
import { useState, useActionState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatDate, formatCurrency } from "@/lib/utils";
// @ts-ignore
import { TrendingUp, TrendingDown, Clock, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { updateTransaction, deleteTransaction } from "@/lib/actions/transaction-actions";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";

interface Transaction {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string | null;
    date: Date;
    user?: { name: string | null } | null;
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<string | null>(null);

    // Categories are needed for the edit form as well
    const expenseCategories = ["Food", "Salary", "Vehicle maintenance & Fuel", "Utilities", "Other", "Rent", "Fabric Purchase", "Accessory Purchase", "Advertisement"];
    const incomeCategories = ["Sales", "Car Income", "EXTRA"];

    if (transactions.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground border rounded-lg bg-slate-50">
                No recent transactions.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {transactions.map((t) => (
                <div key={t.id} className="group relative flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.type === 'INCOME' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                            {t.type === 'INCOME' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="font-medium text-sm">{t.category}</p>
                            <p className="text-xs text-muted-foreground">{t.description || t.user?.name || 'No description'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className={`font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                {t.type === 'INCOME' ? '+' : '-'}₹{formatCurrency(t.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                onClick={() => setEditingTransaction(t)}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600"
                                onClick={() => setIsDeleteDialogOpen(t.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            ))}

            {/* Edit Modal */}
            <EditModal
                transaction={editingTransaction}
                onClose={() => setEditingTransaction(null)}
                expenseCategories={expenseCategories}
                incomeCategories={incomeCategories}
            />

            {/* Delete Confirmation */}
            <Dialog open={!!isDeleteDialogOpen} onOpenChange={() => setIsDeleteDialogOpen(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Transaction</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure you want to delete this transaction? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={async () => {
                            if (isDeleteDialogOpen) {
                                await deleteTransaction(isDeleteDialogOpen);
                                setIsDeleteDialogOpen(null);
                            }
                        }}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EditModal({ transaction, onClose, expenseCategories, incomeCategories }: {
    transaction: Transaction | null,
    onClose: () => void,
    expenseCategories: string[],
    incomeCategories: string[]
}) {
    const updateAction = updateTransaction.bind(null, transaction?.id || "");
    const [state, dispatch] = useActionState(updateAction, undefined);
    const [date, setDate] = useState<Date | undefined>(transaction?.date ? new Date(transaction.date) : undefined);
    const [type, setType] = useState(transaction?.type || "EXPENSE");

    // Sync state when transaction changes
    React.useEffect(() => {
        if (transaction) {
            setDate(new Date(transaction.date));
            setType(transaction.type);
        }
    }, [transaction]);

    React.useEffect(() => {
        if (state === "success") {
            onClose();
        }
    }, [state, onClose]);

    if (!transaction) return null;

    return (
        <Dialog open={!!transaction} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                </DialogHeader>
                <form action={dispatch} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Type</label>
                            <select
                                name="type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Amount</label>
                            <Input name="amount" type="number" step="0.01" defaultValue={transaction.amount} required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Category</label>
                        <select
                            name="category"
                            defaultValue={transaction.category}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            required
                        >
                            {(type === "INCOME" ? incomeCategories : expenseCategories).map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Description</label>
                        <Input name="description" defaultValue={transaction.description || ""} placeholder="Optional details..." />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Date</label>
                        <DatePicker date={date} setDate={setDate} />
                        <input type="hidden" name="date" value={date ? date.toISOString().split('T')[0] : ""} />
                    </div>

                    {state && state !== "success" && (
                        <div className="text-xs p-2 rounded bg-red-100 text-red-700">
                            {state}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
