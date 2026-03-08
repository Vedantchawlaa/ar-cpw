"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";
import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                month_caption: "flex justify-center pt-1 relative items-center mb-4",
                caption_label: "text-xs font-bold text-slate-700 uppercase tracking-wider",
                nav: "space-x-1 flex items-center",
                button_previous: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-slate-100 transition-colors absolute left-1"
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-slate-100 transition-colors absolute right-1"
                ),
                month_grid: "w-full border-collapse",
                weekdays: "!grid !grid-cols-7 w-full mb-2",
                weekday:
                    "text-slate-400 w-full font-bold text-[10px] uppercase tracking-tighter text-center flex items-center justify-center !p-0 !m-0",
                week: "!grid !grid-cols-7 w-full mt-1",
                day: "h-9 w-full text-center text-sm !p-0 !m-0 relative focus-within:relative focus-within:z-20 flex items-center justify-center",
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-9 w-9 p-0 font-medium text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 rounded-lg active:scale-90 aria-selected:opacity-100"
                ),
                range_end: "day-range-end",
                selected:
                    "!bg-slate-900 !text-white !opacity-100 shadow-md transform scale-105 z-10",
                today: "bg-emerald-50 text-emerald-700 font-bold border border-emerald-100",
                outside:
                    "day-outside text-slate-300 opacity-50 aria-selected:bg-slate-50 aria-selected:text-slate-300 aria-selected:opacity-30",
                disabled: "text-slate-200 opacity-50",
                range_middle:
                    "aria-selected:bg-slate-50 aria-selected:text-slate-900",
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ ...props }) => {
                    if (props.orientation === 'left') {
                        return <ChevronLeft className="h-4 w-4" />;
                    }
                    return <ChevronRight className="h-4 w-4" />;
                },
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
