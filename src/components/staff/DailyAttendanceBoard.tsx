"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { markCompanyLeaveForAll, type AttendanceRecord, type StaffMember } from "@/lib/actions/staff-actions";
import { AttendanceRow, attendanceRowKey } from "./AttendanceRow";

interface DailyAttendanceBoardProps {
    date: string;
    today: string;
    month: string;
    rows: { staff: StaffMember; record: AttendanceRecord | null }[];
}

export function DailyAttendanceBoard({ date, today, month, rows }: DailyAttendanceBoardProps) {
    const router = useRouter();
    const [holidayOpen, setHolidayOpen] = useState(false);
    const [holidayNote, setHolidayNote] = useState("");
    const [saving, setSaving] = useState(false);

    const marked = rows.filter(r => r.record).length;
    const present = rows.filter(r => r.record?.status === "PRESENT" || r.record?.status === "HALF_DAY").length;

    const changeDate = (value: string) => {
        if (value) router.push(`/staff?date=${value}&month=${month}`);
    };

    const handleCompanyLeave = async () => {
        setSaving(true);
        const result = await markCompanyLeaveForAll(date, holidayNote);
        setSaving(false);
        if (result.success) {
            toast.success(`Company leave marked for ${result.count} staff`);
            setHolidayOpen(false);
            setHolidayNote("");
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50 border-b pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CalendarCheck className="h-5 w-5 text-slate-500" /> Daily attendance
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                            {marked}/{rows.length} marked · {present} present
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Input type="date" value={date} max={today} onChange={e => changeDate(e.target.value)} className="w-auto" aria-label="Attendance date" />
                        {date !== today && <Button variant="outline" onClick={() => changeDate(today)}>Today</Button>}
                        <Button variant="outline" onClick={() => setHolidayOpen(true)} disabled={rows.length === 0}>
                            Company leave for all
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <Users className="h-10 w-10 mb-3 text-slate-300" />
                        <p>No active staff on this date. Add staff to start tracking attendance.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {rows.map(({ staff, record }) => (
                            <AttendanceRow
                                key={attendanceRowKey(staff.id, record)}
                                staffId={staff.id}
                                date={date}
                                record={record}
                                shiftStart={staff.shiftStart}
                                shiftEnd={staff.shiftEnd}
                                allowPunchNow={date === today}
                                title={<Link href={`/staff/${staff.id}?month=${month}`} className="hover:underline">{staff.name}</Link>}
                                subtitle={`${staff.designation ? `${staff.designation} · ` : ""}Shift ${staff.shiftStart}–${staff.shiftEnd}`}
                            />
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Company leave on {date}</DialogTitle>
                        <DialogDescription>
                            Marks a paid company leave for all {rows.length} active staff. No salary is deducted. Existing entries for this day are replaced.
                        </DialogDescription>
                    </DialogHeader>
                    <Input value={holidayNote} onChange={e => setHolidayNote(e.target.value)} placeholder="Reason, e.g. Diwali or Sunday" maxLength={200} />
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setHolidayOpen(false)}>Cancel</Button>
                        <Button onClick={handleCompanyLeave} disabled={saving}>{saving ? "Saving..." : "Mark company leave"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
