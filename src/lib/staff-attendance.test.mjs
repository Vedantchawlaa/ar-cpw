// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    businessNow,
    calculateMonthlySalary,
    daysInMonth,
    isValidDateKey,
    salaryBalance,
    lateMinutes,
    shiftMonth,
    workedMinutes,
} from "./staff-attendance.ts";

test("leave asked deducts a full day, half day deducts half, company leave is paid", () => {
    const summary = calculateMonthlySalary(30000, 2026, 9, [
        { date: "2026-09-01", status: "PRESENT", punchIn: "10:00", punchOut: "19:00" },
        { date: "2026-09-02", status: "LEAVE" },
        { date: "2026-09-03", status: "HALF_DAY", punchIn: "10:00", punchOut: "14:00" },
        { date: "2026-09-04", status: "COMPANY_LEAVE" },
    ]);

    assert.equal(summary.daysInMonth, 30);
    assert.equal(summary.perDay, 1000);
    assert.equal(summary.present, 1);
    assert.equal(summary.leaves, 1);
    assert.equal(summary.halfDays, 1);
    assert.equal(summary.companyLeaves, 1);
    assert.equal(summary.deductedDays, 1.5);
    assert.equal(summary.deduction, 1500);
    assert.equal(summary.netSalary, 28500);
    assert.equal(summary.workedMinutes, 9 * 60 + 4 * 60);
});

test("per-day rate follows the length of the month", () => {
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2028, 2), 29);
    const feb = calculateMonthlySalary(28000, 2026, 2, [{ date: "2026-02-10", status: "LEAVE" }]);
    assert.equal(feb.deduction, 1000);
    assert.equal(feb.netSalary, 27000);
});

test("records from other months are ignored and unmarked days are counted only in range", () => {
    const summary = calculateMonthlySalary(31000, 2026, 10, [
        { date: "2026-09-30", status: "LEAVE" },
        { date: "2026-10-01", status: "PRESENT" },
    ], { countFrom: "2026-10-01", countTo: "2026-10-05" });

    assert.equal(summary.leaves, 0);
    assert.equal(summary.deduction, 0);
    assert.equal(summary.unmarked, 4);
});

test("worked and late minutes", () => {
    assert.equal(workedMinutes("09:45", "18:15"), 510);
    assert.equal(workedMinutes("10:00", null), null);
    assert.equal(workedMinutes("18:00", "10:00"), null);
    assert.equal(lateMinutes("10:20", "10:00"), 20);
    assert.equal(lateMinutes("09:50", "10:00"), 0);
});

test("date helpers", () => {
    assert.equal(isValidDateKey("2026-02-28"), true);
    assert.equal(isValidDateKey("2026-02-30"), false);
    assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
    assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
    // 2026-10-13 20:00 UTC is 2026-10-14 01:30 in India
    assert.deepEqual(businessNow(new Date("2026-10-13T20:00:00Z")), { date: "2026-10-14", time: "01:30" });
});

test("bonus adds to pay, payments reduce the balance", () => {
    assert.deepEqual(
        salaryBalance(28500, [
            { type: "PAYMENT", amount: 5000 },
            { type: "BONUS", amount: 2000 },
            { type: "PAYMENT", amount: 20000 },
        ]),
        { bonus: 2000, paid: 25000, totalPay: 30500, balance: 5500 }
    );
    assert.equal(salaryBalance(10000, [{ type: "PAYMENT", amount: 12000 }]).balance, -2000);
});
