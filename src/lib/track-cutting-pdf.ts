import { type CuttingPlan, formatInches, formatStockLength, purchaseSummary, type ProductCuttingPlan, type StockAwarePlan } from "@/lib/track-optimizer";
import { formatFeetInches } from "@/lib/stock-units";

const MARGIN = 15; // mm, on every side
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_SPACE = 12; // reserved above the bottom margin for the purchase line

const PIECE_COLORS: Array<[number, number, number]> = [[74, 144, 217], [245, 166, 35]]; // #4a90d9 / #f5a623
const OFFCUT_COLOR: [number, number, number] = [221, 221, 221]; // #dddddd

interface CuttingPlanPdfOptions {
    clientName?: string;
    logoData?: { base64: string, w: number, h: number } | null;
    productNames?: Record<string, string>;
}

const groupLabel = (group: ProductCuttingPlan, productNames: Record<string, string>) =>
    group.productId ? productNames[group.productId] || "Track" : "Track product not selected";

const hasWork = (group: ProductCuttingPlan) => group.fromStock.length > 0 || group.plan.bars.length > 0 || group.plan.oversized.length > 0;

// Appends the "Track Cutting Plan" to an existing jsPDF document: one section
// per track product, each listing the stock pieces to cut first and then the
// new bars.
export function drawTrackCuttingPlan(doc: any, autoTable: any, result: StockAwarePlan, options: CuttingPlanPdfOptions = {}) {
    const groups = result.groups.filter(hasWork);
    if (groups.length === 0) return;

    const productNames = options.productNames ?? {};
    const purchase = groups
        .filter(g => g.plan.totalBars > 0 || g.plan.oversized.length > 0)
        .map(g => (groups.length > 1 ? `${groupLabel(g, productNames)}: ` : "") + purchaseSummary(g.plan, 'x'));

    groups.forEach((group, index) => {
        drawProductSection(doc, autoTable, group, {
            ...options,
            title: groups.length > 1 || group.productId ? groupLabel(group, productNames) : undefined,
            purchaseLine: index === groups.length - 1 ? (purchase.length ? purchase.join("  |  ") : "none - stock covers everything") : null,
        });
    });
}

