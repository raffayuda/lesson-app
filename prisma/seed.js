const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Jadwal data dari gambar dengan kelas yang lebih spesifik
const scheduleData = {
    'MONDAY': [ // Senin
        { time: '08:00', class: '2', students: [
            { name: 'Amanda', class: '2' },
            { name: 'Hilda', class: '2' },
            { name: 'Gibran', class: '2' },
            { name: 'Rizieq', class: '2' },
            { name: 'Zulfikar', class: '2' }
        ]},
        { time: '09:00', class: '5', students: [
            { name: 'Nazwa', class: '5' },
            { name: 'Reva', class: '5' },
            { name: 'Rheva', class: '5' },
            { name: 'Klarisa', class: '5' },
            { name: 'Fitra', class: '5' }
        ]},
        { time: '10:00', class: '4', students: [
            { name: 'Aqila', class: '4' },
            { name: 'Daffi', class: '4' },
            { name: 'Daffa', class: '4' },
            { name: 'Putra', class: '4' },
            { name: 'Irsyad', class: '3' } // Kelas berbeda
        ]},
        { time: '12:30', class: '5', students: [
            { name: 'Syifani', class: '5' },
            { name: 'Samia', class: '5' },
            { name: 'Talita', class: '5' },
            { name: 'Azizah', class: '5' },
            { name: 'Nova', class: '5' }
        ]},
        { time: '13:30', class: '5', students: [
            { name: 'Zarky', class: '5' },
            { name: 'Raffi4', class: '5' },
            { name: 'Ayunda', class: '5' },
            { name: 'Pema', class: '5' },
            { name: 'Asyila', class: '5' }
        ]},
        { time: '14:30', class: '5', students: [
            { name: 'Anin', class: '5' },
            { name: 'Nabila', class: '5' },
            { name: 'Helmy', class: '5' },
            { name: 'Alby', class: '5' },
            { name: 'Rere', class: '5' }
        ]},
        { time: '15:30', class: '7', students: [
            { name: 'Angel', class: '7' },
            { name: 'Icen', class: '7' },
            { name: 'Ashilla', class: '7' },
            { name: 'Carissa', class: '7' },
            { name: 'Qonita', class: '7' }
        ]},
        { time: '16:30', class: '6', students: [
            { name: 'Azka', class: '6' },
            { name: 'Ifath', class: '6' },
            { name: 'Rizqia', class: '6' },
            { name: 'Key', class: '6' },
            { name: 'Samudra', class: '6' }
        ]}
    ],
    'THURSDAY': [ // Kamis (sama dengan Senin)
        { time: '08:00', class: '2', students: [
            { name: 'Amanda', class: '2' },
            { name: 'Hilda', class: '2' },
            { name: 'Gibran', class: '2' },
            { name: 'Rizieq', class: '2' },
            { name: 'Zulfikar', class: '2' }
        ]},
        { time: '09:00', class: '5', students: [
            { name: 'Nazwa', class: '5' },
            { name: 'Reva', class: '5' },
            { name: 'Rheva', class: '5' },
            { name: 'Klarisa', class: '5' },
            { name: 'Fitra', class: '5' }
        ]},
        { time: '10:00', class: '4', students: [
            { name: 'Aqila', class: '4' },
            { name: 'Daffi', class: '4' },
            { name: 'Daffa', class: '4' },
            { name: 'Putra', class: '4' },
            { name: 'Irsyad', class: '3' }
        ]},
        { time: '12:30', class: '5', students: [
            { name: 'Syifani', class: '5' },
            { name: 'Samia', class: '5' },
            { name: 'Talita', class: '5' },
            { name: 'Azizah', class: '5' },
            { name: 'Nova', class: '5' }
        ]},
        { time: '13:30', class: '5', students: [
            { name: 'Zarky', class: '5' },
            { name: 'Raffi4', class: '5' },
            { name: 'Ayunda', class: '5' },
            { name: 'Pema', class: '5' },
            { name: 'Asyila', class: '5' }
        ]},
        { time: '14:30', class: '5', students: [
            { name: 'Anin', class: '5' },
            { name: 'Nabila', class: '5' },
            { name: 'Helmy', class: '5' },
            { name: 'Alby', class: '5' },
            { name: 'Rere', class: '5' }
        ]},
        { time: '15:30', class: '7', students: [
            { name: 'Angel', class: '7' },
            { name: 'Icen', class: '7' },
            { name: 'Ashilla', class: '7' },
            { name: 'Carissa', class: '7' },
            { name: 'Qonita', class: '7' }
        ]},
        { time: '16:30', class: '6', students: [
            { name: 'Azka', class: '6' },
            { name: 'Ifath', class: '6' },
            { name: 'Rizqia', class: '6' },
            { name: 'Key', class: '6' },
            { name: 'Samudra', class: '6' }
        ]}
    ],
    'TUESDAY': [ // Selasa
        { time: '08:00', class: '5', students: [
            { name: 'Azka', class: '5' },
            { name: 'Sauqi', class: '5' },
            { name: 'Izyan', class: '5' },
            { name: 'Bagas', class: '5' },
            { name: 'Faqih', class: '4' } // Kelas berbeda
        ]},
        { time: '09:00', class: '4', students: [
            { name: 'Rasya', class: '4' },
            { name: 'Ubai', class: '4' },
            { name: 'Adzkia', class: '4' },
            { name: 'Dinda', class: '4' },
            { name: 'Clara', class: '4' }
        ]},
        { time: '10:00', class: '2', students: [
            { name: 'Queen', class: '2' },
            { name: 'Sabiya', class: '2' },
            { name: 'Arjuna', class: '2' },
            { name: 'Mahes', class: '2' }
        ]},
        { time: '12:30', class: '6', students: [
            { name: 'Satria', class: '6' },
            { name: 'Rasyad', class: '6' },
            { name: 'Mahes', class: '6' },
            { name: 'Rivaldi', class: '6' },
            { name: 'Barrie', class: '6' }
        ]},
        { time: '13:30', class: '6', students: [
            { name: 'Zikri', class: '6' },
            { name: 'Robi', class: '6' },
            { name: 'Najdan', class: '6' },
            { name: 'Nizar', class: '6' },
            { name: 'Reiner', class: '6' }
        ]},
        { time: '14:30', class: '8', students: [
            { name: 'Valiqa', class: '8' },
            { name: 'Obit', class: '8' },
            { name: 'Mey', class: '8' },
            { name: 'Dila', class: '8' },
            { name: 'Rubby', class: '8' }
        ]},
        { time: '15:30', class: '9', students: [
            { name: 'Bintang', class: '9' },
            { name: 'Wahid', class: '9' },
            { name: 'Hilmiy', class: '9' },
            { name: 'Ahza', class: '9' },
            { name: 'Gilang', class: '9' }
        ]},
        { time: '15:30', class: '4', students: [
            { name: 'Abid', class: '4' },
            { name: 'Keanu', class: '4' },
            { name: 'Athar', class: '4' },
            { name: 'Arvin', class: '4' },
            { name: 'Sheina', class: '4' }
        ]}
    ],
    'FRIDAY': [ // Jumat (sama dengan Selasa)
        { time: '08:00', class: '5', students: [
            { name: 'Azka', class: '5' },
            { name: 'Sauqi', class: '5' },
            { name: 'Izyan', class: '5' },
            { name: 'Bagas', class: '5' },
            { name: 'Faqih', class: '4' }
        ]},
        { time: '09:00', class: '4', students: [
            { name: 'Rasya', class: '4' },
            { name: 'Ubai', class: '4' },
            { name: 'Adzkia', class: '4' },
            { name: 'Dinda', class: '4' },
            { name: 'Clara', class: '4' }
        ]},
        { time: '10:00', class: '2', students: [
            { name: 'Queen', class: '2' },
            { name: 'Sabiya', class: '2' },
            { name: 'Arjuna', class: '2' },
            { name: 'Mahes', class: '2' }
        ]},
        { time: '12:30', class: '6', students: [
            { name: 'Satria', class: '6' },
            { name: 'Rasyad', class: '6' },
            { name: 'Mahes', class: '6' },
            { name: 'Rivaldi', class: '6' },
            { name: 'Barrie', class: '6' }
        ]},
        { time: '13:30', class: '6', students: [
            { name: 'Zikri', class: '6' },
            { name: 'Robi', class: '6' },
            { name: 'Najdan', class: '6' },
            { name: 'Nizar', class: '6' },
            { name: 'Reiner', class: '6' }
        ]},
        { time: '14:30', class: '8', students: [
            { name: 'Valiqa', class: '8' },
            { name: 'Obit', class: '8' },
            { name: 'Mey', class: '8' },
            { name: 'Dila', class: '8' },
            { name: 'Rubby', class: '8' }
        ]},
        { time: '15:30', class: '9', students: [
            { name: 'Bintang', class: '9' },
            { name: 'Wahid', class: '9' },
            { name: 'Hilmiy', class: '9' },
            { name: 'Ahza', class: '9' },
            { name: 'Gilang', class: '9' }
        ]},
        { time: '15:30', class: '4', students: [
            { name: 'Abid', class: '4' },
            { name: 'Keanu', class: '4' },
            { name: 'Athar', class: '4' },
            { name: 'Arvin', class: '4' },
            { name: 'Sheina', class: '4' }
        ]}
    ]
};

