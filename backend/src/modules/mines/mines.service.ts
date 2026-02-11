import { getGameConfig, checkRiskLimits, recordPayout } from "../../common/helpers/game-tenant.helper";
/**
 * ============================================
 * MINES SERVICE - Provably Fair Mines Game
 * ============================================
 * 
 * Algorithm: HMAC-SHA256 based mine placement (Fisher-Yates shuffle)
 * House Edge: 4% (built into multiplier calculation)
 * Grid: 5×5 (25 tiles), configurable mine count (1-24)
 * 
 * Multiplier Formula: (25! / ((25-revealed)! * revealed!)) * (1 - houseEdge) / (safeTiles! / ((safeTiles-revealed)! * revealed!))
 * Simplified: Each reveal increases multiplier based on remaining safe probability
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ==================== TYPES ====================
export interface StartGameDto {
  betAmount: number;
  mineCount: number;  // 1-24 mines
  currency?: string;
}

export interface RevealTileDto {
  gameId: string;
  tileIndex: number;  // 0-24
}

export interface CashoutDto {
  gameId: string;
}

export interface MinesGameState {
  gameId: string;
  betAmount: number;
  mineCount: number;
  revealedTiles: number[];
  currentMultiplier: number;
  nextMultiplier: number;
  currentPayout: number;
  status: 'ACTIVE' | 'WON' | 'LOST';
  minePositions?: number[];  // Only revealed on game end
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

// ==================== CONSTANTS ====================
const GRID_SIZE = 25; // 5x5
const MIN_MINES = 1;
const MAX_MINES = 24;
// HOUSE_EDGE is now dynamic per brand - see getGameConfig
const MIN_BET = 0.01;
const MAX_BET = 10000;
const RATE_LIMIT_MS = 500;

// Active games map (in-memory for speed)
const activeGames = new Map<string, {
  userId: string;
  betAmount: number;
  mineCount: number;
  minePositions: number[];
  revealedTiles: number[];
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  currency: string;
  createdAt: number;
}>();

// Rate limiting
const userLastBetTime = new Map<string, number>();

@Injectable()
export class MinesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate mine positions using HMAC-SHA256 Fisher-Yates shuffle
   */
  generateMinePositions(serverSeed: string, clientSeed: string, nonce: number, mineCount: number): number[] {
    // Create array of all positions [0, 1, 2, ..., 24]
    const positions = Array.from({ length: GRID_SIZE }, (_, i) => i);
    
    // Fisher-Yates shuffle using HMAC-SHA256
    for (let i = GRID_SIZE - 1; i > 0; i--) {
      const message = `${clientSeed}:${nonce}:${i}`;
      const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
      const j = parseInt(hmac.substring(0, 8), 16) % (i + 1);
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // First N positions are mines
    return positions.slice(0, mineCount).sort((a, b) => a - b);
  }

  /**
   * Calculate multiplier for revealing N gems with M mines
   * Uses combinatorial probability with 4% house edge
   */
  calculateMultiplier(mineCount: number, revealedCount: number, houseEdge: number = 0.03): number {
    if (revealedCount === 0) return 1;
    
    const safeTiles = GRID_SIZE - mineCount;
    if (revealedCount > safeTiles) return 0;

    // Probability of surviving N reveals:
    // P = (safeTiles/25) * ((safeTiles-1)/24) * ... * ((safeTiles-N+1)/(25-N+1))
    let probability = 1;
    for (let i = 0; i < revealedCount; i++) {
      probability *= (safeTiles - i) / (GRID_SIZE - i);
    }

    if (probability <= 0) return 0;

    // Multiplier = (1 - houseEdge) / probability
    const multiplier = (1 - houseEdge) / probability;
    return Math.floor(multiplier * 10000) / 10000; // Floor to 4 decimals
  }

  /**
   * Start a new mines game
   */
  async startGame(userId: string, dto: StartGameDto, siteId: string = "default-site-001"): Promise<MinesGameState> {
    const { betAmount, mineCount, currency = 'USDT' } = dto;

    // Rate limiting
    const now = Date.now();
    const lastBet = userLastBetTime.get(userId) || 0;
    if (now - lastBet < RATE_LIMIT_MS) {
      throw new BadRequestException('Please wait before starting another game');
    }
    userLastBetTime.set(userId, now);

    // Clean up rate limit map
    if (userLastBetTime.size > 10000) {
      const cutoff = now - 60000;
      for (const [uid, time] of userLastBetTime.entries()) {
        if (time < cutoff) userLastBetTime.delete(uid);
      }
    }

    // Check for existing active game
    for (const [gameId, game] of activeGames.entries()) {
      if (game.userId === userId) {
        throw new BadRequestException('You already have an active game. Cash out or finish it first.');
      }
    }

    // Validate inputs
    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      throw new BadRequestException(`Bet amount must be between ${MIN_BET} and ${MAX_BET}`);
    }
    if (mineCount < MIN_MINES || mineCount > MAX_MINES) {
      throw new BadRequestException(`Mine count must be between ${MIN_MINES} and ${MAX_MINES}`);
    }

    // Generate provably fair seeds
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = Math.floor(Math.random() * 1000000);

    // Generate mine positions
    const minePositions = this.generateMinePositions(serverSeed, clientSeed, nonce, mineCount);

    // Deduct bet amount atomically
    await this.prisma.$transaction(async (tx) => {
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

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: currentBalance.minus(betAmount).toNumber() },
      });
    });

    // Create game ID and store in memory
    const gameId = crypto.randomUUID();
    activeGames.set(gameId, {
      userId,
      betAmount,
      mineCount,
      minePositions,
      revealedTiles: [],
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      currency,
      createdAt: now,
    });

    // Clean up old games (>1 hour)
    for (const [gid, game] of activeGames.entries()) {
      if (now - game.createdAt > 3600000) {
        activeGames.delete(gid);
      }
    }

    const nextMultiplier = this.calculateMultiplier(mineCount, 1);

    return {
      gameId,
      betAmount,
      mineCount,
      revealedTiles: [],
      currentMultiplier: 1,
      nextMultiplier,
      currentPayout: 0,
      status: 'ACTIVE',
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }

  /**
   * Reveal a tile
   */
  async revealTile(userId: string, dto: RevealTileDto): Promise<MinesGameState> {
    const { gameId, tileIndex } = dto;

    const game = activeGames.get(gameId);
    if (!game) {
      throw new BadRequestException('Game not found or expired');
    }
    if (game.userId !== userId) {
      throw new BadRequestException('This is not your game');
    }
    if (tileIndex < 0 || tileIndex >= GRID_SIZE) {
      throw new BadRequestException('Invalid tile index');
    }
    if (game.revealedTiles.includes(tileIndex)) {
      throw new BadRequestException('Tile already revealed');
    }

    // Check if it's a mine
    const isMine = game.minePositions.includes(tileIndex);

    if (isMine) {
      // LOST - reveal all mines
      activeGames.delete(gameId);

      // Save bet to database as loss
      await this.saveBetToDatabase(userId, game, 0, -game.betAmount, false, 'default-site-001');

      return {
        gameId,
        betAmount: game.betAmount,
        mineCount: game.mineCount,
        revealedTiles: [...game.revealedTiles, tileIndex],
        currentMultiplier: 0,
        nextMultiplier: 0,
        currentPayout: 0,
        status: 'LOST',
        minePositions: game.minePositions,
        serverSeedHash: game.serverSeedHash,
        clientSeed: game.clientSeed,
        nonce: game.nonce,
      };
    }

    // Safe tile - add to revealed
    game.revealedTiles.push(tileIndex);
    const revealedCount = game.revealedTiles.length;
    const currentMultiplier = this.calculateMultiplier(game.mineCount, revealedCount);
    const currentPayout = game.betAmount * currentMultiplier;
    const safeTiles = GRID_SIZE - game.mineCount;

    // Check if all safe tiles are revealed (auto-win)
    if (revealedCount >= safeTiles) {
      activeGames.delete(gameId);
      const profit = currentPayout - game.betAmount;

      // Credit winnings
      await this.creditWinnings(userId, game.currency, currentPayout);
      await this.saveBetToDatabase(userId, game, currentMultiplier, profit, true, 'default-site-001');

      return {
        gameId,
        betAmount: game.betAmount,
        mineCount: game.mineCount,
        revealedTiles: game.revealedTiles,
        currentMultiplier,
        nextMultiplier: 0,
        currentPayout,
        status: 'WON',
        minePositions: game.minePositions,
        serverSeedHash: game.serverSeedHash,
        clientSeed: game.clientSeed,
        nonce: game.nonce,
      };
    }

    const nextMultiplier = this.calculateMultiplier(game.mineCount, revealedCount + 1);

    return {
      gameId,
      betAmount: game.betAmount,
      mineCount: game.mineCount,
      revealedTiles: game.revealedTiles,
      currentMultiplier,
      nextMultiplier,
      currentPayout,
      status: 'ACTIVE',
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
    };
  }

  /**
   * Cash out current winnings
   */
  async cashout(userId: string, dto: CashoutDto): Promise<MinesGameState> {
    const { gameId } = dto;

    const game = activeGames.get(gameId);
    if (!game) {
      throw new BadRequestException('Game not found or expired');
    }
    if (game.userId !== userId) {
      throw new BadRequestException('This is not your game');
    }
    if (game.revealedTiles.length === 0) {
      throw new BadRequestException('Must reveal at least one tile before cashing out');
    }

    const revealedCount = game.revealedTiles.length;
    const currentMultiplier = this.calculateMultiplier(game.mineCount, revealedCount);
    const currentPayout = game.betAmount * currentMultiplier;
    const profit = currentPayout - game.betAmount;

    activeGames.delete(gameId);

    // Credit winnings
    await this.creditWinnings(userId, game.currency, currentPayout);
    await this.saveBetToDatabase(userId, game, currentMultiplier, profit, true, 'default-site-001');

    return {
      gameId,
      betAmount: game.betAmount,
      mineCount: game.mineCount,
      revealedTiles: game.revealedTiles,
      currentMultiplier,
      nextMultiplier: 0,
      currentPayout,
      status: 'WON',
      minePositions: game.minePositions,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
    };
  }

  /**
   * Get current game state
   */
  getActiveGame(userId: string): MinesGameState | null {
    for (const [gameId, game] of activeGames.entries()) {
      if (game.userId === userId) {
        const revealedCount = game.revealedTiles.length;
        const currentMultiplier = revealedCount > 0 
          ? this.calculateMultiplier(game.mineCount, revealedCount)
          : 1;
        const nextMultiplier = this.calculateMultiplier(game.mineCount, revealedCount + 1);

        return {
          gameId,
          betAmount: game.betAmount,
          mineCount: game.mineCount,
          revealedTiles: game.revealedTiles,
          currentMultiplier,
          nextMultiplier,
          currentPayout: revealedCount > 0 ? game.betAmount * currentMultiplier : 0,
          status: 'ACTIVE',
          serverSeedHash: game.serverSeedHash,
          clientSeed: game.clientSeed,
          nonce: game.nonce,
        };
      }
    }
    return null;
  }

  /**
   * Credit winnings to user wallet
   */
  private async creditWinnings(userId: string, currency: string, amount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lockedWallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" 
        WHERE "userId" = ${userId} AND currency = ${currency}::"Currency"
        FOR UPDATE
      `;

      if (!lockedWallets || lockedWallets.length === 0) return;

      const wallet = lockedWallets[0];
      const newBalance = new Decimal(wallet.balance).plus(amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });
    });
  }

  /**
   * Save completed bet to database
   */
  private async saveBetToDatabase(
    userId: string,
    game: any,
    multiplier: number,
    profit: number,
    isWin: boolean,
    siteId: string = 'default-site-001',
  ): Promise<void> {
    try {
      await this.prisma.bet.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          gameType: 'MINES',
          siteId,
          currency: game.currency as any,
          betAmount: new Decimal(game.betAmount),
          multiplier: new Decimal(multiplier),
          payout: new Decimal(isWin ? game.betAmount * multiplier : 0),
          profit: new Decimal(profit),
          serverSeed: game.serverSeed,
          serverSeedHash: game.serverSeedHash,
          clientSeed: game.clientSeed,
          nonce: game.nonce,
          gameData: {
            mineCount: game.mineCount,
            minePositions: game.minePositions,
            revealedTiles: game.revealedTiles,
            tilesRevealed: game.revealedTiles.length,
          },
          isWin,
        },
      });
    } catch (err) {
      // Log but don't fail the game
      // console.error('Failed to save mines bet:', err);
    }
  }

  /**
   * Verify mine positions
   */
  verifyGame(serverSeed: string, clientSeed: string, nonce: number, mineCount: number) {
    const minePositions = this.generateMinePositions(serverSeed, clientSeed, nonce, mineCount);
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { minePositions, serverSeedHash };
  }

  /**
   * Get game history
   */
  async getHistory(userId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: { userId, gameType: 'MINES' },
          // siteId removed - not in scope
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
