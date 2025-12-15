/*
  Warnings:

  - You are about to drop the column `qrCode` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `students` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "students_qrCode_key";

-- DropIndex
DROP INDEX "students_studentId_key";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "qrCode",
DROP COLUMN "studentId";
