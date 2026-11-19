"use server";

import { createHash } from "node:crypto";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { businessNow } from "@/lib/staff-attendance";
import { asKind, mergeVendors, type BillInfo, type PaymentRow, type VendorInfo, type VendorKind, type WorkRow } from "@/lib/vendor-ledger";

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
    bills: BillInfo[];
    payouts: PaymentRow[]; // expenses whose description names one of the vendors
    vendors: VendorInfo[]; // directory + names only seen in ledger rows or measurements
}

const MEASUREMENT_KINDS: Record<string, VendorKind> = { tracks: "TRACKS", blinds: "BLINDS", curtains: "STITCHING" };

/** Directory, all work rows, and the expenses that name a vendor; the page groups them per vendor. */
export async function getVendorLedger(): Promise<{ ok: true; data: VendorLedgerData } | { ok: false; error: string }> {
    if (!(await isAdminUser())) return { ok: false, error: "Only admins can view vendors." };
    try {
        const directory = await db.vendor.findMany({ orderBy: { name: "asc" } });
        const work = await db.vendorWork.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
        const bills = await db.vendorBill.findMany({ orderBy: { date: "asc" } });
        const measurements = await db.measurement.findMany({ select: { data: true } });

        const others: Array<{ name: string; kind: VendorKind }> = work.map((w) => ({ name: w.vendor, kind: "OTHER" as VendorKind }));
        for (const m of measurements) {
            let data: unknown = m.data;
            if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = null; } }
            const v = (data as { sharedSizes?: { vendors?: Record<string, unknown> } } | null)?.sharedSizes?.vendors;
            if (v) for (const [field, kind] of Object.entries(MEASUREMENT_KINDS)) {
                const name = v[field];
                if (typeof name === "string" && name.trim()) others.push({ name: name.trim(), kind });
            }
        }
        const vendors = mergeVendors(
            directory.map((d) => ({ id: d.id, name: d.name, kind: asKind(d.kind), phone: d.phone, address: d.address, notes: d.notes })),
            others,
        );

        // Any expense category counts; the page keeps only whole-word name matches.
        const payouts = vendors.length === 0 ? [] : await db.transaction.findMany({
            where: { type: "EXPENSE", OR: vendors.map((v) => ({ description: { contains: v.name, mode: "insensitive" as const } })) },
            select: { id: true, date: true, amount: true, description: true },
            orderBy: { date: "asc" },
        });

        return {
            ok: true,
            data: {
                work: work.map((w) => ({ id: w.id, vendor: w.vendor, nos: w.nos, type: w.type, date: w.date.toISOString().slice(0, 10), price: w.price, notes: w.notes, gstPercent: w.gstPercent, refNo: w.refNo, billId: w.billId })),
                bills: bills.map((b) => ({
                    id: b.id, vendor: b.vendor, refNo: b.refNo, date: b.date.toISOString().slice(0, 10), gstPercent: b.gstPercent, roundOff: b.roundOff,
                    notes: b.notes, attachmentId: b.attachmentId, fileName: b.fileName, fileHash: b.fileHash,
                })),
                payouts: payouts.map((p) => ({ id: p.id, date: businessNow(p.date).date, amount: p.amount, description: p.description || "" })),
                vendors,
            },
        };
    } catch (e) {
        console.error("Failed to load vendor ledger:", e);
        return { ok: false, error: "Vendors are not set up yet. Run prisma/sql/2026-11-18-vendor-work.sql and 2026-11-19-vendor-directory.sql on the database." };
    }
}

export interface VendorInput {
    name: string;
    kind: VendorKind;
    phone?: string;
    address?: string;
    notes?: string;
}

/** Adds or edits a directory entry. Renaming also renames that vendor's ledger rows. */
export async function saveVendor(input: VendorInput, id?: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change vendors." };
    const name = input.name?.trim();
    if (!name) return { ok: false as const, error: "Enter the vendor name." };
    const data = { name, kind: asKind(input.kind), phone: input.phone?.trim() || null, address: input.address?.trim() || null, notes: input.notes?.trim() || null };
    try {
        const clash = await db.vendor.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
        if (clash) return { ok: false as const, error: `"${clash.name}" is already in the list.` };
        if (id) {
            const old = await db.vendor.findUnique({ where: { id } });
            if (!old) return { ok: false as const, error: "Vendor not found." };
            await db.$transaction([
                db.vendor.update({ where: { id }, data }),
                ...(old.name !== name ? [db.vendorWork.updateMany({ where: { vendor: { equals: old.name, mode: "insensitive" } }, data: { vendor: name } })] : []),
            ]);
        } else {
            await db.vendor.create({ data });
        }
        revalidatePath("/vendors");
        return { ok: true as const };
    } catch (e) {
        console.error("Failed to save vendor:", e);
        return { ok: false as const, error: "Failed to save." };
    }
}

