'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDown, Loader2, PackageCheck } from "lucide-react";
import {
    type PlanBar, type ProductCuttingPlan, type StockAwarePlan, type StockUse, type TrackCuttingSettings, type TrackPiece,
    formatInches, formatStockLength, purchaseSummary,
} from "@/lib/track-optimizer";
import { formatFeetInches } from "@/lib/stock-units";
import type { AppliedTrackStock } from "@/lib/services/stock-service";

const STOCK_PRESETS = [144, 180, 192, 216]; // 12 / 15 / 16 / 18 ft

interface TrackCuttingPlanProps {
    result: StockAwarePlan;
    productNames: Record<string, string>;
    /** false while only the no-stock plan is shown (stock still loading) */
    usesStock: boolean;
    applied: AppliedTrackStock | null;
    onApplyToStock: () => void;
    applying?: boolean;
    settings: TrackCuttingSettings;
    onSettingsChange: (settings: TrackCuttingSettings) => void;
    onDownload: (e: React.MouseEvent) => void;
    downloading?: boolean;
}

export const groupName = (group: ProductCuttingPlan, productNames: Record<string, string>) =>
    group.productId ? productNames[group.productId] || "Track" : "Track product not selected";

const hasWork = (group: ProductCuttingPlan) => group.fromStock.length > 0 || group.plan.bars.length > 0 || group.plan.oversized.length > 0;

