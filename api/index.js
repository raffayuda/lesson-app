require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const TelegramBot = require('node-telegram-bot-api');
const compression = require('compression');
const NodeCache = require('node-cache');

const app = express();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['error', 'warn']
});

// Cache setup (TTL: 5 minutes for static data)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Telegram Bot Setup
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
let bot = null;

console.log('🔍 Telegram Config:', {
  hasToken: !!TELEGRAM_BOT_TOKEN,
  hasChatId: !!TELEGRAM_CHAT_ID,
  chatId: TELEGRAM_CHAT_ID
});

if (TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('📱 Telegram bot initialized with polling');

  // Handle /start command to get chat ID
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const message = `✅ Bot is active!\n\n📋 Your Chat ID: \`${chatId}\`\n\nAdd this to your .env file:\nTELEGRAM_CHAT_ID="${chatId}"`;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log(`📱 Chat ID requested: ${chatId}`);
  });

  // Handle any text message
  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    console.log(`📱 Message from ${chatId}: ${msg.text}`);
  });
} else {
  console.log('⚠️ Telegram bot not initialized - TELEGRAM_BOT_TOKEN not found');
}

// Middleware
app.use(compression()); // Compress all responses
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ==================== MIDDLEWARE ====================

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { student: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Helper function to generate QR code
function generateQRCode(studentId, name) {
  const data = `${studentId}-${name}-${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

// Health check
app.get('/api', (req, res) => {
  res.json({ message: 'Attendance API is running!', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { student: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Don't send password
    const { password: _, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

// Update profile
app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }

      const validPassword = await bcrypt.compare(currentPassword, req.user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: { student: true }
    });

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }

    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Forgot password - Request reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    // In production, send email with reset link
    // For now, just return the token (for testing)
    res.json({
      message: 'Reset token generated',
      resetToken // Remove this in production
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken,
        resetTokenExpiry: { gte: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ==================== SCHEDULES (Admin only) ====================

// Get all schedules
app.get('/api/schedules', authenticate, async (req, res) => {
  try {
    const { day, class: className } = req.query;

    const where = {};
    if (day) where.day = day;
    if (className) where.class = className;

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      include: {
        _count: {
          select: { attendances: true }
        }
      }
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get today's schedules
app.get('/api/schedules/today', authenticate, async (req, res) => {
  try {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const today = days[now.getDay()];
    
    // Get today's date range for specificDate matching
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const schedules = await prisma.schedule.findMany({
      where: {
        OR: [
          // Recurring schedules for today's day
          {
            day: today,
            specificDate: null
          },
          // One-time schedules for today's specific date
          {
            specificDate: {
              gte: todayStart,
              lt: todayEnd
            }
          }
        ]
      },
      orderBy: { startTime: 'asc' },
      include: {
        _count: {
          select: { attendances: true }
        }
      }
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching today\'s schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get schedule by ID
app.get('/api/schedules/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        attendances: {
          include: { student: true },
          orderBy: { checkInTime: 'desc' }
        }
      }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Create schedule
app.post('/api/schedules', authenticate, adminOnly, async (req, res) => {
  try {
    const { subject, class: className, day, startTime, endTime, teacherName, room, studentIds, specificDate } = req.body;

    if (!subject || !day || !startTime || !endTime || !teacherName || !room) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Use provided class or default to subject name
    const scheduleClass = className || subject;

    // Generate QR code for this schedule
    const qrData = `${subject}-${scheduleClass}-${day}-${startTime}-${Date.now()}`;
    const qrCode = crypto.createHash('sha256').update(qrData).digest('hex').substring(0, 16);

    // Create schedule and assign students in transaction
    const result = await prisma.$transaction(async (tx) => {
      const scheduleData = { subject, class: scheduleClass, day, startTime, endTime, teacherName, room, qrCode };
      
      // Add specificDate if provided (for one-time schedules)
      if (specificDate) {
        scheduleData.specificDate = new Date(specificDate);
      }
      
      const schedule = await tx.schedule.create({
        data: scheduleData
      });

      // Assign students if provided
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        await tx.scheduleStudent.createMany({
          data: studentIds.map(studentId => ({
            scheduleId: schedule.id,
            studentId
          })),
          skipDuplicates: true
        });
      }

      return schedule;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
app.put('/api/schedules/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, class: className, day, startTime, endTime, teacherName, room, studentIds, specificDate } = req.body;

    // Use provided class or default to subject name
    const scheduleClass = className || subject;

    const result = await prisma.$transaction(async (tx) => {
      const scheduleData = { subject, class: scheduleClass, day, startTime, endTime, teacherName, room };
      
      // Add specificDate if provided (for one-time schedules), or set to null for recurring
      if (specificDate) {
        scheduleData.specificDate = new Date(specificDate);
      } else {
        scheduleData.specificDate = null;
      }
      
      const schedule = await tx.schedule.update({
        where: { id },
        data: scheduleData
      });

      // Update student assignments if provided
      if (studentIds !== undefined && Array.isArray(studentIds)) {
        // Delete existing assignments
        await tx.scheduleStudent.deleteMany({
          where: { scheduleId: id }
        });

        // Create new assignments
        if (studentIds.length > 0) {
          await tx.scheduleStudent.createMany({
            data: studentIds.map(studentId => ({
              scheduleId: id,
              studentId
            })),
            skipDuplicates: true
          });
        }
      }

      return schedule;
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating schedule:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
app.delete('/api/schedules/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.schedule.delete({ where: { id } });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Assign students to schedule
app.post('/api/schedules/:id/students', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body; // Array of student IDs

    if (!Array.isArray(studentIds)) {
      return res.status(400).json({ error: 'studentIds must be an array' });
    }

    // Delete existing assignments
    await prisma.scheduleStudent.deleteMany({
      where: { scheduleId: id }
    });

    // Create new assignments
    const assignments = await prisma.scheduleStudent.createMany({
      data: studentIds.map(studentId => ({
        scheduleId: id,
        studentId
      })),
      skipDuplicates: true
    });

    res.json({ message: 'Students assigned successfully', count: assignments.count });
  } catch (error) {
    console.error('Error assigning students:', error);
    res.status(500).json({ error: 'Failed to assign students' });
  }
});

// Get students assigned to schedule
app.get('/api/schedules/:id/students', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const scheduleStudents = await prisma.scheduleStudent.findMany({
      where: { scheduleId: id },
      include: {
        student: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    const students = scheduleStudents.map(ss => ss.student);
    res.json(students);
  } catch (error) {
    console.error('Error fetching schedule students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ==================== STUDENTS (Admin only) ====================

// Get all students
app.get('/api/students', authenticate, adminOnly, async (req, res) => {
  try {
    const { class: className } = req.query;
    const cacheKey = `students_${className || 'all'}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return res.json(cached);
    }

    const where = {};
    if (className) where.class = className;

    const students = await prisma.student.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        _count: {
          select: { attendances: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Cache the result
    cache.set(cacheKey, students);
    console.log(`💾 Cached: ${cacheKey}`);

    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student by ID
app.get('/api/students/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        attendances: {
          include: { schedule: true },
          orderBy: { checkInTime: 'desc' },
          take: 20
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student (also creates user account)
app.post('/api/students', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, email, class: className, password } = req.body;

    if (!name || !email || !className) {
      return res.status(400).json({ error: 'Name, email, and class are required' });
    }

    // Generate password if not provided (use email prefix)
    const userPassword = password || `student${email.split('@')[0]}`;
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    // Create user and student in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'STUDENT'
        }
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          class: className
        },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      });

      return student;
    });

    // Invalidate students cache
    cache.del('students_all');
    cache.del(`students_${className}`);
    console.log('🗑️ Cache invalidated: students');

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating student:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email or Student ID already exists' });
    }

    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Update student
