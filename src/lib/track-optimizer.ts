// Track cutting optimizer (1D cutting stock).
// Stock bars can be cut into several pieces but pieces can never be joined.
// Goal 1: fewest bars. Goal 2 (tie-break): largest sum of squared offcuts, so
// waste is concentrated into a few big reusable offcuts instead of many scraps.

export interface TrackPiece {
    label: string;
    length: number; // inches
}

export interface TrackCuttingSettings {
    stockLength: number; // inches
    kerf: number; // inches lost per cut between two pieces on the same bar
    keepThreshold: number; // offcuts at or above this are worth keeping
}

export interface OptimizerOptions extends Partial<TrackCuttingSettings> {
    timeLimitMs?: number;
    exactLimit?: number; // max piece count solved exactly
}

export interface PlanBar {
    barNo: number;
    pieces: TrackPiece[];
    usedLength: number; // pieces + kerf
    offcut: number;
    isKeep: boolean;
}

export interface OversizedPiece extends TrackPiece {
    suggestedLength: number | null; // inches, null = longer than any standard bar
}

export interface CuttingPlan extends TrackCuttingSettings {
    bars: PlanBar[];
    totalBars: number;
    totalUsed: number;
    totalOffcut: number;
    keepOffcuts: number[];
    oversized: OversizedPiece[];
    skipped: TrackPiece[]; // pieces without a usable length
    isExact: boolean; // false when the heuristic fallback produced the plan
}

export const DEFAULT_TRACK_CUTTING_SETTINGS: TrackCuttingSettings = {
    stockLength: 180,
    kerf: 0.1,
    keepThreshold: 50,
};

// Lengths (inches) suggested for pieces that don't fit the stock bar: 16 / 18 / 20 ft
export const STANDARD_ORDER_LENGTHS = [192, 216, 240];

// All maths runs on integers (1/1000 inch) to avoid float drift with kerf like 0.1
const SCALE = 1000;
const toUnits = (inches: number) => Math.round(inches * SCALE);
const toInches = (units: number) => units / SCALE;

export function suggestOrderLength(length: number): number | null {
    return STANDARD_ORDER_LENGTHS.find(l => toUnits(l) >= toUnits(length)) ?? null;
}

export function formatInches(value: number): string {
    return `${Number(value.toFixed(2))}"`;
}

// 180 -> "15 ft", 100 -> 100"
export function formatStockLength(inches: number): string {
    return Number.isInteger(inches / 12) ? `${inches / 12} ft` : formatInches(inches);
}

