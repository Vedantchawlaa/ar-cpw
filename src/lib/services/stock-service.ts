import db from "@/lib/db";
import { isPieceKind, isStockKind, isUsedUp, type StockKind } from "@/lib/stock-units";
import { planWithStock, type OptimizerOptions, type ProductTrackPiece, type StockTrackPiece } from "@/lib/track-optimizer";
import { Actor } from "./types";

// Stock is kept two ways, by product kind:
//   FABRIC / TRACK - one StockPiece row per physical cut; the total is their sum
//   ACCESSORY      - Product.stockQuantity is the count in hand
// Every change also writes a StockMovement, so the history shows who changed what.

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };
const fail = (error: string) => ({ success: false as const, error });

const round = (value: number) => Math.round(value * 1000) / 1000;

async function productOfKind(productId: string, check: (kind: string) => boolean, message: string) {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return { product: null, error: "Product not found" };
    if (!check(product.stockKind)) return { product: null, error: message };
    return { product, error: null };
}

// --- Reads -------------------------------------------------------------------

/** Every product with its available pieces and a computed total. */
export async function listStock() {
    const products = await db.product.findMany({
        orderBy: { name: "asc" },
        include: { stockPieces: { where: { status: "AVAILABLE" }, orderBy: { length: "desc" } } },
    });

    return products.map(product => {
        const total = isPieceKind(product.stockKind)
            ? round(product.stockPieces.reduce((sum, piece) => sum + piece.length, 0))
            : product.stockQuantity;
        return { ...product, total, isLow: isLow(product.stockKind, total, product.lowStockAt) };
    });
}

export async function listMovements(productId: string, take = 50) {
    return db.stockMovement.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        take,
    });
}

// Only products with an alert level set by hand ever alert - there is no default.
function isLow(kind: string, total: number, lowStockAt: number | null) {
    if (kind === "OTHER" || lowStockAt == null) return false;
    return total <= lowStockAt;
}

/** Products at or below their alert level, lowest first (used by reminders). */
export async function lowStockProducts() {
    const stock = await listStock();
    return stock.filter(p => p.isLow).sort((a, b) => a.total - b.total);
}

export async function availableTrackStock(productIds: string[]): Promise<StockTrackPiece[]> {
    if (productIds.length === 0) return [];
    const pieces = await db.stockPiece.findMany({
        where: { productId: { in: productIds }, status: "AVAILABLE", product: { stockKind: "TRACK" } },
        select: { id: true, productId: true, length: true },
    });
    return pieces;
}

// --- Product settings ----------------------------------------------------------

export interface NewStockProduct {
    id?: string; // a device-generated id from the mobile app
    name: string;
    stockKind: string;
    category?: string | null;
    rate?: number;
    lowStockAt?: number | null;
}

/** Category the rest of the app expects for each stock type, used when none is given. */
export const DEFAULT_CATEGORY: Record<StockKind, string> = {
    FABRIC: "Fabric",
    TRACK: "Tracks",
    ACCESSORY: "Accessories",
    OTHER: "",
};

export async function createProduct(input: NewStockProduct): Promise<Result<{ id: string }>> {
    const name = input.name?.trim();
    if (!name) return fail("Enter a product name");
    if (!isStockKind(input.stockKind)) return fail("Pick a stock type");
    if (input.rate != null && !(input.rate >= 0)) return fail("Rate must be zero or more");
    if (input.lowStockAt != null && !(input.lowStockAt >= 0)) return fail("Alert level must be zero or more");

    if (input.id) {
        const sameRow = await db.product.findUnique({ where: { id: input.id }, select: { id: true } });
        if (sameRow) return { success: true, id: input.id }; // retried upload
    }
    const existing = await db.product.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (existing) return fail(`A product named "${name}" already exists`);

    const product = await db.product.create({
        data: {
            ...(input.id ? { id: input.id } : {}),
            name,
            stockKind: input.stockKind,
            category: input.category?.trim() || DEFAULT_CATEGORY[input.stockKind],
            rate: input.rate ?? 0,
            lowStockAt: input.lowStockAt ?? null,
        },
    });
    return { success: true, id: product.id };
}

