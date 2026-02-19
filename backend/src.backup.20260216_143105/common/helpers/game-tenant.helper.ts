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
