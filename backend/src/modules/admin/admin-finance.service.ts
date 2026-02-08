import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminFinanceService {
  constructor(private prisma: PrismaService) {}

  async getFinanceStats() {
    // ==========================================
    // 1. EXTERNAL GAMES - Per Provider (GameSession table)
    // Each provider has its own feePercentage from DB
    // ==========================================
    const providers = await this.prisma.gameProvider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        feePercentage: true,
      },
    });

    // Get all completed game sessions with provider info
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        status: 'COMPLETED',
      },
      include: {
        game: {
          select: {
            providerId: true,
          },
        },
      },
    });

    // Calculate per-provider stats
    let totalExternalBets = 0;
    let totalExternalWins = 0;
    let totalProviderFees = 0;

    const providerBreakdown = providers
      .filter((p) => p.slug !== 'internal') // Skip internal provider
      .map((provider) => {
        const providerSessions = sessions.filter(
          (s) => s.game?.providerId === provider.id,
        );

        const bets = providerSessions.reduce((sum, session) => {
          return sum + parseFloat(session.totalBet?.toString() || '0');
        }, 0);

        const wins = providerSessions.reduce((sum, session) => {
          return sum + parseFloat(session.totalWin?.toString() || '0');
        }, 0);

        const ggr = bets - wins;
        // Fee is only on POSITIVE GGR (when house wins)
        // If players won more than they bet, provider doesn't charge you
        const fee = Math.max(0, ggr * (provider.feePercentage / 100));
        const netProfit = ggr - fee;

        totalExternalBets += bets;
        totalExternalWins += wins;
        totalProviderFees += fee;

        return {
          providerId: provider.id,
          providerName: provider.name,
          providerSlug: provider.slug,
          feePercentage: provider.feePercentage,
          bets: parseFloat(bets.toFixed(2)),
          wins: parseFloat(wins.toFixed(2)),
          ggr: parseFloat(ggr.toFixed(2)),
          providerFee: parseFloat(fee.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(2)),
        };
      });

    const externalGGR = totalExternalBets - totalExternalWins;

    // ==========================================
    // 2. INTERNAL GAMES - Crash & Plinko (Bet table)
    // Only count REAL users (not bots)
    // NO provider fee - 100% yours
    // ==========================================
    const internalBets = await this.prisma.bet.aggregate({
      _sum: {
        betAmount: true,
        payout: true,
      },
      where: {
        user: {
          isBot: false,
        },
      },
    });

    const internalBetTotal = parseFloat(
      internalBets._sum.betAmount?.toString() || '0',
    );
    const internalPayoutTotal = parseFloat(
      internalBets._sum.payout?.toString() || '0',
    );
    const internalGGR = internalBetTotal - internalPayoutTotal;

    // ==========================================
    // 3. COMBINED TOTALS
    // ==========================================
    const totalBets = totalExternalBets + internalBetTotal;
    const totalWins = totalExternalWins + internalPayoutTotal;
    const totalGGR = totalBets - totalWins;

    // Net Profit = Total GGR - All Provider Fees
    const netProfit = totalGGR - totalProviderFees;

    // House Edge = GGR / Total Bets
    const houseEdge = totalBets > 0 ? (totalGGR / totalBets) * 100 : 0;

    // RTP = Return to Player
    const rtp = totalBets > 0 ? (totalWins / totalBets) * 100 : 0;

    return {
      // Combined
      totalGGR: parseFloat(totalGGR.toFixed(2)),
      providerFees: parseFloat(totalProviderFees.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      totalBets: parseFloat(totalBets.toFixed(2)),
      totalWins: parseFloat(totalWins.toFixed(2)),
      houseEdge: parseFloat(houseEdge.toFixed(2)),
      rtp: parseFloat(rtp.toFixed(2)),

      // Per-Provider Breakdown (each with its own fee %)
      providerBreakdown,

      // Summary Breakdown
      breakdown: {
        external: {
          bets: parseFloat(totalExternalBets.toFixed(2)),
          wins: parseFloat(totalExternalWins.toFixed(2)),
          ggr: parseFloat(externalGGR.toFixed(2)),
          providerFee: parseFloat(totalProviderFees.toFixed(2)),
          netProfit: parseFloat((externalGGR - totalProviderFees).toFixed(2)),
        },
        internal: {
          bets: parseFloat(internalBetTotal.toFixed(2)),
          payouts: parseFloat(internalPayoutTotal.toFixed(2)),
          ggr: parseFloat(internalGGR.toFixed(2)),
          providerFee: 0, // No fee on internal games
          netProfit: parseFloat(internalGGR.toFixed(2)),
        },
      },
    };
  }

  async getDashboardStats() {
    // Get total users (real only)
    const totalUsers = await this.prisma.user.count({
      where: { isBot: false },
    });

    // Get total bots
    const totalBots = await this.prisma.user.count({
      where: { isBot: true },
    });

    // Get active sessions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeSessions = await this.prisma.gameSession.count({
      where: {
        startedAt: {
          gte: oneDayAgo,
        },
      },
    });

    // Get active users (users with bets in last 24 hours)
    const activeUsers = await this.prisma.bet.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
        user: {
          isBot: false,
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    // Get finance stats
    const financeStats = await this.getFinanceStats();

    // Get total real deposits from transactions
    const deposits = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        type: 'DEPOSIT',
        status: 'CONFIRMED',
        user: {
          isBot: false,
        },
      },
    });

    const withdrawals = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        type: 'WITHDRAWAL',
        status: 'CONFIRMED',
        user: {
          isBot: false,
        },
      },
    });

    const totalDeposits = parseFloat(deposits._sum.amount?.toString() || '0');
    const totalWithdrawals = parseFloat(
      withdrawals._sum.amount?.toString() || '0',
    );

    return {
      totalRevenue: financeStats.netProfit,
      totalUsers,
      totalBots,
      activeUsers: activeUsers.length,
      activeSessions,
      totalGGR: financeStats.totalGGR,
      providerFees: financeStats.providerFees,
      netProfit: financeStats.netProfit,
      totalDeposits: parseFloat(totalDeposits.toFixed(2)),
      totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
      houseEdge: financeStats.houseEdge,
      rtp: financeStats.rtp,
      breakdown: financeStats.breakdown,
      providerBreakdown: financeStats.providerBreakdown,
    };
  }
}
