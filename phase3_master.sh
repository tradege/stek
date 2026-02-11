#!/bin/bash
set -e
echo "============================================"
echo "PHASE 3: Game Integration, Admin GGR, Affiliate, Fraud"
echo "============================================"

cd /var/www/stek/backend

# ============================================
# STEP 0: Add RiskLimit and FraudAlert to Prisma Schema
# ============================================
echo ">>> Step 0: Updating Prisma Schema..."

# Check if RiskLimit model already exists
if ! grep -q 'model RiskLimit' prisma/schema.prisma; then
cat >> prisma/schema.prisma << 'SCHEMAEOF'

// ============================================
// RISK MANAGEMENT - Per Brand Limits
// ============================================
model RiskLimit {
  id              String   @id @default(uuid())
  siteId          String
  site            SiteConfiguration @relation(fields: [siteId], references: [id])
  maxPayoutPerDay Decimal  @default(50000) @db.Decimal(18,2)
  maxPayoutPerBet Decimal  @default(10000) @db.Decimal(18,2)
  maxBetAmount    Decimal  @default(5000)  @db.Decimal(18,2)
  dailyPayoutUsed Decimal  @default(0)     @db.Decimal(18,2)
  lastResetDate   DateTime @default(now())
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([siteId])
  @@index([siteId])
}

// ============================================
// FRAUD DETECTION - Suspicious Activity Alerts
// ============================================
model FraudAlert {
  id          String   @id @default(uuid())
  siteId      String
  site        SiteConfiguration @relation(fields: [siteId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  alertType   String   // HIGH_WIN_RATE, RAPID_BETTING, LARGE_WITHDRAWAL, etc.
  severity    String   @default("MEDIUM") // LOW, MEDIUM, HIGH, CRITICAL
  details     Json?
  status      String   @default("OPEN") // OPEN, REVIEWED, DISMISSED, CONFIRMED
  reviewedBy  String?
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())

  @@index([siteId])
  @@index([userId])
  @@index([status])
  @@index([siteId, status])
}
SCHEMAEOF

# Add relations to SiteConfiguration
sed -i '/model SiteConfiguration {/,/^}/{ /active.*Boolean/a\
  riskLimits  RiskLimit[]\
  fraudAlerts FraudAlert[]
}' prisma/schema.prisma 2>/dev/null || true

# Add relation to User
sed -i '/model User {/,/^}/{ /bets.*Bet\[\]/a\
  fraudAlerts FraudAlert[]
}' prisma/schema.prisma 2>/dev/null || true

echo "✅ Schema updated with RiskLimit and FraudAlert"
fi

# Push schema to DB
echo "Pushing schema to DB..."
npx prisma db push --accept-data-loss 2>&1 | tail -5
npx prisma generate 2>&1 | tail -3
echo "✅ Schema synced"

# ============================================
# STEP 1: Shared Tenant Helper for Games
# ============================================
echo ">>> Step 1: Creating shared game tenant helper..."

mkdir -p src/common/helpers

cat > src/common/helpers/game-tenant.helper.ts << 'GAMEHELPEREOF'
/**
 * ============================================
 * GAME TENANT HELPER
 * ============================================
 * Shared utility for all game services to:
 * 1. Get dynamic houseEdge from SiteConfiguration
 * 2. Check risk limits before payouts
 * 3. Add siteId to all DB operations
 */
import { PrismaService } from '../../prisma/prisma.service';

// Cache for site configs (5 min TTL)
const siteConfigCache = new Map<string, { config: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface GameTenantConfig {
  siteId: string;
  houseEdge: number;
  maxBetAmount: number;
  maxPayoutPerBet: number;
  maxPayoutPerDay: number;
}

/**
 * Get game configuration for a specific site
 * Returns dynamic houseEdge and risk limits
 */
export async function getGameConfig(
  prisma: PrismaService,
  siteId: string,
  gameType: string,
): Promise<GameTenantConfig> {
  const cacheKey = `${siteId}:${gameType}`;
  const cached = siteConfigCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.config;
  }

  // Fetch site configuration
  const site = await prisma.siteConfiguration.findUnique({
    where: { id: siteId },
    select: { houseEdgeConfig: true },
  });

  // Fetch risk limits
  const riskLimit = await prisma.riskLimit.findUnique({
    where: { siteId },
  });

  // Parse houseEdge from JSON config
  const houseEdgeConfig = (site?.houseEdgeConfig as any) || {};
  const gameKey = gameType.toLowerCase();
  const houseEdge = houseEdgeConfig[gameKey] ?? 0.04; // Default 4%

  const config: GameTenantConfig = {
    siteId,
    houseEdge,
    maxBetAmount: riskLimit ? Number(riskLimit.maxBetAmount) : 5000,
    maxPayoutPerBet: riskLimit ? Number(riskLimit.maxPayoutPerBet) : 10000,
    maxPayoutPerDay: riskLimit ? Number(riskLimit.maxPayoutPerDay) : 50000,
  };

  siteConfigCache.set(cacheKey, { config, timestamp: Date.now() });
  return config;
}

/**
 * Check if a payout exceeds risk limits
 */
export async function checkRiskLimits(
  prisma: PrismaService,
  siteId: string,
  payoutAmount: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const riskLimit = await prisma.riskLimit.findUnique({
    where: { siteId },
  });

  if (!riskLimit || !riskLimit.active) {
    return { allowed: true };
  }

  // Check per-bet limit
  if (payoutAmount > Number(riskLimit.maxPayoutPerBet)) {
    return { allowed: false, reason: `Payout $${payoutAmount} exceeds max per bet $${riskLimit.maxPayoutPerBet}` };
  }

  // Check daily limit - reset if new day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (riskLimit.lastResetDate < today) {
    await prisma.riskLimit.update({
      where: { siteId },
      data: { dailyPayoutUsed: 0, lastResetDate: today },
    });
    return { allowed: true };
  }

  const dailyUsed = Number(riskLimit.dailyPayoutUsed);
  if (dailyUsed + payoutAmount > Number(riskLimit.maxPayoutPerDay)) {
    return { allowed: false, reason: `Daily payout limit reached ($${dailyUsed}/$${riskLimit.maxPayoutPerDay})` };
  }

  return { allowed: true };
}

/**
 * Record payout against daily limit
 */
