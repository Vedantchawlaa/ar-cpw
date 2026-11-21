"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelFollowUp, completeFollowUp, rescheduleFollowUp, scheduleFollowUp } from "@/lib/actions/crm-actions";
import { Field, Modal, PrimaryButton, SecondaryButton, fieldCls } from "./Modal";
import { fmtDateTime, fromLocalInput, toLocalInput } from "./ui";
import { cn } from "@/lib/utils";

/** Quick picks: later today, tomorrow 11 am, in 3 days, next week. */
function quickTimes() {
    const now = new Date();
    const at = (daysAhead: number, hour: number) => {
        const ist = new Date(now.getTime() + 330 * 60000);
        ist.setUTCDate(ist.getUTCDate() + daysAhead);
        ist.setUTCHours(hour, 0, 0, 0);
        return new Date(ist.getTime() - 330 * 60000);
    };
    const inTwoHours = new Date(Math.ceil((now.getTime() + 2 * 3600000) / 900000) * 900000);
    return [
        { label: "In 2 hours", at: inTwoHours },
        { label: "Tomorrow 11 am", at: at(1, 11) },
        { label: "In 3 days", at: at(3, 11) },
        { label: "Next week", at: at(7, 11) },
    ];
}

function WhenPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {quickTimes().map((q) => (
                    <button type="button" key={q.label} onClick={() => onChange(toLocalInput(q.at))}
                        className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", value === toLocalInput(q.at) ? "border-blue-600 bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50")}>{q.label}</button>
                ))}
            </div>
            <input type="datetime-local" className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function useSubmit(onClose: () => void) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const submit = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
        setError(null);
        start(async () => {
            const res = await fn();
            if (!res.ok) return setError(res.error ?? "Could not save");
            router.refresh();
            onClose();
        });
    };
    return { pending, error, submit };
}

export function ScheduleFollowUpDialog({ leadId, leadName, team, defaultAssignee, canAssign, onClose }: {
    leadId: string; leadName: string; team: Array<{ value: string; label: string }>; defaultAssignee: string | null; canAssign: boolean; onClose: () => void;
}) {
    const [when, setWhen] = useState(toLocalInput(quickTimes()[1].at));
    const [notes, setNotes] = useState("");
    const [assignee, setAssignee] = useState(defaultAssignee ?? "");
    const { pending, error, submit } = useSubmit(onClose);
    return (
        <Modal title={`Schedule follow-up · ${leadName}`} onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={pending || !when} onClick={() => submit(() => scheduleFollowUp(leadId, { dueAt: fromLocalInput(when), notes, assignedToId: assignee || null }))}>{pending ? "Saving…" : "Schedule"}</PrimaryButton></>}>
            <div className="space-y-3">
                <Field label="When"><WhenPicker value={when} onChange={setWhen} /></Field>
                <Field label="What to discuss"><textarea className={cn(fieldCls, "h-20 py-2")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Share revised quotation for 3 rooms" /></Field>
                {canAssign && (
                    <Field label="Assigned to">
                        <select className={fieldCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                            <option value="">Lead&apos;s salesperson</option>
                            {team.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </Field>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </Modal>
    );
}

export interface FollowUpLite { id: string; dueAt: Date | string; notes: string | null; lead: { name: string } }

export function CompleteFollowUpDialog({ fu, onClose }: { fu: FollowUpLite; onClose: () => void }) {
    const [outcome, setOutcome] = useState("");
    const [another, setAnother] = useState(false);
    const [when, setWhen] = useState(toLocalInput(quickTimes()[2].at));
    const [nextNotes, setNextNotes] = useState("");
    const { pending, error, submit } = useSubmit(onClose);
    return (
        <Modal title={`Complete follow-up · ${fu.lead.name}`} onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={pending} onClick={() => submit(() => completeFollowUp(fu.id, outcome, another ? { dueAt: fromLocalInput(when), notes: nextNotes } : null))}>{pending ? "Saving…" : "Mark done"}</PrimaryButton></>}>
            <div className="space-y-3">
                <p className="text-xs text-slate-500">Due {fmtDateTime(fu.dueAt)}{fu.notes && ` · ${fu.notes}`}</p>
                <Field label="What happened? *"><textarea autoFocus className={cn(fieldCls, "h-20 py-2")} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Customer will visit the showroom on Saturday" /></Field>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} />Schedule the next follow-up</label>
                {another && <>
                    <WhenPicker value={when} onChange={setWhen} />
                    <input className={fieldCls} value={nextNotes} onChange={(e) => setNextNotes(e.target.value)} placeholder="Next follow-up notes" />
                </>}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </Modal>
    );
}

export function RescheduleFollowUpDialog({ fu, onClose }: { fu: FollowUpLite; onClose: () => void }) {
    const [when, setWhen] = useState(toLocalInput(quickTimes()[1].at));
    const [reason, setReason] = useState("");
    const { pending, error, submit } = useSubmit(onClose);
    return (
        <Modal title={`Reschedule · ${fu.lead.name}`} onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={pending || !when} onClick={() => submit(() => rescheduleFollowUp(fu.id, fromLocalInput(when), reason))}>{pending ? "Saving…" : "Reschedule"}</PrimaryButton></>}>
            <div className="space-y-3">
                <p className="text-xs text-slate-500">Was due {fmtDateTime(fu.dueAt)}. The original date stays in the history.</p>
                <Field label="New date and time"><WhenPicker value={when} onChange={setWhen} /></Field>
                <Field label="Reason"><input className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer travelling till Monday" /></Field>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </Modal>
    );
}

export function CancelFollowUpDialog({ fu, onClose }: { fu: FollowUpLite; onClose: () => void }) {
    const [reason, setReason] = useState("");
    const { pending, error, submit } = useSubmit(onClose);
    return (
        <Modal title={`Cancel follow-up · ${fu.lead.name}`} onClose={onClose}
            footer={<><SecondaryButton onClick={onClose}>Keep it</SecondaryButton><PrimaryButton className="bg-red-600 hover:bg-red-700" disabled={pending} onClick={() => submit(() => cancelFollowUp(fu.id, reason))}>{pending ? "Saving…" : "Cancel follow-up"}</PrimaryButton></>}>
            <Field label="Why? *"><input autoFocus className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </Modal>
    );
}
