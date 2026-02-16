"use client";

import { useState } from "react";
import Link from "next/link";
// @ts-ignore
import { Package, Calendar, CreditCard, MapPin, ChevronDown, ChevronUp, ArrowLeft, Check, Clock, Truck, Home } from "lucide-react";

interface OrderItem {
    id: string;
    productName: string;
    productRate: number;
    quantity: number;
    subtotal: number;
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    address: string;
    notes: string | null;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    paymentId: string | null;
    status: string;
    createdAt: string;
    items: OrderItem[];
}

interface MyOrdersClientProps {
    orders: Order[];
}

const STATUS_COLORS = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    processing: "bg-indigo-50 text-indigo-700 border-indigo-200",
    shipped: "bg-purple-50 text-purple-700 border-purple-200",
    delivered: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
};

const TRACKING_STEPS = [
    { key: 'confirmed', label: 'Order Confirmed', icon: Check },
    { key: 'processing', label: 'Processing', icon: Package },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: Home },
];

function OrderTrackingTimeline({ status, createdAt }: { status: string; createdAt: string }) {
    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(status);
    const isCancelled = status === 'cancelled';

    if (isCancelled) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700 font-bold">Order Cancelled</p>
                <p className="text-red-600 text-sm mt-1">This order has been cancelled</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg p-6">
            <h4 className="font-bold text-slate-900 mb-6">Order Tracking</h4>
            <div className="relative">
                {TRACKING_STEPS.map((step, index) => {
                    const stepIndex = statusOrder.indexOf(step.key);
                    const isCompleted = currentIndex >= stepIndex;
                    const isCurrent = currentIndex === stepIndex;
                    const Icon = step.icon;

                    return (
                        <div key={step.key} className="relative pb-8 last:pb-0">
                            {index < TRACKING_STEPS.length - 1 && (
                                <div className={`absolute left-5 top-10 w-0.5 h-full ${isCompleted ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                            )}
                            <div className="flex items-start gap-4">
                                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 ${isCompleted
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-300 text-slate-400'
                                    }`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 pt-1">
                                    <p className={`font-bold ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {step.label}
                                    </p>
                                    {isCurrent && (
                                        <p className="text-sm text-indigo-600 font-medium mt-1">Current Status</p>
                                    )}
                                    {isCompleted && !isCurrent && (
                                        <p className="text-sm text-slate-500 mt-1">Completed</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {status === 'shipped' && (
                <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-700">
                        <Clock className="h-4 w-4" />
                        <p className="text-sm font-bold">Estimated Delivery: 3-5 business days</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export function MyOrdersClient({ orders }: MyOrdersClientProps) {
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    const toggleExpand = (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
                <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
                    <Link className="flex items-center gap-3 group" href="/">
                        <img src="/logo.png" alt="Chawla Parde Wala Logo" className="h-10 w-auto transition-transform group-hover:scale-105" />
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-sm tracking-tight leading-none text-slate-900 uppercase">CHAWLA</span>
                            <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em] uppercase">PARDE WALA</span>
                        </div>
                    </Link>
                    <Link href="/shop" className="ml-auto">
                        <button className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Shop
                        </button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="container max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">My Orders</h1>
                    <p className="text-slate-500 mt-1">Track and view your order history</p>
                </div>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                        <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No orders yet</h3>
                        <p className="text-slate-500 mb-6">You haven't placed any orders yet.</p>
                        <Link href="/shop">
                            <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                                Start Shopping
                            </button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => {
                            const isExpanded = expandedOrders.has(order.id);
                            const statusColor = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;

                            return (
                                <div key={order.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    {/* Order Header */}
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-bold text-slate-900">{order.orderNumber}</h3>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                                                        {order.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4" />
                                                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <CreditCard className="h-4 w-4" />
                                                        {order.paymentMethod === 'razorpay' ? 'Online Payment' : 'Cash on Delivery'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-slate-900">₹{order.total.toFixed(2)}</div>
                                                <div className="text-xs text-slate-500">{order.items.length} item(s)</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleExpand(order.id)}
                                            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                        >
                                            {isExpanded ? (
                                                <>
                                                    <ChevronUp className="h-4 w-4" />
                                                    Hide Details
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="h-4 w-4" />
                                                    View Details
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 bg-slate-50 p-6 space-y-6">
                                            {/* Order Tracking Timeline */}
                                            <OrderTrackingTimeline status={order.status} createdAt={order.createdAt} />

                                            {/* Delivery Address */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MapPin className="h-4 w-4 text-slate-400" />
                                                    <h4 className="font-bold text-slate-900">Delivery Address</h4>
                                                </div>
                                                <p className="text-sm text-slate-600 ml-6">{order.address}</p>
                                                {order.notes && (
                                                    <p className="text-sm text-slate-500 ml-6 mt-1 italic">Note: {order.notes}</p>
                                                )}
                                            </div>

                                            {/* Order Items */}
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-3">Items Ordered</h4>
                                                <div className="space-y-2">
                                                    {order.items.map((item) => (
                                                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg">
                                                            <div className="flex-1">
                                                                <div className="font-medium text-slate-900">{item.productName}</div>
                                                                <div className="text-sm text-slate-500">
                                                                    ₹{item.productRate.toFixed(2)} × {item.quantity}
                                                                </div>
                                                            </div>
                                                            <div className="font-bold text-slate-900">₹{item.subtotal.toFixed(2)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Order Summary */}
                                            <div className="border-t border-slate-200 pt-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Subtotal</span>
                                                        <span className="font-medium">₹{order.subtotal.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">GST (18%)</span>
                                                        <span className="font-medium">₹{order.tax.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                                                        <span>Total</span>
                                                        <span>₹{order.total.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment Info */}
                                            {order.paymentId && (
                                                <div className="text-xs text-slate-500">
                                                    Payment ID: {order.paymentId}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
