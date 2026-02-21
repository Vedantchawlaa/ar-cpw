'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createQuotation, updateQuotation, type QuotationWithRelations } from "@/lib/actions/quotation-actions";
import { getProducts, upsertProduct } from "@/lib/actions/product-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Save, Plus, Trash2, Search, Database, Check } from "lucide-react";
import { Lead } from "@/lib/types/lead";
import { SearchableSelect, type Option } from "@/components/ui/SearchableSelect";

// Fallback type if Prisma client types are out of sync
export interface Product {
    id: string;
    name: string;
    rate: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface QuotationBuilderProps {
    leads: { id: string; name: string; city: string }[];
    initialData?: QuotationWithRelations;
    initialItems?: any[] | null;
    initialLeadId?: string;
}

interface LineItem {
    id: string;
    description: string;
    details?: string;
    quantity: number;
    rate: number;
    amount: number;
}

export default function QuotationBuilder({ leads, initialData, initialItems, initialLeadId }: QuotationBuilderProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedLeadId, setSelectedLeadId] = useState(initialData?.leadId || initialLeadId || "");
    const [quotationNumber, setQuotationNumber] = useState(initialData?.number || "");
    const [searchQuery, setSearchQuery] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [items, setItems] = useState<LineItem[]>(
        initialItems ||
        initialData?.items.map((i: any) => ({ ...i, id: i.id, details: i.details || "" })) ||
        [{ id: '1', description: '', details: '', quantity: 1, rate: 0, amount: 0 }]
    );
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        const leadIdToUse = initialData?.leadId || initialLeadId;
        if (leadIdToUse) {
            const lead = leads.find(l => l.id === leadIdToUse);
            if (lead) {
                setSearchQuery(lead.name);
            }
        }
    }, [initialData?.leadId, initialLeadId, leads]);

    const filteredLeads = leads.filter(lead =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (data.success && data.data) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch products for builder:", error);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Back-calculate rates if needed, or just set raw values
    // Assuming taxRate isn't stored explicitly as percentage in DB, but as amount. 
    // We might need to approximate or just show amount control.
    // For now, let's keep it simple: defaulting to 0 for tax/discount if valid calculation isn't easy, 
    // unless we store them. Schema has Tax/Discount amounts.
    // Let's allow editing amounts directly or reverse calculate percentage?
    // Let's stick to manual amounts for tax/discount if editing, or try to init.

    // Actually, schema has tax and discount as floats (amounts).
    // The builder uses rate/percentage for tax.
    // Let's initialize taxAmount directly?
    // The builder state says `taxRate` (percentage).
    // If we have `initialData.tax`, `subtotal` is known. `taxRate = (tax / subtotal) * 100`.

    const [taxRate, setTaxRate] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [receivedAmount, setReceivedAmount] = useState(0);
    const [description, setDescription] = useState(initialData?.description || "");
    const [services, setServices] = useState<{ id: string, label: string, enabled: boolean, rate: string | number }[]>(
        initialData?.services || [
            { id: '1', label: 'Installation', enabled: false, rate: 0 },
            { id: '2', label: 'Transport', enabled: false, rate: 0 },
            { id: '3', label: 'Site Measurement', enabled: false, rate: 0 },
        ]
    );
    const [savedProducts, setSavedProducts] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (initialData) {
            const sub = initialData.items.reduce((sum: number, item: any) => sum + item.amount, 0);
            if (sub > 0 && initialData.tax) {
                setTaxRate((initialData.tax / sub) * 100);
            }
        }
    }, [initialData]);

    // Calculations
    const subtotal = items.reduce((sum: number, item: LineItem) => sum + item.amount, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const baseTotal = subtotal + taxAmount - discount;
    const total = Math.round(baseTotal);
    const roundOff = total - baseTotal;

    const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                let updated = { ...item, [field]: value };

                // If description changes, check for product match to auto-fill rate
                if (field === 'description') {
                    const matchedProduct = products.find(p => p.name.toLowerCase() === value.toLowerCase());
                    if (matchedProduct) {
                        updated.rate = matchedProduct.rate;
                    }
                }

                // Auto-calc amount
                if (field === 'quantity' || field === 'rate' || (field === 'description' && updated.rate !== item.rate)) {
                    updated.amount = updated.quantity * updated.rate;
                }
                return updated;
            }
            return item;
        }));
    };

    const addItem = () => {
        setItems(prev => [
            ...prev,
            { id: Math.random().toString(), description: '', details: '', quantity: 1, rate: 0, amount: 0 }
        ]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) {
            setItems(prev => prev.filter(item => item.id !== id));
        }
    };

    const saveToCatalog = async (description: string, rate: number, itemId: string) => {
        if (!description) return;
        const result = await upsertProduct(description, rate);
        if (result?.success) {
            setSavedProducts(prev => ({ ...prev, [itemId]: true }));
            fetchProducts(); // Refresh the list for other rows
            setTimeout(() => {
                setSavedProducts(prev => ({ ...prev, [itemId]: false }));
            }, 2000);
        } else {
            alert("Failed to save product: " + (result?.error || "Unknown error"));
        }
    };

    const handleSubmit = async () => {
        if (!selectedLeadId) {
            alert("Please select a customer.");
            return;
        }

        // Validate items
        if (items.some(i => !i.description || i.amount <= 0)) {
            alert("Please ensure all items have a description and valid amount.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                number: quotationNumber || undefined,
                leadId: selectedLeadId,
                items: items.map(({ description, quantity, rate, amount }) => ({
                    description, quantity, rate, amount
                })),
                subtotal,
                tax: taxAmount,
                discount,
                total,
                receivedAmount,
                status: initialData?.status || 'DRAFT',
                description,
                services
            };

            let result;
            if (initialData) {
                result = await updateQuotation(initialData.id, payload);
            } else {
                result = await createQuotation(payload);
            }

            if (result.success) {
                router.push("/quotations");
                router.refresh();
            } else {
                alert("Failed to save quotation: " + result.error);
            }
        } catch (error) {
            console.error(error);
            alert("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Builder Form */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quotation Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col space-y-2">
                                <label className="text-sm font-medium text-zinc-700">Quotation Number (Optional)</label>
                                <Input
                                    placeholder="Auto-generated if empty (e.g. EST-2024-001)"
                                    value={quotationNumber}
                                    onChange={(e) => setQuotationNumber(e.target.value)}
                                />
                                <p className="text-xs text-zinc-500">Leave empty to auto-generate a new number.</p>
                            </div>

                            <div className="relative group">
                                <label className="text-sm font-medium text-zinc-700 mb-2 block">Select Customer</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        className="flex h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Search customer by name or city..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setIsDropdownOpen(true);
                                            if (e.target.value === "") {
                                                setSelectedLeadId("");
                                            }
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                    />
                                </div>

                                {isDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredLeads.length > 0 ? (
                                            filteredLeads.map(lead => (
                                                <div
                                                    key={lead.id}
                                                    className={cn(
                                                        "px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 flex justify-between items-center",
                                                        selectedLeadId === lead.id ? "bg-blue-50 text-blue-700" : "text-zinc-700"
                                                    )}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault(); // Prevent blur
                                                        setSelectedLeadId(lead.id);
                                                        setSearchQuery(lead.name);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                >
                                                    <span className="font-medium">{lead.name}</span>
                                                    <span className="text-xs text-zinc-500">{lead.city}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-zinc-400 text-center">
                                                No customers found.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="flex flex-col space-y-2">
                                    <label className="text-sm font-medium text-zinc-700">Description / Notes</label>
                                    <textarea
                                        className="flex min-h-[100px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Add any special instructions or notes here..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-col space-y-2">
                                    <label className="text-sm font-medium text-zinc-700">Additional Services (Optional)</label>
                                    <div className="border border-zinc-200 rounded-md p-3 space-y-2 bg-zinc-50/30">
                                        {services.map((service, idx) => (
                                            <div key={service.id} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`service-${service.id}`}
                                                    checked={service.enabled}
                                                    onChange={(e) => {
                                                        const newServices = [...services];
                                                        newServices[idx].enabled = e.target.checked;
                                                        setServices(newServices);
                                                    }}
                                                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="flex-1 flex items-center space-x-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Service Name"
                                                        value={service.label}
                                                        onChange={(e) => {
                                                            const newServices = [...services];
                                                            newServices[idx].label = e.target.value;
                                                            setServices(newServices);
                                                        }}
                                                        className="bg-transparent text-sm border-none focus:ring-0 p-0 text-zinc-700 w-full"
                                                    />
                                                    <div className="flex items-center space-x-1 min-w-[80px]">
                                                        <span className="text-zinc-400 text-xs">₹</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Price"
                                                            value={service.rate}
                                                            onChange={(e) => {
                                                                const newServices = [...services];
                                                                newServices[idx].rate = e.target.value;
                                                                setServices(newServices);
                                                            }}
                                                            className="bg-transparent text-sm border-none focus:ring-0 p-0 text-zinc-700 w-full text-right"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setServices([...services, { id: Math.random().toString(), label: '', enabled: true, rate: 0 }])}
                                            className="text-xs text-blue-600 hover:underline flex items-center pt-1"
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Add Service
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 italic">* These appear on the estimate with a tick mark but don't add to the total.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Items</CardTitle>
                            {/* @ts-ignore */}
                            <Button size="sm" variant="outline" onClick={addItem}>
                                <Plus className="h-4 w-4 mr-2" /> Add Item
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {items.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-end border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                                    <div className="col-span-12 md:col-span-5">
                                        <div className="relative group">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</label>
                                                {item.description && (
                                                    products.some(p => p.name.toLowerCase() === item.description.toLowerCase()) ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold uppercase tracking-tighter">Catalogue</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded-full font-bold uppercase tracking-tighter">Manual Entry</span>
                                                    )
                                                )}
                                            </div>
                                            <div className="relative">
                                                <SearchableSelect
                                                    options={products.map(p => ({ id: p.id, name: p.name, rate: p.rate }))}
                                                    value={item.description}
                                                    editable={true}
                                                    onChange={(val) => {
                                                        handleItemChange(item.id, 'description', val);
                                                    }}
                                                    placeholder="Item name (e.g. Roller Blind)"
                                                    renderOption={(opt: Option) => (
                                                        <div className="flex justify-between items-center w-full">
                                                            <div className="flex items-center">
                                                                <Database className="h-3 w-3 mr-2 text-zinc-400" />
                                                                <span className="font-medium text-sm">{opt.name}</span>
                                                            </div>
                                                            <span className="text-xs text-zinc-400">₹{opt.rate}</span>
                                                        </div>
                                                    )}
                                                    className="pr-10"
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 pointer-events-auto">
                                                    {!products.some(p => p.name.toLowerCase() === item.description.toLowerCase()) && item.description && (
                                                        <button
                                                            type="button"
                                                            onClick={() => saveToCatalog(item.description, item.rate, item.id)}
                                                            className={cn(
                                                                "p-1 hover:bg-zinc-100 rounded-md transition-colors",
                                                                savedProducts[item.id] ? "text-green-500" : "text-zinc-400 hover:text-blue-500"
                                                            )}
                                                            title="Save to Catalog"
                                                        >
                                                            {savedProducts[item.id] ? <Check className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                        <label className="text-xs font-medium text-zinc-500 mb-1 block">Qty</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                        <label className="text-xs font-medium text-zinc-500 mb-1 block">Rate</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={item.rate}
                                            onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="col-span-3 md:col-span-2">
                                        <label className="text-xs font-medium text-zinc-500 mb-1 block">Amount</label>
                                        <div className="h-10 flex items-center px-3 bg-zinc-50 rounded-md text-sm font-semibold">
                                            ₹{item.amount.toFixed(0)}
                                        </div>
                                    </div>
                                    <div className="col-span-12 md:col-span-11 mt-1">
                                        <Input
                                            placeholder="Details / Specs (Size, Fabric, Options...)"
                                            value={item.details || ''}
                                            onChange={(e) => handleItemChange(item.id, 'details', e.target.value)}
                                            className="h-8 text-[13px] bg-zinc-50/50 border-zinc-200"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-1 flex justify-end">
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-500">Subtotal</span>
                                <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500">Tax (%)</span>
                                    <input
                                        type="number"
                                        className="w-16 text-right border rounded px-1 text-sm"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500">Tax Amount</span>
                                    <span className="font-medium text-red-600">+ ₹{taxAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-zinc-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500">Discount (₹)</span>
                                    <input
                                        type="number"
                                        className="w-20 text-right border rounded px-1 text-sm"
                                        value={discount}
                                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-500">Received (₹)</span>
                                    <input
                                        type="number"
                                        className="w-20 text-right border rounded px-1 text-sm"
                                        value={receivedAmount}
                                        onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                {Math.abs(roundOff) > 0.001 && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500 italic">Round Off</span>
                                        <span className={cn("font-medium", roundOff >= 0 ? "text-green-600" : "text-amber-600")}>
                                            {roundOff >= 0 ? "+" : ""}
                                            {roundOff.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-zinc-200 flex justify-between items-center">
                                <span className="text-lg font-bold text-zinc-900">Total</span>
                                <span className="text-xl font-bold text-blue-600">₹{total.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-zinc-500">
                                <span>Balance</span>
                                <span>₹{(total - receivedAmount).toFixed(0)}</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            {/* @ts-ignore */}
                            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" /> Save Quotation
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            {/* Global Datalist for Autocomplete */}
            <datalist id="products-datalist">
                {products.map(p => (
                    <option key={p.id} value={p.name}>
                        Rate: ₹{p.rate}
                    </option>
                ))}
            </datalist>
        </>
    );
}
