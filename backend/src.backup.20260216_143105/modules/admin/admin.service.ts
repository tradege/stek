import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { invalidateSiteCache } from '../../common/helpers/game-tenant.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

const SUPER_ADMIN_EMAIL = 'marketedgepros@gmail.com';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private prisma: PrismaService) {}

  // Helper: standard filter to exclude bots and super admin from financial stats
  private realUserFilter() {
    return { isBot: false, email: { not: SUPER_ADMIN_EMAIL } };
  }
  private realUserBetFilter() {
    return { user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } };
  }

  // Helper: build siteId filter
  private siteFilter(siteId?: string) {
    return siteId ? { siteId } : {};
  }

  // ============ DASHBOARD STATS (for frontend /admin/dashboard/stats) ============

  async getStats(siteId?: string) {
    const sf = this.siteFilter(siteId);

    const [totalUsers, activeUsers, pendingApprovalUsers, pendingTransactions] = await Promise.all([
      this.prisma.user.count({ where: { ...sf, isBot: false, email: { not: SUPER_ADMIN_EMAIL } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', ...sf, isBot: false, email: { not: SUPER_ADMIN_EMAIL } } }),
      this.prisma.user.count({ where: { status: 'PENDING_APPROVAL', ...sf } }),
      this.prisma.transaction.count({ where: { status: 'PENDING', ...sf } }),
    ]);

    const transactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: { status: 'CONFIRMED', ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, type: { in: ['DEPOSIT', 'WITHDRAWAL'] } },
    });

    const totalDeposits = Number(transactions.find(t => t.type === 'DEPOSIT')?._sum.amount || 0);
    const totalWithdrawals = Number(transactions.find(t => t.type === 'WITHDRAWAL')?._sum.amount || 0);

    const bets = await this.prisma.bet.aggregate({
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });

    const totalWagered = Number(bets._sum.betAmount || 0);
    const totalPayouts = Number(bets._sum.payout || 0);
    const totalBets = bets._count;
    const totalGGR = totalWagered - totalPayouts;

    // Per-provider fee calculation: each provider has its own fee % applied only to its games
    const allProviders = await this.prisma.gameProvider.findMany({
      where: { isActive: true },
      include: { games: { select: { slug: true } } },
    });
    const slugToGT: Record<string, string> = {
      'crash': 'CRASH', 'plinko': 'PLINKO', 'dice': 'DICE', 'mines': 'MINES',
      'limbo': 'LIMBO', 'card-rush': 'CARD_RUSH', 'nova-rush': 'NOVA_RUSH',
      'dragon-blaze': 'DRAGON_BLAZE', 'penalty': 'PENALTY_SHOOTOUT',
      'book-of-dead': 'EXTERNAL', 'sweet-bonanza': 'EXTERNAL',
      'gates-of-olympus': 'OLYMPUS', 'starburst': 'EXTERNAL',
      'big-bass-bonanza': 'EXTERNAL',
      'blackjack-live': 'BLACKJACK', 'roulette-live': 'ROULETTE', 'baccarat-live': 'BACCARAT',
    };
    const gtToFee: Record<string, number> = {};
    for (const prov of allProviders) {
      for (const game of prov.games) {
        const gt = slugToGT[game.slug];
        if (gt) gtToFee[gt] = prov.feePercentage / 100;
      }
    }
    // Calculate total provider fees from per-game GGR
    const perGameBets = await this.prisma.bet.groupBy({
      by: ['gameType'],
      _sum: { betAmount: true, payout: true },
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });
    let providerFees = 0;
    for (const g of perGameBets) {
      const gameGgr = Number(g._sum.betAmount || 0) - Number(g._sum.payout || 0);
      const fee = gtToFee[g.gameType] || 0;
      if (gameGgr > 0 && fee > 0) providerFees += gameGgr * fee;
    }
    const netProfit = totalGGR - providerFees;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersLast24h = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: oneDayAgo }, ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });

    // activeSessions = active users in last 24h
    const activeSessions = activeUsersLast24h.length;

    // Highest single win (payout) for homepage stats
    const highestWinBet = await this.prisma.bet.findFirst({
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, payout: { gt: 0 } },
      orderBy: { payout: 'desc' },
      select: { payout: true },
    });
    const highestWin = Number(highestWinBet?.payout || 0);

    // Recent real wins for homepage ticker (non-bot, profitable bets)
    const recentWinBets = await this.prisma.bet.findMany({
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, payout: { gt: 0 }, profit: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        user: { select: { username: true } },
        gameType: true,
        multiplier: true,
        payout: true,
      },
    });
    const gameColors: Record<string, string> = {
      CRASH: 'text-red-400', DICE: 'text-green-400', MINES: 'text-yellow-400',
      PLINKO: 'text-blue-400', OLYMPUS: 'text-purple-400', CARD_RUSH: 'text-orange-400',
      LIMBO: 'text-emerald-400', PENALTY: 'text-teal-400',
    };
    const recentWins = recentWinBets.map(b => {
      const username = b.user?.username || 'Anonymous';
      const masked = username.length > 3
        ? username.substring(0, 2) + '***' + username.substring(username.length - 2)
        : username.substring(0, 1) + '***';
      return {
        user: masked,
        game: (b.gameType || 'Casino').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        multiplier: Number(b.multiplier || 1),
        amount: Number(b.payout || 0),
        color: gameColors[b.gameType || ''] || 'text-gray-400',
      };
    });

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
      highestWin,
      recentWins,
      stats: { wagered: totalWagered, payouts: totalPayouts },
    };
  }

  // ============ PUBLIC PLATFORM STATS (safe for homepage, no auth required) ============

  async getPublicStats(siteId?: string) {
    const sf = this.siteFilter(siteId);

    const bets = await this.prisma.bet.aggregate({
      _sum: { betAmount: true, payout: true },
      _count: true,
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });

    const totalWagered = Number(bets._sum.betAmount || 0);
    const totalBets = bets._count;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersLast24h = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: oneDayAgo }, ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });

    const highestWinBet = await this.prisma.bet.findFirst({
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, payout: { gt: 0 } },
      orderBy: { payout: 'desc' },
      select: { payout: true },
    });
    const highestWin = Number(highestWinBet?.payout || 0);

    const recentWinBets = await this.prisma.bet.findMany({
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, payout: { gt: 0 }, profit: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        user: { select: { username: true } },
        gameType: true,
        multiplier: true,
        payout: true,
      },
    });
    const gameColorsPublic: Record<string, string> = {
      CRASH: 'text-red-400', DICE: 'text-green-400', MINES: 'text-yellow-400',
      PLINKO: 'text-blue-400', OLYMPUS: 'text-purple-400', CARD_RUSH: 'text-orange-400',
      LIMBO: 'text-emerald-400', PENALTY: 'text-teal-400',
    };
    const recentWins = recentWinBets.map(b => {
      const username = b.user?.username || 'Anonymous';
      const masked = username.length > 3
        ? username.substring(0, 2) + '***' + username.substring(username.length - 2)
        : username.substring(0, 1) + '***';
      return {
        user: masked,
        game: (b.gameType || 'Casino').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        multiplier: Number(b.multiplier || 1),
        amount: Number(b.payout || 0),
        color: gameColorsPublic[b.gameType || ''] || 'text-gray-400',
      };
    });

    // Only return safe-to-share metrics (no deposits, withdrawals, GGR, etc.)
    return {
      totalBets,
      totalWagered,
      activeUsers: activeUsersLast24h.length,
      highestWin,
      recentWins,
    };
  }

  // ============ FINANCE STATS (for frontend /admin/finance/stats) ============

  async getFinanceStats(siteId?: string) {
    const sf = this.siteFilter(siteId);

    const bets = await this.prisma.bet.aggregate({
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });

    const totalBets = Number(bets._sum.betAmount || 0);
    const totalWins = Number(bets._sum.payout || 0);
    const betCount = bets._count;
    const ggr = totalBets - totalWins;
    const houseEdge = totalBets > 0 ? ((ggr / totalBets) * 100).toFixed(2) : '0';
    const rtp = totalBets > 0 ? ((totalWins / totalBets) * 100).toFixed(2) : '0';

    // ---- Per-provider fee calculation ----
    // Fetch all providers with their fee percentages
    const providers = await this.prisma.gameProvider.findMany({
      where: { isActive: true },
      include: { games: { select: { slug: true, name: true, category: true } } },
    });

    // Build a mapping: GameType enum -> provider slug -> feePercentage
    // The Game catalog links games to providers via slug
    const gameTypeToProviderSlug: Record<string, string> = {};
    const slugToGameType: Record<string, string> = {
      'crash': 'CRASH', 'plinko': 'PLINKO', 'dice': 'DICE', 'mines': 'MINES',
      'limbo': 'LIMBO', 'card-rush': 'CARD_RUSH', 'nova-rush': 'NOVA_RUSH',
      'dragon-blaze': 'DRAGON_BLAZE', 'penalty': 'PENALTY_SHOOTOUT',
      'book-of-dead': 'EXTERNAL', 'sweet-bonanza': 'EXTERNAL',
      'gates-of-olympus': 'OLYMPUS', 'starburst': 'EXTERNAL',
      'big-bass-bonanza': 'EXTERNAL',
      'blackjack-live': 'BLACKJACK', 'roulette-live': 'ROULETTE', 'baccarat-live': 'BACCARAT',
    };

    // Map each game to its provider
    for (const provider of providers) {
      for (const game of provider.games) {
        const gameType = slugToGameType[game.slug];
        if (gameType) {
          gameTypeToProviderSlug[gameType] = provider.slug;
        }
      }
    }

    const providerFeeMap: Record<string, number> = {};
    for (const p of providers) {
      providerFeeMap[p.slug] = p.feePercentage / 100; // e.g., 8 -> 0.08
    }

    // Per-game breakdown with provider fee
    const gameBreakdown = await this.prisma.bet.groupBy({
      by: ['gameType'],
      _sum: { betAmount: true, payout: true },
      _count: true,
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
    });

    let totalProviderFee = 0;
    const providerBreakdown: Record<string, { name: string; feePercent: number; ggr: number; fee: number; games: string[] }> = {};

    // Initialize provider breakdown
    for (const p of providers) {
      providerBreakdown[p.slug] = { name: p.name, feePercent: p.feePercentage, ggr: 0, fee: 0, games: [] };
    }

    const games = gameBreakdown.map(g => {
      const gameBets = Number(g._sum.betAmount || 0);
      const gameWins = Number(g._sum.payout || 0);
      const gameGgr = gameBets - gameWins;

      // Find the provider for this game type
      const providerSlug = gameTypeToProviderSlug[g.gameType] || 'internal';
      const feeRate = providerFeeMap[providerSlug] || 0;
      const gameFee = gameGgr > 0 ? gameGgr * feeRate : 0;
      totalProviderFee += gameFee;

      // Accumulate into provider breakdown
      if (providerBreakdown[providerSlug]) {
        providerBreakdown[providerSlug].ggr += gameGgr;
        providerBreakdown[providerSlug].fee += gameFee;
        if (!providerBreakdown[providerSlug].games.includes(g.gameType)) {
          providerBreakdown[providerSlug].games.push(g.gameType);
        }
      }

      return {
        game: g.gameType,
        bets: gameBets,
        wins: gameWins,
        ggr: gameGgr,
        count: g._count,
        rtp: gameBets > 0 ? ((gameWins / gameBets) * 100).toFixed(2) : '0',
        provider: providerSlug,
        feePercent: feeRate * 100,
        fee: gameFee,
      };
    });

    const netProfit = ggr - totalProviderFee;

    // Transaction stats
    const transactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
      _count: true,
      where: { status: 'CONFIRMED', ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, type: { in: ['DEPOSIT', 'WITHDRAWAL'] } },
    });

    const deposits = Number(transactions.find(t => t.type === 'DEPOSIT')?._sum.amount || 0);
    const withdrawals = Number(transactions.find(t => t.type === 'WITHDRAWAL')?._sum.amount || 0);

    return {
      totalBets,
      totalWins,
      betCount,
      ggr,
      providerFee: totalProviderFee,
      netProfit,
      houseEdge,
      rtp,
      deposits,
      withdrawals,
      netDeposits: deposits - withdrawals,
      gameBreakdown: games,
      providerBreakdown: Object.values(providerBreakdown).filter(p => p.ggr !== 0 || p.fee !== 0),
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
      // Smart Parse: if value > 1 (e.g. 4), treat as percentage -> convert to 0.04
      // If value <= 1 (e.g. 0.04), treat as decimal -> keep as-is
      let edge: number;
      if (body.houseEdge > 1) {
        edge = body.houseEdge / 100; // e.g. 4 -> 0.04
      } else {
        edge = body.houseEdge; // e.g. 0.04 -> 0.04
      }
      // Validate: must be between 0.001 (0.1%) and 0.20 (20%)
      edge = Math.max(0.001, Math.min(0.20, edge));
      updateData.houseEdgeConfig = {
        crash: edge,
        dice: edge,
        mines: edge,
        plinko: edge,
        olympus: edge,
        penalty: edge,
        cardRush: edge,
        limbo: edge,
      };
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.siteConfiguration.update({
        where: { id: targetSiteId },
        data: updateData,
      });
      // Invalidate game config cache so games pick up new values immediately
      invalidateSiteCache(targetSiteId);
      this.logger.log(`House edge updated for ${targetSiteId}`);
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
      this.prisma.bet.aggregate({ _sum: { betAmount: true, payout: true }, _count: true, where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } } }),
      this.prisma.bet.aggregate({ _sum: { betAmount: true, payout: true }, _count: true, where: { createdAt: { gte: today }, ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } } }),
      this.prisma.user.count({ where: { ...sf, isBot: false, email: { not: SUPER_ADMIN_EMAIL } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', ...sf, isBot: false, email: { not: SUPER_ADMIN_EMAIL } } }),
    ]);

    const allBets = Number(allTimeBets._sum.betAmount || 0);
    const allWins = Number(allTimeBets._sum.payout || 0);
    const todayBetsAmt = Number(todayBets._sum.betAmount || 0);
    const todayWins = Number(todayBets._sum.payout || 0);

    const gameBreakdown = await this.prisma.bet.groupBy({
      by: ['gameType'],
      _sum: { betAmount: true, payout: true },
      _count: true,
      where: { ...sf, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } },
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
        this.prisma.user.count({ where: { siteId: site.id, isBot: false, email: { not: SUPER_ADMIN_EMAIL } } }),
        this.prisma.bet.aggregate({ _sum: { betAmount: true, payout: true }, _count: true, where: { siteId: site.id, user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } } } }),
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
    invalidateSiteCache(siteId);
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

  async getAllUsers(siteId?: string, limit = 200) {
    const sf = this.siteFilter(siteId);
    const users = await this.prisma.user.findMany({
      where: { ...sf },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, username: true, email: true, status: true, role: true,
        createdAt: true, lastLoginAt: true, isBot: true, siteId: true,
        vipLevel: true, totalWagered: true,
        wallets: { select: { balance: true, currency: true } },
      },
    });

    // Batch fetch bet stats for all users in one query
    const userIds = users.map(u => u.id);
    const betStats = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
    });
    const betMap = new Map(betStats.map(b => [b.userId, b]));

    // Batch fetch transaction stats for all users
    const txStats = await this.prisma.transaction.groupBy({
      by: ['userId', 'type'],
      where: { userId: { in: userIds }, status: 'CONFIRMED' },
      _sum: { amount: true },
    });
    const txMap = new Map<string, { deposits: number; withdrawals: number }>();
    for (const tx of txStats) {
      if (!txMap.has(tx.userId)) txMap.set(tx.userId, { deposits: 0, withdrawals: 0 });
      const entry = txMap.get(tx.userId)!;
      if (tx.type === 'DEPOSIT') entry.deposits = Number(tx._sum.amount || 0);
      if (tx.type === 'WITHDRAWAL') entry.withdrawals = Number(tx._sum.amount || 0);
    }

    return users.map((u) => {
      const bs = betMap.get(u.id);
      const ts = txMap.get(u.id);
      return {
        ...u,
        totalWagered: Number(u.totalWagered || 0),
        wallets: u.wallets.map((w) => ({ balance: w.balance.toString(), currency: w.currency })),
        stats: {
          totalBets: bs?._count || 0,
          totalWagered: Number(bs?._sum.betAmount || 0),
          totalPayout: Number(bs?._sum.payout || 0),
          profit: Number(bs?._sum.profit || 0),
          deposits: ts?.deposits || 0,
          withdrawals: ts?.withdrawals || 0,
        },
      };
    });
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
      this.prisma.user.count({ where: { isBot: false, email: { not: SUPER_ADMIN_EMAIL }, ...sf } }),
      this.prisma.user.count({ where: { isBot: false, email: { not: SUPER_ADMIN_EMAIL }, lastLoginAt: { gte: new Date(Date.now() - 86400000) }, ...sf } }),
      this.prisma.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'CONFIRMED', user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, ...sf }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'CONFIRMED', user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, ...sf }, _sum: { amount: true } }),
      this.prisma.bet.aggregate({ where: { user: { isBot: false, email: { not: SUPER_ADMIN_EMAIL } }, ...sf }, _sum: { betAmount: true, profit: true }, _count: true }),
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

  // ============ USER DETAIL & BALANCE ============

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, email: true, status: true, role: true,
        displayName: true, avatarUrl: true, country: true, language: true, timezone: true,
        twoFactorEnabled: true, lastLoginAt: true, lastLoginIp: true,
        vipLevel: true, totalWagered: true, xp: true, isBot: true,
        createdAt: true, updatedAt: true, siteId: true,
        wallets: { select: { id: true, balance: true, currency: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Get bet stats
    const betStats = await this.prisma.bet.aggregate({
      where: { userId },
      _sum: { betAmount: true, payout: true, profit: true },
      _count: true,
    });

    // Get transaction stats
    const txStats = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, status: 'CONFIRMED' },
      _sum: { amount: true },
      _count: true,
    });

    return {
      ...user,
      totalWagered: user.totalWagered.toString(),
      wallets: user.wallets.map(w => ({ ...w, balance: w.balance.toString() })),
      stats: {
        totalBets: betStats._count,
        totalWagered: Number(betStats._sum.betAmount || 0),
        totalPayout: Number(betStats._sum.payout || 0),
        totalProfit: Number(betStats._sum.profit || 0),
        deposits: Number(txStats.find(t => t.type === 'DEPOSIT')?._sum.amount || 0),
        withdrawals: Number(txStats.find(t => t.type === 'WITHDRAWAL')?._sum.amount || 0),
      },
    };
  }

  async getUserBets(userId: string, limit = 20) {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, gameType: true, currency: true,
        betAmount: true, multiplier: true, payout: true, profit: true,
        isWin: true, gameData: true, createdAt: true,
      },
    });

    return bets.map(b => ({
      ...b,
      betAmount: b.betAmount.toString(),
      multiplier: b.multiplier.toString(),
      payout: b.payout.toString(),
      profit: b.profit.toString(),
    }));
  }

  async adjustUserBalance(userId: string, amount: number, reason: string, adminId: string) {
    const wallet = await this.prisma.wallet.findFirst({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for user');

    const currentBalance = Number(wallet.balance);
    const newBalance = currentBalance + amount;
    if (newBalance < 0) throw new ForbiddenException('Cannot set balance below zero');

    const txType = amount >= 0 ? 'DEPOSIT' : 'WITHDRAWAL';
    const txData: any = {
      user: { connect: { id: userId } },
      wallet: { connect: { id: wallet.id } },
      type: txType,
      amount: Math.abs(amount),
      status: 'CONFIRMED',
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      externalRef: `ADMIN-${adminId}-${Date.now()}`,
      metadata: { adminId, reason, type: 'ADMIN_ADJUSTMENT' },
    };
    if (wallet.siteId) { txData.site = { connect: { id: wallet.siteId } }; }

    await this.prisma.$transaction([
      this.prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } }),
      this.prisma.transaction.create({ data: txData }),
    ]);

    this.logger.log(`Admin ${adminId} adjusted balance for user ${userId}: ${amount > 0 ? '+' : ''}${amount} (${reason})`);
    return { success: true, message: `Balance adjusted by ${amount > 0 ? '+' : ''}$${Math.abs(amount)}`, newBalance, reason };
  }

  // ============ WITHDRAWAL MANAGEMENT ============

  async getWithdrawals(siteId?: string, status?: string, limit = 100) {
    const sf = this.siteFilter(siteId);
    const where: any = { type: 'WITHDRAWAL', ...sf };
    if (status && status !== 'ALL') { where.status = status; }

    const withdrawals = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, email: true, lastLoginIp: true, vipLevel: true } },
        wallet: { select: { currency: true } },
      },
    });

    return withdrawals.map(w => ({
      id: w.id,
      userId: w.userId,
      username: w.user.username,
      email: w.user.email,
      amount: w.amount.toString(),
      currency: w.wallet.currency,
      status: w.status,
      walletAddress: (w.metadata as any)?.walletAddress || (w.metadata as any)?.address || 'N/A',
      network: (w.metadata as any)?.network || 'N/A',
      userIp: w.user.lastLoginIp || 'N/A',
      vipLevel: w.user.vipLevel,
      riskScore: this.calculateRiskScore(w),
      externalRef: w.externalRef,
      createdAt: w.createdAt,
      confirmedAt: w.confirmedAt,
    }));
  }

  private calculateRiskScore(withdrawal: any): { score: number; level: string } {
    let score = 0;
    const amount = Number(withdrawal.amount);
    if (amount > 5000) score += 30;
    else if (amount > 1000) score += 15;
    else if (amount > 500) score += 5;
    if (!withdrawal.user.lastLoginIp) score += 20;
    if (withdrawal.user.vipLevel === 0) score += 10;
    const level = score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
    return { score, level };
  }

  async approveWithdrawal(transactionId: string, adminId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Withdrawal not found');
    if (tx.type !== 'WITHDRAWAL') throw new ForbiddenException('Transaction is not a withdrawal');
    if (tx.status !== 'PENDING') throw new ForbiddenException('Withdrawal is not pending');

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });

    this.logger.log(`Withdrawal ${transactionId} approved by admin ${adminId}`);
    return { success: true, message: 'Withdrawal approved' };
  }

  async rejectWithdrawal(transactionId: string, adminId: string, reason?: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: true },
    });
    if (!tx) throw new NotFoundException('Withdrawal not found');
    if (tx.type !== 'WITHDRAWAL') throw new ForbiddenException('Transaction is not a withdrawal');
    if (tx.status !== 'PENDING') throw new ForbiddenException('Withdrawal is not pending');

    // Refund the balance
    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'CANCELLED', metadata: { ...(tx.metadata as any || {}), rejectedBy: adminId, rejectReason: reason } },
      }),
      this.prisma.wallet.update({
        where: { id: tx.walletId },
        data: { balance: { increment: tx.amount } },
      }),
    ]);

    this.logger.log(`Withdrawal ${transactionId} rejected by admin ${adminId}: ${reason}`);
    return { success: true, message: 'Withdrawal rejected, balance refunded' };
  }

  // ============ GLOBAL GAME HISTORY ============

  async getGameHistory(siteId?: string, filters?: { gameType?: string; minBet?: number; minWin?: number; limit?: number }) {
    const sf = this.siteFilter(siteId);
    const where: any = { ...sf };

    if (filters?.gameType && filters.gameType !== 'ALL') {
      where.gameType = filters.gameType;
    }
    if (filters?.minBet) {
      where.betAmount = { gte: filters.minBet };
    }
    if (filters?.minWin) {
      where.payout = { gte: filters.minWin };
    }

    const bets = await this.prisma.bet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      include: {
        user: { select: { id: true, username: true, isBot: true } },
      },
    });

    return bets.map(b => ({
      id: b.id,
      userId: b.userId,
      username: b.user.username,
      isBot: b.user.isBot,
      gameType: b.gameType,
      currency: b.currency,
      betAmount: b.betAmount.toString(),
      multiplier: b.multiplier.toString(),
      payout: b.payout.toString(),
      profit: b.profit.toString(),
      isWin: b.isWin,
      gameData: b.gameData,
      createdAt: b.createdAt,
    }));
  }

  // ============ AFFILIATE CONFIGURATION ============

  private readonly DEFAULT_AFFILIATE_CONFIG = {
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

  async getAffiliateConfig(siteId?: string) {
    const site = siteId
      ? await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } })
      : await this.prisma.siteConfiguration.findFirst({ where: { active: true } });

    const config = (site?.affiliateConfig as any) || this.DEFAULT_AFFILIATE_CONFIG;

    return {
      data: config,
      siteId: site?.id || null,
      brandName: site?.brandName || null,
    };
  }

  async updateAffiliateConfig(siteId: string | undefined, body: any) {
    const targetSiteId = siteId || 'default-site-001';

    // Validate the config structure
    if (!body.tiers || typeof body.tiers !== 'object') {
      throw new Error('Invalid affiliate config: tiers object is required');
    }

    // Validate each tier has required fields
    for (const [tierName, tierConfig] of Object.entries(body.tiers)) {
      const tc = tierConfig as any;
      if (tc.tier1Rate === undefined || tc.minPlayers === undefined) {
        throw new Error(`Invalid tier config for ${tierName}: tier1Rate and minPlayers are required`);
      }
      // Ensure rates are decimals (0-1), not percentages
      if (tc.tier1Rate > 1) tc.tier1Rate = tc.tier1Rate / 100;
      if (tc.tier2Rate > 1) tc.tier2Rate = tc.tier2Rate / 100;
      if (tc.tier3Rate > 1) tc.tier3Rate = tc.tier3Rate / 100;
    }

    const config = {
      model: body.model || 'REVENUE_SHARE',
      tiers: body.tiers,
    };

    await this.prisma.siteConfiguration.update({
      where: { id: targetSiteId },
      data: { affiliateConfig: config },
    });

    this.logger.log(`Affiliate config updated for site ${targetSiteId}`);

    return { success: true, data: config };
  }
}
