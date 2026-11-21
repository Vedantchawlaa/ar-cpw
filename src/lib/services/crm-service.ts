import { cache } from "react";
import { Prisma } from "@prisma/client";
import db from "@/lib/db";
import type { Actor } from "./types";
import { STATUS_INFO, isOpenStatus, leadCode, phoneKey, type LeadStatus } from "@/lib/sales-crm";

// Sales CRM access rules, enforced here for every query and write:
//   ADMIN      (User.role = admin)              everything
//   MANAGER    (staff with salesRole = MANAGER)   own + team members' leads, calls and status; unassigned leads
//   EXECUTIVE  (any other staff user)            leads assigned to them (or created by them and unassigned)
// Customers never reach the CRM.

export type SalesRole = "ADMIN" | "MANAGER" | "EXECUTIVE";

export interface SalesActor {
    id: string;
    name: string;
    role: SalesRole;
    /** Users whose calls / leads / status this person can see (self included). null = everyone. */
    visibleUserIds: string[] | null;
}

type Tx = Prisma.TransactionClient;

export class CrmError extends Error {}

/** The caller as a CRM user, read fresh from the DB so role / team changes apply at once. */
export async function getSalesActor(actor: Actor | null | undefined): Promise<SalesActor | null> {
    if (!actor?.id) return null;
    return loadSalesActor(actor.id);
}

// Memoised per server render (layout + page share one lookup); server actions and API routes always read fresh.
const loadSalesActor = cache(async (id: string): Promise<SalesActor | null> => {
    const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, salesRole: true } });
    if (!user || (user.role !== "admin" && user.role !== "user")) return null;
    if (user.role === "admin") return { id: user.id, name: user.name, role: "ADMIN", visibleUserIds: null };
    if (user.salesRole === "MANAGER") {
        const team = await db.user.findMany({ where: { managerId: user.id, role: { in: ["admin", "user"] } }, select: { id: true } });
        return { id: user.id, name: user.name, role: "MANAGER", visibleUserIds: [user.id, ...team.map((t) => t.id)] };
    }
    return { id: user.id, name: user.name, role: "EXECUTIVE", visibleUserIds: [user.id] };
});

export async function requireSalesActor(actor: Actor | null | undefined): Promise<SalesActor> {
    const sa = await getSalesActor(actor);
    if (!sa) throw new CrmError("You do not have access to the sales CRM.");
    return sa;
}

export const canManage = (sa: SalesActor) => sa.role === "ADMIN" || sa.role === "MANAGER";

/** Leads this person may see. */
export function leadScope(sa: SalesActor): Prisma.LeadWhereInput {
    if (sa.role === "ADMIN") return {};
    if (sa.role === "MANAGER") {
        return { OR: [{ assignedToId: { in: sa.visibleUserIds! } }, { assignedToId: null }, { userId: { in: sa.visibleUserIds! } }] };
    }
    return { OR: [{ assignedToId: sa.id }, { assignedToId: null, userId: sa.id }] };
}

/** Rows owned by a user (calls, follow-ups, sessions) this person may see. */
export function userScope(sa: SalesActor, field = "userId"): Record<string, unknown> {
    return sa.visibleUserIds === null ? {} : { [field]: { in: sa.visibleUserIds } };
}

/** People this person can see in reports and assign leads to. */
export async function visibleTeam(sa: SalesActor) {
    return loadTeam(sa.visibleUserIds ? sa.visibleUserIds.join(",") : "*");
}

const loadTeam = cache(async (ids: string) =>
    db.user.findMany({
        where: { role: { in: ["admin", "user"] }, ...(ids === "*" ? {} : { id: { in: ids.split(",") } }) },
        select: { id: true, name: true, email: true, role: true, salesRole: true, managerId: true, phone: true },
        orderBy: { name: "asc" },
    }));

