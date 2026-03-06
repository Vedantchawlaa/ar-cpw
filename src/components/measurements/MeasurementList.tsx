'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

    const filtered = measurements.filter(m =>
        (m.customerName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (m.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (m.lead?.name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );

    const generatePDF = async (measurement: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

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

            // Customer info
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Customer: ${measurement.customerName || 'N/A'}`, 15, 30);
            doc.text(`Date: ${formatDate(measurement.updatedAt)}`, 15, 36);
            doc.text('Chawla Parde Wala', pageWidth - 15, 30, { align: 'right' });

            let yPos = 45;

            // Process each floor
            const floors = measurement.data?.floors || [];
            floors.forEach((floor: any, floorIdx: number) => {
                // Floor header
                doc.setFillColor(240, 240, 240);
                doc.rect(15, yPos, pageWidth - 30, 8, 'F');
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(floor.name, 17, yPos + 5);
                yPos += 12;

                // Process each room
                floor.rooms?.forEach((room: any) => {
                    // Room name
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(room.name, 17, yPos);
                    yPos += 6;

                    // Items table
                    const tableData = room.items?.map((item: any) => {
                        const productDetails: string[] = [];
                        if (item.type === 'Curtain') {
                            if (item.fabricProduct) {
                                productDetails.push(`Main: ${productMap[item.fabricProduct] || 'Fabric'} (${item.fabricRequired || '0'}m)`);
                            }
                            if (item.sheerRequired && item.sheerFabricProduct) {
                                productDetails.push(`Sheer: ${productMap[item.sheerFabricProduct] || 'Sheer'} (${item.sheerFabricRequired || '0'}m)`);
                            }
                        } else if (item.type === 'Blind') {
                            if (item.blindProduct) {
                                productDetails.push(`${productMap[item.blindProduct] || 'Blind'}`);
                            }
                        }

                        const trackDetails: string[] = [];
                        if (item.type === 'Curtain' && item.trackRequired !== false) {
                            if (item.trackProduct) {
                                trackDetails.push(`Main: ${productMap[item.trackProduct] || 'Track'} (${item.trackSize || '0'}")`);
                            }
                            if (item.sheerRequired) {
                                const sTrackId = item.sheerTrackProduct || item.trackProduct;
                                if (sTrackId) {
                                    const sTrackSize = item.sheerTrackSize || item.trackSize || '0';
                                    trackDetails.push(`Sheer: ${productMap[sTrackId] || 'Sheer Track'} (${sTrackSize}")`);
                                }
                            }
                        }

                        return [
                            item.name,
                            item.type,
                            `${item.width} x ${item.height}`,
                            item.type === 'Curtain' ? item.quantity : item.sqft || '-',
                            productDetails.join('\n') || '-',
                            trackDetails.join('\n') || '-',
                            item.remarks || ''
                        ];
                    }) || [];

                    autoTable(doc, {
                        startY: yPos,
                        head: [['Window', 'Type', 'W x H', 'Qty/Sf', 'Fabric/Blind', 'Track Details', 'Remarks']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
                        bodyStyles: { fontSize: 7 },
                        columnStyles: {
                            0: { cellWidth: 22 },
                            1: { cellWidth: 15 },
                            2: { cellWidth: 20 },
                            3: { cellWidth: 15 },
                            4: { cellWidth: 35 },
                            5: { cellWidth: 35 },
                            6: { cellWidth: 'auto' }
                        },
                        margin: { left: 17, right: 15 }
                    });

                    // @ts-ignore
                    yPos = doc.lastAutoTable.finalY + 4;

                    // Add images for each item
                    for (const item of room.items || []) {
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
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-semibold truncate pr-2">
                                            {m.title || "Untitled Measurement"}
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                                {formatDate(m.updatedAt)}
                                            </span>
                                            <button
                                                onClick={(e) => generatePDF(m, e)}
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
        </div>
    );
}
