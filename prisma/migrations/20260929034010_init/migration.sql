-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "eventTicker" TEXT,
    "seriesTicker" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL,
    "yesSubTitle" TEXT,
    "noSubTitle" TEXT,
    "rulesPrimary" TEXT,
    "rulesSecondary" TEXT,
    "openTime" DATETIME,
    "closeTime" DATETIME,
    "expirationTime" DATETIME,
    "settlementValue" INTEGER,
    "settlementSource" TEXT,
    "lastYesBidCents" INTEGER,
    "lastYesAskCents" INTEGER,
    "lastNoBidCents" INTEGER,
    "lastNoAskCents" INTEGER,
    "lastPriceCents" INTEGER,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "volume24h" INTEGER NOT NULL DEFAULT 0,
    "openInterest" INTEGER NOT NULL DEFAULT 0,
    "liquidityCents" INTEGER NOT NULL DEFAULT 0,
    "providerMeta" JSONB,
    "lastFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "yesBidCents" INTEGER,
    "yesAskCents" INTEGER,
    "noBidCents" INTEGER,
    "noAskCents" INTEGER,
    "lastPriceCents" INTEGER,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "openInterest" INTEGER NOT NULL DEFAULT 0,
    "liquidityCents" INTEGER NOT NULL DEFAULT 0,
    "spreadCents" INTEGER,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "probability" REAL,
    "confidence" REAL,
    "marketProbability" REAL,
    "diffPoints" REAL,
    "opportunityScore" REAL,
    "spreadCents" INTEGER,
    "liquidityCents" INTEGER,
    "explanation" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelEstimate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "contribution" REAL,
    "timestamp" DATETIME NOT NULL,
    "freshnessSec" INTEGER,
    "metadata" JSONB,
    CONSTRAINT "ModelInput_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "ModelEstimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPriceCents" INTEGER NOT NULL,
    "contracts" INTEGER NOT NULL,
    "bankrollAtEntryCents" INTEGER,
    "notes" TEXT,
    "estimateId" TEXT,
    "modelProbability" REAL,
    "marketProbability" REAL,
    "confidence" REAL,
    "opportunityScore" REAL,
    "modelId" TEXT,
    "modelVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedValueCents" INTEGER,
    "pnlCents" INTEGER,
    "roi" REAL,
    "correct" BOOLEAN,
    "closingPriceCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "PaperTrade_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaperTrade_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "ModelEstimate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "settlementValue" INTEGER,
    "closingPriceCents" INTEGER,
    "resolvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    CONSTRAINT "Resolution_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "addedYesPriceCents" INTEGER,
    "addedModelProbability" REAL,
    "addedMarketProbability" REAL,
    "addedOpportunityScore" REAL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "WatchlistItem_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT,
    "ruleId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ModelPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "category" TEXT,
    "bucket" TEXT,
    "predictionsCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "brierSum" REAL NOT NULL DEFAULT 0,
    "logLossSum" REAL NOT NULL DEFAULT 0,
    "avgDiff" REAL,
    "avgClosingMove" REAL,
    "paperPnlCents" INTEGER NOT NULL DEFAULT 0,
    "computedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DataSourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "metadata" JSONB
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_ticker_key" ON "Market"("ticker");

-- CreateIndex
CREATE INDEX "Market_category_idx" ON "Market"("category");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_closeTime_idx" ON "Market"("closeTime");

-- CreateIndex
CREATE INDEX "MarketSnapshot_marketId_capturedAt_idx" ON "MarketSnapshot"("marketId", "capturedAt");

-- CreateIndex
CREATE INDEX "ModelEstimate_marketId_createdAt_idx" ON "ModelEstimate"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "ModelEstimate_modelId_modelVersion_idx" ON "ModelEstimate"("modelId", "modelVersion");

-- CreateIndex
CREATE INDEX "ModelEstimate_opportunityScore_idx" ON "ModelEstimate"("opportunityScore");

-- CreateIndex
CREATE INDEX "ModelInput_estimateId_idx" ON "ModelInput"("estimateId");

-- CreateIndex
CREATE INDEX "PaperTrade_status_idx" ON "PaperTrade"("status");

-- CreateIndex
CREATE INDEX "PaperTrade_marketId_idx" ON "PaperTrade"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Resolution_marketId_key" ON "Resolution"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_marketId_key" ON "WatchlistItem"("marketId");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_readAt_idx" ON "Alert"("readAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPerformance_modelId_modelVersion_category_bucket_key" ON "ModelPerformance"("modelId", "modelVersion", "category", "bucket");

-- CreateIndex
CREATE INDEX "DataSourceRecord_source_idx" ON "DataSourceRecord"("source");

-- CreateIndex
CREATE UNIQUE INDEX "DataSourceRecord_source_key_key" ON "DataSourceRecord"("source", "key");
