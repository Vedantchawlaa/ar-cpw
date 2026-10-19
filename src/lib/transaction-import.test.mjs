// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseDate, parseAmount, tableToTransactions, parseStatementText, guessCategory, typeFromWords } from "./transaction-import.ts";

const pick = (rows) => rows.map(r => [r.date, r.type, r.amount, r.category, r.description]);

test("parseDate handles common Indian formats", () => {
    assert.equal(parseDate("01/04/2026"), "2026-04-01");
    assert.equal(parseDate("1-4-26"), "2026-04-01");
    assert.equal(parseDate("2026-04-01 10:30"), "2026-04-01");
    assert.equal(parseDate("01-Apr-2026"), "2026-04-01");
    assert.equal(parseDate("1 April 2026"), "2026-04-01");
    assert.equal(parseDate("Apr 1, 2026"), "2026-04-01");
    assert.equal(parseDate("04/13/2026", true), "2026-04-13");
    assert.equal(parseDate(46113), "2026-04-01"); // Excel serial
    assert.equal(parseDate("31/02/2026"), null);
    assert.equal(parseDate("hello"), null);
});

test("parseAmount handles currency text", () => {
    assert.deepEqual(parseAmount("1,23,456.50"), { value: 123456.5, marker: undefined });
    assert.equal(parseAmount("Rs. 500").value, 500);
    assert.equal(parseAmount("₹ 2,000/-"), null);
    assert.equal(parseAmount("(250.00)").value, -250);
    assert.equal(parseAmount("-90").value, -90);
    assert.deepEqual(parseAmount("1,000.00 Cr"), { value: 1000, marker: "INCOME" });
    assert.deepEqual(parseAmount("750.00Dr"), { value: 750, marker: "EXPENSE" });
    assert.equal(parseAmount(""), null);
    assert.equal(parseAmount("abc"), null);
});

test("parseCsv handles quotes, embedded commas and semicolons", () => {
    assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n\n1,2\n'), [["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
    assert.deepEqual(parseCsv("a;b\r\n1;2"), [["a", "b"], ["1", "2"]]);
});

test("simple sheet: Date, Details, Amount, Type", () => {
    const { rows, warnings } = tableToTransactions(parseCsv(
        "Date,Details,Amount,Type\n" +
        "01/04/2026,Petrol for van,1500,Expense\n" +
        "02/04/2026,Sharma ji curtains advance,25000,Income\n" +
        ",Tea and snacks,120,Expense\n" +
        "Total,,26620,\n"
    ));
    assert.deepEqual(pick(rows), [
        ["2026-04-01", "EXPENSE", 1500, "Vehicle maintenance & Fuel", "Petrol for van"],
        ["2026-04-02", "INCOME", 25000, "Sales", "Sharma ji curtains advance"],
        ["2026-04-02", "EXPENSE", 120, "Food", "Tea and snacks"], // blank date = same day as the row above
    ]);
    assert.deepEqual(warnings, []);
});

test("only amount and details: date defaults, unknown type is flagged", () => {
    const { rows, warnings } = tableToTransactions(parseCsv("Amount,Details\n500,Shop rent part\n900,Misc"), "2026-10-05");
    assert.deepEqual(pick(rows), [
        ["2026-10-05", "EXPENSE", 500, "Rent", "Shop rent part"],
        ["2026-10-05", "EXPENSE", 900, "Other", "Misc"],
    ]);
    assert.equal(rows[0].needsReview, undefined); // "rent" is clearly an expense
    assert.equal(rows[1].needsReview, true);
    assert.equal(warnings.length, 2);
});

test("bank statement: preamble rows, Withdrawal / Deposit columns, balance ignored", () => {
    const { rows } = tableToTransactions([
        ["HDFC BANK Ltd.", null, null, null, null],
        ["Account No: XXXX5953", null, null, null, null],
        ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
        ["01/04/26", "UPI-AIRTEL RECHARGE", "000123", "01/04/26", 599, null, 10000],
        ["03/04/26", "NEFT CR-GUPTA INTERIORS", "000124", "03/04/26", null, "45,000.00", 55000],
        ["13/04/26", "UPI-D DECOR FABRICS", "000125", "13/04/26", "12,500.00", "", 42500],
    ]);
    assert.deepEqual(pick(rows), [
        ["2026-04-01", "EXPENSE", 599, "Utilities", "UPI-AIRTEL RECHARGE"],
        ["2026-04-03", "INCOME", 45000, "Sales", "NEFT CR-GUPTA INTERIORS"],
        ["2026-04-13", "EXPENSE", 12500, "Fabric Purchase", "UPI-D DECOR FABRICS"],
    ]);
});