export async function canAssignTo(sa: SalesActor, userId: string | null): Promise<boolean> {
    if (userId === null) return canManage(sa);
    if (sa.role === "EXECUTIVE") return userId === sa.id;
    if (sa.visibleUserIds && !sa.visibleUserIds.includes(userId)) return false;
    const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    return !!u && (u.role === "admin" || u.role === "user");
}

/** The lead if this person may see it, else null. */
export async function findLeadFor(sa: SalesActor, leadId: string) {
    return db.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(sa)] } });
}

export async function requireLead(sa: SalesActor, leadId: string) {
    const lead = await findLeadFor(sa, leadId);
    if (!lead) throw new CrmError("Lead not found, or it is not assigned to you.");
    return lead;
}

// ------------------------------------------------------------------ history

export async function addActivity(tx: Tx, leadId: string, userId: string | null, type: string, summary: string, data?: Prisma.InputJsonValue) {
    await tx.leadActivity.create({ data: { leadId, userId, type, summary: summary.slice(0, 500), data } });
}

/** Changes a lead's status with history; no-op when unchanged. */
export async function setStatus(tx: Tx, lead: { id: string; status: string }, to: LeadStatus, userId: string | null, note?: string | null) {
    if (lead.status === to) return;
    await tx.lead.update({
        where: { id: lead.id },
        data: {
            status: to,
            ...(to === "CONVERTED" ? { convertedAt: new Date() } : lead.status === "CONVERTED" ? { convertedAt: null } : {}),
            ...(to === "LOST" ? { lostReason: note || null } : {}),
        },
    });
    await tx.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: lead.status, toStatus: to, changedById: userId, note: note || null } });
    await addActivity(tx, lead.id, userId, "STATUS", `Status: ${STATUS_INFO[lead.status as LeadStatus]?.label ?? lead.status} → ${STATUS_INFO[to].label}${note ? ` (${note})` : ""}`, { from: lead.status, to });
}

/** Reassigns a lead with history. A NEW lead becomes ASSIGNED once it has someone. */
export async function setAssignee(tx: Tx, lead: { id: string; status: string; assignedToId: string | null }, toUserId: string | null, byUserId: string) {
    if (lead.assignedToId === toUserId) return;
    await tx.lead.update({ where: { id: lead.id }, data: { assignedToId: toUserId, assignedAt: toUserId ? new Date() : null } });
    await tx.leadAssignment.create({ data: { leadId: lead.id, fromUserId: lead.assignedToId, toUserId, assignedById: byUserId } });
    const to = toUserId ? await tx.user.findUnique({ where: { id: toUserId }, select: { name: true } }) : null;
    await addActivity(tx, lead.id, byUserId, "ASSIGNED", to ? `Assigned to ${to.name}` : "Unassigned", { from: lead.assignedToId, to: toUserId });
    // open follow-ups move with the lead
    await tx.leadFollowUp.updateMany({ where: { leadId: lead.id, status: "PENDING" }, data: { assignedToId: toUserId } });
    if (toUserId && lead.status === "NEW") await setStatus(tx, lead, "ASSIGNED", byUserId);
    if (!toUserId && lead.status === "ASSIGNED") await setStatus(tx, lead, "NEW", byUserId);
}

/** Lead.nextContactDate mirrors the earliest pending follow-up (the old Reminders page reads it). */
export async function syncNextFollowUp(tx: Tx, leadId: string) {
    const next = await tx.leadFollowUp.findFirst({ where: { leadId, status: "PENDING" }, orderBy: { dueAt: "asc" }, select: { dueAt: true } });
    await tx.lead.update({ where: { id: leadId }, data: { nextContactDate: next?.dueAt ?? null } });
}

// ------------------------------------------------------------------ calls

export interface IncomingCall {
    externalId: string;
    userId: string | null;
    phone: string;
    direction: "OUTGOING" | "INCOMING";
    status: string;
    startedAt: Date;
    answeredAt?: Date | null;
    endedAt?: Date | null;
    durationSec: number | null;
    talkSec: number | null;
    recordingUrl?: string | null;
    leadId?: string | null; // when the provider echoes back the lead we dialled
}

