'use strict';

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { VIP_TIERS, calculateVipLevel, getRakebackRate } from '../users/vip.config';

/**
 * ============================================
 * VIP SERVICE
 * ============================================
 * Handles:
 * 1. processRakeback(userId, betAmount, houseEdge) — accumulates rakeback
 * 2. checkLevelUp(userId) — promotes VIP level based on totalWagered
 * 3. claimRakeback(userId) — transfers claimableRakeback to wallet
 * 4. updateUserStats(userId, betAmount) — increments totalWagered + totalBets
 * ============================================
 */

@Injectable()
export class VipService {
  private readonly logger = new Logger(VipService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update user wagering stats after every bet.
   * Called from the game service immediately after a bet is placed/settled.
   */
  async updateUserStats(userId: string, betAmount: number): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          totalWagered: { increment: betAmount },
          totalBets: { increment: 1 },
        },
      });
      this.logger.debug(`📊 Stats updated for ${userId}: +$${betAmount.toFixed(2)} wagered, +1 bet`);
    } catch (error) {
      this.logger.error(`Failed to update stats for ${userId}: ${error.message}`);
    }
  }

  /**
   * Check if user should level up based on their totalWagered.
   * Automatically promotes the user if they qualify for a higher tier.
   */
  async checkLevelUp(userId: string): Promise<{ leveledUp: boolean; newLevel: number; tierName: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { vipLevel: true, totalWagered: true, isBot: true },
      });

      if (!user || user.isBot) {
        return { leveledUp: false, newLevel: 0, tierName: 'Bronze' };
      }

      const totalWagered = Number(user.totalWagered);
      const newLevel = calculateVipLevel(totalWagered);

      if (newLevel > user.vipLevel) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { vipLevel: newLevel },
        });

        const tierName = VIP_TIERS[newLevel]?.name || 'Unknown';
        this.logger.log(
          `🎉 VIP LEVEL UP! User ${userId}: Level ${user.vipLevel} → ${newLevel} (${tierName}) | Wagered: $${totalWagered.toLocaleString()}`,
        );

        return { leveledUp: true, newLevel, tierName };
      }

      return { leveledUp: false, newLevel: user.vipLevel, tierName: VIP_TIERS[user.vipLevel]?.name || 'Bronze' };
    } catch (error) {
      this.logger.error(`Failed to check level up for ${userId}: ${error.message}`);
      return { leveledUp: false, newLevel: 0, tierName: 'Bronze' };
    }
  }

  /**
   * Process rakeback for a settled bet.
   * Rakeback = betAmount × houseEdge × userVIPRate
   * 
   * This does NOT auto-credit to wallet. It accumulates in claimableRakeback.
   * The user must explicitly claim it via claimRakeback().
   */
  async processRakeback(userId: string, betAmount: number, houseEdge: number): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { vipLevel: true, isBot: true },
      });

      if (!user || user.isBot) return;

      const rakebackRate = getRakebackRate(user.vipLevel);
      if (rakebackRate <= 0) return;

      // Rakeback = betAmount × houseEdge × VIP rakeback rate
      // Example: $100 bet × 0.04 house edge × 0.05 (5% Bronze) = $0.20 rakeback
      const rakebackAmount = betAmount * houseEdge * rakebackRate;

      if (rakebackAmount <= 0) return;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          claimableRakeback: { increment: rakebackAmount },
        },
      });

      this.logger.debug(
        `💎 Rakeback: ${userId} earned $${rakebackAmount.toFixed(6)} (bet: $${betAmount.toFixed(2)}, edge: ${(houseEdge * 100).toFixed(1)}%, rate: ${(rakebackRate * 100).toFixed(0)}%)`,
      );
    } catch (error) {
      this.logger.error(`Failed to process rakeback for ${userId}: ${error.message}`);
    }
  }

  /**
   * Claim accumulated rakeback — transfers claimableRakeback to user's USDT wallet.
   * Resets claimableRakeback to 0 after successful claim.
   */
  async claimRakeback(userId: string, siteId?: string): Promise<{ success: boolean; amount: number; message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { claimableRakeback: true, siteId: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      const claimable = Number(user.claimableRakeback || 0);

      if (claimable <= 0) {
        throw new BadRequestException('No rakeback available to claim');
      }

      const effectiveSiteId = siteId || user.siteId;

      // Atomic transaction: reset claimable + credit wallet
      await this.prisma.$transaction(async (tx) => {
        // Reset claimable rakeback
        await tx.user.update({
          where: { id: userId },
          data: { claimableRakeback: new Decimal(0) },
        });

        // Credit to USDT wallet
        const wallet = await tx.wallet.findFirst({
          where: {
            userId,
            currency: 'USDT',
            ...(effectiveSiteId ? { siteId: effectiveSiteId } : {}),
          },
        });

        if (!wallet) {
          throw new BadRequestException('No USDT wallet found');
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: claimable },
          },
        });
      });

      this.logger.log(`💰 Rakeback claimed: ${userId} received $${claimable.toFixed(2)}`);

      return {
        success: true,
        amount: claimable,
        message: `Successfully claimed $${claimable.toFixed(2)} rakeback to your wallet!`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to claim rakeback for ${userId}: ${error.message}`);
      throw new BadRequestException('Failed to claim rakeback');
    }
  }

  /**
   * Get VIP status for a user (used by frontend)
   */
  async getVipStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        vipLevel: true,
        totalWagered: true,
        totalBets: true,
        claimableRakeback: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const currentTier = VIP_TIERS[user.vipLevel] || VIP_TIERS[0];
    const nextTier = user.vipLevel < VIP_TIERS.length - 1 ? VIP_TIERS[user.vipLevel + 1] : null;
    const totalWagered = Number(user.totalWagered);

    return {
      level: user.vipLevel,
      tierName: currentTier.name,
      icon: currentTier.icon,
      rakebackRate: `${(currentTier.rakebackRate * 100).toFixed(0)}%`,
      totalWagered,
      totalBets: user.totalBets,
      claimableRakeback: Number(user.claimableRakeback || 0),
      nextTier: nextTier
        ? {
            name: nextTier.name,
            icon: nextTier.icon,
            minWager: nextTier.minWager,
            wagerRemaining: Math.max(0, nextTier.minWager - totalWagered),
            progress: Math.min((totalWagered / nextTier.minWager) * 100, 100),
          }
        : null,
    };
  }
}
