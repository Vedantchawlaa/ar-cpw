import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ImportResult, ImportedTransaction, guessCategory, parseDate } from "@/lib/transaction-import";

const ExtractionSchema = z.object({
    transactions: z.array(z.object({
        date: z.string().describe("Transaction date as YYYY-MM-DD. Empty string if the document gives no date for this row."),
        type: z.enum(["INCOME", "EXPENSE"]).describe("INCOME for money received (credit/deposit), EXPENSE for money paid out (debit/withdrawal)"),
        amount: z.number().describe("Positive amount in rupees, without commas or currency symbols"),
        category: z.string().describe("Best matching category from the list in the instructions"),
        description: z.string().describe("Who the money went to or came from and what for, cleaned of reference numbers"),
    })),
});

export const aiImportAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Fallback for PDFs the text parser can't make sense of (scanned pages, unusual layouts)
export async function parseTransactionsPdfWithAi(buffer: Buffer, today: string): Promise<ImportResult> {
    const client = new Anthropic();

    const response = await client.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: {
            effort: "low",
            format: zodOutputFormat(ExtractionSchema),
        },
        messages: [
            {
                role: "user",
                content: [
                    { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
                    {
                        type: "text",
                        text: `This PDF lists money transactions of a curtain and blinds shop in India: either a bank statement or a hand-made income/expense sheet. Extract every transaction row into the schema.

- Use the running balance, Debit/Credit or Withdrawal/Deposit columns, and Cr/Dr markers to decide INCOME vs EXPENSE.
- Dates are day-first (DD/MM/YYYY) unless the document clearly says otherwise. Output them as YYYY-MM-DD.
- Skip opening/closing balance lines, totals, headers and page footers.
- Expense categories: ${EXPENSE_CATEGORIES.join(", ")}. Income categories: ${INCOME_CATEGORIES.join(", ")}. Use "Other" for an expense and "Sales" for income when nothing fits better.`,
                    },
                ],
            },
        ],
    });

    if (response.stop_reason === "max_tokens") {
        throw new Error("This PDF has too many transactions to read in one go. Split it into smaller files, or upload the CSV/Excel export instead.");
    }
    if (response.stop_reason === "refusal" || !response.parsed_output) {
        throw new Error("The AI reader could not process this PDF.");
    }

    let missingDates = 0;
    const rows = response.parsed_output.transactions
        .filter(t => Number.isFinite(t.amount) && t.amount !== 0)
        .map(t => {
            const date = parseDate(t.date);
            if (!date) missingDates++;
            const allowed = t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
            const category = allowed.find(c => c.toLowerCase() === t.category.trim().toLowerCase());
            return {
                date: date || today,
                type: t.type,
                amount: Math.round(Math.abs(t.amount) * 100) / 100,
                category: category || guessCategory(t.description, t.type),
                description: t.description.trim().slice(0, 300),
            };
        });

    const warnings = ["This PDF was read with AI. Check the rows before importing."];
    if (missingDates > 0) warnings.push(`${missingDates} row(s) had no date and were given ${today}.`);
    return { rows, warnings };
}

const ClassificationSchema = z.object({
    items: z.array(z.object({
        index: z.number().describe("The row number given in the list"),
        type: z.enum(["INCOME", "EXPENSE"]),
        category: z.string().describe("Best matching category from the list in the instructions"),
    })),
});

// Decides income vs expense (and category) for rows whose file gave no usable sign.
// Updates the rows in place and returns how many were decided.
export async function classifyTransactionsWithAi(rows: ImportedTransaction[]): Promise<number> {
    const batch = rows.slice(0, 300);
    const client = new Anthropic();

    const response = await client.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: {
            effort: "low",
            format: zodOutputFormat(ClassificationSchema),
        },
        messages: [
            {
                role: "user",
                content: `These are money transactions of a curtain and blinds shop in India (it sells and installs curtains, blinds and tracks; it buys fabric and accessories, pays staff, rent, fuel and bills; it also earns from renting out a car). For each row decide whether the shop RECEIVED the money (INCOME) or PAID it (EXPENSE), and pick a category. A person's or customer's name with no other clue is most likely a customer paying (INCOME); a supplier, shop, utility or staff name is an EXPENSE.

Expense categories: ${EXPENSE_CATEGORIES.join(", ")}.
Income categories: ${INCOME_CATEGORIES.join(", ")}.

Rows (number | amount in rupees | details):
${batch.map((row, i) => `${i} | ${row.amount} | ${row.description || "(no details)"}`).join("\n")}`,
            },
        ],
    });

    if (!response.parsed_output) return 0;

    let decided = 0;
    response.parsed_output.items.forEach(item => {
        const row = batch[item.index];
        if (!row) return;
        const allowed = item.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        row.type = item.type;
        row.category = allowed.find(c => c.toLowerCase() === item.category.trim().toLowerCase()) || guessCategory(row.description, item.type);
        delete row.needsReview;
        decided++;
    });
    return decided;
}
