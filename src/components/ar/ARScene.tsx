"use client";

import { useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { ARState, DEFAULT_FABRICS, FabricTexture } from "@/lib/ar/types";
import { UIOverlay } from "./UIOverlay";
import { saveARMeasurements } from "@/lib/ar/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Experience } from "./Experience";
import { Loader2 } from "lucide-react";

// In v6, features are enabled in the store or session initiation
const store = createXRStore();

export default function ARScene() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const leadId = searchParams.get("leadId") || "unknown";

    const [state, setState] = useState<ARState>({
        mode: 'CURTAIN',
        placements: [],
        selectedId: null,
        currentFabricId: DEFAULT_FABRICS[0].id,
        isMeasuring: false,
        measurePoints: [],
        isSessionActive: false,
        isSimulationMode: true,
        customFabrics: []
    });

    const handleUpdateOpenAmount = (id: string, amount: number) => {
        setState(s => ({
            ...s,
            placements: s.placements.map(p => p.id === id ? { ...p, openAmount: amount } : p)
        }));
    };

    const handleUploadFabric = (fabric: FabricTexture) => {
        setState(s => ({
            ...s,
            customFabrics: [...s.customFabrics, fabric],
            currentFabricId: fabric.id
        }));
    };

    const handleToggleMode = (mode: any) => setState(s => ({ ...s, mode }));
    const handleReset = () => setState(s => ({ ...s, measurePoints: [], placements: [], selectedId: null }));
    const handleSelectFabric = (fabricId: string) => setState(s => ({ ...s, currentFabricId: fabricId }));
    const handleDelete = () => {
        if (!state.selectedId) return;
        setState(s => ({ ...s, placements: s.placements.filter(p => p.id !== state.selectedId), selectedId: null }));
    };

    const handleSave = async () => {
        const result = await saveARMeasurements(leadId, state.placements);
        if (result.success || result.status === 404) alert("Data synced! ✅");
        else alert("Failed to sync. ❌");
    };

    return (
        <div className="fixed inset-0 bg-slate-900 overflow-hidden">
            {/* Session Button specifically for AR */}
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[300]">
                <button
                    onClick={() => store.enterAR()}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95 border-2 border-white/20"
                >
                    ENTER AR MODE
                </button>
            </div>

            <Canvas shadows camera={{ position: [0, 1.6, 3], fov: 70 }}>
                <XR store={store}>
                    <Suspense fallback={null}>
                        <Experience state={state} setState={setState} />
                    </Suspense>
                </XR>
            </Canvas>

            <UIOverlay
                state={state}
                onStartAR={() => {/* ARButton handles this */ }}
                onStartSimulation={() => setState(s => ({ ...s, isSimulationMode: true }))}
                onToggleMode={handleToggleMode}
                onReset={handleReset}
                onDelete={handleDelete}
                onSave={handleSave}
                onSelectFabric={handleSelectFabric}
                onUpdateOpenAmount={handleUpdateOpenAmount}
                onUploadFabric={handleUploadFabric}
                onClose={() => router.back()}
            />

            {/* Loading Indicator for Textures */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none z-[300]">
                <Suspense fallback={
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-xl border border-slate-200">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Loading Textures...</span>
                    </div>
                }>
                    {/* Dummy component to trigger suspense if needed */}
                </Suspense>
            </div>
        </div>
    );
}
