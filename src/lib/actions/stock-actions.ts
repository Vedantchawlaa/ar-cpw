'use server'

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as stockService from "@/lib/services/stock-service";
import { toActor } from "@/lib/services/types";
import type { ProductTrackPiece } from "@/lib/track-optimizer";
import type { TrackCuttingSettings } from "@/lib/track-optimizer";

// Stock changes are admin-only, like the Stock page itself. Reading stock for
// a track plan is open to every team member.

async function adminActor() {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") return null;
    return toActor(session.user);
}

async function staffActor() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== "admin" && role !== "user")) return null;
    return toActor(session.user);
}

const unauthorized = { success: false as const, error: "Only an admin can change stock." };

function done<T extends { success: boolean }>(result: T) {
    if (result.success) {
        revalidatePath("/stock");
        revalidatePath("/reminders");
    }
    return result;
}

async function guarded<T extends { success: boolean }>(label: string, run: (actor: NonNullable<Awaited<ReturnType<typeof adminActor>>>) => Promise<T>) {
    const actor = await adminActor();
    if (!actor) return unauthorized;
    try {
        return done(await run(actor));
    } catch (error) {
        console.error(`${label} failed:`, error);
        return { success: false as const, error: `${label} failed. Please try again.` };
    }
}

export async function getStock() {
    if (!(await adminActor())) return [];
    return stockService.listStock();
}

export async function getStockHistory(productId: string) {
    if (!(await adminActor())) return [];
    return stockService.listMovements(productId);
}

export async function createStockProduct(input: stockService.NewStockProduct) {
    return guarded("Adding product", async () => {
        const result = await stockService.createProduct({ ...input, id: undefined });
        if (result.success) revalidatePath("/products");
        return result;
    });
}

export async function updateStockSettings(productId: string, settings: { stockKind?: string; lowStockAt?: number | null }) {
    return guarded("Saving stock settings", () => stockService.updateStockSettings(productId, settings));
}

export async function addStockPieces(productId: string, lengths: number[], note?: string) {
    return guarded("Adding stock", actor => stockService.addPieces(actor, productId, lengths.map(length => ({ length })), { note }));
}

export async function cutStockPiece(pieceId: string, amount: number, note?: string) {
    return guarded("Updating stock", actor => stockService.cutPiece(actor, pieceId, amount, { note }));
}

/** Throws away part of a piece, or all of it. */
export async function discardStockPiece(pieceId: string, amount: number, note?: string) {
    return guarded("Updating stock", actor => stockService.cutPiece(actor, pieceId, amount, { note, discard: true }));
}

export async function updateStockPiece(pieceId: string, changes: { length?: number; note?: string | null }) {
    return guarded("Updating stock", actor => stockService.updatePiece(actor, pieceId, changes));
}

export async function adjustStockCount(productId: string, delta: number, note?: string, discard = false) {
    return guarded("Updating stock", actor =>
        stockService.adjustCount(actor, productId, delta, { note, ...(discard ? { type: "DISCARD" as const } : {}) }));
}

export async function setStockCount(productId: string, quantity: number, note?: string) {
    return guarded("Updating stock", actor => stockService.setCount(actor, productId, quantity, note));
}

/** Track cutting plan that uses pieces already in stock. Changes nothing. */
export async function planTracksWithStock(pieces: ProductTrackPiece[], settings: TrackCuttingSettings) {
    if (!(await staffActor())) return null;
    try {
        return await stockService.planTracksWithStock(pieces, settings);
    } catch (error) {
        console.error("Planning tracks with stock failed:", error);
        return null;
    }
}

export async function applyTrackPlanToStock(measurementId: string, pieces: ProductTrackPiece[], settings: TrackCuttingSettings) {
    return guarded("Updating stock", async actor => {
        const result = await stockService.applyTrackPlan(actor, measurementId, pieces, settings);
        if (result.success) revalidatePath("/measurements");
        return result;
    });
}
