"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useSession, signOut } from "next-auth/react";
// @ts-ignore
import { Search, ShoppingBag, Filter, Sparkles, ArrowRight, Star, Instagram, MapPin, Smartphone, LogOut, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { AddProductModal } from "@/components/shop/AddProductModal";
import { PublicHeader } from "@/components/layout/PublicHeader";

const CATEGORIES = ["All", "Curtains", "Blinds", "Accessories"];

interface Product {
    id: string;
    name: string;
    rate: number;
    category: string;
    tag: string | null;
    images: string[];
    rating: number;
    reviewCount: number;
}

interface ShopClientProps {
    products: Product[];
}

export function ShopClient({ products }: ShopClientProps) {
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const { data: session } = useSession();

    const isAdmin = (session?.user as any)?.role === "admin";

    // Load cart count on mount and listen for updates
    useEffect(() => {
        const updateCartCount = () => {
            const cart = JSON.parse(localStorage.getItem("cart") || "[]");
            const count = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
            setCartCount(count);
        };

        updateCartCount();
        window.addEventListener("cartUpdated", updateCartCount);
        return () => window.removeEventListener("cartUpdated", updateCartCount);
    }, []);

    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <PublicHeader />

            <main className="flex-1">
                {/* Shop Hero */}
                <section className="bg-slate-900 py-16 md:py-24 relative overflow-hidden">
                    <div className="container px-4 md:px-6 relative z-10">
                        <div className="max-w-2xl space-y-4">
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">The Boutique.</h1>
                            <p className="text-slate-400 text-lg md:text-xl font-medium">Browse our most popular fabrics and window treatments, stitched to perfection for your home.</p>
                        </div>
                    </div>
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-500/20 to-transparent skew-x-12" />
                </section>

                {/* Filter & Search Bar */}
                <section className="sticky top-16 z-40 bg-white border-b border-slate-100 py-4 shadow-sm">
                    <div className="container px-4 md:px-6">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${selectedCategory === cat
                                            ? "bg-slate-900 text-white shadow-lg"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search styles..."
                                        className="pl-10 rounded-full bg-slate-50 border-slate-100 focus-visible:ring-indigo-500"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {isAdmin && (
                                    <Button
                                        onClick={() => setShowAddProduct(true)}
                                        className="bg-indigo-600 hover:bg-indigo-700 gap-2 shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden md:inline">Add Product</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Product Grid */}
                <section className="py-12 md:py-20">
                    <div className="container px-4 md:px-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {filteredProducts.map((product) => {
                                const mainImage = product.images && product.images.length > 0
                                    ? product.images[0]
                                    : "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop";

                                return (
                                    <Link key={product.id} href={`/shop/${product.id}`}>
                                        <div className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100">
                                            <div className="relative aspect-square overflow-hidden bg-slate-200">
                                                <img
                                                    src={mainImage}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                {product.tag && (
                                                    <div className="absolute top-4 left-4">
                                                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
                                                            {product.tag}
                                                        </span>
                                                    </div>
                                                )}
                                                <button className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl transform translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                                    <ShoppingBag className="h-6 w-6" />
                                                </button>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">{product.category}</p>
                                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{product.name}</h3>
                                                    </div>
                                                    <div className="flex items-center text-amber-500">
                                                        <Star className="h-3 w-3 fill-amber-500" />
                                                        <span className="text-[10px] font-bold ml-1 text-slate-500">{(product.rating || 0).toFixed(1)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mt-4">
                                                    <span className="text-xl font-black text-slate-900">₹{product.rate.toLocaleString()}</span>
                                                    <span className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group/link">
                                                        Detail <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        {filteredProducts.length === 0 && (
                            <div className="py-20 text-center space-y-4">
                                <div className="h-20 w-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto">
                                    <Search className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">No styles found</h3>
                                <p className="text-slate-500">Try adjusting your filters or search keywords.</p>
                                <Button variant="outline" onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}>Clear all filters</Button>
                            </div>
                        )}
                    </div>
                </section>

            </main>

            <footer id="contact" className="w-full py-12 md:py-20 bg-white border-t border-slate-100">
                <div className="container px-4 md:px-6">
                    <div className="grid gap-12 md:grid-cols-4 text-left">
                        <div className="col-span-1 md:col-span-2 space-y-6">
                            <Link className="flex items-center gap-3" href="/">
                                <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-lg leading-none tracking-tight">CHAWLA</span>
                                    <span className="text-xs font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                                </div>
                            </Link>
                            <p className="max-w-md text-slate-500 font-medium leading-relaxed">
                                Transforming residential and commercial spaces with premium window treatments and custom interior solutions.
                            </p>
                            <div className="flex items-center gap-4">
                                <Link href="https://www.instagram.com/chawlapardewala/" target="_blank" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors">
                                    <Instagram className="h-5 w-5" />
                                </Link>
                                <Link href="https://www.facebook.com/chawlapardewala" target="_blank" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer">
                                    <span className="font-bold text-lg">f</span>
                                </Link>
                                <Link href="https://wa.me/917404618501" target="_blank" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-green-500 hover:text-white transition-colors cursor-pointer">
                                    <Smartphone className="h-5 w-5" />
                                </Link>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Contact Us</h4>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-indigo-500 shrink-0" />
                                    <a href="https://maps.app.goo.gl/iscHP49G5fAZ6n7UA" target="_blank" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Shop 103,110 SD College Road, Panipat, Haryana 132103</a>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Smartphone className="h-5 w-5 text-indigo-500 shrink-0" />
                                    <div className="flex flex-col">
                                        <a href="tel:+917404618501" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">+91 74046-18501</a>
                                        <a href="tel:+919812018501" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">+91 98120-18501</a>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Internal Access</h4>
                            <ul className="space-y-4">
                                <li>
                                    <Link href="/login" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4">
                                        Staff Portal Login
                                    </Link>
                                </li>
                                <li className="text-[10px] uppercase font-bold text-slate-300 leading-tight">
                                    CRM & Inventory <br /> Management System
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                            © 2026 Chawla Parde Wala. All Rights Reserved.
                        </p>
                        <div className="flex gap-8">
                            <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="/terms">Terms</Link>
                            <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="/privacy">Privacy</Link>
                            <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="/contact">Contact Us</Link>
                        </div>
                    </div>
                </div>
            </footer>

            {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} />}
        </div>
    );
}
