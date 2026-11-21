"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import db from "@/lib/db";
import { toActor } from "@/lib/services/types";
import {
    CrmError, addActivity, canAssignTo, canManage, getSalesActor, leadScope, requireLead, requireSalesActor, setAssignee, setStatus,
    syncNextFollowUp, type SalesActor,
} from "@/lib/services/crm-service";
import { leadFilterWhere, leadListSelect, myFollowUpAlert, type LeadFilters } from "@/lib/services/crm-queries";
import { startExotelCall, telephonyStatus } from "@/lib/services/telephony-service";
import {
    CALL_STATUSES, LEAD_STATUSES, PRIORITIES, STATUS_INFO, isValidPhone, istDay, istStart, leadCode, mapImportRow, phoneKey,
    type LeadImportRow, type WorkStatus,
} from "@/lib/sales-crm";

const CRM_BASE = "/sales-funnel/call-manager/leads";

type Failure = { ok: false; error: string; duplicate?: { id: string; code: string; name: string } };
type Result<T = object> = ({ ok: true } & T) | Failure;

async function actor(): Promise<SalesActor> {
    const session = await auth();
    if (!session?.user) throw new CrmError("Please sign in again.");
    return requireSalesActor(toActor(session.user));
}

/** Runs an action with the caller's CRM identity; turns known errors into messages. */
async function run<R extends { ok: true } | Failure>(fn: (sa: SalesActor) => Promise<R>): Promise<R | Failure> {
    try {
        const result = await fn(await actor());
        if (result.ok) revalidatePath(CRM_BASE, "layout");
        return result;
    } catch (e) {
        if (e instanceof CrmError) return { ok: false, error: e.message };
        if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Please check the form." };
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "That was already saved (duplicate)." };
        console.error("CRM action failed:", e);
        return { ok: false, error: "Something went wrong. Please try again." };
    }
}

const fail = (error: string) => ({ ok: false as const, error });

// ------------------------------------------------------------------ leads

const optPhone = z.string().trim().max(40).nullish().transform((v) => v || null).refine((v) => !v || isValidPhone(v), "Enter a 10-digit number");
const LeadSchema = z.object({
    name: z.string().trim().min(1, "Customer name is required").max(200),
    phone: z.string().trim().max(40).refine(isValidPhone, "Enter a valid 10-digit mobile number"),
    altPhone: optPhone,
    whatsapp: optPhone,
    email: z.string().trim().max(200).nullish().transform((v) => v || null).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
    city: z.string().trim().max(200).default(""),
    address: z.string().trim().max(2000).nullish().transform((v) => v || null),
    source: z.string().trim().max(100).nullish().transform((v) => v || null),
    productInterest: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
    budget: z.coerce.number().min(0, "Budget cannot be negative").max(1e9).default(0),
    priority: z.enum(PRIORITIES).default("Warm"),
    status: z.enum(LEAD_STATUSES).optional(),
    assignedToId: z.string().nullish().transform((v) => v || null),
    notes: z.string().trim().max(5000).nullish().transform((v) => v || null),
    nextFollowUpAt: z.string().nullish().transform((v) => (v ? new Date(v) : null)).refine((d) => !d || !isNaN(d.getTime()), "Invalid follow-up date"),
});
export type LeadFormInput = z.input<typeof LeadSchema>;

/** Leads (in the caller's scope or not) sharing any of these numbers. */
async function duplicatesOf(phones: Array<string | null>, exceptId?: string) {
    const keys = [...new Set(phones.map(phoneKey).filter((k) => k.length === 10))];
    if (!keys.length) return [];
    return db.$queryRaw<Array<{ id: string; leadNo: number; name: string }>>`
        SELECT DISTINCT l."id", l."leadNo", l."name" FROM "public"."Lead" l
        WHERE (right(regexp_replace(l."phone", '\\D', '', 'g'), 10) = ANY(${keys}::text[])
            OR right(regexp_replace(coalesce(l."altPhone", ''), '\\D', '', 'g'), 10) = ANY(${keys}::text[]))
          AND l."id" <> ${exceptId ?? ""}
        LIMIT 3`;
}

