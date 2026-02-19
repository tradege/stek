/**
 * Socket Integration Module
 * ==========================
 * 
 * Connects CrashService and WalletService to the WebSocket Gateway.
 * Acts as a bridge between business logic and real-time communication.
 */

import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

interface GameTick {
  gameId: string;
  multiplier: number;
  state: 'WAITING' | 'RUNNING' | 'CRASHED';
  elapsed: number;
  crashPoint?: number;
}

interface BalanceUpdate {
  userId: string;
  currency: string;
  balance: number;
  change: number;
  transactionType: string;
  transactionId: string;
}

interface BetPlaced {
  gameId: string;
  username: string;
  amount: number;
  autoCashout?: number;
}

interface CashoutEvent {
  gameId: string;
  username: string;
  multiplier: number;
  profit: number;
}

// ============================================
// SOCKET EVENT BUS (Singleton)
// ============================================

class SocketEventBus extends EventEmitter {
  private static instance: SocketEventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);  // Allow many listeners
  }

  public static getInstance(): SocketEventBus {
    if (!SocketEventBus.instance) {
      SocketEventBus.instance = new SocketEventBus();
    }
    return SocketEventBus.instance;
  }

  // ============================================
  // CRASH SERVICE EVENTS
  // ============================================

  /**
   * Emit game tick (called every 100ms during RUNNING state)
   */
  public emitTick(tick: GameTick): void {
    this.emit('crash:tick', tick);
  }

  /**
   * Emit state change (WAITING -> RUNNING -> CRASHED)
   */
  public emitStateChange(state: GameTick): void {
    this.emit('crash:state', state);
  }

  /**
   * Emit when a player places a bet
   */
  public emitBetPlaced(bet: BetPlaced): void {
    this.emit('crash:bet_placed', bet);
  }

  /**
   * Emit when a player cashes out
   */
  public emitCashout(cashout: CashoutEvent): void {
    this.emit('crash:cashout', cashout);
  }


  // ============================================
  // VAULT (JACKPOT) EVENTS
  // ============================================
  /**
   * Emit jackpot pool amount update (broadcast to all clients)
   */
  public emitVaultUpdate(data: { currentAmount: number }): void {
    this.emit('vault:update', data);
  }

  /**
   * Emit jackpot win event (broadcast to all clients)
   */
  public emitVaultWin(data: { userId: string; amount: number; gameType: string }): void {
    this.emit('vault:win', data);
  }

  // ============================================
  // LIVE RAKEBACK STREAM EVENTS
  // ============================================
  /**
   * Emit when a player earns rakeback (private to user)
   */
  public emitRakebackEarned(data: {
    userId: string;
    amount: number;
    gameType: string;
    betAmount: number;
    rakebackRate: number;
  }): void {
    this.emit('rakeback:earned', data);
  }

  /**
   * Emit live feed of recent wins/rakeback (broadcast to all)
   */
  public emitLiveFeed(data: {
    username: string;
    type: 'win' | 'rakeback' | 'jackpot' | 'level_up';
    amount: number;
    gameType?: string;
    message?: string;
  }): void {
    this.emit('live:feed', data);
  }

  // ============================================
  // WALLET SERVICE EVENTS
  // ============================================

  /**
   * Emit balance update (private to user)
   */
  public emitBalanceUpdate(update: BalanceUpdate): void {
    this.emit('wallet:update', update);
  }

  // ============================================
  // BET HANDLERS (From Gateway to Services)
  // ============================================

  /**
   * Register handler for bet placement requests
   */
  public onBetPlace(handler: (data: { userId: string; username: string; amount: number; autoCashout?: number }) => void): void {
    this.on('bet:place', handler);
  }

  /**
   * Register handler for cashout requests
   */
  public onCashout(handler: (data: { userId: string; username: string }) => void): void {
    this.on('bet:cashout', handler);
  }
}

// ============================================
// CRASH SERVICE INTEGRATION
// ============================================

export class CrashSocketIntegration {
  private eventBus: SocketEventBus;
  private currentGameId: string = '';

  constructor() {
    this.eventBus = SocketEventBus.getInstance();
  }

  /**
   * Called when game enters WAITING state
   */
  public onWaiting(gameId: string, countdown: number): void {
    this.currentGameId = gameId;
    this.eventBus.emitStateChange({
      gameId,
      multiplier: 1.00,
      state: 'WAITING',
      elapsed: countdown,
    });
  }

  /**
   * Called every 100ms during RUNNING state
   */
  public onTick(multiplier: number, elapsed: number): void {
    this.eventBus.emitTick({
      gameId: this.currentGameId,
      multiplier,
      state: 'RUNNING',
      elapsed,
    });
  }

  /**
   * Called when game crashes
   */
  public onCrash(crashPoint: number): void {
    this.eventBus.emitStateChange({
      gameId: this.currentGameId,
      multiplier: crashPoint,
      state: 'CRASHED',
      elapsed: 0,
      crashPoint,
    });
  }

  /**
   * Called when a player places a bet
   */
  public onBetPlaced(username: string, amount: number, autoCashout?: number): void {
    this.eventBus.emitBetPlaced({
      gameId: this.currentGameId,
      username,
      amount,
      autoCashout,
    });
  }

  /**
   * Called when a player cashes out
   */
  public onPlayerCashout(username: string, multiplier: number, profit: number): void {
    this.eventBus.emitCashout({
      gameId: this.currentGameId,
      username,
      multiplier,
      profit,
    });
  }

  /**
   * Register handler for incoming bet requests from clients
   */
  public registerBetHandler(handler: (data: { userId: string; username: string; amount: number; autoCashout?: number }) => void): void {
    this.eventBus.onBetPlace(handler);
  }

  /**
   * Register handler for incoming cashout requests from clients
   */
  public registerCashoutHandler(handler: (data: { userId: string; username: string }) => void): void {
    this.eventBus.onCashout(handler);
  }
}

// ============================================
// WALLET SERVICE INTEGRATION
// ============================================

export class WalletSocketIntegration {
  private eventBus: SocketEventBus;

  constructor() {
    this.eventBus = SocketEventBus.getInstance();
  }

  /**
   * Called after any wallet transaction
   */
  public notifyBalanceChange(
    userId: string,
    currency: string,
    newBalance: number,
    change: number,
    transactionType: string,
    transactionId: string
  ): void {
    this.eventBus.emitBalanceUpdate({
      userId,
      currency,
      balance: newBalance,
      change,
      transactionType,
      transactionId,
    });
  }
}

// ============================================
// EXPORTS
// ============================================

export const socketEventBus = SocketEventBus.getInstance();
export const crashSocket = new CrashSocketIntegration();
export const walletSocket = new WalletSocketIntegration();

export default {
  eventBus: socketEventBus,
  crash: crashSocket,
  wallet: walletSocket,
};
