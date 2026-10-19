// Turns uploaded files (CSV / Excel rows / PDF text) into transaction rows.
// Pure functions only - no DB, no network - so they can be unit tested.
// Handles both simple hand-made sheets ("amount, details") and bank statements
// (preamble rows, Debit/Credit or Withdrawal/Deposit columns, running balance).

export type TransactionType = "INCOME" | "EXPENSE";

export interface ImportedTransaction {
    date: string; // YYYY-MM-DD
    type: TransactionType;
    amount: number; // always positive
    category: string;
    description: string;
    needsReview?: boolean; // income/expense could not be read from the file and was guessed
}

export interface ImportResult {
    rows: ImportedTransaction[];
    warnings: string[];
}

export const EXPENSE_CATEGORIES = [
    "Food",
    "Salary",
    "Vehicle maintenance & Fuel",
    "Utilities",
    "Other",
    "Rent",
    "Fabric Purchase",
    "Accessory Purchase",
    "Advertisement",
];

export const INCOME_CATEGORIES = ["Sales", "Car Income", "EXTRA"];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_PATTERN = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";

const pad = (n: number) => String(n).padStart(2, "0");

function toIsoDate(year: number, month: number, day: number): string | null {
    if (year < 100) year += 2000;
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Accepts 2026-04-01, 01/04/2026, 1-4-26, 01-Apr-2026, 1 April 2026, Apr 1, 2026,
// JS Dates and Excel serial numbers. Day comes first unless `monthFirst` is set.
export function parseDate(raw: unknown, monthFirst = false): string | null {
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : toIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
    }
    if (typeof raw === "number") {
        if (!Number.isFinite(raw) || raw < 20000 || raw > 80000) return null;
        const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000);
        return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    if (typeof raw !== "string") return null;
    const s = raw.trim().toLowerCase();
    if (!s) return null;

    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
    if (m) return toIsoDate(+m[1], +m[2], +m[3]);

    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/);
    if (m) return monthFirst ? toIsoDate(+m[3], +m[1], +m[2]) : toIsoDate(+m[3], +m[2], +m[1]);

    m = s.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[-/.\\s,]*(${MONTH_PATTERN})[-/.\\s,']*(\\d{4}|\\d{2})(?!\\d)`));
    if (m) return toIsoDate(+m[3], MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]);

    m = s.match(new RegExp(`^(${MONTH_PATTERN})[-/.\\s]*(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+(\\d{4})(?!\\d)`));
    if (m) return toIsoDate(+m[3], MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]);

    return null;
}