export async function saveLead(raw: LeadFormInput, id?: string, opts: { force?: boolean } = {}): Promise<Result<{ id: string }>> {
    return run(async (sa) => {
        const input = LeadSchema.parse(raw);
        const existing = id ? await requireLead(sa, id) : null;

        if (!opts.force) {
            const dupes = await duplicatesOf([input.phone, input.altPhone], id);
            if (dupes.length) {
                const d = dupes[0];
                return { ok: false, error: `${leadCode(d.leadNo)} ${d.name} already has this number. Save anyway?`, duplicate: { id: d.id, code: leadCode(d.leadNo), name: d.name } };
            }
        }

        // assignment: executives keep leads on themselves; managers/admins choose
        let assignTo = existing ? existing.assignedToId : sa.role === "EXECUTIVE" ? sa.id : input.assignedToId;
        if (existing && canManage(sa) && input.assignedToId !== existing.assignedToId) assignTo = input.assignedToId;
        if (assignTo !== (existing?.assignedToId ?? null) && !(await canAssignTo(sa, assignTo))) return fail("You cannot assign leads to that person.");

        const data = {
            name: input.name, phone: input.phone, altPhone: input.altPhone, whatsapp: input.whatsapp, email: input.email, city: input.city,
            address: input.address, source: input.source, productInterest: input.productInterest, expectedOrderValue: input.budget,
            type: input.priority, description: input.notes,
        };

        const leadId = await db.$transaction(async (tx) => {
            if (!existing) {
                const lead = await tx.lead.create({ data: { ...data, status: "NEW", userId: sa.id, lastContacted: null } });
                await tx.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: null, toStatus: "NEW", changedById: sa.id } });
                await addActivity(tx, lead.id, sa.id, "CREATED", `Lead created${input.source ? ` (source: ${input.source})` : ""}`);
                if (assignTo) await setAssignee(tx, lead, assignTo, sa.id);
                const status = input.status && input.status !== "NEW" ? input.status : null;
                if (status) await setStatus(tx, { id: lead.id, status: assignTo ? "ASSIGNED" : "NEW" }, status, sa.id);
                if (input.nextFollowUpAt) {
                    await tx.leadFollowUp.create({ data: { leadId: lead.id, dueAt: input.nextFollowUpAt, assignedToId: assignTo, createdById: sa.id, notes: "First follow-up" } });
                    await syncNextFollowUp(tx, lead.id);
                }
                return lead.id;
            }
            const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => JSON.stringify(data[k]) !== JSON.stringify((existing as Record<string, unknown>)[k]));
            await tx.lead.update({ where: { id: existing.id }, data });
            if (changed.length) await addActivity(tx, existing.id, sa.id, "UPDATED", `Updated ${changed.map((k) => FIELD_LABEL[k] ?? k).join(", ")}`);
            if (assignTo !== existing.assignedToId) await setAssignee(tx, existing, assignTo, sa.id);
            if (input.status && input.status !== existing.status) {
                const fresh = await tx.lead.findUniqueOrThrow({ where: { id: existing.id }, select: { id: true, status: true } });
                await setStatus(tx, fresh, input.status, sa.id);
            }
            return existing.id;
        });
        return { ok: true, id: leadId };
    });
}

const FIELD_LABEL: Record<string, string> = {
    name: "name", phone: "mobile", altPhone: "alternate mobile", whatsapp: "WhatsApp", email: "email", city: "city", address: "address",
    source: "source", productInterest: "product interest", expectedOrderValue: "budget", type: "priority", description: "notes",
};

