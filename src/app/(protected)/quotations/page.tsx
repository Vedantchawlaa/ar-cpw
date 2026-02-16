import { Suspense } from "react";
import QuotationList from "@/components/quotations/QuotationList";
import { getQuotations } from "@/lib/actions/quotation-actions";
import { QuotationWithRelations } from "@/lib/types/quotation";

export default async function QuotationsPage() {
    const result = await getQuotations();
    const quotations = result.success ? (result.data as unknown as QuotationWithRelations[]) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Quotations</h1>
            </div>

            <Suspense fallback={<div>Loading quotations...</div>}>
                <QuotationList initialQuotations={quotations} />
            </Suspense>
        </div>
    );
}
