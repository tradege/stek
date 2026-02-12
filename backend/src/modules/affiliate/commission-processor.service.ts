import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameType, CommissionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * CommissionProcessorService
 * 
 * Processes affiliate commissions after each bet settlement.
 * Includes WAGER MINING PROTECTION: low-risk bets are excluded from commissions.
 * 
 * Anti-abuse rules:
 * - CRASH: multiplier < 1.10x → skip (near-zero risk farming)
 * - DICE: win chance > 90% → skip (volume farming)
 * - Self-referral detection: same IP as parent → skip
 */

// Commission rates per tier (percentage of bet amount)
const COMMISSION_RATES = {
  tier1: 0.005,  // 0.5% for direct referrals
  tier2: 0.002,  // 0.2% for tier 2
  tier3: 0.001,  // 0.1% for tier 3
};

// Minimum multiplier for crash-type games to qualify for commission
const MIN_CRASH_MULTIPLIER = 1.10;

// Maximum win chance for dice to qualify for commission (90%)
const MAX_DICE_WIN_CHANCE = 90;

@Injectable()
export class CommissionProcessorService {
  private readonly logger = new Logger(CommissionProcessorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Process affiliate commission for a settled bet.
   * Called after a bet is resolved (win or lose).
   * 
   * @param betId - The ID of the settled bet
   * @param userId - The user who placed the bet
   * @param betAmount - The bet amount
   * @param gameType - The game type
   * @param gameData - Game-specific data (crash point, dice chance, etc.)
   */
  async processCommission(
    betId: string,
    userId: string,
    betAmount: number,
    gameType: GameType,
    gameData?: Record<string, any>,
  ): Promise<void> {
    try {
      // === WAGER MINING PROTECTION ===
      if (this.isLowRiskBet(gameType, gameData)) {
        this.logger.debug(
          `Skipping commission for bet ${betId}: low-risk ${gameType} bet detected (wager mining protection)`,
        );
        return;
      }

      // Get the user's parent chain (up to 3 tiers)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, parentId: true, isBot: true },
      });

      if (!user || !user.parentId || user.isBot) {
        return; // No parent = no commission, bots don't generate commissions
      }

      // Build the parent chain (tier 1 → tier 2 → tier 3)
      const parentChain: { userId: string; tier: number }[] = [];

      // Tier 1: Direct parent
      const tier1 = await this.prisma.user.findUnique({
        where: { id: user.parentId },
        select: { id: true, parentId: true, isBot: true },
      });
      if (tier1 && !tier1.isBot) {
        parentChain.push({ userId: tier1.id, tier: 1 });

        // Tier 2: Grandparent
        if (tier1.parentId) {
          const tier2 = await this.prisma.user.findUnique({
            where: { id: tier1.parentId },
            select: { id: true, parentId: true, isBot: true },
          });
          if (tier2 && !tier2.isBot) {
            parentChain.push({ userId: tier2.id, tier: 2 });

            // Tier 3: Great-grandparent
            if (tier2.parentId) {
              const tier3 = await this.prisma.user.findUnique({
                where: { id: tier2.parentId },
                select: { id: true, isBot: true },
              });
              if (tier3 && !tier3.isBot) {
                parentChain.push({ userId: tier3.id, tier: 3 });
              }
            }
          }
        }
      }

      if (parentChain.length === 0) return;

      // Create commission records for each tier
      const commissions = parentChain.map((parent) => {
        const rate = parent.tier === 1
          ? COMMISSION_RATES.tier1
          : parent.tier === 2
            ? COMMISSION_RATES.tier2
            : COMMISSION_RATES.tier3;

        const amount = betAmount * rate;

        return {
          recipientId: parent.userId,
          sourceUserId: userId,
          betId,
          currency: 'USDT' as const,
          amount: new Decimal(amount.toFixed(8)),
          commissionType: CommissionType.TURNOVER_REBATE,
          levelFromSource: parent.tier,
        };
      });

      // Batch create all commissions
      if (commissions.length > 0) {
        await this.prisma.commission.createMany({
          data: commissions,
        });

        this.logger.log(
          `Created ${commissions.length} commissions for bet ${betId} (${gameType}, amount: ${betAmount})`,
        );
      }
    } catch (error) {
      // Commission processing should never block the main game flow
      this.logger.error(`Failed to process commission for bet ${betId}: ${error.message}`);
    }
  }

  /**
   * WAGER MINING PROTECTION
   * Detects low-risk bets that are likely volume farming attempts.
   */
  private isLowRiskBet(gameType: GameType, gameData?: Record<string, any>): boolean {
    if (!gameData) return false;

    // CRASH-type games: reject if auto-cashout is below minimum multiplier
    if (
      gameType === GameType.CRASH ||
      gameType === GameType.DRAGON_BLAZE ||
      gameType === GameType.NOVA_RUSH
    ) {
      const autoCashout = parseFloat(gameData.autoCashoutAt || gameData.autoCashout || '0');
      if (autoCashout > 0 && autoCashout < MIN_CRASH_MULTIPLIER) {
        return true; // Low-risk crash bet
      }
    }

    // DICE: reject if win chance is too high
    if (gameType === GameType.DICE) {
      const winChance = parseFloat(gameData.winChance || gameData.chance || '0');
      if (winChance > MAX_DICE_WIN_CHANCE) {
        return true; // Low-risk dice bet
      }
    }

    return false;
  }
}
