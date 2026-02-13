'use strict';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { getWithdrawalLimit } from "../users/vip.config";

@Injectable()
export class CashierService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user's wallet balances - TENANT SCOPED
   */
  async getUserBalances(userId: string, siteId?: string) {
    const where: any = { userId };
    if (siteId) where.siteId = siteId;

    const wallets = await this.prisma.wallet.findMany({
      where,
      select: {
        id: true,
        currency: true,
        balance: true,
        lockedBalance: true,
        updatedAt: true,
      },
    });

    return wallets.map((w) => ({
      ...w,
      available: w.balance.toString(),
      locked: w.lockedBalance.toString(),
      total: new Decimal(w.balance).plus(w.lockedBalance).toString(),
    }));
  }

  /**
   * Get user's transaction history - TENANT SCOPED
   */
  async getUserTransactions(userId: string, limit = 50, siteId?: string) {
    const where: any = { userId };
    if (siteId) where.siteId = siteId;

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        externalRef: true,
        metadata: true,
        createdAt: true,
        wallet: { select: { currency: true } },
      },
    });

    return transactions.map((t) => ({
      ...t,
      amount: t.amount.toString(),
      balanceBefore: t.balanceBefore.toString(),
      balanceAfter: t.balanceAfter.toString(),
      currency: t.wallet.currency,
    }));
  }

  /**
   * Create deposit request - TENANT SCOPED
   */
  async createDepositRequest(
    userId: string,
    amount: number,
    currency: string,
    txHash: string,
    siteId?: string,
  ) {
    // Find or create wallet - SCOPED to siteId
    let wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency: currency as any, ...(siteId ? { siteId } : {}) },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currency: currency as any,
          balance: 0,
          lockedBalance: 0,
          siteId: siteId || null,
        },
      });
    }

    // Check if txHash already used
    const existingTx = await this.prisma.transaction.findFirst({
      where: { externalRef: txHash },
    });

    if (existingTx) {
      throw new BadRequestException('Transaction hash already submitted');
    }

    // Create pending deposit transaction - TENANT SCOPED
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        externalRef: txHash,
        siteId: siteId || null, // *** MULTI-TENANT ***
        metadata: {
          currency,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      message: 'Deposit request submitted. Awaiting admin verification.',
      transactionId: transaction.id,
      status: 'PENDING',
    };
  }

  /**
   * Create withdrawal request - TENANT SCOPED
   */
  async createWithdrawRequest(
    userId: string,
    amount: number,
    currency: string,
    walletAddress: string,
    siteId?: string,
  ) {
    const minWithdraw: Record<string, number> = {
      USDT: 20, BTC: 0.001, ETH: 0.01, SOL: 0.5,
    };

    if (amount < (minWithdraw[currency] || 0)) {
      throw new BadRequestException(
        `Minimum withdrawal is ${minWithdraw[currency]} ${currency}`,
      );
    }

    // VIP-based daily withdrawal limit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vipLevel: true },
    });
    const dailyLimit = getWithdrawalLimit(user?.vipLevel || 0);
    if (dailyLimit !== Infinity) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayWithdrawals = await this.prisma.transaction.aggregate({
        where: {
          userId,
          type: "WITHDRAWAL",
          status: { in: ["PENDING", "CONFIRMED"] },
          createdAt: { gte: today },
        },
        _sum: { amount: true },
      });
      const totalToday = Number(todayWithdrawals._sum.amount || 0) + amount;
      if (totalToday > dailyLimit) {
        throw new BadRequestException(
          `Daily withdrawal limit for your VIP level is \$${dailyLimit.toLocaleString()}. You have already withdrawn \$${Number(todayWithdrawals._sum.amount || 0).toLocaleString()} today.`
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // CRITICAL: Lock the wallet row - SCOPED to siteId
      const siteFilter = siteId ? `AND "siteId" = '${siteId}'` : '';
      const lockedWallets = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE "userId" = $1 AND currency = $2::"Currency" ${siteFilter} FOR UPDATE`,
        userId, currency
      );

      if (!lockedWallets || lockedWallets.length === 0) {
        throw new BadRequestException('Wallet not found');
      }

      const wallet = lockedWallets[0];
      const currentBalance = new Decimal(wallet.balance);

      if (currentBalance.lessThan(amount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = currentBalance.minus(amount);
      const newLocked = new Decimal(wallet.lockedBalance).plus(amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance, lockedBalance: newLocked },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amount: amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          siteId: siteId || null, // *** MULTI-TENANT ***
          metadata: {
            currency,
            walletAddress,
            requestedAt: new Date().toISOString(),
          },
        },
      });

      return transaction;
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,
      message: 'Withdrawal request submitted. Processing within 24 hours.',
      transactionId: result.id,
      status: 'PENDING',
    };
  }

  /**
   * Get all pending transactions - TENANT SCOPED for non-admin
   */
  async getPendingTransactions(siteId?: string) {
    const where: any = {
      status: 'PENDING',
      type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
    };
    if (siteId) where.siteId = siteId;

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
        wallet: { select: { currency: true } },
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
   * Get all transactions - TENANT SCOPED
   */
  async getAllTransactions(limit = 100, siteId?: string) {
    const where: any = {
      type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
    };
    if (siteId) where.siteId = siteId;

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
   * Process transaction (Approve/Reject)
   */
  async processTransaction(
    transactionId: string,
    action: 'APPROVE' | 'REJECT',
    adminId: string,
    adminNote?: string,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new BadRequestException('Transaction already processed');
    }

    if (action === 'APPROVE') {
      if (transaction.type === 'DEPOSIT') {
        await this.prisma.$transaction(async (tx) => {
          const lockedWallets = await tx.$queryRaw<any[]>`
            SELECT id, balance FROM "Wallet" WHERE id = ${transaction.walletId} FOR UPDATE
          `;
          const currentBalance = new Decimal(lockedWallets[0].balance);
          const newBalance = currentBalance.plus(transaction.amount);

          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: { balance: newBalance },
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'CONFIRMED',
              balanceAfter: newBalance,
              confirmedAt: new Date(),
              metadata: {
                ...(transaction.metadata as any || {}),
                approvedBy: adminId,
                approvedAt: new Date().toISOString(),
                adminNote,
              },
            },
          });
        });
      } else if (transaction.type === 'WITHDRAWAL') {
        await this.prisma.$transaction(async (tx) => {
          const lockedWallets = await tx.$queryRaw<any[]>`
            SELECT id, "lockedBalance" FROM "Wallet" WHERE id = ${transaction.walletId} FOR UPDATE
          `;
          const currentLocked = new Decimal(lockedWallets[0].lockedBalance);
          const newLocked = currentLocked.minus(transaction.amount);

          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: { lockedBalance: Decimal.max(newLocked, new Decimal(0)) },
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
              metadata: {
                ...(transaction.metadata as any || {}),
                approvedBy: adminId,
                approvedAt: new Date().toISOString(),
                adminNote,
              },
            },
          });
        });
      }
    } else {
      // REJECT
      if (transaction.type === 'WITHDRAWAL') {
        await this.prisma.$transaction(async (tx) => {
          const lockedWallets = await tx.$queryRaw<any[]>`
            SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE id = ${transaction.walletId} FOR UPDATE
          `;
          const currentBalance = new Decimal(lockedWallets[0].balance);
          const currentLocked = new Decimal(lockedWallets[0].lockedBalance);

          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              balance: currentBalance.plus(transaction.amount),
              lockedBalance: Decimal.max(currentLocked.minus(transaction.amount), new Decimal(0)),
            },
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'CANCELLED',
              balanceAfter: currentBalance.plus(transaction.amount),
              metadata: {
                ...(transaction.metadata as any || {}),
                rejectedBy: adminId,
                rejectedAt: new Date().toISOString(),
                adminNote,
              },
            },
          });
        });
      } else {
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...(transaction.metadata as any || {}),
              rejectedBy: adminId,
              rejectedAt: new Date().toISOString(),
              adminNote,
            },
          },
        });
      }
    }

    return {
      success: true,
      message: `Transaction ${action.toLowerCase()}ed successfully`,
      transactionId,
    };
  }

  /**
   * Admin: Direct deposit to user - TENANT SCOPED
   */
  async adminDirectDeposit(
    targetUserId: string,
    amount: number,
    currency: string,
    adminId: string,
    note?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findFirst({
        where: { userId: targetUserId, currency: currency as any },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: targetUserId,
            currency: currency as any,
            balance: 0,
            lockedBalance: 0,
            siteId: user.siteId,
          },
        });
      }

      const currentBalance = new Decimal(wallet.balance);
      const newBalance = currentBalance.plus(amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: targetUserId,
          walletId: wallet.id,
          type: 'DEPOSIT',
          status: 'CONFIRMED',
          amount: amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          confirmedAt: new Date(),
          siteId: user.siteId,
          metadata: {
            adminDeposit: true,
            adminId,
            note,
            currency,
          },
        },
      });

      return { wallet, transaction, newBalance };
    });

    return {
      success: true,
      message: `Successfully deposited ${amount} ${currency} to ${user.username || user.email}`,
      newBalance: result.newBalance.toString(),
      transactionId: result.transaction.id,
    };
  }
}