// "1,23,456.50", "Rs. 500", "(250.00)", "-90", "1,000.00 Cr" ...
export function parseAmount(raw: unknown): { value: number; marker?: TransactionType } | null {
    if (typeof raw === "number") return Number.isFinite(raw) ? { value: raw } : null;
    if (typeof raw !== "string") return null;
    let s = raw.trim();
    if (!s) return null;

    let marker: TransactionType | undefined;
    const tail = s.match(/(?<![a-z])\(?(cr|dr|credit|debit)\)?\.?\s*$/i);
    const head = tail ? null : s.match(/^(cr|dr)(?![a-z])\.?/i);
    const found = tail || head;
    if (found) {
        marker = /^c/i.test(found[1]) ? "INCOME" : "EXPENSE";
        s = s.replace(found[0], "").trim();
    }

    const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
    s = s.replace(/₹|rs\.?|inr/gi, "").replace(/[,\s()]/g, "").replace(/^[-+]|[-+]$/g, "");
    if (!/^(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
    const value = parseFloat(s);
    return { value: negative ? -value : value, marker };
}

export function parseType(raw: unknown): TransactionType | null {
    if (typeof raw !== "string") return null;
    const s = raw.trim().toLowerCase();
    if (/^(cr|c|credit|credited|income|in|inflow|received|receipt|deposit|sale|sales)\b/.test(s)) return "INCOME";
    if (/^(dr|d|debit|debited|expense|expenses|out|outflow|paid|payment|withdrawal|spent|purchase)\b/.test(s)) return "EXPENSE";
    return null;
}

const CATEGORY_RULES: Record<TransactionType, Array<[string, RegExp]>> = {
    EXPENSE: [
        ["Rent", /\brent\b/i],
        ["Salary", /\b(salary|salaries|wages?|labou?r|karigar|staff|tailor|stitching)\b/i],
        ["Vehicle maintenance & Fuel", /\b(petrol|petro|diesel|fuels?|cng|filling|hpcl|bpcl|iocl|indian ?oil|bharat petroleum|hp petrol|puncture|puncher|fastag|toll|parking|tyres?|tyer|tube|car wash|engine oil|car service|bike service|i10 service|vehicle|mechanic|motors|moter|service stati\w*|foot mats)\b/i],
        ["Advertisement", /\b(ads?|advert\w*|google ads|facebook\w*|meta|instagram|justdial|indiamart|marketing|canva|pamphlets?|banner|flex|hoarding|promotion)\b/i],
        ["Fabric Purchase", /\b(fabrics?|cloth|textiles?|d ?decor|sheer|lining|blackout|velvet|linen)\b/i],
        ["Accessory Purchase", /\b(tracks?|rods?|brackets?|hooks?|rings?|tapes?|accessor\w+|hardware|runners?|finials?|motors?|blinds?|eyelets?|channel)\b/i],
        ["Utilities", /\b(electricity|bijli|bses|recharge|airtel|jio|vodafone|bsnl|broadband|wifi|internet|water bill|gas|mobile bill|phone bill|dth|bill)\b/i],
        ["Food", /\b(swiggy|zomato|restaurant|food|lunch|dinner|breakfast|tea|chai|coffee|snacks?|cafe|dhaba|sweets?|mishthan|jalebi|momos?|bakery|pizza|biryani)\b/i],
    ],
    INCOME: [
        ["Car Income", /\b(car|cab|uber|ola|taxi|rapido)\b/i],
        ["EXTRA", /\b(interest|refund|cashback|reversal|dividend)\b/i],
    ],
};

export function guessCategory(description: string, type: TransactionType): string {
    const rule = CATEGORY_RULES[type].find(([, pattern]) => pattern.test(description));
    return rule ? rule[0] : type === "INCOME" ? "Sales" : "Other";
}

function normalizeCategory(raw: string, type: TransactionType): string {
    const value = raw.trim().slice(0, 60);
    const known = [...(type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES), ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
        .find(c => c.toLowerCase() === value.toLowerCase());
    return known || value;
}

// Clear statements of direction, as banks and people write them
const INCOME_STRONG = /\b(credited|received|recd|rcvd|receipt|refund|cashback|reversal|deposit|deposited|cash dep|by transfer|by cash|by clg|inward|payment from|advance from|transfer from|(?:upi|neft|imps|rtgs|ach)[\s/\-]*cr|credit|cr|income)\b/i;
const EXPENSE_STRONG = /\b(debited|paid|withdrawal|withdrawn|wdl|purchase|purchased|bought|to transfer|outward|payment to|transfer to|sent to|given to|(?:upi|neft|imps|rtgs|ach|nach)[\s/\-]*dr|debit|dr|pos|atm|emi|charges?|fees?|expense|spent)\b/i;
// Softer hints: what a curtain shop usually gets paid for
const INCOME_WEAK = /\b(advance|order|booking|sales?|token|customer|client|final payment|balance payment|part payment|installation|fitting charges)\b/i;

// Only the unmistakable wording ("received", "paid to", "UPI/DR") - this outranks a section heading
function typeFromStrongWords(text: string): TransactionType | null {
    const income = INCOME_STRONG.test(text);
    const expense = EXPENSE_STRONG.test(text);
    return income !== expense ? (income ? "INCOME" : "EXPENSE") : null;
}

export function typeFromWords(text: string): TransactionType | null {
    const strong = typeFromStrongWords(text);
    if (strong) return strong;
    if (INCOME_STRONG.test(text) && EXPENSE_STRONG.test(text)) return null;

    // Mentions something the shop buys or pays for (fuel, rent, fabric, wages...) -> expense
    const spendsOn = guessCategory(text, "EXPENSE") !== "Other";
    const earnsFrom = INCOME_WEAK.test(text);
    if (spendsOn !== earnsFrom) return spendsOn ? "EXPENSE" : "INCOME";
    if (spendsOn && earnsFrom) return null;

    // Bank shorthand: "TO <name>" is money out, "BY / FROM <name>" is money in
    if (/^(to|paid)\b/i.test(text.trim())) return "EXPENSE";
    if (/^(by|from)\b/i.test(text.trim()) || /\bfrom\b/i.test(text)) return "INCOME";
    return null;
}

// A heading or file name such as "Expenses April" / "Income" that applies to everything under it
export function typeFromHeading(text: string): TransactionType | null {
    const h = text.toLowerCase().replace(/[^a-z]+/g, " ").trim();
    const income = /\b(income|incomes|sales?|received|receipts?|credits?|money in|collection|earnings?)\b/.test(h);
    const expense = /\b(expenses?|expenditure|spent|spending|debits?|purchases?|money out|kharcha|kharch)\b/.test(h);
    if (income === expense) return null;
    return income ? "INCOME" : "EXPENSE";
}

// ---------------------------------------------------------------- CSV

export function parseCsv(text: string): string[][] {
    const source = text.replace(/^﻿/, "");
    const sample = source.split(/\r?\n/).filter(line => line.trim()).slice(0, 10).join("\n");
    const delimiter = [",", ";", "\t", "|"]
        .map(d => ({ d, count: sample.split(d).length - 1 }))
        .sort((a, b) => b.count - a.count)[0].d;

    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"') {
                if (source[i + 1] === '"') { cell += '"'; i++; }
                else quoted = false;
            } else {
                cell += ch;
            }
        } else if (ch === '"' && cell.trim() === "") {
            cell = "";
            quoted = true;
        } else if (ch === delimiter) {
            row.push(cell.trim());
            cell = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && source[i + 1] === "\n") i++;
            row.push(cell.trim());
            cell = "";
            if (row.some(c => c !== "")) rows.push(row);
            row = [];
        } else {
            cell += ch;
        }
    }
    row.push(cell.trim());
    if (row.some(c => c !== "")) rows.push(row);
    return rows;
}

