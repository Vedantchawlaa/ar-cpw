"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
// @ts-ignore
import { Landmark, Wallet, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { saveWeeklyBankBalance } from "@/lib/actions/bank-balance-actions";
import { formatCurrency } from "@/lib/utils";

interface WeekEntry {
    id: string;
    weekStart: string;
    bankBalance: number;
    cashBalance: number;
    recordedNet: number;
}

interface MondayBankPromptProps {
    isMonday: boolean;
    thisWeekEntry: WeekEntry | null;
    history: WeekEntry[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatWeek(iso: string) {
    const d = new Date(iso);
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} – ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

export function MondayBankPrompt({ isMonday, thisWeekEntry, history }: MondayBankPromptProps) {
    const [bankInput, setBankInput] = useState(thisWeekEntry ? String(thisWeekEntry.bankBalance) : "");
    const [cashInput, setCashInput] = useState(thisWeekEntry ? String(thisWeekEntry.cashBalance) : "");
    const [notes, setNotes] = useState("");
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(!!thisWeekEntry);
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [latestEntry, setLatestEntry] = useState<WeekEntry | null>(thisWeekEntry);

    const showPrompt = isMonday || !thisWeekEntry;

    function handleSave() {
        const bank = parseFloat(bankInput);
        const cash = parseFloat(cashInput) || 0;
        if (isNaN(bank) || bank < 0) {
            setError("Please enter a valid bank balance.");
            return;
        }
        setError(null);
        startTransition(async () => {
            const result = await saveWeeklyBankBalance(bank, cash, notes || undefined);
            if (result.success) {
                setSaved(true);
                setLatestEntry({
                    id: "new",
                    weekStart: new Date().toISOString(),
                    bankBalance: bank,
                    cashBalance: cash,
                    recordedNet: result.recordedNet ?? 0,
                });
            } else {
                setError(result.error || "Failed to save.");
            }
        });
    }

    function computeGap(entries: WeekEntry[], idx: number) {
        const cur = entries[idx];
        const prev = entries[idx + 1];
        if (!prev) return null;
        const curTotal = cur.bankBalance + cur.cashBalance;
        const prevTotal = prev.bankBalance + prev.cashBalance;
        const expected = prevTotal + cur.recordedNet;
        return curTotal - expected;
    }

    const allEntries = latestEntry && !history.find(h => h.id === latestEntry.id)
        ? [latestEntry, ...history]
        : history;

    return (
        <div className="space-y-4">
            {/* Prompt Banner */}
            {showPrompt && (
                <Card className={`border-2 shadow-md ${saved ? "border-green-400 bg-green-50/50" : "border-blue-400 bg-blue-50/50"}`}>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Landmark className={`h-5 w-5 ${saved ? "text-green-600" : "text-blue-600"}`} />
                            <span className={saved ? "text-green-800" : "text-blue-800"}>
                                {saved ? "Weekly Balance Recorded ✓" : isMonday ? "🔔 Monday Check — Enter Balances" : "⚠️ This Week's Balance Missing"}
                            </span>
                        </CardTitle>
                        {!saved && (
                            <p className="text-xs text-slate-500 mt-0.5">
                                Enter your bank + cash balances to track the weekly gap.
                            </p>
                        )}
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {saved && latestEntry ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-1.5">
                                        <Landmark className="h-3.5 w-3.5 text-slate-400" /> Bank
                                    </span>
                                    <span className="font-bold text-slate-800">₹{formatCurrency(latestEntry.bankBalance)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-1.5">
                                        <Wallet className="h-3.5 w-3.5 text-slate-400" /> Cash
                                    </span>
                                    <span className="font-bold text-slate-800">₹{formatCurrency(latestEntry.cashBalance)}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t pt-2">
                                    <span className="text-slate-600 font-medium">Total</span>
                                    <span className="font-bold text-slate-900">₹{formatCurrency(latestEntry.bankBalance + latestEntry.cashBalance)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Recorded Net (week)</span>
                                    <span className={`font-semibold ${latestEntry.recordedNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {latestEntry.recordedNet >= 0 ? "+" : ""}₹{formatCurrency(Math.abs(latestEntry.recordedNet))}
                                    </span>
                                </div>
                                <button
                                    onClick={() => { setSaved(false); setBankInput(String(latestEntry.bankBalance)); setCashInput(String(latestEntry.cashBalance)); }}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    Update balances
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Bank Balance */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                        <Landmark className="h-3 w-3" /> Bank Balance
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                                        <Input
                                            type="number"
                                            value={bankInput}
                                            onChange={(e) => setBankInput(e.target.value)}
                                            placeholder="0"
                                            className="pl-7"
                                            min={0}
                                            step={0.01}
                                        />
                                    </div>
                                </div>

                                {/* Cash Balance */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                        <Wallet className="h-3 w-3" /> Cash in Hand
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                                        <Input
                                            type="number"
                                            value={cashInput}
                                            onChange={(e) => setCashInput(e.target.value)}
                                            placeholder="0"
                                            className="pl-7"
                                            min={0}
                                            step={0.01}
                                        />
                                    </div>
                                </div>

                                {/* Total preview */}
                                {(bankInput || cashInput) && (
                                    <div className="flex justify-between text-sm bg-slate-50 rounded px-3 py-2 border">
                                        <span className="text-slate-600 font-medium">Total</span>
                                        <span className="font-bold text-slate-800">
                                            ₹{formatCurrency((parseFloat(bankInput) || 0) + (parseFloat(cashInput) || 0))}
                                        </span>
                                    </div>
                                )}

                                <Input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notes (optional)"
                                    className="text-sm"
                                />

                                {error && <p className="text-xs text-red-600">{error}</p>}

                                <button
                                    onClick={handleSave}
                                    disabled={isPending}
                                    className="w-full py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                                >
                                    {isPending ? "Saving..." : "Save Weekly Balance"}
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* History */}
            {allEntries.length > 0 && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <button
                            className="flex items-center justify-between w-full"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Landmark className="h-4 w-4 text-slate-400" />
                                Weekly Gap History
                            </CardTitle>
                            {showHistory ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                    </CardHeader>

                    {showHistory && (
                        <CardContent className="space-y-2 pt-0">
                            {allEntries.map((entry, idx) => {
                                const gap = computeGap(allEntries, idx);
                                const absGap = gap !== null ? Math.abs(gap) : null;
                                const gapNeutral = gap !== null && Math.abs(gap) < 1;
                                const gapPositive = gap !== null && gap > 0;
                                const total = entry.bankBalance + entry.cashBalance;

                                return (
                                    <div key={entry.id + idx} className="py-2 border-b border-slate-100 last:border-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-slate-700 truncate">{formatWeek(entry.weekStart)}</p>
                                                <div className="flex gap-3 mt-0.5">
                                                    <p className="text-[10px] text-slate-500">
                                                        <Landmark className="h-2.5 w-2.5 inline mr-0.5" />₹{formatCurrency(entry.bankBalance)}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        <Wallet className="h-2.5 w-2.5 inline mr-0.5" />₹{formatCurrency(entry.cashBalance)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-slate-800">₹{formatCurrency(total)}</p>
                                                {gap !== null && (
                                                    <p className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${gapNeutral ? "text-green-600" : gapPositive ? "text-blue-600" : "text-red-600"}`}>
                                                        {gapNeutral
                                                            ? <><CheckCircle2 className="h-3 w-3" /> balanced</>
                                                            : gapPositive
                                                                ? <><TrendingUp className="h-3 w-3" /> +₹{formatCurrency(absGap!)} surplus</>
                                                                : <><TrendingDown className="h-3 w-3" /> −₹{formatCurrency(absGap!)} gap</>
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <p className="text-[10px] text-muted-foreground text-center pt-1">
                                Gap = (Bank+Cash change) − Recorded net. Negative = unrecorded expenses.
                            </p>
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}
