"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getMondayOf } from "@/lib/date-utils";

async function isAdminUser() {
    const session = await auth();
    if (!session?.user) return false;
    if ((session.user as any).role === 'admin') return true;
    if (session.user.email) {
        const dbUser = await (db as any).user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });
        return dbUser?.role === 'admin';
    }
    return false;
}


/** Get this week's bank balance record (null if not entered yet) */
export async function getThisWeekBankBalance() {
    if (!await isAdminUser()) return null;
    const monday = getMondayOf(new Date());
    try {
        return await (db as any).weeklyBankBalance.findUnique({
            where: { weekStart: monday },
        });
    } catch (e) {
        return null;
    }
}

/** Get the last N weeks of bank balance history */
export async function getWeeklyBankHistory(weeks = 12) {
    if (!await isAdminUser()) return [];
    try {
        return await (db as any).weeklyBankBalance.findMany({
            orderBy: { weekStart: "desc" },
            take: weeks,
        });
    } catch (e) {
        return [];
    }
}

/** Save this week's bank balance + compute recorded net for the week */
export async function saveWeeklyBankBalance(bankBalance: number, cashBalance: number, notes?: string) {
    if (!await isAdminUser()) return { success: false, error: "Unauthorized" };

    const monday = getMondayOf(new Date());
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);

    try {
        // Compute recorded net (income - expenses) for this week
        const weekTransactions = await (db as any).transaction.findMany({
            where: { date: { gte: monday, lte: sunday } },
        });

        const income = weekTransactions
            .filter((t: any) => t.type === "INCOME")
            .reduce((s: number, t: any) => s + t.amount, 0);

        const expenses = weekTransactions
            .filter((t: any) => t.type === "EXPENSE")
            .reduce((s: number, t: any) => s + t.amount, 0);

        const recordedNet = income - expenses;

        await (db as any).weeklyBankBalance.upsert({
            where: { weekStart: monday },
            update: { bankBalance, cashBalance, recordedNet, notes },
            create: { weekStart: monday, bankBalance, cashBalance, recordedNet, notes },
        });

        revalidatePath("/transactions");
        return { success: true, recordedNet };
    } catch (e: any) {
        console.error("Failed to save weekly bank balance:", e);
        return { success: false, error: e?.message || "Failed to save." };
    }
}