// ---------------------------------------------------------------- Tables (CSV / Excel)

type ColumnKind = "date" | "description" | "amount" | "debit" | "credit" | "type" | "category" | "balance" | "reference";

function classifyHeader(cell: unknown): ColumnKind | null {
    if (typeof cell !== "string") return null;
    const h = cell.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!h || h.length > 40) return null;
    if (/\bbalance\b|\bbal\b/.test(h)) return "balance";
    if (/\bcategory\b|\bhead\b/.test(h)) return "category";
    if (/\bdr\b.*\bcr\b|\bcr\b.*\bdr\b|\btype\b|debit credit|credit debit/.test(h)) return "type";
    if (/\bdate\b|\bdt\b/.test(h)) return "date";
    if (/\bdebits?\b|\bwithdrawals?\b|\bdr\b|paid out|money out|\bexpenses?\b|\bspent\b|\boutflow\b/.test(h)) return "debit";
    if (/\bcredits?\b|\bdeposits?\b|\bcr\b|paid in|money in|\bincome\b|\breceived\b|\binflow\b/.test(h)) return "credit";
    if (/\bamount\b|\bamt\b|\bvalue\b|\btotal\b|\brupees\b|\binr\b|\bprice\b/.test(h)) return "amount";
    if (/description|details?|narration|particulars?|remarks?|notes?|paid to|party|payee|name|item|purpose|where|transaction|client|customer|vendor|supplier|merchant/.test(h)) return "description";
    if (/\bref\b|reference|chq|cheque|utr/.test(h)) return "reference";
    return null;
}

