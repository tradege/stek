import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CrashService, GameState } from './crash.service';
import Decimal from 'decimal.js';

/**
 * Client-to-Server Events
 */
interface PlaceBetPayload {
  amount: number;
  autoCashoutAt?: number;
}

interface CashoutPayload {
  // No payload needed - cashout at current multiplier
}

/**
 * Server-to-Client Events
 */
interface TickPayload {
  multiplier: string;
  elapsed: number;
}

interface StateChangePayload {
  state: GameState;
  gameNumber: number;
  serverSeedHash: string;
  clientSeed: string;
  multiplier: string;
  crashPoint?: string;  // Only revealed after crash
  serverSeed?: string;  // Only revealed after crash
}

interface BetPlacedPayload {
  oderId: string;
  amount: string;
}

interface CashoutPayload {
  multiplier: string;
  profit: string;
}

interface CrashedPayload {
  crashPoint: string;
  gameNumber: number;
}

interface ErrorPayload {
  message: string;
}

/**
 * Crash Game WebSocket Gateway
 * 
 * Handles real-time communication between clients and the Crash game.
 * 
 * Events:
 * - Client -> Server:
 *   - 'crash:place_bet' - Place a bet
 *   - 'crash:cashout' - Cash out current bet
 *   - 'crash:subscribe' - Subscribe to game updates
 * 
 * - Server -> Client:
 *   - 'crash:tick' - Multiplier update (every 100ms)
 *   - 'crash:state_change' - Game state changed
 *   - 'crash:bet_placed' - Bet was placed
 *   - 'crash:cashout' - Cashout successful
 *   - 'crash:crashed' - Game crashed
 *   - 'crash:error' - Error occurred
 */
@WebSocketGateway({
  namespace: '/crash',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class CrashGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrashGateway.name);
  
  // Map socket ID to user ID (for authenticated users)
  private socketToUser: Map<string, string> = new Map();
  private userToSocket: Map<string, string> = new Map();

  constructor(
    private readonly crashService: CrashService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Initialize the gateway
   */
  afterInit(server: Server): void {
    this.logger.log('🔌 Crash WebSocket Gateway initialized');
    
    // Connect the crash service to the event emitter
    this.crashService.setEventEmitter(this.eventEmitter);
  }

  /**
   * Handle new client connection
   */
  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
    
    // Send current game state to new client
    const currentRound = this.crashService.getCurrentRound();
    if (currentRound) {
      client.emit('crash:state_change', {
        state: currentRound.state,
        gameNumber: currentRound.gameNumber,
        serverSeedHash: currentRound.serverSeedHash,
        clientSeed: currentRound.clientSeed,
        multiplier: currentRound.currentMultiplier?.toString() || '1.00',
      });
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
    
    // Clean up user mapping
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.userToSocket.delete(userId);
      this.socketToUser.delete(client.id);
    }
  }

  // ============================================
  // CLIENT -> SERVER EVENTS
  // ============================================

  /**
   * Authenticate a socket connection
   */
  @SubscribeMessage('crash:auth')
  handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string; token?: string }
  ): void {
    // In production, validate the token here
    const { userId } = payload;
    
    this.socketToUser.set(client.id, userId);
    this.userToSocket.set(userId, client.id);
    
    this.logger.debug(`User ${userId} authenticated on socket ${client.id}`);
    
    client.emit('crash:auth_success', { userId });
  }

  /**
   * Place a bet
   */
  @SubscribeMessage('crash:place_bet')
  handlePlaceBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlaceBetPayload
  ): void {
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('crash:error', { message: 'Not authenticated' });
      return;
    }
    
    const { amount, autoCashoutAt } = payload;
    
    // TODO: Integrate with WalletService to deduct balance
    // For now, just place the bet in the game
    
    const result = this.crashService.placeBet(
      userId,
      new Decimal(amount),
      autoCashoutAt ? new Decimal(autoCashoutAt) : undefined
    );
    
    if (result.success) {
      client.emit('crash:bet_placed', {
        oderId: result.bet!.id,
        amount: result.bet!.amount.toFixed(2),
      });
    } else {
      client.emit('crash:error', { message: result.error || 'Failed to place bet' });
    }
  }

  /**
   * Cash out current bet
   */
  @SubscribeMessage('crash:cashout')
  handleCashout(@ConnectedSocket() client: Socket): void {
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('crash:error', { message: 'Not authenticated' });
      return;
    }
    
    const result = this.crashService.cashout(userId);
    
    if (result.success) {
      // TODO: Integrate with WalletService to credit winnings
      client.emit('crash:cashout_success', {
        profit: result.profit!.toFixed(2),
      });
    } else {
      client.emit('crash:error', { message: result.error || 'Failed to cashout' });
    }
  }

  // ============================================
  // SERVER -> CLIENT EVENTS (via EventEmitter)
  // ============================================

  /**
   * Broadcast tick to all connected clients
   */
  @OnEvent('crash.tick')
  handleTickEvent(payload: { multiplier: string; elapsed: number }): void {
    this.server.emit('crash:tick', payload);
  }

  /**
   * Broadcast state change to all connected clients
   */
  @OnEvent('crash.state_change')
  handleStateChangeEvent(payload: { state: GameState; round: any }): void {
    const { state, round } = payload;
    
    const statePayload: StateChangePayload = {
      state,
      gameNumber: round.gameNumber,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      multiplier: round.currentMultiplier?.toString() || '1.00',
    };
    
    // Reveal server seed and crash point after crash
    if (state === GameState.CRASHED) {
      statePayload.crashPoint = round.crashPoint?.toString();
      statePayload.serverSeed = round.serverSeed;
    }
    
    this.server.emit('crash:state_change', statePayload);
  }

  /**
   * Broadcast bet placed to all connected clients
   */
  @OnEvent('crash.bet_placed')
  handleBetPlacedEvent(payload: { userId: string; amount: string }): void {
    // Broadcast to all (for showing bet list)
    this.server.emit('crash:bet_placed', {
      userId: payload.userId,
      amount: payload.amount,
    });
  }

  /**
   * Broadcast cashout to all connected clients
   */
  @OnEvent('crash.cashout')
  handleCashoutEvent(payload: {
    userId: string;
    multiplier: string;
    profit: string;
  }): void {
    // Broadcast to all (for showing cashout in bet list)
    this.server.emit('crash:cashout', payload);
  }

  /**
   * Broadcast crash to all connected clients
   */
  @OnEvent('crash.crashed')
  handleCrashedEvent(payload: { crashPoint: string; gameNumber: number }): void {
    this.server.emit('crash:crashed', payload);
  }
}
