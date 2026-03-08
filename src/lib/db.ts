import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const DATABASE_URL = process.env.DATABASE_URL;

export const db =
    globalForPrisma.prisma ??
    (() => {
        try {
            return new PrismaClient({
                log: ["error", "warn"],
                ...(DATABASE_URL ? {
                    datasources: {
                        db: {
                            url: DATABASE_URL,
                        },
                    },
                } : {}),
            });
        } catch (error) {
            console.error("Prisma Client initialization failed:", error);
            // Fallback to basic client if detailed config fails
            return new PrismaClient();
        }
    })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export default db;
