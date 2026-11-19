"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

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

export async function getMonthlyBalance(month: number, year: number) {
    if (!await isAdminUser()) return null;

    try {
        // Try to get the current month's record
        let balance = await (db as any).monthlyBalance.findUnique({
            where: { month_year: { month, year } },
        });

        // Actual Cash in Hand follows the month's latest daily balance check (bank + cash)
        // when that check was saved after the month's record was last changed.
        const latestCheck = await db.weeklyBankBalance.findFirst({
            where: { weekStart: { gte: new Date(Date.UTC(year, month, 1)), lt: new Date(Date.UTC(year, month + 1, 1)) } },
            orderBy: { weekStart: "desc" },
        });
        if (latestCheck) {
            const total = Math.round((latestCheck.bankBalance + latestCheck.cashBalance) * 100) / 100;
            if (!balance || (balance.endingBalance !== total && latestCheck.updatedAt > balance.updatedAt)) {
                const prev = balance ? null : await (db as any).monthlyBalance.findUnique({
                    where: { month_year: { month: month === 0 ? 11 : month - 1, year: month === 0 ? year - 1 : year } },
                });
                balance = await (db as any).monthlyBalance.upsert({
                    where: { month_year: { month, year } },
                    update: { endingBalance: total },
                    create: { month, year, startingBalance: prev?.endingBalance ?? 0, endingBalance: total },
                });
            }
        }

        // If record exists and has a manually set starting balance, return as-is
        if (balance) return balance;

        // No record yet — carry forward the previous month's ending balance
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;

        const prevBalance = await (db as any).monthlyBalance.findUnique({
            where: { month_year: { month: prevMonth, year: prevYear } },
        });

        // Return a virtual record with the carried-forward starting balance
        return {
            id: null,
            month,
            year,
            startingBalance: prevBalance?.endingBalance ?? 0,
            endingBalance: null,
            carriedForward: prevBalance?.endingBalance != null,
        };
    } catch (error) {
        console.error("Failed to get monthly balance:", error);
        return null;
    }
}


export async function upsertMonthlyBalance(
    month: number,
    year: number,
    startingBalance: number,
    endingBalance: number | null
) {
    if (!await isAdminUser()) return { success: false, error: "Unauthorized" };

    try {
        await (db as any).monthlyBalance.upsert({
            where: { month_year: { month, year } },
            update: { startingBalance, endingBalance },
            create: { month, year, startingBalance, endingBalance },
        });
        revalidatePath("/transactions");
        return { success: true };
    } catch (error) {
        console.error("Failed to upsert monthly balance:", error);
        return { success: false, error: "Failed to save balance" };
    }
}
