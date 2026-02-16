import { getAllMeasurements } from "@/lib/actions/measurement-actions";
import { MeasurementList } from "@/components/measurements/MeasurementList";

export default async function MeasurementsPage() {
    const result = await getAllMeasurements();
    const measurements = result.data || [];

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Measurements</h2>
                    <p className="text-muted-foreground">Manage customer sizing sheets and specifications.</p>
                </div>
            </div>
            <MeasurementList measurements={measurements} />
        </div>
    );
}
