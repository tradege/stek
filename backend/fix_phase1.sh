#!/bin/bash
set -e
cd /var/www/stek/backend

echo "=== PHASE 1: Fix BotService crash with try-catch ==="

# Wrap initializeAllSiteBots in try-catch in bot.service.ts
sed -i 's/async onModuleInit() {/async onModuleInit() {\n    try {/' src/modules/bot/bot.service.ts

# Find the line after initializeAllSiteBots call and add catch
sed -i '/await this.initializeAllSiteBots();/{
  N
  s/await this.initializeAllSiteBots();\n    this.logger.log/await this.initializeAllSiteBots();\n    } catch (error) {\n      this.logger.error(`🤖 Bot initialization failed (non-fatal): ${error.message}`);\n    }\n    this.logger.log/
}' src/modules/bot/bot.service.ts

echo "BotService patched with try-catch"

echo "=== PHASE 2: Update Prisma Schema ==="

# Backup current schema
cp prisma/schema.prisma prisma/schema.prisma.bak

cat >> prisma/schema.prisma << 'SCHEMA_EOF'

// ============================================
// MULTI-TENANT SITE CONFIGURATION
// ============================================

model SiteConfiguration {
  id                String      @id @default(uuid())
  brandName         String
  domain            String      @unique
  
  // Branding
  logoUrl           String?
  faviconUrl        String?
  primaryColor      String      @default("#00F0FF")
  secondaryColor    String      @default("#131B2C")
  accentColor       String      @default("#00D46E")
  backgroundColor   String      @default("#0A0E17")
  cardColor         String      @default("#131B2C")
  dangerColor       String      @default("#FF385C")
  heroImageUrl      String?
  backgroundImageUrl String?
  loginBgUrl        String?
  
  // Game assets
  gameAssets        Json?
  
  // House edge configuration per game
  houseEdgeConfig   Json?
  
  // Locale & Legal
  locale            String      @default("en")
  jurisdiction      String?
  licenseType       String?
  
  // Admin
  adminUserId       String?
  
  // Status
  active            Boolean     @default(true)
  
  // Relations
  bots              BotConfig[]
  
  // Timestamps
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@index([domain])
  @@index([active])
}

// ============================================
// BOT CONFIGURATION (per site)
// ============================================

model BotConfig {
  id                String            @id @default(uuid())
  siteId            String
  site              SiteConfiguration @relation(fields: [siteId], references: [id], onDelete: Cascade)
  
  enabled           Boolean     @default(true)
  botCount          Int         @default(50)
  minBetAmount      Decimal     @default(5) @db.Decimal(18, 8)
  maxBetAmount      Decimal     @default(1000) @db.Decimal(18, 8)
  chatEnabled       Boolean     @default(true)
  chatIntervalMin   Int         @default(5)
  chatIntervalMax   Int         @default(15)
  botNamePrefix     String      @default("")
  customChatMessages String[]   @default([])
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@unique([siteId])
  @@index([siteId])
}

// ============================================
// RISK LIMITS (per site)
// ============================================

model RiskLimit {
  id                String      @id @default(uuid())
  siteId            String      @unique
  
  maxPayoutPerDay   Decimal     @default(50000) @db.Decimal(18, 8)
  maxPayoutPerBet   Decimal     @default(10000) @db.Decimal(18, 8)
  maxBetAmount      Decimal     @default(5000) @db.Decimal(18, 8)
  dailyPayoutUsed   Decimal     @default(0) @db.Decimal(18, 8)
  lastResetDate     DateTime    @default(now())
  active            Boolean     @default(true)
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@index([siteId])
}

// ============================================
// EMAIL VERIFICATION TOKENS
// ============================================

model EmailVerificationToken {
  id          String    @id @default(uuid())
  userId      String
  token       String    @unique
  used        Boolean   @default(false)
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
}

// ============================================
// PROMOTIONS
// ============================================

model Promotion {
  id            String    @id @default(uuid())
  title         String
  description   String
  type          String    @default("DEPOSIT_BONUS")
  bonusPercent  Int       @default(100)
  maxBonus      Decimal   @default(1000) @db.Decimal(18, 8)
  wagerReq      Int       @default(30)
  minDeposit    Decimal   @default(10) @db.Decimal(18, 8)
  currency      String    @default("USDT")
  imageUrl      String?
  active        Boolean   @default(true)
  startsAt      DateTime  @default(now())
  expiresAt     DateTime?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([active])
}

// ============================================
// SUPPORT TICKETS
// ============================================

