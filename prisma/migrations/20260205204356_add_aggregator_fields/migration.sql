-- Add aggregator fields to GameProvider
ALTER TABLE "GameProvider" ADD COLUMN "aggregatorId" TEXT;
ALTER TABLE "GameProvider" ADD COLUMN "aggregatorName" TEXT;

-- Add subcategory, tags, and playCount to Game
ALTER TABLE "Game" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "Game" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Game" ADD COLUMN "playCount" INTEGER NOT NULL DEFAULT 0;
