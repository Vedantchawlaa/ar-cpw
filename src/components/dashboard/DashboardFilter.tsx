'use client';

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
// @ts-ignore
import { Calendar, ChevronDown, ListFilter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/DatePicker";

const PRESETS = [
    { label: "Current Month", value: "curr" },
    { label: "Last 24 hrs", value: "24h" },
    { label: "Last 48 hrs", value: "48h" },
    { label: "Last 7 days", value: "7d" },
    { label: "Last 14 days", value: "14d" },
    { label: "Last 1 month", value: "1mo" },
    { label: "Custom", value: "custom" },
];

export function DashboardFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentRange = searchParams.get("range") || "curr";
    const [isOpen, setIsOpen] = useState(false);
    const [startDate, setStartDate] = useState<Date | undefined>(
        searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined
    );
    const [endDate, setEndDate] = useState<Date | undefined>(
        searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined
    );

    const updateFilter = (range: string, from?: string, to?: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (range === "all") {
            params.set("range", "all");
            params.delete("from");
            params.delete("to");
        } else {
            params.set("range", range);
            if (from) params.set("from", from); else params.delete("from");
            if (to) params.set("to", to); else params.delete("to");
        }

        router.push(`${pathname}?${params.toString()}`);
        if (range !== 'custom') setIsOpen(false);
    };

    const handleCustomSubmit = () => {
        const fromStr = startDate ? startDate.toISOString().split('T')[0] : "";
        const toStr = endDate ? endDate.toISOString().split('T')[0] : "";
        updateFilter("custom", fromStr, toStr);
        setIsOpen(false);
    };

    const clearFilter = () => {
        updateFilter("all");
    };

    const activeLabel = PRESETS.find(p => p.value === currentRange)?.label || "All Time";

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 border-dashed"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <ListFilter className="mr-2 h-4 w-4" />
                    {activeLabel}
                </Button>

                {currentRange !== "all" && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2 text-muted-foreground hover:text-foreground"
                        onClick={clearFilter}
                    >
                        <X className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {isOpen && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-top-2 duration-300 ease-out">
                    <div className="space-y-1">
                        <div className="px-2 py-1.5 mb-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Presets</div>
                        <button
                            onClick={() => updateFilter("all")}
                            className={cn(
                                "w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200",
                                currentRange === "all" ? "bg-slate-900 font-medium text-white shadow-md" : "hover:bg-slate-50 text-slate-700"
                            )}
                        >
                            All Time
                        </button>
                        <div className="grid grid-cols-2 gap-1">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => updateFilter(preset.value)}
                                    className={cn(
                                        "text-left px-3 py-2 text-xs rounded-lg transition-all duration-200 flex items-center justify-between",
                                        currentRange === preset.value ? "bg-slate-100 font-semibold text-slate-900 border border-slate-200" : "hover:bg-slate-50 text-slate-600 border border-transparent"
                                    )}
                                >
                                    {preset.label}
                                    {preset.value === "custom" && <Calendar className="h-3 w-3 text-slate-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(currentRange === "custom" || searchParams.get("range") === "custom") && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Custom Range</label>
                                    <span className="text-[9px] text-slate-400 font-medium italic">Select start & end dates</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 p-1">
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] text-slate-400 font-bold ml-1 uppercase tracking-tight">From</p>
                                        <DatePicker
                                            date={startDate}
                                            setDate={setStartDate}
                                            placeholder="Start Date"
                                            className="h-10 w-full"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] text-slate-400 font-bold ml-1 uppercase tracking-tight">To</p>
                                        <DatePicker
                                            date={endDate}
                                            setDate={setEndDate}
                                            placeholder="End Date"
                                            className="h-10 w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="w-full h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                                onClick={handleCustomSubmit}
                            >
                                Apply Custom Range
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
