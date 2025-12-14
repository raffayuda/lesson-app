# 🚀 Panduan Deploy ke Vercel

## Persiapan

Pastikan aplikasi sudah berjalan dengan baik di local sebelum deploy.

## Step-by-Step Deployment

### 1️⃣ Install Vercel CLI

Buka terminal dan jalankan:

```bash
npm install -g vercel
```

Tunggu hingga instalasi selesai.

### 2️⃣ Login ke Vercel

```bash
vercel login
```

Anda akan melihat pilihan:
- **GitHub**
- **GitLab**
- **Bitbucket**
- **Email**

Pilih salah satu (disarankan GitHub jika Anda punya akun). Browser akan terbuka untuk autentikasi.

### 3️⃣ Deploy Pertama Kali

Dari direktori project (`e:\mycode\projek`), jalankan:

```bash
vercel
```

Vercel akan menanyakan beberapa pertanyaan:

**Q: Set up and deploy "~/projek"?**
```
A: Y (Yes)
```

**Q: Which scope do you want to deploy to?**
```
A: Pilih username/organization Anda (tekan Enter)
```

**Q: Link to existing project?**
```
A: N (No)
```

**Q: What's your project's name?**
```
A: svelte-express-app (atau nama lain yang Anda inginkan)
```

**Q: In which directory is your code located?**
```
A: ./ (tekan Enter)
```

Vercel akan mulai:
- ✓ Inspecting project
- ✓ Uploading files
- ✓ Building project
- ✓ Deploying

Setelah selesai, Anda akan mendapat URL preview seperti:
```
https://svelte-express-app-xxxxx.vercel.app
```

⚠️ **JANGAN buka URL ini dulu!** Aplikasi belum akan berfungsi karena environment variable belum di-set.

### 4️⃣ Set Environment Variable

Ada 2 cara:

#### Cara A: Via Vercel Dashboard (Lebih Mudah) ✅

1. Buka browser ke [vercel.com/dashboard](https://vercel.com/dashboard)
2. Login jika belum
3. Klik project Anda (`svelte-express-app`)
4. Klik tab **Settings** di atas
5. Klik **Environment Variables** di sidebar kiri
6. Klik tombol **Add New**
7. Isi form:
   - **Key**: `DATABASE_URL`
   - **Value**: 
     ```
     postgres://1ba1ca0d80192bf85d7e84f3685fd8ea63ab58416295642387705ca6aab1b4d1:sk_PEQYRW3-kOSaN1EzzIxxt@db.prisma.io:5432/postgres?sslmode=require
     ```
   - **Environments**: Centang semua (Production, Preview, Development)
8. Klik **Save**

#### Cara B: Via CLI

```bash
vercel env add DATABASE_URL production
```

Paste connection string saat diminta:
```
postgres://1ba1ca0d80192bf85d7e84f3685fd8ea63ab58416295642387705ca6aab1b4d1:sk_PEQYRW3-kOSaN1EzzIxxt@db.prisma.io:5432/postgres?sslmode=require
```

Ulangi untuk preview dan development:
```bash
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development
```

### 5️⃣ Deploy ke Production

Setelah environment variable di-set, deploy ke production:

```bash
vercel --prod
```

Vercel akan:
- ✓ Building dengan environment variables
- ✓ Running Prisma migrations
- ✓ Building frontend
- ✓ Deploying to production

Setelah selesai, Anda akan mendapat URL production:
```
https://svelte-express-app.vercel.app
```

### 6️⃣ Test Aplikasi

Buka URL production di browser. Anda seharusnya melihat:
- ✅ UI User Management dengan gradient text
- ✅ Form untuk add user
- ✅ Bisa create, read, update, delete users

## 🔍 Troubleshooting

### Error: "DATABASE_URL is not defined"

**Solusi:**
1. Pastikan environment variable sudah di-set di Vercel Dashboard
2. Redeploy dengan `vercel --prod`

### Error: "Prisma Client not generated"

**Solusi:**
Pastikan `package.json` memiliki script `vercel-build`:
```json
"vercel-build": "prisma generate && prisma migrate deploy && cd frontend && npm install && npm run build"
```

Sudah ada di project Anda ✅

### Error: "Cannot find module '@prisma/client'"

**Solusi:**
1. Buka Vercel Dashboard → Settings → General
2. Scroll ke **Build & Development Settings**
3. Pastikan:
   - **Install Command**: `npm install`
   - **Build Command**: `cd frontend && npm install && npm run build`

### Frontend tidak muncul / 404

**Solusi:**
Pastikan `vercel.json` sudah benar (sudah saya update ✅)

### API tidak berfungsi

**Solusi:**
1. Check Vercel Dashboard → Deployments → Latest → Functions
2. Pastikan `api/index.js` ter-list sebagai serverless function
3. Check logs untuk error messages

## 📊 Monitoring

### View Logs

**Via Dashboard:**
1. Vercel Dashboard → Project → Deployments
2. Klik deployment terbaru
3. Klik tab **Functions**
4. Klik function `api/index.js`
5. Lihat logs real-time

**Via CLI:**
```bash
vercel logs
```

### View Analytics

Vercel Dashboard → Project → Analytics

Anda bisa melihat:
- Page views
- API calls
- Response times
- Error rates

## 🔄 Update Aplikasi

Setelah deployment pertama, untuk update aplikasi:

1. Edit code di local
2. Test di local
3. Deploy ulang:
   ```bash
   vercel --prod
   ```

Vercel akan otomatis:
- Build ulang
- Deploy versi baru
- Zero downtime deployment

## 🌐 Custom Domain (Opsional)

Jika ingin menggunakan domain sendiri:

1. Vercel Dashboard → Project → Settings → Domains
2. Klik **Add**
3. Masukkan domain Anda (contoh: `myapp.com`)
4. Ikuti instruksi untuk update DNS records
5. Tunggu propagasi DNS (5-10 menit)

## ✅ Checklist Deployment

- [ ] Install Vercel CLI
- [ ] Login ke Vercel
- [ ] Deploy pertama kali (`vercel`)
- [ ] Set environment variable `DATABASE_URL`
- [ ] Deploy ke production (`vercel --prod`)
- [ ] Test aplikasi di URL production
- [ ] Verify CRUD operations berfungsi
- [ ] Check logs untuk errors

## 🎉 Selesai!

Aplikasi Anda sekarang live di internet dan bisa diakses dari mana saja!

**URL Production:** `https://[project-name].vercel.app`

Bagikan URL ini ke teman atau client Anda! 🚀
