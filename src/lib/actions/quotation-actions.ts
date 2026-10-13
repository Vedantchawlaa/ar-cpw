'use server'

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as quotationService from "@/lib/services/quotation-service";
import { toActor } from "@/lib/services/types";

import { Quotation, QuotationItem } from "@prisma/client";

export type QuotationWithRelations = Quotation & {
    items: QuotationItem[];
    lead: { name: string; city: string; phone: string };
    description?: string | null;
    services?: any;
};

export async function getQuotations() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const quotations = await quotationService.listQuotations(toActor(session.user));
        return { success: true, data: quotations };
    } catch (error) {
        console.error("Failed to fetch quotations:", error);
        return { success: false, error: "Failed to fetch quotations" };
    }
}
export async function updateOrderStatus(id: string, status: string, deadline?: Date | string | null) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        await quotationService.updateOrderStatus(id, status, deadline);

        revalidatePath("/processing-orders");
        return { success: true };
    } catch (error) {
        console.error("Failed to update order status:", error);
        return { success: false, error: "Failed to update status" };
    }
}

export async function getActiveOrders() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const quotations = await quotationService.listActiveOrders(toActor(session.user));
        return { success: true, data: quotations };
    } catch (error) {
        console.error("Failed to fetch active orders:", error);
        return { success: false, error: "Failed to fetch active orders" };
    }
}

export async function createQuotation(data: quotationService.CreateQuotationInput) {
    try {
        const session = await auth();
        if (session) console.log("User creating quotation:", session.user?.email);

        const result = await quotationService.createQuotation(session?.user ? toActor(session.user) : null, data);
        if (!result.success) return result;

        revalidatePath("/quotations");
        revalidatePath("/products");
        return result;
    } catch (error) {
        console.error("Failed to create quotation:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create quotation" };
    }
}

export async function updateQuotation(id: string, data: quotationService.UpdateQuotationInput) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const result = await quotationService.updateQuotation(toActor(session.user), id, data);
        if (!result.success) return result;

        revalidatePath("/quotations");
        revalidatePath(`/quotations/${id}`);
        return result;
    } catch (error: any) {
        console.error("❌ Failed to update quotation:", error);
        return { success: false, error: "Failed to update quotation: " + (error.message || "Unknown error") };
    }
}

export async function deleteQuotation(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const result = await quotationService.deleteQuotation(toActor(session.user), id);
        if (!result.success) return result;

        revalidatePath("/quotations");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete quotation:", error);
        return { success: false, error: "Failed to delete quotation" };
    }
}

export async function getQuotation(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        return await quotationService.getQuotation(toActor(session.user), id);
    } catch (error) {
        console.error("Failed to fetch quotation:", error);
        return { success: false, error: "Failed to fetch quotation" };
    }
}

export async function markAsSale(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const result = await quotationService.markAsSale(toActor(session.user), id);
        if (!result.success) return result;

        revalidatePath("/sales");
        revalidatePath("/quotations");
        revalidatePath("/dashboard");
        revalidatePath("/stock");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark as sale:", error);
        return { success: false, error: "Failed to mark as sale" };
    }
}
