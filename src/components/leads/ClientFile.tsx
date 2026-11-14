"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Loader2, Phone, MapPin, User, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getClientFileData, updateCurtainStyles, type ClientFileData, type CurtainStyleChange } from "@/lib/actions/client-file-actions";
import { cn, formatCurrency } from "@/lib/utils";
import { buildJobSummary, trackTotalsByProduct, type WindowRow } from "@/lib/client-file";
import { formatFeetInches } from "@/lib/stock-units";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

/** Download button on its own, for the page header. Loads the data when clicked. */
export function DownloadClientFileButton({ leadId, data, compact }: { leadId: string; data?: ClientFileData | null; compact?: boolean }) {
    const [busy, setBusy] = useState(false);
    const download = async () => {
        setBusy(true);
        try {
            let file = data ?? null;
            if (!file) {
                const res = await getClientFileData(leadId);
                if (!res.ok) return alert(res.error);
                file = res.data;
            }
            const { downloadClientFilePdf } = await import("@/lib/client-file-pdf");
            await downloadClientFilePdf(file);
        } catch (err) {
            console.error(err);
            alert("Could not create the client file.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Button onClick={download} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {busy ? "Preparing..." : compact ? "Download" : "Download Client File"}
        </Button>
    );
}

export function ClientFile({ leadId }: { leadId: string }) {
    const [result, setResult] = useState<Awaited<ReturnType<typeof getClientFileData>> | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let live = true;
        getClientFileData(leadId).then((r) => { if (live) setResult(r); });
        return () => { live = false; };
    }, [leadId, version]);

    const file = result?.ok ? result.data : null;
    const job = useMemo(() => buildJobSummary(file?.measurement?.data), [file]);

    if (!result) return <p className="py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading client file...</p>;
    if (!result.ok || !file) return <p className="py-10 text-center text-sm text-red-600">{result.ok ? "" : result.error}</p>;

    const quoted = file.quotations.reduce((s, q) => s + q.total, 0);
    const received = file.quotations.reduce((s, q) => s + q.receivedAmount, 0);
    const mainTracks = job.tracks.filter((t) => t.layer === "Main").length;
    const trackTotals = trackTotalsByProduct(job.tracks, file.productNames);
    const curtainPanels = job.curtains.reduce((s, c) => s + c.quantity, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-900">Printable client file</p>
                    <p className="text-xs text-slate-500">
                        One PDF with the profile, items, every measurement, track sizes, cutting plan, curtains, blinds and accessories.
                    </p>
                </div>
                <DownloadClientFileButton leadId={leadId} data={file} />
            </div>

            <CurtainStyleEditor
                key={file.generatedAt}
                leadId={leadId}
                windows={job.windows.filter((w) => w.type === "Curtain")}
                onSaved={() => setVersion((v) => v + 1)}
            />

            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Client profile</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{file.lead.phone}</p>
                        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{file.lead.city}</p>
                        <p className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" />{file.lead.type}{file.lead.handledBy ? ` · handled by ${file.lead.handledBy}` : ""}</p>
                        <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-slate-400" />Since {date(file.lead.createdAt)} · next follow-up {date(file.lead.nextContactDate)}</p>
                        <p className="text-slate-500">Expected order: ₹{formatCurrency(file.lead.expectedOrderValue)}</p>
                        {file.lead.description && <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">{file.lead.description}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Payments</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <Stat label="Quoted" value={`₹${formatCurrency(quoted)}`} />
                            <Stat label="Received" value={`₹${formatCurrency(received)}`} className="text-emerald-600" />
                            <Stat label="Balance" value={`₹${formatCurrency(quoted - received)}`} className={quoted - received > 0 ? "text-red-600" : ""} />
                        </div>
                        {file.quotations.length === 0 ? (
                            <p className="text-xs text-slate-500">No quotations yet.</p>
                        ) : (
                            <div className="divide-y rounded-md border text-xs">
                                {file.quotations.map((q) => (
                                    <div key={q.number} className="flex justify-between gap-2 px-2 py-1.5">
                                        <span className="font-medium">{q.number} <span className="text-slate-400">· {q.status.toLowerCase()}</span></span>
                                        <span>₹{formatCurrency(q.receivedAmount)} / ₹{formatCurrency(q.total)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Job</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <Stat label="Windows" value={String(job.windows.length)} />
                            <Stat label="Curtains" value={String(curtainPanels)} />
                            <Stat label="Blinds" value={String(job.blinds.length)} />
                        </div>
                        <p className="font-medium">
                            {job.tracks.length} track{job.tracks.length === 1 ? "" : "s"}
                            <span className="font-normal text-slate-500"> ({mainTracks} main, {job.tracks.length - mainTracks} sheer)</span>
                        </p>
                        {trackTotals.map((t) => (
                            <p key={t.name} className="flex justify-between text-xs text-slate-600">
                                <span>{t.name} × {t.count}</span>
                                <span>{formatFeetInches(t.totalInches)}</span>
                            </p>
                        ))}
                        <p className="text-xs text-slate-500">
                            {file.cuttingPlanSource === "BOOKED" && file.stockBooking
                                ? `Cutting plan booked in stock on ${date(file.stockBooking.appliedAt)}.`
                                : file.cuttingPlanSource === "LIVE"
                                    ? "Cutting plan uses today's stock (not booked yet)."
                                    : "No tracks to plan yet."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {job.tracks.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Track sizes</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-2 py-2 text-left">Room › Window</th>
                                    <th className="px-2 py-2 text-left">Layer</th>
                                    <th className="px-2 py-2 text-left">Product</th>
                                    <th className="px-2 py-2 text-right">Measured</th>
                                    <th className="px-2 py-2 text-center">Finials / Endcaps / Motors</th>
                                    <th className="px-2 py-2 text-right text-blue-600">Cut size</th>
                                    <th className="px-2 py-2 text-left">Mount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {job.tracks.map((t, i) => (
                                    <tr key={i}>
                                        <td className="px-2 py-1.5">{t.room} › {t.window}</td>
                                        <td className="px-2 py-1.5">{t.layer}</td>
                                        <td className="px-2 py-1.5 text-slate-600">{(t.productId && file.productNames[t.productId]) || "Not selected"}</td>
                                        <td className="px-2 py-1.5 text-right">{t.size}&quot;</td>
                                        <td className="px-2 py-1.5 text-center text-slate-500">{t.finials} / {t.endcaps} / {t.motors}</td>
                                        <td className="px-2 py-1.5 text-right font-semibold text-blue-600">{t.finalSize}&quot;</td>
                                        <td className="px-2 py-1.5">{t.mount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
    return (
        <div className="rounded-md bg-slate-50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`text-sm font-bold text-slate-900 ${className}`}>{value}</p>
        </div>
    );
}

type Style = { curtainType: string; mount: string };
const STYLE_OPTIONS = [{ value: "Ripple Fold", label: "Ripple" }, { value: "Pinch Pleat", label: "Pleat" }];
const MOUNT_OPTIONS = [{ value: "Wall", label: "Wall" }, { value: "Ceiling", label: "Ceiling" }];

/** Click to set ripple / pleat and wall / ceiling for each curtain window, then save. */
function CurtainStyleEditor({ leadId, windows, onSaved }: { leadId: string; windows: WindowRow[]; onSaved: () => void }) {
    const saved = useMemo(() => Object.fromEntries(windows.map((w) => [w.itemId, { curtainType: w.curtainType, mount: w.mount }])), [windows]);
    const [styles, setStyles] = useState<Record<string, Style>>(saved);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    if (windows.length === 0) return null;

    const changes: CurtainStyleChange[] = windows
        .filter((w) => styles[w.itemId].curtainType !== saved[w.itemId].curtainType || styles[w.itemId].mount !== saved[w.itemId].mount)
        .map((w) => ({
            itemId: w.itemId,
            curtainType: styles[w.itemId].curtainType as CurtainStyleChange["curtainType"],
            mountType: styles[w.itemId].mount as CurtainStyleChange["mountType"],
        }));

    const set = (id: string, patch: Partial<Style>) => {
        setMessage(null);
        setStyles((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
    };
    const setAll = (patch: Partial<Style>) => {
        setMessage(null);
        setStyles((s) => Object.fromEntries(Object.entries(s).map(([id, v]) => [id, { ...v, ...patch }])));
    };

    const save = async () => {
        setSaving(true);
        const res = await updateCurtainStyles(leadId, changes);
        setSaving(false);
        if (res.ok) {
            setMessage({ ok: true, text: `Saved ${changes.length} window${changes.length === 1 ? "" : "s"}.` });
            onSaved();
        } else {
            setMessage({ ok: false, text: res.error });
        }
    };

    const count = (key: keyof Style, value: string) => windows.filter((w) => styles[w.itemId][key] === value).length;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                    <CardTitle className="text-base">Curtain style &amp; mounting</CardTitle>
                    <p className="text-xs text-slate-500">
                        Click to choose ripple or pleat, and wall or ceiling, for each window. Used in the file and the accessory counts.
                    </p>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                    <span className="self-center text-slate-400">Set all:</span>
                    {[...STYLE_OPTIONS.map((o) => ({ ...o, key: "curtainType" as const })), ...MOUNT_OPTIONS.map((o) => ({ ...o, key: "mount" as const }))].map((o) => (
                        <button key={o.value} type="button" onClick={() => setAll({ [o.key]: o.value })} className="rounded-md border px-2 py-1 text-slate-600 hover:bg-slate-50">
                            {o.label}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">
                    {count("curtainType", "Ripple Fold")} ripple · {count("curtainType", "Pinch Pleat")} pleat · {count("mount", "Wall")} wall · {count("mount", "Ceiling")} ceiling
                </p>
                <div className="divide-y rounded-md border">
                    {windows.map((w) => (
                        <div key={w.itemId} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1 text-sm">
                                <span className="font-medium text-slate-900">{w.room} › {w.window}</span>
                                <span className="ml-2 text-xs text-slate-400">{w.floor} · {w.width} x {w.height}{w.track !== "No" ? ` · track ${w.track}` : " · no track"}</span>
                            </div>
                            <div className="flex gap-2">
                                <Segmented options={STYLE_OPTIONS} value={styles[w.itemId].curtainType} onChange={(v) => set(w.itemId, { curtainType: v })} />
                                <Segmented options={MOUNT_OPTIONS} value={styles[w.itemId].mount} onChange={(v) => set(w.itemId, { mount: v })} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-end gap-3">
                    {message && <span className={cn("text-sm", message.ok ? "text-emerald-600" : "text-red-600")}>{message.text}</span>}
                    {changes.length > 0 && (
                        <Button variant="ghost" onClick={() => { setStyles(saved); setMessage(null); }} disabled={saving}>Undo changes</Button>
                    )}
                    <Button onClick={save} disabled={saving || changes.length === 0}>
                        {saving ? "Saving..." : changes.length ? `Save ${changes.length} change${changes.length === 1 ? "" : "s"}` : "No changes"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="inline-flex rounded-md border bg-slate-50 p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    aria-pressed={value === o.value}
                    className={cn(
                        "rounded px-3 py-1 text-xs font-medium transition-colors",
                        value === o.value ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
