import prisma from "@/lib/db";
import { Actor, isAdmin } from "./types";

export interface QuotationItemInput {
    description: string;
    details?: string;
    quantity: number;
    rate: number;
    discount?: number;
    amount: number;
}

export interface CreateQuotationInput {
    number?: string;
    leadId: string;
    items: QuotationItemInput[];
    subtotal: number;
    tax?: number;
    discount?: number;
    discountCode?: string;
    discountType?: string;
    total: number;
    previousBalance?: number;
    description?: string;
    services?: any;
    deadline?: Date | string | null;
}

export interface UpdateQuotationInput extends CreateQuotationInput {
    receivedAmount?: number;
    status?: string;
}

const leadSummary = { select: { name: true, city: true, phone: true } };

const ownedBy = (actor: Actor) => (isAdmin(actor) ? {} : { userId: actor.id });

/** True when a non-admin actor is touching a quotation owned by someone else. */
async function isForeignQuotation(actor: Actor, id: string) {
    if (isAdmin(actor)) return false;
    const existing = await (prisma as any).quotation.findUnique({ where: { id } });
    return !!existing && existing.userId !== actor.id;
}

export async function nextQuotationNumber() {
    const count = await (prisma as any).quotation.count();
    return `EST-${new Date().getFullYear()}-${(count + 1).toString().padStart(3, '0')}`;
}

const mapItems = (items: QuotationItemInput[]) => items.map(item => ({
    description: item.description,
    details: item.details,
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount || 0,
    amount: item.amount,
}));

export async function listQuotations(actor: Actor) {
    return (prisma as any).quotation.findMany({
        where: ownedBy(actor) as any,
        include: { lead: leadSummary, items: true },
        orderBy: { createdAt: 'desc' },
    });
}

export async function listActiveOrders(actor: Actor) {
    return (prisma as any).quotation.findMany({
        where: {
            ...ownedBy(actor),
            status: {
                not: 'DRAFT'
            }
        },
        include: { lead: leadSummary, items: true },
        orderBy: { createdAt: 'desc' },
    });
}

export async function updateOrderStatus(id: string, status: string, deadline?: Date | string | null) {
    await (prisma as any).quotation.update({
        where: { id },
        data: {
            status,
            ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {})
        }
    });
}

export async function createQuotation(actor: Actor | null, data: CreateQuotationInput) {
    if (!actor?.id) return { success: false, error: "Unauthorized" };

    // Generate a simple number if not provided
    const number = data.number || await nextQuotationNumber();

    // Check if number exists
    const existing = await (prisma as any).quotation.findUnique({ where: { number } });
    if (existing) {
        return { success: false, error: `Quotation number ${number} already exists.` };
    }

    const quotation = await prisma.$transaction(async (tx) => {
        return (tx as any).quotation.create({
            data: {
                number,
                leadId: data.leadId,
                userId: actor.id,
                subtotal: data.subtotal,
                tax: data.tax || 0,
                discount: data.discount || 0,
                discountCode: data.discountCode,
                discountType: data.discountType || 'FIXED',
                total: data.total,
                previousBalance: data.previousBalance || 0,
                description: data.description,
                services: data.services,
                deadline: (data.deadline && !isNaN(new Date(data.deadline).getTime())) ? new Date(data.deadline) : null,
                items: {
                    create: mapItems(data.items),
                },
            },
            include: { items: true }
        });
    });

    return { success: true, data: quotation as any };
}

