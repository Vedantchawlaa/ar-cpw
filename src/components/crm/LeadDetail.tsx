"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Phone, MessageCircle, PhoneCall, CalendarPlus, Pencil, Mail, MapPin, IndianRupee, Tag, User, Clock, StickyNote, ArrowRightLeft, FileText,
    PhoneIncoming, PhoneOutgoing, Sparkles, Upload, ChevronLeft, CheckCircle2, CalendarClock, Info,
} from "lucide-react";
import { addLeadNote, changeLeadStatus, dialLead, logManualCall } from "@/lib/actions/crm-actions";
import { CALL_STATUSES, CALL_STATUS_INFO, LEAD_STATUSES, STATUS_INFO, followUpBucket, formatDuration, leadCode } from "@/lib/sales-crm";
import { formatCurrency, cn } from "@/lib/utils";
import { CRM_BASE, CallStatusBadge, PriorityBadge, SourceTag, StatusBadge, fmtDate, fmtDateTime, fromLocalInput, toLocalInput } from "./ui";
import { Field, Modal, PrimaryButton, SecondaryButton, fieldCls } from "./Modal";
import { LeadFormDialog, type EditableLead } from "./LeadFormDialog";
import { CancelFollowUpDialog, CompleteFollowUpDialog, RescheduleFollowUpDialog, ScheduleFollowUpDialog, type FollowUpLite } from "./FollowUpDialogs";

type D = Date | string;
interface Call { id: string; direction: string; status: string; source: string; startedAt: D; durationSec: number | null; talkSec: number | null; notes: string | null; userId: string | null; recordingUrl: string | null }
interface FollowUp { id: string; dueAt: D; notes: string | null; status: string; outcome: string | null; completedAt: D | null; assignedToId: string | null; createdById: string | null; completedById: string | null; createdAt: D }
interface Activity { id: string; type: string; summary: string; userId: string | null; createdAt: D }
interface StatusRow { id: string; fromStatus: string | null; toStatus: string; changedById: string | null; note: string | null; createdAt: D }
interface Quote { id: string; number: string; date: D; total: number; status: string }

export interface LeadDetailData extends EditableLead {
    leadNo: number; createdAt: D; lastContacted: D | null; nextContactDate: D | null; convertedAt: D | null; lostReason: string | null;
    assignedTo: { id: string; name: string } | null; user: { id: string; name: string } | null;
    calls: Call[]; followUps: FollowUp[]; activities: Activity[]; statusHistory: StatusRow[]; quotations: Quote[];
}

const ACTIVITY_ICON: Record<string, typeof Phone> = {
    CREATED: Sparkles, UPDATED: Pencil, NOTE: StickyNote, CALL: PhoneCall, CALL_DIALED: Phone, FOLLOW_UP: CalendarClock, STATUS: ArrowRightLeft, ASSIGNED: User, IMPORTED: Upload,
};

