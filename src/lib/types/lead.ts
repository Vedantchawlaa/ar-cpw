export type LeadType = 'Hot' | 'Warm' | 'Cold';

export interface Lead {
    id: string;
    name: string;
    city: string;
    phone: string;
    lastContacted: Date;
    type: LeadType;
    expectedOrderValue: number;
    quotationShared: boolean;
}
