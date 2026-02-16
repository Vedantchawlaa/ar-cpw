import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("❌ CRITICAL ERROR: DATABASE_URL is missing from environment variables!");
}

export const db =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ["query", "error", "warn"],
        datasources: {
            db: {
                url: DATABASE_URL,
            },
        },
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export default db;
