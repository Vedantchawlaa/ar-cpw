"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Download, CheckCircle2 } from "lucide-react";
import { importLeads } from "@/lib/actions/crm-actions";
import { mapImportRow } from "@/lib/sales-crm";
import { Field, Modal, PrimaryButton, SecondaryButton, fieldCls } from "./Modal";

const TEMPLATE_HEADERS = ["Customer Name", "Mobile Number", "Alternate Mobile", "WhatsApp", "Email", "City", "Address", "Lead Source", "Product Interest", "Estimated Budget", "Priority", "Status", "Assigned To", "Next Follow-up", "Notes"];

async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ["Ramesh Mehta", "9876543210", "", "9876543210", "ramesh@example.com", "Delhi", "12 Model Town", "Walk-in", "Curtains, Blinds", 45000, "Hot", "New", "", "05/12/2026", "Wants blackout curtains for 3 rooms"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "lead-import-template.xlsx");
}

export function ImportDialog({ team, onClose }: { team: Array<{ value: string; label: string }>; onClose: () => void }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [rows, setRows] = useState<Array<Record<string, unknown>> | null>(null);
    const [fileName, setFileName] = useState("");
    const [assignee, setAssignee] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ created: number; skipped: Array<{ row: number; reason: string }> } | null>(null);

    const preview = rows ? rows.map((r) => mapImportRow(r)) : [];
    const valid = preview.filter((p) => p.ok).length;

    async function readFile(file: File) {
        setError(null); setResult(null);
        if (file.size > 5 * 1024 * 1024) return setError("The file is larger than 5 MB.");
        try {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
            if (!data.length) return setError("No rows found in the first sheet.");
            setRows(data.slice(0, 2000));
            setFileName(file.name);
            if (data.length > 2000) setError(`Only the first 2000 of ${data.length} rows will be imported. Split the file for the rest.`);
        } catch {
            setError("Could not read that file. Use .xlsx, .xls or .csv.");
        }
    }

    const submit = () => start(async () => {
        if (!rows) return;
        const res = await importLeads(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v]))), assignee || null);
        if (!res.ok) return setError(res.error);
        setResult({ created: res.created, skipped: res.skipped });
        router.refresh();
    });

    return (
        <Modal title="Import leads from Excel / CSV" onClose={onClose} wide
            footer={result ? <PrimaryButton onClick={onClose}>Done</PrimaryButton> : <>
                <SecondaryButton onClick={onClose} disabled={pending}>Cancel</SecondaryButton>
                <PrimaryButton onClick={submit} disabled={pending || !rows || valid === 0}>{pending ? "Importing…" : `Import ${valid} lead${valid === 1 ? "" : "s"}`}</PrimaryButton>
            </>}>
            {result ? (
                <div className="space-y-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><CheckCircle2 className="h-5 w-5" />{result.created} lead{result.created === 1 ? "" : "s"} imported.</p>
                    {result.skipped.length > 0 && (
                        <div>
                            <p className="mb-1 text-sm font-medium text-slate-700">{result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped:</p>
                            <ul className="max-h-60 space-y-0.5 overflow-y-auto rounded border bg-slate-50 p-2 text-xs text-slate-600">
                                {result.skipped.map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        The first row must be headers. Recognised columns: name, mobile, alternate mobile, WhatsApp, email, city, address, source, product interest, budget,
                        priority (Hot/Warm/Cold), status, assigned to (email or name), next follow-up (DD/MM/YYYY) and notes. Rows with a mobile number that already exists are skipped.
                    </p>
                    <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"><Download className="h-4 w-4" />Download template</button>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center hover:bg-slate-50">
                        <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{fileName || "Choose a file"}</span>
                        <span className="text-xs text-slate-400">.xlsx, .xls or .csv · up to 2000 rows</span>
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
                    </label>
                    {rows && (
                        <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                            <p><b>{rows.length}</b> rows read · <b className="text-green-700">{valid}</b> look valid{rows.length - valid > 0 && <> · <b className="text-red-600">{rows.length - valid}</b> have problems</>}</p>
                            {preview.some((p) => !p.ok) && (
                                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-600">
                                    {preview.map((p, i) => (!p.ok ? <li key={i}>Row {i + 2}: {p.error}</li> : null))}
                                </ul>
                            )}
                        </div>
                    )}
                    <Field label="Assign rows without an 'Assigned To' column to">
                        <select className={fieldCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                            <option value="">Leave unassigned</option>
                            {team.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </Field>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
            )}
        </Modal>
    );
}
