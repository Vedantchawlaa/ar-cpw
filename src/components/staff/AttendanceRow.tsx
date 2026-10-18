"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { clearAttendance, punchNow, saveAttendance, type AttendanceRecord } from "@/lib/actions/staff-actions";
import { ATTENDANCE_STATUSES, STATUS_LABELS, formatMinutes, lateMinutes, workedMinutes, type AttendanceStatus } from "@/lib/staff-attendance";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
    PRESENT: "bg-green-50 text-green-700 border-green-200",
    HALF_DAY: "bg-amber-50 text-amber-700 border-amber-200",
    LEAVE: "bg-red-50 text-red-700 border-red-200",
    COMPANY_LEAVE: "bg-blue-50 text-blue-700 border-blue-200",
};

/** Remounts the row when the saved record changes, so its form fields reset to the new values. */
export function attendanceRowKey(staffId: string, record: AttendanceRecord | null) {
    return [staffId, record?.date, record?.status, record?.punchIn, record?.punchOut, record?.note].join("|");
}

interface AttendanceRowProps {
    staffId: string;
    date: string;
    record: AttendanceRecord | null;
    shiftStart: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Show the one-tap "punch now" buttons (today only). */
    allowPunchNow?: boolean;
}

export function AttendanceRow({ staffId, date, record, shiftStart, title, subtitle, allowPunchNow }: AttendanceRowProps) {
    const router = useRouter();
    const [status, setStatus] = useState<string>(record?.status ?? "");
    const [punchIn, setPunchIn] = useState(record?.punchIn ?? "");
    const [punchOut, setPunchOut] = useState(record?.punchOut ?? "");
    const [note, setNote] = useState(record?.note ?? "");
    const [busy, setBusy] = useState(false);

    const onLeave = status === "LEAVE" || status === "COMPANY_LEAVE";
    const dirty =
        status !== (record?.status ?? "") ||
        punchIn !== (record?.punchIn ?? "") ||
        punchOut !== (record?.punchOut ?? "") ||
        note !== (record?.note ?? "");

    const late = lateMinutes(record?.punchIn, shiftStart);
    const worked = workedMinutes(record?.punchIn, record?.punchOut);

    const run = async (action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) => {
        setBusy(true);
        const result = await action();
        setBusy(false);
        if (result.success) {
            toast.success(successMessage);
            router.refresh();
        } else {
            toast.error(result.error ?? "Something went wrong");
        }
    };

    const handleSave = () => {
        const effectiveStatus = status || (punchIn ? "PRESENT" : "");
        if (!effectiveStatus) {
            toast.error("Choose a status or enter a punch-in time.");
            return;
        }
        run(() => saveAttendance(staffId, date, {
            status: effectiveStatus as AttendanceStatus,
            punchIn: punchIn || null,
            punchOut: punchOut || null,
            note,
        }), "Attendance saved");
    };

    const handlePunch = async (kind: "in" | "out") => {
        setBusy(true);
        const result = await punchNow(staffId, kind);
        setBusy(false);
        if (result.success) {
            if (kind === "in") {
                setPunchIn(result.time);
                if (!status) setStatus("PRESENT");
            } else {
                setPunchOut(result.time);
            }
            toast.success(`Punched ${kind} at ${result.time}`);
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    const handleClear = () => {
        if (!confirm("Remove the attendance entry for this day?")) return;
        setStatus("");
        setPunchIn("");
        setPunchOut("");
        setNote("");
        run(() => clearAttendance(staffId, date), "Entry removed");
    };

    return (
        <div className={cn("flex flex-col gap-3 p-4 lg:flex-row lg:items-center", busy && "opacity-60 pointer-events-none")}>
            <div className="lg:w-48 shrink-0">
                <div className="font-medium text-slate-900">{title}</div>
                {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {record && (
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", STATUS_STYLES[record.status as AttendanceStatus])}>
                            {STATUS_LABELS[record.status as AttendanceStatus] ?? record.status}
                        </span>
                    )}
                    {late > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">Late {formatMinutes(late)}</span>}
                    {worked !== null && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{formatMinutes(worked)}</span>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] lg:flex-1">
                <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="col-span-2 sm:col-span-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    aria-label="Status"
                >
                    <option value="">Not marked</option>
                    {ATTENDANCE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <TimeField label="In" value={punchIn} onChange={setPunchIn} disabled={onLeave}
                    onNow={allowPunchNow && !record?.punchIn ? () => handlePunch("in") : undefined} nowIcon={<LogIn className="h-4 w-4" />} />
                <TimeField label="Out" value={punchOut} onChange={setPunchOut} disabled={onLeave}
                    onNow={allowPunchNow && record?.punchIn && !record?.punchOut ? () => handlePunch("out") : undefined} nowIcon={<LogOut className="h-4 w-4" />} />
            </div>

            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note / leave reason" className="lg:w-48" maxLength={200} />

            <div className="flex gap-2 lg:w-[132px] lg:justify-end">
                <Button size="sm" onClick={handleSave} disabled={!dirty} className="flex-1 lg:flex-none">Save</Button>
                {record && (
                    <Button size="sm" variant="ghost" onClick={handleClear} aria-label="Remove entry" className="text-slate-500">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function TimeField({ label, value, onChange, disabled, onNow, nowIcon }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    onNow?: () => void;
    nowIcon: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 w-6">{label}</span>
            <Input type="time" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} aria-label={`Punch ${label.toLowerCase()}`} />
            {onNow && (
                <Button type="button" size="icon" variant="outline" className="shrink-0 h-10 w-10 text-green-700" onClick={onNow} aria-label={`Punch ${label.toLowerCase()} now`}>
                    {nowIcon}
                </Button>
            )}
        </div>
    );
}