test("signed amount column and file-provided category", () => {
    const { rows } = tableToTransactions(parseCsv(
        "Txn Date;Particulars;Amount (INR);Category\n2026-04-05;Staff payment;-8000;salary\n2026-04-06;Cab booking;1200;Car Income\n"
    ));
    assert.deepEqual(pick(rows), [
        ["2026-04-05", "EXPENSE", 8000, "Salary", "Staff payment"],
        ["2026-04-06", "INCOME", 1200, "Car Income", "Cab booking"],
    ]);
});

test("Excel serial dates and Dr/Cr column", () => {
    const { rows } = tableToTransactions([
        ["Date", "Description", "Amount", "Dr/Cr"],
        [46113, "Shop rent", 15000, "DR"],
        [46114, "Customer payment", 30000, "CR"],
    ]);
    assert.deepEqual(pick(rows), [
        ["2026-04-01", "EXPENSE", 15000, "Rent", "Shop rent"],
        ["2026-04-02", "INCOME", 30000, "Sales", "Customer payment"],
    ]);
});

test("month-first dates are detected when day-first is impossible", () => {
    const { rows } = tableToTransactions(parseCsv("Date,Details,Debit,Credit\n04/13/2026,Fuel,500,\n04/02/2026,Sale,,900\n"));
    assert.deepEqual(rows.map(r => r.date), ["2026-04-13", "2026-04-02"]);
});

test("no header row: columns are guessed", () => {
    const { rows, warnings } = tableToTransactions(parseCsv("01/04/2026,Diesel,2000\n02/04/2026,Curtain rods,3500\n"));
    assert.deepEqual(pick(rows), [
        ["2026-04-01", "EXPENSE", 2000, "Vehicle maintenance & Fuel", "Diesel"],
        ["2026-04-02", "EXPENSE", 3500, "Accessory Purchase", "Curtain rods"],
    ]);
    assert.match(warnings[0], /No column headings/);
});

test("file without an amount column", () => {
    const { rows, warnings } = tableToTransactions(parseCsv("Name,City\nRavi,Delhi\n"));
    assert.equal(rows.length, 0);
    assert.ok(warnings.length > 0);
});

test("PDF statement text: balance tells income from expense, wrapped narration is joined", () => {
    const text = [
        "STATE BANK OF INDIA",
        "Account Statement from 01 Apr 2026 to 30 Apr 2026",
        "Txn Date Value Date Description Ref No. Debit Credit Balance",
        "Opening Balance 10,000.00",
        "01 Apr 2026 01 Apr 2026 JIO RECHARGE 1234 399.00 9,601.00",
        "05 Apr 2026 05 Apr 2026 BY TRANSFER-NEFT*VERMA HOMES 5678 50,000.00 59,601.00",
        "PVT LTD",
        "09 Apr 2026 09 Apr 2026 POS 4411 INDIAN OIL 2,000.00 57,601.00",
        "-- 1 of 1 --",
    ].join("\n");
    const { rows } = parseStatementText(text);
    assert.deepEqual(rows.map(r => [r.date, r.type, r.amount, r.category]), [
        ["2026-04-01", "EXPENSE", 399, "Utilities"],
        ["2026-04-05", "INCOME", 50000, "Sales"],
        ["2026-04-09", "EXPENSE", 2000, "Vehicle maintenance & Fuel"],
    ]);
    assert.match(rows[1].description, /VERMA HOMES.*PVT LTD/);
    assert.ok(rows.every(r => !r.needsReview));
});

