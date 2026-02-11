import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private prisma: PrismaService) {}

  // Helper: build siteId filter
  private siteFilter(siteId?: string) {
    return siteId ? { siteId } : {};
  }

  // ============ DASHBOARD STATS (for frontend /admin/dashboard/stats) ============

  async getStats(siteId?: string) {
    const sf = this.siteFilter(siteId);

    const [totalUsers, activeUsers, pendingApprovalUsers, pendingTransactions] = await Promise.all([
      this.prisma.user.count({ where: { ...sf } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', ...sf } }),
      this.prisma.user.count({ where: { status: 'PENDING_APPROVAL', ...sf } }),
      this.prisma.transaction.count({ where: { status: 'PENDING', ...sf } }),
    ]);

    const transactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: { status: 'CONFIRMED', ...sf },
    });

    const totalDeposits = Number(transactions.find(t => t.type === 'DEPOSIT')?._sum.amount || 0);
    const totalWithdrawals = Number(transactions.find(t => t.type === 'WITHDRAWAL')?._sum.amount || 0);

    const bets = await this.prisma.bet.aggregate({
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
      where: { ...sf },
    });

    const totalWagered = Number(bets._sum.betAmount || 0);
    const totalPayouts = Number(bets._sum.payout || 0);
    const totalBets = bets._count;
    const totalGGR = totalWagered - totalPayouts;
    const providerFeeRate = 0.08;
    const providerFees = totalGGR > 0 ? totalGGR * providerFeeRate : 0;
    const netProfit = totalGGR - providerFees;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersLast24h = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: oneDayAgo }, ...sf },
    });

    // activeSessions = active users in last 24h
    const activeSessions = activeUsersLast24h.length;

    return {
      totalUsers,
      activeUsers,
      pendingApprovalUsers,
      activeUsersLast24h: activeUsersLast24h.length,
      activeSessions,
      totalDeposits,
      totalWithdrawals,
      pendingTransactions,
      totalBets,
      totalRevenue: totalGGR,
      totalGGR,
      providerFees,
      netProfit,
      houseProfit: totalGGR,
      stats: { wagered: totalWagered, payouts: totalPayouts },
    };
  }

  // ============ FINANCE STATS (for frontend /admin/finance/stats) ============

  async getFinanceStats(siteId?: string) {
    const sf = this.siteFilter(siteId);

    const bets = await this.prisma.bet.aggregate({
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
      where: { ...sf },
    });

    const totalBets = Number(bets._sum.betAmount || 0);
    const totalWins = Number(bets._sum.payout || 0);
    const betCount = bets._count;
    const ggr = totalBets - totalWins;
    const providerFee = ggr > 0 ? ggr * 0.08 : 0;
    const netProfit = ggr - providerFee;
    const houseEdge = totalBets > 0 ? ((ggr / totalBets) * 100).toFixed(2) : '0';
    const rtp = totalBets > 0 ? ((totalWins / totalBets) * 100).toFixed(2) : '0';

    // Per-game breakdown
    const gameBreakdown = await this.prisma.bet.groupBy({
      by: ['gameType'],
      _sum: { betAmount: true, payout: true },
      _count: true,
      where: { ...sf },
    });

    const games = gameBreakdown.map(g => ({
      game: g.gameType,
      bets: Number(g._sum.betAmount || 0),
      wins: Number(g._sum.payout || 0),
      ggr: Number(g._sum.betAmount || 0) - Number(g._sum.payout || 0),
      count: g._count,
      rtp: Number(g._sum.betAmount || 0) > 0
        ? ((Number(g._sum.payout || 0) / Number(g._sum.betAmount || 0)) * 100).toFixed(2)
        : '0',
    }));

    // Transaction stats
    const transactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
      _count: true,
      where: { status: 'CONFIRMED', ...sf },
    });

    const deposits = Number(transactions.find(t => t.type === 'DEPOSIT')?._sum.amount || 0);
    const withdrawals = Number(transactions.find(t => t.type === 'WITHDRAWAL')?._sum.amount || 0);

    return {
      totalBets,
      totalWins,
      betCount,
      ggr,
      providerFee,
      netProfit,
      houseEdge,
      rtp,
      deposits,
      withdrawals,
      netDeposits: deposits - withdrawals,
      gameBreakdown: games,
    };
  }

  // ============ GAME CONFIG ============

  async getGameConfig(siteId?: string) {
    const site = siteId
      ? await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } })
      : await this.prisma.siteConfiguration.findFirst({ where: { active: true } });

    if (!site) {
      return {
        data: {
          houseEdge: 4,
          instantBust: 0,
          botsEnabled: true,
          maxBotBet: 1000,
          minBotBet: 5,
          maxBotsPerRound: 50,
        },
      };
    }

    const houseEdgeConfig = (site.houseEdgeConfig as any) || {};
    const botConfig = await this.prisma.botConfig.findFirst({ where: { siteId: site.id } });

    return {
      data: {
        houseEdge: houseEdgeConfig.crash || houseEdgeConfig.dice || 4,
        instantBust: 0,
        botsEnabled: botConfig?.enabled ?? true,
        maxBotBet: botConfig?.maxBetAmount ? Number(botConfig.maxBetAmount) : 1000,
        minBotBet: botConfig?.minBetAmount ? Number(botConfig.minBetAmount) : 5,
        maxBotsPerRound: botConfig?.botCount || 50,
        houseEdgeConfig,
      },
    };
  }

  async updateGameConfig(siteId: string | undefined, body: any) {
    const targetSiteId = siteId || 'default-site-001';

    const updateData: any = {};
    if (body.houseEdge !== undefined) {
      const edge = body.houseEdge / 100;
      updateData.houseEdgeConfig = {
        crash: edge,
        dice: edge,
        mines: edge,
        plinko: edge,
        olympus: edge,
      };
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.siteConfiguration.update({
        where: { id: targetSiteId },
        data: updateData,
      });
    }

    if (body.botsEnabled !== undefined || body.maxBotBet !== undefined || body.minBotBet !== undefined) {
      const botUpdate: any = {};
      if (body.botsEnabled !== undefined) botUpdate.enabled = body.botsEnabled;
      if (body.maxBotBet !== undefined) botUpdate.maxBetAmount = body.maxBotBet;
      if (body.minBotBet !== undefined) botUpdate.minBetAmount = body.minBotBet;
      if (body.maxBotsPerRound !== undefined) botUpdate.botCount = body.maxBotsPerRound;

      await this.prisma.botConfig.updateMany({
        where: { siteId: targetSiteId },
        data: botUpdate,
      });
    }

    return this.getGameConfig(targetSiteId);
  }

  // ============ TRANSACTION MANAGEMENT ============

  async approveTransaction(transactionId: string, adminId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'CONFIRMED' },
    });

    this.logger.log(`Transaction ${transactionId} approved by admin ${adminId}`);
    return { success: true, message: 'Transaction approved' };
  }

  async simulateDeposit(userId: string, amount: number, currency: string) {
    const wallet = await this.prisma.wallet.findFirst({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for user');
    const currentBalance = Number(wallet.balance);
    const newBalance = currentBalance + amount;
    const txData: any = {
      user: { connect: { id: userId } },
      wallet: { connect: { id: wallet.id } },
      type: 'DEPOSIT',
      amount,
      status: 'CONFIRMED',
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      externalRef: `SIM-${Date.now()}`,
    };
    if (wallet.siteId) { txData.site = { connect: { id: wallet.siteId } }; }
    await this.prisma.$transaction([
      this.prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } }),
      this.prisma.transaction.create({ data: txData }),
    ]);
    return { success: true, message: `Deposited $${amount} ${currency}`, newBalance };
  }

  // ============ BRAND DASHBOARD (multi-tenant) ============

  async getBrandDashboard(siteId: string) {
    const sf = siteId !== 'ALL' ? { siteId } : {};

    const site = siteId !== 'ALL'
      ? await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } })
      : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [allTimeBets, todayBets, userCount, activeCount] = await Promise.all([
      this.prisma.bet.aggregate({ _sum: { betAmount: true, payout: true }, _count: true, where: { ...sf } }),
      this.prisma.bet.aggregate({ _sum: { betAmount: true, payout: true }, _count: true, where: { createdAt: { gte: today }, ...sf } }),
      this.prisma.user.count({ where: { ...sf } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', ...sf } }),
    ]);

    const allBets = Number(allTimeBets._sum.betAmount || 0);
    const allWins = Number(allTimeBets._sum.payout || 0);
    const todayBetsAmt = Number(todayBets._sum.betAmount || 0);
    const todayWins = Number(todayBets._sum.payout || 0);

    const gameBreakdown = await this.prisma.bet.groupBy({
      by: ['gameType'],
      _sum: { betAmount: true, payout: true },
      _count: true,
      where: { ...sf },
    });

    return {
      siteId,
      brandName: site?.brandName || 'All Brands',
      revenue: {
        today: {
          totalBets: todayBetsAmt,
          totalWins: todayWins,
          ggr: todayBetsAmt - todayWins,
          ngr: (todayBetsAmt - todayWins) * 0.9,
          betCount: todayBets._count,
        },
        allTime: {
          totalBets: allBets,
          totalWins: allWins,
          ggr: allBets - allWins,
          ngr: (allBets - allWins) * 0.9,
          betCount: allTimeBets._count,
          uniquePlayers: userCount,
        },
      },
      gameBreakdown: gameBreakdown.map(g => ({
        game: g.gameType,
        bets: Number(g._sum.betAmount || 0),
        wins: Number(g._sum.payout || 0),
        ggr: Number(g._sum.betAmount || 0) - Number(g._sum.payout || 0),
        count: g._count,
        rtp: Number(g._sum.betAmount || 0) > 0
          ? ((Number(g._sum.payout || 0) / Number(g._sum.betAmount || 0)) * 100).toFixed(1)
          : '0',
      })),
    };
  }

  async getAllBrandsDashboard() {
    const sites = await this.prisma.siteConfiguration.findMany({ where: { active: true } });
    const results = [];

    for (const site of sites) {
      const [userCount, betAgg] = await Promise.all([
        this.prisma.user.count({ where: { siteId: site.id } }),
        this.prisma.bet.aggregate({ _sum: { betAmount: true, payout: true }, _count: true, where: { siteId: site.id } }),
      ]);

      results.push({
        siteId: site.id,
        brandName: site.brandName,
        domain: site.domain,
        active: site.active,
        users: userCount,
        totalBets: Number(betAgg._sum.betAmount || 0),
        totalWins: Number(betAgg._sum.payout || 0),
        ggr: Number(betAgg._sum.betAmount || 0) - Number(betAgg._sum.payout || 0),
        betCount: betAgg._count,
        houseEdgeConfig: site.houseEdgeConfig,
      });
    }

    return results;
  }

  // ============ HOUSE EDGE ============

  async getHouseEdge(siteId: string) {
    const site = await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    return { siteId, houseEdgeConfig: site.houseEdgeConfig };
  }

  async updateHouseEdge(siteId: string, config: any) {
    await this.prisma.siteConfiguration.update({
      where: { id: siteId },
      data: { houseEdgeConfig: config },
    });
    return { success: true, siteId, houseEdgeConfig: config };
  }

  // ============ RISK LIMITS ============

  async getRiskLimits(siteId: string) {
    const limits = await this.prisma.riskLimit.findFirst({ where: { siteId } });
    return limits || { siteId, maxPayoutPerDay: 100000, maxPayoutPerBet: 25000, maxBetAmount: 10000 };
  }

  async setRiskLimits(siteId: string, body: any) {
    const existing = await this.prisma.riskLimit.findFirst({ where: { siteId } });
    if (existing) {
      await this.prisma.riskLimit.update({ where: { id: existing.id }, data: body });
    } else {
      await this.prisma.riskLimit.create({ data: { siteId, ...body } });
    }
    return { success: true, siteId, ...body };
  }

  // ============ USERS ============

  async getAllUsers(siteId?: string, limit = 100) {
    const sf = this.siteFilter(siteId);
    const users = await this.prisma.user.findMany({
      where: { ...sf },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, username: true, email: true, status: true, role: true,
        createdAt: true, lastLoginAt: true, isBot: true, siteId: true,
        wallets: { select: { balance: true, currency: true } },
      },
    });

    return users.map((u) => ({
      ...u,
      wallets: u.wallets.map((w) => ({ balance: w.balance.toString(), currency: w.currency })),
    }));
  }

  async getPendingUsers(siteId?: string) {
    const sf = this.siteFilter(siteId);
    return this.prisma.user.findMany({
      where: { status: 'PENDING_APPROVAL', ...sf },
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, email: true, status: true, role: true, createdAt: true, lastLoginAt: true },
    });
  }

  async approveUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.PENDING_APPROVAL) throw new ForbiddenException('User is not pending approval');
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
    return { success: true, message: 'User approved successfully' };
  }

  async sendVerificationEmail(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.PENDING_VERIFICATION } });
    return { success: true, message: 'Verification email sent', otp: process.env.NODE_ENV === 'development' ? otp : undefined };
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

  // ============ TRANSACTIONS ============

  async getTransactions(siteId?: string, limit = 100) {
    const sf = this.siteFilter(siteId);
    const transactions = await this.prisma.transaction.findMany({
      where: { type: { in: ['DEPOSIT', 'WITHDRAWAL'] }, ...sf },
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
      user: t.user, createdAt: t.createdAt,
    }));
  }

  // ============ REAL STATS (excluding bots) ============

  async getRealStats(siteId?: string) {
    const sf = this.siteFilter(siteId);
    const [totalRealUsers, activeRealUsers, realDeposits, realWithdrawals, realBets, botStats] = await Promise.all([
      this.prisma.user.count({ where: { isBot: false, ...sf } }),
      this.prisma.user.count({ where: { isBot: false, lastLoginAt: { gte: new Date(Date.now() - 86400000) }, ...sf } }),
      this.prisma.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'CONFIRMED', user: { isBot: false }, ...sf }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'CONFIRMED', user: { isBot: false }, ...sf }, _sum: { amount: true } }),
      this.prisma.bet.aggregate({ where: { user: { isBot: false }, ...sf }, _sum: { betAmount: true, profit: true }, _count: true }),
      this.getBotStats(siteId),
    ]);

    const deposits = Number(realDeposits._sum.amount || 0);
    const withdrawals = Number(realWithdrawals._sum.amount || 0);
    const totalBetAmount = Number(realBets._sum.betAmount || 0);
    const totalProfit = Number(realBets._sum.profit || 0);
    const houseProfit = -totalProfit;

    return {
      totalRealUsers, activeRealUsers, totalDeposits: deposits, totalWithdrawals: withdrawals,
      netDeposits: deposits - withdrawals, totalBets: realBets._count, totalWagered: totalBetAmount,
      houseProfit, houseWallet: houseProfit,
      botVolume: botStats.totalVolume, botBets: botStats.totalBets, activeBots: botStats.activeBots,
    };
  }

  async getBotStats(siteId?: string) {
    const sf = this.siteFilter(siteId);
    const [botCount, botBets] = await Promise.all([
      this.prisma.user.count({ where: { isBot: true, ...sf } }),
      this.prisma.bet.aggregate({ where: { user: { isBot: true }, ...sf }, _sum: { betAmount: true }, _count: true }),
    ]);
    return { activeBots: botCount, totalBets: botBets._count || 0, totalVolume: Number(botBets._sum.betAmount || 0) };
  }
}