interface ColumnMap {
    date: number[];
    description: number[];
    amount: number[];
    debit: number[];
    credit: number[];
    type: number[];
    category: number[];
    balance: number[];
    reference: number[];
}

const emptyMap = (): ColumnMap => ({ date: [], description: [], amount: [], debit: [], credit: [], type: [], category: [], balance: [], reference: [] });

function findHeader(rows: unknown[][]): { index: number; map: ColumnMap } | null {
    let best: { index: number; map: ColumnMap; score: number } | null = null;
    const candidates = rows.slice(0, 50);
    for (let index = 0; index < candidates.length; index++) {
        const row = candidates[index];
        const map = emptyMap();
        row.forEach((cell, col) => {
            const kind = classifyHeader(cell);
            if (kind) map[kind].push(col);
        });
        const score = Object.values(map).filter(cols => cols.length > 0).length;
        const hasMoney = map.amount.length + map.debit.length + map.credit.length > 0;
        if (hasMoney && score >= 2 && (!best || score > best.score)) best = { index, map, score };
    }
    return best;
}

// No header row: work out the columns from what the cells look like
function inferColumns(rows: unknown[][]): ColumnMap {
    const sample = rows.slice(0, 60);
    const width = Math.max(0, ...sample.map(r => r.length));
    const map = emptyMap();
    const numeric: Array<{ col: number; filled: number }> = [];
    let bestText = { col: -1, score: 0 };

    for (let col = 0; col < width; col++) {
        const cells = sample.map(r => r[col]).filter(c => c !== null && c !== undefined && String(c).trim() !== "");
        if (cells.length === 0) continue;
        const dates = cells.filter(c => typeof c !== "number" && parseDate(c)).length;
        const types = cells.filter(c => parseType(c)).length;
        const numbers = cells.filter(c => !(typeof c !== "number" && parseDate(c)) && parseAmount(c)).length;

        if (dates >= cells.length * 0.6 && map.date.length === 0) map.date.push(col);
        else if (numbers >= cells.length * 0.8) numeric.push({ col, filled: cells.length });
        else if (types >= cells.length * 0.8 && cells.every(c => String(c).trim().length <= 10)) map.type.push(col);
        else {
            const score = cells.reduce((sum: number, c) => sum + String(c).length, 0);
            if (score > bestText.score) bestText = { col, score };
        }
    }
    if (bestText.col >= 0) map.description.push(bestText.col);

    const bothFilled = (a: number, b: number) => sample.filter(r => parseAmount(r[a]) && parseAmount(r[b])).length;
    if (numeric.length === 1) {
        map.amount.push(numeric[0].col);
    } else if (numeric.length >= 2) {
        const [a, b] = numeric;
        // Two columns that are never both filled are Debit | Credit; otherwise Amount | Balance
        if (bothFilled(a.col, b.col) <= sample.length * 0.1) {
            map.debit.push(a.col);
            map.credit.push(b.col);
            if (numeric[2]) map.balance.push(numeric[2].col);
        } else {
            map.amount.push(a.col);
            map.balance.push(b.col);
        }
    }
    return map;
}

const cellText = (value: unknown) => (value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim());

