// Reads a printed vendor bill from its text (PDF text or OCR of a photo) using
// plain rules, no AI. Pure functions only (no DB, no path aliases) so they can be unit tested.
//
// An item line is any line with three numbers where a x b = c (qty x rate = amount,
// within 1%). Bill no., date and GST % come from their usual labels.

export interface ParsedBill {
    billNo: string;
    date: string; // YYYY-MM-DD, or "" when not found
    gstPercent: number; // 0 when no GST found
    roundOff: number; // "R/O 0.20" / "Round Off (-)0.30"; 0 when not printed
    items: Array<{ item: string; qty: number; price: number }>;
}

interface Num { value: number; start: number; end: number }

const SKIP_LINE = /\b(sub\s*-?\s*total|grand\s*total|total|cgst|sgst|igst|utgst|gst\s*amount|tax(able)?\s*(amount|value)?|round(ed)?\s*off|amount\s*in\s*words|balance|discount|rupees|net\s*amount|bank|a\/c|ifsc)\b/i;

/** Numbers in a line, without percentages, dates or digits inside codes like "VEL-2201". */
function numbersIn(line: string): Num[] {
    const out: Num[] = [];
    const re = /\d[\d,]*(?:\.\d+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
        const start = m.index, end = start + m[0].length;
        const before = line[start - 1] ?? " ", after = line[end] ?? " ";
        if (/[A-Za-z\-\/_]/.test(before) || /[A-Za-z\/\-_]/.test(after) && !/^\s/.test(after)) {
            // part of a code (VEL-2201, 12/11/26, 5x) - but allow units written right after: "10mtr", "4pcs"
            if (!/^(m|mt|mtr|mtrs|meter|metre|meters|metres|pc|pcs|nos|no|sqft|ft|kg|rs)\b/i.test(line.slice(end)) || /[A-Za-z\-\/_]/.test(before)) continue;
        }
        if (/^\s*%/.test(line.slice(end))) continue; // a percentage (GST column)
        const value = parseFloat(m[0].replace(/,/g, ""));
        if (Number.isFinite(value)) out.push({ value, start, end });
    }
    return out;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.6, Math.abs(b) * 0.01);

/** Finds qty, rate and amount in a line: a x b = c, preferring the amount nearest the end. */
function itemFromLine(line: string, rateFirst: boolean): { item: string; qty: number; price: number } | null {
    const nums = numbersIn(line);
    for (let k = nums.length - 1; k >= 2; k--) {
        for (let j = k - 1; j >= 1; j--) {
            for (let i = j - 1; i >= 0; i--) {
                const a = nums[i].value, b = nums[j].value, c = nums[k].value;
                if (a <= 0 || b <= 0 || c <= 0 || !close(a * b, c)) continue;
                const [qty, price] = rateFirst ? [b, a] : [a, b];
                let item = line.slice(0, nums[i].start)
                    .replace(/^\s*(?:\d{1,3}\s*[.)\-:]?\s+)/, "") // serial no.
                    .replace(/\s+\d{4,8}\s*$/, "") // HSN code
                    .replace(/[|:\-–\s]+$/, "")
                    .replace(/^[|:\-–\s]+/, "")
                    .replace(/\s{2,}/g, " ")
                    .trim();
                if (!/[A-Za-z]/.test(item)) item = "";
                return { item, qty, price: Math.round(price * 100) / 100 };
            }
        }
    }
    return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toDay(d: number, m: number, y: number): string {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dateIn(line: string): string {
    let m = line.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})\b/);
    if (m) return toDay(+m[1], +m[2], +m[3]); // day first
    m = line.match(/\b(\d{1,2})[\s\-\/.]*([A-Za-z]{3})[A-Za-z]*[\s\-\/.,]*(\d{2,4})\b/);
    if (m && MONTHS.includes(m[2].toLowerCase())) return toDay(+m[1], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[3]);
    return "";
}

