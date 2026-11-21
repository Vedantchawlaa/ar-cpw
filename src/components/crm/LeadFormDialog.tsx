"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveLead } from "@/lib/actions/crm-actions";
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, PRODUCTS, STATUS_INFO } from "@/lib/sales-crm";
import { Field, Modal, PrimaryButton, SecondaryButton, fieldCls } from "./Modal";
import { fromLocalInput, leadHref } from "./ui";
import { cn } from "@/lib/utils";

export interface EditableLead {
    id: string;
    name: string;
    phone: string;
    altPhone: string | null;
    whatsapp: string | null;
    email: string | null;
    city: string;
    address: string | null;
    source: string | null;
    productInterest: string[];
    expectedOrderValue: number;
    type: string;
    status: string;
    assignedToId: string | null;
    description: string | null;
}

/** Add / edit a lead. Executives cannot reassign; the server enforces that too. */
export function LeadFormDialog({ lead, team, canAssign, onClose }: { lead?: EditableLead; team: Array<{ value: string; label: string }>; canAssign: boolean; onClose: () => void }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [dupe, setDupe] = useState<{ id: string; code: string; name: string } | null>(null);
    const [f, setF] = useState({
        name: lead?.name ?? "", phone: lead?.phone ?? "", altPhone: lead?.altPhone ?? "", whatsapp: lead?.whatsapp ?? "", email: lead?.email ?? "",
        city: lead?.city ?? "", address: lead?.address ?? "", source: lead?.source ?? "", productInterest: lead?.productInterest ?? [],
        budget: lead ? String(lead.expectedOrderValue || "") : "", priority: lead?.type ?? "Warm", status: lead?.status ?? "",
        assignedToId: lead?.assignedToId ?? "", notes: lead?.description ?? "", nextFollowUpAt: "", sameWhatsapp: !lead,
    });
    const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
    const toggleProduct = (p: string) => set({ productInterest: f.productInterest.includes(p) ? f.productInterest.filter((x) => x !== p) : [...f.productInterest, p] });

    const submit = (force = false) => {
        setError(null);
        start(async () => {
            const res = await saveLead({
                name: f.name, phone: f.phone, altPhone: f.altPhone, whatsapp: f.sameWhatsapp ? f.phone : f.whatsapp, email: f.email, city: f.city,
                address: f.address, source: f.source, productInterest: f.productInterest, budget: f.budget || 0, priority: f.priority as "Hot" | "Warm" | "Cold",
                status: (f.status || undefined) as never, assignedToId: f.assignedToId || null, notes: f.notes,
                nextFollowUpAt: f.nextFollowUpAt ? fromLocalInput(f.nextFollowUpAt) : null,
            }, lead?.id, { force });
            if (!res.ok) { setError(res.error); setDupe(res.duplicate ?? null); return; }
            router.refresh();
            onClose();
            if (!lead) router.push(leadHref(res.id));
        });
    };

    return (
        <Modal title={lead ? `Edit ${lead.name}` : "Add lead"} onClose={onClose} wide
            footer={<>
                <SecondaryButton onClick={onClose} disabled={pending}>Cancel</SecondaryButton>
                {dupe && <SecondaryButton onClick={() => submit(true)} disabled={pending} className="border-amber-300 text-amber-800">Save anyway</SecondaryButton>}
                <PrimaryButton onClick={() => submit()} disabled={pending}>{pending ? "Saving…" : lead ? "Save changes" : "Add lead"}</PrimaryButton>
            </>}>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-3 sm:grid-cols-2">
                <Field label="Customer name *"><input autoFocus className={fieldCls} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Mobile number *"><input className={fieldCls} inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="98XXXXXXXX" /></Field>
                <Field label="Alternate mobile"><input className={fieldCls} inputMode="tel" value={f.altPhone} onChange={(e) => set({ altPhone: e.target.value })} /></Field>
                <Field label="WhatsApp number">
                    <div className="flex items-center gap-2">
                        <input className={fieldCls} inputMode="tel" disabled={f.sameWhatsapp} value={f.sameWhatsapp ? f.phone : f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
                        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={f.sameWhatsapp} onChange={(e) => set({ sameWhatsapp: e.target.checked, whatsapp: e.target.checked ? "" : f.phone })} />Same</label>
                    </div>
                </Field>
                <Field label="Email"><input className={fieldCls} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
                <Field label="City"><input className={fieldCls} value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
                <Field label="Full address" className="sm:col-span-2"><textarea className={cn(fieldCls, "h-16 py-2")} value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
                <Field label="Lead source">
                    <select className={fieldCls} value={f.source} onChange={(e) => set({ source: e.target.value })}>
                        <option value="">—</option>
                        {[...new Set([...LEAD_SOURCES, ...(f.source ? [f.source] : [])])].map((s) => <option key={s}>{s}</option>)}
                    </select>
                </Field>
                <Field label="Estimated budget (₹)"><input className={fieldCls} type="number" min={0} value={f.budget} onChange={(e) => set({ budget: e.target.value })} /></Field>
                <div className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Product interest</span>
                    <div className="flex flex-wrap gap-1.5">
                        {[...new Set([...PRODUCTS, ...f.productInterest])].map((p) => (
                            <button type="button" key={p} onClick={() => toggleProduct(p)}
                                className={cn("rounded-full border px-3 py-1 text-xs font-medium", f.productInterest.includes(p) ? "border-blue-600 bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>{p}</button>
                        ))}
                    </div>
                </div>
                <Field label="Priority">
                    <div className="flex gap-1.5">
                        {PRIORITIES.map((p) => (
                            <button type="button" key={p} onClick={() => set({ priority: p })}
                                className={cn("flex-1 rounded-md border py-1.5 text-xs font-semibold", f.priority === p ? (p === "Hot" ? "border-red-500 bg-red-50 text-red-700" : p === "Warm" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-sky-500 bg-sky-50 text-sky-700") : "bg-white text-slate-500")}>{p}</button>
                        ))}
                    </div>
                </Field>
                <Field label="Status">
                    <select className={fieldCls} value={f.status} onChange={(e) => set({ status: e.target.value })}>
                        <option value="">{lead ? STATUS_INFO[lead.status as keyof typeof STATUS_INFO]?.label : "Automatic (New / Assigned)"}</option>
                        {LEAD_STATUSES.filter((s) => s !== lead?.status).map((s) => <option key={s} value={s}>{STATUS_INFO[s].label}</option>)}
                    </select>
                </Field>
                {canAssign && (
                    <Field label="Assigned sales executive">
                        <select className={fieldCls} value={f.assignedToId} onChange={(e) => set({ assignedToId: e.target.value })}>
                            <option value="">Unassigned</option>
                            {team.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </Field>
                )}
                {!lead && (
                    <Field label="First follow-up (optional)"><input type="datetime-local" className={fieldCls} value={f.nextFollowUpAt} onChange={(e) => set({ nextFollowUpAt: e.target.value })} /></Field>
                )}
                <Field label="Notes" className="sm:col-span-2"><textarea className={cn(fieldCls, "h-20 py-2")} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
                {error && (
                    <p className="text-sm text-red-600 sm:col-span-2">
                        {error} {dupe && <Link href={leadHref(dupe.id)} className="underline" onClick={onClose}>Open {dupe.code}</Link>}
                    </p>
                )}
                <button type="submit" className="hidden" />
            </form>
        </Modal>
    );
}
