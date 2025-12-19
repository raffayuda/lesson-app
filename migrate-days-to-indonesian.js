const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const dayMapping = {
  'Monday': 'Senin',
  'Tuesday': 'Selasa',
  'Wednesday': 'Rabu',
  'Thursday': 'Kamis',
  'Friday': 'Jumat',
  'Saturday': 'Sabtu',
  'Sunday': 'Minggu'
};

async function migrateDays() {
  try {
    console.log('🔄 Migrating day names to Indonesian...');
    
    const schedules = await prisma.schedule.findMany();
    console.log(`📋 Found ${schedules.length} schedules to update`);
    
    let updated = 0;
    for (const schedule of schedules) {
      if (dayMapping[schedule.day]) {
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { day: dayMapping[schedule.day] }
        });
        console.log(`✅ Updated: ${schedule.subject} from ${schedule.day} to ${dayMapping[schedule.day]}`);
        updated++;
      }
    }
    
    console.log(`\n✨ Migration complete! Updated ${updated} schedules.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateDays();
