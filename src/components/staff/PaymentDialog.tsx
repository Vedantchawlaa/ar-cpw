"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { addStaffPayment } from "@/lib/actions/staff-actions";
import type { PaymentType } from "@/lib/staff-attendance";

interface PaymentDialogProps {
    /** PAYMENT: any amount paid to the staff member. BONUS: added to the month's pay. */
    type: PaymentType;
    staffId: string;
    staffName: string;
    year: number;
    month: number;
    monthName: string;
    /** Prefilled amount for a payment: the balance still due, if any. */
    balance: number;
    today: string;
    size?: "sm" | "default";
}

export function PaymentDialog({ type, staffId, staffName, year, month, monthName, balance, today, size = "default" }: PaymentDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const isBonus = type === "BONUS";

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setSaving(true);
        const result = await addStaffPayment(staffId, {
            year,
            month,
            type,
            amount: String(form.get("amount") ?? ""),
            paidOn: String(form.get("paidOn") ?? ""),
            note: String(form.get("note") ?? ""),
        });
        setSaving(false);

        if (result.success) {
            toast.success(isBonus ? "Bonus added" : "Payment recorded");
            setOpen(false);
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    return (
        <>
            <Button variant="outline" size={size} className="gap-2" onClick={() => setOpen(true)}>
                {isBonus ? <><Gift className="h-4 w-4" /> Bonus</> : <><Wallet className="h-4 w-4" /> Pay</>}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isBonus ? `Bonus for ${staffName}` : `Pay ${staffName}`}</DialogTitle>
                        <DialogDescription>
                            {isBonus
                                ? `Added on top of ${monthName} pay. Record the payout separately with Pay.`
                                : `Any amount: advance, part or full salary. It counts against ${monthName}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                Amount (₹)
                                <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus
                                    defaultValue={!isBonus && balance > 0 ? balance : undefined} />
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                {isBonus ? "Date" : "Paid on"}
                                <Input name="paidOn" type="date" required defaultValue={today} />
                            </label>
                        </div>
                        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Note
                            <Input name="note" placeholder={isBonus ? "e.g. Diwali bonus" : "e.g. Advance, cash, UPI"} maxLength={200} />
                        </label>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>{saving ? "Saving..." : isBonus ? "Add bonus" : "Record payment"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
