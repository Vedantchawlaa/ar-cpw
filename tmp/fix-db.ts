import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany();
  for (const tx of txs) {
    if (!tx.description) continue;
    
    let name = tx.description;
    name = name.replace(/(?:your\s+)?a\/?c(?:count)?\s*\**5953\s*(?:by|to|from)?\s*(?:VPA\s+)?/gi, "")
               .replace(/^\s*(to|from|by)\s+/i, "")
               .trim();

    name = name.replace(/\s+on\s+\d{1,2}$/i, "");

    if (!name) name = "Bank Transaction";

    if (name !== tx.description) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { description: name }
      });
      console.log(`Updated: "${tx.description}" -> "${name}"`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
