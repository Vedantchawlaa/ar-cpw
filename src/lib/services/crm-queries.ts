import { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { leadScope, visibleTeam, type SalesActor } from "./crm-service";
import {
    LEAD_STATUSES, asStatus, asPriority, callStats, dailyCalls, istDay, istStart, addDays, pct, workSummary, isBreakStatus,
    type DateRange, type LeadStatus, type WorkStatus,
} from "@/lib/sales-crm";

// Reads for the Lead Management pages. Every query is narrowed by the
// caller's scope (crm-service.leadScope / userScope); nothing here trusts the UI.

const and = (...w: Prisma.LeadWhereInput[]): Prisma.LeadWhereInput => ({ AND: w.filter((x) => Object.keys(x).length) });

/** Restrict to one salesperson when the caller may see them. */
function narrowUser(sa: SalesActor, userId: string | null | undefined): string[] | null {
    if (!userId) return sa.visibleUserIds;
    if (sa.visibleUserIds && !sa.visibleUserIds.includes(userId)) return ["__none__"];
    return [userId];
}

const now = () => new Date();
const todayEnd = () => istStart(addDays(istDay(new Date()), 1));

// ------------------------------------------------------------------ dashboard

export async function getDashboard(sa: SalesActor, range: DateRange, userId?: string | null) {
    const users = narrowUser(sa, userId);
    const userIn = users ? { in: users } : undefined;
    const leadWhere = and(leadScope(sa), userId ? { assignedToId: userId } : {});
    const inRange = { gte: range.start, lt: range.end };

    // Kept to a handful of queries: the pooled connection limit is small and every round trip is slow.
    const [createdByStatus, assigned, statusMoves, converted, pendingDue, calls, pipeline] = await Promise.all([
        db.lead.groupBy({ by: ["status"], where: and(leadWhere, { createdAt: inRange }), _count: { _all: true } }),
        db.leadAssignment.findMany({ where: { createdAt: inRange, toUserId: userIn ?? { not: null }, lead: leadScope(sa) }, distinct: ["leadId"], select: { leadId: true } }),
        db.leadStatusHistory.findMany({ where: { createdAt: inRange, toStatus: { in: ["CONTACTED", "INTERESTED", "LOST"] }, lead: leadWhere }, select: { leadId: true, toStatus: true } }),
        db.lead.count({ where: and(leadWhere, { convertedAt: inRange, status: "CONVERTED" }) }),
        db.leadFollowUp.findMany({ where: { status: "PENDING", dueAt: { lt: todayEnd() }, ...(userIn ? { assignedToId: userIn } : {}), lead: leadScope(sa) }, select: { dueAt: true } }),
        db.callLog.findMany({ where: { startedAt: inRange, ...(userIn ? { userId: userIn } : {}) }, select: { userId: true, leadId: true, direction: true, status: true, source: true, startedAt: true, durationSec: true, talkSec: true } }),
        db.lead.groupBy({ by: ["status"], where: leadWhere, _count: { _all: true } }),
    ]);
    const created = createdByStatus.reduce((n, r) => n + r._count._all, 0);
    const createdStillNew = createdByStatus.find((r) => r.status === "NEW")?._count._all ?? 0;
    const t = now().getTime();
    const overdue = pendingDue.filter((f) => f.dueAt.getTime() < t).length;
    const dueToday = pendingDue.length - overdue;

    const distinct = (s: string) => new Set(statusMoves.filter((m) => m.toStatus === s).map((m) => m.leadId));
    const contacted = distinct("CONTACTED");
    for (const c of calls) if (c.leadId && c.status === "CONNECTED" && c.source !== "MANUAL") contacted.add(c.leadId);

    return {
        leads: {
            total: created,
            new: createdStillNew,
            assigned: assigned.length,
            contacted: contacted.size,
            interested: distinct("INTERESTED").size,
            converted,
            lost: distinct("LOST").size,
        },
        followUps: { dueToday, overdue },
        calls: callStats(calls),
        daily: dailyCalls(calls, range.from, range.to),
        pipeline: LEAD_STATUSES.map((s) => ({ status: s, count: pipeline.find((p) => p.status === s)?._count._all ?? 0 })),
    };
}

// ------------------------------------------------------------------ leads table

export interface LeadFilters {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string; // user id, or "none"
    source?: string;
    product?: string;
    followUp?: string; // overdue | today | none
    from?: string; // created on/after (India day)
    to?: string;
    sort?: string; // created | updated | followup | name | budget
    page?: number;
}

export const PAGE_SIZE = 50;

export function leadFilterWhere(sa: SalesActor, f: LeadFilters): Prisma.LeadWhereInput {
    const parts: Prisma.LeadWhereInput[] = [leadScope(sa)];
    const q = f.q?.trim();
    if (q) {
        const code = q.match(/^l-?(\d+)$/i);
        const digits = q.replace(/\D/g, "");
        parts.push({
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { altPhone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
                ...(code ? [{ leadNo: Number(code[1]) }] : /^\d{1,7}$/.test(q) ? [{ leadNo: Number(q) }] : []),
            ],
        });
    }
    const status = asStatus(f.status);
    if (status) parts.push({ status });
    else if (f.status === "open") parts.push({ status: { notIn: ["CONVERTED", "LOST"] } });
    const priority = asPriority(f.priority);
    if (priority) parts.push({ type: priority });
    if (f.assignee === "none") parts.push({ assignedToId: null });
    else if (f.assignee) parts.push({ assignedToId: f.assignee });
    if (f.source) parts.push({ source: f.source });
    if (f.product) parts.push({ productInterest: { has: f.product } });
    if (f.followUp === "overdue") parts.push({ followUps: { some: { status: "PENDING", dueAt: { lt: now() } } } });
    else if (f.followUp === "today") parts.push({ followUps: { some: { status: "PENDING", dueAt: { gte: istStart(istDay(now())), lt: todayEnd() } } } });
    else if (f.followUp === "none") parts.push({ followUps: { none: { status: "PENDING" } }, status: { notIn: ["CONVERTED", "LOST"] } });
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (f.from && day.test(f.from)) parts.push({ createdAt: { gte: istStart(f.from) } });
    if (f.to && day.test(f.to)) parts.push({ createdAt: { lt: istStart(addDays(f.to, 1)) } });
    return and(...parts);
}

const ORDER: Record<string, Prisma.LeadOrderByWithRelationInput[]> = {
    created: [{ createdAt: "desc" }],
    updated: [{ updatedAt: "desc" }],
    followup: [{ nextContactDate: { sort: "asc", nulls: "last" } }],
    name: [{ name: "asc" }],
    budget: [{ expectedOrderValue: "desc" }],
};

export const leadListSelect = {
    id: true, leadNo: true, name: true, phone: true, altPhone: true, whatsapp: true, email: true, city: true, address: true, source: true,
    productInterest: true, expectedOrderValue: true, type: true, status: true, lastContacted: true, nextContactDate: true,
    description: true, createdAt: true, assignedToId: true, assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

export async function getLeadsPage(sa: SalesActor, f: LeadFilters) {
    const where = leadFilterWhere(sa, f);
    const page = Math.max(1, f.page || 1);
    const [rows, total] = await Promise.all([
        db.lead.findMany({ where, orderBy: [...(ORDER[f.sort || "created"] ?? ORDER.created), { leadNo: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: leadListSelect }),
        db.lead.count({ where }),
    ]);
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type LeadListRow = Awaited<ReturnType<typeof getLeadsPage>>["rows"][number];

/** Distinct sources in use, for the filter. */
export async function leadSources(sa: SalesActor) {
    const rows = await db.lead.findMany({ where: and(leadScope(sa), { source: { not: null } }), distinct: ["source"], select: { source: true } });
    return rows.map((r) => r.source!).filter(Boolean).sort();
}

// ------------------------------------------------------------------ lead detail

export async function getLeadDetail(sa: SalesActor, id: string) {
    const lead = await db.lead.findFirst({
        where: and({ id }, leadScope(sa)),
        include: {
            assignedTo: { select: { id: true, name: true, phone: true } },
            user: { select: { id: true, name: true } },
            calls: { orderBy: { startedAt: "desc" }, take: 200 },
            followUps: { orderBy: { dueAt: "desc" } },
            statusHistory: { orderBy: { createdAt: "desc" } },
            activities: { orderBy: { createdAt: "desc" }, take: 300 },
            quotations: { orderBy: { date: "desc" }, select: { id: true, number: true, date: true, total: true, status: true } },
        },
    });
    if (!lead) return null;
    const ids = new Set<string>();
    for (const a of lead.activities) if (a.userId) ids.add(a.userId);
    for (const c of lead.calls) if (c.userId) ids.add(c.userId);
    for (const f of lead.followUps) { if (f.assignedToId) ids.add(f.assignedToId); if (f.createdById) ids.add(f.createdById); if (f.completedById) ids.add(f.completedById); }
    for (const s of lead.statusHistory) if (s.changedById) ids.add(s.changedById);
    const people = await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return { lead, names: Object.fromEntries(people.map((p) => [p.id, p.name])) as Record<string, string> };
}

// ------------------------------------------------------------------ follow-ups

export async function getFollowUps(sa: SalesActor, view: string, userId?: string | null) {
    const users = narrowUser(sa, userId);
    const base: Prisma.LeadFollowUpWhereInput = { lead: leadScope(sa), ...(users ? { assignedToId: { in: users } } : {}) };
    const t0 = istStart(istDay(now()));
    const where: Prisma.LeadFollowUpWhereInput =
        view === "overdue" ? { ...base, status: "PENDING", dueAt: { lt: now() } }
            : view === "upcoming" ? { ...base, status: "PENDING", dueAt: { gte: todayEnd() } }
                : view === "done" ? { ...base, status: { in: ["DONE", "CANCELLED", "RESCHEDULED"] }, updatedAt: { gte: istStart(addDays(istDay(now()), -30)) } }
                    : { ...base, status: "PENDING", dueAt: { gte: t0, lt: todayEnd() } };
    const [rows, counts] = await Promise.all([
        db.leadFollowUp.findMany({
            where,
            orderBy: view === "done" ? { updatedAt: "desc" } : { dueAt: "asc" },
            take: 300,
            include: { lead: { select: { id: true, leadNo: true, name: true, phone: true, status: true, type: true } }, assignedTo: { select: { id: true, name: true } } },
        }),
        Promise.all([
            db.leadFollowUp.count({ where: { ...base, status: "PENDING", dueAt: { lt: now() } } }),
            db.leadFollowUp.count({ where: { ...base, status: "PENDING", dueAt: { gte: now(), lt: todayEnd() } } }),
            db.leadFollowUp.count({ where: { ...base, status: "PENDING", dueAt: { gte: todayEnd() } } }),
        ]),
    ]);
    return { rows, counts: { overdue: counts[0], today: counts[1], upcoming: counts[2] } };
}

/** Pending follow-ups needing attention for the signed-in person (sidebar badge, banner). */
export async function myFollowUpAlert(userId: string) {
    const due = await db.leadFollowUp.findMany({ where: { assignedToId: userId, status: "PENDING", dueAt: { lt: todayEnd() } }, select: { dueAt: true } });
    const t = now().getTime();
    const overdue = due.filter((f) => f.dueAt.getTime() < t).length;
    return { overdue, today: due.length - overdue };
}

// ------------------------------------------------------------------ call logs

export async function getCallLogs(sa: SalesActor, range: DateRange, f: { userId?: string | null; status?: string; direction?: string; source?: string; q?: string; page?: number }) {
    const users = narrowUser(sa, f.userId);
    const where: Prisma.CallLogWhereInput = {
        startedAt: { gte: range.start, lt: range.end },
        ...(users ? { userId: { in: users } } : {}),
        ...(f.status ? { status: f.status } : {}),
        ...(f.direction ? { direction: f.direction } : {}),
        ...(f.source === "verified" ? { source: { in: ["DEVICE", "PROVIDER"] } } : f.source === "manual" ? { source: "MANUAL" } : {}),
        ...(f.q?.trim() ? { OR: [{ phone: { contains: f.q.replace(/\D/g, "") || f.q } }, { lead: { name: { contains: f.q.trim(), mode: "insensitive" } } }] } : {}),
    };
    const page = Math.max(1, f.page || 1);
    const [rows, total, all] = await Promise.all([
        db.callLog.findMany({
            where, orderBy: { startedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
            include: { lead: { select: { id: true, leadNo: true, name: true } }, user: { select: { id: true, name: true } } },
        }),
        db.callLog.count({ where }),
        db.callLog.findMany({ where, select: { userId: true, direction: true, status: true, source: true, startedAt: true, durationSec: true, talkSec: true } }),
    ]);
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), stats: callStats(all) };
}

// ------------------------------------------------------------------ team performance + work status

export async function getTeamPerformance(sa: SalesActor, range: DateRange) {
    const team = await visibleTeam(sa);
    const ids = team.map((t) => t.id);
    const inRange = { gte: range.start, lt: range.end };
    const [byStatus, convertedRange, calls, fuDone, pendingFu, sessions, events, current] = await Promise.all([
        db.lead.groupBy({ by: ["assignedToId", "status"], where: { assignedToId: { in: ids } }, _count: { _all: true } }),
        db.lead.groupBy({ by: ["assignedToId"], where: { assignedToId: { in: ids }, status: "CONVERTED", convertedAt: inRange }, _count: { _all: true } }),
        db.callLog.findMany({ where: { userId: { in: ids }, startedAt: inRange }, select: { userId: true, direction: true, status: true, source: true, startedAt: true, durationSec: true, talkSec: true } }),
        db.leadFollowUp.groupBy({ by: ["completedById"], where: { completedById: { in: ids }, status: "DONE", completedAt: inRange }, _count: { _all: true } }),
        db.leadFollowUp.findMany({ where: { assignedToId: { in: ids }, status: "PENDING" }, select: { assignedToId: true, dueAt: true } }),
        db.workSession.findMany({ where: { userId: { in: ids }, startedAt: { lt: range.end }, OR: [{ endedAt: null }, { endedAt: { gt: range.start } }] }, select: { userId: true, startedAt: true, endedAt: true } }),
        db.workStatusEvent.findMany({ where: { userId: { in: ids }, startedAt: { lt: range.end }, OR: [{ endedAt: null }, { endedAt: { gt: range.start } }] }, select: { userId: true, status: true, startedAt: true, endedAt: true }, orderBy: { startedAt: "asc" } }),
        currentStatuses(ids),
    ]);
    const count = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string, id: string) => (rows.find((r) => r[key] === id)?._count._all ?? 0);
    const t = now().getTime();

    const people = team.map((u) => {
        const mine = calls.filter((c) => c.userId === u.id);
        const s = callStats(mine);
        const done = count(fuDone, "completedById", u.id);
        const myPending = pendingFu.filter((f) => f.assignedToId === u.id);
        const pending = myPending.length;
        const overdueCount = myPending.filter((f) => f.dueAt.getTime() < t).length;
        const myLeads = byStatus.filter((r) => r.assignedToId === u.id);
        const assignedTotal = myLeads.reduce((n, r) => n + r._count._all, 0);
        const convTotal = myLeads.find((r) => r.status === "CONVERTED")?._count._all ?? 0;
        return {
            id: u.id, name: u.name, salesRole: u.role === "admin" ? "ADMIN" : u.salesRole === "MANAGER" ? "MANAGER" : "EXECUTIVE",
            assignedLeads: assignedTotal,
            calls: s,
            followUpsDone: done,
            followUpsPending: pending,
            followUpsOverdue: overdueCount,
            followUpRate: pct(done, done + overdueCount),
            convertedInRange: count(convertedRange, "assignedToId", u.id),
            convertedTotal: convTotal,
            conversionPct: pct(convTotal, assignedTotal),
            work: workSummary(sessions.filter((x) => x.userId === u.id), events.filter((e) => e.userId === u.id), range.start, range.end),
            current: current.get(u.id) ?? { status: "OFFLINE" as const, since: null, sessionStartedAt: null, stale: false },
            daily: dailyCalls(mine, range.from, range.to),
        };
    });
    return { people, daily: dailyCalls(calls, range.from, range.to) };
}

export type TeamMemberPerformance = Awaited<ReturnType<typeof getTeamPerformance>>["people"][number];

export interface CurrentStatus { status: WorkStatus | "OFFLINE"; since: Date | null; sessionStartedAt: Date | null; stale: boolean }

/** Live status per user from the open session / event. A session left open from an earlier day is flagged stale. */
export async function currentStatuses(ids: string[]): Promise<Map<string, CurrentStatus>> {
    const [open, events] = await Promise.all([
        db.workSession.findMany({ where: { userId: { in: ids }, endedAt: null }, select: { userId: true, startedAt: true } }),
        db.workStatusEvent.findMany({ where: { userId: { in: ids }, endedAt: null }, select: { userId: true, status: true, startedAt: true } }),
    ]);
    const today = istDay(now());
    const out = new Map<string, CurrentStatus>();
    for (const s of open) {
        const e = events.find((x) => x.userId === s.userId);
        out.set(s.userId, { status: (e?.status as WorkStatus) ?? "AVAILABLE", since: e?.startedAt ?? s.startedAt, sessionStartedAt: s.startedAt, stale: istDay(s.startedAt) !== today });
    }
    return out;
}

/** One person's status history for a day (India), newest last. */
export async function workTimeline(sa: SalesActor, userId: string, day: string) {
    if (sa.visibleUserIds && !sa.visibleUserIds.includes(userId)) return [];
    const start = istStart(day), end = istStart(addDays(day, 1));
    const [sessions, events] = await Promise.all([
        db.workSession.findMany({ where: { userId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gt: start } }] }, orderBy: { startedAt: "asc" } }),
        db.workStatusEvent.findMany({ where: { userId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gt: start } }] }, orderBy: { startedAt: "asc" } }),
    ]);
    const rows: Array<{ at: Date; label: string; status: string; until: Date | null }> = [];
    for (const s of sessions) {
        rows.push({ at: s.startedAt, label: "Started work", status: "START", until: null });
        if (s.endedAt) rows.push({ at: s.endedAt, label: s.endNote || "Ended work", status: "END", until: null });
    }
    for (const e of events) rows.push({ at: e.startedAt, label: e.status, status: e.status, until: e.endedAt });
    return rows.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.status === "START" ? -1 : 1));
}

/** The signed-in person's own state for the status bar. */
export async function myWorkState(userId: string) {
    const day = istDay(now());
    const start = istStart(day), end = istStart(addDays(day, 1));
    // Today's rows include anything still open (even from an earlier day), so the live status comes from the same two queries.
    const [sessions, events] = await Promise.all([
        db.workSession.findMany({ where: { userId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gt: start } }] }, select: { startedAt: true, endedAt: true } }),
        db.workStatusEvent.findMany({ where: { userId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gt: start } }] }, select: { status: true, startedAt: true, endedAt: true } }),
    ]);
    const open = sessions.find((s) => !s.endedAt);
    const openEvent = events.find((e) => !e.endedAt);
    const c: CurrentStatus = open
        ? { status: (openEvent?.status as WorkStatus) ?? "AVAILABLE", since: openEvent?.startedAt ?? open.startedAt, sessionStartedAt: open.startedAt, stale: istDay(open.startedAt) !== day }
        : { status: "OFFLINE", since: null, sessionStartedAt: null, stale: false };
    return { ...c, today: workSummary(sessions, events, start, end), onBreak: isBreakStatus(c.status) };
}

export { type LeadStatus };
