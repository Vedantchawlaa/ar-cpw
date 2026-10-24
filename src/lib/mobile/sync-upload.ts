import { Prisma } from "@prisma/client";
import { z } from "zod";
import db from "@/lib/db";
import { Actor } from "@/lib/services/types";
import * as leadService from "@/lib/services/lead-service";
import * as quotationService from "@/lib/services/quotation-service";
import * as measurementService from "@/lib/services/measurement-service";
import * as stockService from "@/lib/services/stock-service";
import { isAdmin } from "@/lib/services/types";

// Applies the write queue of an offline client. Each entry is one row-level
// change recorded by PowerSync on the device:
//   PUT    - row created (data = all columns)
//   PATCH  - row updated (data = changed columns only)
//   DELETE - row deleted
// Values arrive in SQLite form (dates and JSON as text, booleans as 0/1), so
// every table has a schema that validates and converts them before the
// service layer writes through Prisma.

export const SyncOpSchema = z.object({
    op: z.enum(["PUT", "PATCH", "DELETE"]),
    table: z.string(),
    id: z.string().min(1).max(64),
    data: z.record(z.string(), z.unknown()).nullish(),
});
export type SyncOp = z.infer<typeof SyncOpSchema>;

export interface SyncOpResult {
    table: string;
    id: string;
    op: string;
    ok: boolean;
    error?: string;
}

// --- SQLite -> JS conversions ----------------------------------------------

/** Device timestamps are UTC, either ISO or "YYYY-MM-DD HH:MM:SS.sss". */
function toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    let text = String(value).trim();
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) text = text.replace(" ", "T") + (text.length <= 10 ? "" : "Z");
    return new Date(text);
}

const date = z.preprocess(
    v => (v === null || v === undefined || v === "" ? v : toDate(v)),
    z.date().refine(d => !isNaN(d.getTime()), "Invalid date")
);
const nullableDate = z.preprocess(v => (v === "" ? null : v), date.nullable());

const bool = z.preprocess(v => (v === 1 || v === "1" || v === true || v === "true"), z.boolean());

const num = z.preprocess(v => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}, z.number());

function fromJson(value: unknown) {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}
const json = z.preprocess(fromJson, z.any());
// Prisma needs an explicit marker to store SQL NULL in an optional Json column
const nullableJson = json.transform(v => (v === null ? Prisma.DbNull : v));

const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => z.string().max(max).nullable();

// --- Table schemas (columns a device is allowed to write) -------------------

const LeadSchema = z.object({
    name: text(200).min(1, "Name is required"),
    city: text(200),
    phone: text(50),
    description: nullableText(5000).default(null),
    type: text(20).default("Warm"),
    expectedOrderValue: num.default(0),
    quotationShared: bool.default(false),
    lastContacted: date.default(() => new Date()),
    nextContactDate: nullableDate.default(null),
});

const QuotationSchema = z.object({
    number: nullableText(60),
    leadId: z.string().min(1),
    subtotal: num,
    tax: num,
    discount: num,
    discountCode: nullableText(60),
    discountType: z.enum(["FIXED", "PERCENTAGE"]),
    total: num,
    status: text(30).min(1),
    description: nullableText(5000),
    services: nullableJson,
    receivedAmount: num,
    previousBalance: num,
    deadline: nullableDate,
    date: date,
}).partial();

const QuotationItemSchema = z.object({
    quotationId: z.string().min(1),
    description: text(1000),
    details: nullableText(5000),
    quantity: num,
    rate: num,
    discount: num,
    amount: num,
}).partial();

const MeasurementSchema = z.object({
    leadId: z.preprocess(v => (v === "" ? null : v), z.string().nullable()),
    customerName: nullableText(200),
    title: nullableText(200),
    data: json.refine(v => v && typeof v === "object", "Invalid measurement data"),
    images: z.preprocess(fromJson, z.array(z.string())),
    referenceFiles: nullableJson,
    notes: nullableText(10000),
}).partial();

