'use client';

import { useState } from "react";
import { QuotationWithRelations } from "@/lib/types/quotation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { Plus, Printer, Trash2, MessageSquare, Bell } from "lucide-react";
import Link from "next/link";
import { deleteQuotation } from "@/lib/actions/quotation-actions";
import QuotationPrint from "./QuotationPrint";
import { formatDate } from "@/lib/utils";

interface QuotationListProps {
    initialQuotations: QuotationWithRelations[];
}

export default function QuotationList({ initialQuotations }: QuotationListProps) {
    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this quotation?")) {
            await deleteQuotation(id);
        }
    };

    const [sharingQuotation, setSharingQuotation] = useState<QuotationWithRelations | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingType, setGeneratingType] = useState<'share' | 'reminder' | null>(null);

    const handleWhatsAppAction = async (quotation: QuotationWithRelations, type: 'share' | 'reminder') => {
        if (isGenerating) return;

        setIsGenerating(true);
        setGeneratingType(type);
        setSharingQuotation(quotation);

        // Wait for render with a slightly longer timeout and better error handling
        setTimeout(async () => {
            try {
                let phone = quotation.lead.phone.replace(/[^0-9]/g, '');
                if (phone.length === 10) phone = '91' + phone;

                let message = "";
                const roundedTotal = Math.round(quotation.subtotal + (quotation.tax || 0) - (quotation.discount || 0));
                const balanceDue = Math.max(0, roundedTotal - (quotation.receivedAmount || 0));

                if (type === 'share') {
                    message = `Hi ${quotation.lead.name}, here is your quotation #${quotation.number} for ₹${roundedTotal.toLocaleString()}. - CHAWLA PARDE WALA`;
                } else {
                    message = `Hi ${quotation.lead.name}, just a gentle reminder regarding the pending balance of ₹${balanceDue.toLocaleString()} for your quotation #${quotation.number}. Hope you're doing well! - CHAWLA PARDE WALA`;
                }

                const element = document.getElementById(`quotation-share-${quotation.id}`);
                if (!element) throw new Error("Render target not found");

                const html2pdf = (await import('html2pdf.js')).default;
                const opt = {
                    margin: 10,
                    filename: `Estimate_${quotation.number}.pdf`,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
                };

                const worker = html2pdf().set(opt).from(element);

                // Always download the PDF
                await worker.save();

                // Then open WhatsApp chat
                const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');

            } catch (err) {
                console.error("WhatsApp action failed:", err);
                alert("Failed to generate PDF. Opening WhatsApp with text only.");
                let phone = quotation.lead.phone.replace(/[^0-9]/g, '');
                if (phone.length === 10) phone = '91' + phone;

                let message = "";
                const balanceDue = Math.max(0, quotation.total - (quotation.receivedAmount || 0));

                if (type === 'share') {
                    message = `Hi ${quotation.lead.name}, here is your quotation #${quotation.number} for ₹${quotation.total.toLocaleString()}. - CHAWLA PARDE WALA`;
                } else {
                    message = `Hi ${quotation.lead.name}, just a gentle reminder regarding the pending balance of ₹${balanceDue.toLocaleString()} for your quotation #${quotation.number}. Hope you're doing well! - CHAWLA PARDE WALA`;
                }

                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            } finally {
                setIsGenerating(false);
                setGeneratingType(null);
                setSharingQuotation(null);
            }
        }, 1500);
    };

    return (
        <Card className="relative">
            {isGenerating && (
                <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="bg-white p-4 rounded-lg shadow-lg border border-zinc-200 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        <span className="text-sm font-medium">
                            {generatingType === 'share' ? 'Generating PDF & Opening WhatsApp...' : 'Preparing Reminder & PDF...'}
                        </span>
                    </div>
                </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Quotations</CardTitle>
                <Link href="/quotations/new">
                    <Button disabled={isGenerating}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Quotation
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Number</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                            {initialQuotations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                                        No quotations found. Create your first one!
                                    </td>
                                </tr>
                            ) : (
                                initialQuotations.map((quotation) => (
                                    <tr key={quotation.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-3 font-medium">{quotation.number}</td>
                                        <td className="px-4 py-3 text-zinc-500">{formatDate(quotation.date)}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{quotation.lead.name}</div>
                                            <div className="text-xs text-zinc-500">{quotation.lead.city}</div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                            ₹{Math.round(quotation.subtotal + (quotation.tax || 0) - (quotation.discount || 0)).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${quotation.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                                                quotation.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-zinc-100 text-zinc-800'
                                                }`}>
                                                {quotation.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <Button
                                                variant={"outline" as any}
                                                size={"sm" as any}
                                                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                                title="Send Payment Reminder"
                                                onClick={() => handleWhatsAppAction(quotation, 'reminder')}
                                                disabled={isGenerating}
                                            >
                                                <Bell className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant={"outline" as any}
                                                size={"sm" as any}
                                                className="text-green-600 border-green-200 hover:bg-green-50"
                                                title="Share via WhatsApp"
                                                onClick={() => handleWhatsAppAction(quotation, 'share')}
                                                disabled={isGenerating}
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                            </Button>
                                            <Link href={`/quotations/${quotation.id}`}>
                                                <Button variant={"outline" as any} size={"sm" as any} disabled={isGenerating}>
                                                    View
                                                </Button>
                                            </Link>
                                            <Button variant={"ghost" as any} size={"sm" as any} className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(quotation.id)} disabled={isGenerating}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>

            <div
                className="absolute opacity-0 pointer-events-none overflow-hidden"
                style={{ left: '-5000px', top: '0', width: '800px', height: '1px' }}
            >
                {sharingQuotation && (
                    <div id={`quotation-share-${sharingQuotation.id}`}>
                        <QuotationPrint quotation={sharingQuotation} />
                    </div>
                )}
            </div>
        </Card>
    );
}
