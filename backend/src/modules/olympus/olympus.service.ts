import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import {
  GRID_COLS,
  GRID_ROWS,
  GRID_SIZE,
  MIN_BET,
  MAX_BET,
  MAX_WIN_MULTIPLIER,
  HOUSE_EDGE,
  FREE_SPINS_COUNT,
  FREE_SPINS_RETRIGGER,
  SCATTERS_FOR_FREE_SPINS,
  ANTE_BET_MULTIPLIER,
  OlympusSymbol,
  SYMBOL_WEIGHTS,
  TOTAL_WEIGHT,
  ANTE_SYMBOL_WEIGHTS,
  ANTE_TOTAL_WEIGHT,
  PAYTABLE,
  MIN_CLUSTER_SIZE,
  MULTIPLIER_VALUES,
  MULTIPLIER_TOTAL_WEIGHT,
} from './olympus.constants';

// ============================================
// DTOs
// ============================================
export interface SpinDto {
  betAmount: number;
  currency?: string;
  anteBet?: boolean;
}

export interface FreeSpinDto {
  sessionId: string;
}

// ============================================
// INTERNAL TYPES
// ============================================
export interface GridCell {
  symbol: OlympusSymbol;
  position: number; // 0-29 (row * GRID_COLS + col)
  multiplierValue?: number; // Only for multiplier orbs
}

export interface ClusterWin {
  symbol: OlympusSymbol;
  count: number;
  positions: number[];
  payout: number; // Multiplier of bet
}

export interface TumbleResult {
  grid: GridCell[];
  wins: ClusterWin[];
  multipliers: number[]; // Multiplier orb values collected
  removedPositions: number[];
}

export interface SpinResult {
  initialGrid: GridCell[];
  tumbles: TumbleResult[];
  totalWinMultiplier: number;
  totalMultiplierSum: number;
  finalPayout: number;
  scatterCount: number;
  freeSpinsAwarded: number;
}

// ============================================
// FREE SPIN SESSION (in-memory, per user)
// ============================================
interface FreeSpinSession {
  id: string;
  userId: string;
  betAmount: number;
  currency: string;
  anteBet: boolean;
  spinsRemaining: number;
  totalSpins: number;
  cumulativeMultiplier: number; // Multipliers accumulate across free spins
  totalWin: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  createdAt: Date;
}

