'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { CreditCard, DollarSign, TrendingUp, Filter, Download, X, FileText, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getQuotations, getActiveOrders, markAsSale, updateQuotation, updateOrderStatus } from "@/lib/actions/quotation-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";

export default function ProcessingOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [orderToComplete, setOrderToComplete] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        const result = await getActiveOrders();
        if (result.success) {
            setOrders(result.data);
        } else {
            console.error("Fetch failed:", result.error);
            // Optional: set an error state to show in UI
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleMarkAsSale = async (id: string) => {
        const result = await markAsSale(id);
        if (result.success) {
            fetchData();
            router.refresh();
        } else {
            alert("Failed to mark as sale");
        }
    };

    // Filter orders based on date range
    const filteredOrders = orders.filter((item) => {
        if (!startDate && !endDate) return true;
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (itemDate < start) return false;
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
        }

        const status = String(item.status || '').toUpperCase().trim();
        if (status === 'DRAFT' || status.includes('DRAFT')) return false;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesNumber = item.number.toLowerCase().includes(term);
            const matchesName = item.lead?.name?.toLowerCase().includes(term);
            const matchesCity = item.lead?.city?.toLowerCase().includes(term);
            const matchesStatus = item.status?.toLowerCase().includes(term);

            if (!matchesNumber && !matchesName && !matchesCity && !matchesStatus) return false;
        }

        return true;
    });

    const clearFilters = () => {
        setStartDate("");
        setEndDate("");
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Active Orders</h1>
                    <p className="text-muted-foreground">Manage active orders and quotations.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-slate-200">
                        <Input
                            placeholder="Search orders..."
                            className="w-48 border-0 focus-visible:ring-0 h-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-slate-200">
                        <Input
                            type="date"
                            className="w-40 border-0 focus-visible:ring-0 h-8"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-slate-400">to</span>
                        <Input
                            type="date"
                            className="w-40 border-0 focus-visible:ring-0 h-8"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        {(startDate || endDate) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={clearFilters}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Order List</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Order #</th>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Deadline</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center">Loading orders...</td></tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No orders found.</td></tr>
                                ) : (
                                    filteredOrders.map((item) => (
                                        <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">{item.number}</td>
                                            <td className="px-4 py-3">{item.lead.name}</td>
                                            <td className="px-4 py-3 text-zinc-500">{new Date(item.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    type="date"
                                                    className="w-32 h-8 text-xs"
                                                    value={item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : ''}
                                                    onChange={async (e) => {
                                                        const newDeadline = e.target.value;
                                                        await updateOrderStatus(item.id, item.status, newDeadline);
                                                        fetchData();
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    className="h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={item.status}
                                                    onChange={async (e) => {
                                                        const newStatus = e.target.value;
                                                        await updateOrderStatus(item.id, newStatus, item.deadline);
                                                        fetchData();
                                                    }}
                                                >
                                                    <option value="SALE">SALE</option>
                                                    <option value="ACCEPTED">ACCEPTED</option>
                                                    <option value="IN_PROGRESS">IN PROGRESS</option>
                                                    <option value="COMPLETED">COMPLETED</option>
                                                    <option value="DELIVERED">DELIVERED</option>
                                                    <option value="CANCELLED">CANCELLED</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">₹{item.total.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => router.push(`/quotations/${item.id}`)}>
                                                        View
                                                    </Button>
                                                    {item.status !== 'COMPLETED' && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                                                            onClick={() => setOrderToComplete(item)}
                                                        >
                                                            <CheckCircle className="h-3 w-3" />
                                                            Complete
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!orderToComplete} onOpenChange={(open) => !open && setOrderToComplete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Complete Order?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to mark order <strong>{orderToComplete?.number}</strong> as COMPLETED?
                            This indicates the order has been fulfilled.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOrderToComplete(null)}>Cancel</Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                                if (orderToComplete) {
                                    await updateOrderStatus(orderToComplete.id, 'COMPLETED', orderToComplete.deadline);
                                    setOrderToComplete(null);
                                    fetchData();
                                }
                            }}
                        >
                            Confirm Complete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