app.put('/api/students/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, class: className } = req.body;

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update both user and student in transaction
    const result = await prisma.$transaction(async (tx) => {
      if (name || email) {
        await tx.user.update({
          where: { id: student.userId },
          data: { name, email }
        });
      }

      const updatedStudent = await tx.student.update({
        where: { id },
        data: { class: className },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      });

      return updatedStudent;
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating student:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }

    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
app.delete('/api/students/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({ where: { id } });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Delete user (will cascade delete student)
    await prisma.user.delete({ where: { id: student.userId } });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Get schedules for a student
app.get('/api/students/:id/schedules', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({ where: { id } });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get all schedules where the student is enrolled through ScheduleStudent table
    const scheduleStudents = await prisma.scheduleStudent.findMany({
      where: {
        studentId: id
      },
      include: {
        schedule: true
      },
      orderBy: {
        schedule: {
          startTime: 'asc'
        }
      }
    });

    // Extract schedules from the junction table
    const schedules = scheduleStudents.map(ss => ss.schedule);

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching student schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// ==================== ATTENDANCE ====================

// Get attendance records
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { scheduleId, studentId, date, status } = req.query;

    const where = {};

    if (scheduleId) where.scheduleId = scheduleId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    if (date) {
      // Parse date as local time, not UTC
      // date format: "YYYY-MM-DD"
      const [year, month, day] = date.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

      console.log(`Filtering attendance for date ${date}: ${startDate} to ${endDate}`);

      where.checkInTime = {
        gte: startDate,
        lte: endDate
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        schedule: true,
        markedBy: {
          select: { name: true }
        }
      },
      orderBy: { checkInTime: 'desc' }
    });

    res.json(attendances);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Manual attendance (Admin only)
app.post('/api/attendance/manual', authenticate, adminOnly, async (req, res) => {
  try {
    const { scheduleId, studentId, status, notes, date } = req.body;

    if (!scheduleId || !studentId || !status) {
      return res.status(400).json({ error: 'Schedule ID, Student ID, and status are required' });
    }

    // Fetch schedule to get the startTime
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Use provided date or default to today
    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      targetDate = new Date();
    }
    
    // Extract hour and minute from schedule startTime (format: "HH:MM" or "HH:MM:SS")
    const [hour, minute] = schedule.startTime.split(':').map(Number);
    
    // Create schedule date/time for checking duplicates
    const scheduleDateTime = new Date(targetDate);
    scheduleDateTime.setHours(hour, minute, 0, 0);
    
    // For checking existing attendance, use date range
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    // Use actual current time for checkInTime (when attendance is being marked)
    const actualCheckInTime = new Date();
    
    console.log('Saving attendance for schedule date:', scheduleDateTime.toISOString(), 'actual time:', actualCheckInTime.toISOString(), 'schedule:', schedule.subject);

    // Check if already marked on this date using checkInTime
    const existing = await prisma.attendance.findFirst({
      where: { 
        scheduleId, 
        studentId,
        checkInTime: {
          gte: dayStart,
          lt: dayEnd
        }
      }
    });

    if (existing) {
      // Update existing attendance with actual time
      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: { 
          status, 
          notes, 
          markedById: req.user.id,
          checkInTime: actualCheckInTime, // Use actual current time
          scheduleDate: scheduleDateTime   // Update schedule date/time
        },
        include: {
          student: {
            include: { user: { select: { name: true } } }
          },
          schedule: true
        }
      });

      return res.json(attendance);
    }

    // Create new with actual current time
    const attendance = await prisma.attendance.create({
      data: {
        scheduleId,
        studentId,
        status,
        method: 'MANUAL',
        notes,
        markedById: req.user.id,
        checkInTime: actualCheckInTime, // Use actual current time
        scheduleDate: scheduleDateTime  // Save the schedule date/time
      },
      include: {
        student: {
          include: { user: { select: { name: true } } }
        },
        schedule: true
      }
    });

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Error creating attendance:', error);
    res.status(500).json({ error: 'Failed to create attendance' });
  }
});

