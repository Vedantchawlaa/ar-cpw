import db from './src/lib/db'

async function main() {
    try {
        const products = await (db as any).product.findMany()
        console.log('Products in DB:', products)
    } catch (e) {
        console.error('Error fetching products:', e)
    } finally {
        await db.$disconnect()
    }
}

main()
