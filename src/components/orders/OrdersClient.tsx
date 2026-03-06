"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { updateOrderStatus } from "@/lib/actions/order-actions";
// @ts-ignore
import { Package, User, Phone, Mail, MapPin, CreditCard, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
    notes?: string;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    paymentId?: string;
    status: string;
    createdAt: string;
    items: OrderItem[];
}

interface OrdersClientProps {
    orders: Order[];
}

const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    processing: "bg-purple-100 text-purple-800 border-purple-200",
    shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200"
};

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export function OrdersClient({ orders: initialOrders }: OrdersClientProps) {
    const [orders, setOrders] = useState(initialOrders);
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const toggleExpand = (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        const result = await updateOrderStatus(orderId, newStatus);
        if (result.success) {
            setOrders(orders.map(order =>
                order.id === orderId ? { ...order, status: newStatus } : order
            ));
        }
    };

    const filteredOrders = filterStatus === "all"
        ? orders
        : orders.filter(order => order.status === filterStatus);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Shop Orders</h1>
                    <p className="text-slate-500 mt-1">Manage customer orders from the online shop</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">All Orders ({orders.length})</option>
                        {STATUS_OPTIONS.map(status => {
                            const count = orders.filter(o => o.status === status).length;
                            return (
                                <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                    <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No orders found</h3>
                    <p className="text-slate-500">
                        {filterStatus === "all"
                            ? "No orders have been placed yet."
                            : `No ${filterStatus} orders.`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map((order) => {
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
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <CreditCard className="h-4 w-4" />
                                                    {order.paymentMethod === "razorpay" ? "Online Payment" : "Cash on Delivery"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-slate-900">₹{formatCurrency(order.total)}</div>
                                            <div className="text-xs text-slate-500">{order.items.length} item(s)</div>
                                        </div>
                                    </div>

                                    {/* Customer Info */}
                                    <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <User className="h-4 w-4 text-slate-400 mt-0.5" />
                                            <div>
                                                <div className="text-xs text-slate-500">Customer</div>
                                                <div className="font-medium text-slate-900">{order.customerName}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                                            <div>
                                                <div className="text-xs text-slate-500">Phone</div>
                                                <div className="font-medium text-slate-900">{order.customerPhone}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                                            <div>
                                                <div className="text-xs text-slate-500">Email</div>
                                                <div className="font-medium text-slate-900 text-sm">{order.customerEmail}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                                            <div>
                                                <div className="text-xs text-slate-500">Address</div>
                                                <div className="font-medium text-slate-900 text-sm">{order.address}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Update */}
                                    <div className="flex items-center gap-3">
                                        <label className="text-sm font-bold text-slate-700">Update Status:</label>
                                        <select
                                            value={order.status}
                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {STATUS_OPTIONS.map(status => (
                                                <option key={status} value={status}>
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleExpand(order.id)}
                                            className="ml-auto gap-2"
                                        >
                                            {isExpanded ? (
                                                <>Hide Details <ChevronUp className="h-4 w-4" /></>
                                            ) : (
                                                <>Show Details <ChevronDown className="h-4 w-4" /></>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Order Details (Expandable) */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 p-6 bg-slate-50">
                                        <h4 className="font-bold text-slate-900 mb-4">Order Items</h4>
                                        <div className="space-y-3 mb-6">
                                            {order.items.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-slate-900">{item.productName}</div>
                                                        <div className="text-sm text-slate-500">
                                                            ₹{formatCurrency(item.productRate)} × {item.quantity}
                                                        </div>
                                                    </div>
                                                    <div className="text-lg font-bold text-slate-900">
                                                        ₹{formatCurrency(item.subtotal)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="border-t border-slate-200 pt-4 space-y-2">
                                            <div className="flex justify-between text-slate-600">
                                                <span>Subtotal</span>
                                                <span>₹{formatCurrency(order.subtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>GST (18%)</span>
                                                <span>₹{formatCurrency(order.tax)}</span>
                                            </div>
                                            <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                                                <span>Total</span>
                                                <span>₹{formatCurrency(order.total)}</span>
                                            </div>
                                        </div>

                                        {order.notes && (
                                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <div className="text-xs font-bold text-yellow-800 mb-1">Special Notes:</div>
                                                <div className="text-sm text-yellow-900">{order.notes}</div>
                                            </div>
                                        )}

                                        {order.paymentId && (
                                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="text-xs font-bold text-green-800 mb-1">Payment ID:</div>
                                                <div className="text-sm font-mono text-green-900">{order.paymentId}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
