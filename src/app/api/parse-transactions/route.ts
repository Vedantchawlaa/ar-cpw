import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/auth";
import { ImportResult, parseCsv, parseStatementText, tableToTransactions } from "@/lib/transaction-import";
import { aiImportAvailable, classifyTransactionsWithAi, parseTransactionsPdfWithAi } from "@/lib/ai-transaction-parser";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function readPdfText(buffer: Buffer): Promise<string> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
        const result = await parser.getText();
        return result.text;
    } finally {
        await parser.destroy();
    }
}

async function readSpreadsheet(buffer: Buffer, today: string, fileName: string): Promise<ImportResult> {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const combined: ImportResult = { rows: [], warnings: [] };
    for (const name of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][];
        if (rows.length === 0) continue;
        const result = tableToTransactions(rows, today, fileName, name);
        combined.rows.push(...result.rows);
        // Sheets without transactions (notes, summaries) are skipped quietly
        if (result.rows.length > 0) combined.warnings.push(...result.warnings);
    }
    if (combined.rows.length === 0) combined.warnings.push("No rows with an amount were found in this workbook.");
    return combined;
}

// Reads an uploaded CSV / Excel / PDF and returns transaction rows for review.
// Nothing is saved here - the import itself happens in importTransactions().
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const dbUser = session?.user?.email
            ? await db.user.findUnique({ where: { email: session.user.email }, select: { role: true } })
            : null;
        if (dbUser?.role !== "admin") {
            return NextResponse.json({ success: false, error: "Unauthorized: Admin access required." }, { status: 401 });
        }

        const data = await request.formData();
        const file = data.get("file") as File | null;
        const useAi = data.get("mode") === "ai";
        const today = (data.get("today") as string) || new Date().toISOString().split("T")[0];

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }
        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ success: false, error: "File is larger than 10 MB." }, { status: 400 });
        }

        const extension = file.name.toLowerCase().split(".").pop() || "";
        const buffer = Buffer.from(await file.arrayBuffer());
        let result: ImportResult;
        let source: "csv" | "excel" | "pdf" | "pdf-ai";

        if (extension === "csv" || extension === "txt" || file.type === "text/csv") {
            source = "csv";
            result = tableToTransactions(parseCsv(buffer.toString("utf-8")), today, file.name);
        } else if (extension === "xlsx" || extension === "xls") {
            source = "excel";
            result = await readSpreadsheet(buffer, today, file.name);
        } else if (extension === "pdf" || file.type === "application/pdf") {
            source = "pdf";
            result = useAi ? { rows: [], warnings: [] } : parseStatementText(await readPdfText(buffer), file.name);
            if (result.rows.length === 0 && aiImportAvailable()) {
                source = "pdf-ai";
                result = await parseTransactionsPdfWithAi(buffer, today);
            } else if (result.rows.length === 0) {
                result.warnings.push("If this is a scanned PDF, upload the CSV or Excel export from your bank instead.");
            }
        } else {
            return NextResponse.json({ success: false, error: "Unsupported file. Upload a CSV, Excel (.xlsx / .xls) or PDF file." }, { status: 400 });
        }

        // Rows the rules could not place as income or expense: let AI decide from the details
        const unclear = result.rows.filter(row => row.needsReview);
        if (unclear.length > 0 && aiImportAvailable()) {
            try {
                const decided = await classifyTransactionsWithAi(unclear);
                result.warnings = result.warnings.filter(w => !w.includes("gave no sign"));
                result.warnings.push(`${decided} row(s) were sorted into income or expense by AI from their details. Please glance over them.`);
            } catch (error) {
                console.error("AI classification failed:", error);
            }
        }

        if (result.rows.length > MAX_ROWS) {
            result.warnings.push(`Only the first ${MAX_ROWS} of ${result.rows.length} rows are shown. Split the file to import the rest.`);
            result.rows = result.rows.slice(0, MAX_ROWS);
        }

        // Flag rows that look like transactions already in the books (same type and amount within a day)
        let rows = result.rows.map(row => ({ ...row, duplicate: false }));
        if (rows.length > 0) {
            const times = rows.map(row => new Date(row.date).getTime());
            const existing = await db.transaction.findMany({
                where: { date: { gte: new Date(Math.min(...times) - 2 * DAY_MS), lte: new Date(Math.max(...times) + 2 * DAY_MS) } },
                select: { type: true, amount: true, date: true },
            });
            rows = rows.map((row, i) => ({
                ...row,
                duplicate: existing.some((t: { type: string; amount: number; date: Date }) =>
                    t.type === row.type
                    && Math.abs(t.amount - row.amount) < 0.005
                    && Math.abs(t.date.getTime() - times[i]) <= 1.5 * DAY_MS
                ),
            }));
        }

        return NextResponse.json({
            success: true,
            rows,
            warnings: result.warnings,
            source,
            aiAvailable: aiImportAvailable(),
        });
    } catch (error: any) {
        console.error("Failed to parse transactions file:", error);
        return NextResponse.json({
            success: false,
            error: error?.message || "Failed to read this file",
        }, { status: 500 });
    }
}
