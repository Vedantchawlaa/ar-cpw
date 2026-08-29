const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = "5o1vedant@gmail.com";
    const password = "CPW@501";
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: "admin",
        },
        create: {
            email,
            name: "Vedant Chawla",
            password: hashedPassword,
            role: "admin",
        },
    });

    console.log("SUCCESS");
    console.log(JSON.stringify(user, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
