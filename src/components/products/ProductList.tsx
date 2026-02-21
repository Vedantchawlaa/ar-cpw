'use client';

import { useState, useEffect } from "react";
import { Product } from "@/lib/types/quotation";
import { getProducts, updateProduct, deleteProduct, upsertProduct } from "@/lib/actions/product-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export default function ProductList() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: "", rate: 0 });
    const [isAdding, setIsAdding] = useState(false);
    const [newForm, setNewForm] = useState({ name: "", rate: 0, stockQuantity: 0, category: "" });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/products');
            const result = await response.json();
            if (result.success && result.data) {
                setProducts(result.data);
            } else if (!result.success) {
                setError(result.error || "Failed to fetch products");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setEditForm({ name: product.name, rate: product.rate });
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        const result = await updateProduct(editingId, editForm);
        if (result.success) {
            setEditingId(null);
            fetchProducts();
        } else {
            alert("Error: " + result.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this product?")) {
            const result = await deleteProduct(id);
            if (result.success) {
                fetchProducts();
            } else {
                alert("Error: " + result.error);
            }
        }
    };

    const handleAdd = async () => {
        if (!newForm.name) return;
        const result = await upsertProduct(newForm.name, newForm.rate, newForm.stockQuantity, newForm.category);
        if (result?.success) {
            setIsAdding(false);
            setNewForm({ name: "", rate: 0, stockQuantity: 0, category: "" });
            fetchProducts();
        } else {
            alert("Error: " + (result?.error || "Failed to save product"));
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl font-bold">Product Database</CardTitle>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Search products..."
                            className="pl-9 w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {/* @ts-ignore */}
                    <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
                        <Plus className="h-4 w-4 mr-2" /> New Product
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Add New Header */}
                    {isAdding && (
                        <div className="grid grid-cols-12 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                            <div className="col-span-12 md:col-span-4">
                                <label className="text-xs font-semibold text-blue-700 mb-1 block">NAME</label>
                                <Input
                                    value={newForm.name}
                                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                                    placeholder="Product Name"
                                    className="h-10 border-blue-200"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="text-xs font-semibold text-blue-700 mb-1 block">CATEGORY</label>
                                <SearchableSelect
                                    options={[
                                        { id: "Tracks", name: "Tracks" },
                                        { id: "Accessories", name: "Accessories" },
                                        { id: "Rods", name: "Rods" },
                                        { id: "Fabric", name: "Fabric" },
                                        { id: "Blinds", name: "Blinds" },
                                    ]}
                                    value={newForm.category || ""}
                                    onChange={(val) => setNewForm({ ...newForm, category: val })}
                                    placeholder="Select..."
                                    className="h-10 border-blue-200"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="text-xs font-semibold text-blue-700 mb-1 block">RATE (₹)</label>
                                <Input
                                    type="number"
                                    value={newForm.rate}
                                    onChange={(e) => setNewForm({ ...newForm, rate: parseFloat(e.target.value) || 0 })}
                                    className="h-10 border-blue-200"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="text-xs font-semibold text-blue-700 mb-1 block">INITIAL STOCK</label>
                                <Input
                                    type="number"
                                    value={newForm.stockQuantity}
                                    onChange={(e) => setNewForm({ ...newForm, stockQuantity: parseInt(e.target.value) || 0 })}
                                    placeholder="0"
                                    className="h-10 border-blue-200"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2 flex items-end gap-2">
                                {/* @ts-ignore */}
                                <Button size="icon" onClick={handleAdd} className="h-10 w-10">
                                    <Save className="h-4 w-4" />
                                </Button>
                                {/* @ts-ignore */}
                                <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)} className="h-10 w-10 text-zinc-500">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Table Headers */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-zinc-50 rounded-md text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        <div className="col-span-6">Product Name</div>
                        <div className="col-span-4 text-right pr-4">Rate</div>
                        <div className="col-span-2 text-center">Actions</div>
                    </div>

                    {/* Product List */}
                    <div className="divide-y divide-zinc-100">
                        {loading ? (
                            <div className="py-8 text-center text-zinc-500">Loading products...</div>
                        ) : error ? (
                            <div className="py-8 text-center text-red-500">
                                <p className="font-semibold">Error loading products:</p>
                                <p className="text-sm">{error}</p>
                                <Button variant="outline" size="sm" onClick={fetchProducts} className="mt-4">
                                    Retry
                                </Button>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="py-8 text-center text-zinc-500">No products found.</div>
                        ) : (
                            filteredProducts.map(product => (
                                <div key={product.id} className="grid grid-cols-12 gap-4 px-4 py-4 items-center group hover:bg-zinc-50 transition-colors">
                                    {editingId === product.id ? (
                                        <>
                                            <div className="col-span-6">
                                                <Input
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="col-span-4 text-right pr-4">
                                                <Input
                                                    type="number"
                                                    value={editForm.rate}
                                                    onChange={(e) => setEditForm({ ...editForm, rate: parseFloat(e.target.value) || 0 })}
                                                    className="h-9 text-right"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-center gap-1">
                                                {/* @ts-ignore */}
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleUpdate}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                {/* @ts-ignore */}
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={() => setEditingId(null)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="col-span-6 text-sm font-medium text-zinc-900">{product.name}</div>
                                            <div className="col-span-4 text-right pr-4 text-sm font-semibold text-zinc-700">₹{product.rate.toLocaleString()}</div>
                                            <div className="col-span-2 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* @ts-ignore */}
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => handleEdit(product)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {/* @ts-ignore */}
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(product.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CheckIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
