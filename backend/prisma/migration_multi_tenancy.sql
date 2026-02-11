-- Multi-Tenancy Migration Script
-- Adds siteId to core tables and creates SiteConfiguration + BotConfig

CREATE TABLE IF NOT EXISTS "SiteConfiguration" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#00F0FF',
    "secondaryColor" TEXT NOT NULL DEFAULT '#131B2C',
    "accentColor" TEXT NOT NULL DEFAULT '#00D46E',
    "dangerColor" TEXT NOT NULL DEFAULT '#FF385C',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0A0E17',
    "cardColor" TEXT NOT NULL DEFAULT '#131B2C',
    "heroImageUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "loginBgUrl" TEXT,
    "gameAssets" JSONB,
    "houseEdgeConfig" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "jurisdiction" TEXT,
    "licenseType" TEXT,
    "adminUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteConfiguration_brandName_key" ON "SiteConfiguration"("brandName");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteConfiguration_domain_key" ON "SiteConfiguration"("domain");
CREATE INDEX IF NOT EXISTS "SiteConfiguration_domain_idx" ON "SiteConfiguration"("domain");
CREATE INDEX IF NOT EXISTS "SiteConfiguration_active_idx" ON "SiteConfiguration"("active");

CREATE TABLE IF NOT EXISTS "BotConfig" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "botCount" INTEGER NOT NULL DEFAULT 50,
    "minBetAmount" DECIMAL(18,8) NOT NULL DEFAULT 5,
    "maxBetAmount" DECIMAL(18,8) NOT NULL DEFAULT 1000,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatIntervalMin" INTEGER NOT NULL DEFAULT 5,
    "chatIntervalMax" INTEGER NOT NULL DEFAULT 15,
    "botNamePrefix" TEXT NOT NULL DEFAULT '',
    "customChatMessages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BotConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BotConfig_siteId_key" ON "BotConfig"("siteId");
CREATE INDEX IF NOT EXISTS "BotConfig_siteId_idx" ON "BotConfig"("siteId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN DEFAULT false;
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "User_siteId_idx" ON "User"("siteId");
CREATE INDEX IF NOT EXISTS "User_siteId_role_idx" ON "User"("siteId", "role");
CREATE INDEX IF NOT EXISTS "User_siteId_status_idx" ON "User"("siteId", "status");

ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Wallet_siteId_idx" ON "Wallet"("siteId");
CREATE INDEX IF NOT EXISTS "Wallet_userId_siteId_idx" ON "Wallet"("userId", "siteId");

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Transaction_siteId_idx" ON "Transaction"("siteId");
CREATE INDEX IF NOT EXISTS "Transaction_userId_siteId_idx" ON "Transaction"("userId", "siteId");

ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Bet" ADD CONSTRAINT "Bet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Bet_siteId_idx" ON "Bet"("siteId");
CREATE INDEX IF NOT EXISTS "Bet_userId_siteId_idx" ON "Bet"("userId", "siteId");
CREATE INDEX IF NOT EXISTS "Bet_siteId_gameType_idx" ON "Bet"("siteId", "gameType");

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "ChatMessage_siteId_idx" ON "ChatMessage"("siteId");
CREATE INDEX IF NOT EXISTS "ChatMessage_siteId_createdAt_idx" ON "ChatMessage"("siteId", "createdAt");

INSERT INTO "SiteConfiguration" ("id", "brandName", "domain", "primaryColor", "secondaryColor", "accentColor", "dangerColor", "backgroundColor", "cardColor", "houseEdgeConfig", "active", "updatedAt")
VALUES (
    'default-site-001',
    'StakePro',
    'localhost',
    '#00F0FF',
    '#131B2C',
    '#00D46E',
    '#FF385C',
    '#0A0E17',
    '#131B2C',
    '{"crash": 0.04, "dice": 0.02, "mines": 0.03, "plinko": 0.03, "olympus": 0.04}',
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

UPDATE "User" SET "siteId" = 'default-site-001' WHERE "siteId" IS NULL;
UPDATE "Wallet" SET "siteId" = 'default-site-001' WHERE "siteId" IS NULL;
UPDATE "Transaction" SET "siteId" = 'default-site-001' WHERE "siteId" IS NULL;
UPDATE "Bet" SET "siteId" = 'default-site-001' WHERE "siteId" IS NULL;
UPDATE "ChatMessage" SET "siteId" = 'default-site-001' WHERE "siteId" IS NULL;

INSERT INTO "BotConfig" ("id", "siteId", "enabled", "botCount", "minBetAmount", "maxBetAmount", "chatEnabled", "chatIntervalMin", "chatIntervalMax", "botNamePrefix", "updatedAt")
VALUES (
    'bot-config-default-001',
    'default-site-001',
    true, 50, 5, 1000, true, 5, 15, '',
    CURRENT_TIMESTAMP
) ON CONFLICT ("siteId") DO NOTHING;

SELECT 'Multi-Tenancy migration completed successfully!' AS result;
