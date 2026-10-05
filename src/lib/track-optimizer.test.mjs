// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { optimizeTrackCutting, purchaseSummary } from "./track-optimizer.ts";

const toPieces = (lengths) => lengths.map((length, i) => ({ label: `W${i + 1}`, length }));
const lengthsOf = (bar) => bar.pieces.map(p => p.length);

test("reference project: 12 bars, 120+55 and 120+54 paired, two 192\" ordered separately", () => {
    const plan = optimizeTrackCutting(
        toPieces([108, 108, 143, 143, 120, 120, 171, 171, 167, 54, 55, 192, 192, 109, 109, 85]),
        { stockLength: 180, kerf: 0, keepThreshold: 50 }
    );

    assert.deepEqual(plan.oversized.map(p => [p.length, p.suggestedLength]), [[192, 192], [192, 192]]);
    assert.equal(plan.totalBars, 12);
    assert.equal(plan.totalUsed, 1663);
    assert.equal(plan.totalOffcut, 497);
    assert.deepEqual(plan.keepOffcuts, [95, 72, 72, 71, 71]);
    assert.equal(plan.isExact, true);

    const multi = plan.bars.filter(bar => bar.pieces.length > 1).map(lengthsOf);
    assert.deepEqual(multi.sort((a, b) => b[1] - a[1]), [[120, 55], [120, 54]]);
    assert.equal(plan.bars.filter(bar => bar.pieces.length === 1).length, 10);

    assert.deepEqual(plan.bars.map(bar => bar.barNo), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    plan.bars.forEach(bar => {
        assert.equal(bar.usedLength + bar.offcut, 180);
        assert.equal(bar.isKeep, bar.offcut >= 50);
    });
    assert.equal(purchaseSummary(plan), "12 × 15 ft + 2 × 16 ft");
});

test("empty list", () => {
    const plan = optimizeTrackCutting([], { stockLength: 180, kerf: 0 });
    assert.equal(plan.totalBars, 0);
    assert.equal(plan.totalUsed, 0);
    assert.equal(plan.totalOffcut, 0);
    assert.deepEqual(plan.bars, []);
    assert.deepEqual(plan.keepOffcuts, []);
    assert.deepEqual(plan.oversized, []);
    assert.equal(purchaseSummary(plan), "");
});

test("all pieces oversized", () => {
    const plan = optimizeTrackCutting(toPieces([192, 200, 230, 300]), { stockLength: 180, kerf: 0 });
    assert.equal(plan.totalBars, 0);
    assert.deepEqual(plan.oversized.map(p => p.suggestedLength), [192, 216, 240, null]);
    assert.equal(purchaseSummary(plan), "1 × 16 ft + 1 × 18 ft + 1 × 20 ft + 1 × custom 300\"");
});

test("pieces that exactly fill a bar", () => {
    const plan = optimizeTrackCutting(toPieces([80, 180, 100, 60, 60, 60]), { stockLength: 180, kerf: 0 });
    assert.equal(plan.totalBars, 3);
    assert.equal(plan.totalOffcut, 0);
    assert.deepEqual(plan.bars.map(lengthsOf), [[180], [100, 80], [60, 60, 60]]);
    assert.deepEqual(plan.keepOffcuts, []);
});

test("kerf changes the result", () => {
    const pieces = toPieces([90, 90]);

    const noKerf = optimizeTrackCutting(pieces, { stockLength: 180, kerf: 0 });
    assert.equal(noKerf.totalBars, 1);
    assert.equal(noKerf.totalOffcut, 0);

    const withKerf = optimizeTrackCutting(pieces, { stockLength: 180, kerf: 0.1 });
    assert.equal(withKerf.totalBars, 2);
    assert.deepEqual(withKerf.keepOffcuts, [90, 90]);

    // One cut between two pieces costs exactly one kerf
    const fits = optimizeTrackCutting(toPieces([90, 89.9]), { stockLength: 180, kerf: 0.1 });
    assert.equal(fits.totalBars, 1);
    assert.equal(fits.bars[0].usedLength, 180);
    assert.equal(fits.bars[0].offcut, 0);
});

test("fewest bars beats first-fit-decreasing", () => {
    // FFD needs 4 bars here, the optimum is 3 full bars
    const plan = optimizeTrackCutting(toPieces([90, 80, 70, 70, 60, 60, 50, 30, 30]), { stockLength: 180, kerf: 0 });
    assert.equal(plan.totalBars, 3);
    assert.equal(plan.totalOffcut, 0);
});

test("tie-break concentrates waste into one large offcut", () => {
    const plan = optimizeTrackCutting(toPieces([100, 100, 40, 40]), { stockLength: 180, kerf: 0, keepThreshold: 50 });
    assert.equal(plan.totalBars, 2);
    // 100+40+40 / 100 leaves 0 + 80, better than 100+40 twice (40 + 40)
    assert.deepEqual(plan.bars.map(bar => bar.offcut).sort((a, b) => b - a), [80, 0]);
    assert.deepEqual(plan.keepOffcuts, [80]);
});

test("large jobs fall back to the heuristic and stay valid", () => {
    const lengths = Array.from({ length: 120 }, (_, i) => 30 + ((i * 37) % 140));
    const plan = optimizeTrackCutting(toPieces(lengths), { stockLength: 180, kerf: 0.1 });
    assert.equal(plan.isExact, false);
    assert.equal(plan.bars.reduce((sum, bar) => sum + bar.pieces.length, 0), 120);
    plan.bars.forEach(bar => assert.ok(bar.offcut >= 0));
    const total = lengths.reduce((sum, l) => sum + l, 0);
    assert.ok(plan.totalBars >= Math.ceil(total / 180));
});

test("pieces without a usable length are skipped", () => {
    const plan = optimizeTrackCutting([{ label: "A", length: 0 }, { label: "B", length: NaN }, { label: "C", length: 100 }], { kerf: 0 });
    assert.equal(plan.totalBars, 1);
    assert.deepEqual(plan.skipped.map(p => p.label), ["A", "B"]);
});
