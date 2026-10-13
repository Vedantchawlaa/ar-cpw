"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as leadService from "@/lib/services/lead-service";
import { toActor } from "@/lib/services/types";

function parseLeadForm(formData: FormData): leadService.LeadInput {
    const nextContactDateStr = formData.get("nextContactDate") as string;

    return {
        name: formData.get("name") as string,
        city: formData.get("city") as string,
        phone: formData.get("phone") as string,
        description: formData.get("description") as string,
        type: formData.get("type") as string,
        expectedOrderValue: Number(formData.get("expectedOrderValue")),
        quotationShared: formData.get("quotationShared") === "on",
        lastContacted: new Date(formData.get("lastContacted") as string),
        nextContactDate: nextContactDateStr ? new Date(nextContactDateStr) : null,
    };
}

export async function getLeads() {
    try {
        const session = await auth();
        if (!session?.user) return [];

        return await leadService.listLeads(toActor(session.user));
    } catch (error) {
        console.error("Failed to fetch leads:", error);
        return [];
    }
}

export async function createLead(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        await leadService.createLead(toActor(session.user), parseLeadForm(formData));

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

        const result = await leadService.updateLead(toActor(session.user), id, parseLeadForm(formData));
        if (!result.success) return result;

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

        const result = await leadService.deleteLead(toActor(session.user), id);
        if (!result.success) return result;

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

        return await leadService.getLeadById(toActor(session.user), id);
    } catch (error) {
        console.error("Failed to fetch lead:", error);
        return null;
    }
}
