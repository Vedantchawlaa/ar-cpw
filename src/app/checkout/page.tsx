"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSession } from "next-auth/react";
// @ts-ignore
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CartItem {
    productId: string;
    quantity: number;
}

interface ProductDetails {
    id: string;
    name: string;
    rate: number;
    images: string[];
    category: string;
}

export default function CheckoutPage() {
    const { data: session } = useSession();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [products, setProducts] = useState<ProductDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("cod");
    const [formData, setFormData] = useState({
        name: session?.user?.name || "",
        email: session?.user?.email || "",
        phone: "",
        address: "",
        notes: ""
    });

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, []);

    useEffect(() => {
        // Load cart from localStorage
        const savedCart = localStorage.getItem("cart");
        if (savedCart) {
            const cartItems: CartItem[] = JSON.parse(savedCart);
            setCart(cartItems);

            // Fetch product details for cart items
            fetchProductDetails(cartItems);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchProductDetails = async (cartItems: CartItem[]) => {
        try {
            const productIds = cartItems.map(item => item.productId);
            const response = await fetch("/api/shop-products?" + new URLSearchParams({
                ids: productIds.join(",")
            }));
            const data = await response.json();
            setProducts(data);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity < 1) return;

        const updatedCart = cart.map(item =>
            item.productId === productId ? { ...item, quantity: newQuantity } : item
        );
        setCart(updatedCart);
        localStorage.setItem("cart", JSON.stringify(updatedCart));
        window.dispatchEvent(new Event("cartUpdated"));
    };

    const removeItem = (productId: string) => {
        const updatedCart = cart.filter(item => item.productId !== productId);
        setCart(updatedCart);
        localStorage.setItem("cart", JSON.stringify(updatedCart));
        window.dispatchEvent(new Event("cartUpdated"));
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => {
            const product = products.find(p => p.id === item.productId);
            return total + (product?.rate || 0) * item.quantity;
        }, 0);
    };

    const handleRazorpayPayment = async () => {
        const total = calculateTotal();
        const subtotal = total / 1.18;
        const tax = total - subtotal;

        const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_dummy", // Replace with your Razorpay key
            amount: Math.round(total * 100), // Amount in paise
            currency: "INR",
            name: "Chawla Parde Wala",
            description: "Window Treatment Purchase",
            image: "/logo.png",
            handler: function (response: any) {
                console.log("Payment successful:", response);
                // In production, verify payment on backend
                completeOrder(response.razorpay_payment_id);
            },
            prefill: {
                name: formData.name,
                email: formData.email,
                contact: formData.phone
            },
            notes: {
                address: formData.address,
                special_notes: formData.notes
            },
            theme: {
                color: "#4F46E5"
            }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.on("payment.failed", function (response: any) {
            alert("Payment failed. Please try again.");
            console.error("Payment failed:", response.error);
        });
        razorpay.open();
    };

    const completeOrder = async (paymentId?: string) => {
        const subtotal = calculateTotal();
        const tax = subtotal * 0.18;
        const total = subtotal + tax;

        // Save order to database
        const orderData = {
            customerName: formData.name,
            customerEmail: formData.email,
            customerPhone: formData.phone,
            address: formData.address,
            notes: formData.notes,
            subtotal,
            tax,
            total,
            paymentMethod,
            paymentId,
            items: cart.map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                    productId: item.productId,
                    productName: product?.name || "Unknown Product",
                    productRate: product?.rate || 0,
                    quantity: item.quantity,
                    subtotal: (product?.rate || 0) * item.quantity
                };
            })
        };

        // Import and call createOrder
        const { createOrder } = await import("@/lib/actions/order-actions");
        const result = await createOrder(orderData);

        if (result.success) {
            console.log("Order saved:", result.order);
            // Clear cart and show success
            localStorage.removeItem("cart");
            setOrderPlaced(true);
            window.dispatchEvent(new Event("cartUpdated"));
        } else {
            alert("Order failed: " + result.error);
            console.error("Failed to save order:", result.error);
        }
    };

    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (paymentMethod === "razorpay") {
            handleRazorpayPayment();
        } else {
            // Cash on Delivery
            completeOrder();
        }
    };

    if (orderPlaced) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Order Placed Successfully!</h1>
                        <p className="text-slate-600">We'll contact you shortly to confirm your order and arrange delivery.</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/shop" className="flex-1">
                            <Button variant="outline" className="w-full">Continue Shopping</Button>
                        </Link>
                        <Link href="/" className="flex-1">
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Go Home</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading your cart...</p>
                </div>
            </div>
        );
    }

    if (cart.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50">
                <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
                    <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
                        <Link className="flex items-center gap-3 group" href="/">
                            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                            <div className="flex flex-col text-left">
                                <span className="font-bold text-sm tracking-tight leading-none">CHAWLA</span>
                                <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                            </div>
                        </Link>
                    </div>
                </header>
                <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto">
                            <ShoppingBag className="h-10 w-10 text-slate-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">Your cart is empty</h1>
                            <p className="text-slate-600">Add some products to get started!</p>
                        </div>
                        <Link href="/shop">
                            <Button className="bg-indigo-600 hover:bg-indigo-700">Browse Products</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const subtotal = calculateTotal();
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
                <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
                    <Link className="flex items-center gap-3 group" href="/">
                        <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-sm tracking-tight leading-none">CHAWLA</span>
                            <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                        </div>
                    </Link>
                    <Link href="/shop" className="ml-auto">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Shop
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="container px-4 md:px-6 py-12 max-w-6xl mx-auto">
                <h1 className="text-4xl font-black text-slate-900 mb-8">Checkout</h1>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Cart Items */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Your Cart ({cart.length} items)</h2>

                        {cart.map((item) => {
                            const product = products.find(p => p.id === item.productId);
                            if (!product) return null;

                            const mainImage = product.images && product.images.length > 0
                                ? product.images[0]
                                : "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop";

                            return (
                                <div key={item.productId} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4">
                                    <img
                                        src={mainImage}
                                        alt={product.name}
                                        className="w-24 h-24 object-cover rounded-lg"
                                    />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-900">{product.name}</h3>
                                        <p className="text-sm text-slate-500">{product.category}</p>
                                        <p className="text-lg font-bold text-slate-900 mt-2">₹{formatCurrency(product.rate)}</p>
                                    </div>
                                    <div className="flex flex-col items-end justify-between">
                                        <button
                                            onClick={() => removeItem(item.productId)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                        <div className="flex items-center border border-slate-300 rounded-lg">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                className="h-8 w-8 flex items-center justify-center hover:bg-slate-50"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <span className="h-8 w-10 flex items-center justify-center font-bold text-slate-900 border-x border-slate-300">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                className="h-8 w-8 flex items-center justify-center hover:bg-slate-50"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Order Summary & Contact Form */}
                    <div className="space-y-6">
                        {/* Order Summary */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                            <h2 className="text-xl font-bold text-slate-900">Order Summary</h2>
                            <div className="space-y-2">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal</span>
                                    <span>₹{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>GST (18%)</span>
                                    <span>₹{formatCurrency(tax)}</span>
                                </div>
                                <div className="border-t border-slate-200 pt-2 flex justify-between text-lg font-bold text-slate-900">
                                    <span>Total</span>
                                    <span>₹{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <form onSubmit={handlePlaceOrder} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                            <h2 className="text-xl font-bold text-slate-900">Contact Details</h2>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Name *</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                                <Input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="your@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Phone *</label>
                                <Input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+91 XXXXX-XXXXX"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Delivery Address *</label>
                                <textarea
                                    required
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows={3}
                                    placeholder="Complete delivery address"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Special Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows={2}
                                    placeholder="Any special requirements..."
                                />
                            </div>

                            {/* Payment Method Selection */}
                            <div className="border-t border-slate-200 pt-4">
                                <label className="block text-sm font-bold text-slate-700 mb-3">Payment Method *</label>
                                <div className="space-y-3">
                                    <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === "razorpay"
                                        ? "border-indigo-600 bg-indigo-50"
                                        : "border-slate-200 hover:border-slate-300"
                                        }`}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="razorpay"
                                            checked={paymentMethod === "razorpay"}
                                            onChange={(e) => setPaymentMethod(e.target.value as "razorpay" | "cod")}
                                            className="h-4 w-4 text-indigo-600"
                                        />
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-900">Pay Online</div>
                                            <div className="text-xs text-slate-500">Credit/Debit Card, UPI, Net Banking</div>
                                        </div>
                                        <div className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">Secure</div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === "cod"
                                        ? "border-indigo-600 bg-indigo-50"
                                        : "border-slate-200 hover:border-slate-300"
                                        }`}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="cod"
                                            checked={paymentMethod === "cod"}
                                            onChange={(e) => setPaymentMethod(e.target.value as "razorpay" | "cod")}
                                            className="h-4 w-4 text-indigo-600"
                                        />
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-900">Cash on Delivery</div>
                                            <div className="text-xs text-slate-500">Pay when you receive your order</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-12">
                                {paymentMethod === "razorpay" ? "Proceed to Payment" : "Place Order"} - ₹{formatCurrency(total)}
                            </Button>

                            <p className="text-xs text-slate-500 text-center">
                                {paymentMethod === "razorpay"
                                    ? "You'll be redirected to secure payment gateway"
                                    : "We'll contact you to confirm your order and arrange delivery."}
                            </p>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
