"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteStaffPayment, type StaffPaymentRecord } from "@/lib/actions/staff-actions";

function formatRupees(amount: number) {
    return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

export function PaymentList({ payments }: { payments: StaffPaymentRecord[] }) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this entry?")) return;
        setDeletingId(id);
        const result = await deleteStaffPayment(id);
        setDeletingId(null);
        if (result.success) {
            toast.success("Entry deleted");
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    if (payments.length === 0) {
        return <p className="px-5 py-6 text-sm text-slate-500">No payments or bonuses for this month.</p>;
    }

    return (
        <div className="divide-y">
            {payments.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums">{formatRupees(p.amount)}</span>
                            <span className={p.type === "BONUS"
                                ? "text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200"
                                : "text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"}>
                                {p.type === "BONUS" ? "Bonus" : "Paid"}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                            {new Date(`${p.paidOn}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                            {p.note && ` · ${p.note}`}
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} aria-label="Delete payment">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    );
}
