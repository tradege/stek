'use strict';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionType, GameType } from '@prisma/client';

// ============================================
// AFFILIATE COMMISSION PROCESSOR
// Revenue Share (Loss-Based) Model
// ============================================
// Commission = UserNetLoss * TierRate
// Tiers fetched dynamically from SiteConfiguration.affiliateConfig
// Negative Carryover: If player wins, deduct from agent's future earnings
// ============================================

const MIN_CRASH_MULTIPLIER = 1.10;
const MAX_DICE_WIN_CHANCE = 90;

// Default affiliate tier rates (used when DB config is not set)
const DEFAULT_AFFILIATE_CONFIG = {
  model: 'REVENUE_SHARE',
  tiers: {
    bronze:   { minPlayers: 5,   tier1Rate: 0.05, tier2Rate: 0.02, tier3Rate: 0.01 },
    silver:   { minPlayers: 7,   tier1Rate: 0.07, tier2Rate: 0.03, tier3Rate: 0.015 },
    gold:     { minPlayers: 10,  tier1Rate: 0.10, tier2Rate: 0.04, tier3Rate: 0.02 },
    platinum: { minPlayers: 15,  tier1Rate: 0.12, tier2Rate: 0.05, tier3Rate: 0.025 },
    diamond:  { minPlayers: 20,  tier1Rate: 0.15, tier2Rate: 0.06, tier3Rate: 0.03 },
    iron:     { minPlayers: 25,  tier1Rate: 0.20, tier2Rate: 0.08, tier3Rate: 0.04 },
  },
};

interface AffiliateConfig {
  model: string;
  tiers: Record<string, {
    minPlayers: number;
    tier1Rate: number;
    tier2Rate: number;
    tier3Rate: number;
  }>;
}

@Injectable()
export class CommissionProcessorService {
  private readonly logger = new Logger(CommissionProcessorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Process affiliate commission for a settled bet.
   * Revenue Share model: commission is based on player's NET LOSS (bet - payout).
   * If player wins (negative net loss), the loss is carried over to reduce future commissions.
   */
  async processCommission(
    betId: string,
    userId: string,
    betAmount: number,
    payout: number,
    gameType: GameType,
    siteId?: string,
    gameData?: Record<string, any>,
  ): Promise<void> {
    try {
      // === WAGER MINING PROTECTION ===
      if (this.isLowRiskBet(gameType, gameData)) {
        this.logger.debug(
          `Skipping commission for bet ${betId}: low-risk ${gameType} bet detected`,
        );
        return;
      }

      // Calculate NET LOSS: positive = house won, negative = player won
      const netLoss = betAmount - payout;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, parentId: true, isBot: true, siteId: true },
      });

      if (!user || !user.parentId || user.isBot) return;

      const effectiveSiteId = siteId || user.siteId;
      const affiliateConfig = await this.getAffiliateConfig(effectiveSiteId);
      const parentChain = await this.buildParentChain(user.parentId);

      if (parentChain.length === 0) return;

