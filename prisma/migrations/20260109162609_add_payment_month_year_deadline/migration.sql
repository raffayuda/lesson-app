/*
  Warnings:

  - You are about to drop the `bill_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `monthly_bills` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `student_monthly_fees` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bill_payments" DROP CONSTRAINT "bill_payments_billId_fkey";

-- DropForeignKey
ALTER TABLE "bill_payments" DROP CONSTRAINT "bill_payments_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "monthly_bills" DROP CONSTRAINT "monthly_bills_studentId_fkey";

-- DropForeignKey
ALTER TABLE "student_monthly_fees" DROP CONSTRAINT "student_monthly_fees_studentId_fkey";

-- DropTable
DROP TABLE "bill_payments";

-- DropTable
DROP TABLE "monthly_bills";

-- DropTable
DROP TABLE "student_monthly_fees";
