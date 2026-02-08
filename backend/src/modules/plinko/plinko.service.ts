import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLINKO_MULTIPLIERS, getMultiplier, calculateBucketFromPath, RiskLevel } from './plinko.constants';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

interface PlayPlinkoDto {
  betAmount: number;
  rows: number;
  risk: RiskLevel;
  currency?: string;
}

interface PlinkoResult {
  path: number[];
  bucketIndex: number;
  multiplier: number;
  payout: number;
  profit: number;
}

@Injectable()
export class PlinkoService {
  constructor(private prisma: PrismaService) {}

  async play(userId: string, dto: PlayPlinkoDto): Promise<PlinkoResult> {
    const { betAmount, rows, risk, currency = 'USDT' } = dto;

    // Validate inputs
    if (betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (rows < 8 || rows > 16) {
      throw new BadRequestException('Rows must be between 8 and 16');
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(risk)) {
      throw new BadRequestException('Invalid risk level');
    }

    // Generate provably fair seeds
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = Math.floor(Math.random() * 1000000);

    // Generate path and calculate result
    const path = this.generatePath(rows, serverSeed);
    const bucketIndex = calculateBucketFromPath(path);
    const multiplier = getMultiplier(rows, risk, bucketIndex);
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    // CRITICAL: Use a single atomic transaction with row locking
    await this.prisma.$transaction(async (tx) => {
      // Lock the wallet row to prevent race conditions
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

      // Calculate new balance: deduct bet, add payout (net effect = profit)
      const newBalance = currentBalance.minus(betAmount).plus(payout);

      // Single atomic balance update
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      // Save bet to database
      await tx.bet.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          gameType: 'PLINKO',
          currency: currency as any,
          betAmount: new Decimal(betAmount),
          multiplier: new Decimal(multiplier),
          payout: new Decimal(payout),
          profit: new Decimal(profit),
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          gameData: { path, bucketIndex, rows, risk },
          isWin: profit > 0,
        },
      });

      // Record bet in transaction table for complete audit trail
      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: new Decimal(betAmount),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: `PLINKO-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: {
            game: 'PLINKO',
            multiplier,
            payout,
            profit,
            isWin: profit > 0,
          },
        },
      });
    });

    return {
      path,
      bucketIndex,
      multiplier,
      payout,
      profit,
    };
  }

  private generatePath(rows: number, seed: string): number[] {
    const path: number[] = [];
    
    for (let i = 0; i < rows; i++) {
      // Create hash for this row
      const hash = crypto
        .createHash('sha256')
        .update(seed + i.toString())
        .digest('hex');
      
      // Use first 8 chars of hash to determine direction
      const value = parseInt(hash.substring(0, 8), 16);
      // 0 = left, 1 = right
      path.push(value % 2);
    }
    
    return path;
  }

  getMultipliers(rows: number, risk: RiskLevel): number[] {
    return PLINKO_MULTIPLIERS[rows]?.[risk] || [];
  }
}
