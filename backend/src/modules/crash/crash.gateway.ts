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

interface ChatSendPayload {
  room: string;
  message: string;
}

interface ChatJoinPayload {
  room: string;
}

interface ChatHistoryPayload {
  room: string;
  limit?: number;
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

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  role: 'ADMIN' | 'MODERATOR' | 'VIP' | 'USER';
  message: string;
  timestamp: Date;
}

/**
 * Crash Game WebSocket Gateway
 * 
 * Handles real-time communication between clients and the Crash game.
 * Supports both authenticated users and guests (read-only mode).
 * Also handles chat functionality.
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
  
  // Chat message history (in-memory, last 100 messages)
  private chatHistory: ChatMessage[] = [];
  private readonly MAX_CHAT_HISTORY = 100;
  
  // User info cache (for chat display)
  private userInfoCache: Map<string, { username: string; role: string }> = new Map();

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
   * Handle new client connection
   */
  handleConnection(client: Socket): void {
    this.logger.log(`📡 Client connected: ${client.id}`);
    
    // Try to authenticate from handshake
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
    
    if (token) {
      try {
        const cleanToken = token.replace(/^Bearer\s+/i, '');
        const decoded = this.jwtService.verify(cleanToken, {
          secret: process.env.JWT_SECRET || 'your-secret-key',
        });
        
        const userId = decoded.sub || decoded.userId || decoded.id;
        const username = decoded.username || 'User';
        const role = decoded.role || 'USER';
        
        if (userId) {
          this.socketToUser.set(client.id, userId);
          this.userToSocket.set(userId, client.id);
          this.userInfoCache.set(userId, { username, role });
          
          this.logger.log(`🔐 User ${userId} (${username}) authenticated on connect`);
          
          client.emit('auth:success', { 
            userId,
            message: 'Authenticated successfully' 
          });
        }
      } catch (error) {
        this.logger.warn(`⚠️ Auth failed for ${client.id}: ${error.message}`);
        // Mark as guest but don't disconnect
        this.guestSockets.add(client.id);
        client.emit('auth:error', { 
          message: 'Authentication failed, connected as guest',
          critical: false 
        });
      }
    } else {
      // No token - connect as guest
      this.guestSockets.add(client.id);
      client.emit('auth:guest', { 
        message: 'Connected as guest. Login to place bets and chat.' 
      });
    }
    
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
    
    // Send crash history to new client
    const crashHistory = this.crashService.getCrashHistory();
    if (crashHistory.length > 0) {
      client.emit('crash:history', { crashes: crashHistory });
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`📴 Client disconnected: ${client.id}`);
    
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.socketToUser.delete(client.id);
      this.userToSocket.delete(userId);
    }
    
    this.guestSockets.delete(client.id);
  }

  // ============================================
  // CHAT HANDLERS
  // ============================================

  /**
   * Handle chat room join
   */
  @SubscribeMessage('chat:join')
  handleChatJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatJoinPayload
  ): void {
    const { room } = payload;
    client.join(`chat:${room}`);
    this.logger.log(`💬 Client ${client.id} joined chat room: ${room}`);
    client.emit('chat:joined', { room });
  }

  /**
   * Handle chat history request
   */
  @SubscribeMessage('chat:history')
  handleChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatHistoryPayload
  ): void {
    const { limit = 50 } = payload;
    const messages = this.chatHistory.slice(-limit);
    client.emit('chat:history', { messages });
  }

  /**
   * Handle chat message send
   */
  @SubscribeMessage('chat:send')
  handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatSendPayload
  ): void {
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('chat:error', { message: 'Authentication required to send messages' });
      return;
    }
    
    const { room, message } = payload;
    
    // Validate message
    if (!message || message.trim().length === 0) {
      client.emit('chat:error', { message: 'Message cannot be empty' });
      return;
    }
    
    if (message.length > 200) {
      client.emit('chat:error', { message: 'Message too long (max 200 characters)' });
      return;
    }
    
    // Get user info
    const userInfo = this.userInfoCache.get(userId) || { username: 'User', role: 'USER' };
    
    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username: userInfo.username,
      role: userInfo.role as ChatMessage['role'],
      message: message.trim(),
      timestamp: new Date(),
    };
    
    // Store in history
    this.chatHistory.push(chatMessage);
    if (this.chatHistory.length > this.MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }
    
    // Broadcast to room
    this.server.to(`chat:${room}`).emit('chat:message', chatMessage);
    
    // Also broadcast globally for clients not in specific room
    this.server.emit('chat:message', chatMessage);
    
    this.logger.log(`💬 ${userInfo.username}: ${message.substring(0, 50)}...`);
  }

  /**
   * Handle system message (admin only)
   */
  @SubscribeMessage('chat:system')
  handleChatSystem(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { message: string }
  ): void {
    const userId = this.socketToUser.get(client.id);
    const userInfo = userId ? this.userInfoCache.get(userId) : null;
    
    if (!userInfo || userInfo.role !== 'ADMIN') {
      client.emit('chat:error', { message: 'Admin access required' });
      return;
    }
    
    const systemMessage: ChatMessage = {
      id: `sys-${Date.now()}`,
      userId: 'system',
      username: 'System',
      role: 'ADMIN',
      message: payload.message,
      timestamp: new Date(),
    };
    
    this.server.emit('chat:system', systemMessage);
  }

  // ============================================
  // BOT CHAT MESSAGE HANDLER
  // ============================================

  /**
   * Handle bot chat messages from BotService
   */
  @OnEvent('bot:chat_message')
  handleBotChatMessage(payload: { username: string; message: string; timestamp: Date }): void {
    const chatMessage: ChatMessage = {
      id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: `bot-${payload.username}`,
      username: payload.username,
      role: 'USER',
      message: payload.message,
      timestamp: payload.timestamp,
    };
    
    // Store in history
    this.chatHistory.push(chatMessage);
    if (this.chatHistory.length > this.MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }
    
    // Broadcast to all clients
    this.server.emit('chat:message', chatMessage);
  }
  /**
   * Handle bot bet placed events from BotService
   */
  @OnEvent('bot:bet_placed')
  handleBotBetPlaced(payload: { 
    userId: string; 
    username: string; 
    amount: number; 
    targetCashout: number;
    isBot: boolean;
  }): void {
    // Broadcast bot bet to all clients (appears in Live Bets)
    const betId = `bot_${payload.userId}_${Date.now()}`;
    this.server.emit('crash:bet_placed', {
      id: betId,
      betId: betId,
      oddsId: payload.userId,
      oddsNumber: 0,
      userId: payload.userId,
      username: payload.username,
      amount: payload.amount.toFixed(2),
      currency: 'USDT',
      isBot: true,
    });
    
    this.logger.debug(`🤖 Bot bet broadcasted: ${payload.username} - $${payload.amount}`);
  }

  /**
   * Handle bot cashout events from BotService
   */
  @OnEvent('bot:cashout')
  handleBotCashout(payload: { 
    userId: string; 
    username: string; 
    multiplier: number; 
    profit: number;
    amount: number;
    isBot: boolean;
  }): void {
    // Broadcast bot cashout to all clients
    this.server.emit('crash:cashout', {
      oddsId: payload.userId,
      oddsNumber: 0,
      userId: payload.userId,
      username: payload.username,
      multiplier: (typeof payload.multiplier === "number" ? payload.multiplier : parseFloat(payload.multiplier)).toFixed(2),
      profit: payload.profit.toFixed(2),
      isBot: true,
    });
    
    this.logger.debug(`🤖 Bot cashout broadcasted: ${payload.username} at ${payload.multiplier}x`);
  }


  // ============================================
  // GAME ROOM HANDLERS
  // ============================================

  /**
   * Join a specific game room
   */
  @SubscribeMessage('crash:join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string }
  ): void {
    const { room } = payload;
    client.join(room);
    this.logger.log(`🎮 Client ${client.id} joined room: ${room}`);
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
      const username = decoded.username || 'User';
      const role = decoded.role || 'USER';
      
      if (userId) {
        // Remove from guests
        this.guestSockets.delete(client.id);
        
        // Associate socket with user
        this.socketToUser.set(client.id, userId);
        this.userToSocket.set(userId, client.id);
        this.userInfoCache.set(userId, { username, role });
        
        this.logger.log(`🔐 User ${userId} (${username}) authenticated via message on socket ${client.id}`);
        
        client.emit('auth:success', { userId });
      }
    } catch (error) {
      this.logger.warn(`⚠️ Auth message failed for ${client.id}: ${error.message}`);
      client.emit('auth:error', { message: 'Invalid token', critical: false });
    }
  }

  /**
   * Place a bet (requires authentication)
   * Now async to handle balance deduction
   */
  @SubscribeMessage('crash:place_bet')
  async handlePlaceBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlaceBetPayload
  ): Promise<void> {
    this.logger.log(`🎰 Place bet request from socket ${client.id}`);
    this.logger.debug(`   Payload: ${JSON.stringify(payload)}`);
    
    const userId = this.socketToUser.get(client.id);
    
    // Check if user is authenticated
    if (!userId) {
      this.logger.warn(`⚠️ Bet rejected - not authenticated: ${client.id}`);
      client.emit('crash:error', { 
        message: 'Authentication required to place bets. Please login.' 
      });
      return;
    }
    
    this.logger.log(`   User ID: ${userId}`);
    
    // Support both autoCashoutAt and autoCashout field names from frontend
    const { amount, autoCashoutAt, autoCashout } = payload as any;
    const autoCashoutValue = autoCashoutAt || autoCashout;
    
    // Validate amount
    if (!amount || amount <= 0) {
      this.logger.warn(`⚠️ Bet rejected - invalid amount: ${amount}`);
      client.emit('crash:error', { message: 'Invalid bet amount' });
      return;
    }
    
    this.logger.log(`   Amount: ${amount}, AutoCashout: ${autoCashoutValue}`);
    
    const result = await this.crashService.placeBet(
      userId,
      new Decimal(amount),
      autoCashoutValue ? new Decimal(autoCashoutValue) : undefined
    );
    
    if (result.success) {
      this.logger.log(`✅ Bet placed successfully: ${result.bet!.id}`);
      client.emit('crash:bet_placed', {
        success: true,
        orderId: result.bet!.id,
        amount: result.bet!.amount.toFixed(2),
        bet: {
          oddsId: result.bet!.id,
          oddsName: 'Crash',
          betAmount: parseFloat(result.bet!.amount.toFixed(2)),
        },
      });
    } else {
      this.logger.warn(`❌ Bet failed: ${result.error}`);
      client.emit('crash:error', { message: result.error || 'Failed to place bet' });
    }
  }

  /**
   * Cash out current bet (requires authentication)
   * Now async to handle adding winnings
   */
  @SubscribeMessage('crash:cashout')
  async handleCashout(@ConnectedSocket() client: Socket): Promise<void> {
    this.logger.log(`💰 Cashout request from socket ${client.id}`);
    
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      this.logger.warn(`⚠️ Cashout rejected - not authenticated: ${client.id}`);
      client.emit('crash:error', { 
        message: 'Authentication required to cashout. Please login.' 
      });
      return;
    }
    
    this.logger.log(`   User ID: ${userId}`);
    
    const result = await this.crashService.cashout(userId);
    
    if (result.success) {
      this.logger.log(`✅ Cashout successful: profit ${result.profit!.toFixed(2)}`);
      // Emit to the event name that frontend expects
      client.emit('crash:cashout', {
        success: true,
        multiplier: result.multiplier?.toFixed(2) || '1.00',
        profit: result.profit!.toFixed(2),
      });
    } else {
      this.logger.warn(`❌ Cashout failed: ${result.error}`);
      client.emit('crash:cashout', { 
        success: false, 
        error: result.error || 'Failed to cashout' 
      });
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
  handleBetPlacedEvent(payload: { userId: string; username: string; amount: string; betId: string; currency: string }): void {
    // Get username from cache if not provided
    const userInfo = this.userInfoCache.get(payload.userId) || { username: 'Player', role: 'USER' };
    const username = payload.username || userInfo.username;
    
    this.server.emit('crash:bet_placed', {
      id: payload.betId,
      oddsId: payload.betId,
      oddsNumber: 0,
      oddsNumberFormatted: '0',
      oddsNumberFormattedShort: '0',
      oddsNumberFormattedLong: '0',
      userId: payload.userId,
      username: username,
      amount: parseFloat(payload.amount),
      currency: payload.currency || 'USDT',
      status: 'ACTIVE',
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
    betId?: string;
  }): void {
    this.server.emit('crash:cashout', {
      betId: payload.betId || '',
      userId: payload.userId,
      multiplier: parseFloat(payload.multiplier),
      profit: parseFloat(payload.profit),
    });
  }

  /**
   * Broadcast crash to all connected clients
   */
  @OnEvent('crash.crashed')
  handleCrashedEvent(payload: { crashPoint: string; gameNumber: number }): void {
    this.server.emit('crash:crashed', payload);
  }

  /**
   * Send balance update to specific user (private)
   */
  @OnEvent('crash.balance_update')
  handleBalanceUpdateEvent(payload: { userId: string; change: string; reason: string }): void {
    const socketId = this.userToSocket.get(payload.userId);
    if (socketId) {
      // Send only to the specific user's socket (private)
      this.server.to(socketId).emit('balance:update', {
        change: payload.change,
        reason: payload.reason,
      });
    }
  }
}
