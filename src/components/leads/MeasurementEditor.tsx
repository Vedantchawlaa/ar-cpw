'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Plus, Trash2, ChevronDown, ChevronRight, Save, Camera, X, FileDown } from "lucide-react";
import { saveMeasurement } from "@/lib/actions/measurement-actions";
import { getProducts } from "@/lib/actions/product-actions";
import { getLeads } from "@/lib/actions/lead-actions";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface MeasurementItem {
    id: string;
    name: string; // e.g., "Window 1"
    width: string;
    height: string;
    type: "Curtain" | "Blind";
    remarks: string;
    images?: string[];
    quantity?: string;
    fabricRequired?: string;
    sqft?: string;
    trackRequired?: boolean;
    trackProduct?: string; // Product ID of selected track
    trackSize?: string; // Size of the track
    fabricProduct?: string; // Product ID of selected fabric
    blindProduct?: string; // Product ID of selected blind
    // Sheer curtain fields
    sheerRequired?: boolean; // Whether sheer layer is needed
    sheerFabricProduct?: string; // Product ID of selected sheer fabric
    sheerFabricRequired?: string; // Quantity of sheer fabric needed
    sheerQuantity?: string; // Number of panels for sheer curtain
    sheerTrackProduct?: string; // Product ID of selected track for sheer (defaults to main track)
    sheerTrackSize?: string; // Size of the sheer track in inches
    sheerWidth?: string; // Separate width for sheer
    sheerHeight?: string; // Separate height for sheer
    mountType?: "Ceiling" | "Wall"; // Mount preference
    curtainType?: "Pinch Pleat" | "Ripple Fold"; // Style type
    tiesRequired?: boolean; // Whether curtain ties are needed
}

// ... (Rest of interfaces remain same)


interface Room {
    id: string;
    name: string;
    items: MeasurementItem[];
}

interface Floor {
    id: string;
    name: string;
    rooms: Room[];
}

interface MeasurementEditorProps {
    leadId?: string;
    measurementId?: string;
    initialData?: any;
    initialNotes?: string;
    initialTitle?: string;
    initialCustomerName?: string;
}

