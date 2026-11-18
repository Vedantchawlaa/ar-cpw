// Vendor work ledger: the work a vendor did (nos x type at a price), what was
// paid to them, and the balance due. Pure functions only (no DB, no path
// aliases) so they can be unit tested.
//
// Payments are "Vendor's payout" expenses whose description names the vendor.

export const VENDOR_PAYOUT_CATEGORY = "Vendor's payout";

export interface WorkRow {
    id: string;
    vendor: string;
    nos: number;
    type: string;
    date: string; // YYYY-MM-DD
    price: number;
    notes?: string | null;
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

export const lineTotal = (r: Pick<WorkRow, "nos" | "price">) => round2(r.nos * r.price);

export interface VendorSummary {
    vendor: string;
    rows: WorkRow[]; // oldest first, like the sheet
    pieces: number;
    workTotal: number;
    payments: PaymentRow[];
    paid: number;
    due: number; // workTotal - paid; negative = paid in advance
    byType: Array<{ type: string; nos: number; total: number }>;
}

export function summarizeVendor(vendor: string, work: WorkRow[], payouts: PaymentRow[]): VendorSummary {
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

    const workTotal = round2(rows.reduce((s, r) => s + lineTotal(r), 0));
    const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
    return {
        vendor,
        rows,
        pieces: round2(rows.reduce((s, r) => s + r.nos, 0)),
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

/** Distinct vendor names (first spelling wins), sorted. */
export function vendorNames(...lists: string[][]): string[] {
    const seen = new Map<string, string>();
    for (const list of lists) for (const v of list) {
        const name = v.trim();
        if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
