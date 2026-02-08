import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { GameConfigService } from './game-config.service';


/**
 * Game States for the Crash State Machine
 */
export enum GameState {
  WAITING = 'WAITING',   // 6 seconds - Users place bets
  RUNNING = 'RUNNING',   // Variable time - Multiplier rises
  CRASHED = 'CRASHED',   // 3 seconds - Show crash point
}

/**
 * Bet placed by a user
 */
export interface CrashBet {
  id: string;
  oderId: string;
  amount: Decimal;
  autoCashoutAt: Decimal | null;  // null = manual cashout
  cashedOutAt: Decimal | null;    // null = not cashed out yet
  profit: Decimal | null;
  status: 'ACTIVE' | 'CASHED_OUT' | 'LOST';
}

/**
 * Game Round data
 */
export interface GameRound {
  id: string;
  gameNumber: number;
  serverSeed: string;
  serverSeedHash: string;  // Shown to users BEFORE the game
  clientSeed: string;
  nonce: number;
  crashPoint: Decimal;
  state: GameState;
  currentMultiplier: Decimal;
  bets: Map<string, CrashBet>;  // userId -> bet
  startedAt: Date | null;
  crashedAt: Date | null;
}

/**
 * Events emitted by the Crash Service
 */
export interface CrashEvents {
  'crash.state_change': { state: GameState; round: Partial<GameRound> };
  'crash.tick': { multiplier: string; elapsed: number };
  'crash.bet_placed': { userId: string; username: string; amount: string; betId: string; currency: string };
  'crash.cashout': { userId: string; multiplier: string; profit: string };
  'crash.crashed': { crashPoint: string; gameNumber: number };
  'crash.balance_update': { userId: string; change: string; reason: string };
}

/**
 * Crash Game Service
 * 
 * Implements the core Crash game logic with:
 * - Provably Fair algorithm (industry standard)
 * - State Machine (WAITING -> RUNNING -> CRASHED)
 * - Real-time multiplier updates (100ms ticks)
 * - Auto-cashout functionality
 * 
 * The game is AUTHORITATIVE - all logic runs on the server
 * to prevent cheating.
 */
