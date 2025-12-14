# Student Attendance System

Sistem absensi murid modern dengan fitur QR code, dibangun menggunakan **Svelte**, **Express**, **PostgreSQL**, dan **Tailwind CSS**.

## 🎯 Features

### ✅ Student Management
- CRUD operations untuk data murid
- Auto-generate QR code untuk setiap murid
- Download QR code sebagai gambar
- View student attendance history

### 📱 Attendance Check-in
- **Manual Check-in**: Pilih murid dari dropdown dan klik check-in
- **QR Code Check-in**: Scan QR code murid menggunakan kamera
- Automatic late detection (late jika check-in setelah jam 8 pagi)
- Prevent duplicate check-in dalam satu hari

### 📊 Dashboard & Statistics
- Today's attendance statistics
- Present, late, and absent counts
- Attendance rate percentage
- Real-time attendance list

### 📜 Attendance History
- View all attendance records
- Filter by date and student
- Method indicator (manual vs QR)
- Status badges (present, late, absent)

## 🎨 Design

- **Tailwind CSS** - Utility-first CSS framework
- **Minimalist** - Clean, modern interface
- **Grayscale** - Slate color palette (tidak colorful)
- **Responsive** - Mobile-first design
- **Dark Theme** - Easy on the eyes

## 🛠️ Tech Stack

### Frontend
- **Svelte** - Reactive UI framework
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first CSS
- **qrcode** - QR code generation
- **html5-qrcode** - QR code scanning

### Backend
- **Express** - Web framework
- **Prisma** - ORM untuk PostgreSQL
- **PostgreSQL** - Database

### Deployment
- **Vercel** - Hosting platform

## 📁 Project Structure

```
projek/
├── api/
│   └── index.js              # Express API
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StatsCard.svelte
│   │   │   ├── StudentCard.svelte
│   │   │   ├── QRScanner.svelte
│   │   │   └── AttendanceTable.svelte
│   │   ├── App.svelte        # Main component
│   │   ├── main.js
│   │   └── app.css
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── prisma/
│   └── schema.prisma         # Database schema
├── package.json
└── vercel.json
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- npm atau yarn
- PostgreSQL database

### Installation

1. **Clone repository:**
```bash
git clone <your-repo-url>
cd projek
```

2. **Install dependencies:**
```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

3. **Setup environment variables:**

Create `.env` file:
```env
DATABASE_URL="your_postgresql_connection_string"
```

4. **Generate Prisma Client:**
```bash
npx prisma generate
```

5. **Run database migration:**
```bash
npx prisma migrate dev --name init_attendance
```

### Running Development Server

**Terminal 1 - Backend:**
```bash
npm run dev
```
Server runs on `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`

## 📚 API Endpoints

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `POST /api/students` - Create student (auto-generates QR code)
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Attendance
- `GET /api/attendance` - Get all attendance (with filters)
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance/student/:studentId` - Get student's attendance
- `POST /api/attendance/checkin` - Manual check-in
- `POST /api/attendance/qr-checkin` - QR code check-in

### Statistics
- `GET /api/stats/today` - Today's statistics
- `GET /api/stats/overview` - Overall statistics

## 💾 Database Schema

### Student Model
```prisma
model Student {
  id          String       @id @default(uuid())
  name        String
  studentId   String       @unique
  class       String
  qrCode      String       @unique
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  attendances Attendance[]
}
```

### Attendance Model
```prisma
model Attendance {
  id          String   @id @default(uuid())
  studentId   String
  student     Student  @relation(fields: [studentId], references: [id])
  checkInTime DateTime @default(now())
  method      String   // "manual" or "qr"
  status      String   // "present", "late", "absent"
  notes       String?
}
```

## 🌐 Deploy to Vercel

### Via GitHub (Recommended)

1. Push code ke GitHub
2. Import repository di [vercel.com](https://vercel.com)
3. Add environment variable `DATABASE_URL`
4. Deploy!

### Via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Important:** Set `DATABASE_URL` environment variable di Vercel Dashboard sebelum deploy.

## 📱 Usage Guide

### 1. Add Students
- Go to **Students** tab
- Fill in student name, ID, and class
- Click "Add Student"
- QR code will be auto-generated

### 2. Download QR Codes
- In Students tab, click "⬇️ QR" button on student card
- Or click on QR code to view full size and download
- Print QR codes for students to use

### 3. Manual Check-in
- Go to **Check-in** tab
- Select student from dropdown
- Click "Check In"

### 4. QR Code Check-in
- Go to **Check-in** tab
- Click "Open QR Scanner"
- Allow camera access
- Scan student's QR code
- Automatic check-in!

### 5. View Dashboard
- Go to **Dashboard** tab
- See today's statistics
- View real-time attendance list

### 6. View History
- Go to **History** tab
- See all attendance records
- Filter by date or student

## 🔧 Troubleshooting

### Camera not working for QR scanner
- Ensure HTTPS connection (required for camera access)
- Allow camera permissions in browser
- Use localhost for development

### Database connection error
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Run `npx prisma migrate dev`

### QR code not generating
- Check if `qrcode` package is installed
- Clear browser cache
- Restart dev server

## 📄 License

ISC

## 👨‍💻 Author

Built with ❤️ using Svelte, Express, Tailwind CSS, and PostgreSQL
