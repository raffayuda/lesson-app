# 🎯 Konsep Sistem Pembayaran Fleksibel

## 📋 Masalah yang Diselesaikan

1. ✅ Setiap siswa memiliki biaya bulanan yang berbeda (100rb, 120rb, dst)
2. ✅ Siswa bisa nunggak beberapa bulan
3. ✅ Siswa bisa bayar di muka untuk bulan-bulan ke depan
4. ✅ Tracking pembayaran yang akurat per bulan
5. ✅ Sistem tagihan otomatis

---

## 🏗️ Arsitektur Database

### 1. **StudentMonthlyFee** (Biaya Bulanan Per Siswa)
```
- Menyimpan biaya bulanan untuk setiap siswa
- Bisa berubah-ubah dengan startDate dan endDate
- Contoh: Siswa A: 100rb (Jan-Jun), 120rb (Jul-Des)
```

**Fields:**
- `studentId`: ID siswa
- `monthlyFee`: Biaya per bulan (dalam Rupiah)
- `startDate`: Mulai berlaku dari tanggal
- `endDate`: Berakhir di tanggal (null = masih berlaku)
- `note`: Catatan (misal: "Diskon 20%", "Biaya normal")

### 2. **MonthlyBill** (Tagihan Bulanan)
```
- Tagihan yang di-generate setiap bulan
- Track status: UNPAID, PARTIAL, PAID, OVERDUE
- Bisa dipay sebagian atau penuh
```

**Fields:**
- `studentId`: ID siswa
- `month`: Bulan (1-12)
- `year`: Tahun
- `amount`: Jumlah tagihan
- `paidAmount`: Sudah dibayar berapa
- `dueDate`: Tanggal jatuh tempo
- `status`: UNPAID, PARTIAL, PAID, OVERDUE

### 3. **Payment** (Pembayaran)
```
- Data pembayaran yang masuk dari siswa
- Satu pembayaran bisa untuk bayar banyak bulan
```

### 4. **BillPayment** (Link Payment ke Bill)
```
- Junction table untuk hubungkan payment ke bill
- Satu payment bisa bayar banyak bill
- Track alokasi uang ke bill mana saja
```

---

## 🔄 Workflow Sistem

### A. Setup Awal
```
1. Admin set biaya bulanan per siswa di menu "Biaya Siswa"
   - Siswa A: Rp 100.000/bulan
   - Siswa B: Rp 120.000/bulan
   - Siswa C: Rp 150.000/bulan

2. Sistem akan gunakan biaya ini untuk generate tagihan
```

### B. Generate Tagihan Bulanan (Automated/Manual)
```
Setiap awal bulan (atau manual trigger):

1. Sistem cek semua siswa aktif
2. Ambil biaya bulanan dari StudentMonthlyFee
3. Create MonthlyBill untuk bulan berjalan
   - Status: UNPAID
   - Amount: sesuai biaya siswa
   - DueDate: tanggal 10 bulan berjalan (atau custom)

Contoh: Generate tagihan Januari 2026
- Siswa A: Bill Rp 100.000, due 10 Jan 2026
- Siswa B: Bill Rp 120.000, due 10 Jan 2026
```

### C. Siswa Melakukan Pembayaran

#### Scenario 1: Bayar 1 Bulan
```
Siswa A bayar Rp 100.000 untuk Januari

1. Create Payment (amount: 100.000, month: Jan, year: 2026)
2. Admin approve payment
3. Sistem auto-link payment ke MonthlyBill Januari
4. Update MonthlyBill:
   - paidAmount: 100.000
   - status: PAID
```

#### Scenario 2: Bayar Nunggakan 3 Bulan Sekaligus
```
Siswa B nunggak Nov, Des, Jan
Bayar Rp 360.000 (120rb × 3 bulan)

1. Create Payment (amount: 360.000, description: "Bayar Nov, Des, Jan")
2. Admin approve payment
3. Admin allocate payment ke 3 bills:
   - Bill Nov: 120.000
   - Bill Des: 120.000
   - Bill Jan: 120.000
4. Create 3 BillPayment records
5. Update semua MonthlyBill jadi PAID
```

#### Scenario 3: Bayar di Muka untuk 6 Bulan
```
Siswa C bayar Rp 900.000 untuk Jan-Jun 2026

1. Create Payment (amount: 900.000, description: "Bayar 6 bulan")
2. Admin approve payment
3. Admin allocate ke 6 bills (Jan-Jun):
   - Jika bill belum ada, system create dulu
   - Allocate 150.000 ke masing-masing bill
4. Semua 6 bills status jadi PAID
```