/** Removes a directory entry. Its ledger rows are kept (the name still shows in the ledger). */
export async function deleteVendor(id: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change vendors." };
    try {
        await db.vendor.delete({ where: { id } });
        revalidatePath("/vendors");
        return { ok: true as const };
    } catch (e) {
        console.error("Failed to delete vendor:", e);
        return { ok: false as const, error: "Failed to delete." };
    }
}

export interface WorkInput {
    vendor: string;
    nos: number;
    type: string;
    date: string;
    price: number;
    notes?: string;
    gstPercent?: number | null; // null / 0 = no GST
    refNo?: string;
}

function clean(input: WorkInput): { ok: true; data: Omit<WorkInput, "date"> & { date: Date } } | { ok: false; error: string } {
    const vendor = input.vendor?.trim();
    const type = input.type?.trim();
    if (!vendor) return { ok: false, error: "Enter the vendor name." };
    if (!type) return { ok: false, error: "Enter the type." };
    if (!Number.isFinite(input.nos) || input.nos <= 0) return { ok: false, error: "Enter how many (nos)." };
    if (!Number.isFinite(input.price) || input.price < 0) return { ok: false, error: "Enter a valid price." };
    if (!isDay(input.date)) return { ok: false, error: "Enter a valid date." };
    const gst = input.gstPercent ?? null;
    if (gst !== null && (!Number.isFinite(gst) || gst < 0 || gst > 100)) return { ok: false, error: "Enter a GST % between 0 and 100." };
    return {
        ok: true,
        data: {
            vendor, type, nos: input.nos, price: input.price, date: dayToDate(input.date), notes: input.notes?.trim() || undefined,
            gstPercent: gst || null, refNo: input.refNo?.trim() || undefined,
        },
    };
}

