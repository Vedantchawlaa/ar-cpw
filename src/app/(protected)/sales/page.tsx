'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
// @ts-ignore
import { CreditCard, DollarSign, TrendingUp, Filter, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getQuotations, markAsSale } from "@/lib/actions/quotation-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { DatePicker } from "@/components/ui/DatePicker";

export default function SalesPage() {
    const router = useRouter();
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    const fetchData = async () => {
        setLoading(true);
        const result = await getQuotations();
        if (result.success) {
            setSales(result.data);
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

    // Filter sales based on date range
    const filteredSales = sales.filter((item) => {
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

        return true;
    });

    // Only count quotations with the status 'SALE' for metrics
    const finalSales = filteredSales.filter(q => q.status === 'SALE');

    const totalRevenue = finalSales.reduce((acc, curr) => acc + (curr.receivedAmount || 0), 0);
    const avgOrderValue = finalSales.length > 0 ? totalRevenue / finalSales.length : 0;
    const completedSalesCount = finalSales.length;

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sales Overview</h1>
                    <p className="text-muted-foreground">Track your revenue and transaction performance.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-slate-200">
                        <DatePicker
                            date={startDate}
                            setDate={setStartDate}
                            placeholder="From date"
                            className="w-40"
                        />
                        <span className="text-slate-400">to</span>
                        <DatePicker
                            date={endDate}
                            setDate={setEndDate}
                            placeholder="To date"
                            className="w-40"
                        />
                        {(startDate || endDate) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={clearFilters}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <Button variant={"outline" as any} size={"sm" as any}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Earned Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-700">₹{totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-emerald-600 font-medium mt-1">
                            Only marked as SALE
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Sale Value</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-700">₹{avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-blue-600 font-medium mt-1">Based on {completedSalesCount} sales</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                        <CreditCard className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-700">{completedSalesCount}</div>
                        <p className="text-xs text-amber-600 font-medium mt-1">
                            {filteredSales.length} total quotations
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Quote #</th>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Total Amount</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Received</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center">Loading sales data...</td></tr>
                                ) : filteredSales.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No sales found for the selected period.</td></tr>
                                ) : (
                                    filteredSales.map((item) => (
                                        <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">{item.number}</td>
                                            <td className="px-4 py-3">{item.lead.name}</td>
                                            <td className="px-4 py-3 text-zinc-500">{formatDate(item.date)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'SALE' ? 'bg-emerald-100 text-emerald-800' :
                                                    item.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-zinc-100 text-zinc-800'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-zinc-500">₹{item.total.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{(item.receivedAmount || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                {item.status !== 'SALE' && (
                                                    <Button variant={"outline" as any} size={"sm" as any} onClick={() => handleMarkAsSale(item.id)}>
                                                        Mark as Sale
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
