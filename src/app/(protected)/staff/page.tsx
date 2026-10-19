import Link from "next/link";
import { Clock, UserCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAllStaff } from "@/lib/actions/staff-actions";
import { businessNow } from "@/lib/staff-attendance";
import { StaffFormDialog } from "@/components/staff/StaffFormDialog";
import { StaffTable } from "@/components/staff/StaffTable";

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
    const [rows, today] = [await getAllStaff(), businessNow().date];
    const activeCount = rows.filter(r => r.staff.active).length;

    return (
        <div className="p-2 md:p-6 max-w-6xl mx-auto w-full space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <UserCog className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff</h1>
                        <p className="text-slate-500 text-sm">
                            {activeCount} active{rows.length > activeCount ? ` · ${rows.length - activeCount} inactive` : ""}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href="/attendance">
                        <Button variant="outline" className="gap-2"><Clock className="h-4 w-4" /> Attendance</Button>
                    </Link>
                    <StaffFormDialog defaultJoinedAt={today} />
                </div>
            </div>

            <StaffTable rows={rows} today={today} />
        </div>
    );
}