export function LeadDetail({ lead, names, team, canManage, telephony }: {
    lead: LeadDetailData; names: Record<string, string>; team: Array<{ value: string; label: string }>; canManage: boolean; telephony: "exotel" | null;
}) {
    const router = useRouter();
    const [tab, setTab] = useState<"timeline" | "calls" | "followups" | "status" | "quotes">("timeline");
    const [dialog, setDialog] = useState<null | "edit" | "call" | "followup" | "status">(null);
    const [fuDialog, setFuDialog] = useState<null | { kind: "done" | "move" | "cancel"; fu: FollowUpLite }>(null);
    const [note, setNote] = useState("");
    const [pending, start] = useTransition();
    const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
    const who = (id: string | null) => (id ? names[id] ?? "Former user" : "System");

    const call = (which: "phone" | "altPhone" | "whatsapp" = "phone") => start(async () => {
        setMsg(null);
        const res = await dialLead(lead.id, which);
        if (!res.ok) return setMsg({ text: res.error, error: true });
        if (res.mode === "dialer") window.location.href = `tel:${res.tel}`;
        else setMsg({ text: "Exotel is ringing your phone. Pick up to be connected to the customer; the call will appear here when it ends." });
        router.refresh();
    });

    const saveNote = () => start(async () => {
        const res = await addLeadNote(lead.id, note);
        if (!res.ok) return setMsg({ text: res.error, error: true });
        setNote("");
        router.refresh();
    });

    const pendingFollowUps = lead.followUps.filter((f) => f.status === "PENDING").sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const verifiedCalls = lead.calls.filter((c) => c.source !== "MANUAL");
    const talk = verifiedCalls.reduce((t, c) => t + (c.status === "CONNECTED" ? c.talkSec ?? 0 : 0), 0);
    const wa = (lead.whatsapp || lead.phone).replace(/\D/g, "");

    return (
        <div className="space-y-4">
            <Link href={`${CRM_BASE}/list`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ChevronLeft className="h-4 w-4" />All leads</Link>

            {/* header */}
            <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">{lead.name}</h2>
                        <span className="font-mono text-xs font-semibold text-slate-400">{leadCode(lead.leadNo)}</span>
                        <StatusBadge status={lead.status} />
                        <PriorityBadge priority={lead.type} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        {lead.assignedTo ? <>Assigned to <b className="text-slate-700">{lead.assignedTo.name}</b></> : <span className="font-medium text-amber-700">Unassigned</span>}
                        {" · "}Created {fmtDate(lead.createdAt)}{lead.user && ` by ${lead.user.name}`}
                        {" · "}Last contacted {lead.lastContacted ? fmtDateTime(lead.lastContacted) : "never"}
                    </p>
                    {lead.status === "LOST" && lead.lostReason && <p className="mt-1 text-sm text-red-600">Lost: {lead.lostReason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button disabled={pending} onClick={() => call()} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"><Phone className="h-4 w-4" />Call</button>
                    <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><MessageCircle className="h-4 w-4 text-green-600" />WhatsApp</a>
                    <button onClick={() => setDialog("call")} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><PhoneCall className="h-4 w-4" />Log call</button>
                    <button onClick={() => setDialog("followup")} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><CalendarPlus className="h-4 w-4" />Follow-up</button>
                    <button onClick={() => setDialog("status")} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><ArrowRightLeft className="h-4 w-4" />Status</button>
                    <button onClick={() => setDialog("edit")} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4" />Edit</button>
                </div>
            </div>
            {!telephony && (
                <p className="flex items-start gap-1.5 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Call opens your phone dialer. The call itself is recorded when the CPW Team app uploads your phone&apos;s call log (or by a telephony provider once connected). Pressing Call is not counted as a call.</p>
            )}
            {msg && <p className={cn("text-sm", msg.error ? "text-red-600" : "text-green-700")}>{msg.text}</p>}

            <div className="grid gap-4 lg:grid-cols-3">
                {/* left: info */}
                <div className="space-y-4">
                    <section className="rounded-xl border bg-white p-4 shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold text-slate-800">Customer</h3>
                        <dl className="space-y-2.5 text-sm">
                            <Info2 icon={Phone} label="Mobile"><a className="text-blue-700 hover:underline" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>{lead.phone}</a></Info2>
                            {lead.altPhone && <Info2 icon={Phone} label="Alternate"><button onClick={() => call("altPhone")} className="text-blue-700 hover:underline">{lead.altPhone}</button></Info2>}
                            {lead.whatsapp && <Info2 icon={MessageCircle} label="WhatsApp">{lead.whatsapp}</Info2>}
                            {lead.email && <Info2 icon={Mail} label="Email"><a className="text-blue-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></Info2>}
                            <Info2 icon={MapPin} label="Address">{[lead.address, lead.city].filter(Boolean).join(", ") || "–"}</Info2>
                            <Info2 icon={Tag} label="Interest">{lead.productInterest.join(", ") || "–"}</Info2>
                            <Info2 icon={IndianRupee} label="Budget">{lead.expectedOrderValue ? `₹${formatCurrency(lead.expectedOrderValue)}` : "–"}</Info2>
                            <Info2 icon={Sparkles} label="Source">{lead.source || "–"}</Info2>
                        </dl>
                        {lead.description && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{lead.description}</p>}
                    </section>

                    <section className="rounded-xl border bg-white p-4 shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold text-slate-800">Activity summary</h3>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div><p className="text-lg font-bold text-slate-900">{verifiedCalls.length}</p><p className="text-[11px] text-slate-500">calls</p></div>
                            <div><p className="text-lg font-bold text-slate-900">{verifiedCalls.filter((c) => c.status === "CONNECTED").length}</p><p className="text-[11px] text-slate-500">connected</p></div>
                            <div><p className="text-lg font-bold text-slate-900">{formatDuration(talk)}</p><p className="text-[11px] text-slate-500">talk time</p></div>
                        </div>
                    </section>

                    <section className="rounded-xl border bg-white p-4 shadow-sm">
                        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Upcoming follow-ups</h3><button onClick={() => setDialog("followup")} className="text-xs text-blue-600 hover:underline">Add</button></div>
                        {pendingFollowUps.length === 0 ? (
                            <p className={cn("text-xs", lead.status !== "CONVERTED" && lead.status !== "LOST" ? "font-medium text-amber-700" : "text-slate-400")}>
                                {lead.status !== "CONVERTED" && lead.status !== "LOST" ? "No follow-up scheduled. Schedule one so this lead isn't forgotten." : "None."}
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {pendingFollowUps.map((f) => {
                                    const b = followUpBucket(new Date(f.dueAt));
                                    const lite = { id: f.id, dueAt: f.dueAt, notes: f.notes, lead: { name: lead.name } };
                                    return (
                                        <li key={f.id} className={cn("rounded-lg border p-2.5 text-sm", b === "OVERDUE" ? "border-red-200 bg-red-50" : b === "TODAY" ? "border-amber-200 bg-amber-50" : "")}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={cn("font-semibold", b === "OVERDUE" ? "text-red-700" : "text-slate-800")}>{fmtDateTime(f.dueAt)}{b === "OVERDUE" && " · overdue"}</span>
                                                <span className="text-[11px] text-slate-500">{who(f.assignedToId)}</span>
                                            </div>
                                            {f.notes && <p className="mt-0.5 text-xs text-slate-600">{f.notes}</p>}
                                            <div className="mt-1.5 flex gap-3 text-xs">
                                                <button onClick={() => setFuDialog({ kind: "done", fu: lite })} className="font-semibold text-green-700 hover:underline">Done</button>
                                                <button onClick={() => setFuDialog({ kind: "move", fu: lite })} className="text-slate-600 hover:underline">Reschedule</button>
                                                <button onClick={() => setFuDialog({ kind: "cancel", fu: lite })} className="text-slate-400 hover:text-red-600">Cancel</button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>

                {/* right: history */}
                <section className="rounded-xl border bg-white shadow-sm lg:col-span-2">
                    <div className="flex gap-1 overflow-x-auto border-b px-2">
                        {([["timeline", "Timeline"], ["calls", `Calls (${lead.calls.length})`], ["followups", `Follow-ups (${lead.followUps.length})`], ["status", "Status history"], ["quotes", `Quotations (${lead.quotations.length})`]] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium", tab === k ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{l}</button>
                        ))}
                    </div>
                    <div className="p-4">
                        {tab === "timeline" && (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or remark…" className={cn(fieldCls, "h-16 py-2")} />
                                    <PrimaryButton disabled={pending || !note.trim()} onClick={saveNote} className="self-end">Add</PrimaryButton>
                                </div>
                                {lead.activities.length === 0 ? <p className="text-sm text-slate-400">No activity yet.</p> : (
                                    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                                        {lead.activities.map((a) => {
                                            const Icon = ACTIVITY_ICON[a.type] ?? Clock;
                                            return (
                                                <li key={a.id} className="relative">
                                                    <span className="absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border bg-white"><Icon className="h-3 w-3 text-slate-500" /></span>
                                                    <p className={cn("text-sm", a.type === "NOTE" ? "whitespace-pre-wrap rounded-lg bg-amber-50/60 p-2 text-slate-800" : "text-slate-700")}>{a.summary}</p>
                                                    <p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(a.createdAt)} · {who(a.userId)}</p>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </div>
                        )}
                        {tab === "calls" && (lead.calls.length === 0 ? <p className="text-sm text-slate-400">No calls recorded for this lead.</p> : (
                            <ul className="divide-y">
                                {lead.calls.map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                                        <div className="flex items-start gap-2">
                                            {c.direction === "INCOMING" ? <PhoneIncoming className="mt-0.5 h-4 w-4 text-sky-600" /> : <PhoneOutgoing className="mt-0.5 h-4 w-4 text-indigo-600" />}
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2"><CallStatusBadge status={c.status} /><SourceTag source={c.source} /><span className="text-xs text-slate-500">{fmtDateTime(c.startedAt)} · {who(c.userId)}</span></div>
                                                {c.notes && <p className="mt-1 text-xs text-slate-600">{c.notes}</p>}
                                                {c.recordingUrl && <a href={c.recordingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">Recording</a>}
                                            </div>
                                        </div>
                                        <span className="text-xs tabular-nums text-slate-600">{c.source === "MANUAL" ? "—" : c.status === "CONNECTED" ? `${formatDuration(c.talkSec)} talk` : formatDuration(c.durationSec)}</span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                        {tab === "followups" && (lead.followUps.length === 0 ? <p className="text-sm text-slate-400">No follow-ups yet.</p> : (
                            <ul className="divide-y">
                                {lead.followUps.map((f) => (
                                    <li key={f.id} className="py-2.5 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-medium text-slate-800">{fmtDateTime(f.dueAt)}</span>
                                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", f.status === "DONE" ? "bg-green-100 text-green-700" : f.status === "PENDING" ? (followUpBucket(new Date(f.dueAt)) === "OVERDUE" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700") : "bg-slate-100 text-slate-600")}>
                                                {f.status === "PENDING" && followUpBucket(new Date(f.dueAt)) === "OVERDUE" ? "Overdue" : f.status.charAt(0) + f.status.slice(1).toLowerCase()}
                                            </span>
                                        </div>
                                        {f.notes && <p className="text-xs text-slate-600">{f.notes}</p>}
                                        {f.outcome && <p className="mt-0.5 text-xs text-slate-700"><CheckCircle2 className="mr-1 inline h-3 w-3 text-green-600" />{f.outcome}</p>}
                                        <p className="mt-0.5 text-[11px] text-slate-400">For {who(f.assignedToId)} · set by {who(f.createdById)}{f.completedAt && ` · closed ${fmtDateTime(f.completedAt)} by ${who(f.completedById)}`}</p>
                                    </li>
                                ))}
                            </ul>
                        ))}
                        {tab === "status" && (
                            <ul className="divide-y">
                                {lead.statusHistory.map((s) => (
                                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                                        {s.fromStatus ? <StatusBadge status={s.fromStatus} /> : <span className="text-xs text-slate-400">Created as</span>}
                                        {s.fromStatus && <span className="text-slate-300">→</span>}
                                        <StatusBadge status={s.toStatus} />
                                        {s.note && <span className="text-xs text-slate-600">{s.note}</span>}
                                        <span className="ml-auto text-[11px] text-slate-400">{fmtDateTime(s.createdAt)} · {who(s.changedById)}</span>
                                    </li>
                                ))}
                                {lead.statusHistory.length === 0 && <p className="text-sm text-slate-400">No status changes recorded yet.</p>}
                            </ul>
                        )}
                        {tab === "quotes" && (lead.quotations.length === 0 ? <p className="text-sm text-slate-400">No quotations for this customer yet. <Link href="/quotations" className="text-blue-600 hover:underline">Quotations</Link></p> : (
                            <ul className="divide-y">
                                {lead.quotations.map((q) => (
                                    <li key={q.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                                        <Link href={`/quotations/${q.id}`} className="flex items-center gap-2 font-medium text-blue-700 hover:underline"><FileText className="h-4 w-4" />{q.number}</Link>
                                        <span className="text-xs text-slate-500">{fmtDate(q.date)} · {q.status}</span>
                                        <span className="font-semibold tabular-nums">₹{formatCurrency(q.total)}</span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                    </div>
                </section>
            </div>

            {dialog === "edit" && <LeadFormDialog lead={lead} team={team} canAssign={canManage} onClose={() => setDialog(null)} />}
            {dialog === "followup" && <ScheduleFollowUpDialog leadId={lead.id} leadName={lead.name} team={team} defaultAssignee={lead.assignedToId} canAssign={canManage} onClose={() => setDialog(null)} />}
            {dialog === "call" && <LogCallDialog lead={lead} onClose={() => setDialog(null)} />}
            {dialog === "status" && <StatusDialog lead={lead} onClose={() => setDialog(null)} />}
            {fuDialog?.kind === "done" && <CompleteFollowUpDialog fu={fuDialog.fu} onClose={() => setFuDialog(null)} />}
            {fuDialog?.kind === "move" && <RescheduleFollowUpDialog fu={fuDialog.fu} onClose={() => setFuDialog(null)} />}
            {fuDialog?.kind === "cancel" && <CancelFollowUpDialog fu={fuDialog.fu} onClose={() => setFuDialog(null)} />}
        </div>
    );
}

function Info2({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
            <dd className="min-w-0 break-words text-slate-800">{children}</dd>
        </div>
    );
}

function LogCallDialog({ lead, onClose }: { lead: LeadDetailData; onClose: () => void }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [f, setF] = useState({ direction: "OUTGOING", status: "CONNECTED", at: toLocalInput(new Date()), notes: "", next: "", newStatus: "" });
    const submit = () => start(async () => {
        const res = await logManualCall(lead.id, {
            direction: f.direction as "OUTGOING", status: f.status as "CONNECTED", at: fromLocalInput(f.at), notes: f.notes,
            nextFollowUpAt: f.next ? fromLocalInput(f.next) : null, newStatus: (f.newStatus || null) as never,
        });
        if (!res.ok) return setError(res.error);
        router.refresh();
        onClose();
    });
    return (
        <Modal title={`Log a call · ${lead.name}`} onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={pending} onClick={submit}>{pending ? "Saving…" : "Save"}</PrimaryButton></>}>
            <div className="space-y-3">
                <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">Use this for calls the system could not record (e.g. from a personal phone). It is saved as <b>self-reported</b> and does not add talk time.</p>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Direction">
                        <select className={fieldCls} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="OUTGOING">Outgoing</option><option value="INCOMING">Incoming</option></select>
                    </Field>
                    <Field label="Result">
                        <select className={fieldCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{CALL_STATUSES.map((s) => <option key={s} value={s}>{CALL_STATUS_INFO[s].label}</option>)}</select>
                    </Field>
                </div>
                <Field label="When"><input type="datetime-local" className={fieldCls} value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} /></Field>
                <Field label="Call notes"><textarea className={cn(fieldCls, "h-20 py-2")} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Next follow-up"><input type="datetime-local" className={fieldCls} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
                    <Field label="Update status">
                        <select className={fieldCls} value={f.newStatus} onChange={(e) => setF({ ...f, newStatus: e.target.value })}>
                            <option value="">Keep {STATUS_INFO[lead.status as keyof typeof STATUS_INFO]?.label}</option>
                            {LEAD_STATUSES.filter((s) => s !== lead.status && s !== "LOST").map((s) => <option key={s} value={s}>{STATUS_INFO[s].label}</option>)}
                        </select>
                    </Field>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </Modal>
    );
}

function StatusDialog({ lead, onClose }: { lead: LeadDetailData; onClose: () => void }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState("");
    const [note, setNote] = useState("");
    const submit = () => start(async () => {
        const res = await changeLeadStatus(lead.id, status, note);
        if (!res.ok) return setError(res.error);
        router.refresh();
        onClose();
    });
    return (
        <Modal title="Change status" onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={pending || !status} onClick={submit}>{pending ? "Saving…" : "Save"}</PrimaryButton></>}>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {LEAD_STATUSES.map((s) => (
                        <button key={s} disabled={s === lead.status} onClick={() => setStatus(s)}
                            className={cn("rounded-lg border px-2 py-2 text-xs font-semibold disabled:opacity-40", status === s ? "border-blue-600 ring-2 ring-blue-100" : "hover:bg-slate-50")}>
                            <StatusBadge status={s} />
                        </button>
                    ))}
                </div>
                <Field label={status === "LOST" ? "Why was it lost? *" : "Note (optional)"}><input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </Modal>
    );
}
