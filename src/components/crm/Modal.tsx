"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Scrollable dialog for long forms; closes on Escape or backdrop click. */
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className={cn("relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
                <div className="flex items-center justify-between border-b px-5 py-3">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
            </div>
        </div>
    );
}

export const fieldCls = "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
export const labelCls = "mb-1 block text-xs font-medium text-slate-600";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return <label className={cn("block", className)}><span className={labelCls}>{label}</span>{children}</label>;
}

export function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button {...props} className={cn("inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60", className)}>{children}</button>;
}

export function SecondaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button {...props} className={cn("inline-flex items-center justify-center gap-1.5 rounded-md border bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60", className)}>{children}</button>;
}
