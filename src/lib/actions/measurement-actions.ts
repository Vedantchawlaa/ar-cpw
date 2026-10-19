'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as measurementService from "@/lib/services/measurement-service";
import { toActor } from "@/lib/services/types";

// Fetch by Lead ID (for Lead Detail page)
export async function getMeasurementByLeadId(leadId: string) {
    try {
        const measurement = await measurementService.getMeasurementByLeadId(leadId);
        return { success: true, data: measurement };
    } catch (error) {
        console.error("Failed to fetch measurement by lead:", error);
        return { success: false, error: "Failed to fetch measurement" };
    }
}

// Fetch by Measurement ID (for Standalone page)
export async function getMeasurementById(id: string) {
    try {
        const measurement = await measurementService.getMeasurementById(id);
        return { success: true, data: measurement };
    } catch (error) {
        console.error("Failed to fetch measurement:", error);
        return { success: false, error: "Failed to fetch measurement" };
    }
}

// Fetch all measurements (for List page)
export async function getAllMeasurements() {
    try {
        const measurements = await measurementService.listMeasurements();
        return { success: true, data: measurements };
    } catch (error) {
        console.error("Failed to fetch measurements:", error);
        return { success: false, error: "Failed to fetch measurements" };
    }
}

// Unified Save Action
export async function saveMeasurement(params: measurementService.SaveMeasurementInput) {
    try {
        const measurement = await measurementService.saveMeasurement(params);

        revalidatePath("/measurements");
        if (params.leadId) revalidatePath(`/leads/${params.leadId}`);

        return { success: true, data: measurement };
    } catch (error: any) {
        console.error("Failed to save measurement:", error);
        return { success: false, error: error.message || "Failed to save measurement" };
    }
}

// Adapter for backward compatibility if needed, or update call sites.
// The previous signature was: saveMeasurement(leadId, data, notes)
export async function saveMeasurementLegacy(leadId: string, data: any, notes?: string) {
    return saveMeasurement({ leadId, data, notes });
}

// Delete measurement
export async function deleteMeasurement(id: string) {
    try {
        await measurementService.deleteMeasurement(id);

        revalidatePath("/measurements");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete measurement:", error);
        return { success: false, error: error.message || "Failed to delete measurement" };
    }
}

export async function generateQuotationFromMeasurement(measurementId: string) {
    try {
        const session = await auth();
        const result = await measurementService.generateQuotationFromMeasurement(
            session?.user ? toActor(session.user) : null,
            measurementId
        );

        if (result.success) {
            revalidatePath("/quotations");
            revalidatePath("/products");
        }
        return result;
    } catch (error: any) {
        console.error("Failed to generate quotation:", error);
        return { success: false, error: error.message || "Failed to generate quotation" };
    }
}

export async function toggleVendorOrder(measurementId: string, type: 'tracks' | 'blinds' | 'curtains', isCompleted: boolean) {
    try {
        const result = await measurementService.toggleVendorOrder(measurementId, type, isCompleted);
        if (!result.success) return result;

        revalidatePath("/vendors");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to toggle vendor order:", error);
        return { success: false, error: error.message };
    }
}
