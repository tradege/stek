/**
 * ============================================
 * DICE SERVICE - Provably Fair Dice Game
 * ============================================
 * 
 * Algorithm: HMAC-SHA256 based roll generation
 * House Edge: 4% (built into payout calculation)
 * Range: 0.00 - 99.99 (10000 possible outcomes)
 * 
 * Payout Formula: (100 - houseEdge) / winChance
 * Example: Roll Under 50 → winChance=50% → payout = 96/50 = 1.92x
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ==================== TYPES ====================
export interface PlayDiceDto {
  betAmount: number;
  target: number;       // Target number (0.01 - 99.98)
  condition: 'OVER' | 'UNDER'; // Roll over or under target
  currency?: string;
}

export interface DiceResult {
  roll: number;         // The actual roll (0.00 - 99.99)
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

// ==================== CONSTANTS ====================
const HOUSE_EDGE = 0.04; // 4% house edge
const MIN_TARGET = 0.01;
const MAX_TARGET = 99.98;
const MIN_WIN_CHANCE = 0.01; // Minimum 0.01% win chance
const MAX_WIN_CHANCE = 99.99; // Maximum 99.99% win chance
const ROLL_PRECISION = 10000; // 0.00 to 99.99 = 10000 outcomes
const MIN_BET = 0.01;
const MAX_BET = 10000;
const RATE_LIMIT_MS = 300; // 300ms between bets

// Rate limiting map
const userLastBetTime = new Map<string, number>();

@Injectable()
export class DiceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate win chance based on target and condition
   */
  calculateWinChance(target: number, condition: 'OVER' | 'UNDER'): number {
    if (condition === 'UNDER') {
      return target; // e.g., target=50 → 50% chance
    } else {
      return 100 - target; // e.g., target=50 → 50% chance
    }
  }

  /**
   * Calculate payout multiplier with 4% house edge
   */
  calculateMultiplier(winChance: number): number {
    if (winChance <= 0 || winChance >= 100) return 0;
    const multiplier = (100 * (1 - HOUSE_EDGE)) / winChance;
    return Math.floor(multiplier * 10000) / 10000; // Floor to 4 decimal places
  }

  /**
   * Generate provably fair dice roll using HMAC-SHA256
   */
  generateRoll(serverSeed: string, clientSeed: string, nonce: number): number {
    const message = `${clientSeed}:${nonce}`;
    const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
    
    // Use first 8 hex chars (32 bits) for the roll
    const rollValue = parseInt(hmac.substring(0, 8), 16);
    
    // Map to 0.00 - 99.99 range
    const roll = (rollValue % ROLL_PRECISION) / 100;
    return Math.round(roll * 100) / 100; // Ensure 2 decimal places
  }

  /**
   * Determine if the roll is a win
   */
  isWinningRoll(roll: number, target: number, condition: 'OVER' | 'UNDER'): boolean {
    if (condition === 'UNDER') {
      return roll < target;
    } else {
      return roll > target;
    }
  }

  /**
   * Main play function - atomic transaction with row locking
   */
  async play(userId: string, dto: PlayDiceDto): Promise<DiceResult> {
    const { betAmount, target, condition, currency = 'USDT' } = dto;

    // ===== RATE LIMITING =====
    const now = Date.now();
    const lastBet = userLastBetTime.get(userId) || 0;
    if (now - lastBet < RATE_LIMIT_MS) {
      throw new BadRequestException('Please wait before placing another bet');
    }
    userLastBetTime.set(userId, now);

    // Clean up old entries periodically
    if (userLastBetTime.size > 10000) {
      const cutoff = now - 60000;
      for (const [uid, time] of userLastBetTime.entries()) {
        if (time < cutoff) userLastBetTime.delete(uid);
      }
    }

    // ===== INPUT VALIDATION =====
    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      throw new BadRequestException(`Bet amount must be between ${MIN_BET} and ${MAX_BET}`);
    }

    if (target < MIN_TARGET || target > MAX_TARGET) {
      throw new BadRequestException(`Target must be between ${MIN_TARGET} and ${MAX_TARGET}`);
    }

    if (condition !== 'OVER' && condition !== 'UNDER') {
      throw new BadRequestException('Condition must be OVER or UNDER');
    }

    // ===== CALCULATE GAME PARAMETERS =====
    const winChance = this.calculateWinChance(target, condition);
    if (winChance < MIN_WIN_CHANCE || winChance > MAX_WIN_CHANCE) {
      throw new BadRequestException('Win chance out of valid range');
    }

    const multiplier = this.calculateMultiplier(winChance);
    if (multiplier <= 0) {
      throw new BadRequestException('Invalid multiplier');
    }

    // ===== GENERATE PROVABLY FAIR SEEDS =====
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = Math.floor(Math.random() * 1000000);

    // ===== GENERATE ROLL =====
    const roll = this.generateRoll(serverSeed, clientSeed, nonce);
    const isWin = this.isWinningRoll(roll, target, condition);
    const payout = isWin ? betAmount * multiplier : 0;
    const profit = payout - betAmount;

    // ===== ATOMIC TRANSACTION WITH ROW LOCKING =====
    await this.prisma.$transaction(async (tx) => {
      // Lock the wallet row
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" 
        WHERE "userId" = ${userId} AND currency = ${currency}::"Currency"
        FOR UPDATE
      `;

      if (!lockedWallets || lockedWallets.length === 0) {
        throw new BadRequestException('Wallet not found');
      }

      const wallet = lockedWallets[0];
      const currentBalance = new Decimal(wallet.balance);

      if (currentBalance.lessThan(betAmount)) {
        throw new BadRequestException('Insufficient balance');
      }

      // Calculate new balance
      const newBalance = currentBalance.minus(betAmount).plus(payout);

      // Update wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      // Save bet record
      await tx.bet.create({
        data: {
          id: crypto.randomUUID(),
          userId,
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
          gameData: { roll, target, condition, winChance },
          isWin,
        },
      });

      // Record transaction for audit trail
      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: new Decimal(betAmount),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: `DICE-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: {
            game: 'DICE',
            roll,
            target,
            condition,
            multiplier,
            payout,
            profit,
            isWin,
          },
        },
      });
    });

    return {
      roll,
      target,
      condition,
      isWin,
      multiplier,
      winChance,
      payout,
      profit,
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }

  /**
   * Verify a past roll using server seed
   */
  verifyRoll(serverSeed: string, clientSeed: string, nonce: number): { roll: number; serverSeedHash: string } {
    const roll = this.generateRoll(serverSeed, clientSeed, nonce);
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { roll, serverSeedHash };
  }

  /**
   * Get game history for a user
   */
  async getHistory(userId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: { userId, gameType: 'DICE' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        betAmount: true,
        multiplier: true,
        payout: true,
        profit: true,
        isWin: true,
        gameData: true,
        createdAt: true,
      },
    });
  }
}
