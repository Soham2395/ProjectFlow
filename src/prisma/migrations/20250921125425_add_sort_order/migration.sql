-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Task_projectId_status_sortOrder_idx" ON "public"."Task"("projectId", "status", "sortOrder");
