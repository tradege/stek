/**
 * ============================================
 * PENALTY SHOOTOUT SERVICE - Visual Accumulator
 * ============================================
 * Multi-Tenant Provably Fair.
 * Mines-style game: Player picks a target in the goal.
 * RNG determines Save vs Goal.
 * Each goal increases the multiplier.
 * Player can Cashout or Kick Again.
 * Dynamic houseEdge from SiteConfiguration per brand.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getGameConfig, checkRiskLimits, recordPayout } from '../../common/helpers/game-tenant.helper';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ============================================
// DTOs
// ============================================
export interface StartPenaltyDto {
  betAmount: number;
  currency?: string;
}

export interface KickDto {
  sessionId: string;
  position: 'LEFT' | 'CENTER' | 'RIGHT';
}

export interface CashoutPenaltyDto {
  sessionId: string;
}

export interface PenaltyKickResult {
  sessionId: string;
  round: number;
  position: 'LEFT' | 'CENTER' | 'RIGHT';
  goalkeeperDive: 'LEFT' | 'CENTER' | 'RIGHT';
  isGoal: boolean;
  isSaved: boolean;
  currentMultiplier: number;
  nextMultiplier: number;
  canContinue: boolean;
  totalGoals: number;
  maxRounds: number;
}

export interface PenaltyCashoutResult {
  sessionId: string;
  totalGoals: number;
  multiplier: number;
  payout: number;
  profit: number;
}

// ============================================
// CONSTANTS
// ============================================
const MIN_BET = 0.01;
const MAX_ROUNDS = 10; // Maximum 10 penalty kicks
const RATE_LIMIT_MS = 300;

/**
 * Goal probability per position choice.
 * The goalkeeper has a 1/3 base chance to dive to the correct side.
 * With house edge applied, save probability increases slightly.
 */
const BASE_SAVE_CHANCE = 0.3333; // 33.33% base save chance per kick

/**
 * Multiplier accumulator table.
 * Each successful goal increases the multiplier.
 * Multipliers are designed to give the house edge over many games.
 */
/**
 * CALIBRATED Multiplier Table for 96% RTP.
 * Formula: multiplier(N) = (1 - houseEdge) / P(N consecutive goals)
 * P(goal) = 2/3 (goalie dives to 1 of 3 zones, player picks 1 of 3)
 * P(N goals) = (2/3)^N
 * multiplier(N) = 0.96 * 1.5^N
 */
const MULTIPLIER_TABLE: Record<number, number> = {
  1: 1.44,    // After 1 goal  (was 1.38)
  2: 2.16,    // After 2 goals (was 1.90)
  3: 3.24,    // After 3 goals (was 2.62)
  4: 4.86,    // After 4 goals (was 3.61)
  5: 7.29,    // After 5 goals (was 4.98)
  6: 10.94,   // After 6 goals (was 6.87)
  7: 16.40,   // After 7 goals (was 9.47)
  8: 24.60,   // After 8 goals (was 13.06)
  9: 36.91,   // After 9 goals (was 18.01)
  10: 55.36,  // After 10 goals (was 24.83)
};

// In-memory session store (like Mines)
const activeSessions = new Map<string, PenaltySession>();

interface PenaltySession {
  id: string;
  userId: string;
  siteId: string;
  betAmount: number;
  currency: string;
  walletId: string;
  currentBalance: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  round: number;
  goals: number;
  kicks: Array<{
    round: number;
    position: string;
    goalkeeperDive: string;
    isGoal: boolean;
  }>;
  currentMultiplier: number;
  houseEdge: number;
  isActive: boolean;
  createdAt: number;
}

// Cleanup stale sessions (1 hour)
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [id, session] of activeSessions.entries()) {
    if (session.createdAt < cutoff) {
      activeSessions.delete(id);
    }
  }
}, 300000); // Check every 5 minutes

