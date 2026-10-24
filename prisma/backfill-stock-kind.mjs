// One-off, after `npx prisma db push` adds Product.stockKind:
//   node --experimental-strip-types prisma/backfill-stock-kind.mjs          (dry run - prints the plan)
//   node --experimental-strip-types prisma/backfill-stock-kind.mjs --apply  (writes it)
// Sets each product's stock type from its category/name. Products whose type
// was already changed by hand (anything other than the ACCESSORY default) are left alone.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { inferStockKind } from "../src/lib/stock-units.ts";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

try {
    const products = await prisma.product.findMany({ select: { id: true, name: true, category: true, stockKind: true }, orderBy: { name: "asc" } });
    const changes = products
        .filter(p => p.stockKind === "ACCESSORY")
        .map(p => ({ ...p, next: inferStockKind(p.category, p.name) }))
        .filter(p => p.next !== p.stockKind);

    for (const p of changes) console.log(`${p.next.padEnd(9)} ${p.name}${p.category ? `  (${p.category})` : ""}`);
    console.log(`\n${changes.length} of ${products.length} products ${apply ? "updated" : "would change - run with --apply to write"}.`);

    if (apply) {
        for (const p of changes) await prisma.product.update({ where: { id: p.id }, data: { stockKind: p.next } });
    }
} finally {
    await prisma.$disconnect();
}
