const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Jadwal data dari gambar
const scheduleData = {
    'MONDAY': [ // Senin
        { time: '08:00', students: ['Amanda', 'Hilda', 'Gibran', 'Rizieq', 'Zulfikar'] },
        { time: '09:00', students: ['Nazwa', 'Reva', 'Rheva', 'Klarisa', 'Fitra'] },
        { time: '10:00', students: ['Aqila', 'Daffi', 'Daffa', 'Putra', 'Irsyad'] },
        { time: '12:30', students: ['Syifani', 'Samia', 'Talita', 'Azizah', 'Nova'] },
        { time: '13:30', students: ['Zarky', 'Raffi4', 'Ayunda', 'Pema', 'Asyila'] },
        { time: '14:30', students: ['Anin', 'Nabila', 'Helmy', 'Alby', 'Rere'] },
        { time: '16:30', students: ['Angel', 'Icen', 'Ashilla', 'Carissa', 'Qonita'] },
        { time: '15:30', students: ['Azka', 'Ifath', 'Rizqia', 'Key', 'Samudra'] }
    ],
    'THURSDAY': [ // Kamis (sama dengan Senin)
        { time: '08:00', students: ['Amanda', 'Hilda', 'Gibran', 'Rizieq', 'Zulfikar'] },
        { time: '09:00', students: ['Nazwa', 'Reva', 'Rheva', 'Klarisa', 'Fitra'] },
        { time: '10:00', students: ['Aqila', 'Daffi', 'Daffa', 'Putra', 'Irsyad'] },
        { time: '12:30', students: ['Syifani', 'Samia', 'Talita', 'Azizah', 'Nova'] },
        { time: '13:30', students: ['Zarky', 'Raffi4', 'Ayunda', 'Pema', 'Asyila'] },
        { time: '14:30', students: ['Anin', 'Nabila', 'Helmy', 'Alby', 'Rere'] },
        { time: '16:30', students: ['Angel', 'Icen', 'Ashilla', 'Carissa', 'Qonita'] },
        { time: '15:30', students: ['Azka', 'Ifath', 'Rizqia', 'Key', 'Samudra'] }
    ],
    'TUESDAY': [ // Selasa
        { time: '08:00', students: ['Azka', 'Sauqi', 'Izyan', 'Bagas', 'Faqih'] },
        { time: '09:00', students: ['Rasya', 'Ubai', 'Adzkia', 'Dinda', 'Clara'] },
        { time: '10:00', students: ['Queen', 'Sabiya', 'Arjuna', 'Adiva'] },
        { time: '12:30', students: ['Satria', 'Rasyad', 'Mahes', 'Rivaldi', 'Barrie'] },
        { time: '13:30', students: ['Zikri', 'Robi', 'Najdan', 'Nizar', 'Reiner'] },
        { time: '16:30', students: ['Valiqa', 'Obit', 'Mey', 'Dila', 'Rubby'] },
        { time: '14:30', students: ['Bintang', 'Wahid', 'Hilmiy', 'Ahza', 'Gilang'] },
        { time: '15:30', students: ['Abid', 'Keanu', 'Athar', 'Arvin', 'Sheina'] }
    ],
    'FRIDAY': [ // Jumat (sama dengan Selasa)
        { time: '08:00', students: ['Azka', 'Sauqi', 'Izyan', 'Bagas', 'Faqih'] },
        { time: '09:00', students: ['Rasya', 'Ubai', 'Adzkia', 'Dinda', 'Clara'] },
        { time: '10:00', students: ['Queen', 'Sabiya', 'Arjuna', 'Adiva'] },
        { time: '12:30', students: ['Satria', 'Rasyad', 'Mahes', 'Rivaldi', 'Barrie'] },
        { time: '13:30', students: ['Zikri', 'Robi', 'Najdan', 'Nizar', 'Reiner'] },
        { time: '16:30', students: ['Valiqa', 'Obit', 'Mey', 'Dila', 'Rubby'] },
        { time: '14:30', students: ['Bintang', 'Wahid', 'Hilmiy', 'Ahza', 'Gilang'] },
        { time: '15:30', students: ['Abid', 'Keanu', 'Athar', 'Arvin', 'Sheina'] }
    ]
};

// Fungsi untuk menghitung endTime (1.5 jam setelah startTime)
function calculateEndTime(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + 1;
    const endMinutes = minutes + 30;
    
    if (endMinutes >= 60) {
        return `${String(endHours + 1).padStart(2, '0')}:${String(endMinutes - 60).padStart(2, '0')}`;
    }
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

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

    // Kumpulkan semua nama siswa unik
    const allStudents = new Set();
    Object.values(scheduleData).forEach(daySchedules => {
        daySchedules.forEach(slot => {
            slot.students.forEach(name => allStudents.add(name));
        });
    });

    console.log(`\n📚 Creating ${allStudents.size} students...`);

    // Buat user dan student untuk setiap siswa
    const studentMap = {};
    const defaultPassword = await bcrypt.hash('student123', 10);
    
    let studentCounter = 1;
    for (const studentName of allStudents) {
        const email = `${studentName.toLowerCase().replace(/\s+/g, '')}@student.com`;
        
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password: defaultPassword,
                name: studentName,
                role: 'STUDENT'
            }
        });

        const student = await prisma.student.upsert({
            where: { userId: user.id },
            update: {},
            create: {
                userId: user.id,
                class: '-'
            }
        });

        studentMap[studentName] = student.id;
        console.log(`   ✓ ${studentName} (${email})`);
        studentCounter++;
    }

    console.log('\n📅 Creating schedules...');

    // Buat jadwal untuk setiap hari dan waktu
    for (const [day, slots] of Object.entries(scheduleData)) {
        console.log(`\n   ${day}:`);
        
        for (const slot of slots) {
            const endTime = calculateEndTime(slot.time);
            const qrCode = uuidv4();
            
            // Buat schedule
            const schedule = await prisma.schedule.create({
                data: {
                    subject: `Kelas ${slot.time}`,
                    class: 'Campuran',
                    day: day,
                    startTime: slot.time,
                    endTime: endTime,
                    teacherName: 'Guru Pengajar',
                    room: 'Ruang Kelas',
                    qrCode: qrCode
                }
            });

            // Hubungkan siswa dengan jadwal
            for (const studentName of slot.students) {
                await prisma.scheduleStudent.create({
                    data: {
                        scheduleId: schedule.id,
                        studentId: studentMap[studentName]
                    }
                });
            }

            console.log(`      ✓ ${slot.time} - ${endTime} (${slot.students.length} siswa)`);
        }
    }

    console.log('\n🎉 Seeding completed!');
    console.log('\n📝 Login credentials:');
    console.log('   Admin: admin@attendance.com / admin123');
    console.log('   Students: [nama]@student.com / student123');
    console.log('   Example: amanda@student.com / student123');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
