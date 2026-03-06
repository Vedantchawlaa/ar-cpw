"use client";

import { useMemo, useRef } from "react";
import { ProductType, ARState, DEFAULT_FABRICS, FabricTexture } from "@/lib/ar/types";
// @ts-ignore
import { X, Ruler, Layers, Save, Trash2, RefreshCcw, Check, Sparkles, Monitor, AppWindow, Play, Pause, Maximize2, Minimize2, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface UIOverlayProps {
    state: ARState;
    onStartAR: () => void;
    onStartSimulation: () => void;
    onToggleMode: (mode: ProductType) => void;
    onReset: () => void;
    onDelete: () => void;
    onSave: () => void;
    onSelectFabric: (id: string) => void;
    onUpdateOpenAmount: (id: string, amount: number) => void;
    onUploadFabric: (fabric: FabricTexture) => void;
    onClose: () => void;
}

export function UIOverlay({
    state,
    onStartAR,
    onStartSimulation,
    onToggleMode,
    onReset,
    onDelete,
    onSave,
    onSelectFabric,
    onUpdateOpenAmount,
    onUploadFabric,
    onClose
}: UIOverlayProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const allFabrics = useMemo(() => [...DEFAULT_FABRICS, ...state.customFabrics], [state.customFabrics]);

    const selectedPlacement = useMemo(() =>
        state.placements.find(p => p.id === state.selectedId),
        [state.placements, state.selectedId]);

    const isSimulation = state.isSimulationMode;
    const pointsCount = state.measurePoints.length;

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            const newFabric: FabricTexture = {
                id: `custom-${Date.now()}`,
                name: file.name.split('.')[0],
                url: url,
                patternWidth: 0.5, // Default scale for uploaded images
                patternHeight: 0.5
            };
            onUploadFabric(newFabric);
        };
        reader.readAsDataURL(file);
    };

    const getInstruction = () => {
        if (state.isMeasuring || pointsCount > 0) {
            switch (pointsCount) {
                case 0: return `Tap Top-Left Corner`;
                case 1: return `Tap Top-Right Corner`;
                case 2: return `Tap Bottom-Right Corner`;
                case 3: return `Tap Bottom-Left Corner`;
                default: return `Generating...`;
            }
        }
        return isSimulation ? 'Click on Virtual Wall' : 'Align Reticle to Wall';
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-[200] flex flex-col justify-between p-6">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
            />

            {/* Top Bar */}
            <div className="flex justify-between items-start pointer-events-auto">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onClose}
                        className="h-12 w-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl flex items-center justify-center text-slate-900 active:scale-90 transition-transform border border-slate-200"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    {!state.isSessionActive && !state.isSimulationMode && (
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={onStartSimulation}
                                className="px-6 py-3 bg-slate-800 text-white text-[12px] font-black uppercase rounded-full shadow-2xl pointer-events-auto flex items-center gap-2 border-2 border-white/10 hover:bg-slate-700 transition-colors"
                            >
                                <Monitor className="h-4 w-4" />
                                Desktop Simulation
                            </button>
                        </div>
                    )}
                    {(state.isSessionActive || state.isSimulationMode) && (
                        <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-full shadow-lg border border-white/10 flex items-center gap-2 transition-all">
                            {isSimulation ? <Monitor className="h-3 w-3 text-indigo-400" /> : <Sparkles className="h-3 w-3 text-indigo-400" />}
                            <span>{isSimulation ? 'Desktop Sim' : 'Live WebAR'}</span>
                            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-3">
                    <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 shadow-2xl border border-white/10">
                        <button
                            onClick={() => onToggleMode('CURTAIN')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                state.mode === 'CURTAIN' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Curtain
                        </button>
                        <button
                            onClick={() => onToggleMode('BLIND')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                state.mode === 'BLIND' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Blind
                        </button>
                    </div>

                    {selectedPlacement && (
                        <div className="bg-white/95 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-slate-100 flex flex-col gap-3 min-w-[200px] animate-in slide-in-from-right-5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Object</span>
                                <button onClick={onDelete} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xl font-black text-slate-900">
                                    {selectedPlacement.width.toFixed(2)}m <span className="text-slate-300">×</span> {selectedPlacement.height.toFixed(2)}m
                                </p>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">Verified Area</p>
                            </div>

                            {/* Open/Close Slider */}
                            <div className="pt-2 space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                    <span>Closed</span>
                                    <span>{Math.round(selectedPlacement.openAmount * 100)}% Open</span>
                                    <span>Open</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={selectedPlacement.openAmount}
                                    onChange={(e) => onUpdateOpenAmount(selectedPlacement.id, parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 pointer-events-auto"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Middle Indicator */}
            {pointsCount > 0 && pointsCount < 4 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 pointer-events-none">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-4 h-4 rounded-full border-2 transition-all duration-300",
                                i < pointsCount ? "bg-indigo-600 border-white scale-110 shadow-lg" : "bg-white/20 border-white/50 scale-100"
                            )}
                        />
                    ))}
                </div>
            )}

            {/* Bottom Controls */}
            <div className="flex flex-col gap-6 items-center pointer-events-auto">
                {/* Fabric Selector */}
                {selectedPlacement && (
                    <div className="flex gap-3 overflow-x-auto max-w-[90vw] pb-2 no-scrollbar px-4 items-center">
                        {/* Upload Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0 w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all active:scale-95 group"
                        >
                            <Upload className="h-6 w-6 mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[8px] font-black uppercase">Upload</span>
                        </button>

                        <div className="h-8 w-px bg-slate-200 flex-shrink-0 mx-1" />

                        {allFabrics.map(fabric => (
                            <button
                                key={fabric.id}
                                onClick={() => onSelectFabric(fabric.id)}
                                className={cn(
                                    "flex-shrink-0 w-16 h-16 rounded-2xl border-4 transition-all overflow-hidden relative group",
                                    state.currentFabricId === fabric.id ? "border-indigo-600 scale-110 shadow-xl" : "border-white shadow-md hover:border-slate-200"
                                )}
                            >
                                <img src={fabric.url} alt={fabric.name} className="w-full h-full object-cover" />
                                {state.currentFabricId === fabric.id && (
                                    <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                                        <Check className="h-6 w-6 text-white drop-shadow-md" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Main Action Bar */}
                <div className="bg-white/95 backdrop-blur-lg p-3 rounded-[32px] shadow-2xl border border-slate-100 flex items-center gap-4 max-w-full">
                    <button
                        onClick={onReset}
                        className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <RefreshCcw className="h-5 w-5" />
                    </button>

                    <div className="h-10 w-px bg-slate-200" />

                    <div className="flex flex-col items-center px-4 min-w-[160px]">
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest transition-colors",
                            pointsCount > 0 ? "text-indigo-600" : "text-slate-400"
                        )}>
                            {getInstruction()}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                            {pointsCount > 0 ? `${pointsCount} of 4 corners set` : '4-Corner Precision Mode'}
                        </span>
                    </div>

                    <div className="h-10 w-px bg-slate-200" />

                    <Button
                        onClick={onSave}
                        disabled={state.placements.length === 0}
                        className="h-14 px-8 rounded-full bg-slate-900 text-white hover:bg-black font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all hover:-translate-y-1 disabled:opacity-50 disabled:translate-y-0"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Instruction Sheets */}
            {!state.isSessionActive && !state.isSimulationMode && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] p-8 bg-slate-900/95 backdrop-blur-xl rounded-[48px] text-center space-y-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 animate-in fade-in zoom-in duration-500">
                    <div className="h-20 w-20 rounded-[28px] bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center mx-auto shadow-2xl skew-x-3 -rotate-3">
                        <Upload className="h-10 w-10 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-white font-black uppercase text-xl tracking-widest">Custom Fabric Mode</h4>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                            Upload your own cloth photos to see them instantly on 3D curtains and blinds.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 pt-2">
                        <button
                            onClick={onStartSimulation}
                            className="py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all hover:bg-slate-700 w-full"
                        >
                            <Monitor className="h-4 w-4 mx-auto mb-1 text-indigo-400" />
                            Launch Simulator
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
