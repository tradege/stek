import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { socketEventBus } from '../../gateway/socket.integration';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

/**
 * ============================================
 * THE VAULT - Global Progressive Jackpot
 * ============================================
 * 
 * How it works:
 * 1. Every bet across ALL games contributes 0.1% to The Vault
 * 2. Every bet generates a secondary jackpot hash
 * 3. If hash % dropThreshold === 777, the player wins the jackpot
 * 4. After a win, the pool resets to the seed amount
 * 5. Real-time WebSocket updates show the pool growing
 * 
 * The Vault is provably fair - the jackpot hash can be verified.
 */

const JACKPOT_MAGIC_NUMBER = 777;

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private poolCache: { amount: number; updatedAt: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5 seconds

  constructor(private prisma: PrismaService) {}

  /**
   * Get or create the default jackpot pool
   */
  async getOrCreatePool(): Promise<any> {
    let pool = await this.prisma.jackpotPool.findFirst({
      where: { isActive: true },
    });

    if (!pool) {
      pool = await this.prisma.jackpotPool.create({
        data: {
          name: 'The Vault',
          currentAmount: 100, // Seed amount
          seedAmount: 100,
          contributionRate: 0.001, // 0.1%
          dropThreshold: 1000000,
          isActive: true,
        },
      });
      this.logger.log('Created The Vault jackpot pool');
    }

    return pool;
  }

  /**
   * Process a bet for jackpot contribution and potential win.
   * Called by every game service after a bet is placed.
   * 
   * @returns { won: boolean, amount?: number } if the player won the jackpot
   */
  async processBet(
    userId: string,
    betAmount: number,
    gameType: string,
    serverSeed: string,
    clientSeed: string,
    nonce: number,
  ): Promise<{ won: boolean; amount?: number; hash?: string }> {
    const pool = await this.getOrCreatePool();
    if (!pool.isActive) return { won: false };

    const contributionRate = Number(pool.contributionRate);
    const contribution = betAmount * contributionRate;

    // 1. Add contribution to pool
    await this.prisma.jackpotPool.update({
      where: { id: pool.id },
      data: {
        currentAmount: { increment: contribution },
        totalContributed: { increment: contribution },
      },
    });

    // Record contribution (batch - only record if > $0.01)
    if (contribution >= 0.01) {
      await this.prisma.jackpotContribution.create({
        data: {
          poolId: pool.id,
          userId,
          betAmount,
          contribution,
          gameType,
        },
      });
    }

    // 2. Generate jackpot hash (separate from game hash for independence)
    const jackpotHash = crypto
      .createHmac('sha256', serverSeed)
      .update(`jackpot:${clientSeed}:${nonce}`)
      .digest('hex');

    // 3. Check if player won
    const hashValue = parseInt(jackpotHash.substring(0, 13), 16);
    const dropThreshold = pool.dropThreshold;
    const isWinner = (hashValue % dropThreshold) === JACKPOT_MAGIC_NUMBER;

    if (isWinner) {
      const currentAmount = Number(pool.currentAmount) + contribution;
      const winAmount = parseFloat(currentAmount.toFixed(2));

      this.logger.warn(`🎰 JACKPOT WIN! User ${userId} won $${winAmount} from The Vault!`);

      // Record the win
      await this.prisma.jackpotWin.create({
        data: {
          poolId: pool.id,
          userId,
          amount: winAmount,
          gameType,
          hash: jackpotHash,
        },
      });

      // Reset pool to seed amount
      await this.prisma.jackpotPool.update({
        where: { id: pool.id },
        data: {
          currentAmount: pool.seedAmount,
          lastWonAt: new Date(),
          lastWonBy: userId,
          lastWonAmount: winAmount,
          totalPaidOut: { increment: winAmount },
        },
      });

      // Credit winnings to user wallet
      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findFirst({
          where: { userId, currency: 'USDT' },
        });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: winAmount } },
          });
          // Record transaction
          await tx.transaction.create({
            data: {
              userId,
              walletId: wallet.id,
              type: 'DEPOSIT',
              status: 'CONFIRMED',
              amount: winAmount,
              balanceBefore: wallet.balance,
              balanceAfter: new Decimal(wallet.balance).plus(winAmount),
              externalRef: `VAULT-WIN-${Date.now()}`,
              metadata: {
                source: 'The Vault Jackpot',
                gameType,
                hash: jackpotHash,
              },
            },
          });
        }
      });

      // Emit jackpot win event via WebSocket
      socketEventBus.emit('vault:win', {
        userId,
        amount: winAmount,
        gameType,
      });

      // Emit new pool amount
      socketEventBus.emit('vault:update', {
        currentAmount: Number(pool.seedAmount),
      });

      return { won: true, amount: winAmount, hash: jackpotHash };
    }

    // Emit pool update (throttled - only emit if cache is stale)
    const newAmount = Number(pool.currentAmount) + contribution;
    if (!this.poolCache || Date.now() - this.poolCache.updatedAt > this.CACHE_TTL) {
      this.poolCache = { amount: newAmount, updatedAt: Date.now() };
      socketEventBus.emit('vault:update', { currentAmount: newAmount });
    }

    return { won: false };
  }

  /**
   * Get current jackpot pool info (for API/frontend)
   */
  async getPoolInfo(): Promise<{
    currentAmount: number;
    lastWonAt: Date | null;
    lastWonBy: string | null;
    lastWonAmount: number | null;
    totalPaidOut: number;
    recentWins: any[];
  }> {
    const pool = await this.getOrCreatePool();
    
    const recentWins = await this.prisma.jackpotWin.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    });

    return {
      currentAmount: Number(pool.currentAmount),
      lastWonAt: pool.lastWonAt,
      lastWonBy: pool.lastWonBy,
      lastWonAmount: pool.lastWonAmount ? Number(pool.lastWonAmount) : null,
      totalPaidOut: Number(pool.totalPaidOut),
      recentWins: recentWins.map(w => ({
        username: w.user?.username || 'Anonymous',
        amount: Number(w.amount),
        gameType: w.gameType,
        date: w.createdAt,
      })),
    };
  }

  /**
   * Admin: Update pool settings
   */
  async updatePoolSettings(data: {
    seedAmount?: number;
    contributionRate?: number;
    dropThreshold?: number;
    isActive?: boolean;
  }): Promise<any> {
    const pool = await this.getOrCreatePool();
    return this.prisma.jackpotPool.update({
      where: { id: pool.id },
      data,
    });
  }
}