@Injectable()
export class CrashService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrashService.name);
  
  // Game configuration
  private readonly WAITING_TIME = 10000;   // 10 seconds - more time for betting
  private readonly CRASHED_TIME = 3000;    // 3 seconds
  private readonly TICK_INTERVAL = 100;    // 100ms between ticks
  // Dynamic config - use GameConfigService      // 4% house edge
  // private readonly INSTANT_BUST - now dynamic    // 2% instant bust chance
  
  // Provably Fair constants
  private readonly E = Math.pow(2, 52);    // 2^52 for precision
  
  // Current game state
  private currentRound: GameRound | null = null;
  private gameNumber = 0;
  private masterServerSeed: string;
  private clientSeed = 'stakepro-public-seed';
  
  // Crash history - stores last 20 crash points
  private crashHistory: number[] = [];
  private readonly MAX_HISTORY = 20;
  
  // Timers
  private gameLoopTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private gameStartTime: number = 0;
  
  // Event emitter for broadcasting
  private eventEmitter: EventEmitter2 | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameConfig: GameConfigService,
  ) {
    // Generate master server seed on startup
    this.masterServerSeed = crypto.randomBytes(32).toString('hex');
  }

  /**
   * Deduct balance from user's wallet when placing a bet
   * Returns true if successful, false if insufficient balance
   */
  private async deductBalance(userId: string, amount: Decimal): Promise<boolean> {
    try {
      // Get user's USDT wallet
      const wallet = await this.prisma.wallet.findFirst({
        where: { userId, currency: 'USDT' },
      });

      if (!wallet) {
        this.logger.warn(`No wallet found for user ${userId}`);
        return false;
      }

      const currentBalance = new Decimal(wallet.balance);
      if (currentBalance.lt(amount)) {
        this.logger.warn(`Insufficient balance for user ${userId}: ${currentBalance} < ${amount}`);
        return false;
      }

      // Deduct balance
      const newBalance = currentBalance.minus(amount);
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      this.logger.debug(`💸 Deducted $${amount.toFixed(2)} from user ${userId}. New balance: $${newBalance.toFixed(2)}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to deduct balance: ${error.message}`);
      return false;
    }
  }

  /**
   * Add winnings to user's wallet on cashout
   */
  private async addWinnings(userId: string, amount: Decimal): Promise<boolean> {
    try {
      const wallet = await this.prisma.wallet.findFirst({
        where: { userId, currency: 'USDT' },
      });

      if (!wallet) {
        this.logger.warn(`No wallet found for user ${userId}`);
        return false;
      }

      const newBalance = new Decimal(wallet.balance).plus(amount);
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      this.logger.debug(`💰 Added $${amount.toFixed(2)} to user ${userId}. New balance: $${newBalance.toFixed(2)}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add winnings: ${error.message}`);
      return false;
    }
  }

  /**
   * Set event emitter for broadcasting events
   */
  setEventEmitter(emitter: EventEmitter2): void {
    this.eventEmitter = emitter;
  }

  /**
   * Initialize the game loop on module start
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🎰 Crash Game Service initialized');
    this.startGameLoop(); // Auto-start the game loop
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.stopGameLoop();
  }

  /**
   * Start the infinite game loop
   */
  startGameLoop(): void {
    if (this.gameLoopTimer) {
      this.logger.warn('Game loop already running');
      return;
    }
    
    this.logger.log('🚀 Starting Crash game loop...');
    this.startNewRound();
  }

  /**
   * Stop the game loop
   */
  stopGameLoop(): void {
    if (this.gameLoopTimer) {
      clearTimeout(this.gameLoopTimer);
      this.gameLoopTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.logger.log('🛑 Crash game loop stopped');
  }

  /**
   * Get current round info (safe for client)
   */
  getCurrentRound(): Partial<GameRound> | null {
    if (!this.currentRound) return null;
    
    return {
      id: this.currentRound.id,
      gameNumber: this.currentRound.gameNumber,
      serverSeedHash: this.currentRound.serverSeedHash,
      clientSeed: this.currentRound.clientSeed,
      state: this.currentRound.state,
      currentMultiplier: this.currentRound.currentMultiplier,
      // Don't expose: serverSeed, crashPoint (until crashed)
    };
  }

  // ============================================
  // PROVABLY FAIR ALGORITHM
  // ============================================

  /**
   * Generate a Provably Fair crash point
   * 
   * Uses the CORRECT industry-standard algorithm:
   * 1. Hash = HMAC_SHA256(serverSeed, clientSeed:nonce)
   * 2. h = first 13 hex chars converted to decimal (0 to 2^52-1)
   * 3. r = h / 2^52 (random value between 0 and 1)
   * 4. crashPoint = (1 - HOUSE_EDGE) / (1 - r)
   * 5. House Edge: ~1% of games crash at 1.00x
   * 
   * This formula ensures:
   * - ~50% of games crash below 2.00x
   * - ~67% of games crash below 3.00x  
   * - ~90% of games crash below 10.00x
   * - Casino has 1% mathematical edge
   */
  private generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): Decimal {
    // Create the combined seed
    const combinedSeed = `${clientSeed}:${nonce}`;
    
    // Generate HMAC-SHA256 hash
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(combinedSeed);
    const hash = hmac.digest('hex');
    
    // Take first 13 hex characters (52 bits)
    const h = parseInt(hash.substring(0, 13), 16);
    const E = this.E; // 2^52
    
    // Convert to random value between 0 and 1
    const r = h / E;
    
    // Phase 49: Pure ICDF formula - NO double-dip
    // The Formula: X = (1 - edge) / (1 - r)
    // If r < HOUSE_EDGE, result < 1.00 -> Instant Bust (clamped to 1.00)
    // This creates a perfect mathematical curve where P(bust at 1.00) = exactly HOUSE_EDGE
    const HOUSE_EDGE = this.gameConfig.houseEdge; // 0.04 = 4%
    const rawMultiplier = (1 - HOUSE_EDGE) / (1 - r);
    
    // Clamp to 1.00 minimum - in Crash, 1.00 = loss for everyone
    const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
    
    // Cap at 5000x to protect bankroll from extreme outliers
    if (crashPoint > 5000) {
      return new Decimal(5000.00);
    }
    
    return new Decimal(crashPoint);
  }

  /**
   * Generate hash of server seed (shown to users before game)
   */
  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate a new server seed for this round
   */
  private generateRoundServerSeed(): string {
    // Derive from master seed + game number for determinism
    const hmac = crypto.createHmac('sha256', this.masterServerSeed);
    hmac.update(`round:${this.gameNumber}`);
    return hmac.digest('hex');
  }

  // ============================================
  // STATE MACHINE
  // ============================================

  /**
   * Start a new game round
   */
  private startNewRound(): void {
    this.gameNumber++;
    
    // Generate seeds for this round
    const serverSeed = this.generateRoundServerSeed();
    const serverSeedHash = this.hashServerSeed(serverSeed);
    
    // Calculate crash point (but don't reveal it yet!)
    const crashPoint = this.generateCrashPoint(
      serverSeed,
      this.clientSeed,
      this.gameNumber
    );
    
    // Create new round
    this.currentRound = {
      id: crypto.randomUUID(),
      gameNumber: this.gameNumber,
      serverSeed,
      serverSeedHash,
      clientSeed: this.clientSeed,
      nonce: this.gameNumber,
      crashPoint,
      state: GameState.WAITING,
      currentMultiplier: new Decimal(1.00),
      bets: new Map(),
      startedAt: null,
      crashedAt: null,
    };
    
    this.logger.log(`🎮 Game #${this.gameNumber} - WAITING for bets...`);
    this.logger.debug(`   Crash point: ${crashPoint.toFixed(2)}x (hidden)`);
    
    this.emitEvent('crash.state_change', {
      state: GameState.WAITING,
      round: this.getSafeRoundData(),
    });
    
    // After WAITING_TIME, start the game
    this.gameLoopTimer = setTimeout(() => {
      this.startRunning();
    }, this.WAITING_TIME);
  }

  /**
   * Start the RUNNING phase - multiplier goes up
   */
  private startRunning(): void {
    if (!this.currentRound) return;
    
    this.currentRound.state = GameState.RUNNING;
    this.currentRound.startedAt = new Date();
    this.gameStartTime = Date.now();
    
    this.logger.log(`🚀 Game #${this.gameNumber} - RUNNING!`);
    
    this.emitEvent('crash.state_change', {
      state: GameState.RUNNING,
      round: this.getSafeRoundData(),
    });
    
    // Start the tick timer (100ms intervals)
    this.tickTimer = setInterval(() => {
      this.tick();
    }, this.TICK_INTERVAL);
  }

  /**
   * Game tick - update multiplier and check for crash
   */
  private async tick(): Promise<void> {
    if (!this.currentRound || this.currentRound.state !== GameState.RUNNING) {
      return;
    }
    
    const elapsed = Date.now() - this.gameStartTime;
    
    // Calculate current multiplier using exponential growth
    // Formula: 1.00 * e^(0.00006 * elapsed)
    // This gives a smooth curve that reaches ~2x at ~11.5 seconds
    const growthRate = 0.00006;
    const multiplier = new Decimal(Math.exp(growthRate * elapsed));
    
    this.currentRound.currentMultiplier = multiplier;
    
    // Check if we've hit the crash point
    if (multiplier.gte(this.currentRound.crashPoint)) {
      this.crash();
      return;
    }
    
    // Check auto-cashouts (await to ensure they complete)
    await this.processAutoCashouts(multiplier);
    
    // Emit tick event
    this.emitEvent('crash.tick', {
      multiplier: multiplier.toFixed(2),
      elapsed,
    });
  }

  /**
   * Process auto-cashouts for all active bets
   */
  private async processAutoCashouts(currentMultiplier: Decimal): Promise<void> {
    if (!this.currentRound) return;
    
    const cashoutPromises: Promise<any>[] = [];
    
    for (const [userId, bet] of this.currentRound.bets) {
      if (bet.status !== 'ACTIVE') continue;
      if (!bet.autoCashoutAt) continue;
      
      if (currentMultiplier.gte(bet.autoCashoutAt)) {
        this.logger.log(`🤖 Auto-cashout triggered for user ${userId} at ${bet.autoCashoutAt.toFixed(2)}x`);
        cashoutPromises.push(this.cashout(userId, bet.autoCashoutAt));
      }
    }
    
    // Wait for all auto-cashouts to complete
    if (cashoutPromises.length > 0) {
      await Promise.all(cashoutPromises);
    }
  }

  /**
   * The game crashes!
   */
  private crash(): void {
    if (!this.currentRound) return;
    
    // Stop the tick timer
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    
    this.currentRound.state = GameState.CRASHED;
    this.currentRound.crashedAt = new Date();
    this.currentRound.currentMultiplier = this.currentRound.crashPoint;
    
    // Mark all active bets as LOST
    for (const [userId, bet] of this.currentRound.bets) {
      if (bet.status === 'ACTIVE') {
        bet.status = 'LOST';
        bet.profit = bet.amount.negated();
        this.saveBetToDatabase(userId, bet, this.currentRound.crashPoint, false);
      }
    }
    
    this.logger.log(`💥 Game #${this.gameNumber} - CRASHED at ${this.currentRound.crashPoint.toFixed(2)}x!`);
    
    // Add crash point to history
    this.crashHistory.unshift(this.currentRound.crashPoint.toNumber());
    if (this.crashHistory.length > this.MAX_HISTORY) {
      this.crashHistory.pop();
    }
    
    this.emitEvent('crash.crashed', {
      crashPoint: this.currentRound.crashPoint.toFixed(2),
      gameNumber: this.gameNumber,
    });
    
    this.emitEvent('crash.state_change', {
      state: GameState.CRASHED,
      round: this.getFullRoundData(), // Now we can reveal the server seed
    });
    
    // After CRASHED_TIME, start new round
    this.gameLoopTimer = setTimeout(() => {
      this.startNewRound();
    }, this.CRASHED_TIME);
  }

  // ============================================
  // BETTING FUNCTIONS
  // ============================================

  /**
   * Place a bet on the current round
   * Now async to handle balance deduction from database
   */
  async placeBet(
    userId: string,
    amount: Decimal | number | string,
    autoCashoutAt?: Decimal | number | string
  ): Promise<{ success: boolean; error?: string; bet?: CrashBet }> {
    if (!this.currentRound) {
      return { success: false, error: 'No active round' };
    }
    
    if (this.currentRound.state !== GameState.WAITING) {
      return { success: false, error: 'Betting is closed' };
    }
    
    if (this.currentRound.bets.has(userId)) {
      return { success: false, error: 'Already placed a bet this round' };
    }
    
    const betAmount = new Decimal(amount);
    if (betAmount.lte(0)) {
      return { success: false, error: 'Invalid bet amount' };
    }

    // CRITICAL: Deduct balance from user's wallet BEFORE accepting bet
    const balanceDeducted = await this.deductBalance(userId, betAmount);
    if (!balanceDeducted) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    const bet: CrashBet = {
      id: crypto.randomUUID(),
      oderId: crypto.randomUUID(),
      amount: betAmount,
      autoCashoutAt: autoCashoutAt ? new Decimal(autoCashoutAt) : null,
      cashedOutAt: null,
      profit: null,
      status: 'ACTIVE',
    };
    
    this.currentRound.bets.set(userId, bet);
    
    this.logger.debug(`💰 User ${userId} bet $${betAmount.toFixed(2)} (balance deducted)`);
    
    this.emitEvent('crash.bet_placed', {
      userId,
      username: '', // Will be populated by gateway
      amount: betAmount.toFixed(2),
      betId: bet.id,
      currency: 'USDT',
    });
    
    // Emit balance update event for real-time UI update
    this.emitEvent('crash.balance_update', {
      userId,
      change: `-${betAmount.toFixed(2)}`,
      reason: 'bet_placed',
    });
    
    return { success: true, bet };
  }

  /**
   * Cash out a bet at the current multiplier
   * Now async to handle adding winnings to database
   */
  async cashout(
    userId: string,
    atMultiplier?: Decimal
  ): Promise<{ success: boolean; error?: string; profit?: Decimal; multiplier?: Decimal }> {
    if (!this.currentRound) {
      return { success: false, error: 'No active round' };
    }
    
    if (this.currentRound.state !== GameState.RUNNING) {
      return { success: false, error: 'Game is not running' };
    }
    
    const bet = this.currentRound.bets.get(userId);
    if (!bet) {
      return { success: false, error: 'No bet found' };
    }
    
    if (bet.status !== 'ACTIVE') {
      return { success: false, error: 'Bet already settled' };
    }
    
    const cashoutMultiplier = atMultiplier || this.currentRound.currentMultiplier;
    
    // Can't cashout above crash point
    if (cashoutMultiplier.gt(this.currentRound.crashPoint)) {
      return { success: false, error: 'Too late!' };
    }
    
    // Calculate payout (original bet * multiplier)
    const payout = bet.amount.mul(cashoutMultiplier);
    const profit = payout.minus(bet.amount);
    
    // CRITICAL: Add full payout (bet + profit) to user's wallet
    const winningsAdded = await this.addWinnings(userId, payout);
    if (!winningsAdded) {
      this.logger.error(`Failed to add winnings for user ${userId}`);
      // Still mark as cashed out but log the error
    }
    
    bet.status = 'CASHED_OUT';
    bet.cashedOutAt = cashoutMultiplier;
    bet.profit = profit;

    // Save winning bet to database
    this.saveBetToDatabase(userId, bet, this.currentRound.crashPoint, true);
    
    this.logger.debug(`💸 User ${userId} cashed out at ${cashoutMultiplier.toFixed(2)}x - Payout: $${payout.toFixed(2)} (Profit: $${profit.toFixed(2)})`);
    
    this.emitEvent('crash.cashout', {
      userId,
      multiplier: cashoutMultiplier.toFixed(2),
      profit: profit.toFixed(2),
    });
    
    // Emit balance update event for real-time UI update
    this.emitEvent('crash.balance_update', {
      userId,
      change: `+${payout.toFixed(2)}`,
      reason: 'cashout',
    });
    
    return { success: true, profit, multiplier: cashoutMultiplier };
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Get safe round data (without secrets)
   */
  private getSafeRoundData(): Partial<GameRound> {
    if (!this.currentRound) return {};
    
    return {
      id: this.currentRound.id,
      gameNumber: this.currentRound.gameNumber,
      serverSeedHash: this.currentRound.serverSeedHash,
      clientSeed: this.currentRound.clientSeed,
      state: this.currentRound.state,
      currentMultiplier: this.currentRound.currentMultiplier,
    };
  }

  /**
   * Get full round data (after crash, with server seed revealed)
   */
  private getFullRoundData(): GameRound {
    return this.currentRound!;
  }

  /**
   * Emit an event
   */
  private emitEvent<K extends keyof CrashEvents>(
    event: K,
    data: CrashEvents[K]
  ): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
  }

  /**
   * Verify a crash point (for Provably Fair verification)
   */
  verifyCrashPoint(
    serverSeed: string,
    clientSeed: string,
    nonce: number
  ): Decimal {
    return this.generateCrashPoint(serverSeed, clientSeed, nonce);
  }

  /**
   * Get recent crash history for new connections
   */
  getCrashHistory(): number[] {
    return [...this.crashHistory];
  }

  /**
   * Get current game state for new connections
   */
  getCurrentGameState(): { state: string; gameNumber: number; multiplier: string; countdown?: number } {
    if (!this.currentRound) {
      return { state: 'WAITING', gameNumber: 0, multiplier: '1.00' };
    }
    return {
      state: this.currentRound.state,
      gameNumber: this.currentRound.gameNumber,
      multiplier: this.currentRound.currentMultiplier?.toFixed(2) || '1.00',
    };
  }

  /**
   * Save bet to database for analytics and history
   */
  private async saveBetToDatabase(
    userId: string,
    bet: CrashBet,
    crashPoint: Decimal,
    isWin: boolean
  ): Promise<void> {
    try {
      await this.prisma.bet.create({
        data: {
          id: bet.id,
          userId: userId,
          gameType: 'CRASH',
          currency: 'USDT',
          betAmount: bet.amount,
          multiplier: bet.cashedOutAt || new Decimal(0),
          payout: isWin ? bet.amount.mul(bet.cashedOutAt || 0) : new Decimal(0),
          profit: bet.profit || new Decimal(0),
          serverSeed: this.currentRound?.serverSeed || '',
          serverSeedHash: this.currentRound?.serverSeedHash || '',
          clientSeed: 'default',
          nonce: this.gameNumber,
          gameData: {
            gameId: this.currentRound?.id,
            gameNumber: this.gameNumber,
            crashPoint: crashPoint.toFixed(2),
            autoCashoutAt: bet.autoCashoutAt?.toFixed(2) || null,
            cashedOutAt: bet.cashedOutAt?.toFixed(2) || null,
          },
          isWin: isWin,
          settledAt: new Date(),
        },
      });
      this.logger.debug(`📊 Bet saved to database: ${bet.id}`);
    } catch (error) {
      this.logger.error(`Failed to save bet to database: ${error.message}`);
    }
  }
}
