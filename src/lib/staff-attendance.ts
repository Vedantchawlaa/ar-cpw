// Pure helpers for staff attendance and salary. No DB or framework imports, so they can be unit-tested.

export const ATTENDANCE_STATUSES = ["PRESENT", "HALF_DAY", "LEAVE", "COMPANY_LEAVE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
    PRESENT: "Present",
    HALF_DAY: "Half day",
    LEAVE: "Leave (deducted)",
    COMPANY_LEAVE: "Company leave (paid)",
};

// Fraction of a day's pay deducted for each status.
const DEDUCTED_DAYS: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    HALF_DAY: 0.5,
    LEAVE: 1,
    COMPANY_LEAVE: 0,
};

export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

/** Extra pay, in days, for working on a Sunday (the weekly off). */
export const SUNDAY_EXTRA_DAYS = 0.5;

export interface AttendanceDay {
    date: string; // YYYY-MM-DD
    status: string;
    punchIn?: string | null; // HH:mm
    punchOut?: string | null; // HH:mm
}

export interface SalarySummary {
    daysInMonth: number;
    perDay: number;
    present: number;
    halfDays: number;
    leaves: number;
    companyLeaves: number;
    unmarked: number;
    deductedDays: number;
    deduction: number;
    otMinutes: number;
    otRatePerHour: number;
    otPay: number;
    sundaysWorked: number;
    sundayPay: number;
    netSalary: number; // salary − deduction + OT pay + Sunday extra
    workedMinutes: number;
}

