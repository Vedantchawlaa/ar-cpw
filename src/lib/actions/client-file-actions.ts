"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import db from "@/lib/db";
import * as leadService from "@/lib/services/lead-service";
import * as stockService from "@/lib/services/stock-service";
import { toActor } from "@/lib/services/types";
import { buildJobSummary } from "@/lib/client-file";
import { DEFAULT_TRACK_CUTTING_SETTINGS, type StockAwarePlan } from "@/lib/track-optimizer";

export interface ClientFileData {
    generatedAt: string;
    lead: {
        id: string;
        name: string;
        phone: string;
        city: string;
        type: string;
        description: string | null;
        expectedOrderValue: number;
        createdAt: string;
        lastContacted: string;
        nextContactDate: string | null;
        handledBy: string | null;
    };
    quotations: {
        number: string;
        date: string;
        status: string;
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
        receivedAmount: number;
        previousBalance: number;
        deadline: string | null;
        description: string | null;
        items: { description: string; details: string | null; quantity: number; rate: number; amount: number }[];
    }[];
    measurement: {
        data: unknown;
        notes: string | null;
        referenceFiles: { name: string; url: string }[];
        photoCount: number;
        updatedAt: string;
    } | null;
    productNames: Record<string, string>;
    cuttingPlan: StockAwarePlan | null;
    /** BOOKED: the plan saved when stock was booked. LIVE: planned against today's stock. */
    cuttingPlanSource: "BOOKED" | "LIVE" | null;
    stockBooking: { appliedAt: string; piecesUsed: number; piecesShortened: number; offcutsAdded: number } | null;
}

export interface ClientFileListRow {
    id: string;
    name: string;
    phone: string;
    city: string;
    type: string;
    createdAt: string;
    measuredAt: string | null;
    quotations: number;
    quoted: number;
    received: number;
}

/** Every client the user can see, with what their file will contain. */
export async function getClientFileList(): Promise<ClientFileListRow[]> {
    const session = await auth();
    if (!session?.user) return [];
    const actor = toActor(session.user);
    try {
        // Same access rule as the leads list: admins see every client, staff only their own
        const leads = await db.lead.findMany({
            where: actor.role === "admin" ? {} : { userId: actor.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true, name: true, phone: true, city: true, type: true, createdAt: true,
                measurement: { select: { updatedAt: true } },
                quotations: { select: { total: true, receivedAmount: true } },
            },
        });
        return leads.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone,
            city: l.city,
            type: l.type,
            createdAt: l.createdAt.toISOString(),
            measuredAt: l.measurement ? l.measurement.updatedAt.toISOString() : null,
            quotations: l.quotations.length,
            quoted: l.quotations.reduce((s, q) => s + q.total, 0),
            received: l.quotations.reduce((s, q) => s + q.receivedAmount, 0),
        }));
    } catch (error) {
        console.error("Failed to list client files:", error);
        return [];
    }
}

