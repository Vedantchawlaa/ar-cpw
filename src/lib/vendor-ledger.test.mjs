// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeVendor, paymentIsFor, lastPrice, vendorNames } from "./vendor-ledger.ts";

// The vendor sheet: grand total 10555
const sheet = [
    [5, "pinch pleat", "2026-10-01", 75], [13, "pinch pleat", "2026-10-01", 75], [7, "pinch pleat", "2026-10-01", 75],
    [12, "pinch pleat", "2026-10-02", 75], [14, "pinch pleat", "2026-10-02", 75], [28, "pinch pleat with belt", "2026-10-03", 85],
    [22, "pinch pleat", "2026-10-26", 75], [3, "pinch pleat", "2026-10-31", 75], [3, "pinch pleat", "2026-10-31", 75],
    [12, "pinch pleat", "2026-11-02", 75], [6, "pinch pleat", "2026-11-03", 75], [12, "eyelet with belt", "2026-11-07", 75],
].map(([nos, type, date, price], i) => ({ id: String(i), vendor: "Parveen", nos, type, date, price }));

const payouts = [
    { id: "p1", date: "2026-10-15", amount: 5000, description: "Parveen stitching" },
    { id: "p2", date: "2026-11-05", amount: 2000, description: "paid to parveen" },
    { id: "p3", date: "2026-11-06", amount: 900, description: "Parveena fabric" }, // different vendor
];

test("grand total matches the sheet, payouts reduce the balance", () => {
    const s = summarizeVendor("Parveen", [...sheet, { id: "x", vendor: "Other", nos: 1, type: "pinch pleat", date: "2026-10-01", price: 99 }], payouts);
    assert.equal(s.rows.length, 12);
    assert.equal(s.workTotal, 10555);
    assert.equal(s.pieces, 137);
    assert.equal(s.paid, 7000);
    assert.equal(s.due, 3555);
    assert.deepEqual(s.byType.map((t) => [t.type, t.nos, t.total]), [
        ["pinch pleat", 97, 7275], ["pinch pleat with belt", 28, 2380], ["eyelet with belt", 12, 900],
    ]);
});

test("payout matching is by whole name, any case", () => {
    assert.equal(paymentIsFor("Parveen - Nov", "parveen"), true);
    assert.equal(paymentIsFor("Parveena", "Parveen"), false);
    assert.equal(paymentIsFor(null, "Parveen"), false);
    assert.equal(paymentIsFor("Raj (tailor)", "Raj (tailor)"), true);
});

test("price pre-fill uses the latest price for that vendor and type", () => {
    assert.equal(lastPrice(sheet, "parveen", "Pinch Pleat"), 75);
    assert.equal(lastPrice(sheet, "Parveen", "pinch pleat with belt"), 85);
    assert.equal(lastPrice(sheet, "Someone", "pinch pleat"), null);
});

test("vendor names are merged without duplicates", () => {
    assert.deepEqual(vendorNames(["Parveen", " raj "], ["parveen", "Amit", ""]), ["Amit", "Parveen", "raj"]);
});
