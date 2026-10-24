'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Save, FileDown, Loader2 } from "lucide-react";
import { saveMeasurement } from "@/lib/actions/measurement-actions";
import { getProducts } from "@/lib/actions/product-actions";
import { useRouter } from "next/navigation";
import { TrackCuttingPlan } from "@/components/leads/TrackCuttingPlan";
import { DEFAULT_TRACK_CUTTING_SETTINGS, TrackCuttingSettings, planWithStock, type StockAwarePlan } from "@/lib/track-optimizer";
import { applyTrackPlanToStock, planTracksWithStock } from "@/lib/actions/stock-actions";
import type { AppliedTrackStock } from "@/lib/services/stock-service";
import { drawTrackCuttingPlan } from "@/lib/track-cutting-pdf";

export function SizesToShare({ leadId, measurementId, initialData, customerName, title }: any) {
    const router = useRouter();
    const floors = initialData?.floors || [];
    
    const [vendors, setVendors] = useState(initialData?.sharedSizes?.vendors || { tracks: "", blinds: "", curtains: "" });
    const [itemSpecs, setItemSpecs] = useState<Record<string, { finials: number, endcaps: number, motors: number, customFabric?: string, shadeDetails?: string, customVendor?: string }>>(initialData?.sharedSizes?.itemSpecs || {});
    const [fabricComments, setFabricComments] = useState<Record<string, string>>(initialData?.sharedSizes?.fabricComments || {});
    const [trackCutting, setTrackCutting] = useState<TrackCuttingSettings>({ ...DEFAULT_TRACK_CUTTING_SETTINGS, ...(initialData?.sharedSizes?.trackCutting || {}) });
    const [loading, setLoading] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
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

    // flatmap items
    const trackItems: Array<{ floor: string, room: string, id: string, name: string, size: number, type: 'main' | 'sheer', productId?: string }> = [];
    const blindItems: Array<{ floor: string, room: string, id: string, name: string, w: string, h: string, productId?: string }> = [];
    const curtainItems: Array<{ floor: string, room: string, id: string, name: string, qty: string, h: string, isSheer: boolean, fabricId?: string }> = [];

    floors.forEach((floor: any) => {
        floor.rooms.forEach((room: any) => {
            room.items.forEach((item: any) => {
                if (item.type === "Curtain") {
                    if (item.trackRequired !== false) {
                        trackItems.push({
                            floor: floor.name,
                            room: room.name,
                            id: `${item.id}-main`,
                            name: item.name + ' (Main Track)',
                            size: parseFloat(item.trackSize || item.width || "0"),
                            type: 'main',
                            productId: item.trackProduct
                        });
                    }
                    if (item.sheerRequired && item.trackRequired !== false) {
                        trackItems.push({
                            floor: floor.name,
                            room: room.name,
                            id: `${item.id}-sheer`,
                            name: item.name + ' (Sheer Track)',
                            size: parseFloat(item.sheerTrackSize || item.width || "0"),
                            type: 'sheer',
                            productId: item.sheerTrackProduct || item.trackProduct
                        });
                    }

                    curtainItems.push({
                        floor: floor.name,
                        room: room.name,
                        id: `${item.id}-main-curtain`,
                        name: item.name + ' (Main)',
                        qty: item.quantity || "1",
                        h: item.height,
                        isSheer: false,
                        fabricId: item.fabricProduct
                    });

                    if (item.sheerRequired) {
                         curtainItems.push({
                            floor: floor.name,
                            room: room.name,
                            id: `${item.id}-sheer-curtain`,
                            name: item.name + ' (Sheer)',
                            qty: item.sheerQuantity || "1",
                            h: item.sheerHeight || item.height,
                            isSheer: true,
                            fabricId: item.sheerFabricProduct
                        });
                    }
                } else if (item.type === "Blind") {
                    blindItems.push({
                        floor: floor.name,
                        room: room.name,
                        id: item.id,
                        name: item.name,
                        w: item.width,
                        h: item.height,
                        productId: item.blindProduct
                    });
                }
            });
        });
    });

    // Cutting plan works on the final (after deduction) track sizes
    const cutPiecesKey = JSON.stringify(trackItems.map(item => {
        const specs = itemSpecs[item.id] || { finials: 0, endcaps: 0, motors: 0 };
        const finalSize = item.size - ((specs.finials || 0) * 3) - ((specs.endcaps || 0) * 0.5) - ((specs.motors || 0) * 3);
        return {
            label: `${item.room} > ${item.name.replace(/ \((Main|Sheer) Track\)$/, '')} ${item.type === 'main' ? 'Main' : 'Sheer'}`,
            length: parseFloat(finalSize.toFixed(2)),
            productId: item.productId || null
        };
    }));

    // Plan without stock straight away, then swap in the plan that uses pieces
    // already in the godown once the server has worked it out.
    const planKey = `${cutPiecesKey}|${JSON.stringify(trackCutting)}`;
    const localPlan = useMemo(
        () => planWithStock(JSON.parse(cutPiecesKey), [], trackCutting),
        [cutPiecesKey, trackCutting]
    );
    const [stockPlan, setStockPlan] = useState<{ key: string; plan: StockAwarePlan } | null>(null);
    const [stockVersion, setStockVersion] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            const plan = await planTracksWithStock(JSON.parse(cutPiecesKey), trackCutting);
            if (!cancelled && plan) setStockPlan({ key: planKey, plan });
        }, 400);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [planKey, cutPiecesKey, trackCutting, stockVersion]);
    const cuttingPlan = stockPlan?.key === planKey ? stockPlan.plan : localPlan;
    const usesStock = stockPlan?.key === planKey;

    const [trackStock, setTrackStock] = useState<AppliedTrackStock | null>(initialData?.sharedSizes?.trackStock ?? null);
    const [applyingStock, setApplyingStock] = useState(false);
    const handleApplyToStock = async () => {
        if (!measurementId) {
            alert("Save the measurement first.");
            return;
        }
        if (!confirm("Book this plan in stock? Stock pieces used by the plan are taken out (or shortened) and KEEP offcuts from new bars are added. This is done once per job.")) return;
        setApplyingStock(true);
        const result = await applyTrackPlanToStock(measurementId, JSON.parse(cutPiecesKey), trackCutting);
        setApplyingStock(false);
        if (result.success && "applied" in result) {
            setTrackStock(result.applied);
            setStockVersion(v => v + 1);
            router.refresh();
        } else {
            alert(("error" in result && result.error) || "Failed to update stock");
        }
    };

    // Group curtains by fabric
    const curtainsByFabric: Record<string, typeof curtainItems> = {};
    let grandTotalCurtains = 0;
    
    curtainItems.forEach(item => {
        const specs = itemSpecs[item.id] || {};
        const fabricName = specs.customFabric || (item.fabricId ? productMap[item.fabricId] : null) || "Unassigned Fabric";
        
        if (!curtainsByFabric[fabricName]) {
            curtainsByFabric[fabricName] = [];
        }
        curtainsByFabric[fabricName].push(item);
        grandTotalCurtains += parseFloat(item.qty || "1");
    });

    // Group blinds by vendor
    const blindsByVendor: Record<string, typeof blindItems> = {};
    let grandTotalBlinds = 0;
    blindItems.forEach(item => {
        const specs = itemSpecs[item.id] || {};
        const vendorName = specs.customVendor || "Unassigned Vendor";
        
        if (!blindsByVendor[vendorName]) {
            blindsByVendor[vendorName] = [];
        }
        blindsByVendor[vendorName].push(item);
        grandTotalBlinds += 1;
    });

    const handleSave = async () => {
        setLoading(true);
        const newData = { ...initialData, sharedSizes: { ...initialData?.sharedSizes, vendors, itemSpecs, fabricComments, trackCutting } };
        
        const result = await saveMeasurement({
            id: measurementId,
            leadId,
            data: newData,
        });

        setLoading(false);
        if (result.success) {
            alert("Sizes and Vendors saved successfully!");
            router.refresh();
        } else {
            alert(result.error || "Failed to save sizes");
        }
    };

    const updateItemSpec = (id: string, field: 'finials' | 'endcaps' | 'motors' | 'customFabric' | 'shadeDetails' | 'customVendor', val: string | number) => {
        setItemSpecs(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || { finials: 0, endcaps: 0, motors: 0 }),
                [field]: val
            }
        }));
    };

    const downloadPDF = async (type: 'Tracks' | 'Blinds' | 'Curtains', e: React.MouseEvent, targetVendor?: string) => {
        e.preventDefault();
        if (loadingPdf) return;
        setLoadingPdf(type);

        try {
            // @ts-ignore
            const jsPDF = (await import('jspdf')).default;
            // @ts-ignore
            const autoTable = (await import('jspdf-autotable')).default;
            
            let logoData: { base64: string, w: number, h: number } | null = null;
            try {
                const res = await fetch('/logo.png');
                const blob = await res.blob();
                logoData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result as string;
                        const img = new Image();
                        img.onload = () => {
                            const targetHeight = 12;
                            const ratio = img.width / img.height;
                            const targetWidth = targetHeight * ratio;
                            resolve({ base64, w: targetWidth, h: targetHeight });
                        };
                        img.onerror = () => resolve(null);
                        img.src = base64;
                    };
                    reader.readAsDataURL(blob);
                });
            } catch(e) { console.error('Failed to load logo', e) }
            
            if (type === 'Tracks' || type === 'Curtains') {
                const doc = new jsPDF();
                
                if (logoData) doc.addImage(logoData.base64, 'PNG', 195 - logoData.w, 10, logoData.w, logoData.h);
                doc.setFontSize(16);
                doc.text(`${type}`, 15, 20);
                
                if (type === 'Tracks') {
                    
                    autoTable(doc, {
                        startY: 35,
                        head: [['Product Name', 'Qty Finials', 'Qty Endcaps', 'Qty Motors', 'Final Size']],
                        body: trackItems.map(item => {
                            const specs = itemSpecs[item.id] || { finials: 0, endcaps: 0, motors: 0 };
                            const finalSize = (item.size - (specs.finials * 3) - (specs.endcaps * 0.5) - (specs.motors * 3)).toFixed(2);
                            const productName = item.productId && productMap[item.productId] ? productMap[item.productId] : "Unassigned";
                            return [
                                `${item.room} > ${item.name}\n${productName}`,
                                specs.finials,
                                specs.endcaps,
                                specs.motors,
                                `${finalSize}"`
                            ];
                        }),
                        theme: 'grid',
                        headStyles: { fillColor: [41, 128, 185] },
                        margin: { left: 15, right: 15, bottom: 15 }
                    });

                    drawTrackCuttingPlan(doc, autoTable, cuttingPlan, { clientName: customerName || title, logoData, productNames: productMap });
                } else if (type === 'Curtains') {
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(41, 128, 185);
                    doc.text(`Total: ${grandTotalCurtains} ${grandTotalCurtains === 1 ? 'curtain' : 'curtains'}`, 15, 28);
                    
                    let startY = 35;
                    
                    Object.entries(curtainsByFabric).forEach(([fabricName, items], index) => {
                        const totalCurtains = items.reduce((sum, item) => sum + parseFloat(item.qty || "1"), 0);
                        const comment = fabricComments[fabricName];

                        if (index > 0) startY = (doc as any).lastAutoTable.finalY + 15;
                        
                        doc.setFontSize(10);
                        doc.setTextColor(50, 50, 50);
                        doc.setFont("helvetica", "bold");
                        doc.text(`Sub Total: ${totalCurtains} ${totalCurtains === 1 ? 'curtain' : 'curtains'}`, 15, startY);
                        
                        let tableStartY = startY + 5;
                        if (comment) {
                            doc.setFontSize(9);
                            doc.setFont("helvetica", "italic");
                            doc.setTextColor(100, 100, 100);
                            doc.text(`Notes: ${comment}`, 15, startY + 6);
                            tableStartY += 6;
                        }
                        
                        autoTable(doc, {
                            startY: tableStartY,
                            head: [['Fabric Name', 'Final Size']],
                            body: items.map(item => {
                                const hNum = parseFloat(item.h || "0");
                                return [
                                    fabricName,
                                    `${item.qty} ${item.qty === "1" ? "curtain" : "curtains"} x ${(hNum - 4).toFixed(2)}"`
                                ];
                            }),
                            theme: 'grid',
                            headStyles: { fillColor: [41, 128, 185] }
                        });
                    });
                }
                
                doc.save(`${type}.pdf`);
            } else if (type === 'Blinds') {
                const vendorsToProcess = targetVendor 
                    ? Object.entries(blindsByVendor).filter(([v]) => v === targetVendor) 
                    : Object.entries(blindsByVendor);

                for (const [vendorName, items] of vendorsToProcess) {
                    const doc = new jsPDF();
                    
                    if (logoData) doc.addImage(logoData.base64, 'PNG', 195 - logoData.w, 10, logoData.w, logoData.h);
                    doc.setFontSize(16);
                    doc.text(`Blinds`, 15, 20);
                    
                    autoTable(doc, {
                        startY: 35,
                        head: [['Product Name', 'Shade/Details', 'Actual Production Size (W x H)']],
                        body: items.map(item => {
                            const productName = item.productId && productMap[item.productId] ? productMap[item.productId] : "Unassigned";
                            const specs = itemSpecs[item.id] || {};
                            return [
                                productName,
                                specs.shadeDetails || "-",
                                `${item.w}" x ${item.h}"`
                            ];
                        }),
                        theme: 'grid',
                        headStyles: { fillColor: [41, 128, 185] }
                    });
                    
                    const safeName = vendorName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    doc.save(`Blinds_${safeName}.pdf`);
                }
            }
        } catch(err) {
            console.error(err);
            alert("Failed to generate PDF");
        } finally {
            setLoadingPdf(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                <div>
                    <h2 className="text-xl font-semibold">Sizes To Share</h2>
                    <p className="text-sm text-gray-500">Calculate final shared sizes and assign vendors.</p>
                </div>
                <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save Sizes & Vendors"}
                </Button>
            </div>

            {/* TRACKS SECTION */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="flex justify-between items-center">
                        <span>1. Tracks</span>
                        <div className="flex items-center gap-2 w-64 text-sm font-normal">
                            <label className="text-gray-500 whitespace-nowrap">Vendor:</label>
                            <Input 
                                placeholder="Vendor Name" 
                                value={vendors.tracks} 
                                onChange={e => setVendors((prev: any) => ({...prev, tracks: e.target.value}))} 
                                className="h-8"
                            />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2" 
                                onClick={(e) => downloadPDF('Tracks', e)}
                                disabled={loadingPdf === 'Tracks'}
                            >
                                {loadingPdf === 'Tracks' ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <FileDown className="h-4 w-4 text-blue-600" />}
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto">
                    {trackItems.length === 0 ? <p className="text-sm text-gray-500">No tracks required.</p> : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 rounded-l-md">Room / Window</th>
                                    <th className="px-4 py-2 text-center">Finials (-3"/ea)</th>
                                    <th className="px-4 py-2 text-center">Endcaps (-0.5"/ea)</th>
                                    <th className="px-4 py-2 text-center">Motors (-3"/ea)</th>
                                    <th className="px-4 py-2 text-right rounded-r-md text-blue-600">Final Size</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trackItems.map((item) => {
                                    const specs = itemSpecs[item.id] || { finials: 0, endcaps: 0, motors: 0 };
                                    const deductFinials = specs.finials * 3;
                                    const deductEndcaps = specs.endcaps * 0.5;
                                    const deductMotors = specs.motors * 3;
                                    const finalSizeStr = (item.size - deductFinials - deductEndcaps - deductMotors).toFixed(2);
                                    const productName = item.productId && productMap[item.productId] ? productMap[item.productId] : "Unassigned Product";
                                    
                                    return (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {item.room} <span className="text-gray-400 mx-1">{'>'}</span> {item.name}
                                                <div className="text-xs text-gray-500 font-normal mt-0.5">{productName}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={specs.finials > 0} 
                                                        onChange={(e) => updateItemSpec(item.id, 'finials', e.target.checked ? 2 : 0)}
                                                        title="Ticks for standard 2 finials"
                                                    />
                                                    <Input 
                                                        type="number" 
                                                        className="h-7 w-14 text-center px-1" 
                                                        value={specs.finials || ""} 
                                                        onChange={e => updateItemSpec(item.id, 'finials', parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={specs.endcaps > 0} 
                                                        onChange={(e) => updateItemSpec(item.id, 'endcaps', e.target.checked ? 2 : 0)}
                                                    />
                                                    <Input 
                                                        type="number" 
                                                        className="h-7 w-14 text-center px-1" 
                                                        value={specs.endcaps || ""} 
                                                        onChange={e => updateItemSpec(item.id, 'endcaps', parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={specs.motors > 0} 
                                                        onChange={(e) => updateItemSpec(item.id, 'motors', e.target.checked ? 1 : 0)}
                                                    />
                                                    <Input 
                                                        type="number" 
                                                        className="h-7 w-14 text-center px-1" 
                                                        value={specs.motors || ""} 
                                                        onChange={e => updateItemSpec(item.id, 'motors', parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                {finalSizeStr}"
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {trackItems.length > 0 && (
                <TrackCuttingPlan
                    result={cuttingPlan}
                    productNames={productMap}
                    usesStock={usesStock}
                    applied={trackStock}
                    onApplyToStock={handleApplyToStock}
                    applying={applyingStock}
                    settings={trackCutting}
                    onSettingsChange={setTrackCutting}
                    onDownload={(e) => downloadPDF('Tracks', e)}
                    downloading={loadingPdf === 'Tracks'}
                />
            )}

            {/* BLINDS SECTION */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <span>2. Blinds</span>
                            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold border border-blue-200 shadow-sm">
                                Total: {grandTotalBlinds} {grandTotalBlinds === 1 ? 'Blind' : 'Blinds'}
                            </span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                    {Object.keys(blindsByVendor).length === 0 ? <p className="text-sm text-gray-500">No blinds required.</p> : (
                        Object.entries(blindsByVendor).map(([vendorName, items]) => (
                            <div key={vendorName} className="rounded-lg border overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800">
                                        Vendor: <span className="text-blue-700">{vendorName}</span>
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs bg-white border px-2 py-1 rounded-full text-slate-500 font-medium">Sub Total: {items.length}</span>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50" 
                                            onClick={(e) => downloadPDF('Blinds', e, vendorName)}
                                            disabled={loadingPdf === 'Blinds'}
                                        >
                                            <FileDown className="h-3 w-3 mr-1" /> Vendor PDF
                                        </Button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-4 py-2">Room / Window</th>
                                                <th className="px-4 py-2">Override Vendor</th>
                                                <th className="px-4 py-2">Shade & File Name</th>
                                                <th className="px-4 py-2">Quotation Size (W x H)</th>
                                                <th className="px-4 py-2 text-right text-blue-600">Actual Production Size (W x H)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => {
                                                const productName = item.productId && productMap[item.productId] ? productMap[item.productId] : "Unassigned Product";
                                                const specs = itemSpecs[item.id] || {};
                                                return (
                                                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 font-medium text-slate-900">
                                                            {item.room} <span className="text-slate-400 mx-1">{'>'}</span> {item.name}
                                                            <div className="text-xs text-slate-500 font-normal mt-0.5">{productName}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Input 
                                                                className="h-7 text-xs w-48 shadow-sm" 
                                                                placeholder="Override vendor..."
                                                                defaultValue={specs.customVendor || ""}
                                                                onBlur={(e) => updateItemSpec(item.id, 'customVendor', e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        updateItemSpec(item.id, 'customVendor', e.currentTarget.value);
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Input 
                                                                className="h-7 text-xs w-48 shadow-sm" 
                                                                placeholder="Shade & File details..."
                                                                defaultValue={specs.shadeDetails || ""}
                                                                onBlur={(e) => updateItemSpec(item.id, 'shadeDetails', e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        updateItemSpec(item.id, 'shadeDetails', e.currentTarget.value);
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500">{item.w}" x {item.h}"</td>
                                                        <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                            {item.w}" x {item.h}"
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* CURTAINS SECTION */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <span>3. Curtains</span>
                            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold border border-blue-200 shadow-sm">
                                Total: {grandTotalCurtains} {grandTotalCurtains === 1 ? 'Curtain' : 'Curtains'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 w-64 text-sm font-normal">
                            <label className="text-gray-500 whitespace-nowrap">Vendor:</label>
                            <Input 
                                placeholder="Vendor Name" 
                                value={vendors.curtains} 
                                onChange={e => setVendors((prev: any) => ({...prev, curtains: e.target.value}))} 
                                className="h-8"
                            />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2" 
                                onClick={(e) => downloadPDF('Curtains', e)}
                                disabled={loadingPdf === 'Curtains'}
                            >
                                {loadingPdf === 'Curtains' ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <FileDown className="h-4 w-4 text-blue-600" />}
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                    {Object.keys(curtainsByFabric).length === 0 ? <p className="text-sm text-gray-500">No curtains required.</p> : (
                        Object.entries(curtainsByFabric).map(([fabricName, items]) => {
                            const totalCurtains = items.reduce((sum, item) => sum + parseFloat(item.qty || "1"), 0);

                            return (
                            <div key={fabricName} className="rounded-lg border overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800">
                                        Fabric: <span className="text-blue-700">{fabricName}</span>
                                    </h3>
                                    <span className="text-xs bg-white border px-2 py-1 rounded-full text-slate-500 font-medium">Sub Total: {totalCurtains}</span>
                                </div>
                                <div className="bg-white px-4 py-2 border-b text-sm">
                                    <Input 
                                        placeholder="Add instructions or comments for this fabric..." 
                                        value={fabricComments[fabricName] || ""} 
                                        onChange={(e) => setFabricComments(prev => ({...prev, [fabricName]: e.target.value}))}
                                        className="h-8 w-full border-dashed"
                                    />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-4 py-2">Room / Window</th>
                                                <th className="px-4 py-2">Override Fabric</th>
                                                <th className="px-4 py-2">Original Size (Curtains x H)</th>
                                                <th className="px-4 py-2 text-right text-blue-600">Final Size</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => {
                                                const hNum = parseFloat(item.h || "0");
                                                const finalH = (hNum - 4).toFixed(2);
                                                const specs = itemSpecs[item.id] || {};

                                                return (
                                                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 font-medium text-slate-900">
                                                            {item.room} <span className="text-slate-400 mx-1">{'>'}</span> {item.name}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Input 
                                                                className="h-7 text-xs w-48 shadow-sm" 
                                                                placeholder={item.fabricId ? productMap[item.fabricId] : "Type fabric name..."}
                                                                defaultValue={specs.customFabric || ""}
                                                                onBlur={(e) => updateItemSpec(item.id, 'customFabric', e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        updateItemSpec(item.id, 'customFabric', e.currentTarget.value);
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500">{item.qty} {item.qty === "1" ? "curtain" : "curtains"} x {item.h}"</td>
                                                        <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                            {item.qty} {item.qty === "1" ? "curtain" : "curtains"} x {finalH}"
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
