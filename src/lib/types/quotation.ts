export interface Quotation {
    id: string;
    number: string;
    leadId: string;
    date: Date;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    receivedAmount: number;
    status: string; // 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'
    createdAt: Date;
    updatedAt: Date;
}

export interface QuotationItem {
    id: string;
    quotationId: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    details?: string;
}

export interface QuotationWithRelations extends Quotation {
    lead: { name: string; city: string; phone: string };
    items: QuotationItem[];
}
export interface Product {
    id: string;
    name: string;
    rate: number;
    createdAt?: Date;
    updatedAt?: Date;
}
