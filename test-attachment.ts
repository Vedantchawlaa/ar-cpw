import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
    try {
        console.log("Testing Prisma attachment creation...");
        const attachment = await prisma.attachment.create({
            data: {
                filename: "test.txt",
                mimeType: "text/plain",
                data: Buffer.from("hello world"),
            },
        });
        console.log("Success! Attachment created:", attachment.id);

        // Cleanup
        await prisma.attachment.delete({ where: { id: attachment.id } });
        console.log("Cleanup complete.");
    } catch (error) {
        console.error("FAILED with error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
