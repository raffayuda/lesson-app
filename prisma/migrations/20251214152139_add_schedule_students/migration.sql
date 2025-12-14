-- CreateTable
CREATE TABLE "schedule_students" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_students_scheduleId_studentId_key" ON "schedule_students"("scheduleId", "studentId");

-- AddForeignKey
ALTER TABLE "schedule_students" ADD CONSTRAINT "schedule_students_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_students" ADD CONSTRAINT "schedule_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
