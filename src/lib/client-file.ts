// Client File: turns a lead's saved measurement into the rows printed in the
// client's physical file (measurements, tracks, curtains, blinds, accessories).
// Pure functions only (no DB, no path aliases) so they can be unit tested.
//
// The track rules mirror the "Sizes to Share" tab, so the file prints the same
// final sizes and the same cutting plan input:
//   final track size = size - 3" per finial - 0.5" per endcap - 3" per motor
//   curtain final height = height - 4"

export interface WindowRow {
    itemId: string;
    floor: string;
    room: string;
    window: string;
    type: string; // Curtain | Blind
    width: string;
    height: string;
    quantity: string;
    curtainType: string;
    mount: string;
    track: string; // "120\"" or "No"
    sheer: string; // "W x H, n panels, track 110\"" or "-"
    fabricId?: string;
    sheerFabricId?: string;
    trackProductId?: string;
    blindProductId?: string;
    fabricRequired: string;
    ties: boolean;
    remarks: string;
}

export interface TrackRow {
    floor: string;
    room: string;
    window: string;
    layer: "Main" | "Sheer";
    productId: string | null;
    size: number; // as measured, inches
    finials: number;
    endcaps: number;
    motors: number;
    finalSize: number; // cut size, inches
    mount: string;
}

export interface CurtainRow {
    itemId: string;
    floor: string;
    room: string;
    window: string;
    layer: "Main" | "Sheer";
    quantity: number;
    height: number;
    finalHeight: number;
    fabricId?: string;
    customFabric?: string;
    curtainType: string;
    mount: string;
    trackSize: number | null; // cut size of the track this curtain hangs on, null when there is no track
}

export interface BlindRow {
    floor: string;
    room: string;
    window: string;
    width: string;
    height: string;
    productId?: string;
    vendor: string;
    shade: string;
}

export interface Accessories {
    rippleCurtains: number;
    pinchCurtains: number;
    rings: number;
    hooks: number;
    ceilingBrackets: number;
    wallBrackets: number;
    finials: number;
    endcaps: number;
    motors: number;
    ties: number;
    umbrellaHooks: number;
    blinds: number;
}

export interface CutPiece {
    label: string;
    length: number;
    productId: string | null;
}

export interface JobSummary {
    windows: WindowRow[];
    tracks: TrackRow[];
    curtains: CurtainRow[];
    blinds: BlindRow[];
    accessories: Accessories;
    cutPieces: CutPiece[];
    vendors: { tracks: string; blinds: string; curtains: string };
    fabricComments: Record<string, string>;
}

