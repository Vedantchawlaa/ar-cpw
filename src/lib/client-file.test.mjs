// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJobSummary, bracketsFor, trackTotalsByProduct } from "./client-file.ts";

const data = {
    floors: [{
        name: "Ground", rooms: [{
            name: "Living", items: [
                {
                    id: "w1", name: "Window 1", type: "Curtain", width: "100", height: "96", quantity: "2",
                    trackRequired: true, trackSize: "110", trackProduct: "t1", fabricProduct: "f1", mountType: "Ceiling",
                    curtainType: "Ripple Fold", sheerRequired: true, sheerQuantity: "2", sheerTrackSize: "108", sheerFabricProduct: "f2",
                    tiesRequired: true, remarks: "AC above",
                },
                { id: "w2", name: "Window 2", type: "Curtain", width: "60", height: "84", curtainType: "Pinch Pleat", trackProduct: "t1" },
                { id: "w3", name: "Window 3", type: "Curtain", width: "50", height: "80", trackRequired: false },
                { id: "b1", name: "Kitchen blind", type: "Blind", width: "36", height: "48", blindProduct: "bp" },
            ],
        }],
    }],
    sharedSizes: {
        itemSpecs: {
            "w1-main": { finials: 2, endcaps: 0, motors: 0 },
            "w1-sheer": { finials: 0, endcaps: "2", motors: 1 },
            "w1-main-curtain": { customFabric: "Velvet Blue" },
            b1: { customVendor: "BlindCo", shadeDetails: "Grey 04" },
        },
        vendors: { tracks: "TrackHouse", blinds: "", curtains: "" },
    },
};

test("tracks: final cut size after finials, endcaps and motors", () => {
    const s = buildJobSummary(data);
    assert.equal(s.tracks.length, 3); // w1 main + sheer, w2 main; w3 has no track
    const [main, sheer, w2] = s.tracks;
    assert.equal(main.finalSize, 104); // 110 - 2 finials x 3
    assert.equal(sheer.finalSize, 104); // 108 - 2 endcaps x 0.5 - 1 motor x 3
    assert.equal(sheer.productId, "t1"); // sheer falls back to the main track product
    assert.equal(w2.size, 60); // no track size: uses the width
    assert.equal(w2.mount, "Wall");
});

test("cut pieces use the same labels as the Sizes to Share tab", () => {
    const s = buildJobSummary(data);
    assert.deepEqual(s.cutPieces[0], { label: "Living > Window 1 Main", length: 104, productId: "t1" });
    assert.equal(s.cutPieces[1].label, "Living > Window 1 Sheer");
});

test("curtains, blinds and window rows", () => {
    const s = buildJobSummary(data);
    assert.equal(s.curtains.length, 4); // w1 main + sheer, w2, w3
    assert.equal(s.curtains[0].finalHeight, 92);
    assert.equal(s.curtains[0].customFabric, "Velvet Blue");
    assert.deepEqual(s.blinds.map((b) => [b.vendor, b.shade]), [["BlindCo", "Grey 04"]]);
    assert.equal(s.windows.length, 4);
    assert.equal(s.windows[0].track, '110"');
    assert.match(s.windows[0].sheer, /2 panel\(s\), track 108"/);
    assert.equal(s.windows[2].track, "No");
    assert.equal(s.vendors.tracks, "TrackHouse");
});

test("accessories", () => {
    const a = buildJobSummary(data).accessories;
    assert.equal(a.rippleCurtains, 5); // w1 2 + 2 sheer, w3 1
    assert.equal(a.pinchCurtains, 1);
    assert.equal(a.rings, 5 * 11 + 7);
    assert.equal(a.ceilingBrackets, bracketsFor(110) + bracketsFor(108));
    assert.equal(a.wallBrackets, bracketsFor(60));
    assert.equal(a.finials, 2);
    assert.equal(a.endcaps, 2);
    assert.equal(a.motors, 1);
    assert.equal(a.ties, 2);
    assert.equal(a.umbrellaHooks, 4);
    assert.equal(a.blinds, 1);
});

test("brackets and totals", () => {
    assert.equal(bracketsFor(30), 2);
    assert.equal(bracketsFor(110), 5);
    const totals = trackTotalsByProduct(buildJobSummary(data).tracks, { t1: "Rail X" });
    assert.deepEqual(totals, [{ name: "Rail X", count: 3, totalInches: 104 + 104 + 60 }]);
});

test("empty measurement", () => {
    const s = buildJobSummary(undefined);
    assert.equal(s.tracks.length, 0);
    assert.equal(s.accessories.rings, 0);
});

test("each curtain knows the cut size of its track", () => {
    const s = buildJobSummary(data);
    const by = Object.fromEntries(s.curtains.map((c) => [`${c.window} ${c.layer}`, c]));
    assert.equal(by["Window 1 Main"].trackSize, 104);
    assert.equal(by["Window 1 Sheer"].trackSize, 104);
    assert.equal(by["Window 2 Main"].trackSize, 60);
    assert.equal(by["Window 3 Main"].trackSize, null); // no track
    assert.equal(by["Window 1 Main"].mount, "Ceiling");
    assert.equal(by["Window 1 Main"].itemId, "w1");
});