// `fileName` and `sheetName` settle rows that don't say what they are: a sheet called
// "Expenses" holds expenses, "income-april.csv" holds income
export function tableToTransactions(rows: unknown[][], defaultDate: string = todayIso(), fileName = "", sheetName = ""): ImportResult {
    const warnings: string[] = [];
    const cleanRows = rows.filter(row => Array.isArray(row) && row.some(c => cellText(c) !== ""));
    if (cleanRows.length === 0) return { rows: [], warnings: ["The file is empty."] };

    const header = findHeader(cleanRows);
    let map: ColumnMap;
    let body: unknown[][];
    if (header) {
        map = header.map;
        body = cleanRows.slice(header.index + 1);
        // "Amount (pre-GST) | GST | Total": the total is what was actually paid, so read it first
        const headerRow = cleanRows[header.index];
        const isTotal = (col: number) => /total/i.test(cellText(headerRow[col]));
        map.amount = [...map.amount.filter(isTotal), ...map.amount.filter(col => !isTotal(col))];
    } else {
        map = inferColumns(cleanRows);
        body = cleanRows;
        warnings.push("No column headings were found, so the columns were guessed. Please check the rows below.");
    }

    const hasSplitColumns = map.debit.length > 0 || map.credit.length > 0;
    if (!hasSplitColumns && map.amount.length === 0) {
        return { rows: [], warnings: ["Could not find an amount column in this file."] };
    }

    const dateCol = map.date[0];
    const amountCol = map.amount[0];
    const first = (cols: number[], row: unknown[]) => (cols.length > 0 ? row[cols[0]] : undefined);

    // 13/04/2026 can only be day-first; 04/13/2026 can only be month-first
    let monthFirst = false;
    if (dateCol !== undefined) {
        let dayFirstOnly = 0;
        let monthFirstOnly = 0;
        body.forEach(row => {
            const m = cellText(row[dateCol]).match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
            if (!m) return;
            if (+m[1] > 12) dayFirstOnly++;
            if (+m[2] > 12) monthFirstOnly++;
        });
        monthFirst = monthFirstOnly > 0 && dayFirstOnly === 0;
    }

    // With several amount columns, a row uses the first one that is filled in
    const rowAmount = (row: unknown[] | undefined) => {
        if (!row) return null;
        for (const col of map.amount) {
            const parsed = parseAmount(row[col]);
            if (parsed && parsed.value !== 0) return parsed;
        }
        return null;
    };
    const signedAmounts = body.some(row => (rowAmount(row)?.value ?? 0) < 0);

    const result: ImportedTransaction[] = [];
    let lastDate: string | null = null;
    let missingDates = 0;
    let guessedTypes = 0;
    let sectionType: TransactionType | null = null;
    const sheetType = typeFromHeading(sheetName);
    const fileType = typeFromHeading(fileName);

    // Amount + running balance: the balance rises by income and falls by an expense.
    // Statements run oldest-first or newest-first, so use whichever direction fits.
    const balanceCol = map.balance[0];
    const balanceMove = (index: number, step: number): number | null => {
        if (balanceCol === undefined || amountCol === undefined) return null;
        const amount = Math.abs(rowAmount(body[index])?.value ?? 0);
        const current = parseAmount(body[index]?.[balanceCol])?.value;
        const other = parseAmount(body[index + step]?.[balanceCol])?.value;
        if (!amount || current === undefined || other === undefined) return null;
        const move = current - other;
        return Math.abs(Math.abs(move) - amount) < 0.011 ? move : null;
    };
    const fits = (step: number) => body.filter((_, i) => balanceMove(i, step) !== null).length;
    const balanceStep = fits(1) > fits(-1) ? 1 : -1;

    body.forEach((row, rowIndex) => {
        const description = [...map.description, ...(map.description.length === 0 ? map.reference : [])]
            .map(col => cellText(row[col]))
            .filter((text, i, all) => text && all.indexOf(text) === i)
            .join(" - ");
        const summaryRow = /^(grand |sub ?)?total\b|^opening balance|^closing balance|^balance (b|c)\/?f|^brought forward|^carried forward/i;
        if (summaryRow.test(description) || summaryRow.test(cellText(row.find(c => cellText(c) !== "")))) return;

        const entries: Array<{ amount: number; type: TransactionType | null }> = [];
        if (hasSplitColumns) {
            const debit = Math.abs(parseAmount(first(map.debit, row))?.value ?? 0);
            const credit = Math.abs(parseAmount(first(map.credit, row))?.value ?? 0);
            if (debit > 0) entries.push({ amount: debit, type: "EXPENSE" });
            if (credit > 0) entries.push({ amount: credit, type: "INCOME" });
        } else {
            const parsed = rowAmount(row);
            if (parsed) {
                const move = balanceMove(rowIndex, balanceStep);
                const type = parseType(first(map.type, row))
                    || parsed.marker
                    || (parsed.value < 0 ? "EXPENSE" : signedAmounts ? "INCOME" : null)
                    || (move !== null ? (move > 0 ? "INCOME" : "EXPENSE") : null);
                entries.push({ amount: Math.abs(parsed.value), type });
            }
        }
        if (entries.length === 0) {
            // A row with words but no amount, like "INCOME" or "Expenses", labels the rows below it
            const heading = row.map(cellText).filter(Boolean).join(" ");
            if (heading.length <= 40) sectionType = typeFromHeading(heading) || sectionType;
            return;
        }

        let date = dateCol !== undefined ? parseDate(row[dateCol], monthFirst) : null;
        if (!date) {
            // A blank date under a dated row means "same day" in hand-made sheets
            date = lastDate;
            if (!date) { date = defaultDate; missingDates++; }
        }
        lastDate = date;

        const fileCategory = cellText(first(map.category, row));

        entries.forEach(entry => {
            let type = entry.type;
            let needsReview = false;
            if (!type) {
                const lower = fileCategory.toLowerCase();
                if (lower && INCOME_CATEGORIES.some(c => c.toLowerCase() === lower)) type = "INCOME";
                else if (lower && EXPENSE_CATEGORIES.some(c => c.toLowerCase() === lower)) type = "EXPENSE";
                // A heading or the sheet's own name is the author's word; wording is only a guess
                else type = sectionType || sheetType || typeFromWords(`${fileCategory} ${description}`) || fileType;
                if (!type) {
                    type = "EXPENSE";
                    needsReview = true;
                }
            }
            result.push({
                date: date as string,
                type,
                amount: Math.round(entry.amount * 100) / 100,
                category: fileCategory,
                description: description.slice(0, 300),
                ...(needsReview ? { needsReview: true } : {}),
            });
        });
    });

    // Rows that gave no sign follow the rest of the sheet when it is clearly one-sided
    const settled = result.filter(row => !row.needsReview);
    const incomeShare = settled.filter(row => row.type === "INCOME").length / (settled.length || 1);
    const majority: TransactionType | null = settled.length >= 3 ? (incomeShare >= 0.75 ? "INCOME" : incomeShare <= 0.25 ? "EXPENSE" : null) : null;
    result.forEach(row => {
        if (row.needsReview && majority) {
            row.type = majority;
            delete row.needsReview;
        }
        if (row.needsReview) guessedTypes++;
        // The file's own category is mapped onto the app's list where it clearly matches, else kept as written
        const fileCategory = row.category;
        const mapped = fileCategory ? guessCategory(fileCategory, row.type) : guessCategory(row.description, row.type);
        const isDefault = mapped === (row.type === "INCOME" ? "Sales" : "Other");
        row.category = fileCategory && isDefault ? normalizeCategory(fileCategory, row.type) : mapped;
    });

    if (result.length === 0) warnings.push("No rows with an amount were found.");
    if (missingDates > 0) {
        warnings.push(`${missingDates} row(s) had no date and were given ${defaultDate}. Change the date if needed.`);
    }
    if (guessedTypes > 0) {
        warnings.push(`${guessedTypes} row(s) gave no sign of being income or expense. They are marked "Check" and set to Expense.`);
    }
    return { rows: result, warnings };
}

