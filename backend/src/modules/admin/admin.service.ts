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
    // // console.log(`[EMAIL VERIFICATION] OTP for ${user.email}: ${otp}`);
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
