"use client";

import { useState } from "react";
import Link from "next/link";
// @ts-ignore
import { ShoppingBag, Star, ArrowLeft, ShieldCheck, Truck, RotateCcw, MessageSquare, ChevronRight, Share2, Heart, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Separator } from "@/components/ui/Separator";
import { cn } from "@/lib/utils";

interface Product {
    id: string;
    name: string;
    rate: number;
    description: string | null;
    category: string;
    tag: string | null;
    images: string[];
    specifications: any;
    stock: number;
    rating: number;
    reviewCount: number;
}

interface ProductDetailClientProps {
    product: Product;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState("description");

    const images = product.images.length > 0 ? product.images : [
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop"
    ];

    const handleAddToCart = () => {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const existingItem = cart.find((item: any) => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                rate: product.rate,
                image: images[0],
                quantity: quantity
            });
        }

        localStorage.setItem("cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("cartUpdated"));
        alert("Added to cart! 🛍️");
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="container px-4 py-8 md:px-6">
                <Link href="/shop" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 mb-8 transition-colors group">
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Back to Collection
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20">
                    {/* Left: Image Gallery */}
                    <div className="space-y-6">
                        <div className="aspect-square rounded-3xl overflow-hidden bg-slate-100 border border-slate-100 shadow-sm relative group">
                            <img
                                src={images[selectedImage]}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute top-6 right-6 space-y-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="h-12 w-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors">
                                    <Heart className="h-5 w-5" />
                                </button>
                                <button className="h-12 w-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors">
                                    <Share2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {images.length > 1 && (
                            <div className="grid grid-cols-4 gap-4">
                                {images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(idx)}
                                        className={cn(
                                            "aspect-square rounded-xl overflow-hidden border-2 transition-all",
                                            selectedImage === idx ? "border-indigo-600 ring-2 ring-indigo-50" : "border-transparent hover:border-slate-200"
                                        )}
                                    >
                                        <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Product Info */}
                    <div className="flex flex-col">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-none font-bold tracking-widest uppercase text-[10px] px-3">
                                        {product.category}
                                    </Badge>
                                    {product.tag && (
                                        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none font-bold tracking-widest uppercase text-[10px] px-3">
                                            {product.tag}
                                        </Badge>
                                    )}
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                                    {product.name}
                                </h1>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center text-amber-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={cn("h-4 w-4", i < Math.floor(product.rating) ? "fill-amber-500" : "text-amber-200")}
                                            />
                                        ))}
                                        <span className="ml-2 text-sm font-bold text-amber-700">{product.rating.toFixed(1)}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-400">
                                        {product.reviewCount} Verified Reviews
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-baseline gap-4">
                                <span className="text-4xl font-black text-slate-900 leading-none">
                                    ₹{product.rate.toLocaleString()}
                                </span>
                                <span className="text-sm font-bold text-slate-400 line-through">
                                    ₹{(product.rate * 1.2).toLocaleString()}
                                </span>
                                <span className="text-sm font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                                    20% OFF
                                </span>
                            </div>

                            <p className="text-slate-600 text-lg leading-relaxed font-medium">
                                {product.description || "Elegant window solution masterfully crafted for your home. Experience premium quality with Chawla Parde Wala."}
                            </p>

                            <Separator className="bg-slate-100" />

                            <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center border border-slate-200 rounded-2xl p-1 bg-slate-50">
                                        <button
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <span className="w-12 text-center font-bold text-slate-900">{quantity}</span>
                                        <button
                                            onClick={() => setQuantity(quantity + 1)}
                                            className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="text-sm font-bold text-slate-400">
                                        {product.stock > 0 ? (
                                            <span className="text-green-600">● In Stock (Limited)</span>
                                        ) : (
                                            <span className="text-red-500">● Out of Stock</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button
                                        size="lg"
                                        onClick={handleAddToCart}
                                        className="h-14 flex-1 rounded-2xl bg-slate-900 text-white hover:bg-black font-black text-lg shadow-xl shadow-slate-200 transition-all hover:-translate-y-1 active:scale-95 gap-3"
                                    >
                                        <ShoppingBag className="h-6 w-6" />
                                        ADD TO CART
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="h-14 px-8 rounded-2xl border-2 border-slate-200 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all"
                                    >
                                        BUY NOW
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[10px] font-black uppercase text-slate-400 mb-1">Authentic</span>
                                        <span className="text-xs font-bold text-slate-900">100% Quality</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                        <Truck className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[10px] font-black uppercase text-slate-400 mb-1">Shipping</span>
                                        <span className="text-xs font-bold text-slate-900">Pan India Delivery</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                        <RotateCcw className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[10px] font-black uppercase text-slate-400 mb-1">Guarantee</span>
                                        <span className="text-xs font-bold text-slate-900">2 Year Warranty</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section */}
                <div className="mt-20">
                    <div className="flex items-center gap-8 border-b border-slate-100 mb-10 overflow-x-auto no-scrollbar">
                        {["description", "specifications", "reviews"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "pb-4 text-sm font-black uppercase tracking-widest transition-all relative",
                                    activeTab === tab ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="max-w-4xl min-h-[300px]">
                        {activeTab === "description" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h2 className="text-2xl font-black text-slate-900 uppercase">Product Narrative</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    {product.description || "This premium window treatment is designed to enhance the aesthetic of any room. We use only the finest materials and hardware to ensure durability and style."}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                                    <div className="bg-slate-50 p-8 rounded-3xl space-y-4">
                                        <h3 className="font-black text-slate-900 uppercase tracking-widest">Key Features</h3>
                                        <ul className="space-y-3 text-slate-600 font-medium">
                                            <li className="flex items-center gap-2">
                                                <ChevronRight className="h-4 w-4 text-indigo-500" />
                                                Premium High-Grade Fabric
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ChevronRight className="h-4 w-4 text-indigo-500" />
                                                Smooth Operating Mechanism
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ChevronRight className="h-4 w-4 text-indigo-500" />
                                                Dust & Water Repellent
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="bg-slate-50 p-8 rounded-3xl space-y-4">
                                        <h3 className="font-black text-slate-900 uppercase tracking-widest">Care Instructions</h3>
                                        <ul className="space-y-3 text-slate-600 font-medium">
                                            <li className="flex items-center gap-2">
                                                <ChevronRight className="h-4 w-4 text-indigo-500" />
                                                Professional Dry Clean Only
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ChevronRight className="h-4 w-4 text-indigo-500" />
                                                Avoid Direct Harsh Sunlight
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ChevronRight className="h-4 w-4 text-indigo-500" />
                                                Dust with soft brush weekly
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "specifications" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h2 className="text-2xl font-black text-slate-900 uppercase mb-8">Technical Specs</h2>
                                <div className="grid grid-cols-1 gap-1">
                                    {product.specifications ? (
                                        Object.entries(product.specifications).map(([key, value]: [string, any]) => (
                                            <div key={key} className="grid grid-cols-2 py-4 border-b border-slate-50">
                                                <span className="font-bold text-slate-400 uppercase tracking-tighter text-sm">{key}</span>
                                                <span className="font-bold text-slate-900">{String(value)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 py-4 border-b border-slate-50">
                                                <span className="font-bold text-slate-400 uppercase tracking-tighter text-sm">Material</span>
                                                <span className="font-bold text-slate-900">Premium Polyester / Cotton Blend</span>
                                            </div>
                                            <div className="grid grid-cols-2 py-4 border-b border-slate-50">
                                                <span className="font-bold text-slate-400 uppercase tracking-tighter text-sm">Mount Type</span>
                                                <span className="font-bold text-slate-900">Internal / External Wall</span>
                                            </div>
                                            <div className="grid grid-cols-2 py-4 border-b border-slate-50">
                                                <span className="font-bold text-slate-400 uppercase tracking-tighter text-sm">Control</span>
                                                <span className="font-bold text-slate-900">Manual Cord / Motorized Options</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === "reviews" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-black text-slate-900 uppercase">Customer Voices</h2>
                                    <Button className="bg-slate-900 hover:bg-black font-bold uppercase text-xs tracking-widest">Write a Review</Button>
                                </div>
                                {product.reviewCount > 0 ? (
                                    <div className="grid grid-cols-1 gap-8">
                                        {/* Review items would be mapped here */}
                                        <p className="text-slate-500 italic">No detailed reviews yet. Be the first to share your experience!</p>
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-3xl text-center space-y-4 border border-dashed border-slate-200">
                                        <MessageSquare className="h-12 w-12 text-slate-300" />
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No reviews found for this product yet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
