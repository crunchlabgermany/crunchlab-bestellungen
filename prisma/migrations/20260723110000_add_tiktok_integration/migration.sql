ALTER TABLE "SocialPost" ADD COLUMN "hashtags" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "mediaStorageKey" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "tiktokLogId" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "uploadProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialPost" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialPost" ADD COLUMN "nextRetryAt" DATETIME;
ALTER TABLE "SocialPost" ADD COLUMN "lastStatusCheckedAt" DATETIME;

CREATE TABLE "TikTokConnection" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "shop" TEXT NOT NULL,
  "openId" TEXT NOT NULL,
  "username" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "accessTokenExpiresAt" DATETIME NOT NULL,
  "refreshTokenExpiresAt" DATETIME NOT NULL,
  "scopes" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "lastTokenRefreshAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TikTokConnection_shop_key" ON "TikTokConnection"("shop");
CREATE INDEX "TikTokConnection_shop_status_idx" ON "TikTokConnection"("shop", "status");

CREATE TABLE "TikTokOAuthState" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "shop" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TikTokOAuthState_stateHash_key" ON "TikTokOAuthState"("stateHash");
CREATE INDEX "TikTokOAuthState_shop_expiresAt_idx" ON "TikTokOAuthState"("shop", "expiresAt");
