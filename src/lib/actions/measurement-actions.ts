'use server';

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

// Fetch by Lead ID (for Lead Detail page)
export async function getMeasurementByLeadId(leadId: string) {
    try {
        const measurement = await (db as any).measurement.findUnique({
            where: { leadId },
        });
        return { success: true, data: measurement };
    } catch (error) {
        console.error("Failed to fetch measurement by lead:", error);
        return { success: false, error: "Failed to fetch measurement" };
    }
}

// Fetch by Measurement ID (for Standalone page)
export async function getMeasurementById(id: string) {
    try {
        const measurement = await (db as any).measurement.findUnique({
            where: { id },
        });
        return { success: true, data: measurement };
    } catch (error) {
        console.error("Failed to fetch measurement:", error);
        return { success: false, error: "Failed to fetch measurement" };
    }
}

// Fetch all measurements (for List page)
export async function getAllMeasurements() {
    try {
        const measurements = await (db as any).measurement.findMany({
            orderBy: { updatedAt: 'desc' },
            include: { lead: true }
        });
        return { success: true, data: measurements };
    } catch (error) {
        console.error("Failed to fetch measurements:", error);
        return { success: false, error: "Failed to fetch measurements" };
    }
}

// Unified Save Action
export async function saveMeasurement(params: {
    id?: string;
    leadId?: string | null;
    data: any;
    notes?: string;
    customerName?: string;
    title?: string;
}) {
    try {
        const { id, leadId, data, notes, customerName, title } = params;
        let measurement;

        if (id) {
            // Update existing by ID
            measurement = await (db as any).measurement.update({
                where: { id },
                data: {
                    data,
                    notes,
                    customerName,
                    title,
                    updatedAt: new Date(),
                }
            });
        } else if (leadId) {
            // Upsert by Lead ID
            measurement = await (db as any).measurement.upsert({
                where: { leadId },
                update: {
                    data,
                    notes,
                    updatedAt: new Date(),
                },
                create: {
                    leadId,
                    data,
                    notes,
                    customerName,
                    title,
                }
            });
        } else {
            // Create new standalone
            measurement = await (db as any).measurement.create({
                data: {
                    customerName,
                    title,
                    data,
                    notes,
                    images: [],
                }
            });
        }

        revalidatePath("/measurements");
        if (leadId) revalidatePath(`/leads/${leadId}`);

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
        await (db as any).measurement.delete({
            where: { id }
        });

        revalidatePath("/measurements");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete measurement:", error);
        return { success: false, error: error.message || "Failed to delete measurement" };
    }
}