// e.g. "12 × 15 ft + 2 × 16 ft"
export function purchaseSummary(plan: CuttingPlan, times = "×"): string {
    const parts: string[] = [];
    if (plan.totalBars > 0) parts.push(`${plan.totalBars} ${times} ${formatStockLength(plan.stockLength)}`);

    const counts = new Map<string, number>();
    [...plan.oversized]
        .sort((a, b) => (a.suggestedLength ?? Infinity) - (b.suggestedLength ?? Infinity) || a.length - b.length)
        .forEach(p => {
            const key = p.suggestedLength ? formatStockLength(p.suggestedLength) : `custom ${formatInches(p.length)}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
    counts.forEach((qty, key) => parts.push(`${qty} ${times} ${key}`));

    return parts.join(" + ");
}

function firstFitDecreasing(sizes: number[], cap: number): number[] {
    const rem: number[] = [];
    return sizes.map(size => {
        let bin = rem.findIndex(r => r >= size);
        if (bin < 0) {
            bin = rem.length;
            rem.push(cap);
        }
        rem[bin] -= size;
        return bin;
    });
}

// Moves / swaps pieces between bars while that empties a bar or increases the
// sum of squared offcuts. Returns a compacted assignment.
function localImprove(sizes: number[], cap: number, binOf: number[]): number[] {
    const assign = binOf.slice();
    const binCount = Math.max(-1, ...assign) + 1;
    const rem: number[] = new Array(binCount).fill(cap);
    const load: number[] = new Array(binCount).fill(0);
    assign.forEach((b, i) => { rem[b] -= sizes[i]; load[b] += 1; });

    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 0; i < sizes.length && !improved; i++) {
            const a = assign[i];
            for (let b = 0; b < binCount && !improved; b++) {
                if (b === a || load[b] === 0 || rem[b] < sizes[i]) continue;
                // Emptying a bar is always a win; otherwise the move must concentrate waste
                if (load[a] === 1 || rem[a] + sizes[i] > rem[b]) {
                    rem[a] += sizes[i]; load[a] -= 1;
                    rem[b] -= sizes[i]; load[b] += 1;
                    assign[i] = b;
                    improved = true;
                }
            }
            for (let j = 0; j < sizes.length && !improved; j++) {
                const b = assign[j];
                const diff = sizes[i] - sizes[j];
                if (b === a || diff <= 0 || rem[b] < diff) continue;
                if (rem[a] + diff > rem[b]) {
                    rem[a] += diff;
                    rem[b] -= diff;
                    assign[i] = b;
                    assign[j] = a;
                    improved = true;
                }
            }
        }
    }

    const renumber = new Map<number, number>();
    return assign.map(b => {
        if (!renumber.has(b)) renumber.set(b, renumber.size);
        return renumber.get(b)!;
    });
}

interface SearchResult {
    binOf: number[];
    count: number;
    complete: boolean; // search finished before the deadline
}

// Branch-and-bound for the minimum number of bars. `sizes` must be sorted descending.
function searchMinBins(sizes: number[], cap: number, seed: number[], lowerBound: number, deadline: number): SearchResult {
    const n = sizes.length;
    const suffix = new Array(n + 1).fill(0);
    for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + sizes[i];

    let best = Math.max(...seed) + 1;
    let bestAssign = seed;
    if (best <= lowerBound) return { binOf: bestAssign, count: best, complete: true };

    const rem: number[] = [];
    const cur: number[] = new Array(n);
    let count = 0;
    let nodes = 0;
    let stop = false;
    let timedOut = false;

    const dfs = (i: number) => {
        if (stop) return;
        if ((++nodes & 1023) === 0 && Date.now() > deadline) { timedOut = true; stop = true; return; }
        if (i === n) {
            if (count < best) {
                best = count;
                bestAssign = cur.slice();
                if (best <= lowerBound) stop = true;
            }
            return;
        }

        let free = 0;
        for (let b = 0; b < count; b++) free += rem[b];
        const overflow = suffix[i] - free;
        if (count + (overflow > 0 ? Math.ceil(overflow / cap) : 0) >= best) return;

        const size = sizes[i];
        // Bars with the same remaining length are interchangeable - try only one of them
        const tried = new Set<number>();
        for (let b = 0; b < count; b++) {
            if (rem[b] < size || tried.has(rem[b])) continue;
            tried.add(rem[b]);
            rem[b] -= size;
            cur[i] = b;
            dfs(i + 1);
            rem[b] += size;
            if (stop) return;
        }
        if (count + 1 < best) {
            rem[count] = cap - size;
            cur[i] = count;
            count++;
            dfs(i + 1);
            count--;
        }
    };
    dfs(0);

    return { binOf: bestAssign, count: best, complete: !timedOut };
}

// Branch-and-bound over all packings into exactly `binCount` bars, maximizing
// the sum of squared offcuts. `sizes` must be sorted descending.
function searchBestOffcuts(sizes: number[], cap: number, seed: number[], binCount: number, deadline: number): SearchResult {
    const n = sizes.length;
    const suffix = new Array(n + 1).fill(0);
    for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + sizes[i];
    const totalWaste = binCount * cap - suffix[0];
    // A bar that is still unopened will hold at least the smallest piece
    const newBinCap = cap - sizes[n - 1];

    const seedRem: number[] = new Array(binCount).fill(cap);
    seed.forEach((b, i) => { seedRem[b] -= sizes[i]; });
    let bestScore = seedRem.reduce((sum, r) => sum + r * r, 0);
    let bestAssign = seed;

    const rem: number[] = [];
    const cur: number[] = new Array(n);
    let count = 0;
    let nodes = 0;
    let timedOut = false;

    // Best case for the remaining search: pour all waste into the roomiest bars
    const upperBound = () => {
        const caps = rem.slice(0, count);
        for (let b = count; b < binCount; b++) caps.push(newBinCap);
        caps.sort((x, y) => y - x);
        let waste = totalWaste;
        let score = 0;
        for (const c of caps) {
            const w = Math.min(c, waste);
            score += w * w;
            waste -= w;
            if (waste <= 0) break;
        }
        return score;
    };

    const dfs = (i: number) => {
        if (timedOut) return;
        if ((++nodes & 1023) === 0 && Date.now() > deadline) { timedOut = true; return; }
        if (i === n) {
            if (count !== binCount) return;
            let score = 0;
            for (let b = 0; b < count; b++) score += rem[b] * rem[b];
            if (score > bestScore) {
                bestScore = score;
                bestAssign = cur.slice();
            }
            return;
        }

        let free = (binCount - count) * cap;
        for (let b = 0; b < count; b++) free += rem[b];
        if (suffix[i] > free) return;
        if (upperBound() <= bestScore) return;

        const size = sizes[i];
        const tried = new Set<number>();
        for (let b = 0; b < count; b++) {
            if (rem[b] < size || tried.has(rem[b])) continue;
            tried.add(rem[b]);
            rem[b] -= size;
            cur[i] = b;
            dfs(i + 1);
            rem[b] += size;
            if (timedOut) return;
        }
        if (count < binCount) {
            rem[count] = cap - size;
            cur[i] = count;
            count++;
            dfs(i + 1);
            count--;
        }
    };
    dfs(0);

    return { binOf: bestAssign, count: binCount, complete: !timedOut };
}

export function optimizeTrackCutting(pieces: TrackPiece[], options: OptimizerOptions = {}): CuttingPlan {
    const positive = (value: number | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
    const nonNegative = (value: number | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

    const stockLength = positive(options.stockLength, DEFAULT_TRACK_CUTTING_SETTINGS.stockLength);
    const kerf = nonNegative(options.kerf, DEFAULT_TRACK_CUTTING_SETTINGS.kerf);
    const keepThreshold = nonNegative(options.keepThreshold, DEFAULT_TRACK_CUTTING_SETTINGS.keepThreshold);
    const timeLimitMs = options.timeLimitMs ?? 2000;
    const exactLimit = options.exactLimit ?? 40;

    const stockUnits = toUnits(stockLength);
    const kerfUnits = toUnits(kerf);

    const skipped: TrackPiece[] = [];
    const oversized: OversizedPiece[] = [];
    const fitting: TrackPiece[] = [];
    pieces.forEach(piece => {
        if (!Number.isFinite(piece.length) || toUnits(piece.length) <= 0) skipped.push(piece);
        else if (toUnits(piece.length) > stockUnits) oversized.push({ ...piece, suggestedLength: suggestOrderLength(piece.length) });
        else fitting.push(piece);
    });
    fitting.sort((a, b) => b.length - a.length);

    // n pieces on a bar need (n - 1) cuts. Adding one kerf to every piece and
    // to the bar turns that into plain bin packing.
    const sizes = fitting.map(p => toUnits(p.length) + kerfUnits);
    const cap = stockUnits + kerfUnits;

    let binOf: number[] = [];
    let isExact = true;
    if (sizes.length > 0) {
        binOf = localImprove(sizes, cap, firstFitDecreasing(sizes, cap));

        if (sizes.length <= exactLimit) {
            const deadline = Date.now() + timeLimitMs;
            const total = sizes.reduce((sum, s) => sum + s, 0);
            // Pieces longer than half a bar can never share one
            const lowerBound = Math.max(Math.ceil(total / cap), sizes.filter(s => s * 2 > cap).length);

            const minBins = searchMinBins(sizes, cap, binOf, lowerBound, deadline);
            binOf = minBins.binOf;
            isExact = minBins.complete;
            if (isExact) {
                const bestOffcuts = searchBestOffcuts(sizes, cap, binOf, minBins.count, deadline);
                binOf = bestOffcuts.binOf;
                isExact = bestOffcuts.complete;
            }
        } else {
            isExact = false;
        }
    }

    const grouped: TrackPiece[][] = [];
    binOf.forEach((b, i) => { (grouped[b] ||= []).push(fitting[i]); });

    const bars: PlanBar[] = grouped
        .filter(Boolean)
        .map(barPieces => {
            const usedUnits = barPieces.reduce((sum, p) => sum + toUnits(p.length), 0) + (barPieces.length - 1) * kerfUnits;
            const offcut = toInches(stockUnits - usedUnits);
            return {
                barNo: 0,
                pieces: barPieces, // already longest first
                usedLength: toInches(usedUnits),
                offcut,
                isKeep: offcut > 0 && offcut >= keepThreshold,
            };
        })
        .sort((a, b) => b.pieces[0].length - a.pieces[0].length || b.usedLength - a.usedLength)
        .map((bar, index) => ({ ...bar, barNo: index + 1 }));

    const totalUsedUnits = bars.reduce((sum, bar) => sum + toUnits(bar.usedLength), 0);

    return {
        stockLength,
        kerf,
        keepThreshold,
        bars,
        totalBars: bars.length,
        totalUsed: toInches(totalUsedUnits),
        totalOffcut: toInches(bars.length * stockUnits - totalUsedUnits),
        keepOffcuts: bars.filter(bar => bar.isKeep).map(bar => bar.offcut).sort((a, b) => b - a),
        oversized,
        skipped,
        isExact,
    };
}
