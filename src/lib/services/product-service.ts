import prisma from "@/lib/db";
import { inferStockKind } from "@/lib/stock-units";

export async function listProducts() {
    return (prisma as any).product.findMany({
        orderBy: { name: 'asc' }
    });
}

// Updating an existing product only changes its rate (and category when one is given):
// stock counts are changed on the Stock page, so saving a quotation line to the
// catalogue can never reset them.
export async function upsertProduct(name: string, rate: number, stockQuantity: number = 0, category: string = "") {
    await (prisma as any).product.upsert({
        where: { name },
        update: { rate, ...(category ? { category } : {}) },
        create: { name, rate, stockQuantity, category, stockKind: inferStockKind(category, name) }
    });
}

export async function updateProduct(id: string, data: { name: string; rate: number }) {
    await (prisma as any).product.update({
        where: { id },
        data
    });
}

export async function deleteProduct(id: string) {
    await (prisma as any).product.delete({
        where: { id }
    });
}
