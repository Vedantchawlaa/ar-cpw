// Vendor work ledger: the work a vendor did (nos x type at a price), what was
// paid to them, and the balance due. Pure functions only (no DB, no path
// aliases) so they can be unit tested.
//
// Payments are expenses (any category) whose description names the vendor.

export const VENDOR_KINDS = ["STITCHING", "FABRIC", "BLINDS", "TRACKS", "OTHER"] as const;
export type VendorKind = (typeof VENDOR_KINDS)[number];

export const KIND_INFO: Record<VendorKind, { label: string; qty: string; item: string; itemHint: string }> = {
    STITCHING: { label: "Stitching", qty: "Nos", item: "Type", itemHint: "Type (e.g. pinch pleat)" },
    FABRIC: { label: "Fabric source", qty: "Mtrs", item: "Fabric", itemHint: "Fabric (e.g. Velvet 2201)" },
    BLINDS: { label: "Blinds source", qty: "Qty", item: "Blind", itemHint: "Blind (e.g. Roller - 24 sq ft)" },
    TRACKS: { label: "Tracks source", qty: "Qty", item: "Item", itemHint: "Item (e.g. M-track 10 ft)" },
    OTHER: { label: "Other", qty: "Qty", item: "Item", itemHint: "Item" },
};

export const asKind = (k: unknown): VendorKind => (VENDOR_KINDS as readonly string[]).includes(String(k)) ? (k as VendorKind) : "OTHER";

export interface VendorInfo {
    id: string | null; // null = only seen in ledger rows / measurements, not saved in the directory
    name: string;
    kind: VendorKind;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
}

/** Directory entries plus names only seen elsewhere (first match wins), sorted by name. */
export function mergeVendors(directory: VendorInfo[], others: Array<{ name: string; kind: VendorKind }>): VendorInfo[] {
    const map = new Map<string, VendorInfo>();
    for (const v of directory) map.set(v.name.trim().toLowerCase(), v);
    for (const o of others) {
        const name = o.name.trim();
        if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), { id: null, name, kind: o.kind });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface WorkRow {
    id: string;
    vendor: string;
    nos: number;
    type: string;
    date: string; // YYYY-MM-DD
    price: number;
    notes?: string | null;
    gstPercent?: number | null; // null / 0 = no GST
    refNo?: string | null; // vendor's bill no.
    billId?: string | null; // part of a VendorBill
}

export interface BillInfo {
    id: string;
    vendor: string;
    refNo: string | null;
    date: string; // YYYY-MM-DD
    gstPercent: number | null;
    roundOff?: number | null; // added to the bill total
    notes: string | null;
    attachmentId: string | null;
    fileName: string | null;
    fileHash?: string | null;
}

const billNoKey = (b: Pick<BillInfo, "vendor" | "refNo">) =>
    b.refNo?.trim() ? `${b.vendor.trim().toLowerCase()}|${b.refNo.trim().toLowerCase().replace(/\s+/g, "")}` : null;

/**
 * Bills that look entered twice: the same file uploaded again, or the same bill no.
 * for the same vendor. Maps bill id -> why.
 */
export function duplicateBills(bills: BillInfo[]): Map<string, string> {
    const out = new Map<string, string>();
    const mark = (key: (b: BillInfo) => string | null | undefined, why: string) => {
        const groups = new Map<string, BillInfo[]>();
        for (const b of bills) { const k = key(b); if (k) groups.set(k, [...(groups.get(k) ?? []), b]); }
        for (const g of groups.values()) if (g.length > 1) for (const b of g) if (!out.has(b.id)) out.set(b.id, why);
    };
    mark((b) => b.fileHash, "Same file uploaded twice");
    mark(billNoKey, "Same bill no. entered twice");
    return out;
}

/** Ledger entries in date order: a whole bill (with its lines) or a single loose line. */
export type LedgerEntry =
    | { kind: "bill"; bill: BillInfo; lines: WorkRow[]; subtotal: number; gst: number; roundOff: number; total: number }
    | { kind: "line"; row: WorkRow };

export function ledgerEntries(rows: WorkRow[], bills: BillInfo[]): LedgerEntry[] {
    const byId = new Map(bills.map((b) => [b.id, b]));
    const grouped = new Map<string, WorkRow[]>();
    const entries: Array<{ date: string; entry: LedgerEntry }> = [];
    for (const r of rows) {
        const bill = r.billId ? byId.get(r.billId) : undefined;
        if (!bill) { entries.push({ date: r.date, entry: { kind: "line", row: r } }); continue; }
        if (!grouped.has(bill.id)) grouped.set(bill.id, []);
        grouped.get(bill.id)!.push(r);
    }
    for (const b of bills) {
        const lines = grouped.get(b.id);
        if (!lines) continue; // bill of another vendor, or with no lines
        const subtotal = round2(lines.reduce((s, r) => s + lineBase(r), 0));
        const gst = round2(lines.reduce((s, r) => s + lineGst(r), 0));
        const roundOff = b.roundOff || 0;
        entries.push({ date: b.date, entry: { kind: "bill", bill: b, lines, subtotal, gst, roundOff, total: round2(subtotal + gst + roundOff) } });
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.entry);
}