// Stock rows from the app. Pieces are only ever created from the device; every
// other stock change arrives as a StockMovement row that the server books
// (cut, remove, correct a piece, or add/use accessories).
const StockPieceSchema = z.object({
    productId: z.string().min(1),
    length: num.refine(v => v > 0, "Length must be above zero"),
    source: z.enum(["PURCHASE", "OFFCUT", "RETURN"]).catch("PURCHASE"),
    note: nullableText(500).optional(),
});

const StockMovementSchema = z.object({
    productId: z.string().min(1),
    pieceId: z.string().nullish(),
    type: z.enum(["ADD", "USE", "ADJUST", "DISCARD"]),
    // REMOVE marks a piece taken out of stock without a job; the device stores it as ADJUST + this flag
    action: z.enum(["CUT", "REMOVE", "CORRECT", "COUNT"]).optional(),
    quantity: num,
    note: nullableText(500).optional(),
    measurementId: z.string().nullish(),
});

const firstIssue = (error: z.ZodError) => {
    const issue = error.issues[0];
    return issue ? `${issue.path.join(".") || "row"}: ${issue.message}` : "Invalid data";
};

type Outcome = { success: boolean; error?: string };
const rejected = (error: string): Outcome => ({ success: false, error });
const done: Outcome = { success: true };

// --- Per-table handlers ------------------------------------------------------

async function applyLead(actor: Actor, op: SyncOp): Promise<Outcome> {
    const existing = await db.lead.findUnique({ where: { id: op.id } });

    if (op.op === "DELETE") {
        if (!existing) return done;
        return leadService.deleteLead(actor, op.id);
    }

    if (op.op === "PATCH" && !existing) return rejected("Lead no longer exists");

    // A PATCH carries only the changed columns: lay it over the stored row
    const parsed = LeadSchema.safeParse({ ...(existing ?? {}), ...(op.data ?? {}) });
    if (!parsed.success) return rejected(firstIssue(parsed.error));

    if (existing) return leadService.updateLead(actor, op.id, parsed.data);

    await leadService.createLead(actor, parsed.data, op.id);
    return done;
}

async function applyQuotation(actor: Actor, op: SyncOp): Promise<Outcome> {
    if (op.op === "DELETE") {
        const existing = await db.quotation.findUnique({ where: { id: op.id } });
        if (!existing) return done;
        return quotationService.deleteQuotation(actor, op.id);
    }

    const parsed = QuotationSchema.safeParse(op.data ?? {});
    if (!parsed.success) return rejected(firstIssue(parsed.error));

    if (op.op === "PATCH") {
        const existing = await db.quotation.findUnique({ where: { id: op.id } });
        if (!existing) return rejected("Quotation no longer exists");
    }
    return quotationService.upsertQuotationRow(actor, op.id, parsed.data);
}

async function applyQuotationItem(actor: Actor, op: SyncOp): Promise<Outcome> {
    if (op.op === "DELETE") return quotationService.deleteQuotationItemRow(actor, op.id);

    const parsed = QuotationItemSchema.safeParse(op.data ?? {});
    if (!parsed.success) return rejected(firstIssue(parsed.error));

    return quotationService.upsertQuotationItemRow(actor, op.id, parsed.data);
}

async function applyMeasurement(_actor: Actor, op: SyncOp): Promise<Outcome> {
    const existing = await db.measurement.findUnique({ where: { id: op.id }, select: { id: true } });

    if (op.op === "DELETE") {
        if (existing) await measurementService.deleteMeasurement(op.id);
        return done;
    }

    if (op.op === "PATCH" && !existing) return rejected("Measurement no longer exists");

    const parsed = MeasurementSchema.safeParse(op.data ?? {});
    if (!parsed.success) return rejected(firstIssue(parsed.error));

    return measurementService.upsertMeasurementRow(op.id, parsed.data);
}

const ADMIN_ONLY = "Only an admin can change stock";

const ProductSchema = z.object({
    name: text(200).min(1, "Name is required"),
    stockKind: z.string(),
    category: nullableText(100).optional(),
    rate: num.optional(),
    lowStockAt: z.preprocess(v => (v === "" || v === null || v === undefined ? null : v), num.nullable()).optional(),
});

