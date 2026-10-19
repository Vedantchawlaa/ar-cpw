import Link from "next/link";
import { Clock, UserCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getDailyAttendance, getSalarySheet } from "@/lib/actions/staff-actions";
import { businessNow, isValidDateKey, monthKey, parseMonthKey } from "@/lib/staff-attendance";
import { DailyAttendanceBoard } from "@/components/staff/DailyAttendanceBoard";
import { SalarySheet } from "@/components/staff/SalarySheet";

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ date?: string; month?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
    const params = await searchParams;
    const today = businessNow().date;
    const date = params.date && isValidDateKey(params.date) && params.date <= today ? params.date : today;
    const { year, month } = parseMonthKey(params.month, date);

    const [rows, salaryRows] = await Promise.all([
        getDailyAttendance(date),
        getSalarySheet(year, month),
    ]);

    return (
        <div className="p-2 md:p-6 max-w-6xl mx-auto w-full space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Clock className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff Attendance</h1>
                        <p className="text-slate-500 text-sm">Punch in/out, leaves and monthly salary.</p>
                    </div>
                </div>
                <Link href="/staff">
                    <Button variant="outline" className="gap-2"><UserCog className="h-4 w-4" /> Manage staff</Button>
                </Link>
            </div>

            <DailyAttendanceBoard date={date} today={today} month={monthKey(year, month)} rows={rows} />
            <SalarySheet year={year} month={month} date={date} today={today} rows={salaryRows} />

            <p className="text-xs text-slate-500">
                Pay per day = monthly salary ÷ days in the month. In the joining month, salary counts only from the joining date to month end. <b>Leave</b> (asked by staff) deducts a full day and <b>Half day</b> deducts half.
                {" "}<b>Company leave</b> is paid. Unmarked days are not deducted.
                {" "}<b>OT</b> = time after shift end × OT rate (set per staff, or pay per day ÷ shift hours).
                {" "}Working on a <b>Sunday</b> earns an extra half day; unmarked Sundays are the weekly off.
                {" "}Total pay = salary − deduction + OT + Sunday extra + <b>bonus</b>; Balance = total pay − amounts <b>paid</b>.
            </p>
        </div>
    );
}
