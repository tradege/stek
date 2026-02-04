import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLINKO_MULTIPLIERS, getMultiplier, calculateBucketFromPath, RiskLevel } from './plinko.constants';
import * as crypto from 'crypto';

interface PlayPlinkoDto {
  betAmount: number;
  rows: number;
  risk: RiskLevel;
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
    const { betAmount, rows, risk } = dto;

    // Validate inputs
    if (betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (rows < 8 || rows > 16) {
      throw new BadRequestException('Rows must be between 8 and 16');
    }
      throw new BadRequestException('Invalid risk level');
    }

    // Get user and check balance
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

      throw new BadRequestException('User not found');
    }

    if (user.balance < betAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Generate provably fair path
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const path = this.generatePath(rows, serverSeed);
    const bucketIndex = calculateBucketFromPath(path);
    const multiplier = getMultiplier(rows, risk, bucketIndex);
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    // Update user balance
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          decrement: betAmount,
        },
      },
    });

    if (payout > 0) {
      await this.prisma.user.update({
        where: { id: userId },
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
        betAmount,
        profit,
        isWin: profit > 0,
        crashPoint: multiplier,
        cashedOutAt: multiplier,
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
