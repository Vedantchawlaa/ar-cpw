// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFeetInches, formatStockQuantity, inferStockKind } from "./stock-units.ts";
import { planWithStock } from "./track-optimizer.ts";

test("feet and inches", () => {
    assert.equal(formatFeetInches(55), "4 ft 7 in");
    assert.equal(formatFeetInches(60), "5 ft");
    assert.equal(formatFeetInches(7.5), "7.5 in");
    assert.equal(formatFeetInches(0), "0 in");
    assert.equal(formatFeetInches(180), "15 ft");
    assert.equal(formatStockQuantity("FABRIC", 8), "8 m");
    assert.equal(formatStockQuantity("ACCESSORY", 12), "12 nos");
});

test("stock kind is guessed from category and name", () => {
    assert.equal(inferStockKind("Fabric", "Velvet Grey"), "FABRIC");
    assert.equal(inferStockKind("Tracks", "Ripple"), "TRACK");
    assert.equal(inferStockKind("", "M Track Silver"), "TRACK");
    assert.equal(inferStockKind("Rods", "Steel"), "TRACK");
    assert.equal(inferStockKind("Blinds", "Zebra"), "OTHER");
    assert.equal(inferStockKind("Accessories", "Finial"), "ACCESSORY");
});

const settings = { stockLength: 180, kerf: 0, keepThreshold: 50 };

test("stock offcuts are used before new bars, smallest first", () => {
    const result = planWithStock(
        [
            { label: "W1", length: 97, productId: "t1" },
            { label: "W2", length: 50, productId: "t1" },
            { label: "W3", length: 40, productId: "t1" },
        ],
        [
            { id: "big", productId: "t1", length: 180 },
            { id: "small", productId: "t1", length: 55 },
        ],
        settings
    );
    const [group] = result.groups;
    assert.equal(group.fromStock[0].stockPieceId, "small");
    assert.deepEqual(group.fromStock[0].pieces.map(p => p.length), [50]);
    assert.equal(group.fromStock[0].offcut, 5);
    assert.equal(group.fromStock[0].isKeep, false);
    assert.equal(group.fromStock[1].stockPieceId, "big");
    assert.deepEqual(group.fromStock[1].pieces.map(p => p.length), [97, 40]);
    assert.equal(group.fromStock[1].offcut, 43);
    assert.equal(group.plan.totalBars, 0);
});

test("stock of another track product is never used; leftovers go to new bars", () => {
    const result = planWithStock(
        [
            { label: "A", length: 100, productId: "t1" },
            { label: "B", length: 100, productId: "t2" },
            { label: "C", length: 60, productId: null },
        ],
        [{ id: "s1", productId: "t2", length: 120 }],
        settings
    );
    const byId = Object.fromEntries(result.groups.map(g => [g.productId, g]));
    assert.equal(byId.t1.fromStock.length, 0);
    assert.equal(byId.t1.plan.totalBars, 1);
    assert.equal(byId.t2.fromStock[0].stockPieceId, "s1");
    assert.equal(byId.t2.plan.totalBars, 0);
    assert.equal(byId.null.fromStock.length, 0);
    assert.equal(byId.null.plan.totalBars, 1);
    assert.equal(result.groups.at(-1).productId, null);
});

test("kerf counts between pieces cut from a stock piece and big offcuts are kept", () => {
    const result = planWithStock(
        [{ label: "A", length: 60, productId: "t1" }, { label: "B", length: 60, productId: "t1" }],
        [{ id: "s", productId: "t1", length: 180 }],
        { ...settings, kerf: 0.5 }
    );
    const use = result.groups[0].fromStock[0];
    assert.equal(use.usedLength, 120.5);
    assert.equal(use.offcut, 59.5);
    assert.equal(use.isKeep, true);
});

test("a piece longer than every stock piece falls through to the bar plan", () => {
    const result = planWithStock([{ label: "Long", length: 200, productId: "t1" }], [{ id: "s", productId: "t1", length: 100 }], settings);
    assert.equal(result.groups[0].fromStock.length, 0);
    assert.equal(result.groups[0].plan.oversized.length, 1);
});
