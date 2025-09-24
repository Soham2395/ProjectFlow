-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "aiSuggestedAssigneeId" TEXT,
ADD COLUMN     "allocationConfidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workloadScore" DOUBLE PRECISION DEFAULT 0;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_aiSuggestedAssigneeId_fkey" FOREIGN KEY ("aiSuggestedAssigneeId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
