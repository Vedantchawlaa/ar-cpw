"use server";

import { z } from "zod";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const TransactionSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.coerce.number().positive("Amount must be positive"),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional(),
    date: z.coerce.date(),
});

export async function addTransaction(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'admin') {
        return "Unauthorized: Admin access required.";
    }

    const validatedFields = TransactionSchema.safeParse({
        type: formData.get("type"),
        amount: formData.get("amount"),
        category: formData.get("category"),
        description: formData.get("description"),
        date: formData.get("date"),
    });

    if (!validatedFields.success) {
        return "Invalid input. Please check your details.";
    }

    const { type, amount, category, description, date } = validatedFields.data;

    try {
        await db.transaction.create({
            data: {
                type,
                amount,
                category,
                description,
                date,
                userId: session.user.id,
            },
        });

        revalidatePath("/transactions");
        return "success";
    } catch (error) {
        console.error("Failed to add transaction:", error);
        return "Failed to add transaction.";
    }
}

export async function getTransactions(limit = 20, dateFilter?: any) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'admin') {
        return [];
    }

    try {
        const transactions = await db.transaction.findMany({
            where: dateFilter ? { date: dateFilter } : {},
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

export async function getPnLStats(dateFilter?: any) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'admin') {
        return { income: 0, expenses: 0, netProfit: 0 };
    }

    try {
        const transactions = await db.transaction.findMany({
            where: dateFilter ? { date: dateFilter } : {},
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
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'admin') {
        return "Unauthorized";
    }

    const validatedFields = TransactionSchema.safeParse({
        type: formData.get("type"),
        amount: formData.get("amount"),
        category: formData.get("category"),
        description: formData.get("description"),
        date: formData.get("date"),
    });

    if (!validatedFields.success) {
        return "Invalid input";
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
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'admin') {
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
