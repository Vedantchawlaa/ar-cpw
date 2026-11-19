import { getAllMeasurements } from "@/lib/actions/measurement-actions";
import { VendorList } from "@/components/vendors/VendorList";
import { VendorLedger } from "@/components/vendors/VendorLedger";
import { VendorsTabs, type VendorsTab } from "@/components/vendors/VendorsTabs";
import { VendorDirectory } from "@/components/vendors/VendorDirectory";
import { getVendorLedger } from "@/lib/actions/vendor-ledger-actions";
import { businessNow } from "@/lib/staff-attendance";

export const dynamic = 'force-dynamic';

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ tab?: string; vendor?: string }> }) {
    const { tab, vendor } = await searchParams;
    if (tab === "ledger" || tab === "directory") {
        const ledger = await getVendorLedger();
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                <Header active={tab} />
                {!ledger.ok
                    ? <p className="text-sm text-red-600 p-6 border rounded-lg bg-red-50">{ledger.error}</p>
                    : tab === "directory"
                        ? <VendorDirectory data={ledger.data} />
                        : <VendorLedger key={vendor ?? ""} data={ledger.data} today={businessNow().date} initialVendor={vendor} />}
            </div>
        );
    }

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
            <Header active="orders" />

            <VendorList vendorOrders={vendorOrders} />
        </div>
    );
}

function Header({ active }: { active: VendorsTab }) {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendors & Orders</h1>
                <p className="text-slate-500 mt-1">
                    {active === "ledger" ? "Work done by each vendor, payments made and balance due."
                        : active === "directory" ? "Stitching vendors and your fabric, blind and track sources."
                        : "Track and manage production orders assigned to specific vendors."}
                </p>
            </div>
            <VendorsTabs active={active} />
        </div>
    );
}
