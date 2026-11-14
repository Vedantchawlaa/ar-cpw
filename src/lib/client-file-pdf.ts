// Builds the printable Client File PDF (A4 portrait) in the browser with jsPDF.
// Only the built-in Helvetica font is used, so text sticks to characters it can
// render: "Rs." instead of the rupee sign, "x" instead of the times sign.

import type { ClientFileData } from "@/lib/actions/client-file-actions";
import { buildJobSummary, trackTotalsByProduct, type JobSummary } from "@/lib/client-file";
import { drawTrackCuttingPlan } from "@/lib/track-cutting-pdf";
import { formatFeetInches } from "@/lib/stock-units";

const M = 15; // page margin, mm
const PAGE_W = 210;
const PAGE_H = 297;
const BLUE: [number, number, number] = [41, 128, 185];
const DARK: [number, number, number] = [30, 41, 59];
const GREY: [number, number, number] = [100, 116, 139];

type Logo = { base64: string; w: number; h: number } | null;

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const inches = (n: number) => `${parseFloat(n.toFixed(2))}"`;
// Helvetica cannot draw these; swap them for plain equivalents
const safe = (s: string) => s.replace(/₹/g, "Rs.").replace(/×/g, "x").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

async function loadLogo(): Promise<Logo> {
    try {
        const blob = await (await fetch("/logo.png")).blob();
        const base64: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        return await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ base64, w: 12 * (img.width / img.height), h: 12 });
            img.onerror = () => resolve(null);
            img.src = base64;
        });
    } catch {
        return null;
    }
}

