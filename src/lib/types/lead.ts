export type LeadType = 'Hot' | 'Warm' | 'Cold';

export interface Lead {
    id: string;
    name: string;
    city: string;
    phone: string;
    lastContacted: Date | null;
    type: LeadType;
    expectedOrderValue: number;
    quotationShared: boolean;
}
