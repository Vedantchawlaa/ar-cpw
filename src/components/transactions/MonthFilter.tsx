'use client';

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export function MonthFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const now = new Date();
    const currentMonth = searchParams.get("month") ? parseInt(searchParams.get("month")!) : now.getMonth();
    const currentYear = searchParams.get("year") ? parseInt(searchParams.get("year")!) : now.getFullYear();

    const updateMonth = (month: number, year: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("month", month.toString());
        params.set("year", year.toString());
        params.set("range", "month"); // Explicitly set range to month
        router.push(`${pathname}?${params.toString()}`);
    };

    const prevMonth = () => {
        if (currentMonth === 0) {
            updateMonth(11, currentYear - 1);
        } else {
            updateMonth(currentMonth - 1, currentYear);
        }
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            updateMonth(0, currentYear + 1);
        } else {
            updateMonth(currentMonth + 1, currentYear);
        }
    };

    const resetToCurrent = () => {
        updateMonth(now.getMonth(), now.getFullYear());
    };

    return (
        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-sm font-bold text-slate-900">{MONTHS[currentMonth]}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">{currentYear}</span>
                </div>

                <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-1" />

            <Button
                variant="ghost"
                size="sm"
                onClick={resetToCurrent}
                className={cn(
                    "text-xs font-bold px-3 h-8",
                    (currentMonth === now.getMonth() && currentYear === now.getFullYear() && searchParams.get("range") !== "all")
                        ? "text-blue-600 bg-blue-50"
                        : "text-slate-500 hover:text-slate-900"
                )}
            >
                Current Month
            </Button>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("month");
                    params.delete("year");
                    params.set("range", "all");
                    router.push(`${pathname}?${params.toString()}`);
                }}
                className={cn(
                    "text-xs font-bold px-3 h-8",
                    searchParams.get("range") === "all"
                        ? "text-blue-600 bg-blue-50"
                        : "text-slate-500 hover:text-slate-900"
                )}
            >
                All Time
            </Button>
        </div>
    );
}
