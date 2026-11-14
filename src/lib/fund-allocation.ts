// Fund allocation: split each month's income into fixed-percentage buckets
// and compare what each bucket was given with what it has used.
//
// Two kinds of bucket:
//  - SPEND: money is used by expenses. "Used" = expense transactions whose
//    category is linked to the bucket (e.g. Fabric Purchase -> Raw material).
//  - SAVE:  money is moved to another account (silver, SIP, loan). "Used" =
//    the amount marked as moved for that month.
// Every bucket (SPEND too) tracks how much was moved into its account. These
// moves are stored apart from transactions so they never change P&L figures.
//
// Pure functions only (no DB, no path aliases) so they can be unit tested.

export type BucketKind = "SPEND" | "SAVE";

export interface FundBucketConfig {
    id?: string;
    name: string;
    percent: number;
    kind: BucketKind;
    categories: string[]; // expense categories counted against a SPEND bucket
}

export interface AllocationTransaction {
    type: string; // INCOME | EXPENSE
    amount: number;
    category: string;
}

export interface BucketAllocation {
    id?: string;
    name: string;
    percent: number;
    kind: BucketKind;
    categories: string[];
    allocated: number;
    moved: number; // amount marked as moved into this bucket's account
    toMove: number; // still to move, never below 0. SPEND: allocated - spent - moved. SAVE: allocated - moved.
    used: number;
    remaining: number; // allocated - used; negative means overspent
    usedRatio: number; // used / allocated (0 when nothing allocated)
    status: "ok" | "near" | "over";
}

export interface AllocationSummary {
    income: number;
    totalPercent: number;
    buckets: BucketAllocation[];
    unassigned: { category: string; amount: number }[]; // expenses no bucket claims
    unassignedTotal: number;
}

export const DEFAULT_FUND_BUCKETS: FundBucketConfig[] = [
    { name: "Raw material", percent: 55, kind: "SPEND", categories: ["Fabric Purchase", "Accessory Purchase", "Vendor's payout"] },
    { name: "Rent, salaries & misc.", percent: 12, kind: "SPEND", categories: ["Rent", "Salary", "Utilities", "Food", "Vehicle maintenance & Fuel", "Other"] },
    { name: "Silver", percent: 10, kind: "SAVE", categories: [] },
    { name: "SIP", percent: 10, kind: "SAVE", categories: [] },
    { name: "Loan repayment & cash flow", percent: 7, kind: "SAVE", categories: [] },
    { name: "Tools", percent: 5, kind: "SPEND", categories: ["Tools"] },
    { name: "Ads", percent: 1, kind: "SPEND", categories: ["Advertisement"] },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Returns an error message, or null when the bucket list is valid. */
export function validateBuckets(buckets: FundBucketConfig[]): string | null {
    if (buckets.length === 0) return "Add at least one bucket.";
    const names = new Set<string>();
    const claimed = new Map<string, string>();
    for (const b of buckets) {
        const name = b.name.trim();
        if (!name) return "Every bucket needs a name.";
        if (names.has(name.toLowerCase())) return `"${name}" is listed twice.`;
        names.add(name.toLowerCase());
        if (!Number.isFinite(b.percent) || b.percent < 0 || b.percent > 100) return `"${name}" needs a percentage between 0 and 100.`;
        if (b.kind !== "SPEND" && b.kind !== "SAVE") return `"${name}" has an unknown type.`;
        if (b.kind === "SPEND") {
            for (const c of b.categories) {
                const owner = claimed.get(c);
                if (owner) return `"${c}" is linked to both "${owner}" and "${name}".`;
                claimed.set(c, name);
            }
        }
    }
    const total = round2(buckets.reduce((s, b) => s + b.percent, 0));
    if (total !== 100) return `Percentages add up to ${total}%, they must add up to 100%.`;
    return null;
}

/**
 * @param transfers amount marked as moved this period, keyed by bucket id
 *                  (or bucket name when the bucket has no id yet)
 */
export function computeAllocation(
    buckets: FundBucketConfig[],
    transactions: AllocationTransaction[],
    transfers: Record<string, number> = {},
): AllocationSummary {
    let income = 0;
    const expenseByCategory = new Map<string, number>();
    for (const t of transactions) {
        const amount = Number(t.amount) || 0;
        if (t.type === "INCOME") income += amount;
        else if (t.type === "EXPENSE") expenseByCategory.set(t.category, (expenseByCategory.get(t.category) || 0) + amount);
    }

    const claimed = new Set<string>();
    const rows: BucketAllocation[] = buckets.map((b) => {
        const allocated = round2((income * b.percent) / 100);
        const moved = round2(transfers[b.id ?? b.name] || 0);
        let used = 0;
        if (b.kind === "SPEND") {
            for (const c of b.categories) {
                used += expenseByCategory.get(c) || 0;
                claimed.add(c);
            }
        } else {
            used = moved;
        }
        used = round2(used);
        const usedRatio = allocated > 0 ? used / allocated : used > 0 ? Infinity : 0;
        return {
            id: b.id,
            name: b.name,
            percent: b.percent,
            kind: b.kind,
            categories: b.categories,
            allocated,
            moved,
            // SPEND: only what is left after spending gets moved. SAVE: used === moved.
            toMove: Math.max(0, round2(b.kind === "SPEND" ? allocated - used - moved : allocated - moved)),
            used,
            remaining: round2(allocated - used),
            usedRatio,
            status: usedRatio > 1 ? "over" : usedRatio >= 0.9 ? "near" : "ok",
        };
    });

    const unassigned = [...expenseByCategory.entries()]
        .filter(([c, amount]) => !claimed.has(c) && amount !== 0)
        .map(([category, amount]) => ({ category, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount);

    return {
        income: round2(income),
        totalPercent: round2(buckets.reduce((s, b) => s + b.percent, 0)),
        buckets: rows,
        unassigned,
        unassignedTotal: round2(unassigned.reduce((s, u) => s + u.amount, 0)),
    };
}
