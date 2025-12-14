# Svelte + Express Application

Aplikasi full-stack sederhana menggunakan **Svelte** untuk frontend dan **Express** untuk backend API, dengan database **PostgreSQL** melalui **Prisma ORM**. Aplikasi ini siap di-deploy ke **Vercel**.

## 🚀 Features

- ✨ Modern UI dengan design system yang indah
- 🎨 Dark mode dengan gradients dan animations
- 📱 Responsive design
- 🔥 CRUD operations lengkap untuk users
- 🚀 Serverless API dengan Express
- 💾 PostgreSQL database dengan Prisma ORM
- ☁️ Deploy-ready untuk Vercel

## 📁 Project Structure

```
projek/
├── api/                  # Express API (Serverless Functions)
│   └── index.js         # API endpoints
├── frontend/            # Svelte Application
│   ├── src/
│   │   ├── App.svelte  # Main component
│   │   ├── main.js     # Entry point
│   │   └── app.css     # Global styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── prisma/
│   └── schema.prisma   # Database schema
├── package.json        # Root dependencies
├── vercel.json         # Vercel configuration
├── .env                # Environment variables (local)
└── .env.example        # Environment template
```

## 🛠️ Setup Local Development

### Prerequisites

- Node.js (v18 atau lebih baru)
- npm atau yarn
- PostgreSQL database (sudah tersedia dari Prisma.io)

### Installation

1. **Install dependencies:**

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

2. **Setup database:**

File `.env` sudah berisi connection string ke database PostgreSQL.

3. **Generate Prisma Client:**

```bash
npm run prisma:generate
```

4. **Run database migration:**

```bash
npm run prisma:migrate
```

Saat diminta nama migration, ketik: `init`

### Running Development Server

**Terminal 1 - Backend API:**

```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000`

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

Buka browser dan akses `http://localhost:5173`

## 🌐 Deploy ke Vercel

### Persiapan

1. **Install Vercel CLI:**

```bash
npm install -g vercel
```

2. **Login ke Vercel:**

```bash
vercel login
```

### Deployment

1. **Deploy pertama kali:**

```bash
vercel
```

Ikuti instruksi di terminal.

2. **Set environment variable:**

Di Vercel Dashboard:
- Buka project settings
- Pergi ke "Environment Variables"
- Tambahkan variable:
  - Name: `DATABASE_URL`
  - Value: `postgres://1ba1ca0d80192bf85d7e84f3685fd8ea63ab58416295642387705ca6aab1b4d1:sk_PEQYRW3-kOSaN1EzzIxxt@db.prisma.io:5432/postgres?sslmode=require`

3. **Deploy ke production:**

```bash
vercel --prod
```

### Environment Variables di Vercel

Pastikan environment variable berikut sudah di-set:

- `DATABASE_URL` - PostgreSQL connection string

## 📚 API Endpoints

### Base URL
- Local: `http://localhost:3000/api`
- Production: `https://your-app.vercel.app/api`

### Endpoints

- `GET /api` - Health check
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com"
  }
  ```
- `PUT /api/users/:id` - Update user
  ```json
  {
    "name": "John Doe Updated",
    "email": "john.updated@example.com"
  }
  ```
- `DELETE /api/users/:id` - Delete user

## 🎨 Tech Stack

### Frontend
- **Svelte** - UI Framework
- **Vite** - Build tool & dev server
- **CSS Custom Properties** - Styling dengan design system

### Backend
- **Express** - Web framework
- **Prisma** - ORM untuk database
- **PostgreSQL** - Database

### Deployment
- **Vercel** - Hosting platform
  - Frontend: Static site
  - Backend: Serverless functions

## 📝 Database Schema

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 🔧 Troubleshooting

### Database Migration Error

Jika ada error saat migration, coba:

```bash
npx prisma migrate reset
npx prisma migrate dev --name init
```

### Port Already in Use

Jika port 3000 atau 5173 sudah digunakan, ubah di:
- Backend: Ganti `PORT` di `api/index.js`
- Frontend: Ganti port di `frontend/vite.config.js`

### CORS Error

Pastikan backend sudah menggunakan `cors` middleware (sudah ter-include).

## 📄 License

ISC

## 👨‍💻 Author

Built with ❤️ using Svelte and Express
