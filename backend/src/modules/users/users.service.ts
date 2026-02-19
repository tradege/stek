import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformStats() {
    const [totalBets, totalUsers, totalWagered, highestMultiplier] = await Promise.all([
      this.prisma.bet.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.bet.aggregate({ _sum: { betAmount: true } }),
      this.prisma.bet.aggregate({ _max: { multiplier: true } }),
    ]);

    return {
      totalWagered: Number(totalWagered._sum.betAmount || 0),
      gamesPlayed: totalBets,
      highestWin: Number(highestMultiplier._max.multiplier || 0),
      activePlayers: totalUsers,
    };
  }

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
      totalWon: totalWin.toFixed(2),
      totalLost: (totalWager - totalWin).toFixed(2),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      biggestWin: parseFloat(biggestWin.toFixed(2)),
      biggestMultiplier: parseFloat(biggestMultiplier.toFixed(2)),
      wonBets: wonBets.length,
      lostBets: totalBets - wonBets.length,
      favoriteGame: Object.entries(gameBreakdown).sort((a, b) => b[1].bets - a[1].bets)[0]?.[0] || 'N/A',
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
        displayName: true,
        avatarUrl: true,
        country: true,
        language: true,
        timezone: true,
        twoFactorEnabled: true,
        createdAt: true,
        totalWagered: true,
        vipLevel: true,
        lastLoginAt: true,
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

  /**
   * TASK 40-3: Update user profile
   */
  async updateProfile(userId: string, data: {
    avatarUrl?: string;
    displayName?: string;
    email?: string;
    password?: string;
    language?: string;
    timezone?: string;
    country?: string;
    settings?: {
      privacyMode?: boolean;
    };
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const updateData: any = {};

    // Avatar URL
    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }

    // Display name
    if (data.displayName !== undefined) {
      if (data.displayName.length < 2 || data.displayName.length > 30) {
        throw new BadRequestException('Display name must be 2-30 characters');
      }
      updateData.displayName = data.displayName;
    }

    // Email change requires password verification
    if (data.email && data.email !== user.email) {
      if (!data.password) {
        throw new BadRequestException('Password is required to change email');
      }

      let isPasswordValid = false;
      if (user.passwordHash.startsWith('$argon2')) {
        isPasswordValid = await argon2.verify(user.passwordHash, data.password);
      } else {
        isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      }

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }

      // Check if new email is already taken
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existingUser) {
        throw new BadRequestException('Email is already in use');
      }

      updateData.email = data.email.toLowerCase();
    }

    // Language
    if (data.language !== undefined) {
      updateData.language = data.language;
    }

    // Timezone
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone;
    }

    // Country
    if (data.country !== undefined) {
      updateData.country = data.country;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true, message: 'No changes to apply' };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        country: true,
        language: true,
        timezone: true,
      },
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      user: updated,
    };
  }

  async getUserBets(userId: string, page: number = 1, limit: number = 20, gameType?: string) {
    const where: any = { userId };
    if (gameType) {
      where.gameType = gameType;
    }

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          gameType: true,
          betAmount: true,
          multiplier: true,
          payout: true,
          profit: true,
          isWin: true,
          currency: true,
          createdAt: true,
        },
      }),
      this.prisma.bet.count({ where }),
    ]);

    return {
      bets: bets.map(b => ({
        ...b,
        betAmount: Number(b.betAmount),
        multiplier: Number(b.multiplier),
        payout: Number(b.payout || 0),
        profit: Number(b.profit || 0),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserTransactions(userId: string, page: number = 1, limit: number = 20, type?: string) {
    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          balanceBefore: true,
          balanceAfter: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore || 0),
        balanceAfter: Number(t.balanceAfter || 0),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserFinancialSummary(userId: string) {
    const [deposits, withdrawals, bets, wallets] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'DEPOSIT', status: 'CONFIRMED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'WITHDRAWAL', status: 'CONFIRMED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bet.aggregate({
        where: { userId },
        _sum: { betAmount: true, payout: true, profit: true },
        _count: true,
      }),
      this.prisma.wallet.findMany({
        where: { userId },
        select: {
          currency: true,
          balance: true,
          bonusBalance: true,
        },
      }),
    ]);

    const totalDeposited = Number(deposits._sum.amount || 0);
    const totalWithdrawn = Number(withdrawals._sum.amount || 0);
    const totalWagered = Number(bets._sum.betAmount || 0);
    const totalWon = Number(bets._sum.payout || 0);
    const totalProfit = Number(bets._sum.profit || 0);
    const netPnL = totalDeposited - totalWithdrawn + totalProfit;

    return {
      totalDeposited: parseFloat(totalDeposited.toFixed(2)),
      totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
      totalWagered: parseFloat(totalWagered.toFixed(2)),
      totalWon: parseFloat(totalWon.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      netPnL: parseFloat(netPnL.toFixed(2)),
      depositCount: deposits._count,
      withdrawalCount: withdrawals._count,
      betCount: bets._count,
      wallets: wallets.map(w => ({
        currency: w.currency,
        balance: Number(w.balance) + Number(w.bonusBalance || 0),
      })),
    };
  }
}
