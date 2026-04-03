'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDown, Loader2, Cpu, Ruler, User } from "lucide-react";
import { getProducts } from "@/lib/actions/product-actions";

export function AccessoryCounter({ initialData, measurementId, customerName }: { initialData: any, measurementId?: string, customerName?: string }) {
    const floors = initialData?.floors || [];
    const itemSpecs = initialData?.sharedSizes?.itemSpecs || {};

    const [productMap, setProductMap] = useState<Record<string, string>>({});
    
    useEffect(() => {
        getProducts().then(res => {
            if (res.success && res.data) {
                const map: Record<string, string> = {};
                // @ts-ignore
                res.data.forEach((p: any) => { map[p.id] = p.name; });
                setProductMap(map);
            }
        });
    }, []);

    // Base Calculations
    let autoRippleCount = 0;
    let autoPinchCount = 0;
    let windowsWithTies = 0;
    let totalBlinds = 0;
    
    let ceilingTracksInches: number[] = [];
    let wallTracksInches: number[] = [];
    
    let totalFinials = 0;
    let totalEndcaps = 0;

    // Track Schedule Grouping: Key = "ProductName|SizeInFeet|IsMotorized"
    const trackSchedule: Record<string, { name: string, sizeFt: number, qty: number, isMotorized: boolean }> = {};

    const addTrackToSchedule = (productId: string | undefined, inches: number, isMotorized: boolean) => {
        if (inches <= 0) return;
        const productName = (productId && productMap[productId]) || "Standard Track";
        const sizeFt = Math.round((inches / 12) * 10) / 10; // 1 decimal place
        const key = `${productName}|${sizeFt}|${isMotorized}`;
        
        if (trackSchedule[key]) {
            trackSchedule[key].qty += 1;
        } else {
            trackSchedule[key] = { name: productName, sizeFt, qty: 1, isMotorized };
        }
    };

    floors.forEach((floor: any) => {
        floor.rooms.forEach((room: any) => {
            room.items.forEach((item: any) => {
                const spec = itemSpecs[item.id];
                const isMotorized = !!(spec?.motors && Number(spec.motors) > 0);

                if (spec) {
                    totalFinials += Number(spec.finials || 0);
                    totalEndcaps += Number(spec.endcaps || 0);
                }

                if (item.type === "Blind") {
                    totalBlinds += 1;
                }

                if (item.type === "Curtain") {
                    const qty = parseInt(item.quantity || "1", 10);
                    const isPinch = item.curtainType === "Pinch Pleat";
                    
                    if (isPinch) autoPinchCount += qty;
                    else autoRippleCount += qty;
                    
                    if (item.sheerRequired) {
                        const sheerQty = parseInt(item.sheerQuantity || "1", 10);
                        if (isPinch) autoPinchCount += sheerQty;
                        else autoRippleCount += sheerQty;
                    }

                    if (item.tiesRequired) {
                        windowsWithTies += 1;
                    }

                    // Tally tracks for brackets and schedule
                    if (item.trackRequired !== false) {
                        const size = parseFloat(item.trackSize || item.width || "0");
                        if (item.mountType === "Ceiling") ceilingTracksInches.push(size);
                        else wallTracksInches.push(size);
                        
                        addTrackToSchedule(item.productId, size, isMotorized);

                        if (item.sheerRequired) {
                            const sheerSize = parseFloat(item.sheerTrackSize || item.sheerWidth || item.width || "0");
                            if (item.mountType === "Ceiling") ceilingTracksInches.push(sheerSize);
                            else wallTracksInches.push(sheerSize);
                            
                            addTrackToSchedule(item.sheerProductId, sheerSize, isMotorized);
                        }
                    }
                }
            });
        });
    });

    const [rippleCount, setRippleCount] = useState<string>("");
    const [pinchCount, setPinchCount] = useState<string>("");

    useEffect(() => {
        setRippleCount(autoRippleCount.toString());
        setPinchCount(autoPinchCount.toString());
    }, [autoRippleCount, autoPinchCount]);

    const activeRipple = parseInt(rippleCount || "0", 10);
    const activePinch = parseInt(pinchCount || "0", 10);

    const totalRings = (activeRipple * 11) + (activePinch * 7);
    const totalHooks = totalRings; 
    
    const totalTies = windowsWithTies * 2;
    const totalUmbrellaHooks = totalTies > 0 ? totalTies + 2 : 0;

    const calculateBrackets = (tracks: number[]) => {
        return tracks.reduce((sum, inches) => sum + Math.max(2, Math.ceil(inches / 36) + 1), 0);
    };

    const ceilingBrackets = calculateBrackets(ceilingTracksInches);
    const wallBrackets = calculateBrackets(wallTracksInches);

    const [loadingPdf, setLoadingPdf] = useState(false);

    const downloadPDF = async () => {
        setLoadingPdf(true);
        try {
            // @ts-ignore
            const jsPDF = (await import('jspdf')).default;
            // @ts-ignore
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF();
            
            doc.setFontSize(22);
            doc.setTextColor(41, 128, 185);
            doc.text("Accessory Packing List", 15, 22);
            
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.setFont("helvetica", "bold");
            if (customerName) {
                doc.text(`CLIENT: ${customerName.toUpperCase()}`, 15, 30);
            }
            
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 36);

            // Section 1: Track Schedule
            doc.setFillColor(245, 247, 250);
            doc.rect(15, 45, 180, 8, 'F');
            doc.setFontSize(12);
            doc.setTextColor(50, 50, 50);
            doc.setFont("helvetica", "bold");
            doc.text("1. TRACK SCHEDULE", 18, 51);

            const sortedTracks = Object.values(trackSchedule).sort((a,b) => b.sizeFt - a.sizeFt);
            autoTable(doc, {
                startY: 55,
                head: [['Pack', 'Track Product', 'Size', 'Qty']],
                body: sortedTracks.map(t => [
                    "[   ]",
                    `${t.name}${t.isMotorized ? ' (Motorized)' : ''}`,
                    `${t.sizeFt} ft`,
                    `x ${t.qty}`
                ]),
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: { 
                    0: { cellWidth: 20, halign: 'center' },
                    2: { halign: 'center' },
                    3: { halign: 'right', fontStyle: 'bold' }
                }
            });

            // Section 2: Rings & Hooks
            let finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFillColor(245, 247, 250);
            doc.rect(15, finalY, 180, 8, 'F');
            doc.setFontSize(12);
            doc.setTextColor(50, 50, 50);
            doc.setFont("helvetica", "bold");
            doc.text("2. RINGS & HOOKS", 18, finalY + 6);

            autoTable(doc, {
                startY: finalY + 10,
                head: [['Pack', 'Description', 'Quantity']],
                body: [
                    ["[   ]", "Ripple Fold Curtains", activeRipple.toString()],
                    ["[   ]", "Pinch Pleat Curtains", activePinch.toString()],
                    ["[   ]", "TOTAL RINGS REQUIRED", totalRings.toString()],
                    ["[   ]", "TOTAL HOOKS REQUIRED", totalHooks.toString()],
                ],
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: { 
                    0: { cellWidth: 20, halign: 'center' },
                    2: { halign: 'right', fontStyle: 'bold' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && (data.row.index === 2 || data.row.index === 3)) {
                        data.cell.styles.fillColor = [240, 245, 255];
                        data.cell.styles.textColor = [0, 50, 150];
                    }
                }
            });

            // Section 3: Hardware & Mounts
            finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFillColor(245, 247, 250);
            doc.rect(15, finalY, 180, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.text("3. HARDWARE & MOUNTS", 18, finalY + 6);

            autoTable(doc, {
                startY: finalY + 10,
                head: [['Pack', 'Item Name', 'Quantity']],
                body: [
                    ["[   ]", "Total Blinds", totalBlinds.toString()],
                    ["[   ]", "Ceiling Brackets", ceilingBrackets.toString()],
                    ["[   ]", "Wall Brackets", wallBrackets.toString()],
                    ["[   ]", "Finials", totalFinials.toString()],
                    ["[   ]", "Endcaps", totalEndcaps.toString()],
                ],
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: { 
                    0: { cellWidth: 20, halign: 'center' },
                    2: { halign: 'right', fontStyle: 'bold' }
                }
            });

            // Section 4: Ties & Umbrellas
            finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFillColor(245, 247, 250);
            doc.rect(15, finalY, 180, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.text("4. CURTAIN TIES & UMBRELLAS", 18, finalY + 6);

            autoTable(doc, {
                startY: finalY + 10,
                head: [['Pack', 'Description', 'Quantity']],
                body: [
                    ["[   ]", "Pair of Ties Requested", `${windowsWithTies} pair(s) (${totalTies} ties)`],
                    ["[   ]", "Umbrella Hooks Required", totalUmbrellaHooks.toString()],
                ],
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: { 
                    0: { cellWidth: 20, halign: 'center' },
                    2: { halign: 'right', fontStyle: 'bold' }
                }
            });

            doc.save(`Accessory_Packing_List_${customerName || 'Lead'}.pdf`);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPdf(false);
        }
    };

    const sortedTracksUI = Object.values(trackSchedule).sort((a,b) => b.sizeFt - a.sizeFt);

    return (
        <Card className="shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between pb-4">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                        Accessory Counter
                    </CardTitle>
                    {customerName && (
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                            <User className="h-3 w-3" />
                            CLIENT: <span className="text-slate-700 uppercase">{customerName}</span>
                        </div>
                    )}
                </div>
                <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2 border-slate-300"
                    onClick={downloadPDF}
                    disabled={loadingPdf}
                >
                    {loadingPdf ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <FileDown className="h-4 w-4 text-blue-600" />}
                    Download Packing List
                </Button>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Track List Section */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-slate-400" />
                            Track Schedule
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {sortedTracksUI.length > 0 ? sortedTracksUI.map((track, i) => (
                                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center group hover:border-blue-300 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 font-semibold truncate max-w-[150px]">{track.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-slate-800">{track.sizeFt} ft</span>
                                            {track.isMotorized && (
                                                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <Cpu className="h-2.5 w-2.5" /> MOTOR
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-300 group-hover:text-blue-500 transition-colors">
                                        x{track.qty}
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-4 text-center text-slate-400 italic bg-slate-50 rounded-lg border-2 border-dashed">
                                    No tracks found in measurements
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rings & Hooks Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-800 border-b pb-2">Rings & Hooks</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Ripple Curtains</label>
                                <Input 
                                    type="number" 
                                    className="bg-zinc-50"
                                    value={rippleCount} 
                                    onChange={(e) => setRippleCount(e.target.value)} 
                                />
                                <div className="text-[10px] text-slate-400 mt-1">Found: {autoRippleCount}</div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Pinch Curtains</label>
                                <Input 
                                    type="number" 
                                    className="bg-zinc-50"
                                    value={pinchCount} 
                                    onChange={(e) => setPinchCount(e.target.value)} 
                                />
                                <div className="text-[10px] text-slate-400 mt-1">Found: {autoPinchCount}</div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-lg flex justify-between items-center border border-blue-100">
                            <span className="text-slate-600 font-medium">Total Rings:</span>
                            <span className="text-2xl font-bold text-blue-700">{totalRings}</span>
                        </div>
                        <div className="bg-purple-50/50 p-4 rounded-lg flex justify-between items-center border border-purple-100">
                            <span className="text-slate-600 font-medium">Total Hooks:</span>
                            <span className="text-2xl font-bold text-purple-700">{totalHooks}</span>
                        </div>
                    </div>

                    {/* Hard Hardware Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-800 border-b pb-2">Hardware & Mounts</h3>
                        
                        <div className="grid grid-cols-3 gap-3 auto-rows-max">
                            <div className="border rounded-md p-2 flex flex-col items-center justify-center text-center bg-slate-50">
                                <span className="text-2xl font-bold text-slate-800">{totalBlinds}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Blinds</span>
                            </div>
                            <div className="border rounded-md p-2 flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-slate-800">{ceilingBrackets}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Ceiling Brackets</span>
                            </div>
                            <div className="border rounded-md p-2 flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-slate-800">{wallBrackets}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Wall Brackets</span>
                            </div>
                            <div className="border rounded-md p-2 flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-slate-800">{totalFinials}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Finials</span>
                            </div>
                            <div className="border rounded-md p-2 flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-slate-800">{totalEndcaps}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Endcaps</span>
                            </div>
                        </div>
                    </div>

                    {/* Ties and Umbrella Hooks */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className="font-semibold text-slate-800 border-b pb-2">Curtain Ties & Umbrellas</h3>
                        <div className="flex gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg flex-1 border flex justify-between items-center">
                                <span className="text-slate-600 font-medium">Pairs Required:</span>
                                <span className="text-xl font-bold text-slate-700">{windowsWithTies} <span className="text-sm font-normal text-slate-400">({totalTies} ties)</span></span>
                            </div>
                            <div className="bg-indigo-50/50 p-4 rounded-lg flex-1 border border-indigo-100 flex justify-between items-center">
                                <span className="text-indigo-800 font-medium">Umbrella Hooks Req:</span>
                                <span className="text-2xl font-bold text-indigo-700">{totalUmbrellaHooks}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
}
