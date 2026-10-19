"use server";

import { z } from "zod";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
    ATTENDANCE_STATUSES,
    businessNow,
    calculateMonthlySalary,
    dateKeyToDate,
    daysInMonth,
    isValidDateKey,
    isValidTime,
    monthKey,
    PAYMENT_TYPES,
    salaryBalance,
    toDateKey,
} from "@/lib/staff-attendance";

async function isAdminUser() {
    const session = await auth();
    if (!session?.user) return false;
    if ((session.user as { role?: string }).role === "admin") return true;
    if (session.user.email) {
        const dbUser = await db.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });
        return dbUser?.role === 'admin';
    }
    return false;
}

const UNAUTHORIZED = { success: false as const, error: "Unauthorized: Admin access required." };

const time = z.string().refine(isValidTime, "Use HH:mm time");
const dateKey = z.string().refine(isValidDateKey, "Invalid date");
const optionalText = z.string().trim().max(200).optional().transform(v => v || null);

const StaffSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    phone: optionalText,
    designation: optionalText,
    monthlySalary: z.coerce.number().min(0, "Salary cannot be negative"),
    shiftStart: time,
    shiftEnd: time,
    otRatePerHour: z.union([z.literal("").transform(() => null), z.null(), z.coerce.number().min(0, "OT rate cannot be negative")]).optional().transform(v => v ?? null),
    joinedAt: dateKey,
}).refine(s => s.shiftEnd > s.shiftStart, { message: "Shift end must be after shift start" });

export type StaffInput = z.input<typeof StaffSchema>;

const AttendanceSchema = z.object({
    status: z.enum(ATTENDANCE_STATUSES),
    punchIn: time.nullish(),
    punchOut: time.nullish(),
    note: optionalText,
});

export type AttendanceInput = z.input<typeof AttendanceSchema>;

function firstError(error: z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input";
}

function revalidateStaff(staffId?: string) {
    revalidatePath("/staff");
    if (staffId) revalidatePath(`/staff/${staffId}`);
}

export async function createStaff(input: StaffInput) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    const parsed = StaffSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: firstError(parsed.error) };

    try {
        const { joinedAt, ...data } = parsed.data;
        await db.staff.create({ data: { ...data, joinedAt: dateKeyToDate(joinedAt) } });
        revalidateStaff();
        return { success: true as const };
    } catch (error) {
        console.error("Failed to create staff:", error);
        return { success: false as const, error: "Failed to add staff member." };
    }
}

export async function updateStaff(id: string, input: StaffInput) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    const parsed = StaffSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: firstError(parsed.error) };

    try {
        const { joinedAt, ...data } = parsed.data;
        await db.staff.update({ where: { id }, data: { ...data, joinedAt: dateKeyToDate(joinedAt) } });
        revalidateStaff(id);
        return { success: true as const };
    } catch (error) {
        console.error("Failed to update staff:", error);
        return { success: false as const, error: "Failed to update staff member." };
    }
}

/** Inactive staff are hidden from the daily board but keep their history. */
export async function setStaffActive(id: string, active: boolean) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    try {
        await db.staff.update({ where: { id }, data: { active } });
        revalidateStaff(id);
        return { success: true as const };
    } catch (error) {
        console.error("Failed to change staff status:", error);
        return { success: false as const, error: "Failed to change staff status." };
    }
}

function serializeRecord(r: { date: Date; status: string; punchIn: string | null; punchOut: string | null; note: string | null }) {
    return { date: toDateKey(r.date), status: r.status, punchIn: r.punchIn, punchOut: r.punchOut, note: r.note };
}

function serializeStaff(s: { id: string; name: string; phone: string | null; designation: string | null; monthlySalary: number; shiftStart: string; shiftEnd: string; otRatePerHour: number | null; joinedAt: Date; active: boolean }) {
    return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        designation: s.designation,
        monthlySalary: s.monthlySalary,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        otRatePerHour: s.otRatePerHour,
        joinedAt: toDateKey(s.joinedAt),
        active: s.active,
    };
}

export type StaffMember = ReturnType<typeof serializeStaff>;
export type AttendanceRecord = ReturnType<typeof serializeRecord>;