export interface PaymentRow {
    id: string;
    date: string; // YYYY-MM-DD
    amount: number;
    description: string;
}

export const sameVendor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const round2 = (n: number) => Math.round(n * 100) / 100;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A payout description names the vendor (whole words, any case). */
export function paymentIsFor(description: string | null | undefined, vendor: string): boolean {
    const name = vendor.trim();
    if (!name || !description) return false;
    return new RegExp(`(^|[^a-z0-9])${escapeRe(name)}($|[^a-z0-9])`, "i").test(description);
}

/** Before GST: nos x price. */
export const lineBase = (r: Pick<WorkRow, "nos" | "price">) => round2(r.nos * r.price);
/** GST on the line (0 when GST is off). */
export const lineGst = (r: Pick<WorkRow, "nos" | "price" | "gstPercent">) => round2(lineBase(r) * (r.gstPercent || 0) / 100);
/** What the line costs: base + GST. */
export const lineTotal = (r: Pick<WorkRow, "nos" | "price" | "gstPercent">) => round2(lineBase(r) + lineGst(r));

export interface VendorSummary {
    vendor: string;
    rows: WorkRow[]; // oldest first, like the sheet
    pieces: number;
    subtotal: number; // before GST
    gst: number;
    roundOff: number; // bills' round off, summed
    workTotal: number; // subtotal + GST + round off
    payments: PaymentRow[];
    paid: number;
    due: number; // workTotal - paid; negative = paid in advance
    byType: Array<{ type: string; nos: number; total: number }>;
}

export function summarizeVendor(vendor: string, work: WorkRow[], payouts: PaymentRow[], bills: BillInfo[] = []): VendorSummary {
    const rows = work
        .filter((r) => sameVendor(r.vendor, vendor))
        .sort((a, b) => a.date.localeCompare(b.date));
    const payments = payouts
        .filter((p) => paymentIsFor(p.description, vendor))
        .sort((a, b) => a.date.localeCompare(b.date));

    const types = new Map<string, { type: string; nos: number; total: number }>();
    for (const r of rows) {
        const key = r.type.trim().toLowerCase();
        const t = types.get(key) || { type: r.type.trim(), nos: 0, total: 0 };
        t.nos = round2(t.nos + r.nos);
        t.total = round2(t.total + lineTotal(r));
        types.set(key, t);
    }

    const subtotal = round2(rows.reduce((s, r) => s + lineBase(r), 0));
    const gst = round2(rows.reduce((s, r) => s + lineGst(r), 0));
    const billIds = new Set(rows.map((r) => r.billId).filter(Boolean));
    const roundOff = round2(bills.reduce((s, b) => s + (billIds.has(b.id) ? b.roundOff || 0 : 0), 0));
    const workTotal = round2(subtotal + gst + roundOff);
    const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
    return {
        vendor,
        rows,
        pieces: round2(rows.reduce((s, r) => s + r.nos, 0)),
        subtotal,
        gst,
        roundOff,
        workTotal,
        payments,
        paid,
        due: round2(workTotal - paid),
        byType: [...types.values()],
    };
}

/** Price to pre-fill for a vendor + type: the last price used for it. */
export function lastPrice(work: WorkRow[], vendor: string, type: string): number | null {
    const t = type.trim().toLowerCase();
    let best: WorkRow | null = null;
    for (const r of work) {
        if (!sameVendor(r.vendor, vendor) || r.type.trim().toLowerCase() !== t) continue;
        if (!best || r.date >= best.date) best = r;
    }
    return best ? best.price : null;
}

/** GST % to pre-fill for a vendor: from their latest line (null = GST off). */
export function lastGst(work: WorkRow[], vendor: string): number | null {
    let best: WorkRow | null = null;
    for (const r of work) if (sameVendor(r.vendor, vendor) && (!best || r.date >= best.date)) best = r;
    return best?.gstPercent || null;
}

/** Distinct vendor names (first spelling wins), sorted. */
export function vendorNames(...lists: string[][]): string[] {
    const seen = new Map<string, string>();
    for (const list of lists) for (const v of list) {
        const name = v.trim();
        if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
