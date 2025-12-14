/*
  Warnings:

  - A unique constraint covering the columns `[qrCode]` on the table `schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `qrCode` to the `schedules` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add column with temporary default value
ALTER TABLE "schedules" ADD COLUMN "qrCode" TEXT;

-- Step 2: Generate QR codes for existing schedules
UPDATE "schedules" 
SET "qrCode" = SUBSTRING(MD5(CONCAT(subject, '-', class, '-', day, '-', "startTime", '-', EXTRACT(EPOCH FROM NOW())::TEXT, '-', id)), 1, 16)
WHERE "qrCode" IS NULL;

-- Step 3: Make column required
ALTER TABLE "schedules" ALTER COLUMN "qrCode" SET NOT NULL;

-- Step 4: Create unique index
CREATE UNIQUE INDEX "schedules_qrCode_key" ON "schedules"("qrCode");
