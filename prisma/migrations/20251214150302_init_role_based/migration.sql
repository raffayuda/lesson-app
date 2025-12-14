/*
  Warnings:

  - The `method` column on the `attendances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `attendances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `name` on the `students` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `students` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `scheduleId` to the `attendances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `attendances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'SICK', 'PERMISSION', 'ABSENT');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR');

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "markedById" TEXT,
ADD COLUMN     "scheduleId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "method",
ADD COLUMN     "method" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
DROP COLUMN "status",
ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT';

-- AlterTable
ALTER TABLE "students" DROP COLUMN "name",
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "attendances_scheduleId_idx" ON "attendances"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