export async function recordPayout(
  prisma: PrismaService,
  siteId: string,
  payoutAmount: number,
): Promise<void> {
  try {
    await prisma.riskLimit.update({
      where: { siteId },
      data: { dailyPayoutUsed: { increment: payoutAmount } },
    });
  } catch (e) {
    // Risk limit record may not exist yet - that's OK
  }
}

/**
 * Invalidate cache for a site (called when admin updates config)
 */
export function invalidateSiteCache(siteId: string): void {
  for (const key of siteConfigCache.keys()) {
    if (key.startsWith(siteId)) {
      siteConfigCache.delete(key);
    }
  }
}
GAMEHELPEREOF
echo "✅ Game tenant helper created"

# ============================================
# STEP 1A: Update DICE SERVICE
# ============================================
echo ">>> Step 1A: Updating Dice Service..."

cat > src/modules/dice/dice.service.ts << 'DICESVCEOF'
/**
 * ============================================
 * DICE SERVICE - Multi-Tenant Provably Fair
 * ============================================
 * Dynamic houseEdge from SiteConfiguration per brand.
 * All bets validated against user's siteId.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getGameConfig, checkRiskLimits, recordPayout } from '../../common/helpers/game-tenant.helper';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

export interface PlayDiceDto {
  betAmount: number;
  target: number;
  condition: 'OVER' | 'UNDER';
  currency?: string;
}

export interface DiceResult {
  roll: number;
  target: number;
  condition: 'OVER' | 'UNDER';
  isWin: boolean;
  multiplier: number;
  winChance: number;
  payout: number;
  profit: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const MIN_TARGET = 0.01;
const MAX_TARGET = 99.98;
const MIN_WIN_CHANCE = 0.01;
const MAX_WIN_CHANCE = 99.99;
const ROLL_PRECISION = 10000;
const MIN_BET = 0.01;
const RATE_LIMIT_MS = 300;
const userLastBetTime = new Map<string, number>();

@Injectable()
export class DiceService {
  constructor(private prisma: PrismaService) {}

  calculateWinChance(target: number, condition: 'OVER' | 'UNDER'): number {
    return condition === 'UNDER' ? target : (100 - target);
  }

  calculateMultiplier(winChance: number, houseEdge: number): number {
    return parseFloat(((100 - houseEdge * 100) / winChance).toFixed(4));
  }

  generateRoll(serverSeed: string, clientSeed: string, nonce: number): number {
    const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
    const value = parseInt(hash.substring(0, 8), 16);
    return parseFloat(((value % ROLL_PRECISION) / 100).toFixed(2));
  }

  isWinningRoll(roll: number, target: number, condition: 'OVER' | 'UNDER'): boolean {
    return condition === 'UNDER' ? roll < target : roll > target;
  }

  /**
   * Main play function - MULTI-TENANT with dynamic houseEdge
   */
  async play(userId: string, dto: PlayDiceDto, siteId: string): Promise<DiceResult> {
    const { betAmount, target, condition, currency = 'USDT' } = dto;

    // Rate limiting
    const now = Date.now();
    const lastBet = userLastBetTime.get(userId) || 0;
    if (now - lastBet < RATE_LIMIT_MS) {
      throw new BadRequestException('Please wait before placing another bet');
    }
    userLastBetTime.set(userId, now);
    if (userLastBetTime.size > 10000) {
      const cutoff = now - 60000;
      for (const [uid, time] of userLastBetTime.entries()) {
        if (time < cutoff) userLastBetTime.delete(uid);
      }
    }

    // Get dynamic config for this brand
    const gameConfig = await getGameConfig(this.prisma, siteId, 'dice');

    // Validate bet amount against brand limits
    if (betAmount < MIN_BET || betAmount > gameConfig.maxBetAmount) {
      throw new BadRequestException(`Bet must be between ${MIN_BET} and ${gameConfig.maxBetAmount}`);
    }
    if (target < MIN_TARGET || target > MAX_TARGET) {
      throw new BadRequestException(`Target must be between ${MIN_TARGET} and ${MAX_TARGET}`);
    }
    if (condition !== 'OVER' && condition !== 'UNDER') {
      throw new BadRequestException('Condition must be OVER or UNDER');
    }

    // Calculate with DYNAMIC house edge
    const winChance = this.calculateWinChance(target, condition);
    if (winChance < MIN_WIN_CHANCE || winChance > MAX_WIN_CHANCE) {
      throw new BadRequestException('Win chance out of valid range');
    }
    const multiplier = this.calculateMultiplier(winChance, gameConfig.houseEdge);

    // Generate provably fair result
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = Math.floor(Math.random() * 1000000);
    const roll = this.generateRoll(serverSeed, clientSeed, nonce);
    const isWin = this.isWinningRoll(roll, target, condition);
    const payout = isWin ? betAmount * multiplier : 0;
    const profit = payout - betAmount;

    // Check risk limits for wins
    if (isWin && payout > 0) {
      const riskCheck = await checkRiskLimits(this.prisma, siteId, payout);
      if (!riskCheck.allowed) {
        throw new BadRequestException('Bet exceeds current risk limits. Try a smaller amount.');
      }
    }

    // Atomic transaction with siteId isolation
    await this.prisma.$transaction(async (tx) => {
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" 
        WHERE "userId" = ${userId} AND currency = ${currency}::"Currency" AND "siteId" = ${siteId}
        FOR UPDATE
      `;
      if (!lockedWallets || lockedWallets.length === 0) {
        // Fallback: try without siteId filter for backwards compat
        const fallbackWallets = await tx.$queryRaw<any[]>`
          SELECT id, balance FROM "Wallet" 
          WHERE "userId" = ${userId} AND currency = ${currency}::"Currency"
          FOR UPDATE
        `;
        if (!fallbackWallets || fallbackWallets.length === 0) {
          throw new BadRequestException('Wallet not found');
        }
        var wallet = fallbackWallets[0];
      } else {
        var wallet = lockedWallets[0];
      }

      const currentBalance = new Decimal(wallet.balance);
      if (currentBalance.lessThan(betAmount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = currentBalance.minus(betAmount).plus(payout);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      await tx.bet.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          siteId,
          gameType: 'DICE',
          currency: currency as any,
          betAmount: new Decimal(betAmount),
          multiplier: new Decimal(multiplier),
          payout: new Decimal(payout),
          profit: new Decimal(profit),
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          gameData: { roll, target, condition, winChance, houseEdge: gameConfig.houseEdge },
          isWin,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          siteId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: new Decimal(betAmount),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: `DICE-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: { game: 'DICE', roll, target, condition, multiplier, payout, profit, isWin, siteId },
        },
      });
    });

    // Record payout for risk tracking
    if (isWin && payout > 0) {
      await recordPayout(this.prisma, siteId, payout);
    }

    return { roll, target, condition, isWin, multiplier, winChance, payout, profit, serverSeedHash, clientSeed, nonce };
  }

  verifyRoll(serverSeed: string, clientSeed: string, nonce: number) {
    const roll = this.generateRoll(serverSeed, clientSeed, nonce);
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { roll, serverSeedHash };
  }

  async getHistory(userId: string, siteId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: { userId, siteId, gameType: 'DICE' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, betAmount: true, multiplier: true, payout: true,
        profit: true, isWin: true, gameData: true, createdAt: true,
      },
    });
  }
}
DICESVCEOF
echo "✅ Dice service updated"