export async function updateStockSettings(productId: string, settings: { stockKind?: string; lowStockAt?: number | null }): Promise<Result> {
    if (settings.stockKind !== undefined && !isStockKind(settings.stockKind)) return fail("Unknown stock type");
    if (settings.lowStockAt != null && !(settings.lowStockAt >= 0)) return fail("Alert level must be zero or more");

    await db.product.update({
        where: { id: productId },
        data: {
            ...(settings.stockKind !== undefined ? { stockKind: settings.stockKind } : {}),
            ...(settings.lowStockAt !== undefined ? { lowStockAt: settings.lowStockAt } : {}),
        },
    });
    return { success: true };
}

// --- Pieces (fabric cuts, track pieces) ----------------------------------------

/** A change sent again with the same id (a retried mobile upload) has already been booked. */
async function alreadyApplied(movementId: string | undefined) {
    if (!movementId) return false;
    return !!(await db.stockMovement.findUnique({ where: { id: movementId }, select: { id: true } }));
}

export interface NewPiece {
    id?: string; // a device-generated id from the mobile app
    length: number;
}

export async function addPieces(
    actor: Actor,
    productId: string,
    pieces: NewPiece[],
    options: { source?: string; note?: string | null; measurementId?: string | null } = {}
): Promise<Result<{ count: number }>> {
    const { product, error } = await productOfKind(productId, isPieceKind, "This product is counted in nos, not pieces");
    if (!product) return fail(error!);
    if (pieces.length === 0) return fail("Add at least one piece");
    if (pieces.some(p => !(p.length > 0) || p.length > 100000)) return fail("Every piece needs a length above zero");

    const source = options.source || "PURCHASE";
    await db.$transaction(async tx => {
        for (const piece of pieces) {
            if (piece.id && (await tx.stockPiece.findUnique({ where: { id: piece.id }, select: { id: true } }))) continue;
            const created = await tx.stockPiece.create({
                data: { ...(piece.id ? { id: piece.id } : {}), productId, length: round(piece.length), source, note: options.note || null },
            });
            await tx.stockMovement.create({
                data: {
                    productId, pieceId: created.id, type: "ADD", quantity: created.length,
                    note: options.note || (source === "OFFCUT" ? "Offcut kept" : null), userId: actor.id,
                    measurementId: options.measurementId ?? null,
                },
            });
        }
    });
    return { success: true, count: pieces.length };
}

/**
 * Takes `amount` off a piece (e.g. 3 m from an 8 m cut) - used for a job, or
 * discarded (damaged, thrown away). Taking all of it, or more, takes the piece
 * out of stock.
 */
export async function cutPiece(
    actor: Actor,
    pieceId: string,
    amount: number,
    options: { note?: string | null; measurementId?: string | null; movementId?: string; discard?: boolean } = {}
): Promise<Result<{ remaining: number }>> {
    if (!(amount > 0)) return fail(options.discard ? "Enter how much was thrown away" : "Enter how much was used");
    if (await alreadyApplied(options.movementId)) return { success: true, remaining: 0 };

    const piece = await db.stockPiece.findUnique({ where: { id: pieceId } });
    if (!piece || piece.status !== "AVAILABLE") return fail("This piece is no longer in stock");

    const remaining = round(piece.length - amount);
    const usedUp = isUsedUp(remaining);
    await db.$transaction([
        db.stockPiece.update({
            where: { id: pieceId },
            data: usedUp ? { status: "USED", usedAt: new Date() } : { length: remaining },
        }),
        db.stockMovement.create({
            data: {
                ...(options.movementId ? { id: options.movementId } : {}),
                productId: piece.productId, pieceId, type: options.discard ? "DISCARD" : "USE", quantity: -Math.min(amount, piece.length),
                note: options.note || null, userId: actor.id, measurementId: options.measurementId ?? null,
            },
        }),
    ]);
    return { success: true, remaining: usedUp ? 0 : remaining };
}

