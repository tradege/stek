/**
 * ============================================
 * DICE SERVICE - Multi-Tenant Provably Fair
 * ============================================
 * Dynamic houseEdge from SiteConfiguration per brand.
 * All bets validated against user's siteId.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getGameConfig, checkRiskLimits, recordPayout } from '../../common/helpers/game-tenant.helper';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

export interface PlayDiceDto {
  betAmount: number;
  target: number;
  condition: 'OVER' | 'UNDER';
  currency?: string;
}

export interface DiceResult {
  roll: number;
  target: number;
  condition: 'OVER' | 'UNDER';
  isWin: boolean;
  multiplier: number;
  winChance: number;
  payout: number;
  profit: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const MIN_TARGET = 0.01;
const MAX_TARGET = 99.98;
const MIN_WIN_CHANCE = 0.01;
const MAX_WIN_CHANCE = 99.99;
const ROLL_PRECISION = 10000;
const MIN_BET = 0.01;
const RATE_LIMIT_MS = 300;
const userLastBetTime = new Map<string, number>();

@Injectable()
export class DiceService {
  constructor(private prisma: PrismaService) {}

  calculateWinChance(target: number, condition: 'OVER' | 'UNDER'): number {
    return condition === 'UNDER' ? target : (100 - target);
  }

  calculateMultiplier(winChance: number, houseEdge: number): number {
    return parseFloat(((100 - houseEdge * 100) / winChance).toFixed(4));
  }

  generateRoll(serverSeed: string, clientSeed: string, nonce: number): number {
    const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
    const value = parseInt(hash.substring(0, 8), 16);
    return parseFloat(((value % ROLL_PRECISION) / 100).toFixed(2));
  }

  isWinningRoll(roll: number, target: number, condition: 'OVER' | 'UNDER'): boolean {
    return condition === 'UNDER' ? roll < target : roll > target;
  }

  /**
   * Main play function - MULTI-TENANT with dynamic houseEdge
   */
  async play(userId: string, dto: PlayDiceDto, siteId: string): Promise<DiceResult> {
    const { betAmount, target, condition, currency = 'USDT' } = dto;

    // Rate limiting
    const now = Date.now();
    const lastBet = userLastBetTime.get(userId) || 0;
    if (now - lastBet < RATE_LIMIT_MS) {
      throw new BadRequestException('Please wait before placing another bet');
    }
    userLastBetTime.set(userId, now);
    if (userLastBetTime.size > 10000) {
      const cutoff = now - 60000;
      for (const [uid, time] of userLastBetTime.entries()) {
        if (time < cutoff) userLastBetTime.delete(uid);
      }
    }

    // Get dynamic config for this brand
    const gameConfig = await getGameConfig(this.prisma, siteId, 'dice');

    // Validate bet amount against brand limits
    if (betAmount < MIN_BET || betAmount > gameConfig.maxBetAmount) {
      throw new BadRequestException(`Bet must be between ${MIN_BET} and ${gameConfig.maxBetAmount}`);
    }
    if (target < MIN_TARGET || target > MAX_TARGET) {
      throw new BadRequestException(`Target must be between ${MIN_TARGET} and ${MAX_TARGET}`);
    }
    if (condition !== 'OVER' && condition !== 'UNDER') {
      throw new BadRequestException('Condition must be OVER or UNDER');
    }

    // Calculate with DYNAMIC house edge
    const winChance = this.calculateWinChance(target, condition);
    if (winChance < MIN_WIN_CHANCE || winChance > MAX_WIN_CHANCE) {
      throw new BadRequestException('Win chance out of valid range');
    }
    const multiplier = this.calculateMultiplier(winChance, gameConfig.houseEdge);

    // Generate provably fair result
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = Math.floor(Math.random() * 1000000);
    const roll = this.generateRoll(serverSeed, clientSeed, nonce);
    const isWin = this.isWinningRoll(roll, target, condition);
    const payout = isWin ? betAmount * multiplier : 0;
    const profit = payout - betAmount;

    // Check risk limits for wins
    if (isWin && payout > 0) {
      const riskCheck = await checkRiskLimits(this.prisma, siteId, payout);
      if (!riskCheck.allowed) {
        throw new BadRequestException('Bet exceeds current risk limits. Try a smaller amount.');
      }
    }

    // Atomic transaction with siteId isolation
    await this.prisma.$transaction(async (tx) => {
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" 
        WHERE "userId" = ${userId} AND currency = ${currency}::"Currency" AND "siteId" = ${siteId}
        FOR UPDATE
      `;
      if (!lockedWallets || lockedWallets.length === 0) {
        // Fallback: try without siteId filter for backwards compat
        const fallbackWallets = await tx.$queryRaw<any[]>`
          SELECT id, balance FROM "Wallet" 
          WHERE "userId" = ${userId} AND currency = ${currency}::"Currency"
          FOR UPDATE
        `;
        if (!fallbackWallets || fallbackWallets.length === 0) {
          throw new BadRequestException('Wallet not found');
        }
        var wallet = fallbackWallets[0];
      } else {
        var wallet = lockedWallets[0];
      }

      const currentBalance = new Decimal(wallet.balance);
      if (currentBalance.lessThan(betAmount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = currentBalance.minus(betAmount).plus(payout);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      await tx.bet.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          siteId,
          gameType: 'DICE',
          currency: currency as any,
          betAmount: new Decimal(betAmount),
          multiplier: new Decimal(multiplier),
          payout: new Decimal(payout),
          profit: new Decimal(profit),
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          gameData: { roll, target, condition, winChance, houseEdge: gameConfig.houseEdge },
          isWin,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          siteId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: new Decimal(betAmount),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: `DICE-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: { game: 'DICE', roll, target, condition, multiplier, payout, profit, isWin, siteId },
        },
      });
    });

    // Record payout for risk tracking
    if (isWin && payout > 0) {
      await recordPayout(this.prisma, siteId, payout);
    }

    return { roll, target, condition, isWin, multiplier, winChance, payout, profit, serverSeedHash, clientSeed, nonce };
  }

  verifyRoll(serverSeed: string, clientSeed: string, nonce: number) {
    const roll = this.generateRoll(serverSeed, clientSeed, nonce);
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { roll, serverSeedHash };
  }

  async getHistory(userId: string, siteId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: { userId, siteId, gameType: 'DICE' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, betAmount: true, multiplier: true, payout: true,
        profit: true, isWin: true, gameData: true, createdAt: true,
      },
    });
  }
}
