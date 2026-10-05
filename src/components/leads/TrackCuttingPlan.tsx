'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDown, Loader2 } from "lucide-react";
import { CuttingPlan, TrackCuttingSettings, formatInches, formatStockLength, purchaseSummary } from "@/lib/track-optimizer";

const STOCK_PRESETS = [144, 180, 192, 216]; // 12 / 15 / 16 / 18 ft

interface TrackCuttingPlanProps {
    plan: CuttingPlan;
    settings: TrackCuttingSettings;
    onSettingsChange: (settings: TrackCuttingSettings) => void;
    onDownload: (e: React.MouseEvent) => void;
    downloading?: boolean;
}

export function TrackCuttingPlan({ plan, settings, onSettingsChange, onDownload, downloading }: TrackCuttingPlanProps) {
    const [customStock, setCustomStock] = useState(!STOCK_PRESETS.includes(settings.stockLength));

    const update = (field: keyof TrackCuttingSettings, value: number) => onSettingsChange({ ...settings, [field]: value });

    return (
        <Card>
            <CardHeader className="pb-3 border-b">
                <CardTitle className="flex justify-between items-center flex-wrap gap-2">
                    <span>Track Cutting Plan</span>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-normal text-gray-500">Least wastage, no joints</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 flex items-center gap-2"
                            onClick={onDownload}
                            disabled={downloading}
                        >
                            {downloading ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <FileDown className="h-4 w-4 text-blue-600" />}
                            Download Tracks.pdf
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {/* Settings */}
                <div className="flex flex-wrap items-end gap-4 text-sm">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Stock length</label>
                        <div className="flex items-center gap-2">
                            <select
                                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                                value={customStock ? "custom" : settings.stockLength}
                                onChange={e => {
                                    if (e.target.value === "custom") {
                                        setCustomStock(true);
                                    } else {
                                        setCustomStock(false);
                                        update('stockLength', parseFloat(e.target.value));
                                    }
                                }}
                            >
                                {STOCK_PRESETS.map(len => (
                                    <option key={len} value={len}>{`${len / 12} ft (${len}")`}</option>
                                ))}
                                <option value="custom">Custom</option>
                            </select>
                            {customStock && (
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min={1}
                                        className="h-8 w-20 text-center px-1"
                                        value={settings.stockLength || ""}
                                        onChange={e => update('stockLength', parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-gray-500">in</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Blade allowance / cut</label>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                min={0}
                                step={0.05}
                                className="h-8 w-20 text-center px-1"
                                value={settings.kerf}
                                onChange={e => update('kerf', Math.max(0, parseFloat(e.target.value) || 0))}
                            />
                            <span className="text-gray-500">in</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Keep offcuts from</label>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                min={0}
                                className="h-8 w-20 text-center px-1"
                                value={settings.keepThreshold}
                                onChange={e => update('keepThreshold', Math.max(0, parseFloat(e.target.value) || 0))}
                            />
                            <span className="text-gray-500">in</span>
                        </div>
                    </div>
                </div>

                {plan.bars.length === 0 && plan.oversized.length === 0 ? (
                    <p className="text-sm text-gray-500">No tracks to cut.</p>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Tracks of {formatStockLength(plan.stockLength)}</div>
                                <div className="text-2xl font-bold text-blue-700">{plan.totalBars}</div>
                            </div>
                            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Used</div>
                                <div className="text-2xl font-bold text-slate-800">{formatInches(plan.totalUsed)}</div>
                            </div>
                            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Offcut</div>
                                <div className="text-2xl font-bold text-slate-800">{formatInches(plan.totalOffcut)}</div>
                            </div>
                            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Keep offcuts</div>
                                <div className="text-sm font-bold text-green-700 mt-1">
                                    {plan.keepOffcuts.length > 0 ? plan.keepOffcuts.map(formatInches).join(", ") : "None"}
                                </div>
                            </div>
                        </div>

                        {!plan.isExact && (
                            <p className="text-xs text-amber-700">Large job: this plan is a close estimate, not a guaranteed minimum.</p>
                        )}
                        {plan.skipped.length > 0 && (
                            <p className="text-xs text-amber-700">
                                Left out (no size yet): {plan.skipped.map(p => p.label).join(", ")}
                            </p>
                        )}

                        {/* One visual bar per stock track */}
                        <div className="space-y-3">
                            {plan.bars.map(bar => (
                                <div key={bar.barNo} className="flex items-start gap-3">
                                    <div className="w-6 pt-1 text-sm font-bold text-slate-500 text-right">{bar.barNo}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex h-7 w-full overflow-hidden rounded border border-slate-400 text-[11px] font-semibold">
                                            {bar.pieces.map((piece, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-center text-white border-r border-white/80 overflow-hidden whitespace-nowrap"
                                                    style={{ width: `${(piece.length / plan.stockLength) * 100}%`, backgroundColor: i % 2 === 0 ? "#4a90d9" : "#f5a623" }}
                                                    title={`${piece.label} - ${formatInches(piece.length)}`}
                                                >
                                                    {formatInches(piece.length)}
                                                </div>
                                            ))}
                                            {bar.offcut > 0 && (
                                                <div
                                                    className="flex flex-1 items-center justify-center text-slate-600 overflow-hidden whitespace-nowrap"
                                                    style={{ backgroundColor: "#dddddd" }}
                                                    title={`Offcut ${formatInches(bar.offcut)}`}
                                                >
                                                    {formatInches(bar.offcut)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                                            {bar.pieces.map((piece, i) => (
                                                <span key={i}>{piece.label} – {formatInches(piece.length)}</span>
                                            ))}
                                            <span className={bar.isKeep ? "font-bold text-green-700" : "text-slate-400"}>
                                                Offcut {formatInches(bar.offcut)}{bar.isKeep ? " KEEP" : ""}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {plan.oversized.length > 0 && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                                <div className="font-bold text-red-800">Separate order required (longer than {formatStockLength(plan.stockLength)})</div>
                                <ul className="mt-1 space-y-0.5 text-red-900">
                                    {plan.oversized.map((piece, i) => (
                                        <li key={i}>
                                            {piece.label} – {formatInches(piece.length)} → order {piece.suggestedLength ? `${formatStockLength(piece.suggestedLength)} track` : "custom length track"}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="border-t pt-3 text-sm font-bold text-slate-800">
                            Bars to cut / purchase: {purchaseSummary(plan)}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
