import db from "@/lib/db";
import { Actor } from "./types";
import { createQuotation } from "./quotation-service";

export interface SaveMeasurementInput {
    id?: string;
    leadId?: string | null;
    data: any;
    notes?: string;
    customerName?: string;
    title?: string;
    referenceFiles?: { name: string; url: string }[];
}

// Fetch by Lead ID (for Lead Detail page)
export async function getMeasurementByLeadId(leadId: string) {
    return (db as any).measurement.findUnique({
        where: { leadId },
    });
}

// Fetch by Measurement ID (for Standalone page)
export async function getMeasurementById(id: string) {
    return (db as any).measurement.findUnique({
        where: { id },
    });
}

// Fetch all measurements (for List page)
export async function listMeasurements() {
    return (db as any).measurement.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { lead: true }
    });
}

// Unified Save
export async function saveMeasurement(params: SaveMeasurementInput) {
    const { id, leadId, data, notes, customerName, title, referenceFiles } = params;

    if (id) {
        // Update existing by ID
        return (db as any).measurement.update({
            where: { id },
            data: {
                data,
                notes,
                customerName,
                title,
                referenceFiles,
                updatedAt: new Date(),
            }
        });
    }

    if (leadId) {
        // Upsert by Lead ID
        return (db as any).measurement.upsert({
            where: { leadId },
            update: {
                data,
                notes,
                referenceFiles,
                updatedAt: new Date(),
            },
            create: {
                leadId,
                data,
                notes,
                customerName,
                title,
                referenceFiles,
            }
        });
    }

    // Create new standalone
    return (db as any).measurement.create({
        data: {
            customerName,
            title,
            data,
            notes,
            images: [],
            referenceFiles,
        }
    });
}

export async function deleteMeasurement(id: string) {
    await (db as any).measurement.delete({
        where: { id }
    });
}

export async function generateQuotationFromMeasurement(actor: Actor | null, measurementId: string) {
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

    const result = await createQuotation(actor, {
        leadId: measurement.leadId,
        items: quotationItems,
        subtotal,
        tax,
        discount: 0,
        total
    });

    if (result.success) {
        return { success: true, quotationId: result.data?.id as string | undefined };
    }
    return { success: false, error: result.error };
}

export async function toggleVendorOrder(measurementId: string, type: 'tracks' | 'blinds' | 'curtains', isCompleted: boolean) {
    const measurement = await (db as any).measurement.findUnique({
        where: { id: measurementId }
    });
    if (!measurement) return { success: false, error: "Measurement not found" };

    let data = typeof measurement.data === 'string' ? JSON.parse(measurement.data) : { ...measurement.data };
    if (!data) data = {};
    if (!data.sharedSizes) data.sharedSizes = {};
    if (!data.sharedSizes.completed) data.sharedSizes.completed = { tracks: false, blinds: false, curtains: false };

    data.sharedSizes.completed[type] = isCompleted;

    await (db as any).measurement.update({
        where: { id: measurementId },
        data: { data }
    });

    return { success: true };
}

// ---------------------------------------------------------------------------
// Row-level write for the mobile sync upload: the offline client owns the row
// id, so this is an upsert by id rather than the by-lead upsert above.
// ---------------------------------------------------------------------------

export interface MeasurementRowInput {
    leadId?: string | null;
    customerName?: string | null;
    title?: string | null;
    data?: any;
    images?: string[];
    referenceFiles?: any;
    notes?: string | null;
}

export async function upsertMeasurementRow(id: string, row: MeasurementRowInput) {
    const existing = await (db as any).measurement.findUnique({ where: { id } });

    // One measurement per lead: refuse a second sheet instead of failing on the unique index
    if (row.leadId) {
        const forLead = await (db as any).measurement.findUnique({ where: { leadId: row.leadId } });
        if (forLead && forLead.id !== id) {
            return { success: false, error: "This lead already has a measurement sheet" };
        }
    }

    if (existing) {
        await (db as any).measurement.update({
            where: { id },
            data: { ...row, updatedAt: new Date() },
        });
    } else {
        await (db as any).measurement.create({
            data: {
                id,
                leadId: row.leadId ?? null,
                customerName: row.customerName,
                title: row.title,
                data: row.data ?? { floors: [] },
                images: row.images ?? [],
                referenceFiles: row.referenceFiles,
                notes: row.notes,
            },
        });
    }
    return { success: true };
}
