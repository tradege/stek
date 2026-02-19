const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // 1. Add enum values one by one
  const enumsToAdd = ['RAKEBACK', 'BONUS', 'TRIVIA', 'RACE_PRIZE', 'WEEKLY_BONUS', 'MONTHLY_BONUS'];
  for (const val of enumsToAdd) {
    try {
      await p.$executeRawUnsafe(`ALTER TYPE "TransactionType" ADD VALUE '${val}'`);
      console.log(`OK: Added enum ${val}`);
    } catch(e) {
      console.log(`SKIP: ${val} - ${e.message.substring(0, 60)}`);
    }
  }

  // 2. Create RewardPool table
  try {
    await p.$executeRawUnsafe(`
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
      )
    `);
    console.log('OK: Created RewardPool table');
  } catch(e) {
    console.log('SKIP RewardPool: ' + e.message.substring(0, 60));
  }

  // Insert initial pool record
  try {
    const count = await p.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "RewardPool"');
    if (Number(count[0].cnt) === 0) {
      await p.$executeRawUnsafe(`INSERT INTO "RewardPool" ("id") VALUES (gen_random_uuid())`);
      console.log('OK: Inserted initial RewardPool record');
    } else {
      console.log('SKIP: RewardPool record already exists');
    }
  } catch(e) {
    console.log('ERR RewardPool insert: ' + e.message.substring(0, 60));
  }

  // 3. Create RewardHistory table
  try {
    await p.$executeRawUnsafe(`
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
      )
    `);
    console.log('OK: Created RewardHistory table');
  } catch(e) {
    console.log('SKIP RewardHistory: ' + e.message.substring(0, 60));
  }

  // Indexes for RewardHistory
  try {
    await p.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RewardHistory_userId_idx" ON "RewardHistory"("userId")');
    await p.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RewardHistory_type_idx" ON "RewardHistory"("type")');
    await p.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RewardHistory_createdAt_idx" ON "RewardHistory"("createdAt")');
    console.log('OK: Created RewardHistory indexes');
  } catch(e) {
    console.log('SKIP indexes: ' + e.message.substring(0, 60));
  }

  // 4. Create RewardPoolContribution table
  try {
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RewardPoolContribution" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL,
        "betId" TEXT,
        "amount" DECIMAL(18,8) NOT NULL,
        "gameType" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "RewardPoolContribution_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "RewardPoolContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `);
    console.log('OK: Created RewardPoolContribution table');
  } catch(e) {
    console.log('SKIP RewardPoolContribution: ' + e.message.substring(0, 60));
  }

  try {
    await p.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RewardPoolContribution_userId_idx" ON "RewardPoolContribution"("userId")');
    await p.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RewardPoolContribution_createdAt_idx" ON "RewardPoolContribution"("createdAt")');
    console.log('OK: Created RewardPoolContribution indexes');
  } catch(e) {
    console.log('SKIP indexes: ' + e.message.substring(0, 60));
  }

  // VERIFY
  console.log('\n=== VERIFICATION ===');
  const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name='Wallet' AND column_name='bonusBalance'");
  console.log('bonusBalance column:', cols.length > 0 ? 'EXISTS' : 'MISSING');
  
  const tables = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('RewardPool', 'RewardHistory', 'RewardPoolContribution') ORDER BY table_name");
  console.log('New tables:', tables.map(t => t.table_name));
  
  const enums = await p.$queryRawUnsafe('SELECT unnest(enum_range(NULL::"TransactionType"))::text as val');
  console.log('TransactionType enums:', enums.map(e => e.val));
  
  const pool = await p.$queryRawUnsafe('SELECT * FROM "RewardPool" LIMIT 1');
  console.log('RewardPool record:', pool.length > 0 ? 'EXISTS' : 'MISSING');

  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