// QR attendance (Student)
app.post('/api/attendance/qr', authenticate, async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({ error: 'QR code is required' });
    }

    // Find schedule by QR code
    const schedule = await prisma.schedule.findUnique({
      where: { qrCode }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    // Get student from authenticated user
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Check if student is assigned to this schedule
    const isAssigned = await prisma.scheduleStudent.findFirst({
      where: {
        scheduleId: schedule.id,
        studentId: student.id
      }
    });

    if (!isAssigned) {
      return res.status(403).json({ error: 'You are not enrolled in this schedule' });
    }

    // Determine the target date for attendance (for duplicate checking)
    let targetDate;
    if (schedule.specificDate) {
      // For one-time schedules, use the specific date
      targetDate = new Date(schedule.specificDate);
    } else {
      // For recurring schedules, use today's date
      targetDate = new Date();
    }
    
    // Extract schedule time for reference
    const [hours, minutes] = schedule.startTime.split(':');
    const scheduleDateTime = new Date(targetDate);
    scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Check if already marked for this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.attendance.findFirst({
      where: {
        scheduleId: schedule.id,
        studentId: student.id,
        checkInTime: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'You have already marked attendance for this schedule today' });
    }

    // Use actual current time for checkInTime
    const actualCheckInTime = new Date();

    // Create attendance with actual checkInTime and scheduleDate
    const attendance = await prisma.attendance.create({
      data: {
        scheduleId: schedule.id,
        studentId: student.id,
        status: 'PRESENT',
        method: 'QR',
        checkInTime: actualCheckInTime,
        scheduleDate: scheduleDateTime, // Save the schedule date/time
        markedById: req.user.id
      },
      include: {
        student: {
          include: { user: { select: { name: true } } }
        },
        schedule: true
      }
    });

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Error creating QR attendance:', error);
    res.status(500).json({ error: 'Failed to create attendance' });
  }
});

