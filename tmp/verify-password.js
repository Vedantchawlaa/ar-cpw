const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'customer@example.com' }
    });
    if (user) {
        console.log('USER_FOUND');
        console.log('Password hash:', user.password);
        const match = await bcrypt.compare('password123', user.password);
        console.log('Does "password123" match?', match);
    } else {
        console.log('USER_NOT_FOUND');
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
