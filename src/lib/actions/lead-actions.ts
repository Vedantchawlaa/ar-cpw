"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function getLeads() {
    try {
        const session = await auth();
        if (!session?.user) return [];

        const role = (session.user as any).role;
        const userId = session.user.id;

        const where = role === 'admin' ? {} : { userId };

        const leads = await db.lead.findMany({
            where: where as any,
            orderBy: { createdAt: 'desc' },
        });
        return leads;
    } catch (error) {
        console.error("Failed to fetch leads:", error);
        return [];
    }
}

export async function createLead(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const name = formData.get("name") as string;
        const city = formData.get("city") as string;
        const phone = formData.get("phone") as string;
        const description = formData.get("description") as string;
        const type = formData.get("type") as string;
        const expectedOrderValue = Number(formData.get("expectedOrderValue"));
        const quotationShared = formData.get("quotationShared") === "on";
        const lastContacted = new Date(formData.get("lastContacted") as string);
        const nextContactDateStr = formData.get("nextContactDate") as string;
        const nextContactDate = nextContactDateStr ? new Date(nextContactDateStr) : null;

        await (db as any).lead.create({
            data: {
                name,
                city,
                phone,
                description,
                type,
                expectedOrderValue,
                quotationShared,
                lastContacted,
                nextContactDate,
                userId: session.user.id,
            },
        });

        revalidatePath("/leads");
        return { success: true };
    } catch (error) {
        console.error("Failed to create lead:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: "Failed to create lead: " + errorMessage };
    }
}

export async function updateLead(id: string, formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const name = formData.get("name") as string;
        const city = formData.get("city") as string;
        const phone = formData.get("phone") as string;
        const description = formData.get("description") as string;
        const type = formData.get("type") as string;
        const expectedOrderValue = Number(formData.get("expectedOrderValue"));
        const quotationShared = formData.get("quotationShared") === "on";
        const lastContacted = new Date(formData.get("lastContacted") as string);
        const nextContactDateStr = formData.get("nextContactDate") as string;
        const nextContactDate = nextContactDateStr ? new Date(nextContactDateStr) : null;

        // Check ownership if not admin
        const role = (session.user as any).role;
        if (role !== 'admin') {
            const existing = await (db as any).lead.findUnique({ where: { id } });
            if (existing && existing.userId !== session.user.id) {
                return { success: false, error: "Unauthorized access to this lead" };
            }
        }

        await (db as any).lead.update({
            where: { id },
            data: {
                name,
                city,
                phone,
                description,
                type,
                expectedOrderValue,
                quotationShared,
                lastContacted,
                nextContactDate,
            },
        });

        revalidatePath("/leads");
        return { success: true };
    } catch (error) {
        console.error("Failed to update lead:", error);
        return { success: false, error: "Failed to update lead" };
    }
}

export async function deleteLead(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const role = (session.user as any).role;
        if (role !== 'admin') {
            const existing = await (db as any).lead.findUnique({ where: { id } });
            if (existing && existing.userId !== session.user.id) {
                return { success: false, error: "Unauthorized access to this lead" };
            }
        }

        await db.lead.delete({
            where: { id },
        });
        revalidatePath("/leads");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete lead:", error);
        return { success: false, error: "Failed to delete lead" };
    }
}

export async function getLeadById(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return null;

        const role = (session.user as any).role;

        const lead = await db.lead.findUnique({
            where: { id },
        });

        if (!lead) return null;

        // Check access
        if (role !== 'admin' && lead.userId !== session.user.id) {
            return null;
        }

        return lead;
    } catch (error) {
        console.error("Failed to fetch lead:", error);
        return null;
    }
}
