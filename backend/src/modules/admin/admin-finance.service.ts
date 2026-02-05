import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminFinanceService {
  constructor(private prisma: PrismaService) {}

  async getFinanceStats() {
    // Get all game sessions
    const sessions = await this.prisma.gameSession.findMany({
      select: {
        totalBet: true,
        totalWin: true,
        status: true,
      },
    });

    // Calculate totals
    const totalBets = sessions.reduce((sum, session) => {
      return sum + parseFloat(session.totalBet.toString() || '0');
    }, 0);

    const totalWins = sessions.reduce((sum, session) => {
      return sum + parseFloat(session.totalWin.toString() || '0');
    }, 0);

    // Calculate GGR (Gross Gaming Revenue)
    const totalGGR = totalBets - totalWins;

    // Calculate Provider Fees (8% of GGR)
    const providerFees = totalGGR * 0.08;

    // Calculate Net Profit (GGR - Provider Fees)
    const netProfit = totalGGR - providerFees;

    // Calculate House Edge
    const houseEdge = totalBets > 0 ? (totalGGR / totalBets) * 100 : 0;

    // Calculate RTP (Return to Player)
    const rtp = totalBets > 0 ? (totalWins / totalBets) * 100 : 0;

    return {
      totalGGR: parseFloat(totalGGR.toFixed(2)),
      providerFees: parseFloat(providerFees.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      totalBets: parseFloat(totalBets.toFixed(2)),
      totalWins: parseFloat(totalWins.toFixed(2)),
      houseEdge: parseFloat(houseEdge.toFixed(2)),
      rtp: parseFloat(rtp.toFixed(2)),
    };
  }

  async getDashboardStats() {
    // Get total users
    const totalUsers = await this.prisma.user.count();

    // Get active sessions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeSessions = await this.prisma.gameSession.count({
      where: {
        startedAt: {
          gte: oneDayAgo,
        },
      },
    });

    // Get active users (users with sessions in last 24 hours)
    const activeUsers = await this.prisma.gameSession.findMany({
      where: {
        startedAt: {
          gte: oneDayAgo,
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    // Get finance stats
    const financeStats = await this.getFinanceStats();

    // Get total deposits (sum of all user wallets)
    const wallets = await this.prisma.wallet.findMany({
      select: {
        balance: true,
      },
    });

    const totalDeposits = wallets.reduce((sum, wallet) => {
      return sum + parseFloat(wallet.balance.toString() || '0');
    }, 0);

    // Calculate withdrawals (estimate based on GGR)
    const totalWithdrawals = Math.max(0, totalDeposits - financeStats.netProfit);

    return {
      totalRevenue: financeStats.netProfit,
      totalUsers,
      activeUsers: activeUsers.length,
      activeSessions,
      totalGGR: financeStats.totalGGR,
      providerFees: financeStats.providerFees,
      netProfit: financeStats.netProfit,
      totalDeposits: parseFloat(totalDeposits.toFixed(2)),
      totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
    };
  }
}
