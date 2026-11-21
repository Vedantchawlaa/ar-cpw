"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Coffee, Utensils, Users, PhoneCall, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { endWork, setWorkStatus, startWork } from "@/lib/actions/crm-actions";
import { formatDuration } from "@/lib/sales-crm";
import { WorkStatusPill, fmtTime } from "./ui";

interface State {
    status: string;
    since: Date | null;
    sessionStartedAt: Date | null;
    stale: boolean;
    today: { workedSec: number; breakSec: number; breaks: number };
}

const STATUS_BUTTONS = [
    { status: "AVAILABLE", label: "Available", icon: CheckCircle2 },
    { status: "ON_CALL", label: "On Call", icon: PhoneCall },
    { status: "BREAK", label: "Break", icon: Coffee },
    { status: "LUNCH", label: "Lunch", icon: Utensils },
    { status: "MEETING", label: "Meeting", icon: Users },
];

/** The signed-in salesperson's Start Work / status / End Work bar. Every change is stored with a timestamp. */
export function MyWorkBar({ state }: { state: State }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const working = state.status !== "OFFLINE";

    const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
        setError(null);
        start(async () => {
            const res = await fn();
            if (!res.ok) setError(res.error ?? "Could not update");
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="text-sm font-semibold text-slate-800">My status</span>
                <WorkStatusPill status={state.status} since={state.since} />
                {working && <span>Started {fmtTime(state.sessionStartedAt)}</span>}
                <span>Worked today <b className="text-slate-700">{formatDuration(state.today.workedSec)}</b></span>
                <span>Breaks <b className="text-slate-700">{state.today.breaks}</b> · {formatDuration(state.today.breakSec)}</span>
                {state.stale && <span className="flex items-center gap-1 font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />You did not press End Work last time</span>}
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {error && <span className="font-semibold text-red-600">{error}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                {!working || state.stale ? (
                    <button disabled={pending} onClick={() => act(startWork)} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                        <Play className="h-4 w-4" /> Start Work
                    </button>
                ) : (
                    <>
                        {STATUS_BUTTONS.map(({ status, label, icon: Icon }) => (
                            <button key={status} disabled={pending || state.status === status} onClick={() => act(() => setWorkStatus(status))}
                                className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default",
                                    state.status === status ? "border-blue-600 bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                                <Icon className="h-3.5 w-3.5" />
                                {state.status === status ? label : (status === "BREAK" || status === "LUNCH") ? `Start ${label}` : label}
                            </button>
                        ))}
                        {(state.status === "BREAK" || state.status === "LUNCH") && (
                            <button disabled={pending} onClick={() => act(() => setWorkStatus("AVAILABLE"))} className="rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">End Break</button>
                        )}
                        <button disabled={pending} onClick={() => { if (confirm("End work for today?")) act(endWork); }} className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                            <Square className="h-3.5 w-3.5" /> End Work
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
