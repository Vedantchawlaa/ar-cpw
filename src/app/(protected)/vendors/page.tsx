import { getAllMeasurements } from "@/lib/actions/measurement-actions";
import { VendorList } from "@/components/vendors/VendorList";

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
    const measurements = await getAllMeasurements();
    
    // @ts-ignore
    const vendorOrders: Array<{ measurementId: string, leadName: string, type: 'tracks'|'blinds'|'curtains', vendorName: string, completed: boolean }> = [];

    if (measurements.success && measurements.data) {
        measurements.data.forEach((m: any) => {
            let data;
            try {
                data = typeof m.data === 'string' ? JSON.parse(m.data) : m.data;
            } catch(e) {
                data = {};
            }
            if (data?.sharedSizes?.vendors) {
                const vend = data.sharedSizes.vendors;
                const completed = data.sharedSizes.completed || {};
                const customerName = m.customerName || m.lead?.name || `Measurement #${m.id.substring(0,6)}`;

                if (vend.tracks && vend.tracks.trim() !== '') {
                    vendorOrders.push({
                        measurementId: m.id,
                        leadName: customerName,
                        type: 'tracks',
                        vendorName: vend.tracks.trim(),
                        completed: !!completed.tracks
                    });
                }
                if (vend.blinds && vend.blinds.trim() !== '') {
                    vendorOrders.push({
                        measurementId: m.id,
                        leadName: customerName,
                        type: 'blinds',
                        vendorName: vend.blinds.trim(),
                        completed: !!completed.blinds
                    });
                }
                if (vend.curtains && vend.curtains.trim() !== '') {
                    vendorOrders.push({
                        measurementId: m.id,
                        leadName: customerName,
                        type: 'curtains',
                        vendorName: vend.curtains.trim(),
                        completed: !!completed.curtains
                    });
                }
            }
        });
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendors & Orders</h1>
                <p className="text-slate-500 mt-1">Track and manage production orders assigned to specific vendors.</p>
            </div>
            
            <VendorList vendorOrders={vendorOrders} />
        </div>
    );
}
