'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { toggleVendorOrder } from "@/lib/actions/measurement-actions";
import { Check, Clock, User, Package, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface VendorOrder {
    measurementId: string;
    leadName: string;
    type: 'tracks' | 'blinds' | 'curtains';
    vendorName: string;
    completed: boolean;
}

export function VendorList({ vendorOrders }: { vendorOrders: VendorOrder[] }) {
    const router = useRouter();
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

    const handleToggle = async (measurementId: string, type: 'tracks' | 'blinds' | 'curtains', currentStatus: boolean) => {
        const key = `${measurementId}-${type}`;
        setLoadingIds(prev => ({ ...prev, [key]: true }));

        const result = await toggleVendorOrder(measurementId, type, !currentStatus);
        
        setLoadingIds(prev => ({ ...prev, [key]: false }));
        if (result.success) {
            router.refresh(); // Refresh server state
        } else {
            alert(result.error || "Failed to update order status");
        }
    };

    // Group orders by vendor name
    const groupedOrders: Record<string, VendorOrder[]> = {};
    vendorOrders.forEach(order => {
        if (!groupedOrders[order.vendorName]) {
            groupedOrders[order.vendorName] = [];
        }
        groupedOrders[order.vendorName].push(order);
    });

    if (Object.keys(groupedOrders).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                <Store className="h-12 w-12 mb-4 text-slate-300" />
                <p>No vendor orders found. Start by assigning vendors in the Measurements tab.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {Object.entries(groupedOrders).map(([vendorName, orders]) => {
                const total = orders.length;
                const completedCount = orders.filter(o => o.completed).length;
                
                return (
                    <Card key={vendorName} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <CardTitle className="flex justify-between items-center text-lg font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-700">{vendorName}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full font-medium">
                                        Total: {total}
                                    </span>
                                    <span className={cn(
                                        "text-xs px-2 py-1 rounded-full font-medium",
                                        completedCount === total ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                        Completed: {completedCount}
                                    </span>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {orders.map((order, idx) => {
                                    const isLoading = loadingIds[`${order.measurementId}-${order.type}`];
                                    return (
                                        <div key={idx} className={cn(
                                            "flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors",
                                            order.completed && "bg-green-50/30"
                                        )}>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 font-medium text-slate-800">
                                                    <User className="h-4 w-4 text-slate-400" />
                                                    {order.leadName}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <Package className="h-3.5 w-3.5" />
                                                    <span className="capitalize">{order.type} Order</span>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                disabled={isLoading}
                                                onClick={() => handleToggle(order.measurementId, order.type, order.completed)}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all border",
                                                    order.completed 
                                                        ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" 
                                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                                                )}
                                            >
                                                {isLoading ? (
                                                    <span className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                                                ) : order.completed ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <Clock className="h-4 w-4 text-amber-500" />
                                                )}
                                                {order.completed ? "Completed" : "Mark Done"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
