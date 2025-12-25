require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const TelegramBot = require('node-telegram-bot-api');
const compression = require('compression');
const { PDFDocument } = require('pdf-lib');
const NodeCache = require('node-cache');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['error', 'warn']
});

// Multer configuration for file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Multer configuration for PDF uploads (materials)
const uploadMaterial = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit - force users to compress
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
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
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Username atau password salah' });
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
          orderBy: { date: 'desc' }
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
          orderBy: { date: 'desc' },
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

      // Use scheduleDate if available, fallback to checkInTime
      where.OR = [
        {
          scheduleDate: {
            gte: startDate,
            lte: endDate
          }
        },
        {
          scheduleDate: null,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      ];
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
        marker: {
          select: { name: true }
        }
      },
      orderBy: { date: 'desc' }
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
      // Parse date string as local date to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(year, month - 1, day);
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

    // Check if already marked on this date using scheduleDate or checkInTime
    const existing = await prisma.attendance.findFirst({
      where: {
        scheduleId,
        studentId,
        OR: [
          {
            scheduleDate: {
              gte: dayStart,
              lt: dayEnd
            }
          },
          {
            scheduleDate: null,
            date: {
              gte: dayStart,
              lt: dayEnd
            }
          }
        ]
      }
    });

    if (existing) {
      // Update existing attendance with actual time
      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          notes,
          markedBy: req.user.id,
          date: actualCheckInTime, // Use actual current time
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
        markedBy: req.user.id,
        date: actualCheckInTime, // Use actual current time
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
      // Parse as local date to avoid timezone issues
      const specificDate = new Date(schedule.specificDate);
      targetDate = new Date(specificDate.getFullYear(), specificDate.getMonth(), specificDate.getDate());

      // Check if today matches the specific date
      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (todayDate.getTime() !== targetDate.getTime()) {
        return res.status(400).json({
          error: 'QR code can only be scanned on the scheduled date: ' +
            targetDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        });
      }
    } else {
      // For recurring schedules, validate that today matches the schedule day
      const today = new Date();
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayDayName = dayNames[today.getDay()];

      if (schedule.day !== todayDayName) {
        return res.status(400).json({
          error: `QR code untuk jadwal ${schedule.day} hanya bisa di-scan pada hari ${schedule.day}. Hari ini adalah ${todayDayName}.`
        });
      }

      targetDate = new Date();
    }

    // Extract schedule time for reference
    const [hours, minutes] = schedule.startTime.split(':');
    const scheduleDateTime = new Date(targetDate);
    scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Check if already marked for this date using scheduleDate or checkInTime
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.attendance.findFirst({
      where: {
        scheduleId: schedule.id,
        studentId: student.id,
        OR: [
          {
            scheduleDate: {
              gte: startOfDay,
              lt: endOfDay
            }
          },
          {
            scheduleDate: null,
            date: {
              gte: startOfDay,
              lt: endOfDay
            }
          }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Anda sudah melakukan absensi untuk jadwal ini hari ini' });
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
        date: actualCheckInTime,
        scheduleDate: scheduleDateTime, // Save the schedule date/time
        markedBy: student.userId // Student who scanned the QR code
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
    // Get today's date range in local timezone (Indonesia)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Dashboard stats - Today range:', today, 'to', tomorrow);

    const [totalStudents, totalSchedules, todayAttendance, presentCount, sickCount, permissionCount, absentCount] = await Promise.all([
      prisma.student.count(),
      prisma.schedule.count(),
      prisma.attendance.count({
        where: {
          scheduleDate: { gte: today, lt: tomorrow }
        }
      }),
      prisma.attendance.count({
        where: {
          scheduleDate: { gte: today, lt: tomorrow },
          status: 'PRESENT'
        }
      }),
      prisma.attendance.count({
        where: {
          scheduleDate: { gte: today, lt: tomorrow },
          status: 'SICK'
        }
      }),
      prisma.attendance.count({
        where: {
          scheduleDate: { gte: today, lt: tomorrow },
          status: 'PERMISSION'
        }
      }),
      prisma.attendance.count({
        where: {
          scheduleDate: { gte: today, lt: tomorrow },
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
    const { status, studentId, method, startDate, endDate, page = 1, limit = 20 } = req.query;

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

    if (method) {
      where.method = method;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
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
        method: true,
        proofUrl: true,
        status: true,
        approvedBy: true,
        month: true,
        year: true,
        deadline: true,
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
        proofUrl: true,
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

    res.json({ proofImage: payment.proofUrl });
  } catch (error) {
    console.error('Get proof image error:', error);
    res.status(500).json({ error: 'Failed to fetch proof image' });
  }
});

// Helper function to upload to Cloudinary
async function uploadToCloudinary(fileData, folder, resourceType = 'image') {
  try {
    // For PDFs (raw type), upload buffer directly
    // For images, use base64 string
    const result = await cloudinary.uploader.upload(fileData, {
      folder: folder,
      resource_type: resourceType,
      access_mode: 'public', // Make files publicly accessible
      // For PDFs, specify format
      ...(resourceType === 'raw' && { format: 'pdf' })
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to cloud storage');
  }
}

// Helper function to delete from Cloudinary
async function deleteFromCloudinary(url) {
  try {
    // Extract public_id from URL
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const publicId = parts.slice(-2).join('/').split('.')[0];
    await cloudinary.uploader.destroy(publicId);
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
}

// Helper function to compress PDF
async function compressPDF(buffer) {
  try {
    console.log('📦 Original PDF size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');

    // Load the PDF
    const pdfDoc = await PDFDocument.load(buffer);

    // Save with compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true, // Enable for better compression
      addDefaultPage: false,
      objectsPerTick: 50
    });

    const compressedBuffer = Buffer.from(compressedBytes);
    console.log('✅ Compressed PDF size:', (compressedBuffer.length / 1024 / 1024).toFixed(2), 'MB');
    console.log('💾 Saved:', ((1 - compressedBuffer.length / buffer.length) * 100).toFixed(1), '%');

    return compressedBuffer;
  } catch (error) {
    console.error('PDF compression error:', error);
    // If compression fails, return original
    return buffer;
  }
}

// Create payment (Student only)
app.post('/api/payments', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only students can submit payments' });
    }

    const { amount, payerName, paymentDate, description, method, proofImage } = req.body;

    if (!amount || !proofImage) {
      return res.status(400).json({ error: 'Amount and proof image are required' });
    }

    // Get student
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Upload proof image to Cloudinary
    const proofUrl = await uploadToCloudinary(proofImage, 'payment_proofs');

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: parseFloat(amount),
        payerName,
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        description,
        method, // Save the actual payment method selected
        proofUrl: proofUrl, // Store Cloudinary URL
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

// Create payment by admin (Admin only)
app.post('/api/payments/admin', authenticate, adminOnly, upload.single('paymentProof'), async (req, res) => {
  try {
    const { studentId, amount, description, method } = req.body;

    if (!studentId || !amount || !description) {
      return res.status(400).json({ error: 'Student, amount, and description are required' });
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Upload proof image to Cloudinary if exists
    let proofUrl = null;
    if (req.file) {
      // Convert buffer to base64
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      proofUrl = await uploadToCloudinary(base64Image, 'payment_proofs');
    }

    // Create payment with auto-approval
    const payment = await prisma.payment.create({
      data: {
        student: {
          connect: { id: studentId }
        },
        approver: {
          connect: { id: req.user.id }
        },
        amount: parseFloat(amount),
        payerName: student.user.name, // Use student name as payer
        paymentDate: new Date(), // Use current date
        description,
        method: method || null,
        proofUrl: proofUrl,
        status: 'APPROVED', // Auto-approve admin-created payments
        approvedAt: new Date()
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

    res.status(201).json(payment);
  } catch (error) {
    console.error('Admin create payment error:', error);
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



// ==================== MATERIALS & SECTIONS ====================

// Get sections and materials for a schedule
app.get('/api/schedules/:scheduleId/sections', authenticate, async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const sections = await prisma.materialSection.findMany({
      where: { scheduleId },
      include: {
        materials: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            fileName: true,
            fileSize: true,
            fileUrl: true, // Add Cloudinary URL
            createdAt: true,
            uploadedBy: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(sections);
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// Create new section
app.post('/api/schedules/:scheduleId/sections', authenticate, adminOnly, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const section = await prisma.materialSection.create({
      data: {
        title,
        scheduleId
      }
    });

    res.status(201).json(section);
  } catch (error) {
    console.error('Error creating section:', error);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// Delete material (Admin only)
app.delete('/api/materials/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.material.delete({
      where: { id }
    });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// Download material
app.get('/api/materials/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const material = await prisma.material.findUnique({
      where: { id },
      select: {
        fileName: true,
        fileData: true
      }
    });

    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${material.fileName}"`);
    res.send(material.fileData);
  } catch (error) {
    console.error('Download material error:', error);
    res.status(500).json({ error: 'Failed to download material' });
  }
});


// Get all materials
app.get('/api/materials', authenticate, async (req, res) => {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        class: true,
        subject: true,
        description: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: true,
        uploader: {
          select: { name: true }
        }
      }
    });

    res.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Upload material to section (matches frontend endpoint)
app.post('/api/sections/:sectionId/materials', (req, res, next) => {
  console.log('🔵 POST /api/sections/:sectionId/materials HIT!');
  console.log('Section ID from URL:', req.params.sectionId);
  next();
}, authenticate, uploadMaterial.single('file'), async (req, res) => {
  try {
    const { sectionId } = req.params;

    console.log('📤 Material upload started');
    console.log('Section ID:', sectionId);
    console.log('File received:', req.file ? req.file.originalname : 'NO FILE');

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description } = req.body;
    console.log('Title:', title);
    console.log('Description:', description);

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Store PDF in database (simpler and works immediately)
    console.log('💾 Compressing and saving PDF...');

    // Compress PDF first
    const compressedBuffer = await compressPDF(req.file.buffer);

    const material = await prisma.material.create({
      data: {
        sectionId,
        title,
        description,
        fileName: req.file.originalname,
        fileSize: compressedBuffer.length, // Use compressed size
        fileData: compressedBuffer, // Store compressed PDF
        uploadedBy: req.user.id
      },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: true
      }
    });

    console.log('✅ Material saved successfully:', material.id);
    res.status(201).json(material);
  } catch (error) {
    console.error('❌ Error uploading material:', error);
    res.status(500).json({ error: 'Failed to upload material' });
  }
});

// Upload material (legacy endpoint)
app.post('/api/materials', authenticate, uploadMaterial.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, class: className, subject, description } = req.body;

    if (!title || !className || !subject) {
      return res.status(400).json({ error: 'Title, class, and subject are required' });
    }

    // Convert buffer to base64 for Cloudinary upload
    const base64PDF = `data:application/pdf;base64,${req.file.buffer.toString('base64')}`;

    // Upload PDF to Cloudinary
    const pdfUrl = await uploadToCloudinary(base64PDF, 'materials', 'raw');

    const material = await prisma.material.create({
      data: {
        title,
        class: className,
        subject,
        description,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileUrl: pdfUrl, // Store Cloudinary URL
        uploadedBy: req.user.id
      },
      select: {
        id: true,
        title: true,
        class: true,
        subject: true,
        description: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: true
      }
    });

    res.status(201).json(material);
  } catch (error) {
    console.error('Error uploading material:', error);
    res.status(500).json({ error: 'Failed to upload material' });
  }
});

// Delete material
app.delete('/api/materials/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const material = await prisma.material.findUnique({
      where: { id }
    });

    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    if (material.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this material' });
    }

    // Delete from Cloudinary if fileUrl exists
    if (material.fileUrl) {
      await deleteFromCloudinary(material.fileUrl);
    }

    await prisma.material.delete({
      where: { id }
    });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// Download material
app.get('/api/materials/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const material = await prisma.material.findUnique({
      where: { id }
    });

    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    console.log('📥 Download request for:', material.fileName);
    console.log('File URL:', material.fileUrl);

    // Serve PDF from database
    if (material.fileData) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${material.fileName}"`);
      return res.send(material.fileData);
    } else {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error downloading material:', error);
    res.status(500).json({ error: 'Failed to download material' });
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