test("PDF text: newest-first statements and zero-filled debit/credit columns", () => {
    const newestFirst = "12/04/2026 Cheque deposit 5,000.00 20,000.00\n10/04/2026 Electricity 1,000.00 15,000.00\n08/04/2026 Something 4,000.00 16,000.00";
    assert.deepEqual(parseStatementText(newestFirst).rows.map(r => r.type), ["INCOME", "EXPENSE", "EXPENSE"]);

    const zeroFilled = "12/04/2026 Lunch 0.00 700.00 9,300.00\n13/04/2026 Wages 2,000.00 0.00 7,300.00";
    assert.deepEqual(parseStatementText(zeroFilled).rows.map(r => [r.type, r.amount]), [["INCOME", 700], ["EXPENSE", 2000]]);
});

test("PDF text: hand-made list with whole rupee amounts", () => {
    const { rows } = parseStatementText("Expenses April\n1. 02/04/2026 Chai for workers 250\n2. 03/04/2026 Received from Mehta 12000");
    assert.deepEqual(pick(rows), [
        ["2026-04-02", "EXPENSE", 250, "Food", "Chai for workers"],
        ["2026-04-03", "INCOME", 12000, "Sales", "Received from Mehta"],
    ]);
});

test("guessCategory falls back sensibly", () => {
    assert.equal(guessCategory("random thing", "EXPENSE"), "Other");
    assert.equal(guessCategory("random thing", "INCOME"), "Sales");
    assert.equal(guessCategory("Google Ads invoice", "EXPENSE"), "Advertisement");
});

test("income vs expense is worked out from the wording", () => {
    const cases = {
        "Received from Mehta ji": "INCOME",
        "UPI/CR/123456/RAHUL VERMA": "INCOME",
        "Advance for bedroom curtains": "INCOME",
        "Kapoor residence final payment": "INCOME",
        "BY TRANSFER-NEFT*GUPTA": "INCOME",
        "Paid to Raju tailor": "EXPENSE",
        "UPI/DR/998877/INDIAN OIL": "EXPENSE",
        "Diesel for van": "EXPENSE",
        "Shop rent October": "EXPENSE",
        "TO TRANSFER-INB Fabric House": "EXPENSE",
        "ATM WDL": "EXPENSE",
    };
    for (const [text, expected] of Object.entries(cases)) assert.equal(typeFromWords(text), expected, text);
    assert.equal(typeFromWords("Misc"), null);
});

test("amount + balance columns: the balance decides income vs expense", () => {
    const { rows } = tableToTransactions([
        ["Date", "Particulars", "Amount", "Balance"],
        ["01/04/2026", "Opening", null, 10000],
        ["02/04/2026", "Ramesh", 4000, 14000],
        ["03/04/2026", "Suresh", 1500, 12500],
    ]);
    assert.deepEqual(rows.map(r => [r.type, r.amount, r.needsReview]), [["INCOME", 4000, undefined], ["EXPENSE", 1500, undefined]]);
});

test("section headings and file name decide rows that say nothing themselves", () => {
    const sheet = parseCsv("Date,Details,Amount\nINCOME,,\n01/04/2026,Ramesh,4000\nEXPENSES,,\n02/04/2026,Suresh,1500\n");
    assert.deepEqual(tableToTransactions(sheet).rows.map(r => r.type), ["INCOME", "EXPENSE"]);

    const plain = parseCsv("Date,Details,Amount\n01/04/2026,Ramesh,4000\n");
    assert.equal(tableToTransactions(plain, "2026-10-05", "income-april.csv").rows[0].type, "INCOME");
    assert.equal(tableToTransactions(plain, "2026-10-05", "April expenses.csv").rows[0].type, "EXPENSE");
    assert.equal(tableToTransactions(plain, "2026-10-05", "april.csv").rows[0].needsReview, true);

    const pdf = parseStatementText("Income\n01/04/2026 Ramesh 4000\nExpenses\n02/04/2026 Suresh 1500");
    assert.deepEqual(pdf.rows.map(r => r.type), ["INCOME", "EXPENSE"]);
});

