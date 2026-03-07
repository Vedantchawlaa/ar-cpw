'use client';

import { QuotationWithRelations } from "@/lib/types/quotation";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatCurrency } from "@/lib/utils";
// @ts-ignore
import { Printer, Share2, Pencil, Check, X, Edit, Download, MessageSquare, Bell } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toWords } from 'number-to-words';
import { updateQuotation } from "@/lib/actions/quotation-actions";

interface QuotationPrintProps {
    quotation: QuotationWithRelations;
    layoutMode?: 'standard' | 'compact';
}

export default function QuotationPrint({ quotation, layoutMode: initialLayout = 'standard' }: QuotationPrintProps) {
    const [layoutMode, setLayoutMode] = useState<'standard' | 'compact'>(initialLayout);

    // Payment State
    const [receivedAmount, setReceivedAmount] = useState(
        quotation.receivedAmount || 0
    );
    const [isEditingReceived, setIsEditingReceived] = useState(false);
    const [tempReceived, setTempReceived] = useState(0);
    const [isPrintMode, setIsPrintMode] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (quotation.receivedAmount) setReceivedAmount(quotation.receivedAmount);
        setTempReceived(quotation.receivedAmount || 0);

        const beforePrint = () => setIsPrintMode(true);
        const afterPrint = () => setIsPrintMode(false);
        window.addEventListener('beforeprint', beforePrint);
        window.addEventListener('afterprint', afterPrint);
        return () => {
            window.removeEventListener('beforeprint', beforePrint);
            window.removeEventListener('afterprint', afterPrint);
        }
    }, [quotation]);

    const savePayment = async () => {
        setIsEditingReceived(false);
        setReceivedAmount(tempReceived);

        await updateQuotation(quotation.id, {
            leadId: quotation.leadId,
            items: quotation.items,
            subtotal: quotation.subtotal,
            tax: quotation.tax,
            discount: quotation.discount,
            total: quotation.total,
            receivedAmount: tempReceived,
            status: quotation.status
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const getBase64ImageFromUrl = async (imageUrl: string) => {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(reader.result), false);
            reader.onerror = () => reject(new Error('Failed to load image'));
            reader.readAsDataURL(blob);
        });
    };

    const generatePDFWithWatermark = async (element: HTMLElement, filename: string, shouldDownload: boolean = true) => {
        const html2pdf = (await import('html2pdf.js')).default;

        const opt = {
            margin: 0, // Use internal padding instead of library margins to prevent cutting
            filename: filename,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
        };

        try {
            const imgData = await getBase64ImageFromUrl('/logo.png') as string;

            return new Promise((resolve, reject) => {
                html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
                    const totalPages = pdf.internal.getNumberOfPages();
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const watermarkWidth = 120; // mm
                    const watermarkHeight = 120; // mm
                    const x = (pageWidth - watermarkWidth) / 2;
                    const y = (pageHeight - watermarkHeight) / 2;

                    // Only add watermark to the first page
                    if (totalPages >= 1) {
                        pdf.setPage(1);
                        pdf.setGState(new pdf.GState({ opacity: 0.08 }));
                        pdf.addImage(imgData, 'PNG', x, y, watermarkWidth, watermarkHeight);
                    }

                    if (shouldDownload) {
                        pdf.save(filename);
                        resolve(null);
                    } else {
                        pdf.save(filename);
                        resolve(null);
                    }
                }).catch(reject);
            });
        } catch (err) {
            console.error("PDF generation failed:", err);
            return html2pdf().set(opt).from(element).save();
        }
    };

    const handleWhatsAppAction = async (type: 'share' | 'reminder') => {
        if (isGenerating) return;
        setIsGenerating(true);

        try {
            let phone = quotation.lead.phone.replace(/[^0-9]/g, '');
            if (phone.length === 10) phone = '91' + phone;

            let message = "";
            if (type === 'share') {
                message = `Hi ${quotation.lead.name}, here is your quotation #${quotation.number} for ₹${displayTotal.toLocaleString()}. - CHAWLA PARDE WALA`;
            } else {
                message = `Hi ${quotation.lead.name}, just a gentle reminder regarding the pending balance of ₹${balanceDue.toLocaleString()} for your quotation #${quotation.number}. Hope you're doing well! - CHAWLA PARDE WALA`;
            }

            const element = document.getElementById('quotation-content');
            if (!element) throw new Error("Content not found");

            // For WhatsApp/Reminders, we always want compact PDF
            const previousLayout = layoutMode;
            if (previousLayout !== 'compact') {
                setLayoutMode('compact');
                // Small delay to allow re-render
                await new Promise(r => setTimeout(r, 100));
            }

            await generatePDFWithWatermark(element, `Estimate_${quotation.number}.pdf`, true);

            if (previousLayout !== 'compact') {
                setLayoutMode(previousLayout);
            }

            const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        } catch (err) {
            console.error("WhatsApp action failed:", err);
            let phone = quotation.lead.phone.replace(/[^0-9]/g, '');
            if (phone.length === 10) phone = '91' + phone;

            let message = "";
            if (type === 'share') {
                message = `Hi ${quotation.lead.name}, here is your quotation #${quotation.number} for ₹${displayTotal.toLocaleString()}. - CHAWLA PARDE WALA`;
            } else {
                message = `Hi ${quotation.lead.name}, just a gentle reminder regarding the pending balance of ₹${balanceDue.toLocaleString()} for your quotation #${quotation.number}. Hope you're doing well! - CHAWLA PARDE WALA`;
            }

            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        const element = document.getElementById('quotation-content');
        if (!element) return;
        await generatePDFWithWatermark(element, `Estimate_${quotation.number}.pdf`, true);
    };

    const safeTax = quotation.tax || 0;
    const safeDiscount = quotation.discount || 0;
    const safeSubtotal = quotation.subtotal || 0;
    const safeReceivedAmount = receivedAmount || 0;

    const baseTotal = safeSubtotal + safeTax - safeDiscount;
    const displayTotal = Math.round(baseTotal);
    const roundOff = displayTotal - baseTotal;
    const balanceDue = Math.max(0, displayTotal - safeReceivedAmount);
    const hasTax = safeTax > 0;
    const hasDiscount = safeDiscount > 0;

    return (
        <div className="max-w-[1200px] mx-auto py-8 px-4 print:p-0">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        margin: 0;
                        size: a4;
                    }
                    body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                }
            ` }} />
            {/* ACTION BAR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 print:hidden">
                <div className="flex items-center gap-2">
                    <Button
                        variant={layoutMode === 'standard' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLayoutMode('standard')}
                    >
                        Standard
                    </Button>
                    <Button
                        variant={layoutMode === 'compact' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLayoutMode('compact')}
                    >
                        Compact
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href={`/quotations/${quotation.id}/edit`}>
                        <Button variant={"outline" as any}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                    </Link>
                    <Button onClick={handlePrint} variant={"outline" as any}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <Button onClick={handleDownload as any} variant={"outline" as any}>
                        <Download className="mr-2 h-4 w-4" /> Download PDF
                    </Button>
                    <Button
                        onClick={() => handleWhatsAppAction('reminder')}
                        variant={"outline" as any}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        disabled={isGenerating}
                    >
                        <Bell className="mr-2 h-4 w-4" /> Reminder
                    </Button>
                    <Button
                        onClick={() => handleWhatsAppAction('share')}
                        variant={"outline" as any}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        disabled={isGenerating}
                    >
                        <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
                    </Button>
                </div>
            </div>

            <div
                id="quotation-content"
                className={`bg-white ${layoutMode === 'compact' ? 'p-8 pt-6 text-xs' : 'p-12 pt-10 text-sm'} transition-all duration-300 relative mx-auto w-[210mm] min-h-[297mm] shadow-lg print:shadow-none print:w-[210mm] print:m-0`}
            >

                {/* BACKGROUND WATERMARK */}
                <div
                    className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden"
                    data-html2canvas-ignore
                >
                    <div className="relative w-[500px] h-[500px] opacity-[0.06]">
                        <Image src="/logo.png" alt="Watermark" fill style={{ objectFit: 'contain' }} />
                    </div>
                </div>

                {/* SYMMETRICAL HEADER - Bill To Left, Logo/Estimate Right */}
                <div className={`relative z-10 flex justify-between items-start ${layoutMode === 'compact' ? 'mb-4' : 'mb-6'} break-inside-avoid transition-all`}>
                    {/* Left Side: Bill To */}
                    <div className={`${layoutMode === 'compact' ? 'mt-4' : 'mt-20'} uppercase tracking-wide space-y-2`}>
                        <div className={`text-zinc-400 font-bold tracking-tighter ${layoutMode === 'compact' ? 'text-sm' : 'text-xl'}`}>To</div>
                        <div className={`font-black text-zinc-900 tracking-tight ${layoutMode === 'compact' ? 'text-xl' : 'text-3xl'}`}>{quotation.lead.name}</div>
                        <div className="text-zinc-600 font-bold italic font-mono text-xs">Date: {formatDate(new Date())}</div>
                    </div>

                    {/* Right Side: Logo & Estimate info */}
                    <div className="flex flex-col items-end text-right">
                        {/* Logo */}
                        <div className="mb-4">
                            <img
                                src="/logo.png"
                                alt="CHAWLA PARDE WALA"
                                className={`${layoutMode === 'compact' ? 'w-40' : 'w-64'} h-auto object-contain transition-all`}
                            />
                        </div>

                        {/* Estimate Title & Number */}
                        <div>
                            <div className={`${layoutMode === 'compact' ? 'text-2xl' : 'text-4xl'} font-light tracking-[0.2em] uppercase mb-1 transition-all text-zinc-300`}>ESTIMATE</div>
                            <div className={`${layoutMode === 'compact' ? 'text-lg' : 'text-xl'} font-bold text-zinc-900 transition-all`}>#{quotation.number}</div>
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="relative z-10 mb-4 border-t border-zinc-200">
                    <table className="w-full">
                        <thead className={`bg-zinc-50 uppercase tracking-widest ${layoutMode === 'compact' ? 'text-[10px]' : 'text-xs'}`}>
                            <tr>
                                <th className="px-4 py-4 text-left font-bold text-zinc-500">Description</th>
                                <th className="px-4 py-4 text-center font-bold text-zinc-500">Qty</th>
                                <th className="px-4 py-4 text-right font-bold text-zinc-500">Rate</th>
                                <th className="px-4 py-4 text-right font-bold text-zinc-500">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-800">
                            {quotation.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50/50 break-inside-avoid">
                                    <td className={`px-4 ${layoutMode === 'compact' ? 'py-3' : 'py-5'}`}>
                                        <div className="font-bold uppercase tracking-tight text-zinc-900">{item.description}</div>
                                        {item.details && (
                                            <div className="text-zinc-500 text-[10px] italic mt-1.5 whitespace-pre-wrap leading-relaxed max-w-md">{item.details}</div>
                                        )}
                                    </td>
                                    <td className={`px-4 ${layoutMode === 'compact' ? 'py-3' : 'py-5'} text-center font-medium`}>{item.quantity}</td>
                                    <td className={`px-4 ${layoutMode === 'compact' ? 'py-3' : 'py-5'} text-right whitespace-nowrap font-medium`}>₹{formatCurrency(item.rate)}</td>
                                    <td className={`px-4 ${layoutMode === 'compact' ? 'py-3' : 'py-5'} text-right font-bold whitespace-nowrap text-zinc-900`}>₹{formatCurrency(item.quantity * item.rate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* QUOTATION DESCRIPTION & SERVICES */}
                {(quotation.description || (quotation.services && Array.isArray(quotation.services) && quotation.services.some((s: any) => s.enabled))) && (
                    <div className="relative z-10 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 break-inside-avoid">
                        {quotation.description && (
                            <div className="p-4 bg-zinc-50/50 border-l-4 border-zinc-200 rounded-r-lg">
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Notes & Description</div>
                                <div className="text-zinc-700 whitespace-pre-wrap leading-relaxed italic">{quotation.description}</div>
                            </div>
                        )}
                        {quotation.services && Array.isArray(quotation.services) && quotation.services.some((s: any) => s.enabled) && (
                            <div className="p-4 bg-blue-50/30 border-l-4 border-blue-200 rounded-r-lg">
                                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Additional Services</div>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {quotation.services.filter((s: any) => s.enabled && s.label).map((s: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between text-zinc-700 text-xs font-bold uppercase tracking-tight">
                                            <div className="flex items-center">
                                                <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center mr-2">
                                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                                </div>
                                                {s.label}
                                            </div>
                                            {s.rate !== undefined && s.rate !== null && s.rate !== "" && (
                                                <span>
                                                    {typeof s.rate === 'number' || !isNaN(Number(s.rate))
                                                        ? `₹${formatCurrency(Number(s.rate))}`
                                                        : s.rate}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SUMMARY ROW with Left-Aligned QR */}
                <div className="relative z-10 flex justify-between items-end gap-8 mb-4 break-inside-avoid">
                    {/* Enlarged QR Code on the Left */}
                    <div className="flex flex-col items-start gap-2">
                        <div className="h-48 w-48 bg-white p-2 border-2 border-zinc-100 rounded-xl shadow-sm overflow-hidden flex items-center justify-center">
                            <img
                                src="/qr.png"
                                alt="Payment QR"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    console.error("QR Code failed to load");
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                        const errorMsg = document.createElement('div');
                                        errorMsg.className = 'text-[10px] text-zinc-400 font-bold text-center p-4';
                                        errorMsg.innerText = 'PAYMENT QR NOT FOUND\nPLEASE CHECK /public/qr.png';
                                        parent.appendChild(errorMsg);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Total Summary on the Right */}
                    <div className={`${layoutMode === 'compact' ? 'w-full md:w-72' : 'w-full md:w-80'} space-y-3`}>
                        <div className="flex justify-between text-zinc-500 font-semibold text-[11px] uppercase tracking-wider">
                            <span>Subtotal</span>
                            <span className="text-zinc-900">₹{formatCurrency(quotation.subtotal)}</span>
                        </div>

                        {hasTax && (
                            <div className="flex justify-between text-zinc-500 font-semibold text-[11px] uppercase tracking-wider">
                                <span>Tax (GST)</span>
                                <span className="text-zinc-900">₹{formatCurrency(quotation.tax)}</span>
                            </div>
                        )}

                        {hasDiscount && (
                            <div className="flex justify-between text-green-600 font-semibold text-[11px] uppercase tracking-wider">
                                <span>Discount</span>
                                <span>-₹{formatCurrency(quotation.discount)}</span>
                            </div>
                        )}

                        {Math.abs(roundOff) > 0.001 && (
                            <div className="flex justify-between text-zinc-400 font-semibold text-[10px] uppercase tracking-wider italic">
                                <span>Round Off</span>
                                <span>{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
                            </div>
                        )}

                        <div className={`flex justify-between border-t-2 border-zinc-900 ${layoutMode === 'compact' ? 'pt-3 text-lg' : 'pt-4 text-xl'} font-bold text-zinc-900`}>
                            <span className="uppercase tracking-[0.15em]">Grand Total</span>
                            <span>₹{formatCurrency(displayTotal)}</span>
                        </div>

                        <div className="flex justify-between items-center text-zinc-500 font-bold text-[11px] uppercase tracking-wider group">
                            <span>Amount Received</span>
                            <div className="flex items-center gap-1 text-zinc-900 font-semibold">
                                {isEditingReceived ? (
                                    <>
                                        <input
                                            type="number"
                                            value={tempReceived}
                                            onChange={(e) => setTempReceived(Number(e.target.value))}
                                            className="w-20 border rounded px-1 text-right focus:outline-none focus:ring-1 focus:ring-zinc-900 print:hidden"
                                            autoFocus
                                        />
                                        <button onClick={savePayment} className="text-green-600 print:hidden p-1"><Check size={16} /></button>
                                        <button onClick={() => setIsEditingReceived(false)} className="text-red-500 print:hidden p-1"><X size={16} /></button>
                                    </>
                                ) : (
                                    <>
                                        <span>₹{formatCurrency(receivedAmount)}</span>
                                        <button
                                            onClick={() => setIsEditingReceived(true)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-zinc-400 hover:text-zinc-600 print:hidden"
                                        >
                                            <Edit size={12} />
                                        </button>
                                    </>
                                )}
                                <span className="hidden print:inline ml-1 font-bold">₹{formatCurrency(receivedAmount)}</span>
                            </div>
                        </div>

                        <div className={`flex justify-between border-t border-zinc-200 mt-2 ${layoutMode === 'compact' ? 'pt-3 text-lg' : 'pt-4 text-xl'} font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="uppercase tracking-widest text-xs text-zinc-400 font-bold self-center">Balance Due</span>
                            <span>₹{formatCurrency(balanceDue)}</span>
                        </div>
                    </div>
                </div>

                {/* WORDS SECTION */}
                <div className="relative z-10 pt-4 border-t border-zinc-50">
                    <div className={`${layoutMode === 'compact' ? 'text-[10px]' : 'text-xs'} text-zinc-400 font-bold uppercase tracking-wide`}>
                        Amount in words: <span className="text-zinc-900 italic">
                            {isFinite(balanceDue) ? toWords(Math.round(balanceDue)).toUpperCase().replace(/,/g, '') : 'ZERO'} RUPEES ONLY
                        </span>
                    </div>
                </div>

                {/* FOOTER */}
                <div className={`relative z-10 mt-8 grid grid-cols-2 gap-12 ${layoutMode === 'compact' ? 'text-[10px]' : 'text-xs'} break-inside-avoid`}>
                    <div>
                        <div className="font-bold text-zinc-900 mb-3 uppercase tracking-widest border-b-2 border-zinc-900 pb-1 w-fit">Terms & Conditions</div>
                        <ul className="list-disc list-inside space-y-2 text-zinc-500 leading-relaxed font-bold uppercase tracking-tighter text-[10px]">
                            <li>Estimate is valid for 7 days from issue.</li>
                            <li>50% advance required to initiate order.</li>
                            <li>Balance must be cleared before/on delivery.</li>
                        </ul>
                    </div>
                    <div className="flex flex-col items-end justify-end">
                        <div className="text-center">
                            <div className="font-bold text-zinc-400 uppercase tracking-widest text-[9px] mb-1">Authorized Signatory</div>
                            <div className="text-zinc-900 uppercase font-black text-[11px] tracking-wider">CHAWLA PARDE WALA</div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM CONTACT INFO */}
                <div className="relative z-10 mt-10 pt-6 border-t-2 border-zinc-900 text-center break-inside-avoid">
                    <div className="font-black text-zinc-900 tracking-[0.5em] uppercase mb-3 text-lg">CHAWLA PARDE WALA</div>
                    <div className="text-zinc-900 gap-x-8 gap-y-3 uppercase tracking-widest font-bold flex flex-wrap justify-center items-center text-[11px]">
                        <span>103, 110 SD College Market, Panipat</span>
                        <span className="w-2 h-2 rounded-full bg-zinc-900"></span>
                        <span className="flex items-center gap-1.5"><span className="text-zinc-400 font-medium italic">Tushar:</span> 74046-18501</span>
                        <span className="w-2 h-2 rounded-full bg-zinc-900"></span>
                        <span className="flex items-center gap-1.5"><span className="text-zinc-400 font-medium italic">Sunil:</span> 98120-18501</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
