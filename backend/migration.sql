-- ============================================
-- MIGRATION: Reward Pool + Bonus System
-- ============================================

-- 1. Add bonusBalance to Wallet (non-withdrawable bonus funds)
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "bonusBalance" DECIMAL(18,8) NOT NULL DEFAULT 0;

-- 2. Add new TransactionType enum values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RAKEBACK' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'RAKEBACK';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BONUS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'BONUS';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TRIVIA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'TRIVIA';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RACE_PRIZE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'RACE_PRIZE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WEEKLY_BONUS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'WEEKLY_BONUS';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MONTHLY_BONUS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'MONTHLY_BONUS';
  END IF;
END $$;

-- 3. Create RewardPool table (global pool tracking)
CREATE TABLE IF NOT EXISTS "RewardPool" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "totalAccumulated" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "totalDistributed" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "currentBalance" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "lastWeeklyDistribution" TIMESTAMP,
  "lastMonthlyDistribution" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "RewardPool_pkey" PRIMARY KEY ("id")
);

-- Insert initial pool record if none exists
INSERT INTO "RewardPool" ("id", "totalAccumulated", "totalDistributed", "currentBalance")
SELECT gen_random_uuid(), 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM "RewardPool" LIMIT 1);

-- 4. Create RewardHistory table (per-user reward log)
CREATE TABLE IF NOT EXISTS "RewardHistory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(18,8) NOT NULL,
  "source" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "isWithdrawable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "RewardHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RewardHistory_userId_idx" ON "RewardHistory"("userId");
CREATE INDEX IF NOT EXISTS "RewardHistory_type_idx" ON "RewardHistory"("type");
CREATE INDEX IF NOT EXISTS "RewardHistory_createdAt_idx" ON "RewardHistory"("createdAt");

-- 5. Create RewardPoolContribution table (tracks each bet's contribution)
CREATE TABLE IF NOT EXISTS "RewardPoolContribution" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "betId" TEXT,
  "amount" DECIMAL(18,8) NOT NULL,
  "gameType" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "RewardPoolContribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardPoolContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RewardPoolContribution_userId_idx" ON "RewardPoolContribution"("userId");
CREATE INDEX IF NOT EXISTS "RewardPoolContribution_createdAt_idx" ON "RewardPoolContribution"("createdAt");
