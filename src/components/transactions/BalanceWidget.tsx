"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { Wallet, TrendingDown, AlertTriangle, CheckCircle2, Pencil, Save, X } from "lucide-react";
import { upsertMonthlyBalance } from "@/lib/actions/balance-actions";
import { formatCurrency } from "@/lib/utils";

interface BalanceWidgetProps {
    month: number;
    year: number;
    income: number;
    expenses: number;
    initialStarting: number;
    initialEnding: number | null;
    carriedForward?: boolean;
}

export function BalanceWidget({
    month,
    year,
    income,
    expenses,
    initialStarting,
    initialEnding,
    carriedForward = false,
}: BalanceWidgetProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [startingBalance, setStartingBalance] = useState(initialStarting);
    const [endingBalance, setEndingBalance] = useState<number | null>(initialEnding);
    const [startingInput, setStartingInput] = useState(String(initialStarting));
    const [endingInput, setEndingInput] = useState(initialEnding !== null ? String(initialEnding) : "");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const expectedBalance = startingBalance + income - expenses;
    const endingSet = endingBalance !== null;
    const missing = endingSet ? expectedBalance - endingBalance : null;
    const isBalanced = missing !== null && Math.abs(missing) < 0.01;

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    function handleEdit() {
        setStartingInput(String(startingBalance));
        setEndingInput(endingBalance !== null ? String(endingBalance) : "");
        setIsEditing(true);
        setError(null);
    }

    function handleCancel() {
        setIsEditing(false);
        setError(null);
    }

    function handleSave() {
        const newStarting = parseFloat(startingInput);
        const newEnding = endingInput.trim() !== "" ? parseFloat(endingInput) : null;

        if (isNaN(newStarting) || newStarting < 0) {
            setError("Starting balance must be a valid positive number.");
            return;
        }
        if (newEnding !== null && isNaN(newEnding)) {
            setError("Ending balance must be a valid number.");
            return;
        }

        startTransition(async () => {
            const result = await upsertMonthlyBalance(month, year, newStarting, newEnding);
            if (result.success) {
                setStartingBalance(newStarting);
                setEndingBalance(newEnding);
                setIsEditing(false);
                setError(null);
            } else {
                setError(result.error || "Failed to save.");
            }
        });
    }

    return (
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                    <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Cash Reconciliation
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{monthNames[month]} {year}</p>
                </div>
                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <button
                            onClick={handleEdit}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Edit balances"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <div className="flex gap-1">
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Cancel"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isPending}
                                className="h-7 px-2 flex items-center gap-1 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
                                title="Save balances"
                            >
                                <Save className="h-3 w-3" />
                                {isPending ? "Saving..." : "Save"}
                            </button>
                        </div>
                    )}
                    <Wallet className="h-4 w-4 text-amber-600" />
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Starting Balance */}
                <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-slate-600 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                            Opening Balance
                        </span>
                        {carriedForward && !isEditing && (
                            <span className="text-[10px] text-amber-600 font-semibold ml-3.5 bg-amber-50 px-1.5 py-0.5 rounded">
                                ↩ carried from last month
                            </span>
                        )}
                    </span>
                    {isEditing ? (
                        <Input
                            type="number"
                            value={startingInput}
                            onChange={(e) => setStartingInput(e.target.value)}
                            className="h-7 w-32 text-right text-sm"
                            placeholder="0"
                            min={0}
                            step={0.01}
                        />
                    ) : (
                        <span className="font-semibold text-sm text-slate-700">
                            ₹{formatCurrency(startingBalance)}
                        </span>
                    )}
                </div>

                {/* Income */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                        + Recorded Income
                    </span>
                    <span className="font-semibold text-sm text-green-600">₹{formatCurrency(income)}</span>
                </div>

                {/* Expenses */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                        − Recorded Expenses
                    </span>
                    <span className="font-semibold text-sm text-red-600">₹{formatCurrency(expenses)}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-200 pt-2 mt-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Expected Cash</span>
                        <span className="font-bold text-sm text-slate-800">₹{formatCurrency(expectedBalance)}</span>
                    </div>

                    {/* Ending Balance */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Actual Cash in Hand</span>
                        {isEditing ? (
                            <Input
                                type="number"
                                value={endingInput}
                                onChange={(e) => setEndingInput(e.target.value)}
                                className="h-7 w-32 text-right text-sm"
                                placeholder="Enter amount"
                                step={0.01}
                            />
                        ) : endingSet ? (
                            <span className="font-bold text-sm text-slate-800">₹{formatCurrency(endingBalance!)}</span>
                        ) : (
                            <span className="text-xs italic text-muted-foreground">Not set — click ✏️</span>
                        )}
                    </div>
                </div>

                {/* Missing Amount Result */}
                {missing !== null && (
                    <div className={`mt-2 rounded-lg px-3 py-2.5 flex items-center gap-2 ${isBalanced
                        ? "bg-green-50 border border-green-200"
                        : missing > 0
                            ? "bg-red-50 border border-red-200"
                            : "bg-blue-50 border border-blue-200"
                        }`}>
                        {isBalanced ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <div>
                            {isBalanced ? (
                                <p className="text-xs font-bold text-green-700">Perfectly Balanced! 🎉</p>
                            ) : missing > 0 ? (
                                <>
                                    <p className="text-xs font-bold text-red-700">₹{formatCurrency(missing)} unaccounted</p>
                                    <p className="text-[10px] text-red-500 mt-0.5">Cash is less than expected — some income may be missing</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-blue-700">₹{formatCurrency(Math.abs(missing))} surplus</p>
                                    <p className="text-[10px] text-blue-500 mt-0.5">More cash than recorded — some expense may be missing</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
                )}

                {/* Hint when no ending balance */}
                {!endingSet && !isEditing && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                        Set "Actual Cash in Hand" at month end to see missing amount
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
