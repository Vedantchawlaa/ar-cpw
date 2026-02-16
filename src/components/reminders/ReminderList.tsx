"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { Calendar, Phone, Mail, User, Bell, Package, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { completeFollowUp } from "@/lib/actions/reminder-actions";
import {
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    sendNotification
} from "@/lib/notification-utils";
import { useEffect, useState } from "react";

interface ReminderListProps {
    reminders: any[];
}

export function ReminderList({ reminders }: ReminderListProps) {
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setPermission(getNotificationPermission());
    }, []);

    const handleRequestPermission = async () => {
        const result = await requestNotificationPermission();
        setPermission(result);
    };

    // Auto-check for due reminders when the list loads or changes
    useEffect(() => {
        if (permission === "granted") {
            const dueToday = reminders.filter(r => {
                if (!r.nextContactDate) return false;
                const d = new Date(r.nextContactDate);
                const today = new Date();
                return d.toDateString() === today.toDateString();
            });

            if (dueToday.length > 0) {
                sendNotification(`Follow-up Reminder`, {
                    body: `You have ${dueToday.length} follow-up(s) due today!`,
                });
            }
        }
    }, [reminders, permission]);

    const handleComplete = async (id: string) => {
        if (confirm("Mark this follow-up as completed?")) {
            const result = await completeFollowUp(id);
            if (!result.success) {
                alert(result.error);
            }
        }
    };

    const pending = reminders.filter(r => !!r.nextContactDate);
    const completed = reminders.filter(r => !r.nextContactDate);

    if (reminders.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
                    <p className="text-lg font-medium">No active reminders or recent follow-ups.</p>
                    <p className="text-sm">Follow-up cards will appear here when they are due, and stay for 24 hours after completion.</p>
                </CardContent>
            </Card>
        );
    }

    const isOverdue = (date: Date) => {
        const d = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d < today;
    };

    const isToday = (date: Date) => {
        const d = new Date(date);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reminderDate = new Date(d);
        reminderDate.setHours(0, 0, 0, 0);

        const diffTime = reminderDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays === -1) return "Yesterday";
        if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
        return `In ${diffDays} days`;
    };

    const renderReminderCard = (reminder: any) => {
        const hasNextContact = !!reminder.nextContactDate;
        const nextDate = hasNextContact ? new Date(reminder.nextContactDate) : null;
        const isStock = reminder.isStock || reminder.type === 'stock';
        const Icon = isStock ? Package : User;

        return (
            <Card key={reminder.id} className={cn(
                "overflow-hidden border-l-4 transition-all duration-200",
                isStock
                    ? "border-l-orange-500 bg-orange-50 border-orange-100 shadow-sm"
                    : hasNextContact
                        ? "border-l-red-500 bg-red-50 border-red-100 shadow-sm"
                        : "border-l-green-500 bg-green-50 border-green-100 opacity-90"
            )}>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "p-2 rounded-full bg-white shadow-sm mt-1",
                                isStock ? "text-orange-600" : "text-zinc-600"
                            )}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900">{reminder.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-zinc-500 mt-1">
                                    <Badge className={cn(
                                        "text-xs border-none shadow-none",
                                        isStock ? "bg-orange-100 text-orange-800" : "bg-black/10 text-zinc-800"
                                    )}>
                                        {reminder.type}
                                    </Badge>
                                    <span>•</span>
                                    <span>{reminder.city}</span>
                                </div>
                                {!isStock ? (
                                    <div className="flex items-center gap-4 mt-3">
                                        <a href={`tel:${reminder.phone}`} className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
                                            <Phone className="h-3.5 w-3.5" /> {reminder.phone}
                                        </a>
                                        <a href={`mailto:${reminder.email}`} className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
                                            <Mail className="h-3.5 w-3.5" /> {reminder.email}
                                        </a>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 mt-3">
                                        <div className="text-sm font-bold text-orange-700 flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4" />
                                            {reminder.phone}
                                        </div>
                                        <Link href="/stock" className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
                                            Go to Stock Management →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                        {hasNextContact ? (
                            <>
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
                                    <Calendar className="h-4 w-4" />
                                    <span>{formatDate(nextDate!)}</span>
                                </div>
                                <Badge className={cn(
                                    "text-xs",
                                    isOverdue(nextDate!) ? "bg-red-500 text-white" :
                                        isToday(nextDate!) ? "bg-orange-500 text-white" :
                                            "bg-zinc-100 text-zinc-700"
                                )}>
                                    {isOverdue(nextDate!) ? "Overdue" :
                                        isToday(nextDate!) ? "Due Today" :
                                            "Upcoming"}
                                </Badge>
                            </>
                        ) : (
                            <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                                Follow-up Done ✅
                            </span>
                        )}
                    </div>

                    {hasNextContact && !isStock && (
                        <div className="mt-4 pt-4 border-t border-zinc-200">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleComplete(reminder.id)}
                                className="w-full md:w-auto"
                            >
                                Mark as Complete
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-4">
            {mounted && permission !== "granted" && isNotificationSupported() && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900">Enable browser notifications</p>
                                <p className="text-xs text-blue-700 mt-1">Get notified when follow-ups are due</p>
                            </div>
                            <Button size="sm" onClick={handleRequestPermission} className="bg-blue-600 hover:bg-blue-700">
                                Enable
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {pending.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">
                        Active Follow-ups ({pending.length})
                    </h3>
                    {pending.map(renderReminderCard)}
                </div>
            )}

            {completed.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">
                        Recently Completed ({completed.length})
                    </h3>
                    {completed.map(renderReminderCard)}
                </div>
            )}
        </div>
    );
}
