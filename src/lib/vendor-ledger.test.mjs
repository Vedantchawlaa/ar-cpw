// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeVendor, paymentIsFor, lastPrice, vendorNames, mergeVendors, asKind, lineTotal, lastGst, ledgerEntries, duplicateBills, looseLineTotal, vendorStatement, monthPeriod, prevMonth } from "./vendor-ledger.ts";

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

test("directory entries win over names only seen in ledger rows", () => {
    const list = mergeVendors(
        [{ id: "1", name: "Parveen Kamboj", kind: "STITCHING" }, { id: "2", name: "Shades Co", kind: "BLINDS" }],
        [{ name: "parveen kamboj", kind: "OTHER" }, { name: "Raj Fabrics", kind: "FABRIC" }, { name: " ", kind: "OTHER" }],
    );
    assert.deepEqual(list.map((v) => [v.name, v.kind, v.id]), [
        ["Parveen Kamboj", "STITCHING", "1"], ["Raj Fabrics", "FABRIC", null], ["Shades Co", "BLINDS", "2"],
    ]);
    assert.equal(asKind("FABRIC"), "FABRIC");
    assert.equal(asKind("nope"), "OTHER");
});

test("GST is added per line and shown apart from the subtotal", () => {
    const work = [
        { id: "a", vendor: "Raj Fabrics", nos: 10, type: "Velvet", date: "2026-11-01", price: 300, gstPercent: 5, refNo: "B-101" },
        { id: "b", vendor: "Raj Fabrics", nos: 4, type: "Sheer", date: "2026-11-02", price: 250.5, gstPercent: 12 },
        { id: "c", vendor: "Raj Fabrics", nos: 2, type: "Lining", date: "2026-11-03", price: 100 }, // no GST
    ];
    assert.equal(lineTotal(work[0]), 3150);
    assert.equal(lineTotal(work[1]), 1122.24);
    const s = summarizeVendor("Raj Fabrics", work, [{ id: "p", date: "2026-11-04", amount: 4000, description: "raj fabrics bill B-101" }]);
    assert.equal(s.subtotal, 4202);
    assert.equal(s.gst, 270.24);
    assert.equal(s.roundOff, -0.24); // the 1,122.24 line is charged as 1,122
    assert.equal(s.workTotal, 4472);
    assert.equal(s.due, 472);
    assert.equal(looseLineTotal(work[1]), 1122);
    assert.equal(lastGst(work, "raj fabrics"), null); // latest line has GST off
    assert.equal(lastGst(work.slice(0, 2), "Raj Fabrics"), 12);
});

test("lines of one bill are grouped under it, loose lines stay single, all in date order", () => {
    const bill = { id: "B1", vendor: "Raj", refNo: "101", date: "2026-11-05", gstPercent: 5, notes: null, attachmentId: "a1", fileName: "bill.jpg" };
    const rows = [
        { id: "1", vendor: "Raj", nos: 10, type: "Velvet", date: "2026-11-05", price: 300, gstPercent: 5, billId: "B1" },
        { id: "2", vendor: "Raj", nos: 1, type: "Hooks", date: "2026-11-01", price: 50 },
        { id: "3", vendor: "Raj", nos: 2, type: "Lining", date: "2026-11-05", price: 100, gstPercent: 5, billId: "B1" },
        { id: "4", vendor: "Raj", nos: 1, type: "Old", date: "2026-11-09", price: 10, billId: "gone" }, // bill deleted: shows as a loose line
    ];
    const e = ledgerEntries(rows, [bill]);
    assert.deepEqual(e.map((x) => x.kind === "bill" ? `bill:${x.lines.length}` : `line:${x.row.id}`), ["line:2", "bill:2", "line:4"]);
    assert.equal(e[1].subtotal, 3200);
    assert.equal(e[1].gst, 160);
    assert.equal(e[1].total, 3360);
});