export async function deleteLeads(ids: string[]): Promise<Result<{ deleted: number }>> {
    return run(async (sa) => {
        if (!canManage(sa)) return fail("Only an admin or sales manager can delete leads.");
        const list = z.array(z.string()).min(1).max(500).parse(ids);
        const res = await db.lead.deleteMany({ where: { AND: [{ id: { in: list } }, leadScope(sa)] } });
        return { ok: true, deleted: res.count };
    });
}

export async function assignLeads(ids: string[], userId: string | null): Promise<Result<{ updated: number }>> {
    return run(async (sa) => {
        if (!canManage(sa)) return fail("Only an admin or sales manager can assign leads.");
        const list = z.array(z.string()).min(1).max(1000).parse(ids);
        if (!(await canAssignTo(sa, userId))) return fail("You cannot assign leads to that person.");
        const leads = await db.lead.findMany({ where: { AND: [{ id: { in: list } }, leadScope(sa)] }, select: { id: true, status: true, assignedToId: true } });
        for (const lead of leads) await db.$transaction((tx) => setAssignee(tx, lead, userId, sa.id));
        return { ok: true, updated: leads.length };
    });
}

export async function changeLeadStatus(id: string, status: string, note?: string): Promise<Result> {
    return run(async (sa) => {
        const to = z.enum(LEAD_STATUSES).parse(status);
        const lead = await requireLead(sa, id);
        if (to === "LOST" && !note?.trim()) return fail("Write why the lead was lost.");
        await db.$transaction((tx) => setStatus(tx, lead, to, sa.id, note?.trim().slice(0, 500) || null));
        return { ok: true };
    });
}

export async function addLeadNote(id: string, text: string): Promise<Result> {
    return run(async (sa) => {
        const note = z.string().trim().min(1, "Write a note").max(3000).parse(text);
        await requireLead(sa, id);
        await db.$transaction((tx) => addActivity(tx, id, sa.id, "NOTE", note));
        return { ok: true };
    });
}

// ------------------------------------------------------------------ import / export