/** Corrects a piece's recorded length or note (miscounted, measured again). */
export async function updatePiece(
    actor: Actor,
    pieceId: string,
    changes: { length?: number; note?: string | null },
    options: { movementId?: string } = {}
): Promise<Result> {
    if (await alreadyApplied(options.movementId)) return { success: true };
    const piece = await db.stockPiece.findUnique({ where: { id: pieceId } });
    if (!piece || piece.status !== "AVAILABLE") return fail("This piece is no longer in stock");
    if (changes.length !== undefined && !(changes.length > 0)) return fail("Length must be above zero");

    const length = changes.length !== undefined ? round(changes.length) : piece.length;
    const delta = round(length - piece.length);

    await db.$transaction(async tx => {
        await tx.stockPiece.update({
            where: { id: pieceId },
            data: { length, ...(changes.note !== undefined ? { note: changes.note } : {}) },
        });
        if (delta !== 0) {
            await tx.stockMovement.create({
                data: {
                    ...(options.movementId ? { id: options.movementId } : {}),
                    productId: piece.productId, pieceId, type: "ADJUST", quantity: delta, note: "Length corrected", userId: actor.id,
                },
            });
        }
    });
    return { success: true };
}

/** Throws a whole piece away (damaged, lost). */
export async function removePiece(actor: Actor, pieceId: string, note?: string | null, options: { movementId?: string } = {}): Promise<Result> {
    if (await alreadyApplied(options.movementId)) return { success: true };
    const piece = await db.stockPiece.findUnique({ where: { id: pieceId } });
    if (!piece) return { success: true };
    if (piece.status !== "AVAILABLE") return { success: true };

    await db.$transaction([
        db.stockPiece.update({ where: { id: pieceId }, data: { status: "USED", usedAt: new Date() } }),
        db.stockMovement.create({
            data: {
                ...(options.movementId ? { id: options.movementId } : {}),
                productId: piece.productId, pieceId, type: "DISCARD", quantity: -piece.length, note: note || null, userId: actor.id,
            },
        }),
    ]);
    return { success: true };
}

// --- Counted stock (accessories) -----------------------------------------------

/**
 * Adds or removes nos. `movementId` makes it safe to retry: the mobile app
 * sends each change with its own id, and a repeat of the same id is ignored.
 */
export async function adjustCount(
    actor: Actor,
    productId: string,
    delta: number,
    options: { note?: string | null; movementId?: string; type?: "ADD" | "USE" | "ADJUST" | "DISCARD"; measurementId?: string | null } = {}
): Promise<Result<{ stockQuantity: number }>> {
    if (!Number.isInteger(delta) || delta === 0) return fail("Change must be a whole number other than zero");

    if (await alreadyApplied(options.movementId)) {
        const current = await db.product.findUnique({ where: { id: productId }, select: { stockQuantity: true } });
        return { success: true, stockQuantity: current?.stockQuantity ?? 0 };
    }

    const { product, error } = await productOfKind(productId, kind => kind === "ACCESSORY", "Only accessories are counted in nos");
    if (!product) return fail(error!);

    const type = options.type ?? (delta > 0 ? "ADD" : "USE");
    const [updated] = await db.$transaction([
        db.product.update({ where: { id: productId }, data: { stockQuantity: { increment: delta } } }),
        db.stockMovement.create({
            data: {
                ...(options.movementId ? { id: options.movementId } : {}),
                productId, type, quantity: delta, note: options.note || null, userId: actor.id,
                measurementId: options.measurementId ?? null,
            },
        }),
    ]);
    return { success: true, stockQuantity: updated.stockQuantity };
}

/** Sets the count after a physical stock check. */
export async function setCount(actor: Actor, productId: string, quantity: number, note?: string | null) {
    if (!Number.isInteger(quantity) || quantity < 0) return fail("Count must be a whole number, zero or more");
    const product = await db.product.findUnique({ where: { id: productId }, select: { stockQuantity: true } });
    if (!product) return fail("Product not found");
    const delta = quantity - product.stockQuantity;
    if (delta === 0) return { success: true as const, stockQuantity: quantity };
    return adjustCount(actor, productId, delta, { note: note || "Stock count", type: "ADJUST" });
}