export function MeasurementEditor({
    leadId,
    measurementId,
    initialData,
    initialNotes,
    initialTitle,
    initialCustomerName
}: MeasurementEditorProps) {
    const router = useRouter();
    const [floors, setFloors] = useState<Floor[]>(initialData?.floors || []);
    const [notes, setNotes] = useState(initialNotes || "");
    const [title, setTitle] = useState(initialTitle || "");
    const [customerName, setCustomerName] = useState(initialCustomerName || "");
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [trackProducts, setTrackProducts] = useState<any[]>([]);
    const [fabricProducts, setFabricProducts] = useState<any[]>([]);
    const [blindProducts, setBlindProducts] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<string>(leadId || "");
    const [showNewLeadForm, setShowNewLeadForm] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Fetch products for selection
        getProducts().then(result => {
            if (result.success && result.data) {
                const allProducts = result.data;
                // Filter products by type
                setTrackProducts(allProducts.filter((p: any) =>
                    p.name.toLowerCase().includes('track')
                ));
                setFabricProducts(allProducts.filter((p: any) =>
                    p.name.toLowerCase().includes('fabric') || p.category?.toLowerCase() === 'fabric'
                ));
                setBlindProducts(allProducts.filter((p: any) =>
                    p.name.toLowerCase().includes('blind') || p.category?.toLowerCase() === 'blind'
                ));
            }
        });

        // Fetch leads for selection
        if (!leadId) {
            getLeads().then(leads => {
                setLeads(leads || []);
            });
        }
    }, []);

    // Helper to generate IDs
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const addFloor = () => {
        setFloors([...floors, {
            id: generateId(),
            name: `Floor ${floors.length + 1}`,
            rooms: []
        }]);
    };

    const removeFloor = (floorId: string) => {
        if (confirm("Delete this floor and all its contents?")) {
            setFloors(floors.filter(f => f.id !== floorId));
        }
    };

    const addRoom = (floorId: string) => {
        setFloors(floors.map(f => {
            if (f.id === floorId) {
                return {
                    ...f,
                    rooms: [...f.rooms, {
                        id: generateId(),
                        name: `Room ${f.rooms.length + 1}`,
                        items: []
                    }]
                };
            }
            return f;
        }));
    };

    const removeRoom = (floorId: string, roomId: string) => {
        if (confirm("Delete this room?")) {
            setFloors(floors.map(f => {
                if (f.id === floorId) {
                    return {
                        ...f,
                        rooms: f.rooms.filter(r => r.id !== roomId)
                    };
                }
                return f;
            }));
        }
    };

    const calculateValues = (item: MeasurementItem, field: keyof MeasurementItem, value: any): MeasurementItem => {
        const newItem = { ...item, [field]: value };
        const width = parseFloat(newItem.width) || 0;
        const height = parseFloat(newItem.height) || 0;

        if (field === 'trackRequired' && value === false) {
            newItem.trackProduct = undefined;
            newItem.trackSize = undefined;
            newItem.sheerTrackProduct = undefined;
        }

        if (newItem.type === "Curtain") {
            // Curtain Calculations
            if (field === 'width' || field === 'type') {
                newItem.quantity = Math.ceil(width / 18).toString();
            }

            // Fabric required: ((Height + 15) / 39) * Quantity
            // Round to .00 or .50: if decimal < .50 then .50, else next whole number
            const qty = parseFloat(newItem.quantity || "1") || 1;

            if (field === 'height' || field === 'type' || field === 'quantity' || field === 'width' || field === 'sheerRequired' || field === 'sheerWidth' || field === 'sheerHeight' || field === 'sheerQuantity') {
                const singleCurtainFabric = (height + 15) / 39;
                const rawTotal = singleCurtainFabric * qty;

                // Get the whole number and decimal parts
                const wholePart = Math.floor(rawTotal);
                const decimalPart = rawTotal - wholePart;

                let roundedTotal;
                if (decimalPart === 0) {
                    roundedTotal = wholePart; // Already .00
                } else if (decimalPart < 0.5) {
                    roundedTotal = wholePart + 0.5; // Round to .50
                } else {
                    roundedTotal = wholePart + 1; // Round up to next whole number
                }

                newItem.fabricRequired = roundedTotal.toFixed(2);

                // Track size auto-calculation (inches)
                if (newItem.trackRequired !== false) {
                    newItem.trackSize = width.toString();
                }

                // Also set sheer fabric required if sheer is enabled
                if (newItem.sheerRequired) {
                    const sWidth = parseFloat(newItem.sheerWidth || newItem.width) || 0;
                    const sHeight = parseFloat(newItem.sheerHeight || newItem.height) || 0;

                    if (field === 'sheerWidth' || field === 'type' || field === 'width') {
                        newItem.sheerQuantity = Math.ceil(sWidth / 18).toString();
                    }

                    const sQty = parseFloat(newItem.sheerQuantity || "1") || 1;
                    const sSingleCurtainFabric = (sHeight + 15) / 39;
                    const sRawTotal = sSingleCurtainFabric * sQty;

                    const sWholePart = Math.floor(sRawTotal);
                    const sDecimalPart = sRawTotal - sWholePart;

                    let sRoundedTotal;
                    if (sDecimalPart === 0) {
                        sRoundedTotal = sWholePart;
                    } else if (sDecimalPart < 0.5) {
                        sRoundedTotal = sWholePart + 0.5;
                    } else {
                        sRoundedTotal = sWholePart + 1;
                    }

                    newItem.sheerFabricRequired = sRoundedTotal.toFixed(2);

                    // Sheer track size calculation
                    if (newItem.trackRequired !== false) {
                        newItem.sheerTrackSize = sWidth.toString();
                        // Auto-populate sheer track product with main track if empty
                        if (!newItem.sheerTrackProduct && newItem.trackProduct) {
                            newItem.sheerTrackProduct = newItem.trackProduct;
                        }
                    }
                } else {
                    newItem.sheerFabricRequired = undefined;
                    newItem.sheerTrackSize = undefined;
                }
            }

            newItem.sqft = undefined;

        } else if (newItem.type === "Blind") {
            // Blind Calculations
            const effectiveHeight = Math.max(height, 39);
            const calculatedSqft = Math.ceil((width * effectiveHeight) / 144);
            newItem.sqft = Math.max(calculatedSqft, 11).toFixed(2);

            newItem.fabricRequired = undefined;
            newItem.quantity = "1";
        }
        return newItem;
    };

    const addItem = (floorId: string, roomId: string) => {
        setFloors(floors.map(f => {
            if (f.id === floorId) {
                return {
                    ...f,
                    rooms: f.rooms.map(r => {
                        if (r.id === roomId) {
                            return {
                                ...r,
                                items: [...r.items, {
                                    id: generateId(),
                                    name: `Window ${r.items.length + 1}`,
                                    width: "",
                                    height: "",
                                    type: "Curtain",
                                    remarks: "",
                                    quantity: "1",
                                    sqft: "0",
                                    fabricRequired: "0",
                                    images: [],
                                    trackRequired: true,
                                    sheerRequired: false
                                }]
                            };
                        }
                        return r;
                    })
                };
            }
            return f;
        }));
    };

    const removeItem = (floorId: string, roomId: string, itemId: string) => {
        setFloors(floors.map(f => {
            if (f.id === floorId) {
                return {
                    ...f,
                    rooms: f.rooms.map(r => {
                        if (r.id === roomId) {
                            return {
                                ...r,
                                items: r.items.filter(i => i.id !== itemId)
                            };
                        }
                        return r;
                    })
                };
            }
            return f;
        }));
    };

    const updateItem = (floorId: string, roomId: string, itemId: string, field: keyof MeasurementItem, value: any) => {
        setFloors(floors.map(f => {
            if (f.id === floorId) {
                return {
                    ...f,
                    rooms: f.rooms.map(r => {
                        if (r.id === roomId) {
                            return {
                                ...r,
                                items: r.items.map(i => {
                                    if (i.id === itemId) {
                                        // Important: We pass the NEW field and value to calculateValues
                                        return calculateValues(i, field, value);
                                    }
                                    return i;
                                })
                            };
                        }
                        return r;
                    })
                };
            }
            return f;
        }));
    };

    const updateRoomName = (floorId: string, roomId: string, name: string) => {
        setFloors(floors.map(f => {
            if (f.id === floorId) {
                return {
                    ...f,
                    rooms: f.rooms.map(r => r.id === roomId ? { ...r, name } : r)
                };
            }
            return f;
        }));
    };

    const updateFloorName = (floorId: string, name: string) => {
        setFloors(floors.map(f => f.id === floorId ? { ...f, name } : f));
    }

    const handleImageUpload = async (floorId: string, roomId: string, itemId: string, file: File) => {
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            // Optimistic UI could be added here, but for now we wait for upload
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (data.success) {
                setFloors(floors.map(f => {
                    if (f.id === floorId) {
                        return {
                            ...f,
                            rooms: f.rooms.map(r => {
                                if (r.id === roomId) {
                                    return {
                                        ...r,
                                        items: r.items.map(i => {
                                            if (i.id === itemId) {
                                                const currentImages = i.images || [];
                                                return { ...i, images: [...currentImages, data.url] };
                                            }
                                            return i;
                                        })
                                    };
                                }
                                return r;
                            })
                        };
                    }
                    return f;
                }));
            } else {
                alert("Failed to upload image: " + (data.details || data.error));
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Error uploading image");
        }
    };

    const removeImage = (floorId: string, roomId: string, itemId: string, imgIndex: number) => {
        if (!confirm("Delete this image?")) return;
        setFloors(floors.map(f => {
            if (f.id === floorId) {
                return {
                    ...f,
                    rooms: f.rooms.map(r => {
                        if (r.id === roomId) {
                            return {
                                ...r,
                                items: r.items.map(i => {
                                    if (i.id === itemId && i.images) {
                                        const newImages = [...i.images];
                                        newImages.splice(imgIndex, 1);
                                        return { ...i, images: newImages };
                                    }
                                    return i;
                                })
                            };
                        }
                        return r;
                    })
                };
            }
            return f;
        }));
    };

    const handleSave = async () => {
        // Auto-populate customer name from selected lead if not provided
        let finalCustomerName = customerName;
        if (!finalCustomerName && selectedLeadId) {
            const selectedLead = leads.find(l => l.id === selectedLeadId);
            if (selectedLead) {
                finalCustomerName = selectedLead.name;
                setCustomerName(selectedLead.name);
            }
        }

        // Skip validation if we're on a lead page (leadId is already set)
        if (!leadId && !title && !finalCustomerName && !selectedLeadId) {
            alert("Please provide a Title or select a Lead.");
            return;
        }

        setLoading(true);
        const result = await saveMeasurement({
            id: measurementId,
            leadId: selectedLeadId || leadId || null,
            data: { floors },
            notes,
            customerName: finalCustomerName,
            title
        });
        setLoading(false);
        if (result.success) {
            if (!measurementId && !leadId && !selectedLeadId && result.data?.id) {
                // If creating new standalone, redirect to edit page
                router.push(`/measurements/${result.data.id}`);
            } else {
                router.refresh();
                alert("Measurements saved successfully!");
            }
        } else {
            alert(result.error || "Failed to save measurements");
        }
    };


    return (
        <div className="space-y-6 print:hidden">

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex-1">
                    <h2 className="text-xl font-semibold">Measurements & Sizing</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage floors, rooms, and window specifications</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                    >
                        <Save className="h-4 w-4" />
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            {!leadId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Title / Reference</label>
                        <Input
                            placeholder="e.g. Dream House, Office Renovation"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-10"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Lead / Customer</label>
                        <SearchableSelect
                            options={[
                                ...leads.map((l: any) => ({ id: l.id, name: `${l.name} - ${l.city || "No city"}` })),
                                { id: "new", name: "+ Create New Lead" }
                            ]}
                            value={selectedLeadId}
                            onChange={(value) => {
                                if (value === "new") {
                                    setShowNewLeadForm(true);
                                    setSelectedLeadId("");
                                } else {
                                    setSelectedLeadId(value);
                                    setShowNewLeadForm(false);
                                    const selected = leads.find(l => l.id === value);
                                    if (selected) {
                                        setCustomerName(selected.name);
                                    }
                                }
                            }}
                            placeholder="Select lead or create new..."
                            className="h-10"
                        />
                    </div>
                </div>
            )}

            <div className="space-y-6">


                {floors.map((floor) => (
                    <Card key={floor.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="bg-zinc-50 border-b py-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-blue-800">Floor:</span>
                                    <Input
                                        value={floor.name}
                                        onChange={(e) => updateFloorName(floor.id, e.target.value)}
                                        className="h-8 w-48 font-semibold bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white transition-colors"
                                    />
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeFloor(floor.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {floor.rooms.map((room) => (
                                <div key={room.id} className="border rounded-md p-4 bg-white shadow-sm">
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-zinc-600">Room:</span>
                                            <Input
                                                value={room.name}
                                                onChange={(e) => updateRoomName(floor.id, room.id, e.target.value)}
                                                className="h-7 w-40 font-medium bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white transition-colors"
                                            />
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => removeRoom(floor.id, room.id)} className="text-red-500 h-7 w-7 p-0">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {room.items.map((item) => (
                                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-3 bg-zinc-50 rounded-md border border-zinc-100">
                                                <div className="md:col-span-3">
                                                    <label className="text-xs text-zinc-500 block mb-1">Name</label>
                                                    <Input
                                                        value={item.name}
                                                        onChange={(e) => updateItem(floor.id, room.id, item.id, 'name', e.target.value)}
                                                        className="h-8 text-sm"
                                                        placeholder="Window/Door"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-xs text-zinc-500 block mb-1">Type</label>
                                                    <select
                                                        className="h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        value={item.type}
                                                        onChange={(e) => updateItem(floor.id, room.id, item.id, 'type', e.target.value)}
                                                    >
                                                        <option value="Curtain">Curtain</option>
                                                        <option value="Blind">Blind</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-xs text-zinc-500 block mb-1">Width x Height</label>
                                                    <div className="flex gap-1">
                                                        <Input
                                                            placeholder="W"
                                                            className="h-8 text-sm px-2"
                                                            value={item.width}
                                                            onChange={(e) => updateItem(floor.id, room.id, item.id, 'width', e.target.value)}
                                                        />
                                                        <span className="text-zinc-400 self-center">x</span>
                                                        <Input
                                                            placeholder="H"
                                                            className="h-8 text-sm px-2"
                                                            value={item.height}
                                                            onChange={(e) => updateItem(floor.id, room.id, item.id, 'height', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-xs text-zinc-500 block mb-1">
                                                        {item.type === 'Curtain' ? 'Qty & Fabric' : 'Sq/ft'}
                                                    </label>
                                                    <div className="flex gap-2">
                                                        {item.type === 'Curtain' && (
                                                            <div className="relative flex-1">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-sm px-2 bg-yellow-50"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(floor.id, room.id, item.id, 'quantity', e.target.value)}
                                                                    title="Suggested Quantity (Editable)"
                                                                />
                                                                <span className="text-[10px] text-zinc-400 absolute -bottom-4 left-0">Qty</span>
                                                            </div>
                                                        )}

                                                        {item.type === 'Curtain' && (
                                                            <div className="relative flex-1">
                                                                <div className="relative flex-1">
                                                                    <Input
                                                                        type="text"
                                                                        className="h-8 text-sm px-2 bg-slate-50 text-slate-700 font-medium"
                                                                        value={item.fabricRequired || ""}
                                                                        onChange={(e) => updateItem(floor.id, room.id, item.id, 'fabricRequired', e.target.value)}
                                                                    />
                                                                    <span className="text-[10px] text-zinc-400 absolute -bottom-4 left-0">Fabric (m)</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.type === 'Blind' && (
                                                            <div className="relative flex-1">
                                                                <div className="h-8 text-sm px-2 flex items-center bg-slate-100 rounded-md border text-slate-600">
                                                                    {item.sqft || 0}
                                                                </div>
                                                                <span className="text-[10px] text-zinc-400 absolute -bottom-4 left-0">Sq/ft</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {item.type === 'Curtain' && (
                                                    <div className="md:col-span-2">
                                                        <label className="text-xs text-zinc-500 block mb-1">Track Required?</label>
                                                        <div className="flex items-center h-8">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.trackRequired !== false}
                                                                    onChange={(e) => updateItem(floor.id, room.id, item.id, 'trackRequired', e.target.checked)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                                />
                                                                <span className="text-sm text-slate-700">Include Base Track</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                {item.type === 'Curtain' && (
                                                    <div className="md:col-span-full bg-slate-50 border rounded-md p-2 flex flex-wrap gap-4 items-center">
                                                        <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold pr-2 border-r">Hardware Options</span>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={item.mountType !== "Ceiling"}
                                                                onChange={() => updateItem(floor.id, room.id, item.id, 'mountType', "Wall")}
                                                                className="text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700 hover:text-blue-600">Wall Mount</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={item.mountType === "Ceiling"}
                                                                onChange={() => updateItem(floor.id, room.id, item.id, 'mountType', "Ceiling")}
                                                                className="text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700 hover:text-blue-600">Ceiling Mount</span>
                                                        </label>

                                                        <div className="w-px h-4 bg-slate-300 mx-1 hidden sm:block"></div>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={item.curtainType !== "Pinch Pleat"}
                                                                onChange={() => updateItem(floor.id, room.id, item.id, 'curtainType', "Ripple Fold")}
                                                                className="text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700 hover:text-blue-600">Ripple Fold</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={item.curtainType === "Pinch Pleat"}
                                                                onChange={() => updateItem(floor.id, room.id, item.id, 'curtainType', "Pinch Pleat")}
                                                                className="text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700 hover:text-blue-600">Pinch Pleat</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!item.tiesRequired}
                                                                onChange={(e) => updateItem(floor.id, room.id, item.id, 'tiesRequired', e.target.checked)}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700 hover:text-blue-600">Ties Required</span>
                                                        </label>
                                                    </div>
                                                )}

                                                {item.type === 'Curtain' && item.trackRequired !== false && (
                                                    <>
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs text-zinc-500 block mb-1">Track Product</label>
                                                            <SearchableSelect
                                                                options={trackProducts.map((p: any) => ({ id: p.id, name: p.name, rate: p.rate }))}
                                                                value={item.trackProduct || ""}
                                                                onChange={(value) => updateItem(floor.id, room.id, item.id, 'trackProduct', value)}
                                                                placeholder="Select track..."
                                                                className="h-8"
                                                                renderOption={(opt) => (
                                                                    <div className="flex justify-between items-center w-full">
                                                                        <span className="font-medium text-xs">{opt.name}</span>
                                                                        <span className="text-[10px] text-zinc-400">₹{opt.rate}</span>
                                                                    </div>
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1">
                                                            <label className="text-xs text-zinc-500 block mb-1">Track Size (inches)</label>
                                                            <Input
                                                                placeholder="Size"
                                                                className="h-8 text-sm"
                                                                type="number"
                                                                value={item.trackSize || ""}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                    updateItem(floor.id, room.id, item.id, 'trackSize', e.target.value);
                                                                }}
                                                            />
                                                            {item.trackSize && (
                                                                <span className="text-[10px] text-zinc-500">
                                                                    {(parseFloat(item.trackSize) / 12).toFixed(2)} ft
                                                                </span>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {item.type === 'Curtain' && (
                                                    <div className="md:col-span-3">
                                                        <label className="text-xs text-zinc-500 block mb-1">Fabric Product</label>
                                                        <SearchableSelect
                                                            options={fabricProducts.map((p: any) => ({ id: p.id, name: p.name, rate: p.rate }))}
                                                            value={item.fabricProduct || ""}
                                                            onChange={(value) => updateItem(floor.id, room.id, item.id, 'fabricProduct', value)}
                                                            placeholder="Select fabric..."
                                                            className="h-8"
                                                            renderOption={(opt) => (
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span className="font-medium text-xs">{opt.name}</span>
                                                                    <span className="text-[10px] text-zinc-400">₹{opt.rate}</span>
                                                                </div>
                                                            )}
                                                        />
                                                    </div>
                                                )}

                                                {/* Sheer Curtain Option */}
                                                {item.type === 'Curtain' && (
                                                    <div className="md:col-span-2">
                                                        <label className="text-xs text-zinc-500 block mb-1">Sheer Required?</label>
                                                        <div className="flex items-center h-8">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.sheerRequired || false}
                                                                    onChange={(e) => updateItem(floor.id, room.id, item.id, 'sheerRequired', e.target.checked)}
                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-sm text-zinc-700">
                                                                    {item.sheerRequired ? 'Yes' : 'No'}
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sheer Fabric and Track Selection */}
                                                {item.type === 'Curtain' && item.sheerRequired && (
                                                    <>
                                                        <div className="md:col-span-3">
                                                            <label className="text-xs text-zinc-500 block mb-1">Sheer Fabric Product</label>
                                                            <SearchableSelect
                                                                options={fabricProducts.map((p: any) => ({ id: p.id, name: p.name, rate: p.rate }))}
                                                                value={item.sheerFabricProduct || ""}
                                                                onChange={(value) => updateItem(floor.id, room.id, item.id, 'sheerFabricProduct', value)}
                                                                placeholder="Select sheer fabric..."
                                                                className="h-8"
                                                                renderOption={(opt) => (
                                                                    <div className="flex justify-between items-center w-full">
                                                                        <span className="font-medium text-xs">{opt.name}</span>
                                                                        <span className="text-[10px] text-zinc-400">₹{opt.rate}</span>
                                                                    </div>
                                                                )}
                                                            />
                                                        </div>

                                                        <div className="md:col-span-1">
                                                            <label className="text-xs text-zinc-500 block mb-1">Sheer W x H</label>
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    placeholder="W"
                                                                    className="h-8 text-sm px-2"
                                                                    value={item.sheerWidth || item.width}
                                                                    onChange={(e) => updateItem(floor.id, room.id, item.id, 'sheerWidth', e.target.value)}
                                                                />
                                                                <span className="text-zinc-400 text-xs">x</span>
                                                                <Input
                                                                    placeholder="H"
                                                                    className="h-8 text-sm px-2"
                                                                    value={item.sheerHeight || item.height}
                                                                    onChange={(e) => updateItem(floor.id, room.id, item.id, 'sheerHeight', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="md:col-span-1">
                                                            <label className="text-xs text-zinc-500 block mb-1">Sheer Qty</label>
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-sm px-2"
                                                                value={item.sheerQuantity || ""}
                                                                onChange={(e) => updateItem(floor.id, room.id, item.id, 'sheerQuantity', e.target.value)}
                                                                placeholder="Qty"
                                                            />
                                                        </div>

                                                        <div className="md:col-span-1">
                                                            <label className="text-xs text-zinc-500 block mb-1">Sheer Fabric (m)</label>
                                                            <Input
                                                                type="text"
                                                                className="h-8 text-sm px-2 bg-slate-50 text-slate-700 font-medium"
                                                                value={item.sheerFabricRequired || ""}
                                                                onChange={(e) => updateItem(floor.id, room.id, item.id, 'sheerFabricRequired', e.target.value)}
                                                                placeholder="Calc..."
                                                            />
                                                        </div>

                                                        {item.trackRequired !== false && (
                                                            <>
                                                                <div className="md:col-span-2">
                                                                    <label className="text-xs text-zinc-500 block mb-1">Sheer Track Product</label>
                                                                    <SearchableSelect
                                                                        options={trackProducts.map((p: any) => ({ id: p.id, name: p.name, rate: p.rate }))}
                                                                        value={item.sheerTrackProduct || ""}
                                                                        onChange={(value) => updateItem(floor.id, room.id, item.id, 'sheerTrackProduct', value)}
                                                                        placeholder="Select sheer track..."
                                                                        className="h-8"
                                                                        renderOption={(opt) => (
                                                                            <div className="flex justify-between items-center w-full">
                                                                                <span className="font-medium text-xs">{opt.name}</span>
                                                                                <span className="text-[10px] text-zinc-400">₹{opt.rate}</span>
                                                                            </div>
                                                                        )}
                                                                    />
                                                                    <span className="text-[10px] text-zinc-400">Defaults to main track</span>
                                                                </div>

                                                                <div className="md:col-span-1">
                                                                    <label className="text-xs text-zinc-500 block mb-1">Sheer Track Size (inches)</label>
                                                                    <Input
                                                                        placeholder="Size"
                                                                        className="h-8 text-sm"
                                                                        type="number"
                                                                        value={item.sheerTrackSize || item.trackSize || ""}
                                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                            updateItem(floor.id, room.id, item.id, 'sheerTrackSize', e.target.value);
                                                                        }}
                                                                    />
                                                                    {item.sheerTrackSize && (
                                                                        <span className="text-[10px] text-zinc-500">
                                                                            {(parseFloat(item.sheerTrackSize) / 12).toFixed(2)} ft
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                )}

                                                {item.type === 'Blind' && (
                                                    <div className="md:col-span-5">
                                                        <label className="text-xs text-zinc-500 block mb-1">Blind Product</label>
                                                        <SearchableSelect
                                                            options={blindProducts.map((p: any) => ({ id: p.id, name: p.name, rate: p.rate }))}
                                                            value={item.blindProduct || ""}
                                                            onChange={(value) => updateItem(floor.id, room.id, item.id, 'blindProduct', value)}
                                                            placeholder="Select blind..."
                                                            className="h-8"
                                                            renderOption={(opt) => (
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span className="font-medium text-xs">{opt.name}</span>
                                                                    <span className="text-[10px] text-zinc-400">₹{opt.rate}</span>
                                                                </div>
                                                            )}
                                                        />
                                                    </div>
                                                )}

                                                <div className={
                                                    item.type === 'Curtain'
                                                        ? (item.trackRequired !== false ? 'md:col-span-3' : 'md:col-span-5')
                                                        : 'md:col-span-3'
                                                }>
                                                    <label className="text-xs text-zinc-500 block mb-1">Remarks</label>
                                                    <Input
                                                        placeholder="Fabric, color, notes..."
                                                        className="h-8 text-sm"
                                                        value={item.remarks}
                                                        onChange={(e) => updateItem(floor.id, room.id, item.id, 'remarks', e.target.value)}
                                                    />
                                                </div>
                                                <div className="md:col-span-1 flex flex-col items-center gap-2 pt-5">
                                                    <Button variant="ghost" size="sm" onClick={() => removeItem(floor.id, room.id, item.id)} className="text-red-500 hover:bg-red-50 h-8 w-8 p-0">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <div className="relative">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            id={`upload-${item.id}`}
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                if (e.target.files?.[0]) {
                                                                    handleImageUpload(floor.id, room.id, item.id, e.target.files[0]);
                                                                    e.target.value = ''; // Reset input
                                                                }
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={`upload-${item.id}`}
                                                            className="flex items-center justify-center h-8 w-8 rounded-md cursor-pointer hover:bg-zinc-100 text-blue-500 transition-colors"
                                                            title="Upload Photo"
                                                        >
                                                            <Camera className="h-4 w-4" />
                                                        </label>
                                                    </div>
                                                </div>
                                                {/* Image Thumbnails */}
                                                {item.images && item.images.length > 0 && (
                                                    <div className="col-span-12 flex gap-3 overflow-x-auto pb-2 mt-2">
                                                        {item.images.map((img, idx) => (
                                                            <div key={idx} className="relative group flex-shrink-0">
                                                                <div className="h-20 w-20 rounded-md border border-zinc-200 overflow-hidden bg-white">
                                                                    <img src={img} alt={`Window ${idx + 1}`} className="h-full w-full object-cover" />
                                                                </div>
                                                                <button
                                                                    onClick={() => removeImage(floor.id, room.id, item.id, idx)}
                                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" onClick={() => addItem(floor.id, room.id)} className="w-full border-dashed text-zinc-500 hover:text-zinc-900">
                                            + Add Window / Door
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <Button variant="outline" onClick={() => addRoom(floor.id)} className="w-full py-6 border-dashed border-2">
                                + Add Room to {floor.name}
                            </Button>
                        </CardContent>
                    </Card>
                ))}

                <Button onClick={addFloor} className="w-full py-8 border-dashed border-2 text-lg font-medium text-zinc-500 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100">
                    + Add Floor
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>General Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Textarea
                            placeholder="Any additional notes for this site..."
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            className="min-h-[120px]"
                        />

                        <div className="flex justify-center pt-4 border-t">
                            <Button
                                onClick={handleSave}
                                disabled={loading}
                                size="lg"
                                className="w-full sm:w-64 gap-3 bg-blue-600 hover:bg-blue-700 shadow-lg text-lg h-14"
                            >
                                <Save className="h-5 w-5" />
                                {loading ? "Saving..." : "Finalize & Save"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Mobile Sticky Save Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-[100] sm:hidden flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <div className="flex-1 truncate">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Draft Changes</p>
                    <p className="text-xs font-semibold text-slate-900 truncate">{title || initialTitle || "New Measurement"}</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    size="sm"
                    className="gap-2 bg-blue-600 hover:bg-blue-700 px-6 h-10 shadow-md font-bold"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "..." : "SAVE"}
                </Button>
            </div>

            {/* Spacer for sticky bar */}
            <div className="h-20 sm:hidden" />
        </div>

    );
}
