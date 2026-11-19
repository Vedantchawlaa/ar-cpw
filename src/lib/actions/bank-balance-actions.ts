"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { businessNow } from "@/lib/staff-attendance";
import { netBetween, withGaps, type CheckWithGap, type DayTransaction } from "@/lib/daily-balance";

// Daily check of bank + cash balances. Stored in the WeeklyBankBalance table
// (from when this was a Monday check), one row per business day: `weekStart`
// holds that day at 00:00 UTC.

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

const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dateToDay = (d: Date) => d.toISOString().slice(0, 10);

/** Transactions from `fromDay` to today, keyed by business (India) day. */
async function transactionsSince(fromDay: string): Promise<DayTransaction[]> {
    const rows = await db.transaction.findMany({
        // a day early, so times late in the evening (UTC) still land on the right India day
        where: { date: { gte: new Date(dayToDate(fromDay).getTime() - 86400000) } },
        select: { date: true, type: true, amount: true },
    });
    return rows.map((t) => ({ day: businessNow(t.date).date, type: t.type, amount: t.amount }));
}

export interface BalanceCheckRow extends CheckWithGap {
    id: string;
    notes: string | null;
}

/** The latest checks, newest first, each with the net since the check before it and the gap. */
export async function getBalanceCheckHistory(limit = 14): Promise<BalanceCheckRow[]> {
    if (!(await isAdminUser())) return [];
    try {
        // One extra, so the oldest shown check still has a previous check to compare with
        const rows = await db.weeklyBankBalance.findMany({ orderBy: { weekStart: "desc" }, take: limit + 1 });
        if (rows.length === 0) return [];
        const checks = rows.map((r) => ({ id: r.id, notes: r.notes, day: dateToDay(r.weekStart), bankBalance: r.bankBalance, cashBalance: r.cashBalance }));
        const transactions = await transactionsSince(checks[checks.length - 1].day);
        const extra = new Map(checks.map((c) => [c.day, { id: c.id, notes: c.notes }]));
        return withGaps(checks, transactions)
            .slice(0, limit)
            .map((c) => ({ ...c, ...extra.get(c.day)! }));
    } catch (e) {
        console.error("Failed to load balance checks:", e);
        return [];
    }
}

/**
 * Keeps Cash Reconciliation in step: the month's "Actual Cash in Hand" is the latest
 * daily check's bank + cash. A month with no record yet opens with last month's actual.
 */
async function syncMonthEnding(day: string, total: number) {
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7)) - 1; // 0-11, as MonthlyBalance stores it
    const prev = await db.monthlyBalance.findUnique({
        where: { month_year: { month: month === 0 ? 11 : month - 1, year: month === 0 ? year - 1 : year } },
    });
    await db.monthlyBalance.upsert({
        where: { month_year: { month, year } },
        update: { endingBalance: total },
        create: { month, year, startingBalance: prev?.endingBalance ?? 0, endingBalance: total },
    });
}

/** Saves today's bank + cash balances (replaces today's entry if there is one). */
export async function saveDailyBalanceCheck(bankBalance: number, cashBalance: number, notes?: string) {
    if (!(await isAdminUser())) return { success: false as const, error: "Unauthorized" };
    if (!Number.isFinite(bankBalance) || !Number.isFinite(cashBalance) || bankBalance < 0 || cashBalance < 0) {
        return { success: false as const, error: "Enter valid balances." };
    }

    const today = businessNow().date;
    try {
        const previous = await db.weeklyBankBalance.findFirst({ where: { weekStart: { lt: dayToDate(today) } }, orderBy: { weekStart: "desc" } });
        const previousDay = previous ? dateToDay(previous.weekStart) : null;
        const recordedNet = netBetween(await transactionsSince(previousDay ?? today), previousDay, today);

        await db.weeklyBankBalance.upsert({
            where: { weekStart: dayToDate(today) },
            update: { bankBalance, cashBalance, recordedNet, notes: notes || null },
            create: { weekStart: dayToDate(today), bankBalance, cashBalance, recordedNet, notes: notes || null },
        });
        await syncMonthEnding(today, Math.round((bankBalance + cashBalance) * 100) / 100);

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        return { success: true as const, recordedNet };
    } catch (e) {
        console.error("Failed to save daily balance check:", e);
        return { success: false as const, error: "Failed to save." };
    }
}
