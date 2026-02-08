import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserStats(userId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      select: {
        betAmount: true,
        payout: true,
        profit: true,
        isWin: true,
        multiplier: true,
        gameType: true,
      },
    });

    const totalBets = bets.length;
    const totalWager = bets.reduce((sum, b) => sum + parseFloat(String(b.betAmount)), 0);
    const totalWin = bets.reduce((sum, b) => sum + parseFloat(String(b.payout || 0)), 0);
    const totalProfit = bets.reduce((sum, b) => sum + parseFloat(String(b.profit || 0)), 0);
    const wonBets = bets.filter(b => b.isWin);
    const winRate = totalBets > 0 ? (wonBets.length / totalBets) * 100 : 0;
    const biggestWin = bets.reduce((max, b) => {
      const payout = parseFloat(String(b.payout || 0));
      return payout > max ? payout : max;
    }, 0);
    const biggestMultiplier = bets.reduce((max, b) => {
      const mult = parseFloat(String(b.multiplier || 0));
      return mult > max ? mult : max;
    }, 0);

    // Game breakdown
    const gameBreakdown: Record<string, { bets: number; wagered: number; won: number }> = {};
    bets.forEach(b => {
      const game = b.gameType || 'UNKNOWN';
      if (!gameBreakdown[game]) {
        gameBreakdown[game] = { bets: 0, wagered: 0, won: 0 };
      }
      gameBreakdown[game].bets++;
      gameBreakdown[game].wagered += parseFloat(String(b.betAmount));
      if (b.isWin) gameBreakdown[game].won++;
    });

    return {
      totalBets,
      totalWager: parseFloat(totalWager.toFixed(2)),
      totalWin: parseFloat(totalWin.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      biggestWin: parseFloat(biggestWin.toFixed(2)),
      biggestMultiplier: parseFloat(biggestMultiplier.toFixed(2)),
      wonBets: wonBets.length,
      lostBets: totalBets - wonBets.length,
      gameBreakdown,
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        totalWagered: true,
        vipLevel: true,
        wallets: true,
      },
    });

    if (!user) {
      return { error: 'User not found' };
    }

    const stats = await this.getUserStats(userId);

    return {
      ...user,
      stats,
    };
  }
}
