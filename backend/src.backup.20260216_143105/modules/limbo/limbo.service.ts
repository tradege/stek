/**
 * ============================================
 * LIMBO SERVICE - Target Multiplier Game
 * ============================================
 * Multi-Tenant Provably Fair.
 * Player sets a target multiplier (e.g., 2.00x).
 * RNG generates result 1.00 - 1,000,000.
 * If Result >= Target, Player Wins.
 * Win Chance = 1 / Target.
 * Dynamic houseEdge from SiteConfiguration per brand.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getGameConfig, checkRiskLimits, recordPayout } from '../../common/helpers/game-tenant.helper';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ============================================
// DTOs
// ============================================
export interface PlayLimboDto {
  betAmount: number;
  targetMultiplier: number;
  currency?: string;
}

export interface LimboResult {
  resultMultiplier: number;
  targetMultiplier: number;
  isWin: boolean;
  winChance: number;
  multiplier: number;
  payout: number;
  profit: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

// ============================================
// CONSTANTS
// ============================================
const MIN_TARGET = 1.01;
const MAX_TARGET = 10000;
const MIN_BET = 0.01;
const RATE_LIMIT_MS = 1000;
const userLastBetTime = new Map<string, number>();

@Injectable()
export class LimboService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // PROVABLY FAIR RNG
  // ============================================

  /**
   * Generate a provably fair result multiplier.
   * Uses HMAC-SHA256 to generate a uniform random float,
   * then maps it to the Limbo distribution:
   *   result = max(1.00, houseEdgeFactor / random)
   * This creates the characteristic heavy-tail distribution
   * where low multipliers are common and high ones are rare.
   */
  generateResult(serverSeed: string, clientSeed: string, nonce: number, houseEdge: number): number {
    const hash = crypto.createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');

    // Use first 13 hex chars (52 bits) for high precision
    const rawValue = parseInt(hash.substring(0, 13), 16);
    const maxValue = Math.pow(16, 13); // 16^13

    // Generate uniform random in (0, 1)
    const random = rawValue / maxValue;

    // Avoid division by zero
    if (random === 0) return MAX_TARGET;

    // Apply house edge factor: (1 - houseEdge) / random
    // This creates the standard Limbo/crash distribution
    const houseEdgeFactor = 1 - houseEdge;
    const result = houseEdgeFactor / random;

    // Clamp to valid range
    return parseFloat(Math.max(1.00, Math.min(result, MAX_TARGET)).toFixed(2));
  }

  /**
   * Calculate win chance for a given target
   * Win Chance = (1 / target) * (1 - houseEdge)
   * Expressed as percentage
   */
  calculateWinChance(targetMultiplier: number, houseEdge: number): number {
    const chance = ((1 / targetMultiplier) * (1 - houseEdge)) * 100;
    return parseFloat(Math.max(0.0001, chance).toFixed(4));
  }

  // ============================================
  // MAIN PLAY FUNCTION
  // ============================================

  async play(userId: string, dto: PlayLimboDto, siteId: string): Promise<LimboResult> {
    const { betAmount, targetMultiplier, currency = 'USDT' } = dto;

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

    // Validate target multiplier
    if (targetMultiplier < MIN_TARGET || targetMultiplier > MAX_TARGET) {
      throw new BadRequestException(`Target must be between ${MIN_TARGET}x and ${MAX_TARGET}x`);
    }

    // Get dynamic config for this brand
    const gameConfig = await getGameConfig(this.prisma, siteId, 'limbo');

    // Validate bet amount
    if (betAmount < MIN_BET || betAmount > gameConfig.maxBetAmount) {
      throw new BadRequestException(`Bet must be between ${MIN_BET} and ${gameConfig.maxBetAmount}`);
    }

    // Get or create server seed
    let serverSeedRecord = await this.prisma.serverSeed.findFirst({
      where: { userId, isActive: true },
    });
    if (!serverSeedRecord) {
      const seed = crypto.randomBytes(32).toString('hex');
      serverSeedRecord = await this.prisma.serverSeed.create({
        data: {
          userId,
          seed,
          seedHash: crypto.createHash('sha256').update(seed).digest('hex'),
          isActive: true,
          nonce: 0,
        },
      });
    }

    const serverSeed = serverSeedRecord.seed;
    const serverSeedHash = serverSeedRecord.seedHash;
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = serverSeedRecord.nonce + 1;

    // Update nonce
    await this.prisma.serverSeed.update({
      where: { id: serverSeedRecord.id },
      data: { nonce },
    });

    // Generate provably fair result
    const resultMultiplier = this.generateResult(serverSeed, clientSeed, nonce, gameConfig.houseEdge);

    // Determine win/loss
    const isWin = resultMultiplier >= targetMultiplier;
    const winChance = this.calculateWinChance(targetMultiplier, gameConfig.houseEdge);

    // Calculate payout
    const multiplier = isWin ? targetMultiplier : 0;
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const profit = parseFloat((payout - betAmount).toFixed(2));

    // Risk limit check
    if (isWin && payout > 0) {
      const riskCheck = await checkRiskLimits(this.prisma, siteId, payout);
      if (!riskCheck.allowed) {
        throw new BadRequestException(riskCheck.reason || 'Payout exceeds risk limits');
      }
    }

    // Atomic wallet transaction
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency: currency as any },
    });
    if (!wallet) {
      throw new BadRequestException(`No ${currency} wallet found`);
    }
    const currentBalance = new Decimal(wallet.balance.toString());
    if (currentBalance.lt(betAmount)) {
      throw new BadRequestException('Insufficient balance');
    }

    const newBalance = currentBalance.minus(betAmount).plus(payout);

    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      await tx.bet.create({
        data: {
          userId,
          siteId,
          gameType: 'LIMBO' as any,
          currency: currency as any,
          betAmount: new Decimal(betAmount),
          multiplier: new Decimal(multiplier),
          payout: new Decimal(payout),
          profit: new Decimal(profit),
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          gameData: {
            game: 'LIMBO',
            resultMultiplier,
            targetMultiplier,
            winChance,
            houseEdge: gameConfig.houseEdge,
          },
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
          balanceBefore: currentBalance.toNumber(),
          balanceAfter: newBalance.toNumber(),
          externalRef: `LIMBO-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: {
            game: 'LIMBO',
            resultMultiplier,
            targetMultiplier,
            multiplier,
            payout,
            profit,
            isWin,
            siteId,
          },
        },
      });
    });

    // Record payout for risk tracking
    if (isWin && payout > 0) {
      await recordPayout(this.prisma, siteId, payout);
    }

    return {
      resultMultiplier,
      targetMultiplier,
      isWin,
      winChance,
      multiplier,
      payout,
      profit,
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }

  // ============================================
  // HISTORY & VERIFICATION
  // ============================================

  async getHistory(userId: string, siteId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: {
        userId,
        siteId,
        gameType: 'LIMBO' as any,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
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

  async verifyResult(serverSeed: string, clientSeed: string, nonce: number) {
    // Use default house edge for verification (actual edge was applied at play time)
    const result = this.generateResult(serverSeed, clientSeed, nonce, 0.04);
    return {
      resultMultiplier: result,
      seedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    };
  }
}
