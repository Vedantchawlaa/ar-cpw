"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { setStaffActive } from "@/lib/actions/staff-actions";

export function StaffActiveToggle({ staffId, active }: { staffId: string; active: boolean }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const handleClick = async () => {
        if (active && !confirm("Mark this staff member inactive? They will be hidden from the daily board. Attendance history is kept.")) return;
        setBusy(true);
        const result = await setStaffActive(staffId, !active);
        setBusy(false);
        if (result.success) {
            toast.success(active ? "Marked inactive" : "Reactivated");
            router.refresh();
        } else {
            toast.error(result.error);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleClick} disabled={busy} className={active ? "text-red-600" : ""}>
            {active ? "Mark inactive" : "Reactivate"}
        </Button>
    );
}
