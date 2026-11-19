// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBillText } from "./bill-text-parser.ts";

test("GST invoice with HSN codes, CGST + SGST, totals skipped", () => {
    const text = `RAJ FABRICS
Shop 12, Cloth Market, Delhi   GSTIN: 07ABCDE1234F1Z5
Tax Invoice
Invoice No: RF/1042        Date: 12/11/2026
S.No  Description          HSN    Qty    Rate     Amount
1     Velvet Blue 2201     5407   25.5   320.00   8,160.00
2     Sheer White S-14     5407   18     180      3,240.00
3     Blackout Lining      5903   20     95.50    1,910.00
                           Sub Total              13,310.00
CGST @ 2.5%                                         332.75
SGST @ 2.5%                                         332.75
Grand Total                                      13,975.50
Rupees Thirteen Thousand Nine Hundred Seventy Five Only`;
    const b = parseBillText(text);
    assert.equal(b.billNo, "RF/1042");
    assert.equal(b.date, "2026-11-12");
    assert.equal(b.gstPercent, 5);
    assert.deepEqual(b.items, [
        { item: "Velvet Blue 2201", qty: 25.5, price: 320 },
        { item: "Sheer White S-14", qty: 18, price: 180 },
        { item: "Blackout Lining", qty: 20, price: 95.5 },
    ]);
});

test("estimate with units, Indian commas, no GST", () => {
    const b = parseBillText(`Bill No. 77   Dt. 3-Nov-26
Roller blind grey   4 pcs   2,450   9,800
Zebra blind         2pcs    3,100   6,200
Total 16,000`);
    assert.equal(b.billNo, "77");
    assert.equal(b.date, "2026-11-03");
    assert.equal(b.gstPercent, 0);
    assert.deepEqual(b.items.map((i) => [i.item, i.qty, i.price]), [["Roller blind grey", 4, 2450], ["Zebra blind", 2, 3100]]);
});

test("rate before qty in the header, IGST, GST % column ignored as a number", () => {
    const b = parseBillText(`INVOICE # TS-889
Date 05.11.2026
Item                 Rate    Qty   GST   Amount
M-track 10 ft        650     6     18%   3900
Bracket set          45      30    18%   1350
IGST 18%  945`);
    assert.equal(b.billNo, "TS-889");
    assert.equal(b.date, "2026-11-05");
    assert.equal(b.gstPercent, 18);
    assert.deepEqual(b.items.map((i) => [i.item, i.qty, i.price]), [["M-track 10 ft", 6, 650], ["Bracket set", 30, 45]]);
});

test("GST read from the item column when no tax line, and nothing found in plain text", () => {
    const b = parseBillText(`Sheer 2201   10   200   5%   2000\nLining   5   100   5%   500`);
    assert.equal(b.gstPercent, 5);
    assert.equal(b.items.length, 2);
    const none = parseBillText("Thank you for your business");
    assert.deepEqual(none, { billNo: "", date: "", gstPercent: 0, roundOff: 0, items: [] });
});

test("Tally / BizAnalyst e-invoice: names above the numbers, bill no. on next line, GST from amounts, freight", () => {
    const b = parseBillText(`TAX INVOICE
e-Invoice
Ack No. : 132600000000000
Ack Date : 03 Nov 26
SAMPLE FABS
Invoice No.
KF/13728/26-27 Dated
02 Nov 26
Buyers Order No. Dated
No. Description of Goods/Services HSN/SAC Quantity Rate per Disc. % Amount
1 VENICE FABRIC (540710)
Batch : Primary Batch 540710 13 MTR
13 290 MTR 3,770
2 SPRING FOIL FABRIC
(540761)
Batch : Primary Batch
54076110 86.55 MTR
86.55 200 MTR 17,310
Created by https://bizanalyst.in
-- 1 of 2 --
This is a Computer Generated Invoice
3 READY BLIND ZEBRA 5%
(63039200)
21203 PELMET
Batch : Primary Batch
63039200 4 PCS
4 2,429 PCS 9,716
FREIGHT & CARTAGE 300
CGST 777.4
SGST 777.4
R/O 0.2
Total 32,651`);
    assert.equal(b.roundOff, 0.2);
    assert.equal(b.billNo, "KF/13728/26-27");
    assert.equal(b.date, "2026-11-02");
    assert.equal(b.gstPercent, 5);
    assert.deepEqual(b.items, [
        { item: "VENICE FABRIC", qty: 13, price: 290 },
        { item: "SPRING FOIL FABRIC", qty: 86.55, price: 200 },
        { item: "READY BLIND ZEBRA 21203 PELMET", qty: 4, price: 2429 },
        { item: "Freight & Cartage", qty: 1, price: 300 },
    ]);
});

test("round off with a minus sign", () => {
    assert.equal(parseBillText("Round Off (-)0.30\nGrand Total 1,200").roundOff, -0.3);
    assert.equal(parseBillText("Less : Round off 0.45").roundOff, -0.45);
    assert.equal(parseBillText("Rounded Off  -0.4").roundOff, -0.4);
});