// ---------------------------------------------------------------- PDF text (bank statements, printed sheets)

const DATE_TOKEN = `\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/\\-.]\\d{1,2}[/\\-.](?:\\d{4}|\\d{2})(?!\\d)|\\d{1,2}[\\s\\-/]?${MONTH_PATTERN}[\\s\\-/,']*(?:\\d{4}|\\d{2})(?!\\d)`;
const MONEY_TOKEN = `(?<![\\w.,/])-?(?:₹|rs\\.?\\s?|inr\\s?)?\\d[\\d,]*\\.\\d{2}(?!\\d)(?:\\s?\\(?(?:cr|dr)\\)?(?![a-z]))?`;
const NOISE_LINE = /page\s*\d|statement|opening balance|closing balance|\btotal\b|brought forward|carried forward|generated|signature|\bbranch\b|account (no|number)|ifsc|customer|address|continued|^\*+|^-+$|^-+\s*\d+ of \d+\s*-+$/i;
const PAGE_FOOTER = /^page\s*(no)?\s*[.:]*\s*\d+/i;
const PAGE_MARKER = /^-+\s*\d+ of \d+\s*-+$/i;

interface StatementEntry {
    date: string;
    head: string; // text the amounts are read from
    extra: string[]; // wrapped description lines
    section: TransactionType | null; // "Income" / "Expenses" heading the row sits under
}

