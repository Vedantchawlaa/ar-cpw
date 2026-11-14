"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import db from "@/lib/db";
import {
    DEFAULT_FUND_BUCKETS,
    computeAllocation,
    validateBuckets,
    type AllocationSummary,
    type FundBucketConfig,
} from "@/lib/fund-allocation";

// Financial data: admin only, same rule as the monthly balance widget.
async function isAdminUser() {
    const session = await auth();
    if (!session?.user) return false;
    if ((session.user as { role?: string }).role === "admin") return true;
    if (session.user.email) {
        const dbUser = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true } });
        return dbUser?.role === "admin";
    }
    return false;
}

async function loadBuckets(): Promise<FundBucketConfig[]> {
    let rows = await db.fundBucket.findMany({ orderBy: { position: "asc" } });
    if (rows.length === 0) {
        // First use: seed the default 55/12/10/10/7/5/1 split. Fixed ids so two
        // simultaneous first loads cannot seed it twice.
        await db.fundBucket.createMany({
            data: DEFAULT_FUND_BUCKETS.map((b, position) => ({ ...b, id: `default-${position}`, position })),
            skipDuplicates: true,
        });
        rows = await db.fundBucket.findMany({ orderBy: { position: "asc" } });
    }
    return rows.map((r) => ({ id: r.id, name: r.name, percent: r.percent, kind: r.kind as FundBucketConfig["kind"], categories: r.categories }));
}

export type FundAllocationResult =
    | { ok: true; summary: AllocationSummary; month: number; year: number }
    | { ok: false; error: string };

export async function getFundAllocation(month: number, year: number): Promise<FundAllocationResult | null> {
    if (!(await isAdminUser())) return null;
    try {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        // Sequential on purpose: keeps this card to one pooled connection at a time.
        const buckets = await loadBuckets();
        const totals = await db.transaction.groupBy({
            by: ["type", "category"],
            where: { date: { gte: start, lte: end } },
            _sum: { amount: true },
        });
        const transfers = await db.fundTransfer.findMany({ where: { month, year }, select: { bucketId: true, amount: true } });
        const transactions = totals.map((t) => ({ type: t.type, category: t.category, amount: t._sum.amount ?? 0 }));
        const transferMap = Object.fromEntries(transfers.map((t) => [t.bucketId, t.amount]));
        return { ok: true, month, year, summary: computeAllocation(buckets, transactions, transferMap) };
    } catch (error) {
        console.error("Failed to load fund allocation:", error);
        return { ok: false, error: "Fund allocation is not set up yet. Run prisma/sql/2026-11-13-fund-allocation.sql on the database." };
    }
}

export interface BucketTransactionRow {
    id: string;
    date: string; // ISO
    category: string;
    description: string | null;
    amount: number;
}

export type BucketDetailResult =
    | { ok: true; spent: BucketTransactionRow[]; moved: { amount: number; updatedAt: string } | null }
    | { ok: false; error: string };

/** The expenses counted against a bucket in a month, plus the amount marked as moved. */
export async function getBucketTransactions(bucketId: string, month: number, year: number): Promise<BucketDetailResult> {
    if (!(await isAdminUser())) return { ok: false, error: "Only admins can view this." };
    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(year)) return { ok: false, error: "Invalid month." };
    try {
        const bucket = await db.fundBucket.findUnique({ where: { id: bucketId } });
        if (!bucket) return { ok: false, error: "Bucket not found." };
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        const spent = bucket.kind === "SPEND" && bucket.categories.length > 0
            ? await db.transaction.findMany({
                where: { type: "EXPENSE", category: { in: bucket.categories }, date: { gte: start, lte: end } },
                orderBy: { date: "desc" },
                select: { id: true, date: true, category: true, description: true, amount: true },
            })
            : [];
        const transfer = await db.fundTransfer.findUnique({ where: { bucketId_month_year: { bucketId, month, year } } });
        return {
            ok: true,
            spent: spent.map((t) => ({ ...t, date: t.date.toISOString() })),
            moved: transfer ? { amount: transfer.amount, updatedAt: transfer.updatedAt.toISOString() } : null,
        };
    } catch (error) {
        console.error("Failed to load bucket transactions:", error);
        return { ok: false, error: "Could not load transactions." };
    }
}

const BucketSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    percent: z.coerce.number(),
    kind: z.enum(["SPEND", "SAVE"]),
    categories: z.array(z.string().trim().min(1).max(60)).max(50),
});

export async function saveFundBuckets(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!(await isAdminUser())) return { ok: false, error: "Only admins can change the fund split." };
    const parsed = z.array(BucketSchema).max(20).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Some bucket details are invalid." };
    const buckets = parsed.data.map((b) => ({ ...b, categories: b.kind === "SAVE" ? [] : [...new Set(b.categories)] }));
    const problem = validateBuckets(buckets);
    if (problem) return { ok: false, error: problem };

    try {
        await db.$transaction(async (tx) => {
            const keepIds = buckets.map((b) => b.id).filter((id): id is string => !!id);
            // Removing a bucket also removes its transfer history (cascade)
            await tx.fundBucket.deleteMany({ where: { id: { notIn: keepIds } } });
            for (const [position, b] of buckets.entries()) {
                const data = { name: b.name, percent: b.percent, kind: b.kind, categories: b.categories, position };
                if (b.id) await tx.fundBucket.update({ where: { id: b.id }, data });
                else await tx.fundBucket.create({ data });
            }
        });
    } catch (error) {
        console.error("Failed to save fund buckets:", error);
        return { ok: false, error: "Could not save the fund split." };
    }
    revalidatePath("/transactions");
    return { ok: true };
}

/** Records how much was moved into a SAVE bucket's account for a month. amount null clears it. */
export async function setFundTransfer(bucketId: string, month: number, year: number, amount: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!(await isAdminUser())) return { ok: false, error: "Only admins can record transfers." };
    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(year)) return { ok: false, error: "Invalid month." };
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return { ok: false, error: "Enter a valid amount." };

    try {
        const where = { bucketId_month_year: { bucketId, month, year } };
        if (amount === null || amount === 0) await db.fundTransfer.deleteMany({ where: { bucketId, month, year } });
        else await db.fundTransfer.upsert({ where, create: { bucketId, month, year, amount }, update: { amount } });
    } catch (error) {
        console.error("Failed to record fund transfer:", error);
        return { ok: false, error: "Could not save the transfer." };
    }
    revalidatePath("/transactions");
    return { ok: true };
}
