-- CreateIndex
CREATE INDEX "DataSourceRecord_source_retrievedAt_idx" ON "DataSourceRecord"("source", "retrievedAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_capturedAt_idx" ON "MarketSnapshot"("capturedAt");