test("ledger workbook: Total column used when Amount is blank, sheet name decides the type", () => {
    const expenses = tableToTransactions([
        ["Date", "Category", "Vendor", "Description", "Amount (pre-GST)", "GST", "Total", "GST Bill (Y/N)", "Linked Order ID"],
        [46268, "Car EMI", "Muthoot Capital", "Personal", null, null, 2933, "N", ""],
        [46275, "Fuel", "Shri Shyam Filling (CNG)", "Personal", null, null, 591, "N", ""],
        [46284, "Blinds purchase", "Super Industries", "Balance payment", null, null, 15000, "?", null],
        [46286, "Ads (lead gen)", "Meta Ads Manager", "Facebook/Instagram ads", 2119, 381, 2500, "Y", null],
    ], "2026-10-05", "CPW_Sept2026_Ledger.xlsx", "Expenses");
    assert.deepEqual(pick(expenses.rows), [
        ["2026-09-03", "EXPENSE", 2933, "Car EMI", "Muthoot Capital - Personal"],
        ["2026-09-10", "EXPENSE", 591, "Vehicle maintenance & Fuel", "Shri Shyam Filling (CNG) - Personal"],
        ["2026-09-19", "EXPENSE", 15000, "Accessory Purchase", "Super Industries - Balance payment"],
        ["2026-09-21", "EXPENSE", 2500, "Advertisement", "Meta Ads Manager - Facebook/Instagram ads"],
    ]);
    assert.deepEqual(expenses.warnings, []);

    const payments = tableToTransactions([
        ["Date", "Order ID", "Client", "Amount", "Mode", "Note"],
        [46270, null, "Thakar Das", 20000, "Cash Transfer", "Cash transfer"],
        [46283, "TBC", "Malak Singh", 40000, "UPI", "Client payment - order link karna hai"],
        [46283, "TBC", "Bishan Singh Saro", 15000, "UPI", "Client payment - order link karna hai"],
        [46295, "TBC", "Ajay Pawar", 40000, "UPI", "Client payment - order link karna hai"],
    ], "2026-10-05", "CPW_Sept2026_Ledger.xlsx", "Payments");
    assert.deepEqual(payments.rows.map(r => [r.type, r.amount, r.description, r.needsReview]), [
        ["INCOME", 20000, "Thakar Das - Cash transfer", undefined], // follows the rest of the sheet
        ["INCOME", 40000, "Malak Singh - Client payment - order link karna hai", undefined],
        ["INCOME", 15000, "Bishan Singh Saro - Client payment - order link karna hai", undefined],
        ["INCOME", 40000, "Ajay Pawar - Client payment - order link karna hai", undefined],
    ]);
});

test("PDF statement: page footers are skipped and the summary's opening balance settles the first row", () => {
    const text = [
        "Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance",
        "03/09/26 ACH D- MUTHOOT CAPITAL",
        "SERV-MCSL20260975",
        "0000003284040194 03/09/26 2,933.00 29,801.43",
        "05/09/26 UPI-THAKAR DAS-9812339501@PTYES-PSIB0000 0000313991321725 05/09/26 20,000.00 49,801.43",
        "Page No .: 1",
        "MR SUNIL SON OF THAKUR DASS",
        "HDFC BANK LIMITED",
        "-- 1 of 2 --",
        "787-313991321725-SENT USING PAYTM U",
        "06/09/26 UPI-SHRI SAI FUELS-PAYTM 0000662118551485 06/09/26 803.00 48,998.43",
        "Opening Balance Dr Count Cr Count Debits Credits Closing Bal",
        "32,734.43 2 1 3,736.00 20,000.00 48,998.43",
    ].join("\n");
    const { rows, warnings } = parseStatementText(text);
    assert.deepEqual(rows.map(r => [r.date, r.type, r.amount, r.category]), [
        ["2026-09-03", "EXPENSE", 2933, "Other"],
        ["2026-09-05", "INCOME", 20000, "Sales"],
        ["2026-09-06", "EXPENSE", 803, "Vehicle maintenance & Fuel"],
    ]);
    assert.equal(rows[1].description, "UPI-THAKAR DAS-9812339501@PTYES-PSIB0000 787-313991321725-SENT USING PAYTM U");
    assert.deepEqual(warnings, []);
});
