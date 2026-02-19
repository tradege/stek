import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialStats(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const where: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    // 1. Total Wagered & Payout (Internal Games from Bet table)
    const internalBets = await this.prisma.bet.aggregate({
      _sum: {
        betAmount: true,
        payout: true,
      },
      where: {
        ...where,
        user: { isBot: false },
      },
    });

    const totalWagered = parseFloat(internalBets._sum.betAmount?.toString() || '0');
    const totalPayout = parseFloat(internalBets._sum.payout?.toString() || '0');
    const ggr = totalWagered - totalPayout;

    // 2. Affiliate Costs
    const affiliateCommissions = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'COMMISSION',
        status: 'CONFIRMED',
        createdAt: { gte: start, lte: end },
      },
    });
    const affiliateCost = parseFloat(affiliateCommissions._sum.amount?.toString() || '0');

    // 3. Bonus Costs
    const bonusTransactions = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'RAIN_RECEIVED',
        status: 'CONFIRMED',
        createdAt: { gte: start, lte: end },
      },
    });
    const bonusCost = parseFloat(bonusTransactions._sum.amount?.toString() || '0');

    // 4. Net Profit (NGR)
    const ngr = ggr - affiliateCost - bonusCost;

    // 5. Daily Breakdown for Charts
    const dailyStats = await this.getDailyBreakdown(start, end);

    // 6. Top Players
    const topPlayers = await this.getTopPlayers();

    // 7. Deposits & Withdrawals for KPI cards
    const deposits = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'DEPOSIT', status: 'CONFIRMED', createdAt: { gte: start, lte: end } }
    });
    const withdrawals = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'WITHDRAWAL', status: 'CONFIRMED', createdAt: { gte: start, lte: end } }
    });

    return {
      summary: {
        totalWagered: parseFloat(totalWagered.toFixed(2)),
        totalPayout: parseFloat(totalPayout.toFixed(2)),
        ggr: parseFloat(ggr.toFixed(2)),
        affiliateCost: parseFloat(affiliateCost.toFixed(2)),
        bonusCost: parseFloat(bonusCost.toFixed(2)),
        ngr: parseFloat(ngr.toFixed(2)),
        totalDeposits: parseFloat(deposits._sum.amount?.toString() || '0'),
        totalWithdrawals: parseFloat(withdrawals._sum.amount?.toString() || '0'),
      },
      dailyStats,
      topPlayers,
    };
  }

  private async getDailyBreakdown(start: Date, end: Date) {
    const days = [];
    const current = new Date(start);
    while (current <= end) {
      const dayStart = new Date(current.setHours(0, 0, 0, 0));
      const dayEnd = new Date(current.setHours(23, 59, 59, 999));
      
      const bets = await this.prisma.bet.aggregate({
        _sum: { betAmount: true, payout: true },
        where: { createdAt: { gte: dayStart, lte: dayEnd }, user: { isBot: false } }
      });

      const dayWagered = parseFloat(bets._sum.betAmount?.toString() || '0');
      const dayPayout = parseFloat(bets._sum.payout?.toString() || '0');
      const dayGGR = dayWagered - dayPayout;

      days.push({
        date: dayStart.toISOString().split('T')[0],
        ggr: parseFloat(dayGGR.toFixed(2)),
        ngr: parseFloat(dayGGR.toFixed(2)),
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private async getTopPlayers() {
    const whales = await this.prisma.bet.groupBy({
      by: ['userId'],
      _sum: { betAmount: true, payout: true },
      orderBy: { _sum: { betAmount: 'desc' } },
      take: 10,
    });

    const sharks = await this.prisma.bet.groupBy({
      by: ['userId'],
      _sum: { payout: true },
      orderBy: { _sum: { payout: 'desc' } },
      take: 10,
    });

    // Hydrate with usernames if possible
    const whaleDetails = await Promise.all(whales.map(async (w) => {
      const user = await this.prisma.user.findUnique({ where: { id: w.userId }, select: { username: true } });
      const netLoss = parseFloat(w._sum.betAmount?.toString() || '0') - parseFloat(w._sum.payout?.toString() || '0');
      return { userId: w.userId, username: user?.username || 'Unknown', netLoss };
    }));

    const sharkDetails = await Promise.all(sharks.map(async (s) => {
      const user = await this.prisma.user.findUnique({ where: { id: s.userId }, select: { username: true } });
      const netWin = parseFloat(s._sum.payout?.toString() || '0') - parseFloat(s._sum.payout?.toString() || '0'); // Simplified
      return { userId: s.userId, username: user?.username || 'Unknown', netWin: parseFloat(s._sum.payout?.toString() || '0') };
    }));

    return { 
      whales: whaleDetails.sort((a, b) => b.netLoss - a.netLoss), 
      sharks: sharkDetails.sort((a, b) => b.netWin - a.netWin) 
    };
  }

  async getFinanceStats() {
    // Keep for backward compatibility if needed
    return this.getFinancialStats();
  }

  async getDashboardStats() {
    const totalUsers = await this.prisma.user.count({ where: { isBot: false } });
    const totalBots = await this.prisma.user.count({ where: { isBot: true } });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeSessions = await this.prisma.gameSession.count({ where: { startedAt: { gte: oneDayAgo } } });
    const activeUsers = await this.prisma.bet.findMany({
      where: { createdAt: { gte: oneDayAgo }, user: { isBot: false } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const fin = await this.getFinancialStats();
    return {
      ...fin.summary,
      totalUsers,
      totalBots,
      activeUsers: activeUsers.length,
      activeSessions,
    };
  }
}