/**
 * Leads for each phone key. When a number belongs to several leads, the one
 * assigned to `preferUserId` wins, then the most recently updated.
 */
export async function matchLeadsByPhone(keys: string[], preferUserId: string | null): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const unique = [...new Set(keys.filter((k) => k.length === 10))];
    if (!unique.length) return out;
    const rows = await db.$queryRaw<Array<{ id: string; k: string; assignedToId: string | null; updatedAt: Date }>>`
        SELECT l."id", k.k, l."assignedToId", l."updatedAt"
        FROM "public"."Lead" l
        CROSS JOIN LATERAL unnest(ARRAY[l."phone", l."altPhone", l."whatsapp"]) AS p(num)
        CROSS JOIN LATERAL (SELECT right(regexp_replace(coalesce(p.num, ''), '\\D', '', 'g'), 10) AS k) k
        WHERE k.k = ANY(${unique}::text[])`;
    const best = new Map<string, { id: string; score: number; at: number }>();
    for (const r of rows) {
        const score = preferUserId && r.assignedToId === preferUserId ? 1 : 0;
        const cur = best.get(r.k);
        if (!cur || score > cur.score || (score === cur.score && r.updatedAt.getTime() > cur.at)) best.set(r.k, { id: r.id, score, at: r.updatedAt.getTime() });
    }
    for (const [k, v] of best) out.set(k, v.id);
    return out;
}

/**
 * Stores verified calls (DEVICE / PROVIDER). Re-sending the same call is safe:
 * rows are keyed by (source, externalId) and updated in place. Connected calls
 * mark the lead contacted.
 */
export async function ingestCalls(source: "DEVICE" | "PROVIDER", provider: string | null, calls: IncomingCall[]) {
    let created = 0, updated = 0;
    const byUser = new Map<string | null, IncomingCall[]>();
    for (const c of calls) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c]);
    for (const [userId, group] of byUser) {
        const matches = await matchLeadsByPhone(group.map((c) => phoneKey(c.phone)), userId);
        for (const c of group) {
            const key = phoneKey(c.phone);
            let leadId = c.leadId ?? matches.get(key) ?? null;
            if (leadId && c.leadId) {
                const exists = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
                if (!exists) leadId = matches.get(key) ?? null;
            }
            const data = {
                leadId, userId, phone: c.phone.slice(0, 40), phoneKey: key, direction: c.direction, status: c.status, source, provider,
                startedAt: c.startedAt, answeredAt: c.answeredAt ?? null, endedAt: c.endedAt ?? null,
                durationSec: c.durationSec, talkSec: c.talkSec, recordingUrl: c.recordingUrl ?? null,
            };
            const before = await db.callLog.findUnique({ where: { source_externalId: { source, externalId: c.externalId } }, select: { id: true } });
            await db.$transaction(async (tx) => {
                if (before) await tx.callLog.update({ where: { id: before.id }, data });
                else await tx.callLog.create({ data: { ...data, externalId: c.externalId } });
                if (!leadId || before) return;
                const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true, status: true, lastContacted: true } });
                if (!lead) return;
                const connected = c.status === "CONNECTED";
                const label = `${c.direction === "INCOMING" ? "Incoming" : "Outgoing"} call · ${c.status.replace("_", " ").toLowerCase()}${connected && c.talkSec ? ` · ${Math.round(c.talkSec / 60)}m talk` : ""}`;
                await addActivity(tx, lead.id, userId, "CALL", label, { source, status: c.status, talkSec: c.talkSec });
                if (connected) {
                    if (!lead.lastContacted || lead.lastContacted < c.startedAt) await tx.lead.update({ where: { id: lead.id }, data: { lastContacted: c.startedAt } });
                    if (lead.status === "NEW" || lead.status === "ASSIGNED") await setStatus(tx, lead, "CONTACTED", userId, "First connected call");
                }
            });
            if (before) updated++; else created++;
        }
    }
    return { created, updated };
}

export { leadCode, isOpenStatus };