// --- Track cutting plan -> stock -----------------------------------------------

export interface AppliedTrackStock {
    appliedAt: string;
    appliedBy: string;
    piecesUsed: number;
    piecesShortened: number;
    offcutsAdded: number;
}

/** Plans a job's tracks against the current stock (no changes made). */
export async function planTracksWithStock(pieces: ProductTrackPiece[], settings: OptimizerOptions) {
    const productIds = [...new Set(pieces.map(p => p.productId).filter((id): id is string => !!id))];
    return planWithStock(pieces, await availableTrackStock(productIds), settings);
}

/**
 * Plans the job's tracks against the stock as it is now and books it:
 * stock pieces used by the plan are shortened (when the leftover is worth
 * keeping) or marked used, and KEEP offcuts from new bars are added as pieces.
 * Runs once per measurement.
 */
export async function applyTrackPlan(
    actor: Actor,
    measurementId: string,
    pieces: ProductTrackPiece[],
    settings: OptimizerOptions
): Promise<Result<{ plan: Awaited<ReturnType<typeof planTracksWithStock>>; applied: AppliedTrackStock }>> {
    const measurement = await db.measurement.findUnique({ where: { id: measurementId } });
    if (!measurement) return fail("Measurement not found");

    const data: any = typeof measurement.data === "string" ? JSON.parse(measurement.data) : { ...(measurement.data as any) };
    const previous: AppliedTrackStock | undefined = data?.sharedSizes?.trackStock;
    if (previous?.appliedAt) {
        return fail(`Stock was already updated for this job on ${new Date(previous.appliedAt).toLocaleDateString("en-IN")}.`);
    }

    const plan = await planTracksWithStock(pieces, settings);
    const applied: AppliedTrackStock = {
        appliedAt: new Date().toISOString(),
        appliedBy: actor.id,
        piecesUsed: 0,
        piecesShortened: 0,
        offcutsAdded: 0,
    };

    try {
        await db.$transaction(async tx => {
            for (const group of plan.groups) {
                if (!group.productId) continue;

                for (const use of group.fromStock) {
                    // The plan was made from a read outside this transaction - make sure the piece did not change since
                    const current = await tx.stockPiece.findUnique({ where: { id: use.stockPieceId } });
                    if (!current || current.status !== "AVAILABLE" || Math.abs(current.length - use.stockLength) > 0.001) {
                        throw new StockChangedError();
                    }
                    const note = `Cut ${use.pieces.map(p => p.label).join(", ")}`;
                    if (use.isKeep) {
                        await tx.stockPiece.update({ where: { id: current.id }, data: { length: use.offcut } });
                        applied.piecesShortened++;
                    } else {
                        await tx.stockPiece.update({ where: { id: current.id }, data: { status: "USED", usedAt: new Date() } });
                        applied.piecesUsed++;
                    }
                    await tx.stockMovement.create({
                        data: {
                            productId: group.productId, pieceId: current.id, type: "USE",
                            quantity: -(use.isKeep ? round(use.stockLength - use.offcut) : use.stockLength),
                            note, userId: actor.id, measurementId,
                        },
                    });
                }

                for (const bar of group.plan.bars) {
                    if (!bar.isKeep) continue;
                    const created = await tx.stockPiece.create({
                        data: { productId: group.productId, length: bar.offcut, source: "OFFCUT", note: `Offcut from bar ${bar.barNo}` },
                    });
                    await tx.stockMovement.create({
                        data: {
                            productId: group.productId, pieceId: created.id, type: "ADD", quantity: bar.offcut,
                            note: "Offcut kept", userId: actor.id, measurementId,
                        },
                    });
                    applied.offcutsAdded++;
                }
            }

            await tx.measurement.update({
                where: { id: measurementId },
                data: { data: { ...data, sharedSizes: { ...(data?.sharedSizes ?? {}), trackStock: applied } } },
            });
        });
    } catch (error) {
        if (error instanceof StockChangedError) return fail("Stock changed while planning. Recalculate the plan and try again.");
        throw error;
    }

    return { success: true, plan, applied };
}

class StockChangedError extends Error {}

export type { StockKind };