export async function importLeads(rows: Array<Record<string, unknown>>, defaultAssigneeId: string | null): Promise<Result<{ created: number; skipped: Array<{ row: number; reason: string }> }>> {
    return run(async (sa) => {
        if (!canManage(sa)) return fail("Only an admin or sales manager can import leads.");
        if (!Array.isArray(rows) || rows.length === 0) return fail("The file has no rows.");
        if (rows.length > 2000) return fail("Import at most 2000 rows at a time.");
        if (defaultAssigneeId && !(await canAssignTo(sa, defaultAssigneeId))) return fail("You cannot assign leads to that person.");

        const team = await db.user.findMany({ where: { role: { in: ["admin", "user"] }, ...(sa.visibleUserIds ? { id: { in: sa.visibleUserIds } } : {}) }, select: { id: true, name: true, email: true } });
        const findUser = (s: string) => team.find((u) => u.email.toLowerCase() === s.toLowerCase() || u.name.toLowerCase() === s.toLowerCase());

        const skipped: Array<{ row: number; reason: string }> = [];
        const good: Array<{ row: number; data: LeadImportRow; assignTo: string | null }> = [];
        const seen = new Set<string>();
        rows.forEach((r, i) => {
            const m = mapImportRow(r);
            if (!m.ok) return skipped.push({ row: i + 2, reason: m.error });
            const key = phoneKey(m.row.phone);
            if (seen.has(key)) return skipped.push({ row: i + 2, reason: "Same mobile number appears earlier in the file" });
            seen.add(key);
            let assignTo = defaultAssigneeId;
            if (m.row.assignee) {
                const u = findUser(m.row.assignee);
                if (!u) return skipped.push({ row: i + 2, reason: `No team member "${m.row.assignee}"` });
                assignTo = u.id;
            }
            good.push({ row: i + 2, data: m.row, assignTo });
        });

        // numbers already on a lead
        const existingKeys = new Set<string>();
        const keyList = good.map((g) => phoneKey(g.data.phone));
        const hits = keyList.length ? await db.$queryRaw<Array<{ k: string }>>`
            SELECT DISTINCT right(regexp_replace(n, '\\D', '', 'g'), 10) AS k
            FROM "public"."Lead" l CROSS JOIN LATERAL unnest(ARRAY[l."phone", l."altPhone"]) AS n
            WHERE n IS NOT NULL AND right(regexp_replace(n, '\\D', '', 'g'), 10) = ANY(${keyList}::text[])` : [];
        for (const h of hits) existingKeys.add(h.k);

        const toCreate = good.filter((g) => {
            if (existingKeys.has(phoneKey(g.data.phone))) { skipped.push({ row: g.row, reason: "A lead with this mobile number already exists" }); return false; }
            return true;
        });

        let created = 0;
        for (let i = 0; i < toCreate.length; i += 200) {
            const chunk = toCreate.slice(i, i + 200);
            await db.$transaction(async (tx) => {
                const leads = await tx.lead.createManyAndReturn({
                    data: chunk.map(({ data: d, assignTo }) => ({
                        name: d.name, phone: d.phone, altPhone: d.altPhone, whatsapp: d.whatsapp, email: d.email, city: d.city, address: d.address,
                        source: d.source, productInterest: d.productInterest, expectedOrderValue: d.budget, type: d.priority, description: d.notes,
                        status: d.status ?? (assignTo ? "ASSIGNED" : "NEW"), userId: sa.id, assignedToId: assignTo, assignedAt: assignTo ? new Date() : null,
                        lastContacted: null, convertedAt: d.status === "CONVERTED" ? new Date() : null,
                    })),
                    select: { id: true, status: true, assignedToId: true },
                });
                await tx.leadStatusHistory.createMany({ data: leads.map((l) => ({ leadId: l.id, fromStatus: null, toStatus: l.status, changedById: sa.id, note: "Imported" })) });
                await tx.leadActivity.createMany({ data: leads.map((l) => ({ leadId: l.id, userId: sa.id, type: "IMPORTED", summary: "Imported from spreadsheet" })) });
                const assigns = leads.filter((l) => l.assignedToId);
                if (assigns.length) await tx.leadAssignment.createMany({ data: assigns.map((l) => ({ leadId: l.id, fromUserId: null, toUserId: l.assignedToId, assignedById: sa.id })) });
                const fus = leads.map((l, j) => ({ l, day: chunk[j].data.nextFollowUp })).filter((x) => x.day);
                if (fus.length) {
                    // due at 11:00 India time on that day
                    await tx.leadFollowUp.createMany({ data: fus.map(({ l, day }) => ({ leadId: l.id, dueAt: new Date(istStart(day!).getTime() + 11 * 3600000), assignedToId: l.assignedToId, createdById: sa.id, notes: "From import" })) });
                    for (const { l, day } of fus) await tx.lead.update({ where: { id: l.id }, data: { nextContactDate: new Date(istStart(day!).getTime() + 11 * 3600000) } });
                }
                created += leads.length;
            }, { timeout: 60000 });
        }
        skipped.sort((a, b) => a.row - b.row);
        return { ok: true, created, skipped };
    });
}

