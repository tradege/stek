'use strict';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { getRakebackRate, getVipTier } from '../users/vip.config';

/**
 * ============================================
 * REWARD POOL SERVICE — Tenant-Isolated
 * ============================================
 *
 * Every method now accepts siteId parameter.
 * Each tenant (White Label) has its own:
 *   - RewardPool balance
 *   - RewardPoolSettings
 *   - RewardHistory
 *   - RewardPoolContribution
 *   - Top players leaderboard
 *
 * Root (siteId='1') sees only its own data.
 * White Labels see only their own data.
 * ============================================
 */

const DEFAULT_SETTINGS = {
  poolContributionRate: 0.05,
  weeklyPoolPercent: 0.60,
  monthlyPoolPercent: 0.40,
  firstPlacePercent: 0.50,
  secondPlacePercent: 0.30,
  thirdPlacePercent: 0.20,
  weeklyPoolCap: 500,
  monthlyPoolCap: 2000,
  minWageringForBonus: 10,
  weeklyCooldownHours: 144,
  monthlyCooldownHours: 648,
  topPlayersCount: 3,
  weeklyBonusEnabled: true,
  monthlyBonusEnabled: true,
};

const MIN_DISTRIBUTION_AMOUNT = 0.01;
const SUPER_ADMIN_EMAIL = 'marketedgepros@gmail.com';

@Injectable()
export class RewardPoolService {
  private readonly logger = new Logger(RewardPoolService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // SETTINGS MANAGEMENT (tenant-isolated)
  // ============================================

  async getSettings(siteId?: string) {
    try {
      const effectiveSiteId = siteId || '1';
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "RewardPoolSettings" WHERE "siteId" = $1 LIMIT 1`,
        effectiveSiteId,
      );
      if (rows && rows.length > 0) {
        const s = rows[0];
        return {
          id: s.id,
          weeklyBonusEnabled: s.weeklyBonusEnabled,
          monthlyBonusEnabled: s.monthlyBonusEnabled,
          poolContributionRate: Number(s.poolContributionRate),
          weeklyPoolPercent: Number(s.weeklyPoolPercent),
          monthlyPoolPercent: Number(s.monthlyPoolPercent),
          firstPlacePercent: Number(s.firstPlacePercent),
          secondPlacePercent: Number(s.secondPlacePercent),
          thirdPlacePercent: Number(s.thirdPlacePercent),
          weeklyPoolCap: Number(s.weeklyPoolCap),
          monthlyPoolCap: Number(s.monthlyPoolCap),
          minWageringForBonus: Number(s.minWageringForBonus),
          weeklyCooldownHours: Number(s.weeklyCooldownHours),
          monthlyCooldownHours: Number(s.monthlyCooldownHours),
          topPlayersCount: Number(s.topPlayersCount),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      this.logger.error(`Failed to load settings: ${error.message}`);
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(body: any, siteId?: string) {
    try {
      const effectiveSiteId = siteId || '1';
      const existing = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "RewardPoolSettings" WHERE "siteId" = $1 LIMIT 1`,
        effectiveSiteId,
      );

      if (existing && existing.length > 0) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "RewardPoolSettings" SET
            "weeklyBonusEnabled" = $1,
            "monthlyBonusEnabled" = $2,
            "poolContributionRate" = $3,
            "weeklyPoolPercent" = $4,
            "monthlyPoolPercent" = $5,
            "firstPlacePercent" = $6,
            "secondPlacePercent" = $7,
            "thirdPlacePercent" = $8,
            "weeklyPoolCap" = $9,
            "monthlyPoolCap" = $10,
            "minWageringForBonus" = $11,
            "weeklyCooldownHours" = $12,
            "monthlyCooldownHours" = $13,
            "topPlayersCount" = $14,
            "updatedAt" = NOW()
          WHERE id = $15`,
          body.weeklyBonusEnabled ?? true,
          body.monthlyBonusEnabled ?? true,
          body.poolContributionRate ?? 0.05,
          body.weeklyPoolPercent ?? 0.60,
          body.monthlyPoolPercent ?? 0.40,
          body.firstPlacePercent ?? 0.50,
          body.secondPlacePercent ?? 0.30,
          body.thirdPlacePercent ?? 0.20,
          body.weeklyPoolCap ?? 500,
          body.monthlyPoolCap ?? 2000,
          body.minWageringForBonus ?? 10,
          body.weeklyCooldownHours ?? 144,
          body.monthlyCooldownHours ?? 648,
          body.topPlayersCount ?? 3,
          existing[0].id,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "RewardPoolSettings" (
            "id", "siteId", "weeklyBonusEnabled", "monthlyBonusEnabled",
            "poolContributionRate", "weeklyPoolPercent", "monthlyPoolPercent",
            "firstPlacePercent", "secondPlacePercent", "thirdPlacePercent",
            "weeklyPoolCap", "monthlyPoolCap", "minWageringForBonus",
            "weeklyCooldownHours", "monthlyCooldownHours", "topPlayersCount",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
          )`,
          effectiveSiteId,
          body.weeklyBonusEnabled ?? true,
          body.monthlyBonusEnabled ?? true,
          body.poolContributionRate ?? 0.05,
          body.weeklyPoolPercent ?? 0.60,
          body.monthlyPoolPercent ?? 0.40,
          body.firstPlacePercent ?? 0.50,
          body.secondPlacePercent ?? 0.30,
          body.thirdPlacePercent ?? 0.20,
          body.weeklyPoolCap ?? 500,
          body.monthlyPoolCap ?? 2000,
          body.minWageringForBonus ?? 10,
          body.weeklyCooldownHours ?? 144,
          body.monthlyCooldownHours ?? 648,
          body.topPlayersCount ?? 3,
        );
      }

