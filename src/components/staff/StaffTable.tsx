"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { deleteStaff, type StaffMember } from "@/lib/actions/staff-actions";
import { cn } from "@/lib/utils";
import { StaffFormDialog } from "./StaffFormDialog";
import { StaffActiveToggle } from "./StaffActiveToggle";

interface StaffRow {
    staff: StaffMember;
    attendanceCount: number;
    paymentCount: number;
}

function formatRupees(amount: number) {
    return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function formatDate(key: string) {
    return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function StaffTable({ rows, today }: { rows: StaffRow[]; today: string }) {
    const [deleting, setDeleting] = useState<StaffRow | null>(null);

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                <Users className="h-12 w-12 mb-4 text-slate-300" />
                <p>No staff yet. Use <b>Add Staff</b> to add your first staff member.</p>
            </div>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                            <tr>
                                <th className="text-left font-medium px-4 py-3">Name</th>
                                <th className="text-left font-medium px-3 py-3">Phone</th>
                                <th className="text-right font-medium px-3 py-3">Salary / month</th>
                                <th className="text-left font-medium px-3 py-3">Shift</th>
                                <th className="text-right font-medium px-3 py-3">OT / hour</th>
                                <th className="text-left font-medium px-3 py-3">Joined</th>
                                <th className="text-left font-medium px-3 py-3">Status</th>
                                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map(row => {
                                const { staff } = row;
                                return (
                                    <tr key={staff.id} className={cn("hover:bg-slate-50/50", !staff.active && "text-slate-400")}>
                                        <td className="px-4 py-3">
                                            <Link href={`/attendance/${staff.id}`} className="font-medium text-slate-900 hover:underline">{staff.name}</Link>
                                            {staff.designation && <div className="text-xs text-slate-500">{staff.designation}</div>}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">{staff.phone || "—"}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatRupees(staff.monthlySalary)}</td>
                                        <td className="px-3 py-3 whitespace-nowrap tabular-nums">{staff.shiftStart}–{staff.shiftEnd}</td>
                                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                                            {staff.otRatePerHour != null ? formatRupees(staff.otRatePerHour) : <span className="text-slate-400">Auto</span>}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">{formatDate(staff.joinedAt)}</td>
                                        <td className="px-3 py-3">
                                            <span className={cn(
                                                "text-[11px] px-2 py-0.5 rounded-full border font-medium",
                                                staff.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"
                                            )}>
                                                {staff.active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex justify-end gap-2">
                                                <StaffFormDialog staff={staff} defaultJoinedAt={today} />
                                                <StaffActiveToggle staffId={staff.id} active={staff.active} />
                                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-600"
                                                    onClick={() => setDeleting(row)} aria-label={`Delete ${staff.name}`}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>

            {deleting && <DeleteStaffDialog row={deleting} onClose={() => setDeleting(null)} />}
        </Card>
    );
}

function DeleteStaffDialog({ row, onClose }: { row: StaffRow; onClose: () => void }) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState("");
    const [busy, setBusy] = useState(false);
    const { staff, attendanceCount, paymentCount } = row;
    const hasHistory = attendanceCount + paymentCount > 0;
    const canDelete = !hasHistory || confirmText.trim().toLowerCase() === staff.name.trim().toLowerCase();

    const handleDelete = async () => {
        setBusy(true);
        const result = await deleteStaff(staff.id);
        setBusy(false);
        if (result.success) {
            toast.success(`${staff.name} deleted`);
            onClose();
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete {staff.name}?</DialogTitle>
                    <DialogDescription>
                        {hasHistory
                            ? `This permanently deletes ${attendanceCount} attendance entries and ${paymentCount} payments/bonuses, and removes them from past salary sheets. This cannot be undone.`
                            : "This staff member has no attendance or payments yet. This cannot be undone."}
                    </DialogDescription>
                </DialogHeader>
                {hasHistory && (
                    <>
                        {staff.active && (
                            <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                                If they have left, <b>Mark inactive</b> instead: it hides them from the daily board but keeps their history.
                            </p>
                        )}
                        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Type <span className="font-semibold">{staff.name}</span> to confirm
                            <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoFocus />
                        </label>
                    </>
                )}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || busy}>
                        {busy ? "Deleting..." : "Delete permanently"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
