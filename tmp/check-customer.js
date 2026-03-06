const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'customer@example.com' }
    });
    console.log('USER_START');
    console.log(JSON.stringify(user, null, 2));
    console.log('USER_END');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
