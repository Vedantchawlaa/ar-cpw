"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import type { ClientFileListRow } from "@/lib/actions/client-file-actions";
import { DownloadClientFileButton } from "./ClientFile";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function ClientFilesList({ clients }: { clients: ClientFileListRow[] }) {
    const [query, setQuery] = useState("");
    const [onlyMeasured, setOnlyMeasured] = useState(false);

    const q = query.trim().toLowerCase();
    const rows = clients.filter(
        (c) => (!onlyMeasured || c.measuredAt) && (!q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.phone.includes(q)),
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, city or phone..."
                        className="w-full rounded-md border p-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={onlyMeasured} onChange={(e) => setOnlyMeasured(e.target.checked)} className="h-4 w-4" />
                    Only clients with measurements
                </label>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white">
                {rows.length === 0 ? (
                    <p className="p-10 text-center text-sm text-slate-500">{clients.length === 0 ? "No clients yet." : "No clients match your search."}</p>
                ) : (
                    <div className="divide-y">
                        {rows.map((c) => {
                            const balance = c.quoted - c.received;
                            return (
                                <div key={c.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900">{c.name}</p>
                                        <p className="text-xs text-slate-500">{c.phone} · {c.city} · {c.type} · since {date(c.createdAt)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs lg:w-80">
                                        <span className={c.measuredAt ? "rounded-full bg-green-50 px-2 py-0.5 text-green-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-slate-500"}>
                                            {c.measuredAt ? `Measured ${date(c.measuredAt)}` : "No measurement"}
                                        </span>
                                        {c.quotations > 0 ? (
                                            <span className={balance > 0 ? "rounded-full bg-red-50 px-2 py-0.5 text-red-700" : "rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"}>
                                                {c.quotations} quotation{c.quotations === 1 ? "" : "s"} · {balance > 0 ? `₹${formatCurrency(balance)} due` : "paid"}
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">No quotation</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Link href={`/leads/${c.id}?tab=client-file`}>
                                            <Button variant="outline" className="gap-2"><FolderOpen className="h-4 w-4" />Open file</Button>
                                        </Link>
                                        <DownloadClientFileButton leadId={c.id} compact />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <p className="text-xs text-slate-500">Showing {rows.length} of {clients.length} clients.</p>
        </div>
    );
}
