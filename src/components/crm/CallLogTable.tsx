"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneIncoming, PhoneOutgoing, Search, StickyNote } from "lucide-react";
import { updateCallNotes } from "@/lib/actions/crm-actions";
import { formatDuration, leadCode } from "@/lib/sales-crm";
import { CallStatusBadge, EmptyState, Pager, SourceTag, fmtDateTime, fmtTime, fromLocalInput, leadHref, toLocalInput, useQueryUpdate } from "./ui";
import { Field, Modal, PrimaryButton, SecondaryButton, fieldCls } from "./Modal";
import { cn } from "@/lib/utils";

interface Row {
    id: string; direction: string; status: string; source: string; phone: string; startedAt: Date; endedAt: Date | null; durationSec: number | null; talkSec: number | null;
    notes: string | null; nextFollowUpAt: Date | null; recordingUrl: string | null; userId: string | null;
    lead: { id: string; leadNo: number; name: string } | null; user: { id: string; name: string } | null;
}

export function CallLogTable({ rows, total, page, pages, meId, canManage }: { rows: Row[]; total: number; page: number; pages: number; meId: string; canManage: boolean }) {
    const { params, update } = useQueryUpdate();
    const [q, setQ] = useState(params.get("q") ?? "");
    const [editing, setEditing] = useState<Row | null>(null);
    return (
        <div className="space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || null }); }} className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or lead name" className="h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm" />
            </form>
            {rows.length === 0 ? (
                <EmptyState title="No calls in this period">Calls appear here when the CPW Team app uploads the phone&apos;s call log, or when a connected telephony provider reports them.</EmptyState>
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Call</th><th className="px-3 py-2">Lead / number</th><th className="px-3 py-2">Salesperson</th><th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Start – End</th><th className="px-3 py-2 text-right">Duration</th><th className="px-3 py-2 text-right">Talk</th><th className="px-3 py-2">Notes / next follow-up</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t align-top hover:bg-slate-50/60">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                            {r.direction === "INCOMING" ? <PhoneIncoming className="h-3.5 w-3.5 text-sky-600" /> : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-600" />}
                                            {r.direction === "INCOMING" ? "Incoming" : "Outgoing"}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10px] text-slate-400" title={r.id}>{r.id.slice(0, 8)}</div>
                                        <SourceTag source={r.source} />
                                    </td>
                                    <td className="px-3 py-2">
                                        {r.lead ? <Link href={leadHref(r.lead.id)} className="font-semibold text-slate-800 hover:text-blue-700">{r.lead.name} <span className="font-mono text-[10px] font-normal text-slate-400">{leadCode(r.lead.leadNo)}</span></Link> : <span className="text-xs text-amber-700">No lead matched</span>}
                                        <div className="text-xs text-slate-500">{r.phone}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600">{r.user?.name ?? "—"}</td>
                                    <td className="px-3 py-2"><CallStatusBadge status={r.status} /></td>
                                    <td className="px-3 py-2 text-xs text-slate-600">{fmtDateTime(r.startedAt)}{r.endedAt && <> – {fmtTime(r.endedAt)}</>}</td>
                                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">{r.source === "MANUAL" ? "—" : formatDuration(r.durationSec)}</td>
                                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-800">{r.source === "MANUAL" ? "—" : formatDuration(r.talkSec)}</td>
                                    <td className="max-w-xs px-3 py-2 text-xs text-slate-600">
                                        {r.notes && <p className="line-clamp-2">{r.notes}</p>}
                                        {r.nextFollowUpAt && <p className="text-slate-500">Next: {fmtDateTime(r.nextFollowUpAt)}</p>}
                                        {r.recordingUrl && <a href={r.recordingUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Recording</a>}
                                        {(r.userId === meId || canManage) && <button onClick={() => setEditing(r)} className="mt-0.5 inline-flex items-center gap-1 text-blue-600 hover:underline"><StickyNote className="h-3 w-3" />{r.notes ? "Edit" : "Add note"}</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pager page={page} pages={pages} total={total} />
            {editing && <CallNoteDialog call={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}

function CallNoteDialog({ call, onClose }: { call: Row; onClose: () => void }) {
    const router = useRouter();
    const [notes, setNotes] = useState(call.notes ?? "");
    const [next, setNext] = useState(call.nextFollowUpAt ? toLocalInput(new Date(call.nextFollowUpAt)) : "");
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();
    return (
        <Modal title={`Call notes · ${call.lead?.name ?? call.phone}`} onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={pending} onClick={() => start(async () => {
                const res = await updateCallNotes(call.id, notes, next ? fromLocalInput(next) : null);
                if (!res.ok) return setError(res.error);
                router.refresh(); onClose();
            })}>{pending ? "Saving…" : "Save"}</PrimaryButton></>}>
            <div className="space-y-3">
                <Field label="Notes"><textarea autoFocus className={cn(fieldCls, "h-24 py-2")} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                {call.lead && <Field label="Next follow-up (creates a follow-up on the lead)"><input type="datetime-local" className={fieldCls} value={next} onChange={(e) => setNext(e.target.value)} /></Field>}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </Modal>
    );
}