export async function downloadClientFilePdf(file: ClientFileData) {
    // Loaded on demand to keep them out of the page bundle. Named export first, default as fallback.
    const jspdfModule = await import("jspdf");
    const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default;
    const autotableModule = await import("jspdf-autotable");
    const autoTable = autotableModule.autoTable ?? autotableModule.default;
    const logo = await loadLogo();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const job = buildJobSummary(file.measurement?.data);
    const name = (id?: string | null) => (id && file.productNames[id]) || "";

    const lastY = () => (doc as any).lastAutoTable.finalY as number;
    const table = (opts: any) =>
        autoTable(doc, {
            theme: "grid",
            margin: { left: M, right: M, top: 20, bottom: 18 },
            styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8, textColor: DARK, lineColor: [210, 214, 220], lineWidth: 0.15, overflow: "linebreak" },
            headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
            rowPageBreak: "avoid",
            ...opts,
            body: opts.body.map((row: any[]) => row.map((c) => (typeof c === "string" ? safe(c) : c))),
        });
    const heading = (text: string, y: number) => {
        if (y > PAGE_H - 40) {
            doc.addPage();
            y = 22;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...BLUE);
        doc.text(safe(text), M, y);
        doc.setDrawColor(...BLUE);
        doc.setLineWidth(0.4);
        doc.line(M, y + 1.5, PAGE_W - M, y + 1.5);
        return y + 6;
    };
    const note = (text: string, y: number, size = 8.5) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(...GREY);
        const lines: string[] = doc.splitTextToSize(safe(text), PAGE_W - 2 * M);
        doc.text(lines, M, y);
        return y + lines.length * (size * 0.42) + 2;
    };
    const newPage = (title: string) => {
        doc.addPage();
        return heading(title, 22);
    };

    // ── 1. Client profile ────────────────────────────────────────────────
    if (logo) doc.addImage(logo.base64, "PNG", PAGE_W - M - logo.w, 12, logo.w, logo.h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.text("CLIENT FILE", M, 18);
    doc.setFontSize(22);
    doc.setTextColor(...DARK);
    doc.text(safe(file.lead.name), M, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.text(safe(`${file.lead.phone}  |  ${file.lead.city}`), M, 34);

    let y = heading("Client profile", 44);
    table({
        startY: y,
        theme: "plain",
        styles: { font: "helvetica", fontSize: 9.5, cellPadding: 1.6, textColor: DARK },
        columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", textColor: GREY } },
        body: [
            ["Name", file.lead.name],
            ["Phone", file.lead.phone],
            ["City", file.lead.city],
            ["Handled by", file.lead.handledBy || "-"],
            ["First enquiry", d(file.lead.createdAt)],
            ["Last contacted", d(file.lead.lastContacted)],
            ["Next follow-up", d(file.lead.nextContactDate)],
        ],
    });
    y = lastY() + 3;
    if (file.lead.description) y = note(`Notes: ${file.lead.description}`, y + 2, 9);

    // Job at a glance (no prices: this file goes to the workshop and site)
    const mainTracks = job.tracks.filter((t) => t.layer === "Main").length;
    const totalTrackIn = job.tracks.reduce((s, t) => s + t.finalSize, 0);
    y = heading("Job at a glance", y + 4);
    table({
        startY: y,
        head: [["Windows", "Curtain panels", "Blinds", "Tracks", "Total track length"]],
        body: [[
            String(job.windows.length),
            String(job.curtains.reduce((s, c) => s + c.quantity, 0)),
            String(job.blinds.length),
            `${job.tracks.length} (${mainTracks} main, ${job.tracks.length - mainTracks} sheer)`,
            job.tracks.length ? formatFeetInches(totalTrackIn) : "-",
        ]],
        styles: { font: "helvetica", fontSize: 9, halign: "center", cellPadding: 2, textColor: DARK, lineColor: [210, 214, 220], lineWidth: 0.15 },
    });
    y = lastY() + 4;

    // ── 2. Items (from the quotation, quantities only) ───────────────────
    const quotesWithItems = file.quotations.filter((q) => q.items.length > 0);
    if (quotesWithItems.length > 0) {
        y = heading("Items", y + 4);
        for (const q of quotesWithItems) {
            if (y > PAGE_H - 45) {
                doc.addPage();
                y = 22;
            }
            if (quotesWithItems.length > 1) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.setTextColor(...DARK);
                doc.text(safe(q.number), M, y);
                y += 2;
            }
            table({
                startY: y,
                head: [["Item", "Qty"]],
                body: q.items.map((i) => [i.details ? `${i.description}\n${i.details}` : i.description, String(i.quantity)]),
                columnStyles: { 1: { halign: "right", cellWidth: 25 } },
            });
            y = lastY() + 5;
        }
    }

    // ── 3. Measurements ──────────────────────────────────────────────────
    y = newPage("Measurements");
    if (!file.measurement || job.windows.length === 0) {
        y = note("No measurements recorded yet.", y + 1);
    } else {
        y = note(`Last updated ${d(file.measurement.updatedAt)}. All sizes in inches.`, y);
        table({
            startY: y,
            head: [["Floor / Room", "Window", "Type", "W x H", "Qty", "Style / Mount", "Track", "Sheer", "Product / Fabric", "Remarks"]],
            body: job.windows.map((w) => [
                `${w.floor}\n${w.room}`,
                w.window,
                w.type,
                `${w.width} x ${w.height}`,
                w.quantity,
                w.type === "Curtain" ? `${w.curtainType}\n${w.mount}${w.ties ? "\n+ ties" : ""}` : "-",
                w.type === "Curtain" ? `${w.track}${w.trackProductId && name(w.trackProductId) ? `\n${name(w.trackProductId)}` : ""}` : "-",
                w.sheer + (w.sheerFabricId && name(w.sheerFabricId) ? `\n${name(w.sheerFabricId)}` : ""),
                w.type === "Blind" ? name(w.blindProductId) || "-" : [name(w.fabricId), w.fabricRequired !== "-" ? `Fabric: ${w.fabricRequired}` : ""].filter(Boolean).join("\n") || "-",
                w.remarks || "",
            ]),
            styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.3, textColor: DARK, lineColor: [210, 214, 220], lineWidth: 0.15, overflow: "linebreak" },
            headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.2 },
            columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 18 }, 2: { cellWidth: 12 }, 3: { cellWidth: 16 }, 4: { cellWidth: 8, halign: "center" }, 5: { cellWidth: 19 }, 6: { cellWidth: 18 }, 7: { cellWidth: 25 }, 8: { cellWidth: 24 } },
        });
        y = lastY() + 4;
        if (file.measurement.notes) y = note(`Measurement notes: ${file.measurement.notes}`, y + 1, 9);
    }

    // ── 4. Tracks ────────────────────────────────────────────────────────
    y = newPage("Tracks");
    if (job.tracks.length === 0) {
        y = note("No tracks in this job.", y + 1);
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...DARK);
        doc.text(`Total tracks: ${job.tracks.length}  (${mainTracks} main + ${job.tracks.length - mainTracks} sheer)`, M, y + 1);
        y += 4;
        table({
            startY: y,
            head: [["Track product", "Tracks", "Total length"]],
            body: trackTotalsByProduct(job.tracks, file.productNames).map((t) => [t.name, String(t.count), `${inches(t.totalInches)}  (${formatFeetInches(t.totalInches)})`]),
            columnStyles: { 1: { halign: "center", cellWidth: 20 }, 2: { halign: "right", cellWidth: 55 } },
        });
        y = lastY() + 5;
        table({
            startY: y,
            head: [["#", "Room > Window", "Layer", "Product", "Measured", "Finials", "Endcaps", "Motors", "Cut size", "Mount", "Done"]],
            body: job.tracks.map((t, i) => [
                String(i + 1), `${t.room} > ${t.window}`, t.layer, name(t.productId) || "Not selected",
                inches(t.size), String(t.finials), String(t.endcaps), String(t.motors), inches(t.finalSize), t.mount, "",
            ]),
            styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, textColor: DARK, lineColor: [210, 214, 220], lineWidth: 0.15, overflow: "linebreak" },
            columnStyles: {
                0: { cellWidth: 7, halign: "center" }, 1: { cellWidth: 40 }, 2: { cellWidth: 12 }, 4: { halign: "right", cellWidth: 16 },
                5: { halign: "center", cellWidth: 13 }, 6: { halign: "center", cellWidth: 16 }, 7: { halign: "center", cellWidth: 14 },
                8: { halign: "right", fontStyle: "bold", cellWidth: 16 }, 9: { cellWidth: 13 }, 10: { cellWidth: 10 },
            },
            didDrawCell: (c: any) => {
                if (c.section !== "body" || c.column.index !== 10) return;
                doc.setDrawColor(40, 40, 40);
                doc.setLineWidth(0.3);
                doc.rect(c.cell.x + (c.cell.width - 4) / 2, c.cell.y + (c.cell.height - 4) / 2, 4, 4, "S");
            },
        });
        y = lastY() + 4;
        y = note('Cut size = measured size - 3" per finial - 0.5" per endcap - 3" per motor.', y);
        if (job.vendors.tracks) y = note(`Track vendor: ${job.vendors.tracks}`, y);
        if (file.cuttingPlanSource === "BOOKED" && file.stockBooking) {
            y = note(`Cutting plan (next pages): as booked in stock on ${d(file.stockBooking.appliedAt)} - ${file.stockBooking.piecesUsed} stock piece(s) used, ${file.stockBooking.piecesShortened} shortened, ${file.stockBooking.offcutsAdded} offcut(s) kept.`, y);
        } else if (file.cuttingPlanSource === "LIVE") {
            y = note(`Cutting plan (next pages): planned against stock on ${d(file.generatedAt)}${file.stockBooking ? "" : ", not booked in stock yet - it can change until it is booked"}.`, y);
        }
    }

    // ── 5. Track cutting plan (adds its own pages) ───────────────────────
    if (file.cuttingPlan) {
        drawTrackCuttingPlan(doc, autoTable, file.cuttingPlan, { clientName: file.lead.name, logoData: logo, productNames: file.productNames });
    }

    // ── 6. Curtains & blinds ─────────────────────────────────────────────
    y = newPage("Curtains");
    y = curtainSection(job, file, table, lastY, note, y);
    y = heading("Blinds", y + 6);
    y = blindSection(job, file, table, lastY, note, y);

    // ── 7. Accessories, vendors, files ───────────────────────────────────
    y = heading("Accessories", y + 6);
    const a = job.accessories;
    table({
        startY: y,
        head: [["Item", "Qty", "How it is counted"]],
        body: [
            ["Hooks", String(a.hooks), `${a.rippleCurtains} ripple fold panels x 11 + ${a.pinchCurtains} pinch pleat panels x 7`],
            ["Ceiling brackets", String(a.ceilingBrackets), 'One every 36" per ceiling track, at least 2'],
            ["Wall brackets", String(a.wallBrackets), 'One every 36" per wall track, at least 2'],
            ["Finials", String(a.finials), "From Sizes to Share"],
            ["Endcaps", String(a.endcaps), "From Sizes to Share"],
            ["Motors", String(a.motors), "From Sizes to Share"],
            ["Ties", String(a.ties), "2 per window with ties"],
            ["Umbrella hooks", String(a.umbrellaHooks), "Ties + 2"],
        ].filter((r) => r[1] !== "0"),
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 20, halign: "center", fontStyle: "bold" } },
    });
    y = lastY() + 4;

    const vendorLines = [
        job.vendors.tracks && `Tracks: ${job.vendors.tracks}`,
        job.vendors.curtains && `Curtains: ${job.vendors.curtains}`,
        job.vendors.blinds && `Blinds: ${job.vendors.blinds}`,
    ].filter(Boolean) as string[];
    if (vendorLines.length) {
        y = heading("Vendors", y + 4);
        y = note(vendorLines.join("     "), y + 1, 9.5);
    }
    if (file.measurement && (file.measurement.referenceFiles.length || file.measurement.photoCount)) {
        y = heading("Reference files & photos", y + 4);
        for (const f of file.measurement.referenceFiles) y = note(`${f.name}: ${f.url}`, y, 8);
        if (file.measurement.photoCount) y = note(`${file.measurement.photoCount} measurement photo(s) saved in the app.`, y, 8);
    }

    // Sign-off
    y = heading("Checked & signed", Math.max(y + 6, 0));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text("Measured by: ______________________", M, y + 8);
    doc.text("Checked by: ______________________", PAGE_W / 2 + 5, y + 8);
    doc.text("Installed on: ______________________", M, y + 18);

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY);
        doc.text(safe(`Client File - ${file.lead.name} - ${file.lead.phone}`), M, PAGE_H - 8);
        doc.text(`Printed ${d(file.generatedAt)}  |  Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
    }

    doc.save(`Client File - ${file.lead.name.replace(/[^\w\s-]/g, "").trim() || "client"}.pdf`);
}

function curtainSection(job: JobSummary, file: ClientFileData, table: (o: any) => void, lastY: () => number, note: (t: string, y: number, s?: number) => number, y: number) {
    if (job.curtains.length === 0) return note("No curtains in this job.", y + 1);
    const byFabric = new Map<string, typeof job.curtains>();
    for (const c of job.curtains) {
        const fabric = c.customFabric || (c.fabricId && file.productNames[c.fabricId]) || "Fabric not selected";
        byFabric.set(fabric, [...(byFabric.get(fabric) || []), c]);
    }
    const total = job.curtains.reduce((s, c) => s + c.quantity, 0);
    y = note(`Total: ${total} curtain panel(s). Final size = measured height - 4". Track = cut size of the track the curtain hangs on.`, y, 9);
    for (const [fabric, rows] of byFabric) {
        const comment = job.fabricComments[fabric];
        table({
            startY: y,
            head: [[`${fabric}  (${rows.reduce((s, c) => s + c.quantity, 0)} panels)${comment ? ` - ${comment}` : ""}`, "Layer", "Style", "Mount", "Track", "Panels", "Final size"]],
            body: rows.map((c) => [`${c.room} > ${c.window}`, c.layer, c.curtainType, c.mount, c.trackSize === null ? "No track" : inches(c.trackSize), String(c.quantity), inches(c.finalHeight)]),
            columnStyles: { 3: { cellWidth: 16 }, 4: { halign: "right", cellWidth: 18 }, 5: { halign: "center", cellWidth: 15 }, 6: { halign: "right", fontStyle: "bold", cellWidth: 20 } },
        });
        y = lastY() + 4;
    }
    if (job.vendors.curtains) y = note(`Curtain vendor: ${job.vendors.curtains}`, y);
    return y;
}

function blindSection(job: JobSummary, file: ClientFileData, table: (o: any) => void, lastY: () => number, note: (t: string, y: number, s?: number) => number, y: number) {
    if (job.blinds.length === 0) return note("No blinds in this job.", y + 1);
    const byVendor = new Map<string, typeof job.blinds>();
    for (const b of job.blinds) byVendor.set(b.vendor, [...(byVendor.get(b.vendor) || []), b]);
    for (const [vendor, rows] of byVendor) {
        table({
            startY: y,
            head: [[`${vendor}  (${rows.length})`, "Product", "Shade / details", "Production size (W x H)"]],
            body: rows.map((b) => [`${b.room} > ${b.window}`, (b.productId && file.productNames[b.productId]) || "-", b.shade, `${b.width}" x ${b.height}"`]),
            columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
        });
        y = lastY() + 4;
    }
    return y;
}
