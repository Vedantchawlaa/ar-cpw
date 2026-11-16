// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAllocation, validateBuckets, DEFAULT_FUND_BUCKETS } from "./fund-allocation.ts";

test("default buckets are valid and add up to 100%", () => {
    assert.equal(validateBuckets(DEFAULT_FUND_BUCKETS), null);
});

test("income is split by percentage", () => {
    const s = computeAllocation(DEFAULT_FUND_BUCKETS, [
        { type: "INCOME", amount: 60000, category: "Sales" },
        { type: "INCOME", amount: 40000, category: "EXTRA" },
    ]);
    assert.equal(s.income, 100000);
    assert.deepEqual(s.buckets.map((b) => b.allocated), [55000, 12000, 8000, 8000, 11000, 5000, 1000]);
    assert.equal(s.buckets.reduce((t, b) => t + b.allocated, 0), 100000);
});

test("spend buckets count linked expenses, save buckets count transfers", () => {
    const buckets = DEFAULT_FUND_BUCKETS.map((b, i) => ({ ...b, id: `b${i}` }));
    const s = computeAllocation(
        buckets,
        [
            { type: "INCOME", amount: 100000, category: "Sales" },
            { type: "EXPENSE", amount: 30000, category: "Fabric Purchase" },
            { type: "EXPENSE", amount: 5000, category: "Accessory Purchase" },
            { type: "EXPENSE", amount: 1500, category: "Advertisement" },
            { type: "EXPENSE", amount: 800, category: "Courier" },
            { type: "EXPENSE", amount: 4000, category: "Silver" },
            { type: "EXPENSE", amount: 8000, category: "SIP" },
        ],
        { b4: 11000, b0: 15000 },
    );
    const by = Object.fromEntries(s.buckets.map((b) => [b.name, b]));
    // Spend buckets: only what is left after spending is to be moved
    assert.equal(by["Raw material"].moved, 15000);
    assert.equal(by["Raw material"].toMove, 5000); // 55000 - 35000 spent - 15000 moved
    assert.equal(by["Ads"].moved, 0);
    assert.equal(by["Ads"].toMove, 0); // overspent, nothing left
    assert.equal(by["Tools"].toMove, 5000); // nothing spent yet
    assert.equal(by["SIP"].toMove, 0);
    assert.equal(by["Raw material"].used, 35000);
    assert.equal(by["Raw material"].remaining, 20000);
    assert.equal(by["Raw material"].status, "ok");
    assert.equal(by["Ads"].used, 1500);
    assert.equal(by["Ads"].status, "over");
    assert.equal(by["Ads"].remaining, -500);
    // Silver and SIP transactions count as money moved to those accounts
    assert.equal(by["SIP"].moved, 8000);
    assert.equal(by["Silver"].moved, 4000);
    assert.equal(by["SIP"].used, 8000);
    assert.equal(by["SIP"].status, "near");
    assert.equal(by["Silver"].used, 4000);
    assert.equal(by["Silver"].remaining, 4000);
    assert.equal(by["Silver"].toMove, 4000);
    // Loan is still a move-to-account bucket: marking it moved uses it up
    assert.equal(by["Loans, cashflow & Home expense"].used, 11000);
    assert.equal(by["Loans, cashflow & Home expense"].toMove, 0);
    assert.deepEqual(s.unassigned, [{ category: "Courier", amount: 800 }]);
});

test("no income: spending shows as over, nothing allocated", () => {
    const s = computeAllocation(DEFAULT_FUND_BUCKETS, [{ type: "EXPENSE", amount: 100, category: "Rent" }]);
    assert.equal(s.income, 0);
    assert.equal(s.buckets[1].allocated, 0);
    assert.equal(s.buckets[1].status, "over");
    assert.equal(s.buckets[0].status, "ok");
});

test("validateBuckets rejects bad totals, duplicates and shared categories", () => {
    const base = DEFAULT_FUND_BUCKETS.map((b) => ({ ...b, categories: [...b.categories] }));
    assert.match(validateBuckets(base.map((b, i) => (i === 0 ? { ...b, percent: 50 } : b))), /95%/);
    assert.match(validateBuckets(base.map((b, i) => (i === 1 ? { ...b, name: "raw material" } : b))), /twice/);
    assert.match(validateBuckets(base.map((b, i) => (i === 5 ? { ...b, categories: ["Rent"] } : b))), /both/);
    assert.match(validateBuckets([]), /at least one/);
    assert.equal(validateBuckets([{ name: "All", percent: 100, kind: "SAVE", categories: [] }]), null);
});

test("move-to-account bucket: transaction and marked amount add up", () => {
    const buckets = DEFAULT_FUND_BUCKETS.map((b, i) => ({ ...b, id: `b${i}` }));
    const s = computeAllocation(buckets, [
        { type: "INCOME", amount: 100000, category: "Sales" },
        { type: "EXPENSE", amount: 5000, category: "SIP" },
    ], { b3: 2000 });
    const sip = s.buckets.find((b) => b.name === "SIP");
    assert.equal(sip.moved, 7000);
    assert.equal(sip.toMove, 1000);
    assert.equal(sip.remaining, 1000);
    assert.deepEqual(s.unassigned, []); // SIP is claimed by its bucket
});