      for (const parent of parentChain) {
        await this.processParentCommission(
          parent, userId, betId, netLoss, gameType, affiliateConfig,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to process commission for bet ${betId}: ${error.message}`);
    }
  }

  /**
   * Process commission for a single parent in the chain.
   * Handles negative carryover logic.
   */
  private async processParentCommission(
    parent: { userId: string; tier: number },
    sourceUserId: string,
    betId: string,
    netLoss: number,
    gameType: GameType,
    config: AffiliateConfig,
  ): Promise<void> {
    // Get the parent's referral count to determine their rank
    const referralCount = await this.prisma.user.count({
      where: { parentId: parent.userId },
    });

    const rank = this.getRankByPlayerCount(referralCount, config);
    const rate = this.getTierRate(rank, parent.tier, config);
    if (rate <= 0) return;

    // Get current carryover balance
    const parentUser = await this.prisma.user.findUnique({
      where: { id: parent.userId },
      select: { affiliateCarryover: true },
    });

    const currentCarryover = parentUser?.affiliateCarryover
      ? Number(parentUser.affiliateCarryover)
      : 0;

    // Apply carryover to net loss
    const effectiveNetLoss = netLoss + currentCarryover;

    if (effectiveNetLoss <= 0) {
      // Player is still in profit - no commission, update carryover
      await this.prisma.user.update({
        where: { id: parent.userId },
        data: { affiliateCarryover: new Decimal(effectiveNetLoss.toFixed(8)) },
      });
      this.logger.debug(
        `No commission for ${parent.userId} (tier ${parent.tier}): player in profit. Carryover: ${effectiveNetLoss.toFixed(2)}`,
      );
      return;
    }

    // Positive net loss - calculate commission
    const commissionAmount = effectiveNetLoss * rate;

    // Reset carryover since we consumed it
    if (currentCarryover !== 0) {
      await this.prisma.user.update({
        where: { id: parent.userId },
        data: { affiliateCarryover: new Decimal(0) },
      });
    }

    // Create commission record
    await this.prisma.commission.create({
      data: {
        recipientId: parent.userId,
        sourceUserId,
        betId,
        currency: 'USDT',
        amount: new Decimal(commissionAmount.toFixed(8)),
        commissionType: CommissionType.REVENUE_SHARE,
        levelFromSource: parent.tier,
      },
    });

    this.logger.log(
      `RevShare: ${parent.userId} (tier ${parent.tier}, rank: ${rank}) earned $${commissionAmount.toFixed(4)} from bet ${betId} (netLoss: ${netLoss.toFixed(2)}, rate: ${(rate * 100).toFixed(1)}%)`,
    );
  }

  /**
   * Build the parent chain up to 3 tiers.
   */
  private async buildParentChain(parentId: string): Promise<{ userId: string; tier: number }[]> {
    const chain: { userId: string; tier: number }[] = [];

    const tier1 = await this.prisma.user.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, isBot: true },
    });
    if (!tier1 || tier1.isBot) return chain;
    chain.push({ userId: tier1.id, tier: 1 });

    if (tier1.parentId) {
      const tier2 = await this.prisma.user.findUnique({
        where: { id: tier1.parentId },
        select: { id: true, parentId: true, isBot: true },
      });
      if (tier2 && !tier2.isBot) {
        chain.push({ userId: tier2.id, tier: 2 });
        if (tier2.parentId) {
          const tier3 = await this.prisma.user.findUnique({
            where: { id: tier2.parentId },
            select: { id: true, isBot: true },
          });
          if (tier3 && !tier3.isBot) {
            chain.push({ userId: tier3.id, tier: 3 });
          }
        }
      }
    }

    return chain;
  }

  /**
   * Fetch affiliate configuration from SiteConfiguration.
   */
  private async getAffiliateConfig(siteId?: string): Promise<AffiliateConfig> {
    try {
      const site = siteId
        ? await this.prisma.siteConfiguration.findUnique({
            where: { id: siteId },
            select: { affiliateConfig: true },
          })
        : await this.prisma.siteConfiguration.findFirst({
            where: { active: true },
            select: { affiliateConfig: true },
          });

      if (site?.affiliateConfig) {
        return site.affiliateConfig as unknown as AffiliateConfig;
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch affiliate config: ${error.message}`);
    }
    return DEFAULT_AFFILIATE_CONFIG;
  }

  /**
   * Determine rank based on number of referred players.
   */
  private getRankByPlayerCount(playerCount: number, config: AffiliateConfig): string {
    const sortedRanks = Object.entries(config.tiers).sort(
      (a, b) => b[1].minPlayers - a[1].minPlayers,
    );
    for (const [rankName, rankConfig] of sortedRanks) {
      if (playerCount >= rankConfig.minPlayers) {
        return rankName;
      }
    }
    return Object.keys(config.tiers)[0] || 'bronze';
  }

  /**
   * Get the commission rate for a specific rank and tier level.
   */
  private getTierRate(rank: string, tierLevel: number, config: AffiliateConfig): number {
    const rankConfig = config.tiers[rank];
    if (!rankConfig) return 0;
    switch (tierLevel) {
      case 1: return rankConfig.tier1Rate;
      case 2: return rankConfig.tier2Rate;
      case 3: return rankConfig.tier3Rate;
      default: return 0;
    }
  }

  /**
   * WAGER MINING PROTECTION
   */
  private isLowRiskBet(gameType: GameType, gameData?: Record<string, any>): boolean {
    if (!gameData) return false;
    if (
      gameType === GameType.CRASH ||
      gameType === GameType.DRAGON_BLAZE ||
      gameType === GameType.NOVA_RUSH
    ) {
      const autoCashout = parseFloat(gameData.autoCashoutAt || gameData.autoCashout || '0');
      if (autoCashout > 0 && autoCashout < MIN_CRASH_MULTIPLIER) return true;
    }
    if (gameType === GameType.DICE) {
      const winChance = parseFloat(gameData.winChance || gameData.chance || '0');
      if (winChance > MAX_DICE_WIN_CHANCE) return true;
    }
    return false;
  }
}
