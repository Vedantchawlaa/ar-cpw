import { Suspense } from "react";
import ARScene from "@/components/ar/ARScene";
import { Loader2 } from "lucide-react";

export const metadata = {
    title: "WebAR Measurement | Chawla Parde Wala",
    description: "Measure and visualize curtains and blinds in your room with Augmented Reality.",
};

export default function ARPage() {
    return (
        <main className="min-h-screen bg-black">
            <Suspense fallback={
                <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    <p className="font-black uppercase tracking-widest text-xs">Initializing WebXR Session...</p>
                </div>
            }>
                <ARScene />
            </Suspense>
        </main>
    );
}
