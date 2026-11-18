"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { businessNow } from "@/lib/staff-attendance";
import { VENDOR_PAYOUT_CATEGORY, type PaymentRow, type WorkRow } from "@/lib/vendor-ledger";

async function isAdminUser() {
    const session = await auth();
    if (!session?.user) return false;
    if ((session.user as { role?: string }).role === "admin") return true;
    if (session.user.email) {
        const dbUser = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true } });
        return dbUser?.role === "admin";
    }
    return false;
}

const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(dayToDate(day).getTime());

export interface VendorLedgerData {
    work: WorkRow[];
    payouts: PaymentRow[];
    vendors: string[]; // vendor names used in work rows and in measurements
}

/** All work rows and all "Vendor's payout" expenses; the page groups them per vendor. */
export async function getVendorLedger(): Promise<{ ok: true; data: VendorLedgerData } | { ok: false; error: string }> {
    if (!(await isAdminUser())) return { ok: false, error: "Only admins can view the vendor ledger." };
    try {
        const work = await db.vendorWork.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
        const payouts = await db.transaction.findMany({
            where: { type: "EXPENSE", category: VENDOR_PAYOUT_CATEGORY },
            select: { id: true, date: true, amount: true, description: true },
            orderBy: { date: "asc" },
        });
        const measurements = await db.measurement.findMany({ select: { data: true } });

        const fromMeasurements: string[] = [];
        for (const m of measurements) {
            let data: any = m.data;
            if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = null; } }
            const v = data?.sharedSizes?.vendors;
            if (v) for (const name of [v.tracks, v.blinds, v.curtains]) if (typeof name === "string" && name.trim()) fromMeasurements.push(name.trim());
        }

        return {
            ok: true,
            data: {
                work: work.map((w) => ({ id: w.id, vendor: w.vendor, nos: w.nos, type: w.type, date: w.date.toISOString().slice(0, 10), price: w.price, notes: w.notes })),
                payouts: payouts.map((p) => ({ id: p.id, date: businessNow(p.date).date, amount: p.amount, description: p.description || "" })),
                vendors: fromMeasurements,
            },
        };
    } catch (e) {
        console.error("Failed to load vendor ledger:", e);
        return { ok: false, error: "Vendor ledger is not set up yet. Run prisma/sql/2026-11-18-vendor-work.sql on the database." };
    }
}

export interface WorkInput {
    vendor: string;
    nos: number;
    type: string;
    date: string;
    price: number;
    notes?: string;
}

function clean(input: WorkInput): { ok: true; data: Omit<WorkInput, "date"> & { date: Date } } | { ok: false; error: string } {
    const vendor = input.vendor?.trim();
    const type = input.type?.trim();
    if (!vendor) return { ok: false, error: "Enter the vendor name." };
    if (!type) return { ok: false, error: "Enter the type." };
    if (!Number.isFinite(input.nos) || input.nos <= 0) return { ok: false, error: "Enter how many (nos)." };
    if (!Number.isFinite(input.price) || input.price < 0) return { ok: false, error: "Enter a valid price." };
    if (!isDay(input.date)) return { ok: false, error: "Enter a valid date." };
    return { ok: true, data: { vendor, type, nos: input.nos, price: input.price, date: dayToDate(input.date), notes: input.notes?.trim() || undefined } };
}

export async function saveVendorWork(input: WorkInput, id?: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change the vendor ledger." };
    const c = clean(input);
    if (!c.ok) return c;
    try {
        const data = { ...c.data, notes: c.data.notes ?? null };
        if (id) await db.vendorWork.update({ where: { id }, data });
        else await db.vendorWork.create({ data });
        revalidatePath("/vendors");
        return { ok: true as const };
    } catch (e) {
        console.error("Failed to save vendor work:", e);
        return { ok: false as const, error: "Failed to save." };
    }
}

export async function deleteVendorWork(id: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change the vendor ledger." };
    try {
        await db.vendorWork.delete({ where: { id } });
        revalidatePath("/vendors");
        return { ok: true as const };
    } catch (e) {
        console.error("Failed to delete vendor work:", e);
        return { ok: false as const, error: "Failed to delete." };
    }
}
