"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { createStaff, updateStaff, type StaffMember } from "@/lib/actions/staff-actions";

interface StaffFormDialogProps {
    staff?: StaffMember;
    defaultJoinedAt: string;
}

export function StaffFormDialog({ staff, defaultJoinedAt }: StaffFormDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const input = {
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            designation: String(form.get("designation") ?? ""),
            monthlySalary: String(form.get("monthlySalary") ?? ""),
            shiftStart: String(form.get("shiftStart") ?? ""),
            shiftEnd: String(form.get("shiftEnd") ?? ""),
            otRatePerHour: String(form.get("otRatePerHour") ?? ""),
            joinedAt: String(form.get("joinedAt") ?? ""),
        };

        setSaving(true);
        const result = staff ? await updateStaff(staff.id, input) : await createStaff(input);
        setSaving(false);

        if (result.success) {
            toast.success(staff ? "Staff updated" : "Staff added");
            setOpen(false);
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    return (
        <>
            {staff ? (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                </Button>
            ) : (
                <Button className="gap-2" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" /> Add Staff
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{staff ? "Edit staff" : "Add staff"}</DialogTitle>
                        <DialogDescription>Salary is monthly. Shift times flag late punch-ins and count overtime after shift end.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <Field label="Name">
                            <Input name="name" required defaultValue={staff?.name} autoFocus />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Phone">
                                <Input name="phone" type="tel" defaultValue={staff?.phone ?? ""} />
                            </Field>
                            <Field label="Designation">
                                <Input name="designation" placeholder="e.g. Fitter" defaultValue={staff?.designation ?? ""} />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Monthly salary (₹)">
                                <Input name="monthlySalary" type="number" min="0" step="1" required defaultValue={staff?.monthlySalary} />
                            </Field>
                            <Field label="Joining date">
                                <Input name="joinedAt" type="date" required defaultValue={staff?.joinedAt ?? defaultJoinedAt} />
                            </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Shift start">
                                <Input name="shiftStart" type="time" required defaultValue={staff?.shiftStart ?? "10:00"} />
                            </Field>
                            <Field label="Shift end">
                                <Input name="shiftEnd" type="time" required defaultValue={staff?.shiftEnd ?? "19:00"} />
                            </Field>
                        </div>
                        <Field label="OT rate per hour (₹)">
                            <Input name="otRatePerHour" type="number" min="0" step="0.01" placeholder="Auto: pay per day ÷ shift hours"
                                defaultValue={staff?.otRatePerHour ?? ""} />
                        </Field>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            {label}
            {children}
        </label>
    );
}
