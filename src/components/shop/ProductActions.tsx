"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { ShoppingCart, Zap, Plus, Minus } from "lucide-react";

interface ProductActionsProps {
    productId: string;
    stock: number;
}

export function ProductActions({ productId, stock }: ProductActionsProps) {
    const [quantity, setQuantity] = useState(1);
    const [isAdding, setIsAdding] = useState(false);

    const handleAddToCart = () => {
        setIsAdding(true);
        // Get existing cart from localStorage
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");

        // Check if product already in cart
        const existingIndex = cart.findIndex((item: any) => item.productId === productId);

        if (existingIndex >= 0) {
            cart[existingIndex].quantity += quantity;
        } else {
            cart.push({ productId, quantity });
        }

        localStorage.setItem("cart", JSON.stringify(cart));

        // Update cart count in header (you'll need to implement this with context/state)
        window.dispatchEvent(new Event("cartUpdated"));

        setTimeout(() => {
            setIsAdding(false);
            alert(`Added ${quantity} item(s) to cart!`);
        }, 500);
    };

    const handleBuyNow = () => {
        handleAddToCart();
        // Redirect to checkout (implement this route later)
        window.location.href = "/checkout";
    };

    return (
        <div className="space-y-4">
            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-700">Quantity:</span>
                <div className="flex items-center border border-slate-300 rounded-lg">
                    <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 transition-colors"
                        disabled={quantity <= 1}
                    >
                        <Minus className="h-4 w-4" />
                    </button>
                    <span className="h-10 w-12 flex items-center justify-center font-bold text-slate-900 border-x border-slate-300">
                        {quantity}
                    </span>
                    <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleAddToCart}
                    disabled={isAdding || stock === 0}
                    className="flex-1 h-12 bg-white text-slate-900 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-colors gap-2"
                >
                    <ShoppingCart className="h-5 w-5" />
                    {isAdding ? "Adding..." : "Add to Cart"}
                </Button>
                <Button
                    onClick={handleBuyNow}
                    disabled={stock === 0}
                    className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                    <Zap className="h-5 w-5" />
                    Buy Now
                </Button>
            </div>

            {stock === 0 && (
                <p className="text-sm text-red-600 font-medium">Out of stock - Contact us for custom orders</p>
            )}
        </div>
    );
}
