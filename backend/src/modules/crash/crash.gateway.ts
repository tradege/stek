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
import { JwtService } from '@nestjs/jwt';
import Decimal from 'decimal.js';

/**
 * Client-to-Server Events
 */
interface PlaceBetPayload {
  amount: number;
  autoCashoutAt?: number;
}

/**
 * Server-to-Client Events
 */
interface StateChangePayload {
  state: GameState;
  gameNumber: number;
  serverSeedHash: string;
  clientSeed: string;
  multiplier: string;
  crashPoint?: string;
  serverSeed?: string;
}

/**
 * Crash Game WebSocket Gateway
 * 
 * Handles real-time communication between clients and the Crash game.
 * Supports both authenticated users and guests (read-only mode).
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
  // Track guest connections
  private guestSockets: Set<string> = new Set();

  constructor(
    private readonly crashService: CrashService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
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
   * Handle new client connection with GRACEFUL AUTH FALLBACK
   */
  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
    
    // Try to authenticate from handshake
    let userId: string | null = null;
    let isAuthenticated = false;

    try {
      // Extract token from auth payload OR headers
      const authToken = 
        client.handshake.auth?.token || 
        client.handshake.headers?.authorization;

      if (authToken) {
        // Remove "Bearer " prefix if present
        const token = authToken.replace(/^Bearer\s+/i, '');
        
        if (token && token !== 'undefined' && token !== 'null') {
          try {
            // Verify JWT token
            const decoded = this.jwtService.verify(token, {
              secret: process.env.JWT_SECRET || 'your-secret-key',
            });
            
            userId = decoded.sub || decoded.userId || decoded.id;
            
            if (userId) {
              // Associate socket with user
              this.socketToUser.set(client.id, userId);
              this.userToSocket.set(userId, client.id);
              isAuthenticated = true;
              
              this.logger.log(`🔐 User ${userId} authenticated on socket ${client.id}`);
              
              // Notify client of successful auth
              client.emit('auth:success', { 
                userId,
                message: 'Authenticated successfully' 
              });
            }
          } catch (jwtError) {
            // JWT verification failed - log but continue as guest
            this.logger.warn(`⚠️ JWT verification failed for ${client.id}: ${jwtError.message}`);
            
            // Notify client of auth error (non-critical)
            client.emit('auth:error', { 
              message: 'Token invalid or expired',
              critical: false 
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Auth error for ${client.id}: ${error.message}`);
    }

    // If not authenticated, mark as guest (read-only mode)
    if (!isAuthenticated) {
      this.guestSockets.add(client.id);
      this.logger.debug(`👤 Guest connected: ${client.id}`);
      
      // Notify client they're in guest mode
      client.emit('auth:guest', { 
        message: 'Connected as guest (read-only mode)' 
      });
    }

    // Send current game state to new client (both auth and guest)
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
    
    // Clean up guest tracking
    this.guestSockets.delete(client.id);
  }

  // ============================================
  // CLIENT -> SERVER EVENTS
  // ============================================

  /**
   * Handle join room request
   */
  @SubscribeMessage('crash:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room?: string }
  ): void {
    const room = payload?.room || 'crash';
    client.join(room);
    
    this.logger.debug(`Client ${client.id} joined room: ${room}`);
    client.emit('room:joined', { room });
  }

  /**
   * Authenticate a socket connection (manual auth after connect)
   */
  @SubscribeMessage('crash:auth')
  handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { token?: string }
  ): void {
    const { token } = payload;
    
    if (!token) {
      client.emit('auth:error', { message: 'No token provided', critical: false });
      return;
    }

    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      const decoded = this.jwtService.verify(cleanToken, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });
      
      const userId = decoded.sub || decoded.userId || decoded.id;
      
      if (userId) {
        // Remove from guests
        this.guestSockets.delete(client.id);
        
        // Associate socket with user
        this.socketToUser.set(client.id, userId);
        this.userToSocket.set(userId, client.id);
        
        this.logger.log(`🔐 User ${userId} authenticated via message on socket ${client.id}`);
        
        client.emit('auth:success', { userId });
      }
    } catch (error) {
      this.logger.warn(`⚠️ Auth message failed for ${client.id}: ${error.message}`);
      client.emit('auth:error', { message: 'Invalid token', critical: false });
    }
  }

  /**
   * Place a bet (requires authentication)
   */
  @SubscribeMessage('crash:place_bet')
  handlePlaceBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlaceBetPayload
  ): void {
    const userId = this.socketToUser.get(client.id);
    
    // Check if user is authenticated
    if (!userId) {
      client.emit('crash:error', { 
        message: 'Authentication required to place bets. Please login.' 
      });
      return;
    }
    
    const { amount, autoCashoutAt } = payload;
    
    // Validate amount
    if (!amount || amount <= 0) {
      client.emit('crash:error', { message: 'Invalid bet amount' });
      return;
    }
    
    const result = this.crashService.placeBet(
      userId,
      new Decimal(amount),
      autoCashoutAt ? new Decimal(autoCashoutAt) : undefined
    );
    
    if (result.success) {
      client.emit('crash:bet_placed', {
        orderId: result.bet!.id,
        amount: result.bet!.amount.toFixed(2),
      });
    } else {
      client.emit('crash:error', { message: result.error || 'Failed to place bet' });
    }
  }

  /**
   * Cash out current bet (requires authentication)
   */
  @SubscribeMessage('crash:cashout')
  handleCashout(@ConnectedSocket() client: Socket): void {
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('crash:error', { 
        message: 'Authentication required to cashout. Please login.' 
      });
      return;
    }
    
    const result = this.crashService.cashout(userId);
    
    if (result.success) {
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