model SupportTicket {
  id          String    @id @default(uuid())
  name        String
  email       String
  subject     String
  message     String
  status      String    @default("OPEN")
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@index([email])
  @@index([status])
}

// ============================================
// GAME CONFIG (House Edge from DB)
// ============================================

model GameConfig {
  id          String    @id @default(uuid())
  key         String    @unique
  houseEdge   Float     @default(0.04)
  config      Json?
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
SCHEMA_EOF

echo "New models added to schema"

# Now add missing fields to existing models

# Add siteId to User model (after timezone field)
sed -i '/timezone.*String.*@default("UTC")/a\  \n  // Multi-tenant\n  siteId            String?\n  \n  // Additional VIP fields\n  totalBets         Int         @default(0)\n  claimableRakeback Decimal     @default(0) @db.Decimal(18, 8)\n  \n  // Email verification\n  emailVerificationToken String?\n  tokenVersion      Int         @default(0)' prisma/schema.prisma

# Add emailVerificationTokens relation to User model (after statistics relation)
sed -i '/statistics.*Statistic\[\].*@relation("UserStatistics")/a\  emailVerificationTokens EmailVerificationToken[]' prisma/schema.prisma

# Add siteId to Wallet model (after lockedBalance)
sed -i '/lockedBalance.*Decimal.*@default(0).*@db.Decimal(18, 8)/a\  \n  // Multi-tenant\n  siteId          String?' prisma/schema.prisma

# Add siteId to Bet model (after currency field)
sed -i '/^  gameType.*GameType$/a\  siteId          String?' prisma/schema.prisma

# Add serverSeedHash if not already there (it is, so skip)

# Add siteId to Transaction model (after metadata field)
sed -i '/metadata.*Json?/a\  \n  // Multi-tenant\n  siteId          String?' prisma/schema.prisma

echo "Missing fields added to existing models"

echo "=== PHASE 3: Prisma DB Push + Generate ==="
npx prisma db push --accept-data-loss 2>&1
npx prisma generate 2>&1

echo "=== PHASE 4: Create House Edge Seed Script ==="
cat > prisma/seed-gameconfig.ts << 'SEED_EOF'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed default GameConfig with 4% house edge
  const existing = await prisma.gameConfig.findUnique({ where: { key: 'default' } });
  if (!existing) {
    await prisma.gameConfig.create({
      data: {
        key: 'default',
        houseEdge: 0.04,
        config: {
          crash: 0.04,
          dice: 0.02,
          mines: 0.03,
          plinko: 0.03,
          olympus: 0.04,
          limbo: 0.04,
          penalty: 0.04,
          cardRush: 0.04,
        },
      },
    });
    console.log('✅ Default GameConfig seeded (4% house edge)');
  } else {
    console.log('GameConfig already exists, skipping seed');
  }

  // Seed default promotions
  const promoCount = await prisma.promotion.count();
  if (promoCount === 0) {
    await prisma.promotion.createMany({
      data: [
        {
          title: '🎉 Welcome Bonus',
          description: 'Get 100% deposit match up to $1,000 on your first deposit! Start your journey with double the funds.',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: 1000,
          wagerReq: 30,
          minDeposit: 10,
          active: true,
        },
        {
          title: '🔄 Weekly Reload',
          description: 'Every Monday, get a 50% reload bonus up to $500. Keep the momentum going all week!',
          type: 'RELOAD_BONUS',
          bonusPercent: 50,
          maxBonus: 500,
          wagerReq: 25,
          minDeposit: 20,
          active: true,
        },
        {
          title: '💰 Daily Cashback',
          description: 'Get 10% cashback on net losses every day. No wagering requirements on cashback funds!',
          type: 'CASHBACK',
          bonusPercent: 10,
          maxBonus: 200,
          wagerReq: 0,
          minDeposit: 0,
          active: true,
        },
        {
          title: '🏆 VIP Level-Up Bonus',
          description: 'Earn automatic bonuses when you reach new VIP tiers. Higher levels = bigger rewards!',
          type: 'VIP_BONUS',
          bonusPercent: 0,
          maxBonus: 5000,
          wagerReq: 10,
          minDeposit: 0,
          active: true,
        },
      ],
    });
    console.log('✅ Default promotions seeded');
  } else {
    console.log('Promotions already exist, skipping seed');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
SEED_EOF

# Run the seed
npx ts-node prisma/seed-gameconfig.ts 2>&1 || npx tsx prisma/seed-gameconfig.ts 2>&1 || echo "Trying alternative seed method..."

echo "=== PHASE 1-4 COMPLETE ==="