#### Scenario 4: Bayar Sebagian
```
Siswa D seharusnya bayar 100rb, tapi cuma bayar 50rb

1. Create Payment (amount: 50.000)
2. Admin approve dan allocate ke Bill Januari
3. Update MonthlyBill Januari:
   - amount: 100.000
   - paidAmount: 50.000
   - status: PARTIAL (masih kurang 50rb)
```

---

## 📊 Fitur-Fitur yang Perlu Dibuat

### 1. **Menu: Biaya Siswa** (Student Fees Management)
**Path:** `/student-fees`

**Fitur:**
- Tabel list semua siswa dengan biaya bulanan mereka
- Set/update biaya per siswa
- History perubahan biaya
- Bulk set biaya untuk satu kelas

**Tampilan:**
```
+----------------------------------------------------------+
| Siswa          | Kelas | Biaya Bulanan | Berlaku Dari  |
+----------------------------------------------------------+
| Almer          | 9     | Rp 100.000    | 1 Jan 2026    |
| Hilma          | 9     | Rp 120.000    | 1 Jan 2026    |
| Naila          | 9     | Rp 100.000    | 1 Jan 2026    |
+----------------------------------------------------------+
[+ Set Biaya] [Bulk Update]
```

### 2. **Menu: Generate Tagihan** (Bills Generation)
**Path:** `/generate-bills`

**Fitur:**
- Generate tagihan untuk bulan tertentu
- Preview sebelum generate
- Re-generate jika ada kesalahan
- Set due date default

**Flow:**
```
1. Pilih bulan & tahun (misal: Februari 2026)
2. Preview: "Akan generate 18 tagihan"
3. Konfirmasi & Generate
4. Success: "18 tagihan berhasil dibuat"
```

### 3. **Menu: Tagihan Siswa** (Monthly Bills)
**Path:** `/bills`

**Fitur:**
- List semua tagihan dengan status
- Filter: bulan, tahun, status, siswa
- Detail tagihan: history pembayaran
- Mark as paid manual jika perlu

**Tampilan:**
```
+--------------------------------------------------------------------+
| Siswa    | Bulan    | Tagihan    | Dibayar   | Sisa     | Status   |
+--------------------------------------------------------------------+
| Almer    | Jan 2026 | 100.000    | 100.000   | 0        | ✅ PAID   |
| Hilma    | Jan 2026 | 120.000    | 60.000    | 60.000   | ⚠️ PARTIAL|
| Naila    | Jan 2026 | 100.000    | 0         | 100.000  | ❌ UNPAID |
+--------------------------------------------------------------------+
```

### 4. **Update Menu: Pembayaran** (Payments)
**Tambahan Fitur:**
- Allocate payment ke bills
- Auto-suggest bills yang unpaid saat approve payment
- Show breakdown alokasi per bill

**Flow Approve Payment:**
```
1. Admin click "Approve" payment 300rb dari Siswa A
2. Modal muncul:
   "Allocate Rp 300.000 ke tagihan mana?"
   
   Tagihan Tersedia:
   ☐ Nov 2025 - Rp 100.000 (UNPAID)
   ☐ Des 2025 - Rp 100.000 (UNPAID)
   ☐ Jan 2026 - Rp 100.000 (UNPAID)
   
   [Select All] [Custom Allocation]
   
3. Admin pilih 3 tagihan
4. System allocate 100rb ke masing-masing
5. Approve & update status bills
```

### 5. **Update Menu: Belum Lunas** (Unpaid Bills)
**Path:** `/unpaid`

**Update:**
- Hitung dari MonthlyBill yang status UNPAID/PARTIAL
- Show detail bulan mana yang belum dibayar
- Total akurat berdasarkan bills

**Tampilan:**
```
+--------------------------------------------------------------------+
| Siswa    | Bulan Nunggak       | Total Tunggakan | Detail       |
+--------------------------------------------------------------------+
| Hilma    | Nov, Des, Jan       | Rp 360.000      | [Lihat]      |
| Naila    | Jan (partial 50rb)  | Rp 50.000       | [Lihat]      |
+--------------------------------------------------------------------+

Detail Modal untuk Hilma:
- November 2025: Rp 120.000 (UNPAID)
- Desember 2025: Rp 120.000 (UNPAID)  
- Januari 2026:  Rp 120.000 (UNPAID)
Total: Rp 360.000
```

---

## 🔧 API Endpoints yang Perlu Dibuat

### Student Fees
```
POST   /api/student-fees           - Set biaya untuk siswa
GET    /api/student-fees/:id       - Get biaya siswa
PUT    /api/student-fees/:id       - Update biaya
GET    /api/student-fees           - List semua biaya
POST   /api/student-fees/bulk      - Bulk set biaya per kelas
```

