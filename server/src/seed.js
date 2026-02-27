import prisma from './lib/prisma.js';
import bcrypt from 'bcryptjs';

async function seed() {
    console.log('🌱 Seeding database...');

    // Check if already seeded
    const existing = await prisma.user.findFirst();
    if (existing) {
        console.log('✅ Database already seeded. Skipping.');
        await prisma.$disconnect();
        return;
    }

    // Create default admin only if APP_INSTALLED is not true
    if (process.env.APP_INSTALLED !== 'true') {
        console.log('ℹ️  Run the setup wizard at http://localhost:3001/setup to create your admin account.');
    }

    console.log('✅ Database ready.');
    await prisma.$disconnect();
}

seed().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
