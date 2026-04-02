"use server";

import { z } from "zod";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

async function isAdminUser() {
    const session = await auth();
    if (!session?.user) return false;
    if ((session.user as any).role === 'admin') return true;
    if (session.user.email) {
        const dbUser = await db.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });
        return dbUser?.role === 'admin';
    }
    return false;
}

const TransactionSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.coerce.number().positive("Amount must be positive"),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional(),
    date: z.coerce.date(),
    emailId: z.string().optional(),
});

export async function addTransaction(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!await isAdminUser()) {
        return "Unauthorized: Admin access required.";
    }

    const validatedFields = TransactionSchema.safeParse({
        type: formData.get("type"),
        amount: formData.get("amount"),
        category: formData.get("category"),
        description: formData.get("description")?.toString() || undefined,
        date: formData.get("date"),
        emailId: formData.get("emailId")?.toString() || undefined,
    });

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.issues.map((err: any) => err.message).join(", ");
        return `Invalid input: ${errorMessages}`;
    }

    const { type, amount, category, description, date, emailId } = validatedFields.data;

    try {
        await db.transaction.create({
            data: {
                type,
                amount,
                category,
                description,
                date,
                userId: session?.user?.id,
                emailId,
            },
        });

        revalidatePath("/transactions");
        return "success";
    } catch (error) {
        console.error("Failed to add transaction:", error);
        return "Failed to add transaction.";
    }
}

export async function getTransactions(limit = 20, dateFilter?: any, search?: string) {
    if (!await isAdminUser()) {
        return [];
    }

    try {
        const where: any = {};
        if (dateFilter) where.date = dateFilter;
        if (search) {
            const searchAmount = parseFloat(search);
            where.OR = [
                { category: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
            if (!isNaN(searchAmount)) {
                where.OR.push({ amount: searchAmount });
            }
        }

        const transactions = await db.transaction.findMany({
            where,
            orderBy: { date: "desc" },
            take: limit,
            include: {
                user: {
                    select: { name: true },
                },
            },
        });
        return transactions;
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return [];
    }
}

export async function getPnLStats(dateFilter?: any, search?: string) {
    if (!await isAdminUser()) {
        return { income: 0, expenses: 0, netProfit: 0 };
    }

    try {
        const where: any = {};
        if (dateFilter) where.date = dateFilter;
        if (search) {
            const searchAmount = parseFloat(search);
            where.OR = [
                { category: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
            if (!isNaN(searchAmount)) {
                where.OR.push({ amount: searchAmount });
            }
        }

        const transactions = await db.transaction.findMany({
            where,
        });

        const income = transactions
            .filter((t: any) => t.type === "INCOME")
            .reduce((sum: number, t: any) => sum + t.amount, 0);

        const expenses = transactions
            .filter((t: any) => t.type === "EXPENSE")
            .reduce((sum: number, t: any) => sum + t.amount, 0);

        return {
            income,
            expenses,
            netProfit: income - expenses,
        };
    } catch (error) {
        console.error("Failed to calculate P&L:", error);
        return { income: 0, expenses: 0, netProfit: 0 };
    }
}

export async function updateTransaction(id: string, prevState: any, formData: FormData) {
    if (!await isAdminUser()) {
        return "Unauthorized";
    }

    const validatedFields = TransactionSchema.safeParse({
        type: formData.get("type"),
        amount: formData.get("amount"),
        category: formData.get("category"),
        description: formData.get("description")?.toString() || undefined,
        date: formData.get("date"),
    });

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.issues.map((err: any) => err.message).join(", ");
        return `Invalid input: ${errorMessages}`;
    }

    const { type, amount, category, description, date } = validatedFields.data;

    try {
        await db.transaction.update({
            where: { id },
            data: { type, amount, category, description, date },
        });

        revalidatePath("/transactions");
        return "success";
    } catch (error) {
        console.error("Update failed:", error);
        return "Failed to update transaction";
    }
}

export async function deleteTransaction(id: string) {
    if (!await isAdminUser()) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db.transaction.delete({
            where: { id },
        });

        revalidatePath("/transactions");
        return { success: true };
    } catch (error) {
        console.error("Delete failed:", error);
        return { success: false, error: "Failed to delete" };
    }
}
