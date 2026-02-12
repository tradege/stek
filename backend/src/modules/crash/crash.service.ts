import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { GameType } from '@prisma/client';
import { GameConfigService } from './game-config.service';


/**
 * Game States for the Crash State Machine
 */
export enum GameState {
  WAITING = 'WAITING',   // 10 seconds - Users place bets
  RUNNING = 'RUNNING',   // Variable time - Multipliers rise
  CRASHED = 'CRASHED',   // 3 seconds - Show crash points
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
  skin?: string;  // 'classic' | 'dragon' | 'space'
}

/**
 * Map skin identifier to GameType enum value
 */
function skinToGameType(skin?: string): GameType {
  switch (skin) {
    case 'dragon': return GameType.DRAGON_BLAZE;
    case 'space': return GameType.NOVA_RUSH;
    default: return GameType.CRASH;
  }
}

/**
 * Game Round data — now with TWO independent crash points
 */
export interface GameRound {
  id: string;
  gameNumber: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  // Dragon 1 (orange)
  crashPoint1: Decimal;
  currentMultiplier1: Decimal;
  dragon1Crashed: boolean;
  // Dragon 2 (blue)
  crashPoint2: Decimal;
  currentMultiplier2: Decimal;
  dragon2Crashed: boolean;
  // Overall state
  state: GameState;
  bets: Map<string, CrashBet>;  // "userId:slot" -> bet
  startedAt: Date | null;
  crashedAt: Date | null;
}

/**
 * Events emitted by the Crash Service
 */
export interface CrashEvents {
  'crash.state_change': { state: GameState; round: Partial<GameRound> };
  'crash.tick': { multiplier1: string; multiplier2: string; elapsed: number; dragon1Crashed: boolean; dragon2Crashed: boolean };
  'crash.bet_placed': { userId: string; username: string; amount: string; betId: string; currency: string; slot?: number };
  'crash.cashout': { userId: string; multiplier: string; profit: string; slot?: number; isManual?: boolean };
  'crash.dragon_crashed': { dragon: number; crashPoint: string; gameNumber: number };
  'crash.crashed': { crashPoint1: string; crashPoint2: string; gameNumber: number };
  'crash.balance_update': { userId: string; change: string; reason: string };
}