test("bill round off counts in the bill and the grand total", () => {
    const work = [
        { id: "a", vendor: "Kapoor Fabs", nos: 4, type: "Zebra", date: "2026-11-16", price: 2429, gstPercent: 5, billId: "b1" },
        { id: "b", vendor: "Kapoor Fabs", nos: 1, type: "Freight", date: "2026-11-16", price: 300, gstPercent: 5, billId: "b1" },
    ];
    const bills = [{ id: "b1", vendor: "Kapoor Fabs", refNo: "KF/14695", date: "2026-11-16", gstPercent: 5, roundOff: 0.2, notes: null, attachmentId: null, fileName: null }];
    const s = summarizeVendor("Kapoor Fabs", work, [], bills);
    assert.equal(s.roundOff, 0.2);
    assert.equal(s.workTotal, 10517);
    const [e] = ledgerEntries(s.rows, bills);
    assert.equal(e.total, 10517);
    assert.equal(summarizeVendor("Kapoor Fabs", work, []).workTotal, 10517); // without the bill: each line rounded on its own
    // a bill saved before round off existed is rounded to the rupee
    assert.equal(summarizeVendor("Kapoor Fabs", work, [], [{ ...bills[0], roundOff: null }]).workTotal, 10517);
});

test("duplicate bills: same file or same bill no. for the same vendor", () => {
    const b = (id, vendor, refNo, fileHash = null) => ({ id, vendor, refNo, date: "2026-11-02", gstPercent: 5, notes: null, attachmentId: null, fileName: null, fileHash });
    const d = duplicateBills([
        b("1", "Kapoor Fabs", "KF/13728/26-27", "h1"),
        b("2", "kapoor fabs", "kf/13728/26-27 ", "h2"), // same no., other case/space
        b("3", "Raj Fabrics", "X-1", "h1"), // same file as 1
        b("4", "Raj Fabrics", "KF/13728/26-27"), // same no. but another vendor: fine
        b("5", "Raj Fabrics", null), b("6", "Raj Fabrics", ""), // no number: never flagged
    ]);
    assert.deepEqual([...d.keys()].sort(), ["1", "2", "3"]);
    assert.equal(d.get("3"), "Same file uploaded twice");
    assert.equal(d.get("2"), "Same bill no. entered twice");
});

test("loose lines with GST round to the rupee (A1 style)", () => {
    const work = [22784, 2425.5, 15329, 6400, 3916.8].map((price, i) => ({ id: String(i), vendor: "A1", nos: 1, type: "mosha", date: "2026-11-0" + (i + 1), price, gstPercent: 5 }));
    const s = summarizeVendor("A1", work, [{ id: "p", date: "2026-11-09", amount: 20000, description: "A1 payment" }], []);
    assert.equal(s.workTotal, 53398);
    assert.equal(s.due, 33398);
    assert.equal(Number.isInteger(s.workTotal), true);
});

test("monthly statement: opening balance, period bills and payments, closing", () => {
    const nov = monthPeriod("2026-11");
    assert.deepEqual(nov, { from: "2026-11-01", to: "2026-11-30" });
    assert.deepEqual(monthPeriod("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
    assert.equal(prevMonth("2026-01"), "2025-12");
    const s = vendorStatement("Parveen", sheet, payouts, [], nov);
    assert.equal(s.opening, 3305); // Oct work 8305 - Oct payment 5000
    assert.equal(s.period.workTotal, 2250);
    assert.equal(s.period.paid, 2000);
    assert.equal(s.closing, 3555); // same as the all-time balance
    const all = vendorStatement("Parveen", sheet, payouts, [], { from: null, to: null });
    assert.equal(all.opening, 0);
    assert.equal(all.closing, 3555);
    // a date range: only Oct 26 - Nov 2
    const r = vendorStatement("Parveen", sheet, payouts, [], { from: "2026-10-26", to: "2026-11-02" });
    assert.equal(r.period.pieces, 40);
    assert.equal(r.period.paid, 0);
});

test("a bill counts on its bill date, never split across months", () => {
    const work = [
        { id: "a", vendor: "K", nos: 1, type: "x", date: "2026-10-30", price: 100, billId: "b1" },
        { id: "b", vendor: "K", nos: 1, type: "y", date: "2026-11-01", price: 50, billId: "b1" },
    ];
    const bills = [{ id: "b1", vendor: "K", refNo: "1", date: "2026-11-01", gstPercent: null, roundOff: null, notes: null, attachmentId: null, fileName: null }];
    assert.equal(vendorStatement("K", work, [], bills, monthPeriod("2026-11")).period.workTotal, 150);
    assert.equal(vendorStatement("K", work, [], bills, monthPeriod("2026-10")).period.workTotal, 0);
});
