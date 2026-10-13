import db from "@/lib/db";
import { Actor, isAdmin } from "./types";

export interface LeadInput {
    name: string;
    city: string;
    phone: string;
    description: string | null;
    type: string;
    expectedOrderValue: number;
    quotationShared: boolean;
    lastContacted: Date;
    nextContactDate: Date | null;
}

export async function listLeads(actor: Actor) {
    const where = isAdmin(actor) ? {} : { userId: actor.id };

    return db.lead.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
    });
}

// `id` lets an offline client supply the row id it already generated.
export async function createLead(actor: Actor, input: LeadInput, id?: string) {
    return (db as any).lead.create({
        data: {
            ...(id ? { id } : {}),
            ...input,
            userId: actor.id,
        },
    });
}

/** True when a non-admin actor is touching a lead owned by someone else. */
async function isForeignLead(actor: Actor, id: string) {
    if (isAdmin(actor)) return false;
    const existing = await (db as any).lead.findUnique({ where: { id } });
    return !!existing && existing.userId !== actor.id;
}

export async function updateLead(actor: Actor, id: string, input: LeadInput) {
    if (await isForeignLead(actor, id)) {
        return { success: false, error: "Unauthorized access to this lead" };
    }

    await (db as any).lead.update({
        where: { id },
        data: input,
    });
    return { success: true };
}

export async function deleteLead(actor: Actor, id: string) {
    if (await isForeignLead(actor, id)) {
        return { success: false, error: "Unauthorized access to this lead" };
    }

    await db.lead.delete({
        where: { id },
    });
    return { success: true };
}

export async function getLeadById(actor: Actor, id: string) {
    const lead = await db.lead.findUnique({
        where: { id },
    });

    if (!lead) return null;

    // Check access
    if (!isAdmin(actor) && lead.userId !== actor.id) {
        return null;
    }

    return lead;
}
