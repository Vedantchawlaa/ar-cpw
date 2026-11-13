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
import { markCompanyLeaveForAll, markPresent, type AttendanceRecord, type StaffMember } from "@/lib/actions/staff-actions";
import { isSunday } from "@/lib/staff-attendance";
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
    const [ticked, setTicked] = useState<Set<string>>(new Set());

    const marked = rows.filter(r => r.record).length;
    // Not marked counts as present (except on Sunday, the weekly off)
    const present = rows.filter(r => r.record ? r.record.status === "PRESENT" || r.record.status === "HALF_DAY" : !isSunday(date)).length;
    const unmarkedIds = rows.filter(r => !r.record).map(r => r.staff.id);
    // Ticks on anyone already saved as present have nothing left to save.
    const tickedIds = rows.filter(r => ticked.has(r.staff.id) && r.record?.status !== "PRESENT").map(r => r.staff.id);

    const changeDate = (value: string) => {
        if (value) router.push(`/attendance?date=${value}&month=${month}`);
    };

    const handleCompanyLeave = async () => {
        setSaving(true);
        const result = await markCompanyLeaveForAll(date, holidayNote);
        setSaving(false);
        if (result.success) {
            toast.success(`Company leave marked for ${result.count} staff`);
            setHolidayOpen(false);
            setHolidayNote("");
            setTicked(new Set());
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    const toggleTick = (staffId: string, checked: boolean) => {
        const next = new Set(ticked);
        if (checked) next.add(staffId);
        else next.delete(staffId);
        setTicked(next);
    };

    const handleSavePresent = async () => {
        if (isSunday(date) && !confirm(`${date} is a Sunday. Each person marked present earns the extra half day. Continue?`)) return;
        setSaving(true);
        const result = await markPresent(tickedIds, date);
        setSaving(false);
        if (result.success) {
            toast.success(`Marked ${result.count} staff present`);
            setTicked(new Set());
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
                        <Button variant="outline" onClick={() => setTicked(new Set([...ticked, ...unmarkedIds]))} disabled={unmarkedIds.length === 0}>
                            All present
                        </Button>
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
                        <p>No active staff on this date. <Link href="/staff" className="underline">Add staff</Link> to start tracking attendance.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {tickedIds.length > 0 && (
                            <div className="flex items-center justify-between gap-3 bg-green-50 px-4 py-2">
                                <span className="text-sm text-green-800">{tickedIds.length} ticked as present, not saved yet</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setTicked(new Set())} disabled={saving}>Clear</Button>
                                    <Button size="sm" onClick={handleSavePresent} disabled={saving}>{saving ? "Saving..." : `Save ${tickedIds.length} present`}</Button>
                                </div>
                            </div>
                        )}
                        {rows.map(({ staff, record }) => (
                            <div key={staff.id} className="flex items-start lg:items-center">
                                <input
                                    type="checkbox"
                                    checked={record?.status === "PRESENT" || ticked.has(staff.id)}
                                    disabled={record?.status === "PRESENT"}
                                    onChange={e => toggleTick(staff.id, e.target.checked)}
                                    aria-label={`Mark ${staff.name} present`}
                                    className="ml-4 mt-5 lg:mt-0 h-5 w-5 shrink-0 accent-green-600"
                                />
                                <div className="flex-1 min-w-0">
                                    <AttendanceRow
                                        key={attendanceRowKey(staff.id, record)}
                                        staffId={staff.id}
                                        date={date}
                                        record={record}
                                        shiftStart={staff.shiftStart}
                                        shiftEnd={staff.shiftEnd}
                                        allowPunchNow={date === today}
                                        title={<Link href={`/attendance/${staff.id}?month=${month}`} className="hover:underline">{staff.name}</Link>}
                                        subtitle={`${staff.designation ? `${staff.designation} · ` : ""}Shift ${staff.shiftStart}–${staff.shiftEnd}`}
                                    />
                                </div>
                            </div>
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
