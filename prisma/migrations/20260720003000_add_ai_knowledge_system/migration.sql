-- Additive, tenant-scoped knowledge and learning system. Stores summaries only.
CREATE TABLE "KnowledgeSource" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "agentId" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "publisher" TEXT NOT NULL, "url" TEXT NOT NULL, "sourceType" TEXT NOT NULL,
  "freeAccess" BOOLEAN NOT NULL DEFAULT true, "authorityScore" INTEGER NOT NULL DEFAULT 80,
  "active" BOOLEAN NOT NULL DEFAULT true, "lastCheckedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "KnowledgeSource_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KnowledgeSource_shop_agentId_url_key" ON "KnowledgeSource"("shop", "agentId", "url");
CREATE INDEX "KnowledgeSource_shop_agentId_active_idx" ON "KnowledgeSource"("shop", "agentId", "active");

CREATE TABLE "KnowledgeEntry" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "agentId" INTEGER NOT NULL,
  "sourceId" INTEGER NOT NULL, "title" TEXT NOT NULL, "summary" TEXT NOT NULL, "domain" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL, "sourceDate" DATETIME, "confidenceScore" INTEGER NOT NULL,
  "relevanceScore" INTEGER NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "tags" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CURRENT', "uncertainty" TEXT, "verifiedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "KnowledgeEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KnowledgeEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KnowledgeEntry_shop_agentId_title_version_key" ON "KnowledgeEntry"("shop", "agentId", "title", "version");
CREATE INDEX "KnowledgeEntry_shop_agentId_status_idx" ON "KnowledgeEntry"("shop", "agentId", "status");
CREATE INDEX "KnowledgeEntry_shop_verifiedAt_idx" ON "KnowledgeEntry"("shop", "verifiedAt");

CREATE TABLE "KnowledgeReview" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "entryId" INTEGER NOT NULL,
  "credible" BOOLEAN NOT NULL, "current" BOOLEAN NOT NULL, "traceable" BOOLEAN NOT NULL,
  "relevant" BOOLEAN NOT NULL, "nonContradictory" BOOLEAN NOT NULL, "verdict" TEXT NOT NULL,
  "notes" TEXT, "reviewedBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeReview_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "KnowledgeReview_shop_entryId_idx" ON "KnowledgeReview"("shop", "entryId");

CREATE TABLE "LearningCycle" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "agentId" INTEGER NOT NULL,
  "cycleKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PLANNED', "newFindings" INTEGER NOT NULL DEFAULT 0,
  "outdatedFindings" INTEGER NOT NULL DEFAULT 0, "updatedTopics" INTEGER NOT NULL DEFAULT 0,
  "openGaps" INTEGER NOT NULL DEFAULT 0, "nextTopics" TEXT, "summary" TEXT, "startedAt" DATETIME,
  "completedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LearningCycle_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LearningCycle_shop_agentId_cycleKey_key" ON "LearningCycle"("shop", "agentId", "cycleKey");
CREATE INDEX "LearningCycle_shop_status_createdAt_idx" ON "LearningCycle"("shop", "status", "createdAt");

CREATE TABLE "KnowledgeGap" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "agentId" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "KnowledgeGap_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "KnowledgeGap_shop_agentId_status_idx" ON "KnowledgeGap"("shop", "agentId", "status");

CREATE TABLE "CeoKnowledgeReport" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "periodStart" DATETIME NOT NULL,
  "periodEnd" DATETIME NOT NULL, "learnedByAgents" TEXT NOT NULL, "updatedTopics" TEXT NOT NULL,
  "knowledgeGaps" TEXT NOT NULL, "recommendations" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CeoKnowledgeReport_shop_createdAt_idx" ON "CeoKnowledgeReport"("shop", "createdAt");