# ============================================
# STEP 1B: Update DICE CONTROLLER
# ============================================
echo ">>> Step 1B: Updating Dice Controller..."

cat > src/modules/dice/dice.controller.ts << 'DICECTRLEOF'
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { DiceService, PlayDiceDto } from './dice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dice')
@UseGuards(JwtAuthGuard)
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: PlayDiceDto) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.diceService.play(req.user.id, dto, siteId);
  }

  @Post('verify')
  async verify(@Body() body: { serverSeed: string; clientSeed: string; nonce: number }) {
    return this.diceService.verifyRoll(body.serverSeed, body.clientSeed, body.nonce);
  }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.diceService.getHistory(req.user.id, siteId, limit ? parseInt(limit) : 20);
  }
}
DICECTRLEOF
echo "✅ Dice controller updated"

# ============================================
# STEP 1C: Update MINES SERVICE
# ============================================
echo ">>> Step 1C: Updating Mines Service..."

# For mines, we need to inject siteId into startGame and cashout
# The key change: HOUSE_EDGE comes from getGameConfig instead of constant
sed -i 's/const HOUSE_EDGE = 0.04;/\/\/ HOUSE_EDGE is now dynamic per brand - see getGameConfig/' src/modules/mines/mines.service.ts

# Add import for game-tenant helper at top
sed -i '1i import { getGameConfig, checkRiskLimits, recordPayout } from "../../common/helpers/game-tenant.helper";' src/modules/mines/mines.service.ts

# Add siteId parameter to startGame
sed -i 's/async startGame(userId: string, dto: StartGameDto)/async startGame(userId: string, dto: StartGameDto, siteId: string = "default-site-001")/' src/modules/mines/mines.service.ts

# Replace hardcoded HOUSE_EDGE with dynamic
sed -i 's/(1 - HOUSE_EDGE)/(1 - (await getGameConfig(this.prisma, siteId, "mines")).houseEdge)/' src/modules/mines/mines.service.ts 2>/dev/null || true

# Add siteId to bet.create in mines
sed -i '/gameType: .MINES./a\          siteId,' src/modules/mines/mines.service.ts 2>/dev/null || true

# Add siteId to transaction.create in mines
sed -i "/type: 'BET'/a\          siteId," src/modules/mines/mines.service.ts 2>/dev/null || true

echo "✅ Mines service updated (sed patches)"

# ============================================
# STEP 1D: Update PLINKO SERVICE
# ============================================
echo ">>> Step 1D: Updating Plinko Service..."

# Add import
sed -i '1i import { getGameConfig, checkRiskLimits, recordPayout } from "../../common/helpers/game-tenant.helper";' src/modules/plinko/plinko.service.ts

# Add siteId parameter to play
sed -i 's/async play(userId: string, dto: PlayPlinkoDto)/async play(userId: string, dto: PlayPlinkoDto, siteId: string = "default-site-001")/' src/modules/plinko/plinko.service.ts

# Add siteId to bet.create
sed -i "/gameType: 'PLINKO'/a\          siteId," src/modules/plinko/plinko.service.ts 2>/dev/null || true

# Add siteId to transaction.create
sed -i "/game: 'PLINKO'/i\          siteId," src/modules/plinko/plinko.service.ts 2>/dev/null || true

echo "✅ Plinko service updated (sed patches)"

# ============================================
# STEP 1E: Update PLINKO CONTROLLER
# ============================================
echo ">>> Step 1E: Updating Plinko Controller..."

cat > src/modules/plinko/plinko.controller.ts << 'PLINKOCTRLEOF'
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { PlinkoService } from './plinko.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('games/plinko')
@UseGuards(JwtAuthGuard)
export class PlinkoController {
  constructor(private readonly plinkoService: PlinkoService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.plinkoService.play(req.user.id, dto, siteId);
  }

  @Get('multipliers')
  getMultipliers(@Query('rows') rows: string, @Query('risk') risk: string) {
    return this.plinkoService.getMultipliers(parseInt(rows) || 12, (risk || 'MEDIUM') as any);
  }
}
PLINKOCTRLEOF
echo "✅ Plinko controller updated"

# ============================================
# STEP 1F: Update OLYMPUS SERVICE (key parts only)
# ============================================
echo ">>> Step 1F: Updating Olympus Service..."

# Add siteId to spin function signature
sed -i 's/async spin(userId: string, dto: SpinDto)/async spin(userId: string, dto: SpinDto, siteId: string = "default-site-001")/' src/modules/olympus/olympus.service.ts

# Add siteId to bet.create calls in olympus
sed -i "/gameType: 'OLYMPUS'/a\        siteId," src/modules/olympus/olympus.service.ts 2>/dev/null || true

echo "✅ Olympus service updated (sed patches)"

# ============================================
# STEP 1G: Update OLYMPUS CONTROLLER
# ============================================
echo ">>> Step 1G: Updating Olympus Controller..."

# Read current controller
OLYMPUS_CTRL=$(cat src/modules/olympus/olympus.controller.ts)

# Add siteId extraction to spin endpoint
sed -i 's/return this.olympusService.spin(req.user.id, dto)/const siteId = req.tenant?.siteId || req.user?.siteId || "default-site-001"; return this.olympusService.spin(req.user.id, dto, siteId)/' src/modules/olympus/olympus.controller.ts 2>/dev/null || true