/** Leads matching the table's filters, flattened for a spreadsheet. */
export async function exportLeads(filters: LeadFilters): Promise<Result<{ rows: Array<Record<string, string | number>> }>> {
    return run(async (sa) => {
        if (!canManage(sa)) return fail("Only an admin or sales manager can export leads.");
        const leads = await db.lead.findMany({ where: leadFilterWhere(sa, filters), orderBy: { leadNo: "asc" }, take: 20000, select: leadListSelect });
        const d = (x: Date | null) => (x ? new Date(x).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");
        return {
            ok: true,
            rows: leads.map((l) => ({
                "Lead ID": leadCode(l.leadNo), "Customer Name": l.name, "Mobile Number": l.phone, "Alternate Mobile": l.altPhone ?? "", WhatsApp: l.whatsapp ?? "",
                Email: l.email ?? "", City: l.city, Address: l.address ?? "", "Lead Source": l.source ?? "", "Product Interest": l.productInterest.join(", "),
                "Estimated Budget": l.expectedOrderValue, "Assigned To": l.assignedTo?.name ?? "", Status: STATUS_INFO[l.status as keyof typeof STATUS_INFO]?.label ?? l.status,
                Priority: l.type, "Last Contacted": d(l.lastContacted), "Next Follow-up": d(l.nextContactDate), Notes: l.description ?? "", Created: d(l.createdAt),
            })),
        };
    });
}

// ------------------------------------------------------------------ follow-ups

const FollowUpSchema = z.object({
    dueAt: z.string().min(1, "Pick a date and time").transform((v) => new Date(v)).refine((d) => !isNaN(d.getTime()), "Invalid date"),
    notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
    assignedToId: z.string().nullish().transform((v) => v || null),
});

export async function scheduleFollowUp(leadId: string, raw: z.input<typeof FollowUpSchema>): Promise<Result> {
    return run(async (sa) => {
        const input = FollowUpSchema.parse(raw);
        const lead = await requireLead(sa, leadId);
        const to = input.assignedToId ?? lead.assignedToId ?? sa.id;
        if (to !== sa.id && !(await canAssignTo(sa, to))) return fail("You cannot give follow-ups to that person.");
        await db.$transaction(async (tx) => {
            await tx.leadFollowUp.create({ data: { leadId, dueAt: input.dueAt, notes: input.notes, assignedToId: to, createdById: sa.id } });
            await addActivity(tx, leadId, sa.id, "FOLLOW_UP", `Follow-up scheduled for ${fmt(input.dueAt)}${input.notes ? `: ${input.notes}` : ""}`);
            await syncNextFollowUp(tx, leadId);
        });
        return { ok: true };
    });
}

const fmt = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function requireFollowUp(sa: SalesActor, id: string) {
    const fu = await db.leadFollowUp.findFirst({ where: { id, lead: leadScope(sa) } });
    if (!fu) throw new CrmError("Follow-up not found.");
    if (sa.role === "EXECUTIVE" && fu.assignedToId && fu.assignedToId !== sa.id) throw new CrmError("This follow-up belongs to someone else.");
    return fu;
}

export async function completeFollowUp(id: string, outcome: string, next?: { dueAt: string; notes?: string } | null): Promise<Result> {
    return run(async (sa) => {
        const fu = await requireFollowUp(sa, id);
        if (fu.status !== "PENDING") return fail("This follow-up is already closed.");
        const text = z.string().trim().min(1, "Write what happened").max(2000).parse(outcome);
        const nextDue = next?.dueAt ? new Date(next.dueAt) : null;
        if (nextDue && isNaN(nextDue.getTime())) return fail("Invalid next follow-up date");
        await db.$transaction(async (tx) => {
            await tx.leadFollowUp.update({ where: { id }, data: { status: "DONE", outcome: text, completedAt: new Date(), completedById: sa.id } });
            await addActivity(tx, fu.leadId, sa.id, "FOLLOW_UP", `Follow-up done: ${text}`);
            if (nextDue) {
                await tx.leadFollowUp.create({ data: { leadId: fu.leadId, dueAt: nextDue, notes: next?.notes?.trim() || null, assignedToId: fu.assignedToId ?? sa.id, createdById: sa.id } });
                await addActivity(tx, fu.leadId, sa.id, "FOLLOW_UP", `Next follow-up ${fmt(nextDue)}`);
            }
            await syncNextFollowUp(tx, fu.leadId);
        });
        return { ok: true };
    });
}

export async function rescheduleFollowUp(id: string, dueAt: string, reason?: string): Promise<Result> {
    return run(async (sa) => {
        const fu = await requireFollowUp(sa, id);
        if (fu.status !== "PENDING") return fail("This follow-up is already closed.");
        const due = new Date(dueAt);
        if (isNaN(due.getTime())) return fail("Pick a valid date and time.");
        await db.$transaction(async (tx) => {
            // the old one stays in history as RESCHEDULED, so missed dates are never hidden
            await tx.leadFollowUp.update({ where: { id }, data: { status: "RESCHEDULED", outcome: reason?.trim() || `Moved to ${fmt(due)}`, completedAt: new Date(), completedById: sa.id } });
            await tx.leadFollowUp.create({ data: { leadId: fu.leadId, dueAt: due, notes: fu.notes, assignedToId: fu.assignedToId, createdById: sa.id } });
            await addActivity(tx, fu.leadId, sa.id, "FOLLOW_UP", `Follow-up moved from ${fmt(fu.dueAt)} to ${fmt(due)}${reason?.trim() ? `: ${reason.trim()}` : ""}`);
            await syncNextFollowUp(tx, fu.leadId);
        });
        return { ok: true };
    });
}

export async function cancelFollowUp(id: string, reason: string): Promise<Result> {
    return run(async (sa) => {
        const fu = await requireFollowUp(sa, id);
        if (fu.status !== "PENDING") return fail("This follow-up is already closed.");
        const text = z.string().trim().min(1, "Write why it is cancelled").max(500).parse(reason);
        await db.$transaction(async (tx) => {
            await tx.leadFollowUp.update({ where: { id }, data: { status: "CANCELLED", outcome: text, completedAt: new Date(), completedById: sa.id } });
            await addActivity(tx, fu.leadId, sa.id, "FOLLOW_UP", `Follow-up cancelled: ${text}`);
            await syncNextFollowUp(tx, fu.leadId);
        });
        return { ok: true };
    });
}

// ------------------------------------------------------------------ calls

/**
 * "Call" button. With Exotel configured the provider rings the salesperson and
 * then the customer, and reports the result itself. Otherwise the browser opens
 * the phone dialer; only an attempt is written to the timeline, never a call.
 */
export async function dialLead(leadId: string, which: "phone" | "altPhone" | "whatsapp" = "phone"): Promise<Result<{ mode: "provider" | "dialer"; tel: string }>> {
    return run(async (sa) => {
        const lead = await requireLead(sa, leadId);
        const number = (which === "altPhone" ? lead.altPhone : which === "whatsapp" ? lead.whatsapp : lead.phone) || lead.phone;
        const tel = number.replace(/[^\d+]/g, "");
        const t = telephonyStatus();
        if (t.clickToCall === "exotel") {
            const me = await db.user.findUnique({ where: { id: sa.id }, select: { phone: true } });
            if (me?.phone && isValidPhone(me.phone)) {
                const res = await startExotelCall({ agentPhone: me.phone, customerPhone: number, userId: sa.id, leadId });
                if (!res.ok) return fail(res.error);
                await db.$transaction((tx) => addActivity(tx, leadId, sa.id, "CALL_DIALED", "Call requested through Exotel (result arrives from Exotel)", { sid: res.sid }));
                return { ok: true, mode: "provider", tel };
            }
        }
        await db.$transaction((tx) => addActivity(tx, leadId, sa.id, "CALL_DIALED", "Opened the phone dialer (not a call record)"));
        return { ok: true, mode: "dialer", tel };
    });
}

const ManualCallSchema = z.object({
    direction: z.enum(["OUTGOING", "INCOMING"]),
    status: z.enum(CALL_STATUSES),
    at: z.string().optional().transform((v) => (v ? new Date(v) : new Date())).refine((d) => !isNaN(d.getTime()) && d.getTime() <= Date.now() + 60000, "Call time cannot be in the future"),
    notes: z.string().trim().max(3000).nullish().transform((v) => v || null),
    nextFollowUpAt: z.string().nullish().transform((v) => (v ? new Date(v) : null)),
    newStatus: z.enum(LEAD_STATUSES).nullish(),
});

/** A call written by the salesperson (e.g. from a personal phone). Shown as self-reported; never counts talk time. */
export async function logManualCall(leadId: string, raw: z.input<typeof ManualCallSchema>): Promise<Result> {
    return run(async (sa) => {
        const input = ManualCallSchema.parse(raw);
        const lead = await requireLead(sa, leadId);
        await db.$transaction(async (tx) => {
            await tx.callLog.create({
                data: {
                    leadId, userId: sa.id, phone: lead.phone, phoneKey: phoneKey(lead.phone), direction: input.direction, status: input.status, source: "MANUAL",
                    startedAt: input.at, notes: input.notes, nextFollowUpAt: input.nextFollowUpAt, durationSec: null, talkSec: null,
                },
            });
            await addActivity(tx, leadId, sa.id, "CALL", `Call logged by hand (self-reported) · ${input.status.replace("_", " ").toLowerCase()}${input.notes ? `: ${input.notes}` : ""}`);
            if (input.nextFollowUpAt && !isNaN(input.nextFollowUpAt.getTime())) {
                await tx.leadFollowUp.create({ data: { leadId, dueAt: input.nextFollowUpAt, assignedToId: lead.assignedToId ?? sa.id, createdById: sa.id, notes: input.notes } });
                await syncNextFollowUp(tx, leadId);
            }
            if (input.newStatus) await setStatus(tx, lead, input.newStatus, sa.id);
        });
        return { ok: true };
    });
}

/** Notes + next follow-up on any call the person can see (verified calls keep their numbers untouched). */
export async function updateCallNotes(callId: string, notes: string, nextFollowUpAt?: string | null): Promise<Result> {
    return run(async (sa) => {
        const call = await db.callLog.findUnique({ where: { id: callId } });
        if (!call || (sa.visibleUserIds && (!call.userId || !sa.visibleUserIds.includes(call.userId)))) return fail("Call not found.");
        if (sa.role === "EXECUTIVE" && call.userId !== sa.id) return fail("You can only add notes to your own calls.");
        const next = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
        if (next && isNaN(next.getTime())) return fail("Invalid follow-up date");
        await db.$transaction(async (tx) => {
            await tx.callLog.update({ where: { id: callId }, data: { notes: notes.trim().slice(0, 3000) || null, nextFollowUpAt: next } });
            if (call.leadId) {
                if (notes.trim()) await addActivity(tx, call.leadId, sa.id, "NOTE", `Call note: ${notes.trim().slice(0, 400)}`);
                if (next && (!call.nextFollowUpAt || call.nextFollowUpAt.getTime() !== next.getTime())) {
                    const lead = await tx.lead.findUnique({ where: { id: call.leadId }, select: { assignedToId: true } });
                    await tx.leadFollowUp.create({ data: { leadId: call.leadId, dueAt: next, assignedToId: lead?.assignedToId ?? sa.id, createdById: sa.id, notes: notes.trim() || "After call" } });
                    await syncNextFollowUp(tx, call.leadId);
                }
            }
        });
        return { ok: true };
    });
}

// ------------------------------------------------------------------ work status

/** Closes a session left open from an earlier day at the end of that day. */
async function closeStaleSession(tx: Prisma.TransactionClient, userId: string) {
    const open = await tx.workSession.findFirst({ where: { userId, endedAt: null } });
    if (!open) return null;
    if (istDay(open.startedAt) === istDay(new Date())) return open;
    const lastEvent = await tx.workStatusEvent.findFirst({ where: { sessionId: open.id }, orderBy: { startedAt: "desc" } });
    const endOfThatDay = istStart(istDay(new Date(open.startedAt.getTime() + 86400000)));
    const closeAt = new Date(Math.max(open.startedAt.getTime(), Math.min(endOfThatDay.getTime(), lastEvent?.startedAt.getTime() ?? open.startedAt.getTime())));
    await tx.workStatusEvent.updateMany({ where: { userId, endedAt: null }, data: { endedAt: closeAt } });
    await tx.workSession.update({ where: { id: open.id }, data: { endedAt: closeAt, endNote: "End Work was not pressed; closed automatically at the last status change" } });
    return null;
}

export async function startWork(): Promise<Result> {
    return run(async (sa) => {
        await db.$transaction(async (tx) => {
            const open = await closeStaleSession(tx, sa.id);
            if (open) return;
            const s = await tx.workSession.create({ data: { userId: sa.id } });
            await tx.workStatusEvent.create({ data: { userId: sa.id, sessionId: s.id, status: "AVAILABLE", startedAt: s.startedAt } });
        });
        return { ok: true };
    });
}

export async function endWork(): Promise<Result> {
    return run(async (sa) => {
        const n = new Date();
        await db.$transaction(async (tx) => {
            await tx.workStatusEvent.updateMany({ where: { userId: sa.id, endedAt: null }, data: { endedAt: n } });
            await tx.workSession.updateMany({ where: { userId: sa.id, endedAt: null }, data: { endedAt: n } });
        });
        return { ok: true };
    });
}

/** Available / On Call / Break / Lunch / Meeting. Start Work first. */
export async function setWorkStatus(status: string): Promise<Result> {
    return run(async (sa) => {
        const to = z.enum(["AVAILABLE", "ON_CALL", "BREAK", "LUNCH", "MEETING"]).parse(status) as WorkStatus;
        const n = new Date();
        const err = await db.$transaction(async (tx) => {
            const open = await closeStaleSession(tx, sa.id);
            if (!open) return "Press Start Work first.";
            const cur = await tx.workStatusEvent.findFirst({ where: { userId: sa.id, endedAt: null } });
            if (cur?.status === to) return null;
            await tx.workStatusEvent.updateMany({ where: { userId: sa.id, endedAt: null }, data: { endedAt: n } });
            await tx.workStatusEvent.create({ data: { userId: sa.id, sessionId: open.id, status: to, startedAt: n } });
            return null;
        });
        return err ? fail(err) : { ok: true };
    });
}

// ------------------------------------------------------------------ team setup (admin)

const MemberSchema = z.object({
    salesRole: z.enum(["MANAGER", "EXECUTIVE"]),
    managerId: z.string().nullish().transform((v) => v || null),
    phone: optPhone,
});

export async function updateSalesMember(userId: string, raw: z.input<typeof MemberSchema>): Promise<Result> {
    return run(async (sa) => {
        if (sa.role !== "ADMIN") return fail("Only an admin can change sales roles.");
        const input = MemberSchema.parse(raw);
        const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!user || (user.role !== "admin" && user.role !== "user")) return fail("Team member not found.");
        if (input.managerId === userId) return fail("A person cannot report to themselves.");
        if (input.managerId) {
            const m = await db.user.findUnique({ where: { id: input.managerId }, select: { salesRole: true, role: true } });
            if (!m || m.role !== "user" || m.salesRole !== "MANAGER") return fail("Pick a sales manager.");
        }
        if (input.salesRole === "MANAGER" && input.managerId) return fail("A sales manager does not report to another manager here.");
        await db.$transaction(async (tx) => {
            await tx.user.update({ where: { id: userId }, data: { salesRole: user.role === "admin" ? null : input.salesRole, managerId: input.managerId, phone: input.phone } });
            // someone stepping down from manager releases their team
            if (input.salesRole !== "MANAGER") await tx.user.updateMany({ where: { managerId: userId }, data: { managerId: null } });
        });
        return { ok: true };
    });
}

// ------------------------------------------------------------------ badge

/** Overdue + due-today follow-ups for the signed-in person; null when not a CRM user. */
export async function getMyFollowUpBadge(): Promise<{ overdue: number; today: number } | null> {
    try {
        const session = await auth();
        if (!session?.user) return null;
        const sa = await getSalesActor(toActor(session.user));
        return sa ? await myFollowUpAlert(sa.id) : null;
    } catch {
        return null;
    }
}