export interface OvertimeSettings {
    shiftStart: string;
    shiftEnd: string;
    /** Fixed ₹ per OT hour; when empty, pay per day ÷ shift hours is used. */
    ratePerHour?: number | null;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidTime(value: string): boolean {
    return TIME_RE.test(value);
}

export function isValidDateKey(value: string): boolean {
    if (!DATE_RE.test(value)) return false;
    return toDateKey(dateKeyToDate(value)) === value; // rejects 2026-02-30
}

export function timeToMinutes(value: string): number {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
}

/** Minutes between punch in and punch out on the same day, or null if either is missing or out is not after in. */
export function workedMinutes(punchIn?: string | null, punchOut?: string | null): number | null {
    if (!punchIn || !punchOut || !isValidTime(punchIn) || !isValidTime(punchOut)) return null;
    const diff = timeToMinutes(punchOut) - timeToMinutes(punchIn);
    return diff > 0 ? diff : null;
}

/** Minutes after shift start that the person punched in (0 if on time). */
export function lateMinutes(punchIn: string | null | undefined, shiftStart: string): number {
    if (!punchIn || !isValidTime(punchIn) || !isValidTime(shiftStart)) return 0;
    return Math.max(0, timeToMinutes(punchIn) - timeToMinutes(shiftStart));
}

/** Minutes worked after the shift ended (0 if they left on time or have not punched out). */
export function overtimeMinutes(punchOut: string | null | undefined, shiftEnd: string): number {
    if (!punchOut || !isValidTime(punchOut) || !isValidTime(shiftEnd)) return 0;
    return Math.max(0, timeToMinutes(punchOut) - timeToMinutes(shiftEnd));
}

export function formatMinutes(total: number): string {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function daysInMonth(year: number, month: number): number {
    // month is 1-12
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isSunday(key: string): boolean {
    return dateKeyToDate(key).getUTCDay() === 0;
}

/** Whether this day earns the Sunday extra: worked (present or half day) on a Sunday. */
export function earnsSundayExtra(date: string, status: string | null | undefined): boolean {
    return (status === "PRESENT" || status === "HALF_DAY") && isSunday(date);
}

export function dateKeyToDate(key: string): Date {
    return new Date(`${key}T00:00:00.000Z`);
}

export function toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function monthDateKeys(year: number, month: number): string[] {
    const count = daysInMonth(year, month);
    const mm = String(month).padStart(2, "0");
    return Array.from({ length: count }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, "0")}`);
}

/** Today's date and current time in the business time zone. */
export function businessNow(now: Date = new Date()): { date: string; time: string } {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: BUSINESS_TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(now)
            .map(p => [p.type, p.value])
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Parses "YYYY-MM" into { year, month }, falling back to the given default. */
export function parseMonthKey(value: string | undefined, fallbackDateKey: string): { year: number; month: number } {
    const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    const source = match ? [match[1], match[2]] : fallbackDateKey.split("-");
    return { year: Number(source[0]), month: Number(source[1]) };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
    const index = year * 12 + (month - 1) + delta;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, "0")}`;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function defaultOtRate(perDay: number, overtime: OvertimeSettings): number {
    const shiftMinutes = workedMinutes(overtime.shiftStart, overtime.shiftEnd);
    return shiftMinutes ? perDay / (shiftMinutes / 60) : 0;
}

/**
 * Salary for one month. Pay per day = monthly salary / days in that month.
 * LEAVE deducts a full day, HALF_DAY half a day; PRESENT and COMPANY_LEAVE are paid.
 * Unmarked days (counted between `countFrom` and `countTo`, inclusive) are reported but not deducted.
 * Overtime (minutes after shift end on PRESENT / HALF_DAY days) is paid per hour and added to net salary.
 * Working on a Sunday (PRESENT / HALF_DAY) earns an extra half day's pay; unmarked Sundays are the weekly off.
 */
export function calculateMonthlySalary(
    monthlySalary: number,
    year: number,
    month: number,
    records: AttendanceDay[],
    range?: { countFrom?: string; countTo?: string },
    overtime?: OvertimeSettings
): SalarySummary {
    const totalDays = daysInMonth(year, month);
    const perDay = monthlySalary / totalDays;
    const keys = monthDateKeys(year, month);
    const byDate = new Map(records.filter(r => keys.includes(r.date)).map(r => [r.date, r]));

    let present = 0, halfDays = 0, leaves = 0, companyLeaves = 0, deductedDays = 0, worked = 0, otMinutes = 0, sundaysWorked = 0;
    for (const record of byDate.values()) {
        const status = record.status as AttendanceStatus;
        if (status === "PRESENT") present++;
        else if (status === "HALF_DAY") halfDays++;
        else if (status === "LEAVE") leaves++;
        else if (status === "COMPANY_LEAVE") companyLeaves++;
        deductedDays += DEDUCTED_DAYS[status] ?? 0;
        if (earnsSundayExtra(record.date, status)) sundaysWorked++;
        worked += workedMinutes(record.punchIn, record.punchOut) ?? 0;
        if (overtime && (status === "PRESENT" || status === "HALF_DAY") && workedMinutes(record.punchIn, record.punchOut) !== null) {
            otMinutes += overtimeMinutes(record.punchOut, overtime.shiftEnd);
        }
    }

    const from = range?.countFrom ?? keys[0];
    const to = range?.countTo ?? keys[keys.length - 1];
    const unmarked = keys.filter(k => k >= from && k <= to && !byDate.has(k) && !isSunday(k)).length;

    const deduction = round2(perDay * deductedDays);
    const otRatePerHour = overtime ? round2(overtime.ratePerHour ?? defaultOtRate(perDay, overtime)) : 0;
    const otPay = round2((otMinutes / 60) * otRatePerHour);
    const sundayPay = round2(perDay * SUNDAY_EXTRA_DAYS * sundaysWorked);
    return {
        daysInMonth: totalDays,
        perDay: round2(perDay),
        present,
        halfDays,
        leaves,
        companyLeaves,
        unmarked,
        deductedDays,
        deduction,
        otMinutes,
        otRatePerHour,
        otPay,
        sundaysWorked,
        sundayPay,
        netSalary: round2(monthlySalary - deduction + otPay + sundayPay),
        workedMinutes: worked,
    };
}

export const PAYMENT_TYPES = ["PAYMENT", "BONUS"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** Month totals once bonuses and payments are known. Negative balance means paid in advance. */
export function salaryBalance(netSalary: number, entries: { type: string; amount: number }[]) {
    const bonus = round2(entries.filter(e => e.type === "BONUS").reduce((t, e) => t + e.amount, 0));
    const paid = round2(entries.filter(e => e.type !== "BONUS").reduce((t, e) => t + e.amount, 0));
    const totalPay = round2(netSalary + bonus);
    return { bonus, paid, totalPay, balance: round2(totalPay - paid) };
}