export async function generateQuotationFromMeasurement(measurementId: string) {
    try {
        // Fetch measurement with lead data
        const measurement = await (db as any).measurement.findUnique({
            where: { id: measurementId },
            include: { lead: true }
        });

        if (!measurement) {
            return { success: false, error: "Measurement not found" };
        }

        if (!measurement.leadId) {
            return { success: false, error: "Measurement must be associated with a lead" };
        }

        // Handle both string and object data formats
        const data = typeof measurement.data === 'string'
            ? JSON.parse(measurement.data)
            : measurement.data;
        const quotationItems: { description: string; quantity: number; rate: number; amount: number }[] = [];

        // Process all floors and rooms
        for (const floor of data.floors || []) {
            for (const room of floor.rooms || []) {
                for (const item of room.items || []) {
                    // Process curtain items
                    if (item.type === 'Curtain') {
                        // Add fabric product
                        if (item.fabricProduct) {
                            const fabricProduct = await (db as any).product.findUnique({
                                where: { id: item.fabricProduct }
                            });
                            if (fabricProduct) {
                                const fabricQty = parseFloat(item.fabricRequired || "0");
                                quotationItems.push({
                                    description: `${fabricProduct.name} - ${item.name} (${room.name}, ${floor.name})`,
                                    quantity: fabricQty,
                                    rate: fabricProduct.rate,
                                    amount: fabricQty * fabricProduct.rate
                                });
                            }
                        }

                        // Add track product if required
                        if (item.trackRequired !== false && item.trackProduct) {
                            const trackProduct = await (db as any).product.findUnique({
                                where: { id: item.trackProduct }
                            });
                            if (trackProduct) {
                                const trackInches = parseFloat(item.trackSize || "0");
                                const trackFeet = Math.ceil(trackInches / 12); // Standard practice is to round up to nearest foot for billing
                                quotationItems.push({
                                    description: `${trackProduct.name} (${trackInches}") - ${item.name} (${room.name}, ${floor.name})`,
                                    quantity: 1,
                                    rate: trackProduct.rate,
                                    amount: trackFeet * trackProduct.rate
                                });
                            }
                        }

                        // Process Sheer Curtain
                        if (item.sheerRequired) {
                            // Add sheer fabric product
                            if (item.sheerFabricProduct) {
                                const sheerFabricProd = await (db as any).product.findUnique({
                                    where: { id: item.sheerFabricProduct }
                                });
                                if (sheerFabricProd) {
                                    const sheerFabricQty = parseFloat(item.sheerFabricRequired || "0");
                                    const sheerPanels = item.sheerQuantity || "1";
                                    quotationItems.push({
                                        description: `Sheer: ${sheerFabricProd.name} (${sheerPanels} panels) - ${item.name} (${room.name}, ${floor.name})`,
                                        quantity: sheerFabricQty,
                                        rate: sheerFabricProd.rate,
                                        amount: sheerFabricQty * sheerFabricProd.rate
                                    });
                                }
                            }

                            // Add sheer track product if required (defaults to main track if not set)
                            if (item.trackRequired !== false) {
                                const sheerTrackId = item.sheerTrackProduct || item.trackProduct;
                                if (sheerTrackId) {
                                    const sheerTrackProd = await (db as any).product.findUnique({
                                        where: { id: sheerTrackId }
                                    });
                                    if (sheerTrackProd) {
                                        const trackInches = parseFloat(item.sheerTrackSize || item.trackSize || "0");
                                        const trackFeet = Math.ceil(trackInches / 12);
                                        quotationItems.push({
                                            description: `Sheer Track: ${sheerTrackProd.name} (${trackInches}") - ${item.name} (${room.name}, ${floor.name})`,
                                            quantity: 1,
                                            rate: sheerTrackProd.rate,
                                            amount: trackFeet * sheerTrackProd.rate
                                        });
                                    }
                                }
                            }
                        }
                    }

                    // Process blind items
                    if (item.type === 'Blind' && item.blindProduct) {
                        const blindProduct = await (db as any).product.findUnique({
                            where: { id: item.blindProduct }
                        });
                        if (blindProduct) {
                            const sqft = parseFloat(item.sqft || "0");
                            quotationItems.push({
                                description: `${blindProduct.name} (${item.width}x${item.height}) - ${item.name} (${room.name}, ${floor.name})`,
                                quantity: sqft,
                                rate: blindProduct.rate,
                                amount: sqft * blindProduct.rate
                            });
                        }
                    }
                }
            }
        }

        if (quotationItems.length === 0) {
            return { success: false, error: "No items with products selected found in measurement" };
        }

        // Calculate totals
        const subtotal = quotationItems.reduce((sum, item) => sum + item.amount, 0);
        const tax = 0; // Tax set to 0 by default
        const total = subtotal + tax;

        // Import and call createQuotation
        const { createQuotation } = await import('./quotation-actions');
        const result = await createQuotation({
            leadId: measurement.leadId,
            items: quotationItems,
            subtotal,
            tax,
            discount: 0,
            total
        });

        if (result.success) {
            revalidatePath("/quotations");
            return { success: true, quotationId: result.data?.id };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        console.error("Failed to generate quotation:", error);
        return { success: false, error: error.message || "Failed to generate quotation" };
    }
}