export async function updateQuotation(actor: Actor, id: string, data: UpdateQuotationInput) {
    if (await isForeignQuotation(actor, id)) {
        return { success: false, error: "Unauthorized access to this quotation" };
    }

    // Check if new number collides, if changed
    if (data.number) {
        const existingWithNumber = await (prisma as any).quotation.findUnique({ where: { number: data.number } });
        if (existingWithNumber && existingWithNumber.id !== id) {
            return { success: false, error: `Quotation number ${data.number} already exists.` };
        }
    }

    const quotation = await prisma.$transaction(async (tx) => {
        await (tx as any).quotationItem.deleteMany({
            where: { quotationId: id }
        });

        const updateData: any = {
            leadId: data.leadId,
            subtotal: data.subtotal,
            tax: data.tax || 0,
            discount: data.discount || 0,
            discountCode: data.discountCode,
            discountType: data.discountType || 'FIXED',
            total: data.total,
            receivedAmount: data.receivedAmount || 0,
            previousBalance: data.previousBalance || 0,
            status: data.status,
            description: data.description,
            services: data.services,
            items: {
                create: mapItems(data.items),
            },
        };

        if (data.number && data.number.trim() !== "") {
            updateData.number = data.number;
        }

        if (data.deadline) {
            const date = new Date(data.deadline);
            updateData.deadline = !isNaN(date.getTime()) ? date : null;
        } else {
            updateData.deadline = null;
        }

        return (tx as any).quotation.update({
            where: { id },
            data: updateData,
            include: { lead: leadSummary, items: true }
        });
    });

    return { success: true, data: quotation as any };
}

export async function deleteQuotation(actor: Actor, id: string) {
    if (await isForeignQuotation(actor, id)) {
        return { success: false, error: "Unauthorized access" };
    }

    await (prisma as any).quotation.delete({ where: { id } });
    return { success: true };
}

export async function getQuotation(actor: Actor, id: string) {
    const quotation = await (prisma as any).quotation.findUnique({
        where: { id },
        include: { lead: leadSummary, items: true },
    });
    if (!quotation) return { success: false, error: "Quotation not found" };

    if (!isAdmin(actor) && quotation.userId !== actor.id) {
        return { success: false, error: "Unauthorized access" };
    }

    return { success: true, data: quotation };
}

export async function markAsSale(actor: Actor, id: string) {
    if (await isForeignQuotation(actor, id)) {
        return { success: false, error: "Unauthorized access" };
    }

    // Get quotation with items before updating
    const quotation = await (prisma as any).quotation.findUnique({
        where: { id },
        include: { items: true }
    });

    if (!quotation) {
        return { success: false, error: "Quotation not found" };
    }

    // Update quotation status to SALE
    await (prisma as any).quotation.update({
        where: { id },
        data: { status: 'SALE' },
    });

    // Deduct stock for each item in the quotation
    for (const item of quotation.items) {
        // Try to find matching product by name (description in quotation item)
        const product = await (prisma as any).product.findFirst({
            where: {
                name: {
                    equals: item.description,
                    mode: 'insensitive'
                }
            }
        });

        if (product && product.stockKind === 'ACCESSORY') {
            // Calculate new stock quantity (can go negative for backorders)
            const quantity = Math.round(item.quantity);
            const newQuantity = product.stockQuantity - quantity;

            // Update product stock and record it in the stock history
            await prisma.$transaction([
                (prisma as any).product.update({
                    where: { id: product.id },
                    data: { stockQuantity: newQuantity }
                }),
                (prisma as any).stockMovement.create({
                    data: { productId: product.id, type: 'USE', quantity: -quantity, note: `Sale ${quotation.number}`, userId: actor.id }
                }),
            ]);

            console.log(`✅ Stock updated for ${product.name}: ${product.stockQuantity} → ${newQuantity}`);
        } else if (product) {
            // Fabric and track stock is kept as pieces - those are booked from the Stock page or the track cutting plan
            console.log(`ℹ️ ${product.name} is ${product.stockKind} stock, not deducted automatically`);
        } else {
            console.warn(`⚠️ Product not found in inventory: ${item.description}`);
        }
    }

    return { success: true };
}

// ---------------------------------------------------------------------------
// Row-level writes for the mobile sync upload. An offline client edits the
// Quotation row and its QuotationItem rows separately, so these mirror the
// rules above (ownership, number generation) one row at a time.
// ---------------------------------------------------------------------------

export interface QuotationRowInput {
    number?: string | null;
    leadId?: string;
    subtotal?: number;
    tax?: number;
    discount?: number;
    discountCode?: string | null;
    discountType?: string;
    total?: number;
    status?: string;
    description?: string | null;
    services?: any;
    receivedAmount?: number;
    previousBalance?: number;
    deadline?: Date | null;
    date?: Date;
}

