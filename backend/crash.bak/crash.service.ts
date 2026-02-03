import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

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
  'crash.state_change': { state: GameState; round: GameRound };
  'crash.tick': { multiplier: string; elapsed: number };
  'crash.bet_placed': { userId: string; amount: string };
  'crash.cashout': { userId: string; multiplier: string; profit: string };
  'crash.crashed': { crashPoint: string; gameNumber: number };
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
  private readonly WAITING_TIME = 6000;    // 6 seconds
  private readonly CRASHED_TIME = 3000;    // 3 seconds
  private readonly TICK_INTERVAL = 100;    // 100ms between ticks
  private readonly HOUSE_EDGE = 0.01;      // 1% house edge
  
  // Provably Fair constants
  private readonly E = Math.pow(2, 52);    // 2^52 for precision
  
  // Current game state
  private currentRound: GameRound | null = null;
  private gameNumber = 0;
  private masterServerSeed: string;
  private clientSeed = 'stakepro-public-seed';
  
  // Timers
  private gameLoopTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private gameStartTime: number = 0;
  
  // Event emitter for broadcasting
  private eventEmitter: EventEmitter2 | null = null;

  constructor() {
    // Generate master server seed on startup
    this.masterServerSeed = crypto.randomBytes(32).toString('hex');
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
    // Don't auto-start - wait for explicit start command
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
   * Uses the industry-standard algorithm:
   * 1. Hash = HMAC_SHA256(serverSeed, clientSeed:nonce)
   * 2. h = first 13 hex chars converted to decimal
   * 3. crashPoint = floor((E * 100 - h) / (E - h)) / 100
   * 4. House Edge: If divisible by 100, instant crash at 1.00x
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
    
    // Apply the crash point formula
    // crashPoint = floor((E * 100 - h) / (E - h)) / 100
    const E = this.E;
    
    // House edge check: 1% chance of instant crash
    // If h is divisible by 100, force crash at 1.00x
    if (h % 100 === 0) {
      return new Decimal(1.00);
    }
    
    // Calculate crash point
    const crashPoint = Math.floor((E * 100 - h) / (E - h)) / 100;
    
    // Ensure minimum of 1.00x
    return new Decimal(Math.max(1.00, crashPoint));
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
      id: uuidv4(),
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
  private tick(): void {
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
    
    // Check auto-cashouts
    this.processAutoCashouts(multiplier);
    
    // Emit tick event
    this.emitEvent('crash.tick', {
      multiplier: multiplier.toFixed(2),
      elapsed,
    });
  }

  /**
   * Process auto-cashouts for all active bets
   */
  private processAutoCashouts(currentMultiplier: Decimal): void {
    if (!this.currentRound) return;
    
    for (const [userId, bet] of this.currentRound.bets) {
      if (bet.status !== 'ACTIVE') continue;
      if (!bet.autoCashoutAt) continue;
      
      if (currentMultiplier.gte(bet.autoCashoutAt)) {
        this.cashout(userId, bet.autoCashoutAt);
      }
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
      }
    }
    
    this.logger.log(`💥 Game #${this.gameNumber} - CRASHED at ${this.currentRound.crashPoint.toFixed(2)}x!`);
    
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
   */
  placeBet(
    userId: string,
    amount: Decimal | number | string,
    autoCashoutAt?: Decimal | number | string
  ): { success: boolean; error?: string; bet?: CrashBet } {
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
    
    const bet: CrashBet = {
      id: uuidv4(),
      oderId: uuidv4(),
      amount: betAmount,
      autoCashoutAt: autoCashoutAt ? new Decimal(autoCashoutAt) : null,
      cashedOutAt: null,
      profit: null,
      status: 'ACTIVE',
    };
    
    this.currentRound.bets.set(userId, bet);
    
    this.logger.debug(`💰 User ${userId} bet $${betAmount.toFixed(2)}`);
    
    this.emitEvent('crash.bet_placed', {
      userId,
      amount: betAmount.toFixed(2),
    });
    
    return { success: true, bet };
  }

  /**
   * Cash out a bet at the current multiplier
   */
  cashout(
    userId: string,
    atMultiplier?: Decimal
  ): { success: boolean; error?: string; profit?: Decimal } {
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
    
    // Calculate profit
    const payout = bet.amount.mul(cashoutMultiplier);
    const profit = payout.minus(bet.amount);
    
    bet.status = 'CASHED_OUT';
    bet.cashedOutAt = cashoutMultiplier;
    bet.profit = profit;
    
    this.logger.debug(`💸 User ${userId} cashed out at ${cashoutMultiplier.toFixed(2)}x - Profit: $${profit.toFixed(2)}`);
    
    this.emitEvent('crash.cashout', {
      userId,
      multiplier: cashoutMultiplier.toFixed(2),
      profit: profit.toFixed(2),
    });
    
    return { success: true, profit };
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
}