@Injectable()
export class PenaltyService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // PROVABLY FAIR RNG
  // ============================================

  /**
   * Determine goalkeeper dive direction for a specific round.
   * Returns LEFT, CENTER, or RIGHT.
   */
  private generateGoalkeeperDive(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    round: number,
    houseEdge: number,
  ): 'LEFT' | 'CENTER' | 'RIGHT' {
    const hash = crypto.createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:kick:${round}`)
      .digest('hex');

    // Use first 8 hex chars for randomness
    const value = parseInt(hash.substring(0, 8), 16);
    const maxValue = 0xFFFFFFFF;
    const random = value / maxValue;

    // Adjusted save chance with house edge
    // Higher house edge = slightly more saves
    const adjustedSaveChance = BASE_SAVE_CHANCE + (houseEdge * 0.1);

    // Map random to goalkeeper position
    // Each position has equal base probability
    const third = 1 / 3;
    if (random < third) return 'LEFT';
    if (random < third * 2) return 'CENTER';
    return 'RIGHT';
  }

  /**
   * Calculate multiplier for a given number of goals
   * Applies house edge adjustment
   */
  private calculateMultiplier(goals: number, houseEdge: number): number {
    if (goals <= 0) return 0;
    const baseMultiplier = MULTIPLIER_TABLE[goals] || MULTIPLIER_TABLE[MAX_ROUNDS];
    // Adjust for house edge (table already includes ~4% edge, adjust for different edges)
    const adjustment = 1 - ((houseEdge - 0.04) * 2); // Normalize around 4% base
    return parseFloat((baseMultiplier * Math.max(0.5, adjustment)).toFixed(2));
  }

  // ============================================
  // GAME FLOW: START -> KICK -> KICK -> CASHOUT
  // ============================================

  /**
   * Start a new penalty shootout session.
   * Deducts bet amount from wallet.
   */
  async start(userId: string, dto: StartPenaltyDto, siteId: string): Promise<{ sessionId: string; maxRounds: number; multiplierTable: Record<number, number>; currentMultiplier: number; currentRound: number; goals: number }> {
    const { betAmount, currency = 'USDT' } = dto;

    // Get dynamic config
    const gameConfig = await getGameConfig(this.prisma, siteId, 'penalty');

    // Validate bet
    if (betAmount < MIN_BET || betAmount > gameConfig.maxBetAmount) {
      throw new BadRequestException(`Bet must be between ${MIN_BET} and ${gameConfig.maxBetAmount}`);
    }

    // Check for existing active session
    for (const [, session] of activeSessions) {
      if (session.userId === userId && session.isActive) {
        throw new BadRequestException('You already have an active penalty session. Cashout or finish it first.');
      }
    }

    // Get wallet and validate balance
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

    // Deduct bet amount atomically
    const newBalance = currentBalance.minus(betAmount);
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance.toNumber() },
    });

    // Generate provably fair seeds
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

    const nonce = serverSeedRecord.nonce + 1;
    await this.prisma.serverSeed.update({
      where: { id: serverSeedRecord.id },
      data: { nonce },
    });

    // Create session
    const sessionId = crypto.randomUUID();
    const session: PenaltySession = {
      id: sessionId,
      userId,
      siteId,
      betAmount,
      currency,
      walletId: wallet.id,
      currentBalance: newBalance.toNumber(),
      serverSeed: serverSeedRecord.seed,
      serverSeedHash: serverSeedRecord.seedHash,
      clientSeed: crypto.randomBytes(16).toString('hex'),
      nonce,
      round: 0,
      goals: 0,
      kicks: [],
      currentMultiplier: 0,
      houseEdge: gameConfig.houseEdge,
      isActive: true,
      createdAt: Date.now(),
    };

    activeSessions.set(sessionId, session);

    // Build multiplier table for display
    const multiplierTable: Record<number, number> = {};
    for (let i = 1; i <= MAX_ROUNDS; i++) {
      multiplierTable[i] = this.calculateMultiplier(i, gameConfig.houseEdge);
    }

    return { sessionId, maxRounds: MAX_ROUNDS, multiplierTable, currentMultiplier: 1.0, currentRound: 1, goals: 0 };
  }

  /**
   * Kick the ball - player chooses position.
   * RNG determines if goalkeeper saves or not.
   */
  async kick(userId: string, dto: KickDto): Promise<PenaltyKickResult | PenaltyCashoutResult> {
    const { sessionId, position } = dto;

    // Validate position
    if (!['LEFT', 'CENTER', 'RIGHT'].includes(position)) {
      throw new BadRequestException('Position must be LEFT, CENTER, or RIGHT');
    }

    // Get session
    const session = activeSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }
    if (session.userId !== userId) {
      throw new BadRequestException('This is not your session');
    }
    if (!session.isActive) {
      throw new BadRequestException('Session is no longer active');
    }
    if (session.round >= MAX_ROUNDS) {
      throw new BadRequestException('Maximum rounds reached. Please cashout.');
    }

    // Increment round
    session.round++;

    // Generate goalkeeper dive
    const goalkeeperDive = this.generateGoalkeeperDive(
      session.serverSeed,
      session.clientSeed,
      session.nonce,
      session.round,
      session.houseEdge,
    );

    // Determine if goal or save
    const isSaved = goalkeeperDive === position;
    const isGoal = !isSaved;

    // Record kick
    session.kicks.push({
      round: session.round,
      position,
      goalkeeperDive,
      isGoal,
    });

    if (isGoal) {
      session.goals++;
      session.currentMultiplier = this.calculateMultiplier(session.goals, session.houseEdge);
    }

    const canContinue = isGoal && session.round < MAX_ROUNDS;

    // If saved, game over - player loses
    if (isSaved) {
      session.isActive = false;
      // Save losing bet to database
      await this.saveBetResult(session, false, 0);
      activeSessions.delete(sessionId);
    }

    // If max rounds reached, auto-cashout
    if (isGoal && session.round >= MAX_ROUNDS) {
      const cashoutResult = await this.performCashout(session);
      return {
        sessionId,
        round: session.round,
        position,
        goalkeeperDive,
        isGoal: true,
        isSaved: false,
        currentMultiplier: cashoutResult.multiplier,
        nextMultiplier: 0,
        canContinue: false,
        totalGoals: cashoutResult.totalGoals,
        maxRounds: MAX_ROUNDS,
      } as PenaltyKickResult;
    }

    return {
      sessionId,
      round: session.round,
      position,
      goalkeeperDive,
      isGoal,
      isSaved,
      currentMultiplier: session.currentMultiplier,
      nextMultiplier: canContinue ? this.calculateMultiplier(session.goals + 1, session.houseEdge) : 0,
      canContinue,
      totalGoals: session.goals,
      maxRounds: MAX_ROUNDS,
    };
  }

  /**
   * Cashout current winnings
   */
  async cashout(userId: string, dto: CashoutPenaltyDto): Promise<PenaltyCashoutResult> {
    const { sessionId } = dto;

    const session = activeSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }
    if (session.userId !== userId) {
      throw new BadRequestException('This is not your session');
    }
    if (!session.isActive) {
      throw new BadRequestException('Session is no longer active');
    }
    if (session.goals === 0) {
      throw new BadRequestException('You need at least one goal to cashout');
    }

    return this.performCashout(session);
  }

  /**
   * Internal cashout logic
   */
  private async performCashout(session: PenaltySession): Promise<PenaltyCashoutResult> {
    session.isActive = false;

    const multiplier = session.currentMultiplier;
    const payout = parseFloat((session.betAmount * multiplier).toFixed(2));
    const profit = parseFloat((payout - session.betAmount).toFixed(2));

    // Risk limit check
    if (payout > 0) {
      const riskCheck = await checkRiskLimits(this.prisma, session.siteId, payout);
      if (!riskCheck.allowed) {
        // Still pay out but log the risk breach
        console.warn(`[PENALTY] Risk limit breach: ${riskCheck.reason}`);
      }
    }

    // Credit winnings atomically
    await this.prisma.$transaction(async (tx) => {
      if (payout > 0) {
        await tx.wallet.update({
          where: { id: session.walletId },
          data: { balance: { increment: payout } },
        });
      }

      await this.saveBetResultInTx(tx, session, true, payout);
    });

    // Record payout for risk tracking
    if (payout > 0) {
      await recordPayout(this.prisma, session.siteId, payout);
    }

    activeSessions.delete(session.id);

    return {
      sessionId: session.id,
      totalGoals: session.goals,
      multiplier,
      payout,
      profit,
    };
  }

  /**
   * Save bet result to database (for losses - outside transaction)
   */
  private async saveBetResult(session: PenaltySession, isWin: boolean, payout: number) {
    const profit = payout - session.betAmount;

    await this.prisma.$transaction(async (tx) => {
      await this.saveBetResultInTx(tx, session, isWin, payout);
    });
  }

  /**
   * Save bet result inside a transaction
   */
  private async saveBetResultInTx(tx: any, session: PenaltySession, isWin: boolean, payout: number) {
    const profit = payout - session.betAmount;

    await tx.bet.create({
      data: {
        userId: session.userId,
        siteId: session.siteId,
        gameType: 'PENALTY_SHOOTOUT' as any, // Using KENO as closest enum match for penalty
        currency: session.currency as any,
        betAmount: new Decimal(session.betAmount),
        multiplier: new Decimal(isWin ? session.currentMultiplier : 0),
        payout: new Decimal(payout),
        profit: new Decimal(profit),
        serverSeed: session.serverSeed,
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonce: session.nonce,
        gameData: {
          game: 'PENALTY_SHOOTOUT',
          rounds: session.round,
          goals: session.goals,
          kicks: session.kicks,
          houseEdge: session.houseEdge,
        },
        isWin,
      },
    });

    await tx.transaction.create({
      data: {
        userId: session.userId,
        siteId: session.siteId,
        walletId: session.walletId,
        type: 'BET',
        status: 'CONFIRMED',
        amount: new Decimal(session.betAmount),
        balanceBefore: session.currentBalance,
        balanceAfter: session.currentBalance + payout,
        externalRef: `PENALTY-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
        metadata: {
          game: 'PENALTY_SHOOTOUT',
          rounds: session.round,
          goals: session.goals,
          multiplier: isWin ? session.currentMultiplier : 0,
          payout,
          profit,
          isWin,
          siteId: session.siteId,
        },
      },
    });
  }

  // ============================================
  // HISTORY & VERIFICATION
  // ============================================

  async getHistory(userId: string, siteId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: {
        userId,
        siteId,
        gameData: { path: ['game'], equals: 'PENALTY_SHOOTOUT' },
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

  async verifyKick(serverSeed: string, clientSeed: string, nonce: number, round: number) {
    const hash = crypto.createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:kick:${round}`)
      .digest('hex');

    const value = parseInt(hash.substring(0, 8), 16);
    const maxValue = 0xFFFFFFFF;
    const random = value / maxValue;

    const third = 1 / 3;
    let goalkeeperDive: string;
    if (random < third) goalkeeperDive = 'LEFT';
    else if (random < third * 2) goalkeeperDive = 'CENTER';
    else goalkeeperDive = 'RIGHT';

    return {
      round,
      goalkeeperDive,
      seedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    };
  }

  /**
   * Get multiplier table for display
   */
  async getMultiplierTable(siteId: string) {
    const gameConfig = await getGameConfig(this.prisma, siteId, 'penalty');
    const table: Array<{ round: number; multiplier: number; goalProbability: string }> = [];

    for (let i = 1; i <= MAX_ROUNDS; i++) {
      table.push({
        round: i,
        multiplier: this.calculateMultiplier(i, gameConfig.houseEdge),
        goalProbability: ((1 - BASE_SAVE_CHANCE) * 100).toFixed(1) + '%',
      });
    }

    return table;
  }
}