### Monthly Bills
```
POST   /api/bills/generate         - Generate tagihan bulan tertentu
GET    /api/bills                  - List tagihan (with filters)
GET    /api/bills/:id              - Detail tagihan
PUT    /api/bills/:id              - Update tagihan
GET    /api/bills/student/:id      - Tagihan per siswa
GET    /api/bills/unpaid           - Semua tagihan unpaid/partial
```

### Payment Allocation
```
POST   /api/payments/:id/allocate  - Allocate payment ke bills
GET    /api/payments/:id/bills     - Get bills dari payment ini
```

### Statistics
```
GET    /api/stats/unpaid-summary   - Summary tunggakan per siswa
GET    /api/stats/payment-report   - Report pembayaran per periode
```

---

## 📅 Implementation Timeline

### Phase 1: Core Features (Week 1-2)
- ✅ Database migration
- [ ] API for Student Fees
- [ ] API for Bills Generation
- [ ] API for Payment Allocation
- [ ] Basic UI for Student Fees

### Phase 2: UI Development (Week 3-4)
- [ ] UI Generate Bills
- [ ] UI Monthly Bills List
- [ ] Update Payment Approval UI
- [ ] Update Unpaid Page

### Phase 3: Automation & Polish (Week 5)
- [ ] Auto-generate bills monthly (cron job)
- [ ] Email/Telegram notification
- [ ] Export reports
- [ ] Testing & bug fixes

---

## 💡 Tips & Best Practices

### 1. Generate Bills Strategy
```
Recommended: Generate bills 1 bulan sebelumnya
- Awal Desember: generate bills untuk Januari
- Awal Januari: generate bills untuk Februari
Benefit: Siswa sudah tahu tagihan bulan depan
```

### 2. Due Date Setting
```
Default: Tanggal 10 setiap bulan
- Generate Jan bills: due date 10 Jan
- Generate Feb bills: due date 10 Feb
```

### 3. Auto-Mark Overdue
```
Cron job setiap hari:
- Check bills dengan dueDate sudah lewat
- Status masih UNPAID atau PARTIAL
- Update status jadi OVERDUE
- Send notification
```

### 4. Payment Allocation Priority
```
Saat allocate payment, prioritas:
1. Tagihan paling lama (oldest first)
2. Tagihan PARTIAL (selesaikan dulu yang kurang)
3. Tagihan UNPAID
```

---

## 🎨 UI/UX Improvements

### Dashboard Admin
Tambahkan widget:
```
+---------------------------+
| 📊 Tagihan Bulan Ini     |
| Total: Rp 1.800.000      |
| Terbayar: Rp 1.200.000   |
| Sisa: Rp 600.000 (33%)   |
+---------------------------+

+---------------------------+
| ⚠️ Siswa Nunggak         |
| 5 siswa belum bayar      |
| Total: Rp 500.000        |
| [Lihat Detail]           |
+---------------------------+
```

### Notification
```
Telegram/Email ke siswa:
"Halo Almer,
Tagihan bulan Januari 2026 sebesar Rp 100.000
sudah tersedia. Jatuh tempo: 10 Januari 2026.
Mohon segera melakukan pembayaran."
```

---

## 📝 Migration Guide

### Data Migration dari System Lama
```sql
-- Jika ada data payment lama yang perlu di-migrate:

-- 1. Set default fee untuk semua siswa
INSERT INTO student_monthly_fees (studentId, monthlyFee, startDate)
SELECT id, 100000, '2026-01-01'
FROM students;

-- 2. Generate bills untuk bulan-bulan sebelumnya
-- (dilakukan via API endpoint)

-- 3. Link existing payments ke bills
-- (manual allocation atau bulk script)
```

---

## 🔒 Security Considerations

1. **Role-based Access:**
   - Only ADMIN can set fees
   - Only ADMIN can generate bills
   - Only ADMIN can allocate payments

2. **Validation:**
   - Payment amount tidak boleh negatif
   - Allocated amount tidak boleh > payment amount
   - Tidak boleh allocate ke bill yang sudah PAID penuh

3. **Audit Trail:**
   - Log semua perubahan biaya
   - Log semua payment allocation
   - Track who approved what

---

## 🚀 Future Enhancements

1. **Auto-Payment via Virtual Account**
2. **Payment Reminder via WhatsApp**
3. **Student Portal untuk cek tagihan**
4. **Payment Plan (cicilan)**
5. **Discount Management**
6. **Late Fee / Denda**
7. **Receipt Generation (PDF)**
8. **Integration dengan Bank**

---

Semoga konsep ini membantu! 🎉
