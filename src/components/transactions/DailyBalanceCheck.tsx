"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Landmark, Wallet, CheckCircle2, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { saveDailyBalanceCheck, type BalanceCheckRow } from "@/lib/actions/bank-balance-actions";
import { formatCurrency } from "@/lib/utils";

const dayLabel = (day: string, withYear = true) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });

const money = (n: number) => `${n < 0 ? "−" : ""}₹${formatCurrency(Math.abs(n))}`;

export function DailyBalanceCheck({ today, history }: { today: BalanceCheckRow | null; history: BalanceCheckRow[] }) {
    const router = useRouter();
    const [editing, setEditing] = useState(!today);
    const [bankInput, setBankInput] = useState(today ? String(today.bankBalance) : "");
    const [cashInput, setCashInput] = useState(today ? String(today.cashBalance) : "");
    const [notes, setNotes] = useState(today?.notes ?? "");
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [isPending, startTransition] = useTransition();

    const showForm = editing || !today;

    function handleSave() {
        const bank = parseFloat(bankInput);
        const cash = parseFloat(cashInput) || 0;
        if (isNaN(bank) || bank < 0 || cash < 0) {
            setError("Please enter a valid bank balance.");
            return;
        }
        setError(null);
        startTransition(async () => {
            const result = await saveDailyBalanceCheck(bank, cash, notes || undefined);
            if (result.success) {
                setEditing(false);
                router.refresh(); // reloads today's entry and the history from the server
            } else {
                setError(result.error || "Failed to save.");
            }
        });
    }

    return (
        <div className="space-y-4">
            <Card className={`border-2 shadow-md ${showForm ? "border-blue-400 bg-blue-50/50" : "border-green-400 bg-green-50/50"}`}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Landmark className={`h-5 w-5 ${showForm ? "text-blue-600" : "text-green-600"}`} />
                        <span className={showForm ? "text-blue-800" : "text-green-800"}>
                            {showForm ? (today ? "Update Today's Balances" : "🔔 Daily Check — Enter Balances") : "Today's Balance Recorded ✓"}
                        </span>
                    </CardTitle>
                    {showForm && (
                        <p className="text-xs text-slate-500 mt-0.5">Enter today&apos;s bank + cash balances to track the daily gap.</p>
                    )}
                </CardHeader>

                <CardContent className="space-y-3">
                    {!showForm && today ? (
                        <div className="space-y-2">
                            <Row icon={<Landmark className="h-3.5 w-3.5 text-slate-400" />} label="Bank" value={`₹${formatCurrency(today.bankBalance)}`} />
                            <Row icon={<Wallet className="h-3.5 w-3.5 text-slate-400" />} label="Cash" value={`₹${formatCurrency(today.cashBalance)}`} />
                            <div className="flex justify-between text-sm border-t pt-2">
                                <span className="text-slate-600 font-medium">Total</span>
                                <span className="font-bold text-slate-900">₹{formatCurrency(today.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Recorded net {today.previousDay ? `since ${dayLabel(today.previousDay, false)}` : "(today)"}</span>
                                <span className={`font-semibold ${today.recordedNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {today.recordedNet >= 0 ? "+" : ""}{money(today.recordedNet)}
                                </span>
                            </div>
                            {today.gap !== null && <GapLine gap={today.gap} />}
                            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Update balances</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <MoneyInput label="Bank Balance" icon={<Landmark className="h-3 w-3" />} value={bankInput} onChange={setBankInput} />
                            <MoneyInput label="Cash in Hand" icon={<Wallet className="h-3 w-3" />} value={cashInput} onChange={setCashInput} />
                            {(bankInput || cashInput) && (
                                <div className="flex justify-between text-sm bg-slate-50 rounded px-3 py-2 border">
                                    <span className="text-slate-600 font-medium">Total</span>
                                    <span className="font-bold text-slate-800">₹{formatCurrency((parseFloat(bankInput) || 0) + (parseFloat(cashInput) || 0))}</span>
                                </div>
                            )}
                            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-sm" />
                            {error && <p className="text-xs text-red-600">{error}</p>}
                            <div className="flex gap-2">
                                {today && (
                                    <button onClick={() => setEditing(false)} disabled={isPending} className="flex-1 py-2 rounded-md border text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={isPending}
                                    className="flex-1 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                                >
                                    {isPending ? "Saving..." : "Save Today's Balance"}
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {history.length > 0 && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <button className="flex items-center justify-between w-full" onClick={() => setShowHistory(!showHistory)}>
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Landmark className="h-4 w-4 text-slate-400" />
                                Daily Gap History
                            </CardTitle>
                            {showHistory ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                    </CardHeader>
                    {showHistory && (
                        <CardContent className="space-y-2 pt-0">
                            {history.map((entry) => (
                                <div key={entry.id} className="py-2 border-b border-slate-100 last:border-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 truncate">{dayLabel(entry.day)}</p>
                                            <div className="flex gap-3 mt-0.5">
                                                <p className="text-[10px] text-slate-500"><Landmark className="h-2.5 w-2.5 inline mr-0.5" />₹{formatCurrency(entry.bankBalance)}</p>
                                                <p className="text-[10px] text-slate-500"><Wallet className="h-2.5 w-2.5 inline mr-0.5" />₹{formatCurrency(entry.cashBalance)}</p>
                                            </div>
                                            {entry.previousDay && (
                                                <p className="text-[10px] text-slate-400">Recorded net since {dayLabel(entry.previousDay, false)}: {entry.recordedNet >= 0 ? "+" : ""}{money(entry.recordedNet)}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-slate-800">₹{formatCurrency(entry.total)}</p>
                                            {entry.gap !== null && <GapLine gap={entry.gap} small />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <p className="text-[10px] text-muted-foreground text-center pt-1">
                                Gap = (Bank+Cash change since the previous check) − Recorded net. Negative = unrecorded expenses.
                            </p>
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-1.5">{icon} {label}</span>
            <span className="font-bold text-slate-800">{value}</span>
        </div>
    );
}

function MoneyInput({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">{icon} {label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" className="pl-7" min={0} step={0.01} />
            </div>
        </div>
    );
}

function GapLine({ gap, small }: { gap: number; small?: boolean }) {
    const size = small ? "text-[10px]" : "text-sm";
    if (Math.abs(gap) < 1) return <p className={`${size} font-semibold flex items-center justify-end gap-0.5 text-green-600`}><CheckCircle2 className="h-3 w-3" /> balanced</p>;
    if (gap > 0) return <p className={`${size} font-semibold flex items-center justify-end gap-0.5 text-blue-600`}><TrendingUp className="h-3 w-3" /> +₹{formatCurrency(gap)} surplus</p>;
    return <p className={`${size} font-semibold flex items-center justify-end gap-0.5 text-red-600`}><TrendingDown className="h-3 w-3" /> −₹{formatCurrency(-gap)} gap</p>;
}
