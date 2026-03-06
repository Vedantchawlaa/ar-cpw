import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            name: true
        }
    });
    console.log('USERS_START');
    console.log(JSON.stringify(users, null, 2));
    console.log('USERS_END');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
