'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Plus, Ruler, Search, FileDown, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
// @ts-ignore
import { formatDistanceToNow } from "date-fns";
import { deleteMeasurement, generateQuotationFromMeasurement } from "@/lib/actions/measurement-actions";
import { getProducts } from "@/lib/actions/product-actions";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function MeasurementList({ measurements }: { measurements: any[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [exportTarget, setExportTarget] = useState<any | null>(null);
    const [exportTypes, setExportTypes] = useState<{ curtain: boolean; blind: boolean; detailed: boolean }>({ curtain: true, blind: true, detailed: false });
    const router = useRouter();

    const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
            return;
        }

        const result = await deleteMeasurement(id);
        if (result.success) {
            router.refresh();
        } else {
            alert(result.error || "Failed to delete measurement");
        }
    };

    const handleGenerateQuotation = async (id: string, title: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Navigate to quotation builder with measurement ID
        router.push(`/quotations/new?measurementId=${id}`);
    };

    // Rounds a track width (in inches) up to the nearest half-foot:
    // e.g. 10ft 1in-10ft 6in -> 10ft 6in, 10ft 7in-11ft -> 11ft
    const formatTrackSize = (inches: number) => {
        const widthInches = inches || 0;
        if (widthInches <= 0) return { label: '0ft', feet: 0 };
        const halfUnits = Math.ceil(widthInches / 6);
        const feet = Math.floor(halfUnits / 2);
        const hasHalf = halfUnits % 2 === 1;
        return { label: hasHalf ? `${feet}ft 6in` : `${feet}ft`, feet: halfUnits * 0.5 };
    };

    const filtered = measurements.filter(m =>
        (m.customerName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (m.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (m.lead?.name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );

    const generatePDF = async (measurement: any, typeFilter: { curtain: boolean; blind: boolean; detailed: boolean }, e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();

        try {
            // @ts-ignore
            const jsPDF = (await import('jspdf')).default;
            // @ts-ignore
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Fetch products once for lookup
            const productsRes = await getProducts();
            const productMap: Record<string, string> = {};
            if (productsRes.success && productsRes.data) {
                productsRes.data.forEach((p: any) => {
                    productMap[p.id] = p.name;
                });
            }

            // Header
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text(measurement.title || 'Measurement Sheet', 15, 20);

            // Date info
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Date: ${formatDate(measurement.updatedAt)}`, 15, 30);
            doc.text('Chawla Parde Wala', pageWidth - 15, 30, { align: 'right' });

            let yPos = 40;

            // Grand totals across the whole sheet
            let grandMainFabricMeters = 0;
            let grandSheerFabricMeters = 0;
            let grandBlindSqft = 0;
            let grandCurtainCount = 0;
            let grandMainTrackFeet = 0;
            let grandSheerTrackFeet = 0;

            // Process each floor
            const floors = measurement.data?.floors || [];
            floors.forEach((floor: any, floorIdx: number) => {
                // Keep only the item types the user selected; skip the whole
                // floor if nothing survives the filter
                const rooms = (floor.rooms || [])
                    .map((room: any) => ({
                        ...room,
                        items: (room.items || []).filter((item: any) =>
                            (item.type === 'Curtain' && typeFilter.curtain) ||
                            (item.type === 'Blind' && typeFilter.blind)
                        )
                    }))
                    .filter((room: any) => room.items.length > 0);

                if (rooms.length === 0) return;

                // Floor header
                doc.setFillColor(240, 240, 240);
                doc.rect(15, yPos, pageWidth - 30, 8, 'F');
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(floor.name, 17, yPos + 5);
                yPos += 12;

                rooms.forEach((room: any) => {
                    // Room name
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(room.name, 17, yPos);
                    yPos += 6;

                    // Items table
                    let roomMainFabricMeters = 0;
                    let roomSheerFabricMeters = 0;
                    let roomBlindSqft = 0;
                    let roomMainTrackFeet = 0;
                    let roomSheerTrackFeet = 0;
                    let roomCurtainCount = 0;

                    const tableData = room.items?.map((item: any) => {
                        const productDetails: string[] = [];
                        if (item.type === 'Curtain') {
                            const mainFabric = parseFloat(item.fabricRequired) || 0;
                            roomMainFabricMeters += mainFabric;
                            productDetails.push(`Main: ${productMap[item.fabricProduct] || 'Fabric'} - ${mainFabric.toFixed(2)}m`);

                            if (item.sheerRequired) {
                                const sheerFabric = parseFloat(item.sheerFabricRequired) || 0;
                                roomSheerFabricMeters += sheerFabric;
                                productDetails.push(`Sheer: ${productMap[item.sheerFabricProduct] || 'Sheer'} - ${sheerFabric.toFixed(2)}m`);
                            }
                        } else if (item.type === 'Blind') {
                            const blindArea = parseFloat(item.sqft) || 0;
                            roomBlindSqft += blindArea;
                            productDetails.push(`${productMap[item.blindProduct] || 'Blind'} - ${blindArea.toFixed(2)}sf`);
                        }

                        const trackDetails: string[] = [];
                        if (item.type === 'Curtain' && item.trackRequired !== false) {
                            const mainQty = parseInt(item.quantity, 10) || 1;
                            roomCurtainCount += mainQty;
                            if (item.sheerRequired) {
                                roomCurtainCount += parseInt(item.sheerQuantity, 10) || mainQty;
                            }

                            const mainTrack = formatTrackSize(parseFloat(item.trackSize) || 0);
                            roomMainTrackFeet += mainTrack.feet;
                            trackDetails.push(`Main: ${productMap[item.trackProduct] || 'Track'} - ${mainTrack.label}`);

                            if (item.sheerRequired) {
                                const sTrackId = item.sheerTrackProduct || item.trackProduct;
                                const sheerTrack = formatTrackSize(parseFloat(item.sheerTrackSize || item.trackSize) || 0);
                                roomSheerTrackFeet += sheerTrack.feet;
                                trackDetails.push(`Sheer: ${productMap[sTrackId] || 'Sheer Track'} - ${sheerTrack.label}`);
                            }
                        }

                        const qtyDisplay = item.type === 'Curtain'
                            ? (item.sheerRequired ? `${item.quantity}+${item.sheerQuantity}` : item.quantity)
                            : item.sqft || '-';

                        if (typeFilter.detailed) {
                            const styleDetails: string[] = [];
                            if (item.type === 'Curtain') {
                                if (item.mountType) styleDetails.push(`Mount: ${item.mountType}`);
                                if (item.curtainType) styleDetails.push(`Style: ${item.curtainType}`);
                                styleDetails.push(`Ties: ${item.tiesRequired ? 'Yes' : 'No'}`);
                            }

                            return [
                                item.name,
                                item.type,
                                `${item.width} x ${item.height}`,
                                qtyDisplay,
                                productDetails.join('\n') || '-',
                                trackDetails.join('\n') || '-',
                                styleDetails.join('\n') || '-',
                                item.remarks || ''
                            ];
                        }

                        return [
                            item.name,
                            item.type,
                            qtyDisplay,
                            productDetails.join('\n') || '-',
                            trackDetails.join('\n') || '-',
                            item.remarks || ''
                        ];
                    }) || [];

                    autoTable(doc, typeFilter.detailed ? {
                        startY: yPos,
                        head: [['Window', 'Type', 'W x H', 'Qty/Sf', 'Fabric/Blind', 'Track Details', 'Style', 'Remarks']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
                        bodyStyles: { fontSize: 7 },
                        columnStyles: {
                            0: { cellWidth: 20 },
                            1: { cellWidth: 14 },
                            2: { cellWidth: 16 },
                            3: { cellWidth: 12 },
                            4: { cellWidth: 32 },
                            5: { cellWidth: 32 },
                            6: { cellWidth: 28 },
                            7: { cellWidth: 'auto' }
                        },
                        margin: { left: 17, right: 15 }
                    } : {
                        startY: yPos,
                        head: [['Window', 'Type', 'Qty/Sf', 'Fabric/Blind', 'Track Details', 'Remarks']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
                        bodyStyles: { fontSize: 7 },
                        columnStyles: {
                            0: { cellWidth: 25 },
                            1: { cellWidth: 18 },
                            2: { cellWidth: 15 },
                            3: { cellWidth: 40 },
                            4: { cellWidth: 40 },
                            5: { cellWidth: 'auto' }
                        },
                        margin: { left: 17, right: 15 }
                    });

                    // @ts-ignore
                    yPos = doc.lastAutoTable.finalY + 4;

                    // Roll room totals into the sheet-wide grand totals
                    grandMainFabricMeters += roomMainFabricMeters;
                    grandSheerFabricMeters += roomSheerFabricMeters;
                    grandBlindSqft += roomBlindSqft;
                    grandCurtainCount += roomCurtainCount;
                    grandMainTrackFeet += roomMainTrackFeet;
                    grandSheerTrackFeet += roomSheerTrackFeet;

                    // Room totals
                    const roomFabricMeters = roomMainFabricMeters + roomSheerFabricMeters;
                    if (roomFabricMeters > 0 || roomBlindSqft > 0 || roomCurtainCount > 0) {
                        const totalParts: string[] = [];
                        if (roomFabricMeters > 0) totalParts.push(`Fabric: ${roomFabricMeters.toFixed(2)}m`);
                        if (roomBlindSqft > 0) totalParts.push(`Blind Area: ${roomBlindSqft.toFixed(2)}sf`);
                        if (roomCurtainCount > 0) {
                            const trackLabelParts: string[] = [];
                            if (roomMainTrackFeet > 0) trackLabelParts.push(`${roomMainTrackFeet.toFixed(1)}ft main`);
                            if (roomSheerTrackFeet > 0) trackLabelParts.push(`${roomSheerTrackFeet.toFixed(1)}ft sheer`);
                            totalParts.push(`Track: ${trackLabelParts.join(' + ')}`);
                        }

                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`Room Total - ${totalParts.join('  |  ')}`, pageWidth - 15, yPos, { align: 'right' });
                        yPos += 6;
                    }

                    // Add images for each item (detailed exports only)
                    for (const item of (typeFilter.detailed ? (room.items || []) : [])) {
                        if (item.images && item.images.length > 0) {
                            // Add item name label for images
                            doc.setFontSize(9);
                            doc.setFont('helvetica', 'italic');
                            doc.text(`${item.name} - Images:`, 17, yPos);
                            yPos += 5;

                            let xPos = 17;
                            const imgWidth = 40;
                            const imgHeight = 40;
                            const imgSpacing = 5;
                            const maxImgsPerRow = 4;
                            let imgCount = 0;

                            for (const imgUrl of item.images) {
                                try {
                                    // Check if we need a new page
                                    if (yPos + imgHeight > 280) {
                                        doc.addPage();
                                        yPos = 20;
                                        xPos = 17;
                                        imgCount = 0;
                                    }

                                    // Check if we need a new row
                                    if (imgCount > 0 && imgCount % maxImgsPerRow === 0) {
                                        yPos += imgHeight + imgSpacing;
                                        xPos = 17;

                                        // Check again after moving to new row
                                        if (yPos + imgHeight > 280) {
                                            doc.addPage();
                                            yPos = 20;
                                            xPos = 17;
                                        }
                                    }

                                    // Add image to PDF
                                    doc.addImage(imgUrl, 'JPEG', xPos, yPos, imgWidth, imgHeight);

                                    xPos += imgWidth + imgSpacing;
                                    imgCount++;
                                } catch (error) {
                                    console.error('Failed to add image to PDF:', error);
                                    // Continue with next image if one fails
                                }
                            }

                            // Move yPos down after all images
                            if (imgCount > 0) {
                                yPos += imgHeight + 8;
                            }
                        }
                    }

                    // Check if we need a new page
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                });
            });

            // Grand total summary
            const grandFabricMeters = grandMainFabricMeters + grandSheerFabricMeters;
            const grandTrackFeet = grandMainTrackFeet + grandSheerTrackFeet;
            if (grandFabricMeters > 0 || grandBlindSqft > 0 || grandCurtainCount > 0 || grandTrackFeet > 0) {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFillColor(71, 85, 105);
                doc.rect(15, yPos, pageWidth - 30, 8, 'F');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('GRAND TOTAL', 17, yPos + 5.5);
                doc.setTextColor(0, 0, 0);
                yPos += 12;

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                if (grandBlindSqft > 0) {
                    doc.text(`Total Blind Area: ${grandBlindSqft.toFixed(2)} sqft`, 17, yPos);
                    yPos += 6;
                }
                if (grandCurtainCount > 0) {
                    doc.text(`Total Curtains: ${grandCurtainCount}`, 17, yPos);
                    yPos += 6;
                }

                if (grandFabricMeters > 0) {
                    if (grandMainFabricMeters > 0) {
                        doc.text(`Main Fabric: ${grandMainFabricMeters.toFixed(2)} m`, 17, yPos);
                        yPos += 6;
                    }
                    if (grandSheerFabricMeters > 0) {
                        doc.text(`Sheer Fabric: ${grandSheerFabricMeters.toFixed(2)} m`, 17, yPos);
                        yPos += 6;
                    }
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Grand Total Fabric: ${grandFabricMeters.toFixed(2)} m`, 17, yPos);
                    doc.setFont('helvetica', 'normal');
                    yPos += 6;
                }

                if (grandTrackFeet > 0) {
                    if (grandMainTrackFeet > 0) {
                        doc.text(`Main Track: ${grandMainTrackFeet.toFixed(1)} ft`, 17, yPos);
                        yPos += 6;
                    }
                    if (grandSheerTrackFeet > 0) {
                        doc.text(`Sheer Track: ${grandSheerTrackFeet.toFixed(1)} ft`, 17, yPos);
                        yPos += 6;
                    }
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Grand Total Track: ${grandTrackFeet.toFixed(1)} ft`, 17, yPos);
                    doc.setFont('helvetica', 'normal');
                    yPos += 6;
                }
                yPos += 4;
            }

            // Notes section
            if (measurement.notes) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFillColor(248, 250, 252);
                doc.rect(15, yPos, pageWidth - 30, 8, 'F');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('GENERAL NOTES', 17, yPos + 5);
                yPos += 12;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                const splitNotes = doc.splitTextToSize(measurement.notes, pageWidth - 34);
                doc.text(splitNotes, 17, yPos);
            }

            // Watermark - faint logo centered on every page, stamped last so it
            // sits visually behind the content without covering it (low opacity)
            try {
                const logoDataUrl: string = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = reject;
                    img.src = '/logo.png';
                });

                const logoImg = new Image();
                logoImg.src = logoDataUrl;
                await new Promise((resolve) => { logoImg.onload = resolve; });
                const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;

                const pageH = doc.internal.pageSize.getHeight();
                const wmWidth = pageWidth * 0.55;
                const wmHeight = wmWidth / aspectRatio;
                const wmX = (pageWidth - wmWidth) / 2;
                const wmY = (pageH - wmHeight) / 2;

                const totalPages = doc.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.saveGraphicsState();
                    doc.setGState(doc.GState({ opacity: 0.08 }));
                    doc.addImage(logoDataUrl, 'PNG', wmX, wmY, wmWidth, wmHeight);
                    doc.restoreGraphicsState();
                }
            } catch (wmError) {
                console.error('Watermark failed, continuing without it:', wmError);
            }

            // Embed the full underlying measurement data (regardless of the
            // curtain/blind/detailed filters used for this export) into the
            // PDF's metadata so it can be re-imported later via "Import
            // Measurement PDF" in the editor, restoring the sheet exactly.
            try {
                const payload = {
                    v: 1,
                    title: measurement.title || '',
                    customerName: measurement.customerName || '',
                    notes: measurement.notes || '',
                    data: measurement.data || {},
                };
                const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
                doc.setProperties({
                    subject: 'CPW_MEASUREMENT_DATA',
                    keywords: `CPW_DATA_START:${base64Payload}:CPW_DATA_END`
                });
            } catch (metaError) {
                console.error('Embedding measurement data failed, PDF will not be re-importable:', metaError);
            }

            // Save PDF
            const filename = `${measurement.title || 'Measurement'}-${measurement.customerName || 'Draft'}.pdf`;
            doc.save(filename);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search measurements..."
                        className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Link href="/measurements/new">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Measurement
                    </Button>
                </Link>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                    <Ruler className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">No measurements found</h3>
                    <p className="text-slate-500 mb-6">Create a new measurement sheet to get started.</p>
                    <Link href="/measurements/new">
                        <Button variant="outline">Create First Measurement</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((m) => (
                        <Link href={`/measurements/${m.id}`} key={m.id}>
                            <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
                                <CardHeader className="pb-2">
                                    <div className="flex sm:flex-row flex-col justify-between items-start gap-2">
                                        <CardTitle className="text-lg font-semibold truncate pr-2 w-full">
                                            {m.title || "Untitled Measurement"}
                                        </CardTitle>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                                            <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline-block">
                                                {formatDate(m.updatedAt)}
                                            </span>
                                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setExportTypes({ curtain: true, blind: true, detailed: false });
                                                    setExportTarget(m);
                                                }}
                                                className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                                                title="Download PDF"
                                            >
                                                <FileDown className="h-4 w-4 text-slate-600" />
                                            </button>
                                            <button
                                                onClick={(e) => handleGenerateQuotation(m.id, m.title || "Untitled Measurement", e)}
                                                className="p-1.5 hover:bg-blue-100 rounded-md transition-colors"
                                                title="Generate Quotation"
                                            >
                                                <FileText className="h-4 w-4 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(m.id, m.title || "Untitled Measurement", e)}
                                                className="p-1.5 hover:bg-red-100 rounded-md transition-colors"
                                                title="Delete Measurement"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {m.customerName || m.lead?.name || "No Customer Name"}
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-end">
                                        <div className="text-sm text-slate-500">
                                            {m.data?.floors?.length || 0} Floors • {m.data?.floors?.reduce((acc: number, f: any) => acc + (f.rooms?.length || 0), 0) || 0} Rooms
                                        </div>
                                        {m.lead && (
                                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                Linked to Lead
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            <Dialog open={!!exportTarget} onOpenChange={(open) => { if (!open) setExportTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export PDF</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Choose which window types to include for &ldquo;{exportTarget?.title || "this measurement"}&rdquo;.
                    </p>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={exportTypes.curtain}
                                onChange={(e) => setExportTypes(prev => ({ ...prev, curtain: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Curtains
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={exportTypes.blind}
                                onChange={(e) => setExportTypes(prev => ({ ...prev, blind: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Blinds
                        </label>
                        <div className="pt-2 mt-2 border-t">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={exportTypes.detailed}
                                    onChange={(e) => setExportTypes(prev => ({ ...prev, detailed: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                Detailed PDF
                            </label>
                            <p className="text-xs text-muted-foreground pl-6">
                                Adds W x H, mount/style/ties details, and window photos. Unticked = basic summary only.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExportTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!exportTypes.curtain && !exportTypes.blind}
                            onClick={async () => {
                                const target = exportTarget;
                                setExportTarget(null);
                                if (target) await generatePDF(target, exportTypes);
                            }}
                        >
                            Export PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