function BarRow({ label, length, pieces, offcut, isKeep, keepText }: {
    label: string; length: number; pieces: TrackPiece[]; offcut: number; isKeep: boolean; keepText: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-10 pt-1 text-xs font-bold text-slate-500 text-right">{label}</div>
            <div className="flex-1 min-w-0">
                <div className="flex h-7 w-full overflow-hidden rounded border border-slate-400 text-[11px] font-semibold">
                    {pieces.map((piece, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-center text-white border-r border-white/80 overflow-hidden whitespace-nowrap"
                            style={{ width: `${(piece.length / length) * 100}%`, backgroundColor: i % 2 === 0 ? "#4a90d9" : "#f5a623" }}
                            title={`${piece.label} - ${formatInches(piece.length)}`}
                        >
                            {formatInches(piece.length)}
                        </div>
                    ))}
                    {offcut > 0 && (
                        <div className="flex flex-1 items-center justify-center text-slate-600 overflow-hidden whitespace-nowrap" style={{ backgroundColor: "#dddddd" }} title={`Offcut ${formatInches(offcut)}`}>
                            {formatInches(offcut)}
                        </div>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                    {pieces.map((piece, i) => <span key={i}>{piece.label} – {formatInches(piece.length)}</span>)}
                    <span className={isKeep ? "font-bold text-green-700" : "text-slate-400"}>
                        Offcut {formatInches(offcut)}{isKeep ? ` ${keepText}` : ""}
                    </span>
                </div>
            </div>
        </div>
    );
}

function StockUseRow({ use }: { use: StockUse }) {
    return (
        <div>
            <div className="text-[11px] font-semibold text-green-800 mb-1">From stock piece {formatFeetInches(use.stockLength)} ({formatInches(use.stockLength)})</div>
            <BarRow label="Stock" length={use.stockLength} pieces={use.pieces} offcut={use.offcut} isKeep={use.isKeep} keepText="stays in stock" />
        </div>
    );
}

function GroupPlan({ group, name, showName }: { group: ProductCuttingPlan; name: string; showName: boolean }) {
    const { plan } = group;
    return (
        <div className="space-y-3">
            {showName && <div className="text-sm font-bold text-slate-800 border-b pb-1">{name}</div>}

            {group.fromStock.length > 0 && (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50/40 p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-green-800">Cut from stock first</div>
                    {group.fromStock.map(use => <StockUseRow key={use.stockPieceId} use={use} />)}
                </div>
            )}

            {plan.bars.length > 0 && (
                <div className="space-y-3">
                    {group.fromStock.length > 0 && <div className="text-xs font-bold uppercase tracking-wider text-slate-500">New bars</div>}
                    {plan.bars.map((bar: PlanBar) => (
                        <BarRow key={bar.barNo} label={String(bar.barNo)} length={plan.stockLength} pieces={bar.pieces} offcut={bar.offcut} isKeep={bar.isKeep} keepText="KEEP" />
                    ))}
                </div>
            )}

            {!plan.isExact && <p className="text-xs text-amber-700">Large job: this plan is a close estimate, not a guaranteed minimum.</p>}
            {plan.skipped.length > 0 && <p className="text-xs text-amber-700">Left out (no size yet): {plan.skipped.map(p => p.label).join(", ")}</p>}

            {plan.oversized.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    <div className="font-bold text-red-800">Separate order required (longer than {formatStockLength(plan.stockLength)})</div>
                    <ul className="mt-1 space-y-0.5 text-red-900">
                        {plan.oversized.map((piece, i) => (
                            <li key={i}>{piece.label} – {formatInches(piece.length)} → order {piece.suggestedLength ? `${formatStockLength(piece.suggestedLength)} track` : "custom length track"}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="text-sm font-bold text-slate-800">
                {plan.totalBars > 0 || plan.oversized.length > 0 ? `Bars to cut / purchase: ${purchaseSummary(plan)}` : "No new bars needed."}
            </div>
        </div>
    );
}

export function TrackCuttingPlan({
    result, productNames, usesStock, applied, onApplyToStock, applying, settings, onSettingsChange, onDownload, downloading,
}: TrackCuttingPlanProps) {
    const [customStock, setCustomStock] = useState(!STOCK_PRESETS.includes(settings.stockLength));

    const update = (field: keyof TrackCuttingSettings, value: number) => onSettingsChange({ ...settings, [field]: value });

    const groups = result.groups.filter(hasWork);
    const totals = groups.reduce((sum, g) => ({
        bars: sum.bars + g.plan.totalBars,
        stockPieces: sum.stockPieces + g.fromStock.length,
        keep: [...sum.keep, ...g.plan.keepOffcuts, ...g.fromStock.filter(u => u.isKeep).map(u => u.offcut)],
    }), { bars: 0, stockPieces: 0, keep: [] as number[] });

    return (
        <Card>
            <CardHeader className="pb-3 border-b">
                <CardTitle className="flex justify-between items-center flex-wrap gap-2">
                    <span>Track Cutting Plan</span>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-normal text-gray-500">Stock pieces first, least wastage, no joints</span>
                        <Button variant="outline" size="sm" className="h-8 px-3 flex items-center gap-2" onClick={onDownload} disabled={downloading}>
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
                                {STOCK_PRESETS.map(len => <option key={len} value={len}>{`${len / 12} ft (${len}")`}</option>)}
                                <option value="custom">Custom</option>
                            </select>
                            {customStock && (
                                <div className="flex items-center gap-1">
                                    <Input type="number" min={1} className="h-8 w-20 text-center px-1" value={settings.stockLength || ""} onChange={e => update('stockLength', parseFloat(e.target.value) || 0)} />
                                    <span className="text-gray-500">in</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Blade allowance / cut</label>
                        <div className="flex items-center gap-1">
                            <Input type="number" min={0} step={0.05} className="h-8 w-20 text-center px-1" value={settings.kerf} onChange={e => update('kerf', Math.max(0, parseFloat(e.target.value) || 0))} />
                            <span className="text-gray-500">in</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Keep offcuts from</label>
                        <div className="flex items-center gap-1">
                            <Input type="number" min={0} className="h-8 w-20 text-center px-1" value={settings.keepThreshold} onChange={e => update('keepThreshold', Math.max(0, parseFloat(e.target.value) || 0))} />
                            <span className="text-gray-500">in</span>
                        </div>
                    </div>
                </div>

                {groups.length === 0 ? (
                    <p className="text-sm text-gray-500">No tracks to cut.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Stock pieces used</div>
                                <div className="text-2xl font-bold text-green-700">{usesStock ? totals.stockPieces : "…"}</div>
                            </div>
                            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">New tracks of {formatStockLength(result.stockLength)}</div>
                                <div className="text-2xl font-bold text-blue-700">{totals.bars}</div>
                            </div>
                            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 col-span-2">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Offcuts to keep</div>
                                <div className="text-sm font-bold text-slate-800 mt-1">
                                    {totals.keep.length > 0 ? totals.keep.sort((a, b) => b - a).map(formatInches).join(", ") : "None"}
                                </div>
                            </div>
                        </div>

                        {!usesStock && <p className="text-xs text-slate-500">Checking stock for usable pieces…</p>}

                        <div className="space-y-6">
                            {groups.map(group => (
                                <GroupPlan key={group.productId ?? "none"} group={group} name={groupName(group, productNames)} showName={groups.length > 1 || !!group.productId} />
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                            {applied ? (
                                <p className="text-sm text-green-700 flex items-center gap-2">
                                    <PackageCheck className="h-4 w-4" />
                                    Stock updated on {new Date(applied.appliedAt).toLocaleDateString("en-IN")}: {applied.piecesUsed} used, {applied.piecesShortened} shortened, {applied.offcutsAdded} offcuts added.
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500">After cutting, book it: used pieces leave stock and KEEP offcuts are added (admin only).</p>
                            )}
                            {!applied && (
                                <Button size="sm" variant="outline" onClick={onApplyToStock} disabled={applying || !usesStock}>
                                    {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PackageCheck className="h-4 w-4 mr-1" />}
                                    Apply to stock
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