// Update attendance
app.put('/api/attendance/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const attendance = await prisma.attendance.update({
      where: { id },
      data: { status, notes },
      include: {
        student: {
          include: { user: { select: { name: true } } }
        },
        schedule: true
      }
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error updating attendance:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Attendance not found' });
    }

    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// ==================== STATISTICS (Admin only) ====================

// Today's statistics
app.get('/api/stats/today', authenticate, adminOnly, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalStudents, totalSchedules, todayAttendance, presentCount, sickCount, permissionCount, absentCount] = await Promise.all([
      prisma.student.count(),
      prisma.schedule.count(),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today, lt: tomorrow }
        }
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today, lt: tomorrow },
          status: 'PRESENT'
        }
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today, lt: tomorrow },
          status: 'SICK'
        }
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today, lt: tomorrow },
          status: 'PERMISSION'
        }
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today, lt: tomorrow },
          status: 'ABSENT'
        }
      })
    ]);

    res.json({
      totalStudents,
      totalSchedules,
      todayAttendance,
      presentCount,
      sickCount,
      permissionCount,
      absentCount
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ==================== PAYMENT ROUTES ====================

// Get payments (Admin: all, Student: own only)
app.get('/api/payments', authenticate, async (req, res) => {
  try {
    const { status, studentId, startDate, endDate, page = 1, limit = 20 } = req.query;

    let where = {};

    // If student, only show their own payments
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id }
      });
      if (!student) {
        return res.status(404).json({ error: 'Student profile not found' });
      }
      where.studentId = student.id;
    } else if (studentId) {
      // Admin can filter by student
      where.studentId = studentId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    // Get total count for pagination
    const total = await prisma.payment.count({ where });

    // Fetch payments with pagination and WITHOUT proofImage (lazy load)
    const payments = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        payerName: true,
        paymentDate: true,
        description: true,
        // proofImage: false, // Exclude for performance
        status: true,
        approvedBy: true,
        approvedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: {
            id: true,
            class: true,
            user: {
              select: { name: true, email: true }
            }
          }
        },
        approver: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment proof image (lazy load)
app.get('/api/payments/:id/proof', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        proofImage: true,
        studentId: true
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check authorization
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id }
      });
      if (student.id !== payment.studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    res.json({ proofImage: payment.proofImage });
  } catch (error) {
    console.error('Get proof image error:', error);
    res.status(500).json({ error: 'Failed to fetch proof image' });
  }
});

// Create payment (Student only)
app.post('/api/payments', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only students can submit payments' });
    }

    const { amount, payerName, paymentDate, description, proofImage } = req.body;

    if (!amount || !payerName || !paymentDate || !description || !proofImage) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Get student
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: parseFloat(amount),
        payerName,
        paymentDate: new Date(paymentDate),
        description,
        proofImage, // Base64 string
        status: 'PENDING'
      },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        }
      }
    });

    // Send Telegram notification
    if (bot && TELEGRAM_CHAT_ID) {
      try {
        const message = `
🔔 *New Payment Submission*

👤 *Student:* ${payment.student.user.name}
🆔 *Student ID:* ${payment.student.studentId}
💰 *Amount:* Rp ${payment.amount.toLocaleString('id-ID')}
👨‍💼 *Payer:* ${payment.payerName}
📅 *Date:* ${new Date(payment.paymentDate).toLocaleDateString('id-ID')}
📝 *Description:* ${payment.description}
⏰ *Submitted:* ${new Date().toLocaleString('id-ID')}

Status: ⏳ *PENDING APPROVAL*
        `.trim();

        await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log('✅ Telegram notification sent');
      } catch (telegramError) {
        console.error('❌ Telegram notification failed:', telegramError.message);
        // Don't fail the payment if notification fails
      }
    }

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Approve payment (Admin only)
app.put('/api/payments/:id/approve', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Payment is not pending' });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectionReason: null
      },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        approver: {
          select: { name: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// Reject payment (Admin only)
app.put('/api/payments/:id/reject', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Payment is not pending' });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectionReason: reason
      },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        approver: {
          select: { name: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// Delete payment (Admin only)
app.delete('/api/payments/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.payment.delete({
      where: { id }
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// ==================== SERVER STARTUP ====================

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📱 Network access: http://10.166.243.254:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
