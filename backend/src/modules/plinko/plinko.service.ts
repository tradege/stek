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

    // Get user wallet and check balance
    const wallet = await this.prisma.wallet.findFirst({
      where: { 
        userId,
        currency: currency as any,
      },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    if (wallet.balance.toNumber() < betAmount) {
      throw new BadRequestException('Insufficient balance');
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

    // Update wallet balance - deduct bet
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          decrement: betAmount,
        },
      },
    });

    // Add payout if any
    if (payout > 0) {
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: payout,
          },
        },
      });
    }

    // Save bet to database
    await this.prisma.bet.create({
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