// Only the built-in Helvetica font is used, so the text is kept to characters it can render.
function drawProductSection(
    doc: any,
    autoTable: any,
    group: ProductCuttingPlan,
    options: CuttingPlanPdfOptions & { title?: string; purchaseLine: string | null }
) {
    const plan: CuttingPlan = group.plan;
    const { clientName, logoData } = options;
    const stockLabel = `${formatStockLength(plan.stockLength)} = ${formatInches(plan.stockLength)}`;

    doc.addPage();
    if (logoData) doc.addImage(logoData.base64, 'PNG', PAGE_W - MARGIN - logoData.w, 10, logoData.w, logoData.h);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text(options.title ? `Track Cutting Plan - ${options.title}` : "Track Cutting Plan", MARGIN, 20);

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const headerLine = `${clientName || "Project"}  |  Stock: ${stockLabel}  |  No joints allowed  |  Date: ____________`;
    const headerLines: string[] = doc.splitTextToSize(headerLine, CONTENT_W);
    doc.text(headerLines, MARGIN, 28);

    let y = 28 + headerLines.length * 4 + 2;

    if (group.fromStock.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(21, 101, 52);
        doc.text("1. Cut from stock first", MARGIN, y + 2);
        autoTable(doc, {
            startY: y + 4,
            margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + FOOTER_SPACE },
            head: [['Stock piece', 'Cut pieces', 'Used', 'Left', 'Done']],
            body: group.fromStock.map(use => [
                `${formatFeetInches(use.stockLength)}\n(${formatInches(use.stockLength)})`,
                use.pieces.map(p => `${p.label} - ${formatInches(p.length)}`).join('\n'),
                formatInches(use.usedLength),
                use.isKeep ? `${formatInches(use.offcut)}\nback to stock` : formatInches(use.offcut),
                '',
            ]),
            theme: 'plain',
            rowPageBreak: 'avoid',
            styles: { font: 'helvetica', fontSize: 9, textColor: [20, 20, 20], cellPadding: 2, valign: 'middle', lineColor: [205, 205, 205], lineWidth: { bottom: 0.2 }, minCellHeight: 10 },
            headStyles: { fillColor: [22, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold', minCellHeight: 8 },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 82 },
                2: { cellWidth: 20, halign: 'right' },
                3: { cellWidth: 38, halign: 'right' },
                4: { cellWidth: 12, halign: 'center' },
            },
            didDrawCell: (data: any) => {
                if (data.section !== 'body' || data.column.index !== 4) return;
                const box = 4.5;
                doc.setDrawColor(40, 40, 40);
                doc.setLineWidth(0.3);
                doc.rect(data.cell.x + (data.cell.width - box) / 2, data.cell.y + (data.cell.height - box) / 2, box, box, 'S');
            },
        });
        y = (doc as any).lastAutoTable.finalY + 8;

        if (plan.bars.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text("2. New bars", MARGIN, y);
            y += 2;
        }
    }

    if (plan.bars.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + FOOTER_SPACE },
            head: [['#', 'Cut pieces', 'Used', 'Offcut', 'Cut layout', 'Done']],
            body: plan.bars.map(bar => [
                bar.barNo,
                bar.pieces.map(p => `${p.label} - ${formatInches(p.length)}`).join('\n'),
                formatInches(bar.usedLength),
                bar.isKeep ? `${formatInches(bar.offcut)}\nKEEP` : formatInches(bar.offcut),
                '',
                ''
            ]),
            theme: 'plain',
            rowPageBreak: 'avoid',
            styles: { font: 'helvetica', fontSize: 9, textColor: [20, 20, 20], cellPadding: 2, valign: 'middle', lineColor: [205, 205, 205], lineWidth: { bottom: 0.2 }, minCellHeight: 12 },
            headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', minCellHeight: 8 },
            columnStyles: {
                0: { cellWidth: 9, halign: 'center' },
                1: { cellWidth: 62 },
                2: { cellWidth: 17, halign: 'right' },
                3: { cellWidth: 18, halign: 'right' },
                4: { cellWidth: 62 },
                5: { cellWidth: 12, halign: 'center' },
            },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 3 && plan.bars[data.row.index]?.isKeep) {
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            didDrawCell: (data: any) => {
                if (data.section !== 'body') return;
                const bar = plan.bars[data.row.index];
                if (!bar) return;
                const { x, y: cellY, width, height } = data.cell;

                if (data.column.index === 4) {
                    const barX = x + 2;
                    const barW = width - 4;
                    const barH = 7;
                    const barY = cellY + (height - barH) / 2;

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7);
                    const label = (text: string, segX: number, segW: number) => {
                        if (doc.getTextWidth(text) <= segW - 1) doc.text(text, segX + segW / 2, barY + barH / 2, { align: 'center', baseline: 'middle' });
                    };

                    let segX = barX;
                    bar.pieces.forEach((piece, i) => {
                        const segW = (piece.length / plan.stockLength) * barW;
                        doc.setFillColor(...PIECE_COLORS[i % 2]);
                        doc.rect(segX, barY, segW, barH, 'F');
                        doc.setTextColor(255, 255, 255);
                        label(formatInches(piece.length), segX, segW);
                        segX += segW;
                    });

                    const offcutW = barX + barW - segX;
                    if (bar.offcut > 0 && offcutW > 0) {
                        doc.setFillColor(...OFFCUT_COLOR);
                        doc.rect(segX, barY, offcutW, barH, 'F');
                        doc.setTextColor(50, 50, 50);
                        label(formatInches(bar.offcut), segX, offcutW);
                    }

                    // Cut lines + outline keep the segments readable in black & white
                    doc.setDrawColor(40, 40, 40);
                    doc.setLineWidth(0.25);
                    let cutX = barX;
                    bar.pieces.forEach((piece, i) => {
                        cutX += (piece.length / plan.stockLength) * barW;
                        if (i < bar.pieces.length - 1 || bar.offcut > 0) doc.line(cutX, barY, cutX, barY + barH);
                    });
                    doc.rect(barX, barY, barW, barH, 'S');
                }

                if (data.column.index === 5) {
                    const box = 4.5;
                    doc.setDrawColor(40, 40, 40);
                    doc.setLineWidth(0.3);
                    doc.rect(x + (width - box) / 2, cellY + (height - box) / 2, box, box, 'S');
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    const bottomLimit = PAGE_H - MARGIN - FOOTER_SPACE;
    const ensureSpace = (needed: number) => {
        if (y + needed > bottomLimit) {
            doc.addPage();
            y = MARGIN + 5;
        }
    };

    // Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    ensureSpace(6);
    const stockLine = group.fromStock.length > 0 ? `${group.fromStock.length} stock ${group.fromStock.length === 1 ? 'piece' : 'pieces'}  |  ` : '';
    doc.text(
        `Total: ${stockLine}${plan.totalBars} new ${plan.totalBars === 1 ? 'track' : 'tracks'} of ${formatStockLength(plan.stockLength)}  |  Used ${formatInches(plan.totalUsed)}  |  Offcut ${formatInches(plan.totalOffcut)}`,
        MARGIN, y
    );
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const notes: string[] = [];
    if (plan.keepOffcuts.length > 0) {
        notes.push(`KEEP offcuts for future small windows (${formatInches(plan.keepThreshold)} or longer): ${plan.keepOffcuts.map(formatInches).join(', ')}`);
    }
    if (plan.kerf > 0) notes.push(`Blade allowance: ${formatInches(plan.kerf)} per cut is included in "Used".`);
    notes.forEach(note => {
        const lines: string[] = doc.splitTextToSize(note, CONTENT_W);
        ensureSpace(lines.length * 4.5);
        doc.text(lines, MARGIN, y);
        y += lines.length * 4.5;
    });

    // Separate order box
    if (plan.oversized.length > 0) {
        const lines = plan.oversized.map(p =>
            `${p.label} - ${formatInches(p.length)}   ->   order ${p.suggestedLength ? `${formatStockLength(p.suggestedLength)} track` : 'custom length track'}`
        );
        const boxH = 9 + lines.length * 5 + 2;
        y += 3;
        ensureSpace(boxH);
        doc.setFillColor(253, 232, 232);
        doc.setDrawColor(190, 70, 70);
        doc.setLineWidth(0.3);
        doc.rect(MARGIN, y, CONTENT_W, boxH, 'FD');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(120, 20, 20);
        doc.text(`Separate order required (longer than ${formatStockLength(plan.stockLength)})`, MARGIN + 3, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 20);
        lines.forEach((line, i) => doc.text(line, MARGIN + 3, y + 12 + i * 5));
        y += boxH;
    }

    // Purchase line for every product, pinned to the bottom of the last page
    if (options.purchaseLine === null) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    // Several track products can need two lines; they grow upwards from the bottom margin
    const purchaseLines: string[] = doc.splitTextToSize(`Bars to cut / purchase: ${options.purchaseLine}`, CONTENT_W).slice(0, 2);
    const footerY = PAGE_H - MARGIN - 2;
    const firstLineY = footerY - (purchaseLines.length - 1) * 5;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, firstLineY - 6, PAGE_W - MARGIN, firstLineY - 6);
    doc.text(purchaseLines, MARGIN, firstLineY);
}
