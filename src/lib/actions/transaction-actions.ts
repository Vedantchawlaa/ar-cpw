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

const ImportRowSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.coerce.number().positive("Amount must be positive"),
    category: z.string().trim().min(1, "Category is required").max(60),
    description: z.string().trim().max(500).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

// Saves rows reviewed in the "Import File" preview (CSV / Excel / PDF upload)
export async function importTransactions(rows: unknown) {
    const session = await auth();
    if (!await isAdminUser()) {
        return { success: false, error: "Unauthorized: Admin access required." };
    }

    const validated = z.array(ImportRowSchema).min(1, "Nothing to import").max(2000).safeParse(rows);
    if (!validated.success) {
        const issue = validated.error.issues[0];
        const rowNumber = typeof issue.path[0] === "number" ? ` (row ${issue.path[0] + 1})` : "";
        return { success: false, error: `Invalid input${rowNumber}: ${issue.message}` };
    }

    try {
        const result = await db.transaction.createMany({
            data: validated.data.map(row => ({
                type: row.type,
                amount: row.amount,
                category: row.category,
                description: row.description || null,
                date: new Date(row.date),
                userId: session?.user?.id,
            })),
        });

        revalidatePath("/transactions");
        return { success: true, count: result.count };
    } catch (error) {
        console.error("Failed to import transactions:", error);
        return { success: false, error: "Failed to import transactions." };
    }
}

const BulkIdsSchema = z.array(z.string().min(1)).min(1, "Nothing selected").max(2000);

// Change type and/or category of many transactions at once (Full Statement page)
export async function bulkUpdateTransactions(ids: unknown, changes: { type?: string; category?: string }) {
    if (!await isAdminUser()) {
        return { success: false, error: "Unauthorized" };
    }

    const validatedIds = BulkIdsSchema.safeParse(ids);
    const validatedChanges = z.object({
        type: z.enum(["INCOME", "EXPENSE"]).optional(),
        category: z.string().trim().min(1).max(60).optional(),
    }).safeParse(changes);
    if (!validatedIds.success || !validatedChanges.success || (!validatedChanges.data.type && !validatedChanges.data.category)) {
        return { success: false, error: "Invalid input" };
    }

    try {
        const result = await db.transaction.updateMany({
            where: { id: { in: validatedIds.data } },
            data: validatedChanges.data,
        });
        revalidatePath("/transactions");
        return { success: true, count: result.count };
    } catch (error) {
        console.error("Bulk update failed:", error);
        return { success: false, error: "Failed to update transactions" };
    }
}

export async function bulkDeleteTransactions(ids: unknown) {
    if (!await isAdminUser()) {
        return { success: false, error: "Unauthorized" };
    }

    const validatedIds = BulkIdsSchema.safeParse(ids);
    if (!validatedIds.success) {
        return { success: false, error: "Invalid input" };
    }

    try {
        const result = await db.transaction.deleteMany({ where: { id: { in: validatedIds.data } } });
        revalidatePath("/transactions");
        return { success: true, count: result.count };
    } catch (error) {
        console.error("Bulk delete failed:", error);
        return { success: false, error: "Failed to delete transactions" };
    }
}
