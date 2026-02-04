import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      pendingApprovalUsers,
      totalDeposits,
      totalWithdrawals,
      pendingTransactions,
      totalBets,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where: { status: 'PENDING' } }),
      this.prisma.bet.count(),
    ]);

    const deposits = Number(totalDeposits._sum.amount || 0);
    const withdrawals = Number(totalWithdrawals._sum.amount || 0);

    return {
      totalUsers,
      activeUsers,
      pendingApprovalUsers,
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      pendingTransactions,
      totalBets,
      houseProfit: deposits - withdrawals,
    };
  }

  async getAllUsers(limit = 100) {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        wallets: {
          select: {
            balance: true,
            currency: true,
          },
        },
      },
    });

    return users.map((u) => ({
      ...u,
      wallets: u.wallets.map((w) => ({
        balance: w.balance.toString(),
        currency: w.currency,
      })),
    }));
  }

  async getPendingUsers() {
    const users = await this.prisma.user.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return users;
  }

  async approveUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('User is not pending approval');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    console.log(`[ADMIN] User ${user.email} approved by admin ${adminId}`);

    return { success: true, message: 'User approved successfully' };
  }

  async sendVerificationEmail(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // In production, this would send an actual email
    // For now, we log it and update the user status
    console.log(`[EMAIL VERIFICATION] OTP for ${user.email}: ${otp}`);
    console.log(`[ADMIN] Verification email triggered for ${user.email} by admin ${adminId}`);

    // Update user status to PENDING_VERIFICATION
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        status: UserStatus.PENDING_VERIFICATION,
        // Store OTP in metadata or a separate verification table in production
      },
    });

    return { 
      success: true, 
      message: 'Verification email sent successfully',
      // In dev mode, return the OTP for testing
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async banUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Cannot ban an admin user');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.BANNED },
    });

    return { success: true, message: 'User banned successfully' };
  }

  async unbanUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    return { success: true, message: 'User unbanned successfully' };
  }

  async getTransactions(limit = 100) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        wallet: {
          select: {
            currency: true,
          },
        },
      },
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount.toString(),
      currency: t.wallet.currency,
      txHash: t.externalRef,
      walletAddress: (t.metadata as any)?.walletAddress,
      user: t.user,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Get real statistics excluding bot users
   * This provides accurate financial data for the casino
   */
  async getRealStats() {
    // Get real users count (excluding bots)
    const [
      totalRealUsers,
      activeRealUsers,
      realDeposits,
      realWithdrawals,
      realBets,
      botStats,
    ] = await Promise.all([
      // Total real users
      this.prisma.user.count({
        where: { isBot: false },
      }),
      // Active real users (logged in last 24h)
      this.prisma.user.count({
        where: {
          isBot: false,
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Total deposits from real users
      this.prisma.transaction.aggregate({
        where: {
          type: 'DEPOSIT',
          status: 'CONFIRMED',
          user: { isBot: false },
        },
        _sum: { amount: true },
      }),
      // Total withdrawals from real users
      this.prisma.transaction.aggregate({
        where: {
          type: 'WITHDRAWAL',
          status: 'CONFIRMED',
          user: { isBot: false },
        },
        _sum: { amount: true },
      }),
      // Real bets statistics
      this.prisma.bet.aggregate({
        where: {
          user: { isBot: false },
        },
        _sum: { betAmount: true, profit: true },
        _count: true,
      }),
      // Bot statistics (for display purposes)
      this.getBotStats(),
    ]);

    const deposits = Number(realDeposits._sum.amount || 0);
    const withdrawals = Number(realWithdrawals._sum.amount || 0);
    const totalBetAmount = Number(realBets._sum.betAmount || 0);
    const totalProfit = Number(realBets._sum.profit || 0);
    const betCount = realBets._count || 0;

    // House profit = player losses = negative of player profit
    const houseProfit = -totalProfit;

    return {
      // Real user metrics
      totalRealUsers,
      activeRealUsers,
      
      // Real financial metrics
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      netDeposits: deposits - withdrawals,
      
      // Real betting metrics
      totalBets: betCount,
      totalWagered: totalBetAmount,
      houseProfit: houseProfit,
      
      // House wallet (accumulated profit)
      houseWallet: houseProfit,
      
      // Bot volume (for display only)
      botVolume: botStats.totalVolume,
      botBets: botStats.totalBets,
      activeBots: botStats.activeBots,
    };
  }

  /**
   * Get bot statistics (for display purposes only)
   */
  async getBotStats() {
    const [botCount, botBets] = await Promise.all([
      this.prisma.user.count({
        where: { isBot: true },
      }),
      this.prisma.bet.aggregate({
        where: {
          user: { isBot: true },
        },
        _sum: { betAmount: true },
        _count: true,
      }),
    ]);

    return {
      activeBots: botCount,
      totalBets: botBets._count || 0,
      totalVolume: Number(botBets._sum.betAmount || 0),
    };
  }
}