export function parseStatementText(text: string, hint = ""): ImportResult {
    const warnings: string[] = [];
    const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const dateAtStart = new RegExp(`^(?:\\d{1,4}[.)]?\\s+)?(${DATE_TOKEN})`, "i");
    const moneyRe = () => new RegExp(MONEY_TOKEN, "gi");

    // Day-first unless the statement only makes sense month-first
    let dayFirstOnly = 0;
    let monthFirstOnly = 0;
    lines.forEach(line => {
        const m = line.match(/^(?:\d{1,4}[.)]?\s+)?(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
        if (!m) return;
        if (+m[1] > 12) dayFirstOnly++;
        if (+m[2] > 12) monthFirstOnly++;
    });
    const monthFirst = monthFirstOnly > 0 && dayFirstOnly === 0;

    const entries: StatementEntry[] = [];
    let headLines = 0;
    let section: TransactionType | null = null;
    let inPageFooter = false; // between "Page No: 1" and the page break: bank address, disclaimers...
    const hintType = typeFromHeading(hint);
    lines.forEach(line => {
        const match = line.match(dateAtStart);
        const date = match ? parseDate(match[1], monthFirst) : null;
        if (date) {
            entries.push({ date, head: line, extra: [], section });
            headLines = 1;
            inPageFooter = false;
            return;
        }
        if (PAGE_MARKER.test(line)) { inPageFooter = false; return; }
        if (PAGE_FOOTER.test(line)) inPageFooter = true;
        if (inPageFooter) return;
        // A short line of words only ("EXPENSES", "Income - April") labels the rows below it
        if (line.length <= 40 && !/\d{3,}/.test(line) && line.split(" ").length <= 4 && typeFromHeading(line)) {
            section = typeFromHeading(line);
            return;
        }
        const last = entries[entries.length - 1];
        if (!last || NOISE_LINE.test(line)) return;
        const lastHasMoney = moneyRe().test(last.head);
        if (!lastHasMoney && headLines < 4) {
            last.head += ` ${line}`;
            headLines++;
        } else if (lastHasMoney && !moneyRe().test(line) && line.length <= 90 && last.extra.length < 2) {
            last.extra.push(line);
        }
    });

    interface Parsed {
        date: string;
        description: string;
        amount: number;
        balance: number | null;
        type: TransactionType | null;
        section: TransactionType | null;
    }
    const parsed: Parsed[] = [];

    entries.forEach(entry => {
        const withoutDates = entry.head.replace(new RegExp(DATE_TOKEN, "gi"), " ");
        const tokens = withoutDates.match(moneyRe()) || [];
        let numbers = tokens.map(t => parseAmount(t)).filter((n): n is { value: number; marker?: TransactionType } => n !== null);
        let rest = withoutDates.replace(moneyRe(), " ");

        if (numbers.length === 0) {
            // Hand-made sheets often write whole rupees: "Tea 250"
            const whole = rest.match(/(?:₹|(?<![a-z])rs\.?\s?|(?<![a-z])inr\s?)?(\d[\d,]*)\s*(?:\/-)?\s*$/i);
            const value = whole ? parseAmount(whole[1]) : null;
            if (!whole || !value) return;
            numbers = [value];
            rest = rest.slice(0, whole.index);
        }

        let amount: number;
        let balance: number | null = null;
        let type: TransactionType | null = null;

        if (numbers.length === 1) {
            amount = numbers[0].value;
            type = numbers[0].marker || null;
        } else {
            balance = numbers[numbers.length - 1].value;
            const candidates = numbers.slice(0, -1);
            // "0.00  500.00  12,000.00" = Debit | Credit | Balance with an empty column printed as zero
            const nonZero = candidates.filter(n => n.value !== 0);
            const chosen = nonZero[nonZero.length - 1] || candidates[candidates.length - 1];
            amount = chosen.value;
            type = chosen.marker || null;
            if (!type && candidates.length === 2 && nonZero.length === 1) {
                type = candidates[0].value !== 0 ? "EXPENSE" : "INCOME";
            }
        }
        if (!type && amount < 0) type = "EXPENSE";
        amount = Math.abs(amount);
        if (!(amount > 0) || amount > 1e10) return;

        const description = [rest, ...entry.extra]
            .join(" ")
            .replace(/^\s*\d{1,4}[.)]?\s+(?=\D)/, "")
            .replace(/[|]+/g, " ")
            .replace(/(?<![\w@.\-])[A-Z]{0,4}\d{10,}(?![\w@.\-])/g, " ") // cheque / reference numbers
            .replace(/\s+/g, " ")
            .replace(/^[\s\-:,.]+|[\s\-:,]+$/g, "")
            .slice(0, 300);

        parsed.push({ date: entry.date, description, amount, balance, type, section: entry.section });
    });

    // The running balance tells income from expense: it goes up by a credit, down by a debit.
    // Statements can run oldest-first or newest-first, so test both.
    const openingMatch = text.match(/opening balance[^\d\-]{0,80}?(-?[\d,]+\.\d{2})/i);
    const openingBalance = openingMatch ? parseAmount(openingMatch[1])?.value ?? null : null;
    const delta = (i: number, neighbour: number): number | null => {
        const a = parsed[i]?.balance;
        const b = neighbour === -1 ? openingBalance : parsed[neighbour]?.balance;
        if (a === null || a === undefined || b === null || b === undefined) return null;
        const d = a - b;
        return Math.abs(Math.abs(d) - parsed[i].amount) < 0.011 ? d : null;
    };
    const oldestFirstHits = parsed.filter((_, i) => delta(i, i - 1) !== null).length;
    const newestFirstHits = parsed.filter((_, i) => delta(i, i + 1) !== null).length;
    const step = newestFirstHits > oldestFirstHits ? 1 : -1;

    let guessed = 0;
    const rows: ImportedTransaction[] = parsed.map((p, i) => {
        let type = p.type;
        if (!type) {
            const d = delta(i, i + step);
            if (d !== null) type = d > 0 ? "INCOME" : "EXPENSE";
        }
        if (!type) type = typeFromStrongWords(p.description) || p.section || typeFromWords(p.description) || hintType;
        const needsReview = !type;
        if (!type) { type = "EXPENSE"; guessed++; }
        return {
            date: p.date,
            type,
            amount: Math.round(p.amount * 100) / 100,
            category: guessCategory(p.description, type),
            description: p.description,
            ...(needsReview ? { needsReview: true } : {}),
        };
    });

    if (rows.length === 0) warnings.push("No dated rows with an amount were found in this PDF.");
    if (guessed > 0) {
        warnings.push(`${guessed} row(s) gave no sign of being income or expense. They are marked "Check" and set to Expense.`);
    }
    return { rows, warnings };
}
