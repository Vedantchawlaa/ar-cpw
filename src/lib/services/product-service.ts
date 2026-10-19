import prisma from "@/lib/db";

export async function listProducts() {
    return (prisma as any).product.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function upsertProduct(name: string, rate: number, stockQuantity: number = 0, category: string = "") {
    await (prisma as any).product.upsert({
        where: { name },
        update: { rate, stockQuantity, category },
        create: { name, rate, stockQuantity, category }
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