export async function saveVendorWork(input: WorkInput, id?: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change the vendor ledger." };
    const c = clean(input);
    if (!c.ok) return c;
    try {
        const data = { ...c.data, notes: c.data.notes ?? null, refNo: c.data.refNo ?? null };
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

export interface BillInput {
    vendor: string;
    refNo?: string;
    date: string;
    gstPercent?: number | null;
    roundOff?: number | null; // added to the bill total
    notes?: string;
    attachmentId?: string | null;
    fileName?: string | null;
    items: Array<{ type: string; nos: number; price: number }>;
    allowDuplicate?: boolean; // saving after the "already entered" warning
}

export interface DuplicateBill { id: string; vendor: string; refNo: string | null; date: string; reason: string }

async function fileHashOf(attachmentId: string | null | undefined): Promise<string | null> {
    if (!attachmentId) return null;
    const a = await db.attachment.findUnique({ where: { id: attachmentId }, select: { data: true } });
    return a ? createHash("sha256").update(a.data).digest("hex") : null;
}

/** An existing bill with the same file (any vendor) or the same bill no. for this vendor. */
async function findDuplicateBill(q: { vendor: string; refNo?: string | null; fileHash: string | null; excludeId?: string }): Promise<DuplicateBill | null> {
    const refNo = q.refNo?.trim();
    const or = [
        ...(q.fileHash ? [{ fileHash: q.fileHash }] : []),
        ...(refNo && q.vendor.trim() ? [{ vendor: { equals: q.vendor.trim(), mode: "insensitive" as const }, refNo: { equals: refNo, mode: "insensitive" as const } }] : []),
    ];
    if (or.length === 0) return null;
    const found = await db.vendorBill.findFirst({ where: { OR: or, ...(q.excludeId ? { id: { not: q.excludeId } } : {}) }, orderBy: { date: "asc" } });
    if (!found) return null;
    return {
        id: found.id, vendor: found.vendor, refNo: found.refNo, date: found.date.toISOString().slice(0, 10),
        reason: q.fileHash && found.fileHash === q.fileHash ? "This file was already uploaded" : "This bill no. is already entered",
    };
}

/** For the bill form: warn as soon as a bill is uploaded / its no. is known. */
export async function checkVendorBillDuplicate(q: { vendor: string; refNo?: string | null; attachmentId?: string | null; excludeId?: string }) {
    if (!(await isAdminUser())) return null;
    return findDuplicateBill({ vendor: q.vendor, refNo: q.refNo, fileHash: await fileHashOf(q.attachmentId), excludeId: q.excludeId });
}

/** Saves a whole bill and its lines (replacing the old lines when editing). Lines get the bill's date, GST and no. */
export async function saveVendorBill(input: BillInput, id?: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change the vendor ledger." };
    const items = input.items.filter((i) => i.type?.trim() || i.nos || i.price);
    if (items.length === 0) return { ok: false as const, error: "Add at least one item." };
    const roundOff = Math.round((Number(input.roundOff) || 0) * 100) / 100;
    if (Math.abs(roundOff) >= 100) return { ok: false as const, error: "Round off must be under ₹100." };
    // Validate every line with the same rules as a single line
    const lines: Array<Omit<WorkInput, "date" | "notes" | "refNo"> & { date: Date; notes: null; refNo: string | null }> = [];
    for (const [n, i] of items.entries()) {
        const c = clean({ vendor: input.vendor, type: i.type, nos: i.nos, price: i.price, date: input.date, gstPercent: input.gstPercent, refNo: input.refNo });
        if (!c.ok) return { ok: false as const, error: `Item ${n + 1}: ${c.error}` };
        lines.push({ ...c.data, notes: null, refNo: c.data.refNo ?? null });
    }
    const head = lines[0];
    const fileHash = await fileHashOf(input.attachmentId);
    if (!input.allowDuplicate) {
        const dup = await findDuplicateBill({ vendor: head.vendor, refNo: head.refNo, fileHash, excludeId: id });
        if (dup) return { ok: false as const, error: `${dup.reason}: bill ${dup.refNo || "(no number)"} of ${dup.vendor}, dated ${dup.date}.`, duplicate: dup };
    }
    const bill = {
        vendor: head.vendor, refNo: head.refNo, date: head.date, gstPercent: head.gstPercent ?? null, roundOff: roundOff || null,
        notes: input.notes?.trim() || null, attachmentId: input.attachmentId || null, fileName: input.fileName || null, fileHash,
    };
    try {
        await db.$transaction(async (tx) => {
            let billId = id;
            if (billId) {
                const old = await tx.vendorBill.findUnique({ where: { id: billId } });
                if (!old) throw new Error("Bill not found.");
                await tx.vendorBill.update({ where: { id: billId }, data: bill });
                await tx.vendorWork.deleteMany({ where: { billId } });
                if (old.attachmentId && old.attachmentId !== bill.attachmentId) await tx.attachment.deleteMany({ where: { id: old.attachmentId } });
            } else {
                billId = (await tx.vendorBill.create({ data: bill })).id;
            }
            await tx.vendorWork.createMany({ data: lines.map((l) => ({ ...l, billId })) });
        });
        revalidatePath("/vendors");
        return { ok: true as const };
    } catch (e) {
        console.error("Failed to save vendor bill:", e);
        return { ok: false as const, error: e instanceof Error && e.message === "Bill not found." ? e.message : "Failed to save the bill." };
    }
}

/** Deletes a bill, its lines and its uploaded file. */
export async function deleteVendorBill(id: string) {
    if (!(await isAdminUser())) return { ok: false as const, error: "Only admins can change the vendor ledger." };
    try {
        await db.$transaction(async (tx) => {
            const bill = await tx.vendorBill.findUnique({ where: { id } });
            if (!bill) return;
            await tx.vendorWork.deleteMany({ where: { billId: id } });
            await tx.vendorBill.delete({ where: { id } });
            if (bill.attachmentId) await tx.attachment.deleteMany({ where: { id: bill.attachmentId } });
        });
        revalidatePath("/vendors");
        return { ok: true as const };
    } catch (e) {
        console.error("Failed to delete vendor bill:", e);
        return { ok: false as const, error: "Failed to delete the bill." };
    }
}
