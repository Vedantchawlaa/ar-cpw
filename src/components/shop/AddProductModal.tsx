"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
// @ts-ignore
import { X } from "lucide-react";

interface AddProductModalProps {
    onClose: () => void;
}

export function AddProductModal({ onClose }: AddProductModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        rate: "",
        description: "",
        category: "Curtains",
        tag: "",
        images: "",
        stock: "0",
        specifications: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Parse images (comma-separated URLs)
        const imageArray = formData.images.split(",").map(url => url.trim()).filter(url => url);

        // Parse specifications (JSON)
        let specs = null;
        if (formData.specifications) {
            try {
                specs = JSON.parse(formData.specifications);
            } catch (error) {
                alert("Invalid JSON format for specifications");
                return;
            }
        }

        const productData = {
            name: formData.name,
            rate: parseFloat(formData.rate),
            description: formData.description || null,
            category: formData.category,
            tag: formData.tag || null,
            images: imageArray,
            stock: parseInt(formData.stock),
            specifications: specs,
        };

        try {
            const response = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productData),
            });

            if (response.ok) {
                alert("Product added successfully!");
                window.location.reload();
            } else {
                alert("Failed to add product");
            }
        } catch (error) {
            console.error("Error adding product:", error);
            alert("Error adding product");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Add New Product</h2>
                    <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Product Name *</label>
                        <Input
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Imperial Velvet Drapes"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Price (₹) *</label>
                            <Input
                                type="number"
                                required
                                value={formData.rate}
                                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                placeholder="4999"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Stock</label>
                            <Input
                                type="number"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Category *</label>
                            <select
                                required
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full h-10 rounded-md border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="Curtains">Curtains</option>
                                <option value="Blinds">Blinds</option>
                                <option value="Accessories">Accessories</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Tag</label>
                            <Input
                                value={formData.tag}
                                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                                placeholder="e.g., Best Seller, Premium"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                            placeholder="Product description..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Images (comma-separated URLs)</label>
                        <textarea
                            value={formData.images}
                            onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={2}
                            placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Specifications (JSON format)</label>
                        <textarea
                            value={formData.specifications}
                            onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={4}
                            placeholder='{"Material": "100% Velvet", "Dimensions": "7ft x 4ft", "Care": "Dry clean only"}'
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                            Add Product
                        </Button>
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