export async function getClientFileData(leadId: string): Promise<{ ok: true; data: ClientFileData } | { ok: false; error: string }> {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Please sign in again." };

    try {
        // Same access rule as the lead page: admins see every client, staff only their own
        const lead = await leadService.getLeadById(toActor(session.user), leadId);
        if (!lead) return { ok: false, error: "Client not found." };

        const [quotations, measurement, products, handler] = await Promise.all([
            db.quotation.findMany({ where: { leadId }, orderBy: { date: "asc" }, include: { items: true } }),
            db.measurement.findUnique({ where: { leadId } }),
            db.product.findMany({ select: { id: true, name: true } }),
            lead.userId ? db.user.findUnique({ where: { id: lead.userId }, select: { name: true } }) : null,
        ]);
        const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));

        const mData: any = measurement ? (typeof measurement.data === "string" ? JSON.parse(measurement.data) : measurement.data) : null;
        const booking = mData?.sharedSizes?.trackStock;
        let cuttingPlan: StockAwarePlan | null = null;
        let cuttingPlanSource: ClientFileData["cuttingPlanSource"] = null;
        if (booking?.plan) {
            cuttingPlan = booking.plan;
            cuttingPlanSource = "BOOKED";
        } else if (mData) {
            const { cutPieces } = buildJobSummary(mData);
            if (cutPieces.length > 0) {
                const settings = { ...DEFAULT_TRACK_CUTTING_SETTINGS, ...(mData.sharedSizes?.trackCutting || {}) };
                cuttingPlan = await stockService.planTracksWithStock(cutPieces, settings);
                cuttingPlanSource = "LIVE";
            }
        }

        const iso = (d: Date | null) => (d ? d.toISOString() : null);
        return {
            ok: true,
            data: {
                generatedAt: new Date().toISOString(),
                lead: {
                    id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    city: lead.city,
                    type: lead.type,
                    description: lead.description,
                    expectedOrderValue: lead.expectedOrderValue,
                    createdAt: lead.createdAt.toISOString(),
                    lastContacted: lead.lastContacted.toISOString(),
                    nextContactDate: iso(lead.nextContactDate),
                    handledBy: handler?.name ?? null,
                },
                quotations: quotations.map((q) => ({
                    number: q.number,
                    date: q.date.toISOString(),
                    status: q.status,
                    subtotal: q.subtotal,
                    discount: q.discount,
                    tax: q.tax,
                    total: q.total,
                    receivedAmount: q.receivedAmount,
                    previousBalance: q.previousBalance,
                    deadline: iso(q.deadline),
                    description: q.description,
                    items: q.items.map((i) => ({ description: i.description, details: i.details, quantity: i.quantity, rate: i.rate, amount: i.amount })),
                })),
                measurement: measurement
                    ? {
                        data: mData,
                        notes: measurement.notes,
                        referenceFiles: Array.isArray(measurement.referenceFiles) ? (measurement.referenceFiles as { name: string; url: string }[]) : [],
                        photoCount: measurement.images.length,
                        updatedAt: measurement.updatedAt.toISOString(),
                    }
                    : null,
                productNames,
                cuttingPlan,
                cuttingPlanSource,
                stockBooking: booking?.appliedAt
                    ? { appliedAt: booking.appliedAt, piecesUsed: booking.piecesUsed, piecesShortened: booking.piecesShortened, offcutsAdded: booking.offcutsAdded }
                    : null,
            },
        };
    } catch (error) {
        console.error("Failed to build client file:", error);
        return { ok: false, error: "Could not load the client's data." };
    }
}

export interface CurtainStyleChange {
    itemId: string;
    curtainType?: "Ripple Fold" | "Pinch Pleat";
    mountType?: "Wall" | "Ceiling";
}

/**
 * Sets the curtain style (ripple / pinch pleat) and mounting (wall / ceiling) of
 * windows in a client's measurement. Reads the latest saved measurement and
 * changes only these two fields, so other edits to the measurement are kept.
 */
export async function updateCurtainStyles(leadId: string, changes: CurtainStyleChange[]): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Please sign in again." };
    const valid = changes.every(
        (c) => typeof c.itemId === "string" &&
            (c.curtainType === undefined || c.curtainType === "Ripple Fold" || c.curtainType === "Pinch Pleat") &&
            (c.mountType === undefined || c.mountType === "Wall" || c.mountType === "Ceiling"),
    );
    if (!valid || changes.length === 0 || changes.length > 500) return { ok: false, error: "Invalid changes." };

    try {
        const lead = await leadService.getLeadById(toActor(session.user), leadId);
        if (!lead) return { ok: false, error: "Client not found." };

        await db.$transaction(async (tx) => {
            const measurement = await tx.measurement.findUnique({ where: { leadId } });
            if (!measurement) throw new Error("NO_MEASUREMENT");
            const data: any = typeof measurement.data === "string" ? JSON.parse(measurement.data) : structuredClone(measurement.data);
            const byId = new Map(changes.map((c) => [c.itemId, c]));
            for (const floor of data?.floors || []) {
                for (const room of floor.rooms || []) {
                    for (const item of room.items || []) {
                        const change = byId.get(item.id);
                        if (!change || item.type !== "Curtain") continue;
                        if (change.curtainType) item.curtainType = change.curtainType;
                        if (change.mountType) item.mountType = change.mountType;
                    }
                }
            }
            await tx.measurement.update({ where: { id: measurement.id }, data: { data } });
        });
    } catch (error) {
        if (error instanceof Error && error.message === "NO_MEASUREMENT") return { ok: false, error: "This client has no measurement yet." };
        console.error("Failed to update curtain styles:", error);
        return { ok: false, error: "Could not save the changes." };
    }
    revalidatePath(`/leads/${leadId}`);
    return { ok: true };
}