function findBillNo(lines: string[]): string {
    const re = /\b(?:invoice|inv|bill|memo|challan|receipt|estimate)\s*(?:no|number|num|#)?\s*\.?\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-]*)/gi;
    for (const line of lines) {
        for (const m of line.matchAll(re)) {
            const v = m[1];
            if (/\d/.test(v) && !/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(v)) return v;
        }
    }
    // "Invoice No." alone on a line, the number at the start of the next line (Tally layout)
    for (let i = 0; i < lines.length - 1; i++) {
        if (!/\b(?:invoice|inv|bill)\s*(?:no|number|#)\.?\s*:?\s*$/i.test(lines[i])) continue;
        const v = lines[i + 1].match(/^([A-Za-z0-9][A-Za-z0-9\/\-]*)/)?.[1];
        if (v && /\d/.test(v)) return v;
    }
    return "";
}

function findDate(lines: string[]): string {
    const ack = (l: string) => /\back\b|\birn\b/i.test(l); // e-invoice acknowledgement date, not the bill date
    // "Dated" at the end of a line, the date on the next line (Tally layout)
    for (let i = 0; i < lines.length - 1; i++) {
        if (/\bdated?\s*:?\s*$/i.test(lines[i]) && !ack(lines[i])) { const d = dateIn(lines[i + 1]); if (d) return d; }
    }
    for (const line of lines) if (/date|dt\b|dated/i.test(line) && !ack(line)) { const d = dateIn(line); if (d) return d; }
    for (const line of lines) if (/date|dt\b|dated/i.test(line)) { const d = dateIn(line); if (d) return d; }
    for (const line of lines) { const d = dateIn(line); if (d) return d; }
    return "";
}

const pct = (s: string | undefined) => (s ? parseFloat(s) : NaN);

const GST_SLABS = [3, 5, 12, 18, 28, 40];

/** GST % from tax amounts ("CGST 579.98") against the bill's taxable value, snapped to a GST slab. */
function gstFromAmounts(lines: string[], taxable: number): number {
    if (taxable <= 0) return 0;
    let tax = 0;
    for (const l of lines) {
        const m = l.match(/^(?:CGST|SGST|UTGST|IGST)\b[^\d%]*([\d,]+(?:\.\d+)?)\s*$/i);
        if (m) tax += parseFloat(m[1].replace(/,/g, ""));
    }
    if (tax <= 0) return 0;
    const rate = (tax / taxable) * 100;
    return GST_SLABS.find((s) => Math.abs(rate - s) <= s * 0.03) ?? 0;
}

function findGst(text: string, itemLines: string[], lines: string[], taxable: number): number {
    const igst = text.match(/IGST[^%\n]{0,20}?(\d{1,2}(?:\.\d+)?)\s*%/i);
    if (igst) return pct(igst[1]);
    const c = text.match(/CGST[^%\n]{0,20}?(\d{1,2}(?:\.\d+)?)\s*%/i);
    const s = text.match(/(?:SGST|UTGST)[^%\n]{0,20}?(\d{1,2}(?:\.\d+)?)\s*%/i);
    if (c && s) return pct(c[1]) + pct(s[1]);
    if (c) return pct(c[1]) * 2;
    const fromAmounts = gstFromAmounts(lines, taxable);
    if (fromAmounts) return fromAmounts;
    const g = text.match(/\bGST[^%\n]{0,20}?(\d{1,2}(?:\.\d+)?)\s*%/i);
    if (g) return pct(g[1]);
    // a GST % column on the item lines, when every line has the same rate
    const rates = itemLines.map((l) => l.match(/(\d{1,2}(?:\.\d+)?)\s*%/)?.[1]).filter(Boolean).map(Number);
    if (rates.length > 0 && rates.length === itemLines.length && rates.every((r) => r === rates[0])) return rates[0];
    return 0;
}

const CHARGE_LINE = /^((?:freight|cartage|transport(?:ation)?|packing|forwarding|loading|courier|delivery charges?|labour|fitting)[A-Za-z &\/.]*?)\s*[:\-]?\s*(?:rs\.?\s*)?[\d,]+(?:\.\d+)?\s*$/i;

const NOISE_LINE = /^(batch\b|created by|this is a computer|--\s*\d+\s*of\s*\d+|page\s*\d+)/i;

/**
 * Item name printed on the lines above its qty/rate/amount line (Tally layout):
 * "1 VENICE FABRIC (540710)" / "Batch : Primary Batch 540710 13 MTR" / "13 290 MTR 3,770".
 * Starts at the last "serial no. + words" line and drops HSN codes and batch lines.
 */
function nameAbove(lines: string[], from: number, to: number): string {
    let start = -1;
    for (let i = to - 1; i >= from; i--) if (/^\d{1,3}[.)]?\s+[A-Za-z]/.test(lines[i])) { start = i; break; }
    if (start < 0) return "";
    const parts: string[] = [];
    for (let i = start; i < to; i++) {
        const l = lines[i];
        if (NOISE_LINE.test(l) || /^\(?\d{4,8}\)?(\s+[\d.]+\s*[A-Za-z]{0,5})?$/.test(l)) continue;
        parts.push(i === start ? l.replace(/^\d{1,3}[.)]?\s+/, "") : l);
    }
    return parts.join(" ")
        .replace(/\(\s*\d{4,8}\s*\)/g, "") // (HSN)
        .replace(/\b\d{1,2}(?:\.\d+)?\s*%/g, "") // GST % printed in the name
        .replace(/\s{2,}/g, " ")
        .trim();
}

/** Round off printed on the bill, with its sign: "R/O 0.2", "Round Off (-)0.30", "Less: Rounding -0.4". */
function findRoundOff(lines: string[]): number {
    for (const l of lines) {
        const m = l.match(/\b(?:r\s*\/\s*o|round(?:ed|ing)?\s*(?:off)?)\b\s*[:.]?\s*(\(\s*[-+]\s*\)|[-+])?\s*(?:rs\.?|₹)?\s*(\d{1,2}(?:\.\d+)?)\s*$/i);
        if (!m) continue;
        const v = parseFloat(m[2]);
        const minus = /-/.test(m[1] ?? "") || /^less\b/i.test(l);
        return Math.round((minus ? -v : v) * 100) / 100;
    }
    return 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Round off that makes the ledger's total match the bill's printed total. The vendor's
 * own tax rounding (CGST and SGST rounded separately) can leave a paisa, so prefer the
 * printed "Total" line when it is within ₹2 of our total; else use the printed R/O.
 */
function roundOffFor(lines: string[], items: ParsedBill["items"], gst: number): number {
    // same math as the ledger: each line rounded to paisa, GST per line
    const ours = r2(items.reduce((s, i) => { const base = r2(i.qty * i.price); return s + base + r2(base * gst / 100); }, 0));
    if (ours > 0) {
        for (const l of lines) {
            if (!/^(grand\s*total|net\s*(amount|payable)|total(\s*amount)?|amount\s*payable|bill\s*amount)\b/i.test(l)) continue;
            const nums = numbersIn(l);
            const printed = nums[nums.length - 1]?.value;
            if (printed && Math.abs(printed - ours) < 2) return r2(printed - ours);
        }
    }
    return findRoundOff(lines);
}

export function parseBillText(text: string): ParsedBill {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, "  ").trim()).filter(Boolean);

    // Column order: most bills are Qty, Rate, Amount; some put Rate before Qty.
    const header = lines.find((l) => /\b(qty|quantity|mtrs?|pcs)\b/i.test(l) && /\brate\b/i.test(l));
    const rateFirst = !!header && header.search(/\brate\b/i) < header.search(/\b(qty|quantity|mtrs?|pcs)\b/i);

    const items: ParsedBill["items"] = [];
    const itemLines: string[] = [];
    let lastItemAt = lines.indexOf(header ?? "");
    lines.forEach((line, at) => {
        if (SKIP_LINE.test(line) || line === header) return;
        const item = itemFromLine(line, rateFirst);
        if (item) {
            items.push({ ...item, item: item.item || nameAbove(lines, lastItemAt + 1, at) || `Item ${items.length + 1}` });
            itemLines.push(line);
            lastItemAt = at;
            return;
        }
        // extra charges on the bill ("FREIGHT & CARTAGE 300"), after the items
        const charge = items.length > 0 && line.match(CHARGE_LINE);
        const nums = charge ? numbersIn(line) : [];
        if (charge && nums.length === 1 && nums[0].value > 0) {
            items.push({ item: charge[1].replace(/\s{2,}/g, " ").trim().replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()), qty: 1, price: nums[0].value });
        }
    });

    const taxable = items.reduce((s, i) => s + i.qty * i.price, 0);
    const gst = findGst(text, itemLines, lines, taxable);
    return {
        billNo: findBillNo(lines),
        date: findDate(lines),
        gstPercent: gst > 0 && gst <= 40 ? gst : 0,
        roundOff: roundOffFor(lines, items, gst > 0 && gst <= 40 ? gst : 0),
        items,
    };
}
