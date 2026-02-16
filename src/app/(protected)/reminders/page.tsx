import { ReminderList } from "@/components/reminders/ReminderList";
import { getReminders } from "@/lib/actions/reminder-actions";
import { Bell, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function RemindersPage() {
    const reminders = await getReminders();

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <Link href="/dashboard">
                {/* @ts-ignore */}
                <Button variant="ghost" size="sm" className="gap-2 text-zinc-500 hover:text-zinc-900 -ml-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Button>
            </Link>

            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Bell className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Follow-up Reminders</h1>
                    <p className="text-zinc-500 text-sm">Never miss a potential customer. These are based on your "Next Contact Date" settings.</p>
                </div>
            </div>

            <ReminderList reminders={reminders} />
        </div>
    );
}
