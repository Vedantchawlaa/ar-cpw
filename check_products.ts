import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const products = await (prisma as any).product.findMany()
        console.log('Products in DB:', products)
    } catch (e) {
        console.error('Error fetching products:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
