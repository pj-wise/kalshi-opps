-- CreateIndex
CREATE INDEX "ModelEstimate_createdAt_diffPoints_tier_idx" ON "ModelEstimate"("createdAt", "diffPoints", "tier");