@Injectable()
export class CrashService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrashService.name);
  
  // Game configuration
  private readonly WAITING_TIME = 10000;
  private readonly CRASHED_TIME = 3000;
  private readonly TICK_INTERVAL = 100;
  
  // Provably Fair constants
  private readonly E = Math.pow(2, 52);
  
  // Current game state
  private currentRound: GameRound | null = null;
  private gameNumber = 0;
  private masterServerSeed: string;
  private defaultClientSeed = 'stakepro-public-seed';
  private userClientSeeds: Map<string, string> = new Map();
  
  // Crash history
  private crashHistory: number[] = [];
  private readonly MAX_HISTORY = 20;
  
  // Bet limits
  private readonly MAX_BET = 10000;
  private readonly MIN_BET = 0.10;
  
  // Rate limiting
  private lastBetTime: Map<string, number> = new Map();
  private userSiteIds: Map<string, string> = new Map();
  private readonly BET_COOLDOWN = 500;
  
  // Timers
  private gameLoopTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private gameStartTime: number = 0;
  
  // Event emitter
  private eventEmitter: EventEmitter2 | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameConfig: GameConfigService,
  ) {
    this.masterServerSeed = crypto.randomBytes(32).toString('hex');
  }

  /**
   * Deduct balance from user's wallet
   */
  private async deductBalance(userId: string, amount: Decimal, siteId: string = 'default-site-001'): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const wallets = await tx.$queryRaw<any[]>`
          SELECT id, balance FROM "Wallet"
          WHERE "userId" = ${userId} AND currency = 'USDT' AND "siteId" = ${siteId}
          FOR UPDATE
        `;
        if (!wallets || wallets.length === 0) {
          this.logger.warn(`No wallet found for user ${userId}`);
          return false;
        }
        const wallet = wallets[0];
        const currentBalance = new Decimal(wallet.balance);
        if (currentBalance.lt(amount)) {
          this.logger.warn(`Insufficient balance for user ${userId}: ${currentBalance} < ${amount}`);
          return false;
        }
        // ATOMIC SQL: Single UPDATE with balance check
        const amountNum = amount.toNumber();
        const deducted = await tx.$executeRaw`
          UPDATE "Wallet" 
          SET balance = balance - ${amountNum}::decimal,
              "updatedAt" = NOW()
          WHERE "userId" = ${userId} AND currency = 'USDT'::"Currency" AND "siteId" = ${siteId} AND balance >= ${amountNum}::decimal
        `;
        if (deducted === 0) {
          this.logger.warn(`Insufficient balance (atomic) for user ${userId}`);
          return false;
        }
        const newBalance = currentBalance.minus(amount);
        this.logger.debug(`Deducted $${amount.toFixed(2)} from user ${userId}. New balance: $${newBalance.toFixed(2)}`);
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to deduct balance: ${error.message}`);
      return false;
    }
  }

  /**
   * Add winnings to user's wallet
   */
  private async addWinnings(userId: string, amount: Decimal, siteId: string = 'default-site-001'): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const wallets = await tx.$queryRaw<any[]>`
          SELECT id, balance FROM "Wallet"
          WHERE "userId" = ${userId} AND currency = 'USDT' AND "siteId" = ${siteId}
          FOR UPDATE
        `;
        if (!wallets || wallets.length === 0) {
          this.logger.warn(`No wallet found for user ${userId}`);
          return false;
        }
        const wallet = wallets[0];
        // ATOMIC SQL: Single UPDATE to add winnings
        const amountNum = amount.toNumber();
        await tx.$executeRaw`
          UPDATE "Wallet" 
          SET balance = balance + ${amountNum}::decimal,
              "updatedAt" = NOW()
          WHERE "userId" = ${userId} AND currency = 'USDT'::"Currency" AND "siteId" = ${siteId}
        `;
        const newBalance = new Decimal(wallet.balance).plus(amount);
        this.logger.debug(`Added $${amount.toFixed(2)} to user ${userId}. New balance: $${newBalance.toFixed(2)}`);
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to add winnings: ${error.message}`);
      return false;
    }
  }

  setEventEmitter(emitter: EventEmitter2): void {
    this.eventEmitter = emitter;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('🎰 Crash Game Service initialized (Dual-Dragon Mode)');
    this.startGameLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopGameLoop();
  }

  startGameLoop(): void {
    if (this.gameLoopTimer) {
      this.logger.warn('Game loop already running');
      return;
    }
    this.logger.log('🚀 Starting Crash game loop (Dual-Dragon)...');
    this.startNewRound();
  }

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

  getCurrentRound(): Partial<GameRound> | null {
    if (!this.currentRound) return null;
    return {
      id: this.currentRound.id,
      gameNumber: this.currentRound.gameNumber,
      serverSeedHash: this.currentRound.serverSeedHash,
      clientSeed: this.currentRound.clientSeed,
      state: this.currentRound.state,
      currentMultiplier1: this.currentRound.currentMultiplier1,
      currentMultiplier2: this.currentRound.currentMultiplier2,
      dragon1Crashed: this.currentRound.dragon1Crashed,
      dragon2Crashed: this.currentRound.dragon2Crashed,
    };
  }

  // ============================================
  // PROVABLY FAIR ALGORITHM
  // ============================================

  /**
   * Generate a crash point from seed material
   */
  private generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): Decimal {
    const combinedSeed = `${clientSeed}:${nonce}`;
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(combinedSeed);
    const hash = hmac.digest('hex');
    const h = parseInt(hash.substring(0, 13), 16);
    const E = this.E;
    const r = h / E;
    const HOUSE_EDGE = this.gameConfig.houseEdge;
    const rawMultiplier = (1 - HOUSE_EDGE) / (1 - r);
    const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
    if (crashPoint > 5000) {
      return new Decimal(5000.00);
    }
    return new Decimal(crashPoint);
  }

  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  private generateRoundServerSeed(): string {
    const hmac = crypto.createHmac('sha256', this.masterServerSeed);
    hmac.update(`round:${this.gameNumber}`);
    return hmac.digest('hex');
  }

  /**
   * Generate a SECOND crash point using a different derivation
   */
  private generateSecondCrashPoint(serverSeed: string, clientSeed: string, nonce: number): Decimal {
    const combinedSeed = `${clientSeed}:${nonce}:dragon2`;
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(combinedSeed);
    const hash = hmac.digest('hex');
    const h = parseInt(hash.substring(0, 13), 16);
    const E = this.E;
    const r = h / E;
    const HOUSE_EDGE = this.gameConfig.houseEdge;
    const rawMultiplier = (1 - HOUSE_EDGE) / (1 - r);
    const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
    if (crashPoint > 5000) {
      return new Decimal(5000.00);
    }
    return new Decimal(crashPoint);
  }

  // ============================================
  // STATE MACHINE
  // ============================================

  private startNewRound(): void {
    this.gameNumber++;
    
    const serverSeed = this.generateRoundServerSeed();
    const serverSeedHash = this.hashServerSeed(serverSeed);
    
    // Generate TWO independent crash points
    const crashPoint1 = this.generateCrashPoint(serverSeed, this.defaultClientSeed, this.gameNumber);
    const crashPoint2 = this.generateSecondCrashPoint(serverSeed, this.defaultClientSeed, this.gameNumber);
    
    this.currentRound = {
      id: crypto.randomUUID(),
      gameNumber: this.gameNumber,
      serverSeed,
      serverSeedHash,
      clientSeed: this.defaultClientSeed,
      nonce: this.gameNumber,
      crashPoint1,
      crashPoint2,
      currentMultiplier1: new Decimal(1.00),
      currentMultiplier2: new Decimal(1.00),
      dragon1Crashed: false,
      dragon2Crashed: false,
      state: GameState.WAITING,
      bets: new Map(),
      startedAt: null,
      crashedAt: null,
    };
    
    this.logger.log(`🎮 Game #${this.gameNumber} - WAITING for bets...`);
    this.logger.debug(`   Dragon 1 crash: ${crashPoint1.toFixed(2)}x | Dragon 2 crash: ${crashPoint2.toFixed(2)}x`);
    
    this.emitEvent('crash.state_change', {
      state: GameState.WAITING,
      round: this.getSafeRoundData(),
    });
    
    this.gameLoopTimer = setTimeout(() => {
      this.startRunning();
    }, this.WAITING_TIME);
  }

  private startRunning(): void {
    if (!this.currentRound) return;
    
    this.currentRound.state = GameState.RUNNING;
    this.currentRound.startedAt = new Date();
    this.gameStartTime = Date.now();
    
    this.logger.log(`🚀 Game #${this.gameNumber} - RUNNING! (D1 crashes at ${this.currentRound.crashPoint1.toFixed(2)}x, D2 at ${this.currentRound.crashPoint2.toFixed(2)}x)`);
    
    this.emitEvent('crash.state_change', {
      state: GameState.RUNNING,
      round: this.getSafeRoundData(),
    });
    
    this.tickTimer = setInterval(() => {
      this.tick();
    }, this.TICK_INTERVAL);
  }

  /**
   * Game tick — updates BOTH multipliers independently
   */
  private async tick(): Promise<void> {
    if (!this.currentRound || this.currentRound.state !== GameState.RUNNING) {
      return;
    }
    
    const elapsed = Date.now() - this.gameStartTime;
    const growthRate = 0.00006;
    const multiplier = new Decimal(Math.exp(growthRate * elapsed));
    
    // Update Dragon 1 multiplier (only if not crashed)
    if (!this.currentRound.dragon1Crashed) {
      this.currentRound.currentMultiplier1 = multiplier;
      
      // Check if Dragon 1 hit its crash point
      if (multiplier.gte(this.currentRound.crashPoint1)) {
        this.dragonCrash(1);
      }
    }
    
    // Update Dragon 2 multiplier (only if not crashed)
    if (!this.currentRound.dragon2Crashed) {
      this.currentRound.currentMultiplier2 = multiplier;
      
      // Check if Dragon 2 hit its crash point
      if (multiplier.gte(this.currentRound.crashPoint2)) {
        this.dragonCrash(2);
      }
    }
    
    // Process auto-cashouts for both dragons
    await this.processAutoCashouts(multiplier);
    
    // Emit tick with BOTH multipliers
    this.emitEvent('crash.tick', {
      multiplier1: this.currentRound.currentMultiplier1.toFixed(2),
      multiplier2: this.currentRound.currentMultiplier2.toFixed(2),
      elapsed,
      dragon1Crashed: this.currentRound.dragon1Crashed,
      dragon2Crashed: this.currentRound.dragon2Crashed,
    });
    
    // If BOTH dragons have crashed, end the round
    if (this.currentRound.dragon1Crashed && this.currentRound.dragon2Crashed) {
      this.fullCrash();
    }
  }

  /**
   * A single dragon crashes — mark its bets as lost but keep the round running
   */
  private dragonCrash(dragon: number): void {
    if (!this.currentRound) return;
    
    if (dragon === 1) {
      this.currentRound.dragon1Crashed = true;
      this.currentRound.currentMultiplier1 = this.currentRound.crashPoint1;
      this.logger.log(`🐉💥 Dragon 1 CRASHED at ${this.currentRound.crashPoint1.toFixed(2)}x!`);
      
      // Mark all slot-1 active bets as LOST
      for (const [betKey, bet] of this.currentRound.bets) {
        const parts = betKey.split(':');
        const betSlot = parseInt(parts[1]);
        if (isNaN(betSlot) || (betSlot !== 1 && betSlot !== 2)) continue;
        if (betSlot === 1 && bet.status === 'ACTIVE') {
          bet.status = 'LOST';
          bet.profit = bet.amount.negated();
          this.saveBetToDatabase(parts[0], bet, this.currentRound.crashPoint1, false, this.userSiteIds.get(parts[0]) || 'default-site-001');
        }
      }
      
      this.emitEvent('crash.dragon_crashed', {
        dragon: 1,
        crashPoint: this.currentRound.crashPoint1.toFixed(2),
        gameNumber: this.gameNumber,
      });
    } else {
      this.currentRound.dragon2Crashed = true;
      this.currentRound.currentMultiplier2 = this.currentRound.crashPoint2;
      this.logger.log(`🐲💥 Dragon 2 CRASHED at ${this.currentRound.crashPoint2.toFixed(2)}x!`);
      
      // Mark all slot-2 active bets as LOST
      for (const [betKey, bet] of this.currentRound.bets) {
        const parts = betKey.split(':');
        const betSlot = parseInt(parts[1]);
        if (isNaN(betSlot) || (betSlot !== 1 && betSlot !== 2)) continue;
        if (betSlot === 2 && bet.status === 'ACTIVE') {
          bet.status = 'LOST';
          bet.profit = bet.amount.negated();
          this.saveBetToDatabase(parts[0], bet, this.currentRound.crashPoint2, false, this.userSiteIds.get(parts[0]) || 'default-site-001');
        }
      }
      
      this.emitEvent('crash.dragon_crashed', {
        dragon: 2,
        crashPoint: this.currentRound.crashPoint2.toFixed(2),
        gameNumber: this.gameNumber,
      });
    }
  }

  /**
   * Both dragons crashed — end the round completely
   */
  private fullCrash(): void {
    if (!this.currentRound) return;
    
    // Stop the tick timer
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    
    this.currentRound.state = GameState.CRASHED;
    this.currentRound.crashedAt = new Date();
    
    this.logger.log(`💥💥 Game #${this.gameNumber} - BOTH DRAGONS CRASHED! (D1: ${this.currentRound.crashPoint1.toFixed(2)}x, D2: ${this.currentRound.crashPoint2.toFixed(2)}x)`);
    
    // Add to history (use the higher crash point for display)
    const maxCrash = Math.max(this.currentRound.crashPoint1.toNumber(), this.currentRound.crashPoint2.toNumber());
    this.crashHistory.unshift(maxCrash);
    if (this.crashHistory.length > this.MAX_HISTORY) {
      this.crashHistory.pop();
    }
    
    this.emitEvent('crash.crashed', {
      crashPoint1: this.currentRound.crashPoint1.toFixed(2),
      crashPoint2: this.currentRound.crashPoint2.toFixed(2),
      gameNumber: this.gameNumber,
    });
    
    this.emitEvent('crash.state_change', {
      state: GameState.CRASHED,
      round: this.getFullRoundData(),
    });
    
    // After CRASHED_TIME, start new round
    this.gameLoopTimer = setTimeout(() => {
      this.startNewRound();
    }, this.CRASHED_TIME);
  }

  /**
   * Process auto-cashouts — only for dragons that haven't crashed yet
   */
  private async processAutoCashouts(currentMultiplier: Decimal): Promise<void> {
    if (!this.currentRound) return;
    
    const cashoutPromises: Promise<any>[] = [];
    
    for (const [betKey, bet] of this.currentRound.bets) {
      if (bet.status !== 'ACTIVE') continue;
      if (!bet.autoCashoutAt) continue;
      
      const parts = betKey.split(':');
      const autoCashUserId = parts[0];
      const autoCashSlot = parseInt(parts[1]);
      if (isNaN(autoCashSlot) || (autoCashSlot !== 1 && autoCashSlot !== 2)) continue;
      
      // Skip if this dragon already crashed
      if (autoCashSlot === 1 && this.currentRound.dragon1Crashed) continue;
      if (autoCashSlot === 2 && this.currentRound.dragon2Crashed) continue;
      
      if (currentMultiplier.gte(bet.autoCashoutAt)) {
        this.logger.log(`🤖 Auto-cashout: user=${autoCashUserId} slot=${autoCashSlot} at ${bet.autoCashoutAt.toFixed(2)}x`);
        cashoutPromises.push(this.cashout(autoCashUserId, bet.autoCashoutAt, autoCashSlot));
      }
    }
    
    if (cashoutPromises.length > 0) {
      await Promise.all(cashoutPromises);
    }
  }

  // ============================================
  // BETTING FUNCTIONS
  // ============================================

  async placeBet(
    userId: string,
    amount: Decimal | number | string,
    autoCashoutAt?: Decimal | number | string,
    slot?: number,
    siteId: string = 'default-site-001',
    skin: string = 'classic'
  ): Promise<{ success: boolean; error?: string; bet?: CrashBet }> {
    if (!this.currentRound) {
      return { success: false, error: 'No active round' };
    }
    
    if (this.currentRound.state !== GameState.WAITING) {
      return { success: false, error: 'Betting is closed' };
    }
    
    if (slot !== 1 && slot !== 2) {
      return { success: false, error: 'Invalid slot - must be 1 or 2' };
    }
    const betSlot = slot;
    const betKey = `${userId}:${betSlot}`;
    this.userSiteIds.set(userId, siteId);
    
    if (this.currentRound.bets.has(betKey)) {
      return { success: false, error: 'Already placed a bet on this dragon' };
    }
    
    const betAmount = new Decimal(amount);
    if (betAmount.lt(this.MIN_BET)) {
      return { success: false, error: `Minimum bet is $${this.MIN_BET}` };
    }
    if (betAmount.gt(this.MAX_BET)) {
      return { success: false, error: `Maximum bet is $${this.MAX_BET.toLocaleString()}` };
    }
    
    const now = Date.now();
    const lastBet = this.lastBetTime.get(betKey) || 0;
    if (now - lastBet < this.BET_COOLDOWN) {
      return { success: false, error: 'Please wait before placing another bet' };
    }
    this.lastBetTime.set(betKey, now);

    const balanceDeducted = await this.deductBalance(userId, betAmount, siteId);
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
      skin: skin,
    };
    
    this.currentRound.bets.set(betKey, bet);
    
    this.logger.debug(`💰 User ${userId} bet $${betAmount.toFixed(2)} on Dragon ${betSlot}`);
    
    this.emitEvent('crash.bet_placed', {
      userId,
      username: '',
      amount: betAmount.toFixed(2),
      betId: bet.id,
      currency: 'USDT',
      slot: betSlot,
    });
    
    this.emitEvent('crash.balance_update', {
      userId,
      change: `-${betAmount.toFixed(2)}`,
      reason: 'bet_placed',
    });
    
    return { success: true, bet };
  }

  /**
   * Cash out — only works if the dragon for this slot hasn't crashed yet
   */
  async cashout(
    userId: string,
    atMultiplier?: Decimal,
    slot?: number,
    isManual?: boolean
  ): Promise<{ success: boolean; error?: string; profit?: Decimal; multiplier?: Decimal }> {
    if (!this.currentRound) {
      return { success: false, error: 'No active round' };
    }
    
    if (this.currentRound.state !== GameState.RUNNING) {
      return { success: false, error: 'Game is not running' };
    }
    
    if (slot !== 1 && slot !== 2) {
      return { success: false, error: 'Invalid slot - must be 1 or 2' };
    }
    const cashoutSlot = slot;
    
    // Check if this dragon already crashed
    if (cashoutSlot === 1 && this.currentRound.dragon1Crashed) {
      return { success: false, error: 'Dragon 1 already crashed!' };
    }
    if (cashoutSlot === 2 && this.currentRound.dragon2Crashed) {
      return { success: false, error: 'Dragon 2 already crashed!' };
    }
    
    const cashoutBetKey = `${userId}:${cashoutSlot}`;
    this.logger.log(`🔍 Looking for bet key: ${cashoutBetKey} | All bet keys: ${Array.from(this.currentRound.bets.keys()).join(', ')}`);
    const bet = this.currentRound.bets.get(cashoutBetKey);
    if (!bet) {
      this.logger.warn(`❌ No bet found for key: ${cashoutBetKey}`);
      return { success: false, error: 'No bet found' };
    }
    
    if (bet.status !== 'ACTIVE') {
      return { success: false, error: 'Bet already settled' };
    }
    
    // Use the correct dragon's multiplier
    const currentDragonMultiplier = cashoutSlot === 1 
      ? this.currentRound.currentMultiplier1 
      : this.currentRound.currentMultiplier2;
    const cashoutMultiplier = atMultiplier || currentDragonMultiplier;
    
    // Can't cashout above this dragon's crash point
    const dragonCrashPoint = cashoutSlot === 1 ? this.currentRound.crashPoint1 : this.currentRound.crashPoint2;
    if (cashoutMultiplier.gt(dragonCrashPoint)) {
      return { success: false, error: 'Too late!' };
    }
    
    const payout = bet.amount.mul(cashoutMultiplier);
    const profit = payout.minus(bet.amount);
    
    const winningsAdded = await this.addWinnings(userId, payout, this.userSiteIds.get(userId) || 'default-site-001');
    if (!winningsAdded) {
      this.logger.error(`Failed to add winnings for user ${userId}`);
    }
    
    bet.status = 'CASHED_OUT';
    bet.cashedOutAt = cashoutMultiplier;
    bet.profit = profit;

    this.saveBetToDatabase(userId, bet, dragonCrashPoint, true, this.userSiteIds.get(userId) || 'default-site-001');
    
    this.logger.log(`💸 User ${userId} cashed out Dragon ${cashoutSlot} at ${cashoutMultiplier.toFixed(2)}x - Payout: $${payout.toFixed(2)}`);
    
    this.emitEvent('crash.cashout', {
      userId,
      multiplier: cashoutMultiplier.toFixed(2),
      profit: profit.toFixed(2),
      slot: cashoutSlot,
      isManual: !!isManual,
    });
    
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

  private getSafeRoundData(): Partial<GameRound> {
    if (!this.currentRound) return {};
    return {
      id: this.currentRound.id,
      gameNumber: this.currentRound.gameNumber,
      serverSeedHash: this.currentRound.serverSeedHash,
      clientSeed: this.currentRound.clientSeed,
      state: this.currentRound.state,
      currentMultiplier1: this.currentRound.currentMultiplier1,
      currentMultiplier2: this.currentRound.currentMultiplier2,
      dragon1Crashed: this.currentRound.dragon1Crashed,
      dragon2Crashed: this.currentRound.dragon2Crashed,
    };
  }

  private getFullRoundData(): GameRound {
    return this.currentRound!;
  }

  private emitEvent<K extends keyof CrashEvents>(
    event: K,
    data: CrashEvents[K]
  ): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
  }

  verifyCrashPoint(
    serverSeed: string,
    clientSeed: string,
    nonce: number
  ): { crashPoint: string; verified: boolean } {
    const result = this.generateCrashPoint(serverSeed, clientSeed, nonce);
    return {
      crashPoint: result.toFixed(2),
      verified: true,
    };
  }

  setClientSeed(userId: string, seed: string): { success: boolean; seed: string } {
    if (!seed || seed.length < 1 || seed.length > 64) {
      return { success: false, seed: '' };
    }
    this.userClientSeeds.set(userId, seed);
    return { success: true, seed };
  }

  getClientSeed(userId: string): string {
    return this.userClientSeeds.get(userId) || this.defaultClientSeed;
  }

  getCrashHistory(): number[] {
    return [...this.crashHistory];
  }

  getCurrentGameState(): { state: string; gameNumber: number; multiplier1: string; multiplier2: string; dragon1Crashed: boolean; dragon2Crashed: boolean; countdown?: number } {
    if (!this.currentRound) {
      return { state: 'WAITING', gameNumber: 0, multiplier1: '1.00', multiplier2: '1.00', dragon1Crashed: false, dragon2Crashed: false };
    }
    return {
      state: this.currentRound.state,
      gameNumber: this.currentRound.gameNumber,
      multiplier1: this.currentRound.currentMultiplier1?.toFixed(2) || '1.00',
      multiplier2: this.currentRound.currentMultiplier2?.toFixed(2) || '1.00',
      dragon1Crashed: this.currentRound.dragon1Crashed,
      dragon2Crashed: this.currentRound.dragon2Crashed,
    };
  }


  /**
   * Save a bot bet to the database for stats tracking
   */
  async saveBotBet(
    userId: string,
    betId: string,
    amount: number,
    targetCashout: number,
    siteId: string = 'default-site-001',
    skin: string = 'classic'
  ): Promise<void> {
    try {
      await this.prisma.bet.create({
        data: {
          id: betId,
          userId: userId,
          gameType: skinToGameType(skin),
          currency: 'USDT',
          siteId: siteId,
          betAmount: new Decimal(amount),
          multiplier: new Decimal(0),
          payout: new Decimal(0),
          profit: new Decimal(amount).negated(),
          serverSeed: this.currentRound?.serverSeed || '',
          serverSeedHash: this.currentRound?.serverSeedHash || '',
          clientSeed: this.defaultClientSeed,
          nonce: this.gameNumber,
          gameData: {
            gameId: this.currentRound?.id,
            gameNumber: this.gameNumber,
            isBot: true,
            targetCashout: targetCashout.toFixed(2),
          },
          isWin: false,
          settledAt: null,
        },
      });
    } catch (error) {
      this.logger.debug(`Failed to save bot bet: ${error.message}`);
    }
  }

  /**
   * Settle a bot bet (cashout) - update the bet record with win data
   */
  async settleBotBet(
    userId: string,
    multiplier: number,
    profit: number,
    amount: number,
    siteId: string = 'default-site-001'
  ): Promise<void> {
    try {
      // Find the most recent unsettled bot bet for this user
      const bet = await this.prisma.bet.findFirst({
        where: {
          userId: userId,
          gameType: { in: ['CRASH', 'DRAGON_BLAZE', 'NOVA_RUSH'] },
          settledAt: null,
          id: { startsWith: 'bot_' },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (bet) {
        await this.prisma.bet.update({
          where: { id: bet.id },
          data: {
            isWin: true,
            multiplier: new Decimal(multiplier),
            payout: new Decimal(amount).mul(new Decimal(multiplier)),
            profit: new Decimal(profit),
            settledAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.log(`Failed to settle bot bet: ${error.message}`);
    }
  }

  private async saveBetToDatabase(
    userId: string,
    bet: CrashBet,
    crashPoint: Decimal,
    isWin: boolean,
    siteId: string = 'default-site-001'
  ): Promise<void> {
    try {
      await this.prisma.bet.create({
        data: {
          id: bet.id,
          userId: userId,
          gameType: skinToGameType(bet.skin),
          currency: 'USDT',
          siteId: siteId,
          betAmount: bet.amount,
          multiplier: bet.cashedOutAt || new Decimal(0),
          payout: isWin ? bet.amount.mul(bet.cashedOutAt || 0) : new Decimal(0),
          profit: bet.profit || new Decimal(0),
          serverSeed: this.currentRound?.serverSeed || '',
          serverSeedHash: this.currentRound?.serverSeedHash || '',
          clientSeed: this.defaultClientSeed,
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

  async settleUnsettledBotBets(): Promise<void> {
    try {
      const result = await this.prisma.bet.updateMany({
        where: {
          id: { startsWith: "bot_" },
          settledAt: null,
        },
        data: {
          settledAt: new Date(),
          isWin: false,
          multiplier: 0,
          payout: 0,
          profit: 0,
        },
      });
      if (result.count > 0) {
        this.logger.log("Settled " + result.count + " unsettled bot bets as losses");
      }
    } catch (error) {
      this.logger.error("Failed to settle bot bets: " + error.message);
    }
  }

}
