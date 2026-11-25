// Stock kinds and their units. Kept free of imports so the web app, the
// mobile app and the tests can all use the same rules.
//   FABRIC    - cut pieces, measured in metres
//   TRACK     - pieces, measured in inches, shown as ft + in
//   ACCESSORY - counted in nos
//   OTHER     - not stock-tracked (e.g. blinds, made to order)

export const STOCK_KINDS = ["FABRIC", "TRACK", "ACCESSORY", "OTHER"] as const;
export type StockKind = (typeof STOCK_KINDS)[number];

export const STOCK_KIND_LABELS: Record<StockKind, string> = {
    FABRIC: "Fabric",
    TRACK: "Track",
    ACCESSORY: "Accessory",
    OTHER: "Not tracked",
};

export const isStockKind = (value: unknown): value is StockKind =>
    typeof value === "string" && (STOCK_KINDS as readonly string[]).includes(value);

/** Kinds whose stock is a set of individual pieces rather than a count. */
export const isPieceKind = (kind: string) => kind === "FABRIC" || kind === "TRACK";

/** Best guess from the existing free-text category and the name. */
export function inferStockKind(category: string | null | undefined, name: string | null | undefined): StockKind {
    const c = (category ?? "").toLowerCase();
    const n = (name ?? "").toLowerCase();
    if (c.includes("fabric") || n.includes("fabric")) return "FABRIC";
    if (c.includes("track") || c.includes("rod") || n.includes("track") || n.includes("rod")) return "TRACK";
    if (c.includes("blind") || n.includes("blind")) return "OTHER";
    return "ACCESSORY";
}

/** "Jumbo Track", "jumbo-track" and "JUMBO  TRACK" all compare equal. */
export const looseProductName = (name: string) => (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Product pickers on the measurement sheet, and the category a product added from each gets. */
export type PickerKind = "TRACK" | "FABRIC" | "BLIND";
export const PICKER_CATEGORY: Record<PickerKind, string> = { TRACK: "Tracks", FABRIC: "Fabric", BLIND: "Blind" };

/** Whether the measurement sheet's picker of this kind lists the product. */
export function listedInPicker(kind: PickerKind, p: { name: string; category?: string | null }) {
    const n = (p.name || "").toLowerCase(), c = (p.category || "").toLowerCase();
    if (kind === "TRACK") return n.includes("track") || c.includes("track");
    if (kind === "FABRIC") return n.includes("fabric") || c === "fabric";
    return n.includes("blind") || c === "blind";
}

const trim = (value: number) => Number(value.toFixed(2)).toString();

/** 55 -> `4 ft 7 in`, 60 -> `5 ft`, 7.5 -> `7.5 in`. */
export function formatFeetInches(inches: number): string {
    if (!Number.isFinite(inches)) return "0 in";
    const negative = inches < 0;
    const total = Math.round(Math.abs(inches) * 100) / 100;
    const feet = Math.floor(total / 12);
    const rest = Math.round((total - feet * 12) * 100) / 100;
    const parts: string[] = [];
    if (feet > 0) parts.push(`${feet} ft`);
    if (rest > 0 || feet === 0) parts.push(`${trim(rest)} in`);
    return (negative ? "-" : "") + parts.join(" ");
}

export const feetInchesToInches = (feet: number, inches: number) => (feet || 0) * 12 + (inches || 0);

export const formatMetres = (metres: number) => `${trim(metres)} m`;

/** A quantity in the kind's base unit, formatted for people. */
export function formatStockQuantity(kind: string, quantity: number): string {
    if (kind === "FABRIC") return formatMetres(quantity);
    if (kind === "TRACK") return formatFeetInches(quantity);
    return `${trim(quantity)} nos`;
}

export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
    ADD: "Added",
    USE: "Used",
    DISCARD: "Discarded",
    ADJUST: "Adjusted",
};

// Lengths are compared in 1/1000 of a unit so float noise never leaves a 0.0000001 m piece behind
const EPSILON = 0.0005;
export const isUsedUp = (remaining: number) => remaining <= EPSILON;
