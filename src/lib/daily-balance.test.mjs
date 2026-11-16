// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { netBetween, withGaps } from "./daily-balance.ts";

const tx = [
    { day: "2026-11-14", type: "INCOME", amount: 5000 },
    { day: "2026-11-15", type: "INCOME", amount: 10000 },
    { day: "2026-11-15", type: "EXPENSE", amount: 2000 },
    { day: "2026-11-17", type: "EXPENSE", amount: 1000 },
];

test("net between checks counts days after the previous check up to this one", () => {
    assert.equal(netBetween(tx, "2026-11-14", "2026-11-15"), 8000);
    assert.equal(netBetween(tx, "2026-11-14", "2026-11-17"), 7000); // missed day 16 is covered
    assert.equal(netBetween(tx, null, "2026-11-14"), 5000); // first check: that day only
});

test("gaps: balanced, unrecorded spending, and a skipped day", () => {
    const rows = withGaps([
        { day: "2026-11-17", bankBalance: 20000, cashBalance: 4000 },
        { day: "2026-11-14", bankBalance: 10000, cashBalance: 2000 },
        { day: "2026-11-15", bankBalance: 15000, cashBalance: 5000 },
    ], tx);
    assert.deepEqual(rows.map((r) => r.day), ["2026-11-17", "2026-11-15", "2026-11-14"]); // newest first
    const [d17, d15, d14] = rows;
    assert.equal(d14.gap, null);
    assert.equal(d15.recordedNet, 8000);
    assert.equal(d15.gap, 0); // 20000 - 12000 - 8000
    assert.equal(d17.previousDay, "2026-11-15");
    assert.equal(d17.recordedNet, -1000);
    assert.equal(d17.gap, 5000); // 24000 - 20000 - (-1000): more money than recorded
});
