'use strict';

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// MLM Rank definitions
const RANKS = [
  { name: 'Bronze', icon: '🥉', color: '#CD7F32', minVolume: 0, tier1Rate: 0.05, tier2Rate: 0.02, tier3Rate: 0.01 },
  { name: 'Silver', icon: '🥈', color: '#C0C0C0', minVolume: 1000, tier1Rate: 0.07, tier2Rate: 0.03, tier3Rate: 0.015 },
  { name: 'Gold', icon: '🥇', color: '#FFD700', minVolume: 10000, tier1Rate: 0.10, tier2Rate: 0.04, tier3Rate: 0.02 },
  { name: 'Platinum', icon: '💎', color: '#E5E4E2', minVolume: 50000, tier1Rate: 0.12, tier2Rate: 0.05, tier3Rate: 0.025 },
  { name: 'Diamond', icon: '👑', color: '#00F0FF', minVolume: 250000, tier1Rate: 0.15, tier2Rate: 0.06, tier3Rate: 0.03 },
  { name: 'Iron', icon: '🏆', color: '#FF4500', minVolume: 1000000, tier1Rate: 0.20, tier2Rate: 0.08, tier3Rate: 0.04 },
];

@Injectable()
export class AffiliateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get affiliate stats for a user
   */
  async getStats(userId: string, siteId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: true,
        children: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Calculate total network volume
    const totalNetworkVolume = await this.calculateNetworkVolume(userId);

    // Determine current rank
    const currentRank = this.getRankByVolume(totalNetworkVolume);
    const nextRank = this.getNextRank(currentRank);

    // Get network stats
    const networkStats = await this.getNetworkStats(userId);

    // Calculate available commission (from Commission table)
    const commissions = await this.prisma.commission.findMany({
      where: {
        recipientId: userId,
      },
    });

    // Since there's no status field, we'll calculate total earned
    const totalEarned = commissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0
    );

    // For demo purposes, show 10% as available to claim
    const availableCommission = totalEarned * 0.1;

    // Calculate rank progress
    const rankProgress = {
      current: totalNetworkVolume,
      target: nextRank ? nextRank.minVolume : currentRank.minVolume,
      percentage: nextRank
        ? Math.min((totalNetworkVolume / nextRank.minVolume) * 100, 100)
        : 100,
    };

    return {
      referralCode: user.username,
      referralLink: `https://betworkss.com/register?ref=${user.username}`,
      currentRank: {
        name: currentRank.name,
        icon: currentRank.icon,
        color: currentRank.color,
        tier1Rate: `${(currentRank.tier1Rate * 100).toFixed(0)}%`,
        tier2Rate: `${(currentRank.tier2Rate * 100).toFixed(1)}%`,
        tier3Rate: `${(currentRank.tier3Rate * 100).toFixed(1)}%`,
      },
      nextRank: nextRank
        ? {
            name: nextRank.name,
            icon: nextRank.icon,
            volumeRequired: nextRank.minVolume,
            volumeRemaining: Math.max(0, nextRank.minVolume - totalNetworkVolume),
          }
        : null,
      rankProgress,
      availableCommission,
      totalEarned,
      networkStats,
      totalNetworkVolume,
    };
  }

  /**
   * Get detailed network breakdown
   */
  async getNetwork(userId: string, siteId?: string) {
    // Tier 1: Direct referrals
    const tier1Users = await this.prisma.user.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
        children: { select: { id: true } },
      },
    });

    const tier1Ids = tier1Users.map((u) => u.id);

    // Tier 2: Referrals of tier 1
    const tier2Users = tier1Ids.length > 0
      ? await this.prisma.user.findMany({
          where: { parentId: { in: tier1Ids } },
          select: {
            id: true,
            username: true,
            createdAt: true,
            parentId: true,
            children: { select: { id: true } },
          },
        })
      : [];

    const tier2Ids = tier2Users.map((u) => u.id);

    // Tier 3: Referrals of tier 2
    const tier3Users = tier2Ids.length > 0
      ? await this.prisma.user.findMany({
          where: { parentId: { in: tier2Ids } },
          select: {
            id: true,
            username: true,
            createdAt: true,
            parentId: true,
          },
        })
      : [];

    // Calculate earnings per tier
    const tier1Earnings = await this.getTierEarnings(userId, 1);
    const tier2Earnings = await this.getTierEarnings(userId, 2);
    const tier3Earnings = await this.getTierEarnings(userId, 3);

    return {
      tiers: [
        {
          tier: 1,
          name: 'Tier 1 (Direct)',
          users: tier1Users.length,
          earnings: tier1Earnings,
          members: tier1Users.map((u) => ({
            username: u.username,
            joinedAt: u.createdAt.toISOString(),
            referrals: u.children.length,
          })),
        },
        {
          tier: 2,
          name: 'Tier 2 (Indirect)',
          users: tier2Users.length,
          earnings: tier2Earnings,
          members: tier2Users.map((u) => ({
            username: u.username,
            joinedAt: u.createdAt.toISOString(),
            referredBy: tier1Users.find((t) => t.id === u.parentId)?.username,
          })),
        },
        {
          tier: 3,
          name: 'Tier 3 (Extended)',
          users: tier3Users.length,
          earnings: tier3Earnings,
          members: tier3Users.map((u) => ({
            username: u.username,
            joinedAt: u.createdAt.toISOString(),
            referredBy: tier2Users.find((t) => t.id === u.parentId)?.username,
          })),
        },
      ],
      totalUsers: tier1Users.length + tier2Users.length + tier3Users.length,
      totalEarnings: tier1Earnings + tier2Earnings + tier3Earnings,
    };
  }

  /**
   * Get commission history
   */
  async getHistory(userId: string, siteId?: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const commissions = await this.prisma.commission.findMany({
      where: {
        recipientId: userId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyTotals: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      dailyTotals[dateStr] = 0;
    }

    commissions.forEach((c) => {
      const dateStr = c.createdAt.toISOString().split('T')[0];
      if (dailyTotals[dateStr] !== undefined) {
        dailyTotals[dateStr] += Number(c.amount);
      }
    });

    const history = Object.entries(dailyTotals).map(([date, amount]) => ({
      date,
      amount,
    }));

    const total = history.reduce((sum, h) => sum + h.amount, 0);

    return { history, total };
  }

  /**
   * Claim available commission to main wallet
   */
  async claimCommission(userId: string, siteId?: string) {
    // Get all commissions for user
    const commissions = await this.prisma.commission.findMany({
      where: {
        recipientId: userId,
      },
    });

    if (commissions.length === 0) {
      throw new BadRequestException('No commission available to claim');
    }

    const totalAmount = commissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0
    );

    // For demo, claim 10% of total
    const claimAmount = totalAmount * 0.1;

    if (claimAmount <= 0) {
      throw new BadRequestException('No commission available to claim');
    }

    // Get or create USDT wallet
    let wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        currency: 'USDT',
      },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currency: 'USDT',
          balance: new Decimal(0),
          lockedBalance: new Decimal(0),
        },
      });
    }

    // Update wallet balance
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: claimAmount },
      },
    });

    return {
      success: true,
      message: `Successfully claimed $${claimAmount.toFixed(2)} to your wallet`,
      amount: claimAmount,
    };
  }

  // Helper methods

  private async calculateNetworkVolume(userId: string): Promise<number> {
    // Get all users in the network (3 tiers deep)
    const tier1 = await this.prisma.user.findMany({
      where: { parentId: userId },
      select: { id: true },
    });

    const tier1Ids = tier1.map((u) => u.id);

    const tier2 = tier1Ids.length > 0
      ? await this.prisma.user.findMany({
          where: { parentId: { in: tier1Ids } },
          select: { id: true },
        })
      : [];

    const tier2Ids = tier2.map((u) => u.id);

    const tier3 = tier2Ids.length > 0
      ? await this.prisma.user.findMany({
          where: { parentId: { in: tier2Ids } },
          select: { id: true },
        })
      : [];

    const allUserIds = [...tier1Ids, ...tier2Ids, ...tier3.map((u) => u.id)];

    if (allUserIds.length === 0) return 0;

    // Sum all bets from network users
    const bets = await this.prisma.bet.aggregate({
      where: {
        userId: { in: allUserIds },
      },
      _sum: {
        betAmount: true,
      },
    });

    return Number(bets._sum.betAmount || 0);
  }

  private getRankByVolume(volume: number) {
    let currentRank = RANKS[0];
    for (const rank of RANKS) {
      if (volume >= rank.minVolume) {
        currentRank = rank;
      }
    }
    return currentRank;
  }

  private getNextRank(currentRank: typeof RANKS[0]) {
    const currentIndex = RANKS.findIndex((r) => r.name === currentRank.name);
    return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
  }

  private async getNetworkStats(userId: string) {
    const tier1Count = await this.prisma.user.count({
      where: { parentId: userId },
    });

    const tier1Users = await this.prisma.user.findMany({
      where: { parentId: userId },
      select: { id: true },
    });

    const tier1Ids = tier1Users.map((u) => u.id);

    const tier2Count = tier1Ids.length > 0
      ? await this.prisma.user.count({
          where: { parentId: { in: tier1Ids } },
        })
      : 0;

    const tier2Users = tier1Ids.length > 0
      ? await this.prisma.user.findMany({
          where: { parentId: { in: tier1Ids } },
          select: { id: true },
        })
      : [];

    const tier2Ids = tier2Users.map((u) => u.id);

    const tier3Count = tier2Ids.length > 0
      ? await this.prisma.user.count({
          where: { parentId: { in: tier2Ids } },
        })
      : 0;

    return {
      tier1: tier1Count,
      tier2: tier2Count,
      tier3: tier3Count,
      total: tier1Count + tier2Count + tier3Count,
    };
  }

  private async getTierEarnings(userId: string, tier: number): Promise<number> {
    const commissions = await this.prisma.commission.findMany({
      where: {
        recipientId: userId,
        levelFromSource: tier,
      },
    });

    return commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  }

  /**
   * Alias for getStats - used by controller
   */
  async getAffiliateStats(userId: string, siteId?: string) {
    return this.getStats(userId, siteId);
  }

  /**
   * Alias for getNetwork - used by controller
   */
  async getNetworkDetails(userId: string, siteId?: string) {
    return this.getNetwork(userId, siteId);
  }

  /**
   * Alias for getHistory - used by controller
   */
  async getCommissionHistory(userId: string, siteId?: string, days: number = 30) {
    return this.getHistory(userId, siteId, days);
  }

  /**
   * Get top affiliates leaderboard
   */
  async getLeaderboard(limit: number = 10) {
    // Get all users with their commission totals
    const users = await this.prisma.user.findMany({
      where: {
        email: { not: { contains: '@system.local' } }, // Exclude bots
      },
      select: {
        id: true,
        username: true,
        commissionsEarned: {
          select: { amount: true },
        },
        children: { select: { id: true } },
      },
    });

    // Calculate totals and sort
    const leaderboard = users
      .map((user) => ({
        username: user.username,
        totalEarned: user.commissionsEarned.reduce(
          (sum, c) => sum + Number(c.amount),
          0
        ),
        referrals: user.children.length,
      }))
      .filter((u) => u.totalEarned > 0 || u.referrals > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, limit);

    return {
      leaderboard,
      updatedAt: new Date().toISOString(),
    };
  }
}