// Fungsi untuk menghitung endTime (1 jam setelah startTime)
function calculateEndTime(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + 1;
    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

    // Kumpulkan semua nama siswa unik dengan kelasnya
    const allStudentsMap = new Map(); // name -> class
    Object.values(scheduleData).forEach(daySchedules => {
        daySchedules.forEach(slot => {
            slot.students.forEach(student => {
                // Gunakan kelas dari student, bukan dari slot
                allStudentsMap.set(student.name, student.class);
            });
        });
    });

    console.log(`\n📚 Creating ${allStudentsMap.size} students...`);

    // Buat user dan student untuk setiap siswa
    const studentMap = {}; // name -> student record
    const defaultPassword = await bcrypt.hash('student123', 10);
    
    for (const [studentName, studentClass] of allStudentsMap.entries()) {
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
                class: studentClass
            }
        });

        studentMap[studentName] = student;
        console.log(`   ✓ ${studentName} (${email}) - Kelas ${studentClass}`);
    }

    console.log('\n📅 Creating schedules...');

    // Buat jadwal untuk setiap hari dan waktu
    for (const [day, slots] of Object.entries(scheduleData)) {
        console.log(`\n   ${day}:`);
        
        for (const slot of slots) {
            const endTime = calculateEndTime(slot.time);
            const qrCode = uuidv4();
            
            // Buat schedule dengan kelas dari slot
            const schedule = await prisma.schedule.create({
                data: {
                    subject: `Kelas ${slot.class}`,
                    class: slot.class,
                    day: day,
                    startTime: slot.time,
                    endTime: endTime,
                    teacherName: 'Guru Pengajar',
                    room: 'Ruang Kelas',
                    qrCode: qrCode
                }
            });

            // Hubungkan siswa dengan jadwal
            for (const studentInfo of slot.students) {
                const student = studentMap[studentInfo.name];
                if (student) {
                    await prisma.scheduleStudent.create({
                        data: {
                            scheduleId: schedule.id,
                            studentId: student.id
                        }
                    });
                }
            }

            console.log(`      ✓ ${slot.time} - ${endTime} | Kelas ${slot.class} (${slot.students.length} siswa)`);
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
