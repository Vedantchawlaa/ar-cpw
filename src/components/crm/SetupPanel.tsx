"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Smartphone, Webhook, PhoneForwarded } from "lucide-react";
import { updateSalesMember } from "@/lib/actions/crm-actions";
import { Panel } from "./ui";
import { cn } from "@/lib/utils";

interface Member { id: string; name: string; email: string; role: string; salesRole: string | null; managerId: string | null; phone: string | null }
interface Telephony { webhook: boolean; clickToCall: string | null; missing: string[]; appUrl: string | null; deviceCallsAll: boolean }

export function SetupPanel({ members, telephony }: { members: Member[]; telephony: Telephony }) {
    const managers = members.filter((m) => m.role === "user" && m.salesRole === "MANAGER");
    return (
        <div className="space-y-4">
            <Panel title="Sales team roles">
                <p className="mb-3 text-xs text-slate-500">Admins see everything. A sales manager sees their team&apos;s leads, calls and status. Everyone else is a sales executive and sees only their own leads. The phone number is used for click-to-call and to match provider calls to the right person.</p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-2 pr-3">Person</th><th className="px-2 py-2">Sales role</th><th className="px-2 py-2">Reports to</th><th className="px-2 py-2">Own mobile</th><th /></tr></thead>
                        <tbody>{members.map((m) => <MemberRow key={m.id} m={m} managers={managers} />)}</tbody>
                    </table>
                </div>
            </Panel>

            <Panel title="Call tracking">
                <div className="space-y-4 text-sm">
                    <Source ok icon={Smartphone} title="Phone call log (CPW Team Android app)">
                        The app reads each salesperson&apos;s call log and posts it to <code className="rounded bg-slate-100 px-1">POST /api/mobile/calls</code> with their app login.
                        This server endpoint is ready; the app needs a call-log reader added (separate project).
                        {telephony.deviceCallsAll ? " All calls are kept (CRM_DEVICE_CALLS=all)." : " Only calls to/from numbers that belong to a lead are kept, so personal calls stay private. Set CRM_DEVICE_CALLS=all on company SIMs to keep every call."}
                    </Source>
                    <Source ok={telephony.webhook} icon={Webhook} title="Cloud telephony webhook">
                        {telephony.webhook
                            ? <>Ready. Point your provider&apos;s status callback to <code className="break-all rounded bg-slate-100 px-1">{telephony.appUrl ?? "https://your-site"}/api/telephony/exotel?token=…</code> (or <code className="rounded bg-slate-100 px-1">/generic</code> for any other provider).</>
                            : <>Set <code className="rounded bg-slate-100 px-1">TELEPHONY_WEBHOOK_SECRET</code> to accept call reports from a provider.</>}
                    </Source>
                    <Source ok={!!telephony.clickToCall} icon={PhoneForwarded} title="Click-to-call through Exotel">
                        {telephony.clickToCall
                            ? "Ready. Pressing Call rings the salesperson's own mobile (set above), then connects the customer, with the call recorded by Exotel."
                            : <>Needs {telephony.missing.map((v, i) => <span key={v}>{i ? ", " : ""}<code className="rounded bg-slate-100 px-1">{v}</code></span>)}. Until then, Call opens the phone dialer and nothing is counted until the call log or a provider reports it.</>}
                    </Source>
                </div>
            </Panel>
        </div>
    );
}

function Source({ ok, icon: Icon, title, children }: { ok: boolean; icon: typeof Smartphone; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div>
                <p className="flex items-center gap-1.5 font-semibold text-slate-800">{title}{ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-slate-300" />}</p>
                <p className="text-xs text-slate-600">{children}</p>
            </div>
        </div>
    );
}

function MemberRow({ m, managers }: { m: Member; managers: Member[] }) {
    const router = useRouter();
    const [f, setF] = useState({ salesRole: m.salesRole === "MANAGER" ? "MANAGER" : "EXECUTIVE", managerId: m.managerId ?? "", phone: m.phone ?? "" });
    const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
    const [pending, start] = useTransition();
    const dirty = f.salesRole !== (m.salesRole === "MANAGER" ? "MANAGER" : "EXECUTIVE") || f.managerId !== (m.managerId ?? "") || f.phone !== (m.phone ?? "");
    const isAdmin = m.role === "admin";
    const save = () => start(async () => {
        const res = await updateSalesMember(m.id, { salesRole: f.salesRole as "MANAGER", managerId: f.managerId || null, phone: f.phone || null });
        setMsg(res.ok ? { text: "Saved" } : { text: res.error, error: true });
        router.refresh();
    });
    return (
        <tr className="border-t align-top">
            <td className="py-2 pr-3"><p className="font-medium text-slate-800">{m.name}</p><p className="text-[11px] text-slate-400">{m.email}</p></td>
            <td className="px-2 py-2">
                {isAdmin ? <span className="text-xs font-semibold text-slate-500">Admin</span> : (
                    <select className="h-8 rounded-md border px-2 text-sm" value={f.salesRole} onChange={(e) => setF({ ...f, salesRole: e.target.value, managerId: e.target.value === "MANAGER" ? "" : f.managerId })}>
                        <option value="EXECUTIVE">Sales executive</option><option value="MANAGER">Sales manager</option>
                    </select>
                )}
            </td>
            <td className="px-2 py-2">
                {!isAdmin && f.salesRole === "EXECUTIVE" && (
                    <select className="h-8 rounded-md border px-2 text-sm" value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })}>
                        <option value="">No manager</option>
                        {managers.filter((x) => x.id !== m.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                )}
            </td>
            <td className="px-2 py-2"><input className="h-8 w-36 rounded-md border px-2 text-sm" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98XXXXXXXX" /></td>
            <td className="px-2 py-2 text-right">
                <button disabled={!dirty || pending} onClick={save} className={cn("rounded-md px-3 py-1 text-xs font-semibold", dirty ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400")}>{pending ? "…" : "Save"}</button>
                {msg && <p className={cn("mt-0.5 text-[11px]", msg.error ? "text-red-600" : "text-green-700")}>{msg.text}</p>}
            </td>
        </tr>
    );
}
