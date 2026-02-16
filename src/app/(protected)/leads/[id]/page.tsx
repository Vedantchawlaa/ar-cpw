import { getLeadById } from "@/lib/actions/lead-actions";
import { getMeasurementByLeadId } from "@/lib/actions/measurement-actions";
import { MeasurementEditor } from "@/components/leads/MeasurementEditor";
import { LeadForm } from "@/components/leads/LeadForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
    const { id } = await params;

    const lead = await getLeadById(id);

    if (!lead) {
        notFound();
    }

    const measurement = await getMeasurementByLeadId(id);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4">
                <Link href="/leads">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h2 className="text-3xl font-bold tracking-tight">{lead.name}</h2>
                    <p className="text-muted-foreground">{lead.city} • {lead.phone}</p>
                </div>
            </div>

            <Tabs defaultValue="measurements" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="details">Lead Details</TabsTrigger>
                    <TabsTrigger value="measurements">Measurements & Sizing</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4">
                    <div className="max-w-2xl">
                        <div className="rounded-md border p-4 bg-white">
                            <LeadForm initialData={lead} onSuccess={() => { }} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="measurements" className="space-y-4">
                    <MeasurementEditor
                        leadId={lead.id}
                        initialData={measurement.data?.data}
                        initialNotes={measurement.data?.notes}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