/** Active staff who had joined by `date`, with their record for that day. */
export async function getDailyAttendance(date: string) {
    if (!await isAdminUser() || !isValidDateKey(date)) return [];
    const day = dateKeyToDate(date);
    const staff = await db.staff.findMany({
        where: { active: true, joinedAt: { lte: day } },
        include: { attendance: { where: { date: day } } },
        orderBy: { name: "asc" },
    });
    return staff.map(s => ({
        staff: serializeStaff(s),
        record: s.attendance[0] ? serializeRecord(s.attendance[0]) : null,
    }));
}

export async function saveAttendance(staffId: string, date: string, input: AttendanceInput) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    if (!isValidDateKey(date)) return { success: false as const, error: "Invalid date" };
    const parsed = AttendanceSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: firstError(parsed.error) };

    const onLeave = parsed.data.status === "LEAVE" || parsed.data.status === "COMPANY_LEAVE";
    const data = {
        status: parsed.data.status,
        punchIn: onLeave ? null : parsed.data.punchIn ?? null,
        punchOut: onLeave ? null : parsed.data.punchOut ?? null,
        note: parsed.data.note,
    };
    if (data.punchIn && data.punchOut && data.punchOut <= data.punchIn) {
        return { success: false as const, error: "Punch out must be after punch in." };
    }

    try {
        const day = dateKeyToDate(date);
        await db.staffAttendance.upsert({
            where: { staffId_date: { staffId, date: day } },
            create: { staffId, date: day, ...data },
            update: data,
        });
        revalidateStaff(staffId);
        return { success: true as const };
    } catch (error) {
        console.error("Failed to save attendance:", error);
        return { success: false as const, error: "Failed to save attendance." };
    }
}

/** Records the current India time as punch in or punch out for today. */
export async function punchNow(staffId: string, kind: "in" | "out") {
    if (!await isAdminUser()) return UNAUTHORIZED;
    const now = businessNow();
    const day = dateKeyToDate(now.date);

    try {
        const existing = await db.staffAttendance.findUnique({ where: { staffId_date: { staffId, date: day } } });
        if (kind === "out") {
            if (!existing?.punchIn) return { success: false as const, error: "Punch in first." };
            if (now.time <= existing.punchIn) return { success: false as const, error: "Punch out must be after punch in." };
            await db.staffAttendance.update({ where: { id: existing.id }, data: { punchOut: now.time } });
        } else {
            if (existing?.status === "LEAVE" || existing?.status === "COMPANY_LEAVE") {
                return { success: false as const, error: "Marked on leave today. Change the status first." };
            }
            await db.staffAttendance.upsert({
                where: { staffId_date: { staffId, date: day } },
                create: { staffId, date: day, status: "PRESENT", punchIn: now.time },
                update: { punchIn: now.time },
            });
        }
        revalidateStaff(staffId);
        return { success: true as const, time: now.time };
    } catch (error) {
        console.error("Failed to punch:", error);
        return { success: false as const, error: "Failed to record punch." };
    }
}

export async function clearAttendance(staffId: string, date: string) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    if (!isValidDateKey(date)) return { success: false as const, error: "Invalid date" };
    try {
        await db.staffAttendance.deleteMany({ where: { staffId, date: dateKeyToDate(date) } });
        revalidateStaff(staffId);
        return { success: true as const };
    } catch (error) {
        console.error("Failed to clear attendance:", error);
        return { success: false as const, error: "Failed to clear attendance." };
    }
}

/** Marks a paid company leave (holiday, weekly off) for every active staff member on `date`. Existing records are replaced. */
export async function markCompanyLeaveForAll(date: string, note?: string) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    if (!isValidDateKey(date)) return { success: false as const, error: "Invalid date" };
    const day = dateKeyToDate(date);
    const cleanNote = note?.trim().slice(0, 200) || null;

    try {
        const staff = await db.staff.findMany({ where: { active: true, joinedAt: { lte: day } }, select: { id: true } });
        await db.$transaction(staff.map(s => db.staffAttendance.upsert({
            where: { staffId_date: { staffId: s.id, date: day } },
            create: { staffId: s.id, date: day, status: "COMPANY_LEAVE", note: cleanNote },
            update: { status: "COMPANY_LEAVE", punchIn: null, punchOut: null, note: cleanNote },
        })));
        revalidateStaff();
        return { success: true as const, count: staff.length };
    } catch (error) {
        console.error("Failed to mark company leave:", error);
        return { success: false as const, error: "Failed to mark company leave." };
    }
}

const PaymentSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    type: z.enum(PAYMENT_TYPES),
    amount: z.coerce.number().positive("Amount must be more than 0"),
    paidOn: dateKey,
    note: optionalText,
});

export type PaymentInput = z.input<typeof PaymentSchema>;

/** Records a PAYMENT (any amount paid: advance, part or full salary) or a BONUS against a salary month. */
export async function addStaffPayment(staffId: string, input: PaymentInput) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    const parsed = PaymentSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: firstError(parsed.error) };

    try {
        const { paidOn, ...data } = parsed.data;
        await db.staffPayment.create({ data: { staffId, ...data, paidOn: dateKeyToDate(paidOn) } });
        revalidateStaff(staffId);
        return { success: true as const };
    } catch (error) {
        console.error("Failed to add payment:", error);
        return { success: false as const, error: "Failed to record payment." };
    }
}

export async function deleteStaffPayment(id: string) {
    if (!await isAdminUser()) return UNAUTHORIZED;
    try {
        const payment = await db.staffPayment.delete({ where: { id } });
        revalidateStaff(payment.staffId);
        return { success: true as const };
    } catch (error) {
        console.error("Failed to delete payment:", error);
        return { success: false as const, error: "Failed to delete payment." };
    }
}

function serializePayment(p: { id: string; type: string; amount: number; paidOn: Date; note: string | null }) {
    return { id: p.id, type: p.type, amount: p.amount, paidOn: toDateKey(p.paidOn), note: p.note };
}

export type StaffPaymentRecord = ReturnType<typeof serializePayment>;

function overtimeSettings(s: StaffMember) {
    return { shiftStart: s.shiftStart, shiftEnd: s.shiftEnd, ratePerHour: s.otRatePerHour };
}

function countRange(joinedAt: string, year: number, month: number, today: string) {
    const first = `${monthKey(year, month)}-01`;
    const last = `${monthKey(year, month)}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
    return { countFrom: joinedAt > first ? joinedAt : first, countTo: today < last ? today : last, joinedAt };
}

/** Salary for every staff member employed during the month (active, or with attendance in it). */
export async function getSalarySheet(year: number, month: number) {
    if (!await isAdminUser()) return [];
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    const today = businessNow().date;

    const staff = await db.staff.findMany({
        where: {
            joinedAt: { lte: end },
            OR: [
                { active: true },
                { attendance: { some: { date: { gte: start, lte: end } } } },
                { payments: { some: { year, month } } },
            ],
        },
        include: {
            attendance: { where: { date: { gte: start, lte: end } } },
            payments: { where: { year, month }, select: { type: true, amount: true } },
        },
        orderBy: { name: "asc" },
    });

    return staff.map(s => {
        const member = serializeStaff(s);
        const summary = calculateMonthlySalary(s.monthlySalary, year, month, s.attendance.map(serializeRecord), countRange(member.joinedAt, year, month, today), overtimeSettings(member));
        return { staff: member, summary, ...salaryBalance(summary.netSalary, s.payments) };
    });
}

export async function getStaffMonth(staffId: string, year: number, month: number) {
    if (!await isAdminUser()) return null;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    const staff = await db.staff.findUnique({
        where: { id: staffId },
        include: {
            attendance: { where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } },
            payments: { where: { year, month }, orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }] },
        },
    });
    if (!staff) return null;

    const member = serializeStaff(staff);
    const records = staff.attendance.map(serializeRecord);
    const summary = calculateMonthlySalary(staff.monthlySalary, year, month, records, countRange(member.joinedAt, year, month, businessNow().date), overtimeSettings(member));
    return {
        staff: member,
        records,
        summary,
        payments: staff.payments.map(serializePayment),
        ...salaryBalance(summary.netSalary, staff.payments),
    };
}
