const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@attendance.com' },
        update: {},
        create: {
            email: 'admin@attendance.com',
            password: hashedPassword,
            name: 'Admin User',
            role: 'ADMIN'
        }
    });

    console.log('✅ Admin user created:', admin.email);
    console.log('   Password: admin123');

    console.log('🎉 Seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