      return { success: true, message: 'Settings updated successfully' };
    } catch (error) {
      this.logger.error(`Failed to update settings: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // POOL CONTRIBUTION (tenant-isolated)
  // ============================================

  async contributeToPool(
    userId: string,
    betId: string | null,
    betAmount: number,
    houseEdge: number,
    gameType: string,
    siteId?: string,
  ): Promise<void> {
    try {
      if (betAmount <= 0 || houseEdge <= 0) return;
      const effectiveSiteId = siteId || '1';

      const settings = await this.getSettings(effectiveSiteId);
      const contribution = betAmount * houseEdge * settings.poolContributionRate;
      if (contribution <= 0) return;

      // Ensure pool exists for this site
      await this._ensurePool(effectiveSiteId);

      await this.prisma.$transaction([
        this.prisma.$executeRawUnsafe(
          `UPDATE "RewardPool" SET "currentBalance" = "currentBalance" + $1, "totalAccumulated" = "totalAccumulated" + $1, "updatedAt" = NOW() WHERE "siteId" = $2`,
          contribution,
          effectiveSiteId,
        ),
        this.prisma.$executeRawUnsafe(
          `INSERT INTO "RewardPoolContribution" ("id", "userId", "betId", "amount", "gameType", "siteId", "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
          userId,
          betId,
          contribution,
          gameType,
          effectiveSiteId,
        ),
      ]);

      this.logger.debug(
        `Pool[${effectiveSiteId}] +$${contribution.toFixed(6)} from ${gameType} (bet: $${betAmount.toFixed(2)}, edge: ${(houseEdge * 100).toFixed(1)}%)`,
      );
    } catch (error) {
      this.logger.error(`Failed to contribute to pool: ${error.message}`);
    }
  }

  // Ensure a RewardPool row exists for this site
  private async _ensurePool(siteId: string) {
    const pool = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "RewardPool" WHERE "siteId" = $1 LIMIT 1`,
      siteId,
    );
    if (!pool || pool.length === 0) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "RewardPool" ("id", "siteId", "totalAccumulated", "totalDistributed", "currentBalance", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, 0, 0, 0, NOW(), NOW())`,
        siteId,
      );
    }
  }

  // ============================================
  // POOL STATUS (tenant-isolated)
  // ============================================

  async getPoolStatus(siteId?: string) {
    const effectiveSiteId = siteId || '1';
    const pool = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "RewardPool" WHERE "siteId" = $1 LIMIT 1`,
      effectiveSiteId,
    );
    if (!pool || pool.length === 0) return {
      totalAccumulated: 0,
      totalDistributed: 0,
      currentBalance: 0,
      lastWeeklyDistribution: null,
      lastMonthlyDistribution: null,
    };
    return {
      totalAccumulated: Number(pool[0].totalAccumulated),
      totalDistributed: Number(pool[0].totalDistributed),
      currentBalance: Number(pool[0].currentBalance),
      lastWeeklyDistribution: pool[0].lastWeeklyDistribution,
      lastMonthlyDistribution: pool[0].lastMonthlyDistribution,
    };
  }

  // ============================================
  // DISTRIBUTION HISTORY (tenant-isolated)
  // ============================================

  async getDistributionHistory(siteId?: string, limit = 50) {
    try {
      const effectiveSiteId = siteId || '1';
      const history = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          rh.id,
          rh."userId",
          rh.type,
          rh.amount,
          rh.source,
          rh.description,
          rh.metadata,
          rh."createdAt",
          u.email,
          u.username
        FROM "RewardHistory" rh
        LEFT JOIN "User" u ON u.id = rh."userId"
        WHERE rh."siteId" = $1
        ORDER BY rh."createdAt" DESC
        LIMIT $2
      `, effectiveSiteId, limit);

      return history.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        email: r.email,
        username: r.username,
        type: r.type,
        amount: Number(r.amount),
        source: r.source,
        description: r.description,
        metadata: r.metadata,
        createdAt: r.createdAt,
      }));
    } catch (error) {
      this.logger.error(`Failed to get distribution history: ${error.message}`);
      return [];
    }
  }

  // ============================================
  // TOP PLAYERS (tenant-isolated)
  // ============================================

  async getTopPlayers(siteId?: string) {
    try {
      const effectiveSiteId = siteId || '1';
      const settings = await this.getSettings(effectiveSiteId);
      const topCount = settings.topPlayersCount || 3;

      const weeklyTop = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          b."userId",
          u.email,
          u.username,
          u."vipLevel",
          SUM(b."betAmount") as total_wagered,
          COUNT(*) as total_bets
        FROM "Bet" b
        JOIN "User" u ON u.id = b."userId"
        WHERE b."createdAt" >= NOW() - INTERVAL '7 days'
          AND u."isBot" = false
          AND u.email != $1
          AND b."siteId" = $4
        GROUP BY b."userId", u.email, u.username, u."vipLevel"
        HAVING SUM(b."betAmount") >= $2
        ORDER BY total_wagered DESC
        LIMIT $3
      `, SUPER_ADMIN_EMAIL, settings.minWageringForBonus, topCount, effectiveSiteId);

      const monthlyTop = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          b."userId",
          u.email,
          u.username,
          u."vipLevel",
          SUM(b."betAmount") as total_wagered,
          COUNT(*) as total_bets
        FROM "Bet" b
        JOIN "User" u ON u.id = b."userId"
        WHERE b."createdAt" >= NOW() - INTERVAL '30 days'
          AND u."isBot" = false
          AND u.email != $1
          AND b."siteId" = $4
        GROUP BY b."userId", u.email, u.username, u."vipLevel"
        HAVING SUM(b."betAmount") >= $2
        ORDER BY total_wagered DESC
        LIMIT $3
      `, SUPER_ADMIN_EMAIL, settings.minWageringForBonus, topCount, effectiveSiteId);

      const pool = await this.getPoolStatus(effectiveSiteId);
      const poolBalance = pool?.currentBalance || 0;

      const placeSplits = [
        settings.firstPlacePercent,
        settings.secondPlacePercent,
        settings.thirdPlacePercent,
      ];

      const weeklyBudget = Math.min(
        poolBalance * settings.weeklyPoolPercent,
        settings.weeklyPoolCap,
      );
      const monthlyBudget = Math.min(
        poolBalance * settings.monthlyPoolPercent,
        settings.monthlyPoolCap,
      );

      const formatPlayers = (players: any[], budget: number) =>
        players.map((p: any, i: number) => {
          const split = placeSplits[i] || 0;
          const vipTier = getVipTier(p.vipLevel || 0);
          return {
            rank: i + 1,
            userId: p.userId,
            email: p.email,
            username: p.username,
            vipLevel: p.vipLevel || 0,
            vipTier: vipTier.name,
            totalWagered: Number(p.total_wagered),
            totalBets: Number(p.total_bets),
            projectedReward: Math.round(budget * split * 100) / 100,
            splitPercent: split,
          };
        });

      return {
        weekly: formatPlayers(weeklyTop, weeklyBudget),
        monthly: formatPlayers(monthlyTop, monthlyBudget),
        weeklyBudget: Math.round(weeklyBudget * 100) / 100,
        monthlyBudget: Math.round(monthlyBudget * 100) / 100,
        poolBalance,
      };
    } catch (error) {
      this.logger.error(`Failed to get top players: ${error.message}`);
      return { weekly: [], monthly: [], weeklyBudget: 0, monthlyBudget: 0, poolBalance: 0 };
    }
  }

  // ============================================
  // WEEKLY BONUS DISTRIBUTION (tenant-isolated)
  // ============================================

  async distributeWeeklyBonus(siteId?: string): Promise<{ distributed: number; recipients: number; details: any[] }> {
    const effectiveSiteId = siteId || '1';
    const settings = await this.getSettings(effectiveSiteId);
    if (!settings.weeklyBonusEnabled) {
      return { distributed: 0, recipients: 0, details: [{ error: 'Weekly bonus is disabled' }] };
    }
    return this._distribute('WEEKLY', 7, settings, effectiveSiteId);
  }

  // ============================================
  // MONTHLY BONUS DISTRIBUTION (tenant-isolated)
  // ============================================

  async distributeMonthlyBonus(siteId?: string): Promise<{ distributed: number; recipients: number; details: any[] }> {
    const effectiveSiteId = siteId || '1';
    const settings = await this.getSettings(effectiveSiteId);
    if (!settings.monthlyBonusEnabled) {
      return { distributed: 0, recipients: 0, details: [{ error: 'Monthly bonus is disabled' }] };
    }
    return this._distribute('MONTHLY', 30, settings, effectiveSiteId);
  }

  // ============================================
  // CORE DISTRIBUTION LOGIC (tenant-isolated)
  // ============================================

  private async _distribute(
    period: 'WEEKLY' | 'MONTHLY',
    lookbackDays: number,
    settings: any,
    siteId: string,
  ): Promise<{ distributed: number; recipients: number; details: any[] }> {
    const details: any[] = [];
    const bonusType = period === 'WEEKLY' ? 'WEEKLY_BONUS' : 'MONTHLY_BONUS';
    const label = period === 'WEEKLY' ? 'Weekly' : 'Monthly';
    const poolPercent = period === 'WEEKLY' ? settings.weeklyPoolPercent : settings.monthlyPoolPercent;
    const poolCap = period === 'WEEKLY' ? settings.weeklyPoolCap : settings.monthlyPoolCap;
    const cooldownHours = period === 'WEEKLY' ? settings.weeklyCooldownHours : settings.monthlyCooldownHours;
    const lastDistField = period === 'WEEKLY' ? 'lastWeeklyDistribution' : 'lastMonthlyDistribution';
    const topCount = settings.topPlayersCount || 3;
    const placeSplits = [
      settings.firstPlacePercent,
      settings.secondPlacePercent,
      settings.thirdPlacePercent,
    ];

    try {
      // 1. Get pool status for this site
      const pool = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "RewardPool" WHERE "siteId" = $1 LIMIT 1`,
        siteId,
      );
      if (!pool || pool.length === 0 || Number(pool[0].currentBalance) <= 0) {
        return { distributed: 0, recipients: 0, details: [{ error: 'Pool empty or not found' }] };
      }

      // 2. Cooldown check
      const lastDist = pool[0][lastDistField];
      if (lastDist) {
        const hoursSince = (Date.now() - new Date(lastDist).getTime()) / (1000 * 60 * 60);
        if (hoursSince < cooldownHours) {
          return { distributed: 0, recipients: 0, details: [{ error: `Cooldown: ${(cooldownHours - hoursSince).toFixed(1)}h remaining` }] };
        }
      }

      const poolBalance = Number(pool[0].currentBalance);
      const budget = Math.min(poolBalance * poolPercent, poolCap);
      if (budget < MIN_DISTRIBUTION_AMOUNT) {
        return { distributed: 0, recipients: 0, details: [{ error: 'Budget too small' }] };
      }

      // 3. Get top players by wagering in period (filtered by siteId)
      const topPlayers = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          b."userId",
          u.email,
          u.username,
          u."vipLevel",
          SUM(b."betAmount") as total_wagered,
          COUNT(*) as total_bets
        FROM "Bet" b
        JOIN "User" u ON u.id = b."userId"
        WHERE b."createdAt" >= NOW() - INTERVAL '${lookbackDays} days'
          AND u."isBot" = false
          AND u.email != $1
          AND b."siteId" = $4
        GROUP BY b."userId", u.email, u.username, u."vipLevel"
        HAVING SUM(b."betAmount") >= $2
        ORDER BY total_wagered DESC
        LIMIT $3
      `, SUPER_ADMIN_EMAIL, settings.minWageringForBonus, topCount, siteId);

      if (topPlayers.length === 0) {
        return { distributed: 0, recipients: 0, details: [{ error: 'No eligible players' }] };
      }

      // 4. Distribute to top N players based on place splits
      let totalDistributed = 0;

      for (let i = 0; i < topPlayers.length; i++) {
        const player = topPlayers[i];
        const splitPercent = placeSplits[i] || 0;
        if (splitPercent <= 0) continue;

        const playerWagered = Number(player.total_wagered);
        const vipLevel = player.vipLevel || 0;
        const rakebackRate = getRakebackRate(vipLevel);
        const tierInfo = getVipTier(vipLevel);

        let bonus = budget * splitPercent;

        // VIP cap: wagered * houseEdge(4%) * vipRakebackRate
        const maxAllowed = playerWagered * 0.04 * rakebackRate;
        bonus = Math.min(bonus, maxAllowed);

        if (bonus < MIN_DISTRIBUTION_AMOUNT) {
          details.push({
            userId: player.userId, email: player.email, rank: i + 1,
            skipped: true, reason: `Bonus too small ($${bonus.toFixed(4)})`,
          });
          continue;
        }

        const roundedBonus = Math.round(bonus * 100) / 100;

        // Atomic: credit bonusBalance + record history + transaction
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "Wallet" SET "bonusBalance" = "bonusBalance" + $1 WHERE "userId" = $2 AND currency = 'USDT'`,
            roundedBonus,
            player.userId,
          );

          await tx.$executeRawUnsafe(
            `INSERT INTO "RewardHistory" ("id", "userId", "type", "amount", "source", "description", "isWithdrawable", "siteId", "metadata", "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, 'Reward Pool', $4, false, $5, $6::jsonb, NOW())`,
            player.userId,
            bonusType,
            roundedBonus,
            `${label} bonus #${i + 1}: $${roundedBonus.toFixed(2)} (VIP ${tierInfo.name}, wagered $${playerWagered.toFixed(2)})`,
            siteId,
            JSON.stringify({
              rank: i + 1, poolBalance, budget, splitPercent,
              maxAllowed, actualBonus: roundedBonus,
              vipLevel, vipTier: tierInfo.name, rakebackRate, playerWagered,
            }),
          );

          const wallet = await tx.$queryRawUnsafe<any[]>(
            `SELECT id, "bonusBalance" FROM "Wallet" WHERE "userId" = $1 AND currency = 'USDT' LIMIT 1`,
            player.userId,
          );
          if (wallet && wallet.length > 0) {
            await tx.$executeRawUnsafe(
              `INSERT INTO "Transaction" ("id", "userId", "walletId", "type", "status", "amount", "balanceBefore", "balanceAfter", "metadata", "createdAt", "confirmedAt")
               VALUES (gen_random_uuid(), $1, $2, $3::"TransactionType", 'CONFIRMED'::"TransactionStatus", $4, $5, $6, $7::jsonb, NOW(), NOW())`,
              player.userId,
              wallet[0].id,
              bonusType,
              roundedBonus,
              Number(wallet[0].bonusBalance) - roundedBonus,
              Number(wallet[0].bonusBalance),
              JSON.stringify({ source: 'REWARD_POOL', type: bonusType, rank: i + 1, vipTier: tierInfo.name }),
            );
          }
        });

        totalDistributed += roundedBonus;
        details.push({
          userId: player.userId, email: player.email, rank: i + 1,
          vipLevel, vipTier: tierInfo.name,
          rakebackRate: `${(rakebackRate * 100).toFixed(0)}%`,
          wagered: playerWagered,
          splitPercent: `${(splitPercent * 100).toFixed(0)}%`,
          maxAllowed, bonus: roundedBonus,
        });
      }

      // 5. Deduct from pool and update timestamp (filtered by siteId)
      if (totalDistributed > 0) {
        const updateField = period === 'WEEKLY' ? 'lastWeeklyDistribution' : 'lastMonthlyDistribution';
        await this.prisma.$executeRawUnsafe(
          `UPDATE "RewardPool" SET "currentBalance" = "currentBalance" - $1, "totalDistributed" = "totalDistributed" + $1, "${updateField}" = NOW(), "updatedAt" = NOW() WHERE "siteId" = $2`,
          totalDistributed,
          siteId,
        );
      }

      const recipientCount = details.filter((d: any) => d.bonus).length;
      this.logger.log(`[${siteId}] ${label} distribution: $${totalDistributed.toFixed(2)} to ${recipientCount} players`);
      return { distributed: totalDistributed, recipients: recipientCount, details };
    } catch (error) {
      this.logger.error(`${label} distribution failed: ${error.message}`);
      return { distributed: 0, recipients: 0, details: [{ error: error.message }] };
    }
  }

  // ============================================
  // USER REWARD HISTORY
  // ============================================

  async getUserRewardHistory(userId: string, limit = 50) {
    const rewards = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "RewardHistory" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
      userId,
      limit,
    );
    return rewards.map((r: any) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      source: r.source,
      description: r.description,
      isWithdrawable: r.isWithdrawable,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }));
  }

  // ============================================
  // USER BONUS STATS
  // ============================================

  async getUserBonusStats(userId: string) {
    const stats = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM "RewardHistory"
      WHERE "userId" = $1
      GROUP BY type
    `, userId);

    const wallet = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "bonusBalance" FROM "Wallet" WHERE "userId" = $1 AND currency = 'USDT' LIMIT 1`,
      userId,
    );

    return {
      currentBonusBalance: wallet.length > 0 ? Number(wallet[0].bonusBalance) : 0,
      rewards: stats.map((s: any) => ({
        type: s.type,
        count: Number(s.count),
        total: Number(s.total),
      })),
      totalRewardsReceived: stats.reduce((sum: number, s: any) => sum + Number(s.total), 0),
    };
  }
}