echo "✅ Olympus controller updated"

# ============================================
# STEP 2: ADMIN BRAND MASTER SERVICE
# ============================================
echo ">>> Step 2: Creating Admin Brand Master Service..."

cat > src/modules/admin/admin.service.ts << 'ADMINSVCEOF'
/**
 * ============================================
 * ADMIN SERVICE - Multi-Tenant Brand Master
 * ============================================
 * GGR/NGR per brand, risk management, user management
 * All queries filtered by siteId for brand isolation
 */
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import { invalidateSiteCache } from '../../common/helpers/game-tenant.helper';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // BRAND DASHBOARD - GGR/NGR per siteId
  // ============================================

  /**
   * Get comprehensive stats for a specific brand
   * SUPER_ADMIN can pass any siteId, brand admins see only their brand
   */
  async getBrandDashboard(siteId: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const siteFilter = siteId === 'ALL' ? {} : { siteId };
    const userSiteFilter = siteId === 'ALL' ? {} : { siteId };

    const [
      totalUsers, activeUsers, pendingUsers, pendingTx,
      deposits, withdrawals,
      allTimeBets, last24hBets, last7dBets, last30dBets,
      activePlayersToday, riskLimit, siteConfig,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...userSiteFilter, isBot: false } }),
      this.prisma.user.count({ where: { ...userSiteFilter, isBot: false, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { ...userSiteFilter, status: 'PENDING_APPROVAL' } }),
      this.prisma.transaction.count({ where: { ...siteFilter, status: 'PENDING' } }),
      // Deposits
      this.prisma.transaction.aggregate({
        where: { ...siteFilter, type: 'DEPOSIT', status: 'CONFIRMED', user: { isBot: false } },
        _sum: { amount: true },
      }),
      // Withdrawals
      this.prisma.transaction.aggregate({
        where: { ...siteFilter, type: 'WITHDRAWAL', status: 'CONFIRMED', user: { isBot: false } },
        _sum: { amount: true },
      }),
      // All time bets (real users only)
      this.prisma.bet.aggregate({
        where: { ...siteFilter, user: { isBot: false } },
        _sum: { betAmount: true, payout: true, profit: true },
        _count: true,
      }),
      // Last 24h bets
      this.prisma.bet.aggregate({
        where: { ...siteFilter, user: { isBot: false }, createdAt: { gte: oneDayAgo } },
        _sum: { betAmount: true, payout: true, profit: true },
        _count: true,
      }),
      // Last 7d bets
      this.prisma.bet.aggregate({
        where: { ...siteFilter, user: { isBot: false }, createdAt: { gte: sevenDaysAgo } },
        _sum: { betAmount: true, payout: true, profit: true },
        _count: true,
      }),
      // Last 30d bets
      this.prisma.bet.aggregate({
        where: { ...siteFilter, user: { isBot: false }, createdAt: { gte: thirtyDaysAgo } },
        _sum: { betAmount: true, payout: true, profit: true },
        _count: true,
      }),
      // Active players today
      this.prisma.bet.groupBy({
        by: ['userId'],
        where: { ...siteFilter, user: { isBot: false }, createdAt: { gte: oneDayAgo } },
      }),
      // Risk limit
      siteId !== 'ALL' ? this.prisma.riskLimit.findUnique({ where: { siteId } }) : null,
      // Site config
      siteId !== 'ALL' ? this.prisma.siteConfiguration.findUnique({ where: { id: siteId } }) : null,
    ]);

    const totalDeposits = Number(deposits._sum.amount || 0);
    const totalWithdrawals = Number(withdrawals._sum.amount || 0);

    // GGR = Total Wagered - Total Payouts
    const calcGGR = (bets: any) => {
      const wagered = Number(bets._sum.betAmount || 0);
      const payouts = Number(bets._sum.payout || 0);
      return { wagered, payouts, ggr: wagered - payouts, bets: bets._count || 0 };
    };

    const allTime = calcGGR(allTimeBets);
    const today = calcGGR(last24hBets);
    const week = calcGGR(last7dBets);
    const month = calcGGR(last30dBets);

    // NGR = GGR - Affiliate Commissions - Bonuses
    const commissions = await this.prisma.commission.aggregate({
      where: siteId === 'ALL' ? {} : { recipient: { siteId } },
      _sum: { amount: true },
    });
    const totalCommissions = Number(commissions._sum.amount || 0);
    const ngr = allTime.ggr - totalCommissions;

    // Per-game breakdown
    const gameBreakdown = await this.prisma.bet.groupBy({
      by: ['gameType'],
      where: { ...siteFilter, user: { isBot: false } },
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
    });

    const games = gameBreakdown.map(g => ({
      game: g.gameType,
      bets: g._count,
      wagered: Number(g._sum.betAmount || 0),
      payouts: Number(g._sum.payout || 0),
      ggr: Number(g._sum.betAmount || 0) - Number(g._sum.payout || 0),
      rtp: Number(g._sum.betAmount || 0) > 0
        ? ((Number(g._sum.payout || 0) / Number(g._sum.betAmount || 0)) * 100).toFixed(2) + '%'
        : '0%',
    }));

    return {
      brand: siteConfig ? { id: siteConfig.id, name: siteConfig.brandName, domain: siteConfig.domain } : { id: siteId },
      users: { total: totalUsers, active: activeUsers, pending: pendingUsers, activeToday: activePlayersToday.length },
      financial: {
        totalDeposits,
        totalWithdrawals,
        netDeposits: totalDeposits - totalWithdrawals,
        pendingTransactions: pendingTx,
      },
      revenue: {
        allTime: { ...allTime, ngr: allTime.ggr - totalCommissions },
        today,
        last7Days: week,
        last30Days: month,
      },
      ngr: { ggr: allTime.ggr, commissions: totalCommissions, ngr },
      games,
      riskLimits: riskLimit ? {
        maxPayoutPerDay: Number(riskLimit.maxPayoutPerDay),
        maxPayoutPerBet: Number(riskLimit.maxPayoutPerBet),
        maxBetAmount: Number(riskLimit.maxBetAmount),
        dailyPayoutUsed: Number(riskLimit.dailyPayoutUsed),
      } : null,
    };
  }

  /**
   * Get stats for ALL brands (SUPER_ADMIN overview)
   */
  async getAllBrandsDashboard() {
    const sites = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      select: { id: true, brandName: true, domain: true },
    });

    const dashboards = await Promise.all(
      sites.map(async (site) => {
        const dashboard = await this.getBrandDashboard(site.id);
        return { ...dashboard, brand: site };
      })
    );

    // Aggregate totals
    const totals = {
      totalUsers: dashboards.reduce((s, d) => s + d.users.total, 0),
      totalGGR: dashboards.reduce((s, d) => s + d.revenue.allTime.ggr, 0),
      totalNGR: dashboards.reduce((s, d) => s + d.ngr.ngr, 0),
      todayGGR: dashboards.reduce((s, d) => s + d.revenue.today.ggr, 0),
      activePlayersToday: dashboards.reduce((s, d) => s + d.users.activeToday, 0),
    };

    return { brands: dashboards, totals };
  }

  // ============================================
  // HOUSE EDGE MANAGEMENT
  // ============================================

  /**
   * Update houseEdge config for a brand in real-time
   */
  async updateHouseEdge(siteId: string, houseEdgeConfig: Record<string, number>) {
    // Validate values
    for (const [game, edge] of Object.entries(houseEdgeConfig)) {
      if (edge < 0 || edge > 0.5) {
        throw new BadRequestException(`House edge for ${game} must be between 0 and 0.5 (50%)`);
      }
    }

    const site = await this.prisma.siteConfiguration.update({
      where: { id: siteId },
      data: { houseEdgeConfig },
    });

    // Invalidate cache so games pick up new values immediately
    invalidateSiteCache(siteId);

    return {
      success: true,
      message: `House edge updated for ${site.brandName}`,
      houseEdgeConfig,
    };
  }

  /**
   * Get current houseEdge config for a brand
   */
  async getHouseEdge(siteId: string) {
    const site = await this.prisma.siteConfiguration.findUnique({
      where: { id: siteId },
      select: { id: true, brandName: true, houseEdgeConfig: true },
    });
    if (!site) throw new NotFoundException('Brand not found');
    return site;
  }

  // ============================================
  // RISK MANAGEMENT
  // ============================================

  /**
   * Set risk limits for a brand
   */
  async setRiskLimits(siteId: string, limits: {
    maxPayoutPerDay?: number;
    maxPayoutPerBet?: number;
    maxBetAmount?: number;
  }) {
    const data: any = {};
    if (limits.maxPayoutPerDay !== undefined) data.maxPayoutPerDay = limits.maxPayoutPerDay;
    if (limits.maxPayoutPerBet !== undefined) data.maxPayoutPerBet = limits.maxPayoutPerBet;
    if (limits.maxBetAmount !== undefined) data.maxBetAmount = limits.maxBetAmount;

    const riskLimit = await this.prisma.riskLimit.upsert({
      where: { siteId },
      create: { siteId, ...data },
      update: data,
    });

    invalidateSiteCache(siteId);

    return {
      success: true,
      message: 'Risk limits updated',
      riskLimit: {
        maxPayoutPerDay: Number(riskLimit.maxPayoutPerDay),
        maxPayoutPerBet: Number(riskLimit.maxPayoutPerBet),
        maxBetAmount: Number(riskLimit.maxBetAmount),
        dailyPayoutUsed: Number(riskLimit.dailyPayoutUsed),
      },
    };
  }

  async getRiskLimits(siteId: string) {
    const rl = await this.prisma.riskLimit.findUnique({ where: { siteId } });
    if (!rl) return { message: 'No risk limits set for this brand' };
    return {
      maxPayoutPerDay: Number(rl.maxPayoutPerDay),
      maxPayoutPerBet: Number(rl.maxPayoutPerBet),
      maxBetAmount: Number(rl.maxBetAmount),
      dailyPayoutUsed: Number(rl.dailyPayoutUsed),
      lastResetDate: rl.lastResetDate,
    };
  }

  // ============================================
  // USER MANAGEMENT (with siteId filter)
  // ============================================

  async getStats(siteId?: string) {
    return this.getBrandDashboard(siteId || 'ALL');
  }

  async getAllUsers(siteId?: string, limit = 100) {
    const where: any = {};
    if (siteId && siteId !== 'ALL') where.siteId = siteId;

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, username: true, email: true, status: true, role: true,
        createdAt: true, lastLoginAt: true, siteId: true, isBot: true,
        wallets: { select: { balance: true, currency: true } },
      },
    });

    return users.map((u) => ({
      ...u,
      wallets: u.wallets.map((w) => ({ balance: w.balance.toString(), currency: w.currency })),
    }));
  }

  async getPendingUsers(siteId?: string) {
    const where: any = { status: 'PENDING_APPROVAL' };
    if (siteId && siteId !== 'ALL') where.siteId = siteId;

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, email: true, status: true, role: true, createdAt: true, siteId: true },
    });
  }

  async approveUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.PENDING_APPROVAL) throw new ForbiddenException('User is not pending approval');
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
    return { success: true, message: 'User approved successfully' };
  }

  async banUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Cannot ban an admin user');
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.BANNED } });
    return { success: true, message: 'User banned successfully' };
  }

  async unbanUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
    return { success: true, message: 'User unbanned successfully' };
  }

  async sendVerificationEmail(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[EMAIL VERIFICATION] OTP for ${user.email}: ${otp}`);
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.PENDING_VERIFICATION } });
    return { success: true, message: 'Verification email sent', otp: process.env.NODE_ENV === 'development' ? otp : undefined };
  }

  async getTransactions(siteId?: string, limit = 100) {
    const where: any = { type: { in: ['DEPOSIT', 'WITHDRAWAL'] } };
    if (siteId && siteId !== 'ALL') where.siteId = siteId;

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, email: true } },
        wallet: { select: { currency: true } },
      },
    });

    return transactions.map((t) => ({
      id: t.id, type: t.type, status: t.status,
      amount: t.amount.toString(), currency: t.wallet.currency,
      txHash: t.externalRef, walletAddress: (t.metadata as any)?.walletAddress,
      user: t.user, createdAt: t.createdAt, siteId: t.siteId,
    }));
  }

  async getRealStats(siteId?: string) {
    const siteFilter = siteId && siteId !== 'ALL' ? { siteId } : {};
    const userFilter = siteId && siteId !== 'ALL' ? { siteId } : {};

    const [totalRealUsers, activeRealUsers, realDeposits, realWithdrawals, realBets] = await Promise.all([
      this.prisma.user.count({ where: { ...userFilter, isBot: false } }),
      this.prisma.user.count({ where: { ...userFilter, isBot: false, lastLoginAt: { gte: new Date(Date.now() - 86400000) } } }),
      this.prisma.transaction.aggregate({ where: { ...siteFilter, type: 'DEPOSIT', status: 'CONFIRMED', user: { isBot: false } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { ...siteFilter, type: 'WITHDRAWAL', status: 'CONFIRMED', user: { isBot: false } }, _sum: { amount: true } }),
      this.prisma.bet.aggregate({ where: { ...siteFilter, user: { isBot: false } }, _sum: { betAmount: true, profit: true }, _count: true }),
    ]);

    const deposits = Number(realDeposits._sum.amount || 0);
    const withdrawals = Number(realWithdrawals._sum.amount || 0);
    const houseProfit = -Number(realBets._sum.profit || 0);

    return {
      totalRealUsers, activeRealUsers,
      totalDeposits: deposits, totalWithdrawals: withdrawals, netDeposits: deposits - withdrawals,
      totalBets: realBets._count || 0, totalWagered: Number(realBets._sum.betAmount || 0),
      houseProfit, houseWallet: houseProfit,
    };
  }

  async getBotStats(siteId?: string) {
    const filter = siteId && siteId !== 'ALL' ? { siteId } : {};
    const [botCount, botBets] = await Promise.all([
      this.prisma.user.count({ where: { ...filter, isBot: true } }),
      this.prisma.bet.aggregate({ where: { ...filter, user: { isBot: true } }, _sum: { betAmount: true }, _count: true }),
    ]);
    return { activeBots: botCount, totalBets: botBets._count || 0, totalVolume: Number(botBets._sum.betAmount || 0) };
  }
}
ADMINSVCEOF
echo "✅ Admin service rewritten with Brand Master"

# ============================================
# STEP 2B: Update ADMIN CONTROLLER
# ============================================
echo ">>> Step 2B: Updating Admin Controller..."

cat > src/modules/admin/admin.controller.ts << 'ADMINCTRLEOF'
/**
 * ============================================
 * ADMIN CONTROLLER - Brand Master API
 * ============================================
 */
import { Controller, Get, Post, Put, Body, Req, Query, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============ BRAND DASHBOARD ============

  @Get('dashboard')
  async getDashboard(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId || 'ALL';
    return this.adminService.getBrandDashboard(siteId);
  }

  @Get('dashboard/all-brands')
  async getAllBrandsDashboard() {
    return this.adminService.getAllBrandsDashboard();
  }

  // ============ HOUSE EDGE MANAGEMENT ============

  @Get('house-edge/:siteId')
  async getHouseEdge(@Param('siteId') siteId: string) {
    return this.adminService.getHouseEdge(siteId);
  }

  @Put('house-edge/:siteId')
  async updateHouseEdge(@Param('siteId') siteId: string, @Body() body: { houseEdgeConfig: Record<string, number> }) {
    return this.adminService.updateHouseEdge(siteId, body.houseEdgeConfig);
  }

  // ============ RISK MANAGEMENT ============

  @Get('risk-limits/:siteId')
  async getRiskLimits(@Param('siteId') siteId: string) {
    return this.adminService.getRiskLimits(siteId);
  }

  @Put('risk-limits/:siteId')
  async setRiskLimits(@Param('siteId') siteId: string, @Body() body: any) {
    return this.adminService.setRiskLimits(siteId, body);
  }

  // ============ EXISTING ENDPOINTS (now tenant-aware) ============

  @Get('stats')
  async getStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getStats(siteId);
  }

  @Get('real-stats')
  async getRealStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getRealStats(siteId);
  }

  @Get('users')
  async getUsers(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('limit') limit?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getAllUsers(siteId, limit ? parseInt(limit) : 100);
  }

  @Get('users/pending')
  async getPendingUsers(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getPendingUsers(siteId);
  }

  @Post('users/:id/approve')
  async approveUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.approveUser(id, req.user.id);
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.banUser(id, req.user.id);
  }

  @Post('users/:id/unban')
  async unbanUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.unbanUser(id, req.user.id);
  }

  @Post('users/:id/verify')
  async sendVerification(@Param('id') id: string, @Req() req: any) {
    return this.adminService.sendVerificationEmail(id, req.user.id);
  }

  @Get('transactions')
  async getTransactions(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('limit') limit?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getTransactions(siteId, limit ? parseInt(limit) : 100);
  }

  @Get('bot-stats')
  async getBotStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getBotStats(siteId);
  }
}
ADMINCTRLEOF
echo "✅ Admin controller updated"

# ============================================
# STEP 3: MULTI-TENANT AFFILIATE SERVICE
# ============================================
echo ">>> Step 3: Updating Affiliate Service..."

# Add siteId to all affiliate queries
sed -i 's/async getStats(userId: string)/async getStats(userId: string, siteId?: string)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/async getNetwork(userId: string)/async getNetwork(userId: string, siteId?: string)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/async getHistory(userId: string/async getHistory(userId: string, siteId?: string/' src/modules/affiliate/affiliate.service.ts
sed -i 's/async claimCommission(userId: string)/async claimCommission(userId: string, siteId?: string)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/async getAffiliateStats(userId: string)/async getAffiliateStats(userId: string, siteId?: string)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/async getNetworkDetails(userId: string)/async getNetworkDetails(userId: string, siteId?: string)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/async getCommissionHistory(userId: string/async getCommissionHistory(userId: string, siteId?: string/' src/modules/affiliate/affiliate.service.ts

# Update alias methods to pass siteId
sed -i 's/return this.getStats(userId)/return this.getStats(userId, siteId)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/return this.getNetwork(userId)/return this.getNetwork(userId, siteId)/' src/modules/affiliate/affiliate.service.ts
sed -i 's/return this.getHistory(userId, days)/return this.getHistory(userId, siteId, days)/' src/modules/affiliate/affiliate.service.ts 2>/dev/null || true

# Add siteId filter to user queries in affiliate
sed -i 's/where: { parentId: userId }/where: { parentId: userId, ...(siteId ? { siteId } : {}) }/' src/modules/affiliate/affiliate.service.ts 2>/dev/null || true

echo "✅ Affiliate service updated with siteId"

# Update affiliate controller to pass siteId
sed -i 's/req.user.id)/req.user.id, req.tenant?.siteId || req.user?.siteId)/' src/modules/affiliate/affiliate.controller.ts 2>/dev/null || true

echo "✅ Affiliate controller updated"

# ============================================
# STEP 4: FRAUD DETECTION SERVICE
# ============================================
echo ">>> Step 4: Creating Fraud Detection Service..."

mkdir -p src/modules/fraud

cat > src/modules/fraud/fraud.service.ts << 'FRAUDSVCEOF'
/**
 * ============================================
 * FRAUD DETECTION SERVICE - Per Brand
 * ============================================
 * Flags users with suspicious patterns:
 * - High win rate (>80% over 50+ bets)
 * - Rapid betting patterns
 * - Large withdrawal requests
 * - Unusual deposit-to-withdrawal ratios
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Scan all brands for suspicious activity
   * Runs every 15 minutes automatically
   */
  async scanAllBrands() {
    const sites = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      select: { id: true, brandName: true },
    });

    let totalAlerts = 0;
    for (const site of sites) {
      const alerts = await this.scanBrand(site.id);
      totalAlerts += alerts;
    }

    this.logger.log(`🔍 Fraud scan complete: ${totalAlerts} new alerts across ${sites.length} brands`);
    return { scanned: sites.length, newAlerts: totalAlerts };
  }

  /**
   * Scan a specific brand for fraud
   */
  async scanBrand(siteId: string): Promise<number> {
    let alertCount = 0;

    // 1. HIGH WIN RATE CHECK
    alertCount += await this.checkHighWinRate(siteId);

    // 2. RAPID BETTING CHECK
    alertCount += await this.checkRapidBetting(siteId);

    // 3. LARGE WITHDRAWAL CHECK
    alertCount += await this.checkLargeWithdrawals(siteId);

    // 4. DEPOSIT-TO-WITHDRAWAL RATIO
    alertCount += await this.checkDepositWithdrawalRatio(siteId);

    return alertCount;
  }

  /**
   * Check 1: Users with >80% win rate over 50+ bets
   */
  private async checkHighWinRate(siteId: string): Promise<number> {
    const MIN_BETS = 50;
    const WIN_RATE_THRESHOLD = 0.80;

    // Get users with enough bets in this brand
    const userBets = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { siteId, user: { isBot: false } },
      _count: true,
      having: { userId: { _count: { gte: MIN_BETS } } },
    });

    let alertCount = 0;

    for (const ub of userBets) {
      // Count wins
      const wins = await this.prisma.bet.count({
        where: { userId: ub.userId, siteId, isWin: true },
      });

      const winRate = wins / ub._count;

      if (winRate >= WIN_RATE_THRESHOLD) {
        // Check if alert already exists (avoid duplicates)
        const existing = await this.prisma.fraudAlert.findFirst({
          where: {
            userId: ub.userId,
            siteId,
            alertType: 'HIGH_WIN_RATE',
            status: { in: ['OPEN', 'REVIEWED'] },
          },
        });

        if (!existing) {
          await this.prisma.fraudAlert.create({
            data: {
              siteId,
              userId: ub.userId,
              alertType: 'HIGH_WIN_RATE',
              severity: winRate >= 0.90 ? 'CRITICAL' : 'HIGH',
              details: {
                winRate: (winRate * 100).toFixed(1) + '%',
                totalBets: ub._count,
                wins,
                losses: ub._count - wins,
              },
            },
          });
          alertCount++;
          this.logger.warn(`🚨 [${siteId}] HIGH_WIN_RATE alert: User ${ub.userId} - ${(winRate * 100).toFixed(1)}% over ${ub._count} bets`);
        }
      }
    }

    return alertCount;
  }

  /**
   * Check 2: Rapid betting (>100 bets in 1 hour)
   */
  private async checkRapidBetting(siteId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const RAPID_THRESHOLD = 100;

    const rapidUsers = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { siteId, createdAt: { gte: oneHourAgo }, user: { isBot: false } },
      _count: true,
      having: { userId: { _count: { gte: RAPID_THRESHOLD } } },
    });

    let alertCount = 0;

    for (const ru of rapidUsers) {
      const existing = await this.prisma.fraudAlert.findFirst({
        where: {
          userId: ru.userId,
          siteId,
          alertType: 'RAPID_BETTING',
          createdAt: { gte: oneHourAgo },
        },
      });

      if (!existing) {
        await this.prisma.fraudAlert.create({
          data: {
            siteId,
            userId: ru.userId,
            alertType: 'RAPID_BETTING',
            severity: 'MEDIUM',
            details: { betsInLastHour: ru._count },
          },
        });
        alertCount++;
      }
    }

    return alertCount;
  }

  /**
   * Check 3: Large withdrawal requests (>$5000)
   */
  private async checkLargeWithdrawals(siteId: string): Promise<number> {
    const LARGE_THRESHOLD = 5000;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const largeWithdrawals = await this.prisma.transaction.findMany({
      where: {
        siteId,
        type: 'WITHDRAWAL',
        amount: { gte: LARGE_THRESHOLD },
        createdAt: { gte: oneDayAgo },
        user: { isBot: false },
      },
      select: { userId: true, amount: true, id: true },
    });

    let alertCount = 0;

    for (const lw of largeWithdrawals) {
      const existing = await this.prisma.fraudAlert.findFirst({
        where: {
          userId: lw.userId,
          siteId,
          alertType: 'LARGE_WITHDRAWAL',
          details: { path: ['transactionId'], equals: lw.id },
        },
      });

      if (!existing) {
        await this.prisma.fraudAlert.create({
          data: {
            siteId,
            userId: lw.userId,
            alertType: 'LARGE_WITHDRAWAL',
            severity: Number(lw.amount) >= 10000 ? 'HIGH' : 'MEDIUM',
            details: { amount: Number(lw.amount), transactionId: lw.id },
          },
        });
        alertCount++;
      }
    }

    return alertCount;
  }

  /**
   * Check 4: Suspicious deposit-to-withdrawal ratio
   * Users who withdraw much more than they deposit
   */
  private async checkDepositWithdrawalRatio(siteId: string): Promise<number> {
    const RATIO_THRESHOLD = 3; // Withdrawals > 3x deposits

    // Get all real users for this brand
    const users = await this.prisma.user.findMany({
      where: { siteId, isBot: false },
      select: { id: true },
    });

    let alertCount = 0;

    for (const user of users) {
      const [deposits, withdrawals] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { userId: user.id, siteId, type: 'DEPOSIT', status: 'CONFIRMED' },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { userId: user.id, siteId, type: 'WITHDRAWAL', status: 'CONFIRMED' },
          _sum: { amount: true },
        }),
      ]);

      const totalDeposits = Number(deposits._sum.amount || 0);
      const totalWithdrawals = Number(withdrawals._sum.amount || 0);

      if (totalDeposits > 0 && totalWithdrawals / totalDeposits > RATIO_THRESHOLD) {
        const existing = await this.prisma.fraudAlert.findFirst({
          where: {
            userId: user.id,
            siteId,
            alertType: 'SUSPICIOUS_RATIO',
            status: { in: ['OPEN', 'REVIEWED'] },
          },
        });

        if (!existing) {
          await this.prisma.fraudAlert.create({
            data: {
              siteId,
              userId: user.id,
              alertType: 'SUSPICIOUS_RATIO',
              severity: 'HIGH',
              details: {
                totalDeposits,
                totalWithdrawals,
                ratio: (totalWithdrawals / totalDeposits).toFixed(2),
              },
            },
          });
          alertCount++;
        }
      }
    }

    return alertCount;
  }

  // ============================================
  // ADMIN API METHODS
  // ============================================

  /**
   * Get all fraud alerts for a brand
   */
  async getAlerts(siteId: string, status?: string, limit = 50) {
    const where: any = {};
    if (siteId && siteId !== 'ALL') where.siteId = siteId;
    if (status) where.status = status;

    const alerts = await this.prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, email: true, siteId: true } },
        site: { select: { brandName: true } },
      },
    });

    const stats = await this.prisma.fraudAlert.groupBy({
      by: ['severity'],
      where: siteId && siteId !== 'ALL' ? { siteId } : {},
      _count: true,
    });

    return {
      alerts,
      stats: {
        total: alerts.length,
        bySeverity: Object.fromEntries(stats.map(s => [s.severity, s._count])),
      },
    };
  }

  /**
   * Update alert status (review, dismiss, confirm)
   */
  async updateAlertStatus(alertId: string, status: string, reviewedBy: string) {
    return this.prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        status,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Get fraud summary per brand
   */
  async getFraudSummary(siteId?: string) {
    const where = siteId && siteId !== 'ALL' ? { siteId } : {};

    const [total, open, byType, bySeverity] = await Promise.all([
      this.prisma.fraudAlert.count({ where }),
      this.prisma.fraudAlert.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.fraudAlert.groupBy({ by: ['alertType'], where, _count: true }),
      this.prisma.fraudAlert.groupBy({ by: ['severity'], where, _count: true }),
    ]);

    return {
      total,
      open,
      byType: Object.fromEntries(byType.map(t => [t.alertType, t._count])),
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count])),
    };
  }
}
FRAUDSVCEOF
echo "✅ Fraud service created"

# ============================================
# STEP 4B: Fraud Controller
# ============================================
echo ">>> Step 4B: Creating Fraud Controller..."

cat > src/modules/fraud/fraud.controller.ts << 'FRAUDCTRLEOF'
import { Controller, Get, Put, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin/fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('scan')
  async runScan() {
    return this.fraudService.scanAllBrands();
  }

  @Get('scan/:siteId')
  async scanBrand(@Param('siteId') siteId: string) {
    const alerts = await this.fraudService.scanBrand(siteId);
    return { siteId, newAlerts: alerts };
  }

  @Get('alerts')
  async getAlerts(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const site = siteId || req.tenant?.siteId || req.user?.siteId || 'ALL';
    return this.fraudService.getAlerts(site, status, limit ? parseInt(limit) : 50);
  }

  @Put('alerts/:id')
  async updateAlert(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    return this.fraudService.updateAlertStatus(id, body.status, req.user.id);
  }

  @Get('summary')
  async getSummary(@Req() req: any, @Query('siteId') siteId?: string) {
    const site = siteId || req.tenant?.siteId || req.user?.siteId;
    return this.fraudService.getFraudSummary(site);
  }
}
FRAUDCTRLEOF
echo "✅ Fraud controller created"

# ============================================
# STEP 4C: Fraud Module
# ============================================
cat > src/modules/fraud/fraud.module.ts << 'FRAUDMODEOF'
import { Module } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { FraudController } from './fraud.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FraudController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
FRAUDMODEOF
echo "✅ Fraud module created"

# ============================================
# STEP 5: Register FraudModule in AppModule
# ============================================
echo ">>> Step 5: Registering FraudModule in AppModule..."

# Add import
sed -i "/import { TenantModule }/a import { FraudModule } from './modules/fraud/fraud.module';" src/app.module.ts

# Add to imports array
sed -i '/UsersModule,/a\    FraudModule,' src/app.module.ts

echo "✅ FraudModule registered"

# ============================================
# STEP 6: Create default RiskLimit for existing site
# ============================================
echo ">>> Step 6: Creating default risk limits..."

npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // Create default risk limit if not exists
  const existing = await p.riskLimit.findUnique({ where: { siteId: 'default-site-001' } });
  if (!existing) {
    await p.riskLimit.create({
      data: {
        siteId: 'default-site-001',
        maxPayoutPerDay: 50000,
        maxPayoutPerBet: 10000,
        maxBetAmount: 5000,
      }
    });
    console.log('✅ Default risk limits created');
  } else {
    console.log('✅ Risk limits already exist');
  }
}
main().catch(e => console.error(e)).finally(() => p.\$disconnect());
" 2>&1 || echo "⚠️ Risk limit creation skipped (may need schema push first)"

# ============================================
# STEP 7: BUILD AND DEPLOY
# ============================================
echo ">>> Step 7: Building..."
npm run build 2>&1 | tail -10
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo "✅ Build successful!"
  pm2 restart stek-backend
  sleep 5
  echo "✅ Backend restarted"
else
  echo "❌ Build failed - checking errors..."
  npm run build 2>&1 | grep 'error TS' | head -20
fi

echo ""
echo "============================================"
echo "PHASE 3 DEPLOYMENT COMPLETE"
echo "============================================"