async function applyProduct(actor: Actor, op: SyncOp): Promise<Outcome> {
    if (!isAdmin(actor)) return rejected("Only an admin can add products");
    if (op.op !== "PUT") return rejected("Products are edited on the website");

    const parsed = ProductSchema.safeParse(op.data ?? {});
    if (!parsed.success) return rejected(firstIssue(parsed.error));
    return stockService.createProduct({ ...parsed.data, id: op.id });
}

async function applyStockPiece(actor: Actor, op: SyncOp): Promise<Outcome> {
    if (!isAdmin(actor)) return rejected(ADMIN_ONLY);
    if (op.op !== "PUT") return rejected("Stock pieces change through stock entries, not edits");

    const parsed = StockPieceSchema.safeParse(op.data ?? {});
    if (!parsed.success) return rejected(firstIssue(parsed.error));

    return stockService.addPieces(actor, parsed.data.productId, [{ id: op.id, length: parsed.data.length }], {
        source: parsed.data.source,
        note: parsed.data.note,
    });
}

async function applyStockMovement(actor: Actor, op: SyncOp): Promise<Outcome> {
    if (!isAdmin(actor)) return rejected(ADMIN_ONLY);
    if (op.op !== "PUT") return rejected("Stock history cannot be edited");

    const parsed = StockMovementSchema.safeParse(op.data ?? {});
    if (!parsed.success) return rejected(firstIssue(parsed.error));
    const m = parsed.data;
    const options = { movementId: op.id };

    if (!m.pieceId) {
        return stockService.adjustCount(actor, m.productId, Math.round(m.quantity), {
            ...options, type: m.type, note: m.note, measurementId: m.measurementId,
        });
    }

    switch (m.action ?? (m.type === "USE" ? "CUT" : "CORRECT")) {
        case "CUT":
            return stockService.cutPiece(actor, m.pieceId, Math.abs(m.quantity), {
                ...options, note: m.note, measurementId: m.measurementId, discard: m.type === "DISCARD",
            });
        case "REMOVE":
            return stockService.removePiece(actor, m.pieceId, m.note, options);
        case "CORRECT": {
            const piece = await db.stockPiece.findUnique({ where: { id: m.pieceId }, select: { length: true } });
            if (!piece) return rejected("This piece is no longer in stock");
            return stockService.updatePiece(actor, m.pieceId, { length: piece.length + m.quantity }, options);
        }
        default:
            return rejected("Unknown stock change");
    }
}

const HANDLERS: Record<string, (actor: Actor, op: SyncOp) => Promise<Outcome>> = {
    Product: applyProduct,
    StockPiece: applyStockPiece,
    StockMovement: applyStockMovement,
    Lead: applyLead,
    Quotation: applyQuotation,
    QuotationItem: applyQuotationItem,
    Measurement: applyMeasurement,
};

/** Prisma errors caused by the data itself - retrying the same row can never succeed. */
const PERMANENT_PRISMA_CODES = new Set(["P2000", "P2002", "P2003", "P2014", "P2025"]);

/**
 * Applies the queue in order. A row that fails validation or a permission
 * check is reported as rejected and the rest carries on, so one bad row never
 * blocks the device's queue. Anything else (database unreachable, a bug)
 * throws, the route answers 5xx, and the device retries the whole batch -
 * which is safe because every write here is an upsert or an idempotent delete.
 */
export async function applySyncBatch(actor: Actor, batch: SyncOp[]): Promise<SyncOpResult[]> {
    const results: SyncOpResult[] = [];

    for (const op of batch) {
        const base = { table: op.table, id: op.id, op: op.op };
        const handler = HANDLERS[op.table];

        if (!handler) {
            results.push({ ...base, ok: false, error: `${op.table} cannot be changed from the app` });
            continue;
        }

        try {
            const outcome = await handler(actor, op);
            results.push({ ...base, ok: outcome.success, ...(outcome.success ? {} : { error: outcome.error || "Rejected" }) });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && PERMANENT_PRISMA_CODES.has(error.code)) {
                results.push({ ...base, ok: false, error: `Could not be saved (${error.code})` });
                continue;
            }
            if (error instanceof Prisma.PrismaClientValidationError) {
                results.push({ ...base, ok: false, error: "Could not be saved (invalid data)" });
                continue;
            }
            throw error;
        }
    }

    return results;
}
