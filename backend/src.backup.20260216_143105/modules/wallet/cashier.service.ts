'use strict';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { getWithdrawalLimit } from "../users/vip.config";
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class CashierService {
  private readonly logger = new Logger(CashierService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // TASK 39-1: DEPOSIT ADDRESS GENERATION
  // ============================================

  /**
   * Get or generate a deposit address for a user + currency
   * Supports BTC, ETH, SOL, USDT (multi-currency)
   */
  async getDepositAddress(userId: string, currency: string, siteId?: string): Promise<{
    address: string;
    currency: string;
    isNew: boolean;
  }> {
    const validCurrencies = ['BTC', 'ETH', 'SOL', 'USDT'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      throw new BadRequestException(`Unsupported currency: ${currency}. Supported: ${validCurrencies.join(', ')}`);
    }

    const normalizedCurrency = currency.toUpperCase();

    // Check if user already has a wallet with an address for this currency
    let wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        currency: normalizedCurrency as any,
        ...(siteId ? { siteId } : {}),
      },
    });

    if (wallet?.depositAddress) {
      return {
        address: wallet.depositAddress,
        currency: normalizedCurrency,
        isNew: false,
      };
    }

    // Generate a new deposit address (mock for now)
    const address = this.generateMockAddress(normalizedCurrency, userId);

    if (wallet) {
      // Update existing wallet with the new address
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { depositAddress: address },
      });
    } else {
      // Create new wallet with address
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currency: normalizedCurrency as any,
          balance: 0,
          lockedBalance: 0,
          depositAddress: address,
          siteId: siteId || null,
        },
      });
    }

    this.logger.log(`Generated deposit address for user ${userId}: ${address} (${normalizedCurrency})`);

    return {
      address,
      currency: normalizedCurrency,
      isNew: true,
    };
  }

  /**
   * Generate a mock deposit address based on currency type
   */
  private generateMockAddress(currency: string, userId: string): string {
    const uniqueHash = createHash('sha256')
      .update(`${userId}-${currency}-${Date.now()}-${randomBytes(16).toString('hex')}`)
      .digest('hex');

    switch (currency) {
      case 'BTC':
        // Bitcoin-style address (bc1 prefix for bech32)
        return `bc1q${uniqueHash.substring(0, 38)}`;
      case 'ETH':
      case 'USDT':
        // Ethereum-style address (0x prefix)
        return `0x${uniqueHash.substring(0, 40)}`;
      case 'SOL':
        // Solana-style address (base58-like)
        return uniqueHash.substring(0, 44);
      default:
        return `0x${uniqueHash.substring(0, 40)}`;
    }
  }

  /**
   * Webhook handler for blockchain deposit callbacks
   * Called by POST /api/webhooks/deposits
   */
  async processDepositWebhook(payload: {
    address: string;
    amount: number;
    currency: string;
    txHash: string;
    confirmations: number;
  }): Promise<{ success: boolean; message: string }> {
    const { address, amount, currency, txHash, confirmations } = payload;

    if (!address || !amount || !currency || !txHash) {
      throw new BadRequestException('Missing required fields: address, amount, currency, txHash');
    }

    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Find wallet by deposit address
    const wallet = await this.prisma.wallet.findFirst({
      where: { depositAddress: address },
      include: { user: true },
    });

    if (!wallet) {
      this.logger.warn(`Deposit webhook: No wallet found for address ${address}`);
      throw new NotFoundException('No wallet found for this deposit address');
    }

    // Check for duplicate txHash
    const existingTx = await this.prisma.transaction.findFirst({
      where: { externalRef: txHash },
    });

    if (existingTx) {
      this.logger.warn(`Deposit webhook: Duplicate txHash ${txHash}`);
      return { success: false, message: 'Transaction already processed' };
    }

    // Require minimum confirmations
    const minConfirmations: Record<string, number> = {
      BTC: 3, ETH: 12, USDT: 12, SOL: 32,
    };
    const requiredConfirmations = minConfirmations[currency.toUpperCase()] || 6;

    if (confirmations < requiredConfirmations) {
      // Create pending transaction
      await this.prisma.transaction.create({
        data: {
          userId: wallet.userId,
          walletId: wallet.id,
          type: 'DEPOSIT',
          status: 'PENDING',
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          externalRef: txHash,
          siteId: wallet.siteId,
          metadata: {
            currency,
            address,
            confirmations,
            requiredConfirmations,
            webhookReceived: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`Deposit pending: ${amount} ${currency} for user ${wallet.userId} (${confirmations}/${requiredConfirmations} confirmations)`);
      return { success: true, message: 'Deposit pending confirmations' };
    }

    // Sufficient confirmations - credit immediately via atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE
      `;
      const currentBalance = new Decimal(lockedWallets[0].balance);
      const newBalance = currentBalance.plus(amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: wallet.userId,
          walletId: wallet.id,
          type: 'DEPOSIT',
          status: 'CONFIRMED',
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: txHash,
          confirmedAt: new Date(),
          siteId: wallet.siteId,
          metadata: {
            currency,
            address,
            confirmations,
            webhookReceived: new Date().toISOString(),
            autoConfirmed: true,
          },
        },
      });

      return { transaction, newBalance };
    });

    this.logger.log(`Deposit confirmed: ${amount} ${currency} for user ${wallet.userId}. New balance: ${result.newBalance}`);
    return { success: true, message: 'Deposit confirmed and credited' };
  }

  // ============================================
  // EXISTING: Get user's wallet balances - TENANT SCOPED
  // ============================================
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
        depositAddress: true,
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
        siteId: siteId || null,
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

  // ============================================
  // TASK 39-2: FIXED WITHDRAWAL FLOW
  // ============================================

  /**
   * Create withdrawal request - TENANT SCOPED
   * Full validation: min/max, balance check, fee calculation, atomic transaction, admin alert
   */
  async createWithdrawRequest(
    userId: string,
    amount: number,
    currency: string,
    walletAddress: string,
    siteId?: string,
  ) {
    // Step 1: Validate min/max withdrawal from SiteConfig or defaults
    const minWithdraw: Record<string, number> = {
      USDT: 20, BTC: 0.001, ETH: 0.01, SOL: 0.5,
    };
    const maxWithdraw: Record<string, number> = {
      USDT: 50000, BTC: 5, ETH: 100, SOL: 5000,
    };

    if (amount < (minWithdraw[currency] || 0)) {
      throw new BadRequestException(
        `Minimum withdrawal is ${minWithdraw[currency]} ${currency}`,
      );
    }

    if (amount > (maxWithdraw[currency] || Infinity)) {
      throw new BadRequestException(
        `Maximum withdrawal is ${maxWithdraw[currency]} ${currency}`,
      );
    }

    // Validate wallet address format
    if (!walletAddress || walletAddress.length < 10) {
      throw new BadRequestException('Invalid wallet address');
    }

    // VIP-based daily withdrawal limit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vipLevel: true, siteId: true },
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

    // Step 3: Calculate withdrawal fee (default 1%)
    const withdrawalFeePercent = 0.01;
    const fee = amount * withdrawalFeePercent;
    const totalDeduction = amount; // Fee is taken from the withdrawal amount
    const netAmount = amount - fee;

    // Step 4: Atomic transaction
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

      // Step 2: Balance check
      if (currentBalance.lessThan(totalDeduction)) {
        throw new BadRequestException(
          `Insufficient balance. Available: ${currentBalance.toString()} ${currency}, Required: ${totalDeduction} ${currency}`,
        );
      }

      const newBalance = currentBalance.minus(totalDeduction);
      const newLocked = new Decimal(wallet.lockedBalance).plus(totalDeduction);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance, lockedBalance: newLocked },
      });

      // Step 5: Determine if manual review needed
      const needsManualReview = amount > 1000;
      const status = needsManualReview ? 'PENDING' : 'PENDING';

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          status,
          amount: totalDeduction,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          siteId: siteId || null,
          metadata: {
            currency,
            walletAddress,
            fee: fee.toFixed(8),
            feePercent: (withdrawalFeePercent * 100).toFixed(2) + '%',
            netAmount: netAmount.toFixed(8),
            requestedAt: new Date().toISOString(),
            manualReview: needsManualReview,
            reviewReason: needsManualReview ? 'Amount exceeds $1000 threshold' : null,
          },
        },
      });

      return transaction;
    }, { isolationLevel: 'Serializable' });

    // Step 5: Log admin alert for large withdrawals
    if (amount > 1000) {
      this.logger.warn(
        `MANUAL_REVIEW: Large withdrawal of ${amount} ${currency} by user ${userId}. Transaction: ${result.id}`,
      );
    }

    return {
      success: true,
      message: amount > 1000
        ? 'Withdrawal request submitted for manual review (amount > $1,000). Processing within 24-48 hours.'
        : 'Withdrawal request submitted. Processing within 24 hours.',
      transactionId: result.id,
      status: 'PENDING',
      fee: fee.toFixed(8),
      netAmount: netAmount.toFixed(8),
    };
  }

  // ============================================
  // TASK 39-3: TRANSACTION RECORDING HELPER
  // ============================================

  /**
   * Record any financial transaction (Deposit, Withdraw, Bonus, Affiliate Payout, etc.)
   * This is the universal ledger entry creator.
   */
  async recordTransaction(params: {
    userId: string;
    walletId: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'BET' | 'WIN' | 'COMMISSION' | 'TIP_SENT' | 'TIP_RECEIVED' | 'VAULT_DEPOSIT' | 'VAULT_WITHDRAWAL' | 'RAIN_RECEIVED' | 'CREDIT_GIVEN' | 'CREDIT_REPAID';
    amount: number;
    balanceBefore: number | Decimal;
    balanceAfter: number | Decimal;
    status?: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
    externalRef?: string;
    siteId?: string;
    metadata?: Record<string, any>;
    isBot?: boolean;
  }) {
    return this.prisma.transaction.create({
      data: {
        userId: params.userId,
        walletId: params.walletId,
        type: params.type,
        status: params.status || 'CONFIRMED',
        amount: params.amount,
        balanceBefore: params.balanceBefore,
        balanceAfter: params.balanceAfter,
        externalRef: params.externalRef,
        siteId: params.siteId || null,
        confirmedAt: params.status === 'CONFIRMED' || !params.status ? new Date() : null,
        isBot: params.isBot || false,
        metadata: params.metadata || {},
      },
    });
  }

  /**
   * Get all transactions for admin ledger (ALL types, not just deposit/withdrawal)
   */
  async getFullLedger(limit = 200, siteId?: string, type?: string) {
    const where: any = {};
    if (siteId) where.siteId = siteId;
    if (type) where.type = type;

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
      balanceBefore: t.balanceBefore.toString(),
      balanceAfter: t.balanceAfter.toString(),
      currency: t.wallet.currency,
      externalRef: t.externalRef,
      metadata: t.metadata,
      user: t.user,
      isBot: t.isBot,
      createdAt: t.createdAt,
      confirmedAt: t.confirmedAt,
    }));
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
