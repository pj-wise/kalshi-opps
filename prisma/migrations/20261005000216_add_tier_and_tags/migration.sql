-- AlterTable
ALTER TABLE "ModelEstimate" ADD COLUMN "tags" TEXT;
ALTER TABLE "ModelEstimate" ADD COLUMN "tier" TEXT;

-- CreateIndex
CREATE INDEX "ModelEstimate_tier_idx" ON "ModelEstimate"("tier");
