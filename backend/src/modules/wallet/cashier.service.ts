'use strict';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CashierService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user's wallet balances
   */
  async getUserBalances(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
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
   * Get user's transaction history
   */
  async getUserTransactions(userId: string, limit = 50) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
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
        wallet: {
          select: {
            currency: true,
          },
        },
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
   * Create deposit request (PENDING status)
   */
  async createDepositRequest(
    userId: string,
    amount: number,
    currency: string,
    txHash: string,
  ) {
    // Find or create wallet
    let wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency: currency as any },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currency: currency as any,
          balance: 0,
          lockedBalance: 0,
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

    // Create pending deposit transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // Will be updated on approval
        externalRef: txHash,
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
   * Create withdrawal request
   * Uses SELECT ... FOR UPDATE to prevent double-spend
   */
  async createWithdrawRequest(
    userId: string,
    amount: number,
    currency: string,
    walletAddress: string,
  ) {
    // Minimum withdrawal
    const minWithdraw: Record<string, number> = {
      USDT: 20,
      BTC: 0.001,
      ETH: 0.01,
      SOL: 0.5,
    };

    if (amount < (minWithdraw[currency] || 0)) {
      throw new BadRequestException(
        `Minimum withdrawal is ${minWithdraw[currency]} ${currency}`,
      );
    }

    // Use serializable transaction with row-level locking to prevent double-spend
    const result = await this.prisma.$transaction(async (tx) => {
      // CRITICAL: Lock the wallet row with SELECT FOR UPDATE to prevent concurrent reads
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance, "lockedBalance" 
        FROM "Wallet" 
        WHERE "userId" = ${userId} AND currency = ${currency}::"Currency"
        FOR UPDATE
      `;

      if (!lockedWallets || lockedWallets.length === 0) {
        throw new BadRequestException('Wallet not found');
      }

      const wallet = lockedWallets[0];
      const currentBalance = new Decimal(wallet.balance);

      // Check balance with the LOCKED (up-to-date) value
      if (currentBalance.lessThan(amount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = currentBalance.minus(amount);
      const newLocked = new Decimal(wallet.lockedBalance).plus(amount);

      // Deduct from balance, add to lockedBalance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          lockedBalance: newLocked,
        },
      });

      // Create pending withdrawal transaction with accurate balanceBefore/After
      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amount: amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          metadata: {
            currency,
            walletAddress,
            requestedAt: new Date().toISOString(),
          },
        },
      });

      return transaction;
    }, {
      isolationLevel: 'Serializable',
    });

    return {
      success: true,
      message: 'Withdrawal request submitted. Processing within 24 hours.',
      transactionId: result.id,
      status: 'PENDING',
    };
  }

  /**
   * Get all pending transactions (Admin)
   */
  async getPendingTransactions() {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
      },
      orderBy: { createdAt: 'asc' },
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
   * Get all transactions (Admin)
   */
  async getAllTransactions(limit = 100) {
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
   * Process transaction (Approve/Reject)
   * Uses SELECT FOR UPDATE to prevent race conditions
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
        // Add funds to user wallet with row locking
        await this.prisma.$transaction(async (tx) => {
          // Lock the wallet row
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
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              metadata: {
                ...(transaction.metadata as object),
                approvedBy: adminId,
                approvedAt: new Date().toISOString(),
                adminNote,
              },
            },
          });
        });
      } else if (transaction.type === 'WITHDRAWAL') {
        // Funds already deducted, just mark as confirmed and remove from locked
        await this.prisma.$transaction(async (tx) => {
          // Lock the wallet row
          const lockedWallets = await tx.$queryRaw<any[]>`
            SELECT id, "lockedBalance" FROM "Wallet" WHERE id = ${transaction.walletId} FOR UPDATE
          `;
          const currentLocked = new Decimal(lockedWallets[0].lockedBalance);
          const newLocked = currentLocked.minus(transaction.amount);

          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: { lockedBalance: newLocked.lessThan(0) ? 0 : newLocked },
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'CONFIRMED',
              metadata: {
                ...(transaction.metadata as object),
                approvedBy: adminId,
                approvedAt: new Date().toISOString(),
                adminNote,
              },
            },
          });
        });
      }

      return {
        success: true,
        message: `${transaction.type} approved successfully`,
        transactionId,
      };
    } else {
      // REJECT
      if (transaction.type === 'WITHDRAWAL') {
        // Return funds to balance with row locking
        await this.prisma.$transaction(async (tx) => {
          // Lock the wallet row
          const lockedWallets = await tx.$queryRaw<any[]>`
            SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE id = ${transaction.walletId} FOR UPDATE
          `;
          const currentBalance = new Decimal(lockedWallets[0].balance);
          const currentLocked = new Decimal(lockedWallets[0].lockedBalance);
          const newBalance = currentBalance.plus(transaction.amount);
          const newLocked = currentLocked.minus(transaction.amount);

          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              balance: newBalance,
              lockedBalance: newLocked.lessThan(0) ? 0 : newLocked,
            },
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'CANCELLED',
              balanceAfter: newBalance,
              metadata: {
                ...(transaction.metadata as object),
                rejectedBy: adminId,
                rejectedAt: new Date().toISOString(),
                adminNote,
              },
            },
          });
        });
      } else {
        // Deposit rejection - just mark as cancelled
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...(transaction.metadata as object),
              rejectedBy: adminId,
              rejectedAt: new Date().toISOString(),
              adminNote,
            },
          },
        });
      }

      return {
        success: true,
        message: `${transaction.type} rejected`,
        transactionId,
      };
    }
  }

  /**
   * Simulate a deposit (Admin only) - Directly credits funds to user wallet
   * Uses SELECT FOR UPDATE to prevent concurrent deposit race conditions
   */
  async simulateDeposit(
    userId: string | null,
    userEmail: string | null,
    amount: number,
    currency: string,
    adminId: string,
  ) {
    // Find user by ID or email
    let user;
    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
    } else if (userEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: userEmail },
      });
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find or create wallet OUTSIDE transaction (creation doesn't need locking)
    let wallet = await this.prisma.wallet.findFirst({
      where: { userId: user.id, currency: currency as any },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId: user.id,
          currency: currency as any,
          balance: 0,
          lockedBalance: 0,
        },
      });
    }

    // CRITICAL: Use SELECT FOR UPDATE inside transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the wallet row - this prevents concurrent deposits from reading stale balance
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE
      `;

      const currentBalance = new Decimal(lockedWallets[0].balance);
      const newBalance = currentBalance.plus(amount);

      // Update wallet balance with the LOCKED current balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Create confirmed transaction record with accurate balanceBefore/After
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,
          type: 'DEPOSIT',
          status: 'CONFIRMED',
          amount: amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: `SIM-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          metadata: {
            simulated: true,
            simulatedBy: adminId,
            simulatedAt: new Date().toISOString(),
            note: 'Admin simulated deposit',
          },
        },
      });

      return { transaction, newBalance };
    });

    console.log(`[ADMIN] Simulated deposit of ${amount} ${currency} to user ${user.email} by admin ${adminId}`);

    return {
      success: true,
      message: `Successfully deposited ${amount} ${currency} to ${user.username || user.email}`,
      transaction: {
        id: result.transaction.id,
        amount: amount.toString(),
        currency,
        newBalance: result.newBalance.toString(),
      },
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }
}
