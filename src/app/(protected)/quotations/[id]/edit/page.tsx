import { getQuotation } from "@/lib/actions/quotation-actions";
import { getLeads } from "@/lib/actions/lead-actions";
import QuotationBuilder from "@/components/quotations/QuotationBuilder";
import { notFound } from "next/navigation";
import { QuotationWithRelations } from "@/lib/actions/quotation-actions";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditQuotationPage({ params }: PageProps) {
    const { id } = await params;

    // Parallel fetch
    const [quotationResult, leads] = await Promise.all([
        getQuotation(id),
        getLeads()
    ]);

    if (!quotationResult.success || !quotationResult.data) {
        notFound();
    }

    const quotation = quotationResult.data as unknown as QuotationWithRelations;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Edit Estimate #{quotation.number}</h1>
            </div>

            <QuotationBuilder leads={leads} initialData={quotation} />
        </div>
    );
}
