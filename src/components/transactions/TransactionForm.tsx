"use client";

import { useActionState, useRef, useState } from "react";
// @ts-ignore
import { Plus, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { addTransaction } from "@/lib/actions/transaction-actions";
import { DatePicker } from "@/components/ui/DatePicker";

export function TransactionForm() {
    const [state, dispatch] = useActionState(addTransaction, undefined);
    const formRef = useRef<HTMLFormElement>(null);
    const [type, setType] = useState("EXPENSE");
    const [date, setDate] = useState<Date | undefined>(new Date());

    const expenseCategories = [
        "Food",
        "Salary",
        "Vehicle maintenance & Fuel",
        "Utilities",
        "Other",
        "Rent",
        "Fabric Purchase",
        "Accessory Purchase",
        "Advertisement"
    ];

    const incomeCategories = [
        "Sales",
        "Car Income",
        "EXTRA"
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    New Transaction
                </CardTitle>
                <CardDescription>Record income or expense.</CardDescription>
            </CardHeader>
            <form action={dispatch} ref={formRef} onSubmit={() => setTimeout(() => formRef.current?.reset(), 1000)}>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <select
                                name="type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Amount</label>
                            <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <select
                            name="category"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            required
                        >
                            <option value="">Select Category</option>
                            {(type === "INCOME" ? incomeCategories : expenseCategories).map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Input name="description" placeholder="Optional details..." />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Date</label>
                        <DatePicker date={date} setDate={setDate} />
                        <input type="hidden" name="date" value={date ? date.toISOString().split('T')[0] : ""} />
                    </div>

                    {state && (
                        <div className={`text-sm p-2 rounded ${state === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {state === "success" ? "Transaction added!" : state}
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full">
                        <Plus className="mr-2 h-4 w-4" /> Add Transaction
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
