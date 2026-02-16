"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { getReminders } from "@/lib/actions/reminder-actions";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

export function DeadlineReminder() {
    const [open, setOpen] = useState(false);
    const [deadlines, setDeadlines] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        const checkDeadlines = async () => {
            const reminders = await getReminders();
            // Filter for deadline type
            const deadlineItems = reminders.filter((r: any) => r.type === 'deadline');

            if (deadlineItems.length > 0) {
                // Check if we already showed this today (simple local storage check to avoid annoyance)
                const lastSeen = localStorage.getItem("deadlineReminderSeenDate");
                const today = new Date().toDateString();

                if (lastSeen !== today) {
                    setDeadlines(deadlineItems);
                    setOpen(true);
                }
            }
        };

        checkDeadlines();
    }, []);

    const handleDismiss = () => {
        setOpen(false);
        localStorage.setItem("deadlineReminderSeenDate", new Date().toDateString());
    };

    const handleViewOrders = () => {
        setOpen(false);
        localStorage.setItem("deadlineReminderSeenDate", new Date().toDateString());
        router.push("/processing-orders");
    };

    if (deadlines.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <Bell className="h-5 w-5" />
                        Order Deadlines Today
                    </DialogTitle>
                    <DialogDescription>
                        You have {deadlines.length} orders pending with a deadline of today.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-2">
                    {deadlines.map((item) => (
                        <div key={item.id} className="flex flex-col border p-2 rounded-md bg-amber-50 border-amber-100">
                            <span className="font-semibold text-sm text-amber-900">{item.name}</span>
                            <span className="text-xs text-amber-700">{item.phone}</span>
                        </div>
                    ))}
                </div>
                <DialogFooter className="flex-row sm:justify-end gap-2">
                    <Button variant="ghost" onClick={handleDismiss}>Later</Button>
                    <Button onClick={handleViewOrders} className="bg-amber-600 hover:bg-amber-700">View Orders</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