const num = (v: unknown) => {
    const n = parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => parseFloat(n.toFixed(2));
const inch = (v: unknown) => (v === undefined || v === null || v === "" ? "-" : `${v}"`);

/** Brackets for one track: one every 36", at least 2. */
export function bracketsFor(inches: number): number {
    return Math.max(2, Math.ceil(inches / 36) + 1);
}

export function buildJobSummary(data: any): JobSummary {
    const floors: any[] = data?.floors || [];
    const shared = data?.sharedSizes || {};
    const specs: Record<string, any> = shared.itemSpecs || {};

    const windows: WindowRow[] = [];
    const tracks: TrackRow[] = [];
    const curtains: CurtainRow[] = [];
    const blinds: BlindRow[] = [];
    let ripple = 0, pinch = 0, windowsWithTies = 0;

    for (const floor of floors) {
        for (const room of floor.rooms || []) {
            for (const item of room.items || []) {
                const where = { floor: String(floor.name || "").trim(), room: String(room.name || "").trim(), window: String(item.name || "").trim() };
                const isCurtain = item.type === "Curtain";
                const hasTrack = isCurtain && item.trackRequired !== false;
                const mount = item.mountType || (isCurtain ? "Wall" : "-");

                windows.push({
                    itemId: item.id,
                    ...where,
                    type: item.type || "-",
                    width: inch(item.width),
                    height: inch(item.height),
                    quantity: String(item.quantity || "1"),
                    curtainType: isCurtain ? item.curtainType || "Ripple Fold" : "-",
                    mount: isCurtain ? mount : "-",
                    track: !isCurtain ? "-" : hasTrack ? inch(item.trackSize || item.width) : "No",
                    sheer: isCurtain && item.sheerRequired
                        ? `${inch(item.sheerWidth || item.width)} x ${inch(item.sheerHeight || item.height)}, ${item.sheerQuantity || "1"} panel(s)` +
                          (hasTrack ? `, track ${inch(item.sheerTrackSize || item.width)}` : "")
                        : "-",
                    fabricId: item.fabricProduct,
                    sheerFabricId: item.sheerFabricProduct,
                    trackProductId: item.trackProduct,
                    blindProductId: item.blindProduct,
                    fabricRequired: item.fabricRequired ? String(item.fabricRequired) : "-",
                    ties: !!item.tiesRequired,
                    remarks: item.remarks || "",
                });

                if (item.type === "Blind") {
                    const spec = specs[item.id] || {};
                    blinds.push({
                        ...where,
                        width: String(item.width ?? ""),
                        height: String(item.height ?? ""),
                        productId: item.blindProduct,
                        vendor: spec.customVendor || "Unassigned vendor",
                        shade: spec.shadeDetails || "-",
                    });
                    continue;
                }
                if (!isCurtain) continue;

                const layers: Array<{ layer: "Main" | "Sheer"; size: number; productId?: string }> = [];
                if (hasTrack) layers.push({ layer: "Main", size: num(item.trackSize || item.width), productId: item.trackProduct });
                if (hasTrack && item.sheerRequired) {
                    layers.push({ layer: "Sheer", size: num(item.sheerTrackSize || item.width), productId: item.sheerTrackProduct || item.trackProduct });
                }
                const trackCut: Record<string, number> = {};
                for (const l of layers) {
                    const spec = specs[`${item.id}-${l.layer === "Main" ? "main" : "sheer"}`] || {};
                    const finials = num(spec.finials), endcaps = num(spec.endcaps), motors = num(spec.motors);
                    trackCut[l.layer] = round2(l.size - finials * 3 - endcaps * 0.5 - motors * 3);
                    tracks.push({
                        ...where,
                        layer: l.layer,
                        productId: l.productId || null,
                        size: l.size,
                        finials, endcaps, motors,
                        finalSize: trackCut[l.layer],
                        mount,
                    });
                }

                const curtainType = item.curtainType || "Ripple Fold";
                const mainQty = num(item.quantity || "1");
                curtains.push({
                    itemId: item.id, ...where, layer: "Main", quantity: mainQty, height: num(item.height), finalHeight: round2(num(item.height) - 4),
                    fabricId: item.fabricProduct, customFabric: specs[`${item.id}-main-curtain`]?.customFabric, curtainType, mount,
                    trackSize: trackCut.Main ?? null,
                });
                let curtainCount = mainQty;
                if (item.sheerRequired) {
                    const sheerQty = num(item.sheerQuantity || "1");
                    const h = num(item.sheerHeight || item.height);
                    curtains.push({
                        itemId: item.id, ...where, layer: "Sheer", quantity: sheerQty, height: h, finalHeight: round2(h - 4),
                        fabricId: item.sheerFabricProduct, customFabric: specs[`${item.id}-sheer-curtain`]?.customFabric, curtainType, mount,
                        trackSize: trackCut.Sheer ?? null,
                    });
                    curtainCount += sheerQty;
                }
                if (curtainType === "Pinch Pleat") pinch += curtainCount;
                else ripple += curtainCount;
                if (item.tiesRequired) windowsWithTies++;
            }
        }
    }

    const sum = (f: (t: TrackRow) => number) => tracks.reduce((s, t) => s + f(t), 0);
    const rings = ripple * 11 + pinch * 7;
    const ties = windowsWithTies * 2;

    return {
        windows,
        tracks,
        curtains,
        blinds,
        accessories: {
            rippleCurtains: ripple,
            pinchCurtains: pinch,
            rings,
            hooks: rings,
            ceilingBrackets: sum((t) => (t.mount === "Ceiling" ? bracketsFor(t.size) : 0)),
            wallBrackets: sum((t) => (t.mount !== "Ceiling" ? bracketsFor(t.size) : 0)),
            finials: sum((t) => t.finials),
            endcaps: sum((t) => t.endcaps),
            motors: sum((t) => t.motors),
            ties,
            umbrellaHooks: ties > 0 ? ties + 2 : 0,
            blinds: blinds.length,
        },
        // Same labels and lengths as the Sizes to Share tab, so the cutting plan matches it
        cutPieces: tracks.map((t) => ({
            label: `${t.room} > ${t.window} ${t.layer}`,
            length: t.finalSize,
            productId: t.productId,
        })),
        vendors: { tracks: shared.vendors?.tracks || "", blinds: shared.vendors?.blinds || "", curtains: shared.vendors?.curtains || "" },
        fabricComments: shared.fabricComments || {},
    };
}

/** Track count and total running length per product, for the summary table. */
export function trackTotalsByProduct(tracks: TrackRow[], productNames: Record<string, string>) {
    const map = new Map<string, { name: string; count: number; totalInches: number }>();
    for (const t of tracks) {
        const name = (t.productId && productNames[t.productId]) || "Track product not selected";
        const row = map.get(name) || { name, count: 0, totalInches: 0 };
        row.count++;
        row.totalInches = round2(row.totalInches + t.finalSize);
        map.set(name, row);
    }
    return [...map.values()];
}
