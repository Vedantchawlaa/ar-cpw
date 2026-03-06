"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface DataPoint {
    category: string;
    amount: number;
    color: string;
}

interface ExpensePieChartProps {
    data: { category: string; amount: number }[];
}

export function ExpensePieChart({ data }: ExpensePieChartProps) {
    const total = data.reduce((sum, item) => sum + item.amount, 0);

    // Premium color palette
    const colors = [
        "#6366f1", // Indigo
        "#ec4899", // Pink
        "#f59e0b", // Amber
        "#10b981", // Emerald
        "#3b82f6", // Blue
        "#8b5cf6", // Violet
        "#f43f5e", // Rose
        "#0ea5e9", // Sky
    ];

    const chartData: DataPoint[] = data
        .sort((a, b) => b.amount - a.amount)
        .map((item, index) => ({
            ...item,
            color: colors[index % colors.length],
        }));

    // Calculate SVG paths for segments
    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    if (total === 0 || data.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Expense Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="h-32 w-32 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <span className="text-slate-400 text-xs">No Data</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Add expenses to see distribution</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Expense Distribution</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center space-y-6">
                    <div className="relative h-48 w-48 transition-transform hover:scale-105 duration-300">
                        <svg viewBox="-1 -1 2 2" className="transform -rotate-90 h-full w-full drop-shadow-md">
                            {chartData.map((slice, index) => {
                                const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                                const percent = slice.amount / total;
                                cumulativePercent += percent;
                                const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

                                const largeArcFlag = percent > 0.5 ? 1 : 0;
                                const pathData = [
                                    `M ${startX} ${startY}`,
                                    `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                                    `L 0 0`,
                                ].join(" ");

                                return (
                                    <path
                                        key={index}
                                        d={pathData}
                                        fill={slice.color}
                                        className="transition-colors hover:brightness-110 cursor-pointer"
                                    >
                                        <title>{`${slice.category}: ₹${formatCurrency(slice.amount)} (${(percent * 100).toFixed(1)}%)`}</title>
                                    </path>
                                );
                            })}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-24 w-24 rounded-full bg-white shadow-inner flex flex-col items-center justify-center">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                                <span className="text-sm font-bold text-slate-900 leading-tight">₹{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full grid grid-cols-1 gap-2">
                        {chartData.map((slice, index) => (
                            <div key={index} className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{slice.category}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-700 block">₹{formatCurrency(slice.amount)}</span>
                                    <span className="text-[10px] text-slate-400">{((slice.amount / total) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
