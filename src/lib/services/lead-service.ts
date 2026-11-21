import db from "@/lib/db";
import { Actor, isAdmin } from "./types";

/** Staff see leads they created or that are assigned to them (Sales CRM); admins see all. */
export const leadAccessWhere = (actor: Actor) => (isAdmin(actor) ? {} : { OR: [{ userId: actor.id }, { assignedToId: actor.id }] });
export const canAccessLead = (actor: Actor, lead: { userId: string | null; assignedToId?: string | null }) =>
    isAdmin(actor) || lead.userId === actor.id || lead.assignedToId === actor.id;

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
    const where = leadAccessWhere(actor);

    return db.lead.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
    });
}

// `id` lets an offline client supply the row id it already generated.
export async function createLead(actor: Actor, input: LeadInput, id?: string) {
    // The creator owns the lead in the Sales CRM too, with the usual history rows
    return db.$transaction(async (tx) => {
        const lead = await tx.lead.create({
            data: {
                ...(id ? { id } : {}),
                ...input,
                userId: actor.id,
                assignedToId: actor.id,
                assignedAt: new Date(),
                status: "ASSIGNED",
            },
        });
        await tx.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: null, toStatus: "ASSIGNED", changedById: actor.id } });
        await tx.leadActivity.create({ data: { leadId: lead.id, userId: actor.id, type: "CREATED", summary: "Lead created" } });
        return lead;
    });
}

/** True when a non-admin actor is touching a lead owned by someone else. */
async function isForeignLead(actor: Actor, id: string) {
    if (isAdmin(actor)) return false;
    const existing = await (db as any).lead.findUnique({ where: { id } });
    return !!existing && !canAccessLead(actor, existing);
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
    if (!canAccessLead(actor, lead)) {
        return null;
    }

    return lead;
}
