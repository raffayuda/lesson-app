/*
  Warnings:

  - You are about to drop the column `checkInTime` on the `attendances` table. All the data in the column will be lost.
  - You are about to drop the column `markedById` on the `attendances` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `attendances` table. All the data in the column will be lost.
  - You are about to drop the column `class` on the `materials` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `materials` table. All the data in the column will be lost.
  - You are about to drop the column `proofImage` on the `payments` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `createdAt` on the `schedule_students` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,scheduleId]` on the table `schedule_students` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sectionId` to the `materials` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_markedById_fkey";

-- DropIndex
DROP INDEX "attendances_checkInTime_idx";

-- DropIndex
DROP INDEX "materials_class_idx";

-- DropIndex
DROP INDEX "materials_subject_idx";

-- DropIndex
DROP INDEX "payments_paymentDate_idx";

-- DropIndex
DROP INDEX "payments_status_idx";

-- DropIndex
DROP INDEX "schedule_students_scheduleId_studentId_key";

-- AlterTable
ALTER TABLE "attendances" DROP COLUMN "checkInTime",
DROP COLUMN "markedById",
DROP COLUMN "notes",
ADD COLUMN     "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "markedBy" TEXT,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "materials" DROP COLUMN "class",
DROP COLUMN "subject",
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "sectionId" TEXT NOT NULL,
ALTER COLUMN "fileData" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "proofImage",
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "method" TEXT,
ADD COLUMN     "month" TEXT,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "year" INTEGER,
ALTER COLUMN "amount" SET DATA TYPE INTEGER,
ALTER COLUMN "payerName" DROP NOT NULL,
ALTER COLUMN "paymentDate" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "schedule_students" DROP COLUMN "createdAt",
ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "material_sections" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_sections_scheduleId_idx" ON "material_sections"("scheduleId");

-- CreateIndex
CREATE INDEX "materials_sectionId_idx" ON "materials"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_students_studentId_scheduleId_key" ON "schedule_students"("studentId", "scheduleId");

-- AddForeignKey
ALTER TABLE "material_sections" ADD CONSTRAINT "material_sections_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "material_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_markedBy_fkey" FOREIGN KEY ("markedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