@Injectable()
export class OlympusService {
  // In-memory free spin sessions
  private freeSpinSessions: Map<string, FreeSpinSession> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // MAIN SPIN ENDPOINT
  // ============================================
  async spin(userId: string, dto: SpinDto) {
    const { betAmount, currency = 'USDT', anteBet = false } = dto;

    // Validate bet
    const actualBet = anteBet ? betAmount * ANTE_BET_MULTIPLIER : betAmount;
    if (actualBet < MIN_BET || actualBet > MAX_BET) {
      throw new BadRequestException(`Bet must be between $${MIN_BET} and $${MAX_BET}`);
    }

    // Check if user has active free spins
    const activeSession = this.getActiveSession(userId);
    if (activeSession) {
      throw new BadRequestException('You have active free spins. Complete them first.');
    }

    // Generate Provably Fair seeds
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = 0;

    // Execute the spin
    const spinResult = this.executeSpin(serverSeed, clientSeed, nonce, anteBet);

    // Calculate final payout
    // IMPORTANT: In base game, multiplier orbs are COSMETIC ONLY
    // They are displayed but do NOT affect the payout
    // Multipliers only affect payouts during FREE SPINS
    let totalWin = spinResult.totalWinMultiplier * actualBet;

    // Cap at max win
    totalWin = Math.min(totalWin, actualBet * MAX_WIN_MULTIPLIER);

    const profit = totalWin - actualBet;
    const isWin = totalWin > 0;
    const finalMultiplier = actualBet > 0 ? totalWin / actualBet : 0;

    // Handle free spins trigger
    let freeSpinSessionId: string | null = null;
    if (spinResult.freeSpinsAwarded > 0) {
      const session: FreeSpinSession = {
        id: crypto.randomUUID(),
        userId,
        betAmount: actualBet,
        currency,
        anteBet,
        spinsRemaining: spinResult.freeSpinsAwarded,
        totalSpins: spinResult.freeSpinsAwarded,
        cumulativeMultiplier: 0,
        totalWin: 0,
        serverSeed,
        clientSeed,
        nonce: 1, // Next nonce for free spins
        createdAt: new Date(),
      };
      this.freeSpinSessions.set(session.id, session);
      freeSpinSessionId = session.id;
    }

    // Atomic transaction: deduct bet, add winnings, save bet record
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

      if (currentBalance.lessThan(actualBet)) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = currentBalance.minus(actualBet).plus(totalWin);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      await tx.bet.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          gameType: 'OLYMPUS',
          currency: currency as any,
          betAmount: new Decimal(actualBet),
          multiplier: new Decimal(finalMultiplier),
          payout: new Decimal(totalWin),
          profit: new Decimal(profit),
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          gameData: {
            type: 'spin',
            anteBet,
            initialGrid: spinResult.initialGrid.map((c) => ({
              s: c.symbol,
              p: c.position,
              m: c.multiplierValue,
            })),
            tumbleCount: spinResult.tumbles.length,
            totalWinMultiplier: spinResult.totalWinMultiplier,
            totalMultiplierSum: spinResult.totalMultiplierSum,
            scatterCount: spinResult.scatterCount,
            freeSpinsAwarded: spinResult.freeSpinsAwarded,
          },
          isWin,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: new Decimal(actualBet),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          externalRef: `OLYMPUS-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: {
            game: 'OLYMPUS',
            totalWin,
            profit,
            multiplier: finalMultiplier,
            isWin,
            anteBet,
            scatterCount: spinResult.scatterCount,
            freeSpinsAwarded: spinResult.freeSpinsAwarded,
          },
        },
      });
    });

    return {
      initialGrid: this.formatGrid(spinResult.initialGrid),
      tumbles: spinResult.tumbles.map((t) => ({
        grid: this.formatGrid(t.grid),
        wins: t.wins,
        multipliers: t.multipliers,
        removedPositions: t.removedPositions,
      })),
      totalWin,
      totalMultiplier: finalMultiplier,
      multiplierSum: spinResult.totalMultiplierSum,
      scatterCount: spinResult.scatterCount,
      freeSpinsAwarded: spinResult.freeSpinsAwarded,
      freeSpinSessionId,
      isWin,
      profit,
      betAmount: actualBet,
      anteBet,
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }

  // ============================================
  // FREE SPIN ENDPOINT
  // ============================================
  async freeSpin(userId: string, dto: FreeSpinDto) {
    const session = this.freeSpinSessions.get(dto.sessionId);
    if (!session) {
      throw new BadRequestException('No active free spin session');
    }
    if (session.userId !== userId) {
      throw new BadRequestException('Session does not belong to this user');
    }
    if (session.spinsRemaining <= 0) {
      throw new BadRequestException('No free spins remaining');
    }

    // Execute the free spin
    const spinResult = this.executeSpin(
      session.serverSeed,
      session.clientSeed,
      session.nonce,
      session.anteBet,
    );

    // Collect multipliers (cumulative in free spins)
    session.cumulativeMultiplier += spinResult.totalMultiplierSum;

    // In FREE SPINS, multipliers DO apply but with a reasonable cap
    // Formula: baseWin * max(1, cumulativeMultiplier * 0.1)
    // This gives a small boost from multipliers without exploding payouts
    let spinWin = spinResult.totalWinMultiplier * session.betAmount;
    if (session.cumulativeMultiplier > 0 && spinResult.totalWinMultiplier > 0) {
      // Apply a dampened multiplier: each accumulated multiplier point adds 10% to the win
      const multiplierBoost = 1 + (session.cumulativeMultiplier * 0.1);
      spinWin = spinResult.totalWinMultiplier * Math.min(multiplierBoost, 50) * session.betAmount;
    }

    // Cap individual spin win
    spinWin = Math.min(spinWin, session.betAmount * MAX_WIN_MULTIPLIER);

    session.totalWin += spinWin;
    session.nonce++;
    session.spinsRemaining--;

    // Check for retrigger (4+ scatters during free spins)
    if (spinResult.scatterCount >= SCATTERS_FOR_FREE_SPINS) {
      session.spinsRemaining += FREE_SPINS_RETRIGGER;
      session.totalSpins += FREE_SPINS_RETRIGGER;
    }

    const isComplete = session.spinsRemaining <= 0;

    // If free spins are complete, pay out the total
    if (isComplete) {
      const totalWin = session.totalWin;
      const profit = totalWin; // Free spins are free, all winnings are profit

      // Atomic transaction for free spin payout
      await this.prisma.$transaction(async (tx) => {
        const lockedWallets = await tx.$queryRaw<any[]>`
          SELECT id, balance FROM "Wallet"
          WHERE "userId" = ${userId} AND currency = ${session.currency}::"Currency"
          FOR UPDATE
        `;

        if (!lockedWallets || lockedWallets.length === 0) {
          throw new BadRequestException('Wallet not found');
        }

        const wallet = lockedWallets[0];
        const currentBalance = new Decimal(wallet.balance);
        const newBalance = currentBalance.plus(totalWin);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance.toNumber() },
        });

        await tx.bet.create({
          data: {
            id: crypto.randomUUID(),
            userId: session.userId,
            gameType: 'OLYMPUS',
            currency: session.currency as any,
            betAmount: new Decimal(0), // Free spin - no cost
            multiplier: new Decimal(totalWin > 0 ? totalWin / session.betAmount : 0),
            payout: new Decimal(totalWin),
            profit: new Decimal(profit),
            serverSeed: session.serverSeed,
            serverSeedHash: crypto.createHash('sha256').update(session.serverSeed).digest('hex'),
            clientSeed: session.clientSeed,
            nonce: session.nonce,
            gameData: {
              type: 'free_spin_complete',
              totalSpins: session.totalSpins,
              cumulativeMultiplier: session.cumulativeMultiplier,
              totalWin,
            },
            isWin: totalWin > 0,
          },
        });

        await tx.transaction.create({
          data: {
            userId: session.userId,
            walletId: wallet.id,
            type: 'BET',
            status: 'CONFIRMED',
            amount: new Decimal(0),
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            externalRef: `OLYMPUS-FS-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
            metadata: {
              game: 'OLYMPUS',
              type: 'free_spin_complete',
              totalWin,
              totalSpins: session.totalSpins,
              cumulativeMultiplier: session.cumulativeMultiplier,
            },
          },
        });
      });

      this.freeSpinSessions.delete(dto.sessionId);
    }

    return {
      initialGrid: this.formatGrid(spinResult.initialGrid),
      tumbles: spinResult.tumbles.map((t) => ({
        grid: this.formatGrid(t.grid),
        wins: t.wins,
        multipliers: t.multipliers,
        removedPositions: t.removedPositions,
      })),
      spinWin,
      cumulativeMultiplier: session.cumulativeMultiplier,
      spinsRemaining: session.spinsRemaining,
      totalSpins: session.totalSpins,
      totalWin: session.totalWin,
      scatterCount: spinResult.scatterCount,
      retriggered: spinResult.scatterCount >= SCATTERS_FOR_FREE_SPINS,
      isComplete,
    };
  }

  // ============================================
  // GAME STATE
  // ============================================
  async getState(userId: string) {
    const session = this.getActiveSession(userId);
    if (!session) {
      return { hasActiveSession: false };
    }
    return {
      hasActiveSession: true,
      sessionId: session.id,
      spinsRemaining: session.spinsRemaining,
      totalSpins: session.totalSpins,
      cumulativeMultiplier: session.cumulativeMultiplier,
      totalWin: session.totalWin,
      betAmount: session.betAmount,
    };
  }

  // ============================================
  // PAYTABLE INFO
  // ============================================
  getPaytable() {
    const symbols = SYMBOL_WEIGHTS.map((sw) => ({
      id: sw.symbol,
      weight: sw.weight,
      payouts: PAYTABLE[sw.symbol] || null,
    }));

    return {
      symbols,
      multiplierValues: MULTIPLIER_VALUES.map((mv) => ({
        value: mv.value,
        probability: `${((mv.weight / MULTIPLIER_TOTAL_WEIGHT) * 100).toFixed(1)}%`,
      })),
      houseEdge: `${HOUSE_EDGE * 100}%`,
      rtp: `${(1 - HOUSE_EDGE) * 100}%`,
      maxWin: `${MAX_WIN_MULTIPLIER}x`,
      freeSpins: {
        trigger: `${SCATTERS_FOR_FREE_SPINS}+ Scatter symbols`,
        count: FREE_SPINS_COUNT,
        retrigger: FREE_SPINS_RETRIGGER,
        feature: 'Cumulative multipliers (only active in free spins)',
      },
    };
  }

  // ============================================
  // VERIFY SPIN (Provably Fair)
  // ============================================
  verify(serverSeed: string, clientSeed: string, nonce: number, anteBet: boolean = false) {
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const spinResult = this.executeSpin(serverSeed, clientSeed, nonce, anteBet);

    return {
      serverSeedHash,
      initialGrid: this.formatGrid(spinResult.initialGrid),
      tumbles: spinResult.tumbles.map((t) => ({
        grid: this.formatGrid(t.grid),
        wins: t.wins,
        multipliers: t.multipliers,
        removedPositions: t.removedPositions,
      })),
      totalWinMultiplier: spinResult.totalWinMultiplier,
      multiplierSum: spinResult.totalMultiplierSum,
      scatterCount: spinResult.scatterCount,
      freeSpinsAwarded: spinResult.freeSpinsAwarded,
    };
  }

  // ============================================
  // BET HISTORY
  // ============================================
  async getHistory(userId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: { userId, gameType: 'OLYMPUS' },
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
        serverSeedHash: true,
        clientSeed: true,
        nonce: true,
      },
    });
  }

  // ============================================
  // CORE GAME LOGIC
  // ============================================

  /**
   * Execute a full spin with tumble mechanic
   */
  private executeSpin(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    anteBet: boolean,
  ): SpinResult {
    let positionIndex = 0; // Tracks the HMAC position index for Provably Fair
    const allMultipliers: number[] = [];
    const tumbles: TumbleResult[] = [];

    // Generate initial grid
    let grid = this.generateGrid(serverSeed, clientSeed, nonce, anteBet, positionIndex);
    positionIndex += GRID_SIZE;

    const initialGrid = [...grid];
    let totalWinMultiplier = 0;
    let scatterCount = this.countSymbol(grid, OlympusSymbol.SCATTER);

    // Collect multiplier orbs from initial grid
    const initialMultipliers = this.collectMultipliers(grid, serverSeed, clientSeed, nonce, positionIndex);
    positionIndex += initialMultipliers.length;
    allMultipliers.push(...initialMultipliers.map((m) => m.value));

    // Tumble loop
    let tumbleIteration = 0;
    const MAX_TUMBLES = 50; // Safety limit

    while (tumbleIteration < MAX_TUMBLES) {
      const wins = this.findClusters(grid);
      if (wins.length === 0) break;

      // Calculate win from this tumble
      const tumbleWin = wins.reduce((sum, w) => sum + w.payout, 0);
      totalWinMultiplier += tumbleWin;

      // Get positions to remove
      const removedPositions = new Set<number>();
      wins.forEach((w) => w.positions.forEach((p) => removedPositions.add(p)));

      // Create tumble result
      const tumbleResult: TumbleResult = {
        grid: [...grid],
        wins,
        multipliers: allMultipliers.slice(), // Current multipliers
        removedPositions: Array.from(removedPositions),
      };
      tumbles.push(tumbleResult);

      // Remove winning symbols and refill
      grid = this.tumbleGrid(grid, Array.from(removedPositions), serverSeed, clientSeed, nonce, positionIndex, anteBet);
      positionIndex += removedPositions.size;

      // Collect new multiplier orbs from refilled positions
      const newMultipliers = this.collectMultipliers(grid, serverSeed, clientSeed, nonce, positionIndex);
      positionIndex += newMultipliers.length;
      allMultipliers.push(...newMultipliers.map((m) => m.value));

      // Count new scatters
      scatterCount += this.countNewScatters(grid, Array.from(removedPositions));

      tumbleIteration++;
    }

    // Calculate free spins
    const freeSpinsAwarded = scatterCount >= SCATTERS_FOR_FREE_SPINS ? FREE_SPINS_COUNT : 0;

    return {
      initialGrid,
      tumbles,
      totalWinMultiplier,
      totalMultiplierSum: allMultipliers.reduce((sum, m) => sum + m, 0),
      finalPayout: 0, // Calculated by caller
      scatterCount,
      freeSpinsAwarded,
    };
  }

  /**
   * Generate a 6x5 grid using Provably Fair HMAC-SHA256
   */
  private generateGrid(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    anteBet: boolean,
    startIndex: number = 0,
  ): GridCell[] {
    const grid: GridCell[] = [];
    const weights = anteBet ? ANTE_SYMBOL_WEIGHTS : SYMBOL_WEIGHTS;
    const totalW = anteBet ? ANTE_TOTAL_WEIGHT : TOTAL_WEIGHT;

    for (let i = 0; i < GRID_SIZE; i++) {
      const hash = this.hmacSha256(serverSeed, `${clientSeed}:${nonce}:${startIndex + i}`);
      const value = parseInt(hash.substring(0, 8), 16) % totalW;
      const symbol = this.weightedSelect(value, weights);

      const cell: GridCell = { symbol, position: i };

      // If it's a multiplier orb, assign a value
      if (symbol === OlympusSymbol.MULTIPLIER) {
        const multHash = this.hmacSha256(serverSeed, `${clientSeed}:${nonce}:mult:${startIndex + i}`);
        const multValue = parseInt(multHash.substring(0, 8), 16) % MULTIPLIER_TOTAL_WEIGHT;
        cell.multiplierValue = this.selectMultiplierValue(multValue);
      }

      grid.push(cell);
    }

    return grid;
  }

  /**
   * Find all winning clusters (8+ matching symbols)
   */
  private findClusters(grid: GridCell[]): ClusterWin[] {
    const wins: ClusterWin[] = [];
    const symbolCounts: Map<OlympusSymbol, number[]> = new Map();

    // Count each symbol's positions (excluding scatter and multiplier)
    for (const cell of grid) {
      if (cell.symbol === OlympusSymbol.SCATTER || cell.symbol === OlympusSymbol.MULTIPLIER) {
        continue;
      }
      if (!symbolCounts.has(cell.symbol)) {
        symbolCounts.set(cell.symbol, []);
      }
      symbolCounts.get(cell.symbol)!.push(cell.position);
    }

    // Check each symbol for cluster wins
    for (const [symbol, positions] of symbolCounts) {
      if (positions.length >= MIN_CLUSTER_SIZE) {
        const payoutTable = PAYTABLE[symbol];
        if (!payoutTable) continue;

        // Find the highest applicable payout
        const count = Math.min(positions.length, 12); // Cap at 12+
        let payout = 0;
        for (let c = count; c >= MIN_CLUSTER_SIZE; c--) {
          if (payoutTable[c] !== undefined) {
            payout = payoutTable[c];
            break;
          }
        }
        // For counts > 12, use the 12+ payout
        if (count >= 12 && payoutTable[12]) {
          payout = payoutTable[12];
        }

        if (payout > 0) {
          wins.push({ symbol, count: positions.length, positions, payout });
        }
      }
    }

    return wins;
  }

  /**
   * Tumble: remove winning symbols, drop remaining, refill from top
   */
  private tumbleGrid(
    grid: GridCell[],
    removedPositions: number[],
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    startIndex: number,
    anteBet: boolean,
  ): GridCell[] {
    const newGrid: GridCell[] = new Array(GRID_SIZE);
    const removedSet = new Set(removedPositions);
    const weights = anteBet ? ANTE_SYMBOL_WEIGHTS : SYMBOL_WEIGHTS;
    const totalW = anteBet ? ANTE_TOTAL_WEIGHT : TOTAL_WEIGHT;

    let refillIndex = 0;

    // Process column by column (gravity drops down)
    for (let col = 0; col < GRID_COLS; col++) {
      // Collect surviving symbols in this column (bottom to top)
      const surviving: GridCell[] = [];
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        const pos = row * GRID_COLS + col;
        if (!removedSet.has(pos)) {
          surviving.push(grid[pos]);
        }
      }

      // Place surviving symbols at the bottom
      let writeRow = GRID_ROWS - 1;
      for (const cell of surviving) {
        const newPos = writeRow * GRID_COLS + col;
        newGrid[newPos] = { ...cell, position: newPos };
        writeRow--;
      }

      // Fill remaining top positions with new symbols
      while (writeRow >= 0) {
        const newPos = writeRow * GRID_COLS + col;
        const hash = this.hmacSha256(serverSeed, `${clientSeed}:${nonce}:${startIndex + refillIndex}`);
        const value = parseInt(hash.substring(0, 8), 16) % totalW;
        const symbol = this.weightedSelect(value, weights);

        const cell: GridCell = { symbol, position: newPos };

        if (symbol === OlympusSymbol.MULTIPLIER) {
          const multHash = this.hmacSha256(serverSeed, `${clientSeed}:${nonce}:mult:${startIndex + refillIndex}`);
          const multValue = parseInt(multHash.substring(0, 8), 16) % MULTIPLIER_TOTAL_WEIGHT;
          cell.multiplierValue = this.selectMultiplierValue(multValue);
        }

        newGrid[newPos] = cell;
        refillIndex++;
        writeRow--;
      }
    }

    return newGrid;
  }

  /**
   * Collect multiplier orb values from the grid
   */
  private collectMultipliers(
    grid: GridCell[],
    _serverSeed: string,
    _clientSeed: string,
    _nonce: number,
    _startIndex: number,
  ): { position: number; value: number }[] {
    const multipliers: { position: number; value: number }[] = [];
    for (const cell of grid) {
      if (cell.symbol === OlympusSymbol.MULTIPLIER && cell.multiplierValue) {
        multipliers.push({ position: cell.position, value: cell.multiplierValue });
      }
    }
    return multipliers;
  }

  /**
   * Count scatters that appeared in newly filled positions
   */
  private countNewScatters(grid: GridCell[], newPositions: number[]): number {
    let count = 0;
    for (const pos of newPositions) {
      if (grid[pos] && grid[pos].symbol === OlympusSymbol.SCATTER) {
        count++;
      }
    }
    return count;
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  private hmacSha256(key: string, message: string): string {
    return crypto.createHmac('sha256', key).update(message).digest('hex');
  }

  private weightedSelect(
    value: number,
    weights: { symbol: OlympusSymbol; weight: number }[],
  ): OlympusSymbol {
    let cumulative = 0;
    for (const entry of weights) {
      cumulative += entry.weight;
      if (value < cumulative) {
        return entry.symbol;
      }
    }
    return weights[weights.length - 1].symbol;
  }

  private selectMultiplierValue(value: number): number {
    let cumulative = 0;
    for (const entry of MULTIPLIER_VALUES) {
      cumulative += entry.weight;
      if (value < cumulative) {
        return entry.value;
      }
    }
    return MULTIPLIER_VALUES[MULTIPLIER_VALUES.length - 1].value;
  }

  private countSymbol(grid: GridCell[], symbol: OlympusSymbol): number {
    return grid.filter((c) => c.symbol === symbol).length;
  }

  private getActiveSession(userId: string): FreeSpinSession | null {
    for (const session of this.freeSpinSessions.values()) {
      if (session.userId === userId && session.spinsRemaining > 0) {
        return session;
      }
    }
    return null;
  }

  private formatGrid(grid: GridCell[]): any[][] {
    const formatted: any[][] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowData: any[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = grid[row * GRID_COLS + col];
        const entry: any = { symbol: cell.symbol };
        if (cell.multiplierValue) {
          entry.multiplier = cell.multiplierValue;
        }
        rowData.push(entry);
      }
      formatted.push(rowData);
    }
    return formatted;
  }
}
