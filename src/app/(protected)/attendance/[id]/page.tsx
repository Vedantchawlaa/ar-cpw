import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getStaffMonth } from "@/lib/actions/staff-actions";
import { businessNow, formatMinutes, monthDateKeys, monthKey, parseMonthKey, shiftMonth } from "@/lib/staff-attendance";
import { AttendanceRow, attendanceRowKey } from "@/components/staff/AttendanceRow";
import { StaffFormDialog } from "@/components/staff/StaffFormDialog";
import { StaffActiveToggle } from "@/components/staff/StaffActiveToggle";
import { BalanceText, formatRupees, monthLabel } from "@/components/staff/SalarySheet";
import { PaymentDialog } from "@/components/staff/PaymentDialog";
import { PaymentList } from "@/components/staff/PaymentList";

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ month?: string }>;
}

export default async function StaffDetailPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const today = businessNow().date;
    const { year, month } = parseMonthKey((await searchParams).month, today);

    const data = await getStaffMonth(id, year, month);
    if (!data) notFound();
    const { staff, records, summary, payments, bonus, totalPay, paid, balance } = data;
    const monthName = monthLabel(year, month);

    const byDate = new Map(records.map(r => [r.date, r]));
    // Newest first, only days the person was employed and that have happened.
    const days = monthDateKeys(year, month).filter(d => d >= staff.joinedAt && d <= today).reverse();
    const prev = shiftMonth(year, month, -1);
    const next = shiftMonth(year, month, 1);

    const stats = [
        { label: "Present", value: summary.present },
        { label: "Half days", value: summary.halfDays },
        { label: "Leave (deducted)", value: summary.leaves, className: "text-red-600" },
        { label: "Company leave", value: summary.companyLeaves, className: "text-blue-600" },
        { label: "Unmarked", value: summary.unmarked, className: "text-slate-400" },
        { label: "Hours worked", value: formatMinutes(summary.workedMinutes) },
        { label: "Overtime", value: formatMinutes(summary.otMinutes), className: "text-indigo-700" },
        { label: "Sundays worked", value: summary.sundaysWorked, className: "text-teal-700" },
    ];

    return (
        <div className="p-2 md:p-6 max-w-6xl mx-auto w-full space-y-6">
            <Link href={`/attendance?month=${monthKey(year, month)}`}>
                <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-slate-900 -ml-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Attendance
                </Button>
            </Link>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        {staff.name}
                        {!staff.active && <span className="ml-3 align-middle text-sm font-medium text-slate-400">Inactive</span>}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {[staff.designation, staff.phone, `Shift ${staff.shiftStart}–${staff.shiftEnd}`, staff.otRatePerHour != null && `OT ${formatRupees(staff.otRatePerHour)}/h`, `Joined ${staff.joinedAt}`].filter(Boolean).join(" · ")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <StaffFormDialog staff={staff} defaultJoinedAt={today} />
                    <StaffActiveToggle staffId={staff.id} active={staff.active} />
                </div>
            </div>

            <div className="flex items-center gap-1">
                <Link href={`/attendance/${id}?month=${monthKey(prev.year, prev.month)}`}>
                    <Button variant="ghost" size="icon" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
                <span className="text-lg font-semibold w-44 text-center">{monthName}</span>
                <Link href={`/attendance/${id}?month=${monthKey(next.year, next.month)}`}>
                    <Button variant="ghost" size="icon" aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr]">
                <Card>
                    <CardContent className="p-5 space-y-2 text-sm">
                        <Row label="Monthly salary" value={formatRupees(staff.monthlySalary)} />
                        {summary.payableDays < summary.daysInMonth && (
                            <Row label={`Salary for ${summary.payableDays} of ${summary.daysInMonth} days (joined ${staff.joinedAt})`}
                                value={formatRupees(summary.baseSalary)} className="font-medium" />
                        )}
                        <Row label={`Per day (÷ ${summary.daysInMonth})`} value={formatRupees(summary.perDay)} />
                        <Row label={`Deduction (${summary.deductedDays} days)`} value={summary.deduction > 0 ? `− ${formatRupees(summary.deduction)}` : "—"} className="text-red-600" />
                        <Row label={`OT ${formatMinutes(summary.otMinutes)} × ${formatRupees(summary.otRatePerHour)}/h${staff.otRatePerHour == null ? " (auto)" : ""}`}
                            value={summary.otPay > 0 ? `+ ${formatRupees(summary.otPay)}` : "—"} className="text-indigo-700" />
                        <Row label={`Sunday extra (${summary.sundaysWorked} × ½ day)`}
                            value={summary.sundayPay > 0 ? `+ ${formatRupees(summary.sundayPay)}` : "—"} className="text-teal-700" />
                        <Row label="Bonus" value={bonus > 0 ? `+ ${formatRupees(bonus)}` : "—"} className="text-purple-700" />
                        <div className="border-t pt-2">
                            <Row label="Total pay" value={formatRupees(totalPay)} className="text-base font-bold" />
                        </div>
                        <Row label="Paid" value={paid > 0 ? `− ${formatRupees(paid)}` : "—"} className="text-green-700" />
                        <div className="border-t pt-2 flex justify-between gap-4 text-base font-bold">
                            <span className="text-slate-500 font-normal">Balance</span>
                            <span className="tabular-nums"><BalanceText balance={balance} /></span>
                        </div>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {stats.map(s => (
                        <Card key={s.label}>
                            <CardContent className="p-4">
                                <div className={`text-2xl font-bold tabular-nums ${s.className ?? ""}`}>{s.value}</div>
                                <div className="text-xs text-slate-500">{s.label}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-3 px-5 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
                    <CardTitle className="text-base">Payments &amp; bonus</CardTitle>
                    <div className="flex gap-2">
                        <PaymentDialog type="PAYMENT" size="sm" staffId={staff.id} staffName={staff.name} year={year} month={month} monthName={monthName} balance={balance} today={today} />
                        <PaymentDialog type="BONUS" size="sm" staffId={staff.id} staffName={staff.name} year={year} month={month} monthName={monthName} balance={balance} today={today} />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <PaymentList payments={payments} />
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    {days.length === 0 ? (
                        <p className="p-8 text-center text-slate-500">No days to show for this month.</p>
                    ) : (
                        <div className="divide-y">
                            {days.map(d => {
                                const record = byDate.get(d) ?? null;
                                const label = new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
                                return (
                                    <AttendanceRow
                                        key={attendanceRowKey(d, record)}
                                        staffId={staff.id}
                                        date={d}
                                        record={record}
                                        shiftStart={staff.shiftStart}
                                        shiftEnd={staff.shiftEnd}
                                        allowPunchNow={d === today}
                                        title={label}
                                        subtitle={d === today ? "Today" : undefined}
                                    />
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={`flex justify-between gap-4 ${className ?? ""}`}>
            <span className="text-slate-500 font-normal">{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    );
}
