-- Additive Phase-1 schema for the CrunchLab AI team. No external actions are enabled.
CREATE TABLE "AiAgent" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL, "role" TEXT NOT NULL, "description" TEXT NOT NULL, "goals" TEXT NOT NULL,
  "instructions" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AiAgent_shop_slug_key" ON "AiAgent"("shop", "slug");
CREATE INDEX "AiAgent_shop_active_idx" ON "AiAgent"("shop", "active");

CREATE TABLE "AiTask" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "agentId" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "prompt" TEXT NOT NULL, "context" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "priority" INTEGER NOT NULL DEFAULT 0, "requestedBy" TEXT, "scheduledFor" DATETIME, "startedAt" DATETIME,
  "completedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AiTask_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AiTask_shop_agentId_status_idx" ON "AiTask"("shop", "agentId", "status");
CREATE INDEX "AiTask_shop_createdAt_idx" ON "AiTask"("shop", "createdAt");

CREATE TABLE "AiResult" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "taskId" INTEGER NOT NULL,
  "summary" TEXT NOT NULL, "content" TEXT NOT NULL, "structuredData" TEXT, "model" TEXT, "tokenUsage" INTEGER,
  "estimatedCost" DECIMAL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AiResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AiTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AiResult_shop_taskId_status_idx" ON "AiResult"("shop", "taskId", "status");

CREATE TABLE "AiApproval" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "taskId" INTEGER NOT NULL,
  "resultId" INTEGER NOT NULL, "actionType" TEXT NOT NULL DEFAULT 'CONTENT_REVIEW', "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedBy" TEXT, "approvedAt" DATETIME, "rejectionReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AiApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AiTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiApproval_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AiResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiApproval_shop_resultId_actionType_key" ON "AiApproval"("shop", "resultId", "actionType");
CREATE INDEX "AiApproval_shop_status_idx" ON "AiApproval"("shop", "status");

CREATE TABLE "AiActivityLog" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "agentId" INTEGER, "taskId" INTEGER,
  "action" TEXT NOT NULL, "details" TEXT, "success" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiActivityLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AiTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AiActivityLog_shop_createdAt_idx" ON "AiActivityLog"("shop", "createdAt");
CREATE INDEX "AiActivityLog_taskId_idx" ON "AiActivityLog"("taskId");

CREATE TABLE "AiSettings" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "maxTasksPerDay" INTEGER NOT NULL DEFAULT 10, "usageLimitCents" INTEGER NOT NULL DEFAULT 0,
  "loggingEnabled" BOOLEAN NOT NULL DEFAULT true, "autoRunEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AiSettings_shop_key" ON "AiSettings"("shop");
