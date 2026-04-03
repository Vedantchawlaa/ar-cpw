import { getMeasurementById } from "@/lib/actions/measurement-actions";
import { MeasurementEditor } from "@/components/leads/MeasurementEditor";
import { SizesToShare } from "@/components/leads/SizesToShare";
import { AccessoryCounter } from "@/components/leads/AccessoryCounter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function MeasurementEditPage({ params }: PageProps) {
    const { id } = await params;
    const result = await getMeasurementById(id);

    if (id !== 'new' && (!result.success || !result.data)) {
        if (id !== 'new') return notFound();
    }

    const measurement = id === 'new' ? null : result.data;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4">
                <Link href="/measurements">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h2 className="text-3xl font-bold tracking-tight">
                    {measurement ? "Edit Measurement" : "New Measurement"}
                </h2>
            </div>

            <Tabs defaultValue="measurements" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="measurements">Measurements & Sizing</TabsTrigger>
                    {measurement && <TabsTrigger value="sizes">Sizes to Share</TabsTrigger>}
                    {measurement && <TabsTrigger value="accessories">Accessory Counter</TabsTrigger>}
                </TabsList>
                <TabsContent value="measurements" className="space-y-4">
                    <MeasurementEditor
                        measurementId={measurement?.id}
                        initialData={measurement?.data}
                        initialNotes={measurement?.notes || ""}
                        initialCustomerName={measurement?.customerName || ""}
                        initialTitle={measurement?.title || ""}
                    />
                </TabsContent>
                {measurement && (
                    <TabsContent value="sizes" className="space-y-4">
                        <SizesToShare
                            measurementId={measurement.id}
                            leadId={measurement.leadId}
                            initialData={measurement.data}
                        />
                    </TabsContent>
                )}
                {measurement && (
                    <TabsContent value="accessories" className="space-y-4">
                        <AccessoryCounter 
                            initialData={measurement.data}
                            measurementId={measurement.id}
                            customerName={measurement.customerName}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
