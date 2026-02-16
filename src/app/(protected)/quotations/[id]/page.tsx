import { getQuotation } from "@/lib/actions/quotation-actions";
import { QuotationWithRelations } from "@/lib/types/quotation";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import QuotationPrint from "@/components/quotations/QuotationPrint";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function QuotationPage({ params }: PageProps) {
    const { id } = await params;
    const result = await getQuotation(id);

    if (!result.success || !result.data) {
        notFound();
    }

    const quotation = result.data as unknown as QuotationWithRelations;

    return (
        <div className="space-y-6">
            {/* Header - Hidden in Print */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Link href="/quotations">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Quotation {quotation.number}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* We can add a client-side print button here if needed, but browser print works fine */}
                </div>
            </div>

            {/* Print View Component */}
            <QuotationPrint quotation={quotation} />
        </div>
    );
}
