import Link from "next/link";
import { ChevronLeft, ChevronRight, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { StaffMember } from "@/lib/actions/staff-actions";
import { PaymentDialog } from "./PaymentDialog";
import { formatMinutes, monthKey, shiftMonth, type SalarySummary } from "@/lib/staff-attendance";

export function formatRupees(amount: number) {
    return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

export function monthLabel(year: number, month: number) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

interface SalarySheetProps {
    year: number;
    month: number;
    date: string;
    today: string;
    rows: { staff: StaffMember; summary: SalarySummary; bonus: number; totalPay: number; paid: number; balance: number }[];
}

/** Balance due, or "advance" when more has been paid than earned. */
export function BalanceText({ balance }: { balance: number }) {
    if (balance > 0) return <span className="text-amber-700">{formatRupees(balance)}</span>;
    if (balance < 0) return <span className="text-blue-700" title="Paid more than earned">{formatRupees(-balance)} adv.</span>;
    return <span className="text-green-700">Settled</span>;
}

export function SalarySheet({ year, month, date, today, rows }: SalarySheetProps) {
    const prev = shiftMonth(year, month, -1);
    const next = shiftMonth(year, month, 1);
    const totals = rows.reduce(
        (acc, r) => ({
            salary: acc.salary + r.summary.baseSalary,
            deduction: acc.deduction + r.summary.deduction,
            otPay: acc.otPay + r.summary.otPay,
            sundayPay: acc.sundayPay + r.summary.sundayPay,
            bonus: acc.bonus + r.bonus,
            totalPay: acc.totalPay + r.totalPay,
            paid: acc.paid + r.paid,
            balance: acc.balance + r.balance,
        }),
        { salary: 0, deduction: 0, otPay: 0, sundayPay: 0, bonus: 0, totalPay: 0, paid: 0, balance: 0 }
    );
    const monthName = monthLabel(year, month);
    const monthParam = monthKey(year, month);

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50 border-b pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IndianRupee className="h-5 w-5 text-slate-500" /> Salary sheet
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Link href={`/staff?date=${date}&month=${monthKey(prev.year, prev.month)}`}>
                            <Button variant="ghost" size="icon" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                        </Link>
                        <span className="text-sm font-medium w-36 text-center">{monthName}</span>
                        <Link href={`/staff?date=${date}&month=${monthKey(next.year, next.month)}`}>
                            <Button variant="ghost" size="icon" aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <p className="p-8 text-center text-slate-500">No staff employed in this month.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50/60 text-slate-500 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="text-left font-medium px-4 py-3">Staff</th>
                                    <th className="text-right font-medium px-3 py-3">Salary</th>
                                    <th className="text-center font-medium px-3 py-3" title="Present">Present</th>
                                    <th className="text-center font-medium px-3 py-3" title="Half days">Half</th>
                                    <th className="text-center font-medium px-3 py-3" title="Leave asked by staff — deducted">Leave</th>
                                    <th className="text-center font-medium px-3 py-3" title="Company leave — paid">Co. leave</th>
                                    <th className="text-center font-medium px-3 py-3" title="Days so far with no entry — not deducted">Unmarked</th>
                                    <th className="text-right font-medium px-3 py-3">Deduction</th>
                                    <th className="text-right font-medium px-3 py-3" title="Overtime after shift end">OT</th>
                                    <th className="text-right font-medium px-3 py-3" title="Extra half day for each Sunday worked">Sunday</th>
                                    <th className="text-right font-medium px-3 py-3">Bonus</th>
                                    <th className="text-right font-medium px-3 py-3" title="Salary − deduction + OT + Sunday + bonus">Total pay</th>
                                    <th className="text-right font-medium px-3 py-3">Paid</th>
                                    <th className="text-right font-medium px-3 py-3">Balance</th>
                                    <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.map(({ staff, summary, bonus, totalPay, paid, balance }) => (
                                    <tr key={staff.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3">
                                            <Link href={`/staff/${staff.id}?month=${monthParam}`} className="font-medium text-slate-900 hover:underline">{staff.name}</Link>
                                            {!staff.active && <span className="ml-2 text-[11px] text-slate-400">(inactive)</span>}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                                            {formatRupees(summary.baseSalary)}
                                            {summary.payableDays < summary.daysInMonth && (
                                                <div className="text-[11px] text-slate-500" title={`Joined ${staff.joinedAt}; monthly salary ${formatRupees(staff.monthlySalary)}`}>
                                                    {summary.payableDays}/{summary.daysInMonth} days
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-center tabular-nums">{summary.present}</td>
                                        <td className="px-3 py-3 text-center tabular-nums">{summary.halfDays}</td>
                                        <td className="px-3 py-3 text-center tabular-nums text-red-600">{summary.leaves}</td>
                                        <td className="px-3 py-3 text-center tabular-nums text-blue-600">{summary.companyLeaves}</td>
                                        <td className="px-3 py-3 text-center tabular-nums text-slate-400">{summary.unmarked}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-red-600">{summary.deduction > 0 ? `− ${formatRupees(summary.deduction)}` : "—"}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-indigo-700 whitespace-nowrap">
                                            {summary.otMinutes > 0 ? (
                                                <>+ {formatRupees(summary.otPay)}<div className="text-[11px] text-slate-500">{formatMinutes(summary.otMinutes)}</div></>
                                            ) : "—"}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-teal-700 whitespace-nowrap">
                                            {summary.sundaysWorked > 0 ? (
                                                <>+ {formatRupees(summary.sundayPay)}<div className="text-[11px] text-slate-500">{summary.sundaysWorked} Sun</div></>
                                            ) : "—"}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-purple-700">{bonus > 0 ? `+ ${formatRupees(bonus)}` : "—"}</td>
                                        <td className="px-3 py-3 text-right tabular-nums font-semibold">{formatRupees(totalPay)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-green-700">{paid > 0 ? formatRupees(paid) : "—"}</td>
                                        <td className="px-3 py-3 text-right tabular-nums font-medium whitespace-nowrap"><BalanceText balance={balance} /></td>
                                        <td className="px-4 py-2">
                                            <div className="flex justify-end gap-2">
                                                <PaymentDialog type="PAYMENT" size="sm" staffId={staff.id} staffName={staff.name} year={year} month={month} monthName={monthName} balance={balance} today={today} />
                                                <PaymentDialog type="BONUS" size="sm" staffId={staff.id} staffName={staff.name} year={year} month={month} monthName={monthName} balance={balance} today={today} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 font-semibold">
                                <tr>
                                    <td className="px-4 py-3">Total</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{formatRupees(totals.salary)}</td>
                                    <td colSpan={5} />
                                    <td className="px-3 py-3 text-right tabular-nums text-red-600">{totals.deduction > 0 ? `− ${formatRupees(totals.deduction)}` : "—"}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-indigo-700">{totals.otPay > 0 ? `+ ${formatRupees(totals.otPay)}` : "—"}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-teal-700">{totals.sundayPay > 0 ? `+ ${formatRupees(totals.sundayPay)}` : "—"}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-purple-700">{totals.bonus > 0 ? `+ ${formatRupees(totals.bonus)}` : "—"}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{formatRupees(totals.totalPay)}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-green-700">{formatRupees(totals.paid)}</td>
                                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap"><BalanceText balance={Math.round(totals.balance * 100) / 100} /></td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