export async function upsertQuotationRow(actor: Actor, id: string, row: QuotationRowInput) {
    const existing = await (prisma as any).quotation.findUnique({ where: { id } });

    if (existing) {
        if (!isAdmin(actor) && existing.userId !== actor.id) {
            return { success: false, error: "Unauthorized access to this quotation" };
        }
        // A blank number from the client means "keep what the server assigned"
        const { number, ...rest } = row;
        const data: any = { ...rest };
        if (number && number.trim() !== "" && number !== existing.number) {
            const clash = await (prisma as any).quotation.findUnique({ where: { number } });
            if (clash) return { success: false, error: `Quotation number ${number} already exists.` };
            data.number = number;
        }
        await (prisma as any).quotation.update({ where: { id }, data });
        return { success: true };
    }

    if (!row.leadId) return { success: false, error: "A customer is required" };

    const lead = await (prisma as any).lead.findUnique({ where: { id: row.leadId } });
    if (!lead) return { success: false, error: "Customer not found" };
    if (!isAdmin(actor) && lead.userId !== actor.id) {
        return { success: false, error: "Unauthorized access to this lead" };
    }

    const number = row.number && row.number.trim() !== "" ? row.number : await nextQuotationNumber();
    const clash = await (prisma as any).quotation.findUnique({ where: { number } });
    if (clash) return { success: false, error: `Quotation number ${number} already exists.` };

    await (prisma as any).quotation.create({
        data: {
            id,
            number,
            leadId: row.leadId,
            userId: actor.id,
            subtotal: row.subtotal ?? 0,
            tax: row.tax ?? 0,
            discount: row.discount ?? 0,
            discountCode: row.discountCode,
            discountType: row.discountType || 'FIXED',
            total: row.total ?? 0,
            status: row.status || 'DRAFT',
            description: row.description,
            services: row.services,
            receivedAmount: row.receivedAmount ?? 0,
            previousBalance: row.previousBalance ?? 0,
            deadline: row.deadline ?? null,
            ...(row.date ? { date: row.date } : {}),
        },
    });
    return { success: true };
}

export interface QuotationItemRowInput {
    quotationId?: string;
    description?: string;
    details?: string | null;
    quantity?: number;
    rate?: number;
    discount?: number | null;
    amount?: number;
}

export async function upsertQuotationItemRow(actor: Actor, id: string, row: QuotationItemRowInput) {
    const existing = await (prisma as any).quotationItem.findUnique({ where: { id } });
    const quotationId = existing?.quotationId ?? row.quotationId;
    if (!quotationId) return { success: false, error: "Item is missing its quotation" };

    const parent = await (prisma as any).quotation.findUnique({ where: { id: quotationId } });
    if (!parent) return { success: false, error: "Quotation not found" };
    if (!isAdmin(actor) && parent.userId !== actor.id) {
        return { success: false, error: "Unauthorized access to this quotation" };
    }

    if (existing) {
        // Items never move between quotations
        const { quotationId: _ignored, ...data } = row;
        await (prisma as any).quotationItem.update({ where: { id }, data });
    } else {
        await (prisma as any).quotationItem.create({
            data: {
                id,
                quotationId,
                description: row.description ?? "",
                details: row.details,
                quantity: row.quantity ?? 0,
                rate: row.rate ?? 0,
                discount: row.discount ?? 0,
                amount: row.amount ?? 0,
            },
        });
    }
    return { success: true };
}

export async function deleteQuotationItemRow(actor: Actor, id: string) {
    const existing = await (prisma as any).quotationItem.findUnique({
        where: { id },
        include: { quotation: true },
    });
    // Already gone (e.g. its quotation was deleted first) - nothing to do
    if (!existing) return { success: true };

    if (!isAdmin(actor) && existing.quotation.userId !== actor.id) {
        return { success: false, error: "Unauthorized access to this quotation" };
    }

    await (prisma as any).quotationItem.delete({ where: { id } });
    return { success: true };
}
