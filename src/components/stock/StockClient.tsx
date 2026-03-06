"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
// @ts-ignore
import { Package, AlertTriangle, Pencil, Search, TrendingDown } from "lucide-react";
import { updateProductStock, adjustProductStock } from "@/lib/actions/stock-actions";

interface Product {
    id: string;
    name: string;
    category: string;
    rate: number;
    unit: string;
    stockQuantity: number;
}

interface StockClientProps {
    products: Product[];
    lowStockProducts: Product[];
}

export function StockClient({ products: initialProducts, lowStockProducts }: StockClientProps) {
    const [products, setProducts] = useState(initialProducts);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingStock, setEditingStock] = useState<{ [key: string]: number }>({});
    const [selectedCategory, setSelectedCategory] = useState("All");

    const categories = ["All", "Fabric", "Tracks", "Blinds", "Accessories", "Rods"];

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleStockChange = (productId: string, value: string) => {
        const quantity = parseInt(value) || 0;
        setEditingStock({ ...editingStock, [productId]: quantity });
    };

    const handleUpdateStock = async (productId: string) => {
        const newQuantity = editingStock[productId];
        if (newQuantity === undefined) return;

        const result = await updateProductStock(productId, newQuantity);
        if (result.success) {
            setProducts(products.map(p =>
                p.id === productId ? { ...p, stockQuantity: newQuantity } : p
            ));
            const newEditing = { ...editingStock };
            delete newEditing[productId];
            setEditingStock(newEditing);
        }
    };

    const handleAdjustStock = async (productId: string, adjustment: number) => {
        const result = await adjustProductStock(productId, adjustment);
        if (result.success && result.product) {
            setProducts(products.map(p =>
                p.id === productId ? { ...p, stockQuantity: result.product!.stockQuantity } : p
            ));
        }
    };

    const getStockStatus = (quantity: number) => {
        if (quantity < 0) return { label: "Backorder", color: "text-purple-600 bg-purple-50 border-purple-200" };
        if (quantity === 0) return { label: "Out of Stock", color: "text-red-600 bg-red-50 border-red-200" };
        if (quantity <= 5) return { label: "Critical", color: "text-red-600 bg-red-50 border-red-200" };
        if (quantity <= 10) return { label: "Low Stock", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
        return { label: "In Stock", color: "text-green-600 bg-green-50 border-green-200" };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Stock Management</h1>
                    <p className="text-slate-500 mt-1">Manage inventory of raw materials</p>
                </div>
            </div>

            {/* Low Stock Alert */}
            {lowStockProducts.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-bold text-yellow-900">Low Stock Alert</h3>
                            <p className="text-sm text-yellow-700 mt-1">
                                {lowStockProducts.length} product(s) are running low on stock
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {lowStockProducts.map(product => (
                                    <span key={product.id} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                                        {product.name} ({product.stockQuantity} {product.unit})
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    type="search"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${selectedCategory === cat
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Product
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Rate
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Current Stock
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredProducts.map((product) => {
                                const status = getStockStatus(product.stockQuantity);
                                const isEditing = editingStock[product.id] !== undefined;

                                return (
                                    <tr key={product.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                    <Package className="h-5 w-5 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{product.name}</div>
                                                    <div className="text-sm text-slate-500">{product.unit}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-600">{product.category}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-slate-900">₹{product.rate.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={editingStock[product.id]}
                                                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                                                        className="w-24"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUpdateStock(product.id)}
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            const newEditing = { ...editingStock };
                                                            delete newEditing[product.id];
                                                            setEditingStock(newEditing);
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setEditingStock({ ...editingStock, [product.id]: product.stockQuantity })}
                                                    className="text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                                                >
                                                    {product.stockQuantity}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setEditingStock({ ...editingStock, [product.id]: product.stockQuantity })}
                                                    title="Edit Stock"
                                                >
                                                    <Pencil className="h-4 w-4 mr-1" />
                                                    Edit
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredProducts.length === 0 && (
                    <div className="p-12 text-center">
                        <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No products found</h3>
                        <p className="text-slate-500">
                            {searchQuery ? "Try a different search term" : "Add products to start tracking stock"}
                        </p>
                    </div>
                )}
            </div>

            {/* Stock Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Package className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Total Products</p>
                            <p className="text-2xl font-bold text-slate-900">{products.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                            <Package className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">In Stock</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {products.filter(p => p.stockQuantity > 10).length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                            <TrendingDown className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Low Stock</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= 10).length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Out of Stock</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {products.filter(p => p.stockQuantity === 0).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
