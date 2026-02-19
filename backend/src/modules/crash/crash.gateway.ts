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
  slot?: number;
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
  multiplier1: string;
  multiplier2: string;
  dragon1Crashed: boolean;
  dragon2Crashed: boolean;
  crashPoint1?: string;
  crashPoint2?: string;
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

@WebSocketGateway({
  namespace: '/casino',
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
  
  private socketToUser: Map<string, string> = new Map();
  private userToSocket: Map<string, string> = new Map();
  private guestSockets: Set<string> = new Set();
  private chatHistory: ChatMessage[] = [];
  private readonly MAX_CHAT_HISTORY = 100;
  private userSiteId: Map<string, string> = new Map();
  private userInfoCache: Map<string, { username: string; role: string }> = new Map();

  constructor(
    private readonly crashService: CrashService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('🔌 Crash WebSocket Gateway initialized (Dual-Dragon)');
    this.crashService.setEventEmitter(this.eventEmitter);
  }

  handleConnection(client: Socket): void {
    this.logger.log(`📡 Client connected: ${client.id}`);
    
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
    
    if (token) {
      try {
        const cleanToken = token.replace(/^Bearer\s+/i, '');
        const decoded = this.jwtService.verify(cleanToken, {
          secret: process.env.JWT_SECRET,
        });
        
        const userId = decoded.sub || decoded.userId || decoded.id;
        const username = decoded.username || 'User';
        const role = decoded.role || 'USER';
        
        if (userId) {
          this.socketToUser.set(client.id, userId);
          this.userToSocket.set(userId, client.id);
          this.userInfoCache.set(userId, { username, role });
          
          const siteId = client.handshake.auth?.siteId || client.handshake.query?.siteId || '1';
          this.userSiteId.set(userId, siteId as string);
          this.logger.log(`🔐 User ${userId} (${username}) authenticated on connect [Site: ${siteId}]`);
          
          client.emit('auth:success', { 
            userId,
            message: 'Authenticated successfully' 
          });
          
          // DEBUG: Log ALL incoming events from this client
          client.onAny((eventName: string, ...args: any[]) => {
          });
        }
      } catch (error) {
        this.logger.warn(`⚠️ Auth failed for ${client.id}: ${error.message}`);
        this.guestSockets.add(client.id);
        client.emit('auth:error', { 
          message: 'Authentication failed, connected as guest',
          critical: false 
        });
      }
    } else {
      this.guestSockets.add(client.id);
      client.emit('auth:guest', { 
        message: 'Connected as guest. Login to place bets and chat.' 
      });
    }
    
    // Send current game state with BOTH multipliers
    const currentRound = this.crashService.getCurrentRound();
    if (currentRound) {
      client.emit('crash:state_change', {
        state: currentRound.state,
        gameNumber: currentRound.gameNumber,
        serverSeedHash: currentRound.serverSeedHash,
        clientSeed: currentRound.clientSeed,
        multiplier1: currentRound.currentMultiplier1?.toString() || '1.00',
        multiplier2: currentRound.currentMultiplier2?.toString() || '1.00',
        dragon1Crashed: currentRound.dragon1Crashed || false,
        dragon2Crashed: currentRound.dragon2Crashed || false,
      });
    }
    
    const crashHistory = this.crashService.getCrashHistory();
    if (crashHistory.length > 0) {
      client.emit('crash:history', { crashes: crashHistory });
    }
  }

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
  // CHAT HANDLERS (unchanged)
  // ============================================

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

  @SubscribeMessage('chat:history')
  handleChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatHistoryPayload
  ): void {
    const { limit = 50 } = payload;
    const messages = this.chatHistory.slice(-limit);
    client.emit('chat:history', { messages });
  }

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
    if (!message || message.trim().length === 0) {
      client.emit('chat:error', { message: 'Message cannot be empty' });
      return;
    }
    if (message.length > 200) {
      client.emit('chat:error', { message: 'Message too long (max 200 characters)' });
      return;
    }
    const userInfo = this.userInfoCache.get(userId) || { username: 'User', role: 'USER' };
    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username: userInfo.username,
      role: userInfo.role as ChatMessage['role'],
      message: message.trim(),
      timestamp: new Date(),
    };
    this.chatHistory.push(chatMessage);
    if (this.chatHistory.length > this.MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }
    this.server.to(`chat:${room}`).emit('chat:message', chatMessage);
    this.server.emit('chat:message', chatMessage);
    this.logger.log(`💬 ${userInfo.username}: ${message.substring(0, 50)}...`);
  }

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
  // BOT HANDLERS (unchanged)
  // ============================================

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
    this.chatHistory.push(chatMessage);
    if (this.chatHistory.length > this.MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }
    this.server.emit('chat:message', chatMessage);
  }

  @OnEvent('bot:bet_placed')
  async handleBotBetPlaced(payload: { 
    userId: string; 
    username: string; 
    amount: number; 
    targetCashout: number;
    isBot: boolean;
    siteId?: string;
  }): Promise<void> {
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
    
    // Save bot bet to database for stats tracking
    try {
      const siteId = payload.siteId || '1';
      await this.crashService.saveBotBet(
        payload.userId,
        betId,
        payload.amount,
        payload.targetCashout,
        siteId
      );
    } catch (error) {
      this.logger.debug(`Failed to save bot bet: ${error.message}`);
    }
    
    this.logger.debug(`🤖 Bot bet broadcasted: ${payload.username} - $${payload.amount}`);
  }

  @OnEvent('bot:cashout')
  async handleBotCashout(payload: { 
    userId: string; 
    username: string; 
    multiplier: number; 
    profit: number;
    amount: number;
    isBot: boolean;
    siteId?: string;
  }): Promise<void> {
    this.server.emit('crash:cashout', {
      oddsId: payload.userId,
      oddsNumber: 0,
      userId: payload.userId,
      username: payload.username,
      multiplier: (typeof payload.multiplier === "number" ? payload.multiplier : parseFloat(payload.multiplier)).toFixed(2),
      profit: payload.profit.toFixed(2),
      isBot: true,
    });
    
    // Update bot bet in database with cashout result
    try {
      const siteId = payload.siteId || '1';
      await this.crashService.settleBotBet(
        payload.userId,
        payload.multiplier,
        payload.profit,
        payload.amount,
        siteId
      );
    } catch (error) {
      this.logger.log(`Failed to settle bot bet: ${error.message}`);
    }
    
    this.logger.log(`🤖 Bot cashout broadcasted: ${payload.username} at ${payload.multiplier}x`);
  }

  // ============================================
  // GAME ROOM HANDLERS
  // ============================================

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
        secret: process.env.JWT_SECRET,
      });
      const userId = decoded.sub || decoded.userId || decoded.id;
      const username = decoded.username || 'User';
      const role = decoded.role || 'USER';
      if (userId) {
        this.guestSockets.delete(client.id);
        this.socketToUser.set(client.id, userId);
        this.userToSocket.set(userId, client.id);
        this.userInfoCache.set(userId, { username, role });
        this.logger.log(`🔐 User ${userId} (${username}) authenticated via message`);
        client.emit('auth:success', { userId });
      }
    } catch (error) {
      this.logger.warn(`⚠️ Auth message failed for ${client.id}: ${error.message}`);
      client.emit('auth:error', { message: 'Invalid token', critical: false });
    }
  }

  /**
   * Place a bet
   */
  @SubscribeMessage('crash:place_bet')
  async handlePlaceBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlaceBetPayload
  ): Promise<void> {
    this.logger.log(`🎰 Place bet request from socket ${client.id}`);
    this.logger.debug(`   Payload: ${JSON.stringify(payload)}`);
    
    const userId = this.socketToUser.get(client.id);
    if (!userId) {
      this.logger.warn(`⚠️ Bet rejected - not authenticated: ${client.id}`);
      client.emit('crash:error', { 
        message: 'Authentication required to place bets. Please login.' 
      });
      return;
    }
    
    // === STRICT INPUT VALIDATION ===
    const rawAmount = (payload as any).amount;
    const rawAutoCashoutAt = (payload as any).autoCashoutAt;
    const rawAutoCashout = (payload as any).autoCashout;
    const rawSlot = (payload as any).slot;
    const rawSkin = (payload as any).skin;
    
    // Validate skin (default to 'classic')
    const skin = typeof rawSkin === 'string' && ['classic', 'dragon', 'space'].includes(rawSkin) ? rawSkin : 'classic';
    
    // Validate slot
    const betSlot = typeof rawSlot === 'number' ? rawSlot : parseInt(String(rawSlot), 10);
    if (betSlot !== 1 && betSlot !== 2) {
      client.emit('crash:error', { message: 'Invalid slot - must be 1 or 2' });
      return;
    }
    
    // Validate amount
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      client.emit('crash:error', { message: 'Invalid bet amount - must be a positive number' });
      return;
    }
    if (amount < 0.10) {
      client.emit('crash:error', { message: 'Minimum bet is $0.10' });
      return;
    }
    if (amount > 10000) {
      client.emit('crash:error', { message: 'Maximum bet is $10,000' });
      return;
    }
    const sanitizedAmount = Math.round(amount * 100) / 100;
    
    // Validate autoCashout
    const rawAutoCashoutValue = rawAutoCashoutAt || rawAutoCashout;
    let autoCashoutValue: number | undefined;
    if (rawAutoCashoutValue !== undefined && rawAutoCashoutValue !== null) {
      const parsed = typeof rawAutoCashoutValue === 'number' ? rawAutoCashoutValue : parseFloat(String(rawAutoCashoutValue));
      if (!Number.isFinite(parsed) || parsed < 1.01 || parsed > 5000) {
        client.emit('crash:error', { message: 'Auto-cashout must be between 1.01x and 5000x' });
        return;
      }
      autoCashoutValue = parsed;
    }
    
    const userSiteId = this.userSiteId.get(userId) || '1';
    this.logger.log(`🏢 Bet placed for Site: ${userSiteId}`);
    
    const result = await this.crashService.placeBet(
      userId,
      new Decimal(sanitizedAmount),
      autoCashoutValue ? new Decimal(autoCashoutValue) : undefined,
      betSlot,
      userSiteId,
      skin
    );
    
    if (result.success) {
      this.logger.log(`✅ Bet placed: ${result.bet!.id} on Dragon ${betSlot}`);
      client.emit('crash:bet_placed', {
        slot: betSlot,
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
   * Cash out
   */
  @SubscribeMessage('crash:cashout')
  async handleCashout(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { slot?: number }
  ): Promise<void> {
    this.logger.log(`💰 Cashout request: socket=${client.id} slot=${payload?.slot} userId=${this.socketToUser.get(client.id)}`);
    
    const userId = this.socketToUser.get(client.id);
    if (!userId) {
      client.emit('crash:error', { 
        message: 'Authentication required to cashout. Please login.' 
      });
      return;
    }
    
    const cashoutSlot = payload?.slot;
    if (cashoutSlot !== 1 && cashoutSlot !== 2) {
      client.emit('crash:cashout', { success: false, slot: null, error: 'Invalid slot - must be 1 or 2' });
      return;
    }
    
    try {
      const result = await this.crashService.cashout(userId, undefined, cashoutSlot, true);
      
      if (result.success) {
        const profitStr = result.profit ? result.profit.toFixed(2) : '0.00';
        const multStr = result.multiplier ? result.multiplier.toFixed(2) : '1.00';
        this.logger.log(`✅ Cashout Dragon ${cashoutSlot}: profit ${profitStr}`);
        this.logger.warn(`🟢 DIRECT emit crash:cashout (manual): slot=${cashoutSlot} userId=${userId}`); client.emit('crash:cashout', {
          success: true,
          userId,
          multiplier: multStr,
          profit: profitStr,
          slot: cashoutSlot,
        });
      } else {
        this.logger.warn(`❌ Cashout failed for slot ${cashoutSlot}: ${result.error}`);
        client.emit('crash:cashout', { 
          success: false,
          userId,
          slot: cashoutSlot,
          error: result.error || 'Failed to cashout' 
        });
      }
    } catch (err) {
      this.logger.error(`💥 Cashout EXCEPTION for slot ${cashoutSlot}: ${err.message}`, err.stack);
      client.emit('crash:cashout', { 
        success: false,
        userId,
        slot: cashoutSlot,
        error: 'Internal error during cashout' 
      });
    }
  }

  // ============================================
  // SERVER -> CLIENT EVENTS
  // ============================================

  /**
   * Broadcast tick with BOTH multipliers
   */
  @OnEvent('crash.tick')
  handleTickEvent(payload: { multiplier1: string; multiplier2: string; elapsed: number; dragon1Crashed: boolean; dragon2Crashed: boolean }): void {
    this.server.emit('crash:tick', payload);
  }

  /**
   * Broadcast state change
   */
  @OnEvent('crash.state_change')
  handleStateChangeEvent(payload: { state: GameState; round: any }): void {
    const { state, round } = payload;
    
    const statePayload: any = {
      state,
      gameNumber: round.gameNumber,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      multiplier1: round.currentMultiplier1?.toString() || '1.00',
      multiplier2: round.currentMultiplier2?.toString() || '1.00',
      dragon1Crashed: round.dragon1Crashed || false,
      dragon2Crashed: round.dragon2Crashed || false,
    };
    
    // Reveal after full crash
    if (state === GameState.CRASHED) {
      statePayload.crashPoint1 = round.crashPoint1?.toString();
      statePayload.crashPoint2 = round.crashPoint2?.toString();
      statePayload.serverSeed = round.serverSeed;
    }
    
    this.server.emit('crash:state_change', statePayload);

    // Settle unsettled bot bets as losses when round ends
    if (state === 'CRASHED') {
      this.crashService.settleUnsettledBotBets().catch(err => 
        this.logger.error('Failed to settle bot bets: ' + err.message)
      );
    }
  }

  /**
   * Broadcast individual dragon crash
   */
  @OnEvent('crash.dragon_crashed')
  handleDragonCrashedEvent(payload: { dragon: number; crashPoint: string; gameNumber: number }): void {
    this.server.emit('crash:dragon_crashed', payload);
  }

  /**
   * Broadcast bet placed
   */
  @OnEvent('crash.bet_placed')
  handleBetPlacedEvent(payload: { userId: string; username: string; amount: string; betId: string; currency: string; slot?: number }): void {
    const userInfo = this.userInfoCache.get(payload.userId) || { username: 'Player', role: 'USER' };
    const username = payload.username || userInfo.username;
    
    this.server.emit('crash:bet_placed', {
      id: payload.betId,
      oddsId: payload.betId,
      oddsNumber: 0,
      userId: payload.userId,
      username: username,
      amount: parseFloat(payload.amount),
      currency: payload.currency || 'USDT',
      status: 'ACTIVE',
      slot: payload.slot,
    });
  }

  /**
   * Broadcast cashout
   */
  @OnEvent('crash.cashout')
  handleCashoutEvent(payload: {
    userId: string;
    multiplier: string;
    profit: string;
    betId?: string;
    slot?: number;
    isManual?: boolean;
  }): void {
    const cashoutSlot = (payload.slot === 1 || payload.slot === 2) ? payload.slot : null;
    if (cashoutSlot === null) {
      this.logger.warn('⚠️ Invalid slot in cashout event, ignoring');
      return;
    }
    
    const broadcastPayload = {
      betId: payload.betId || '',
      userId: payload.userId,
      multiplier: parseFloat(payload.multiplier),
      profit: parseFloat(payload.profit),
      slot: cashoutSlot,
    };
    
    if (payload.isManual) {
      // FIXED: Exclude sender socket to prevent DOUBLE EMIT
      const senderSocketId = this.userToSocket.get(payload.userId);
      if (senderSocketId) {
        this.server.except(senderSocketId).emit('crash:cashout', broadcastPayload);
      } else {
        this.server.emit('crash:cashout', broadcastPayload);
      }
    } else {
      // Auto-cashout: broadcast to all + direct confirmation
      this.server.emit('crash:cashout', broadcastPayload);
      for (const [socketId, userId] of this.socketToUser.entries()) {
        if (userId === payload.userId) {
          const clientSocket = (this.server.sockets as any)?.sockets?.get(socketId) || (this.server as any).sockets?.get(socketId);
          if (clientSocket) {
            clientSocket.emit('crash:cashout', {
              success: true,
              userId: payload.userId,
              multiplier: payload.multiplier,
              profit: payload.profit,
              slot: cashoutSlot,
            });
          }
        }
      }
    }
  }
  

  /**
   * Live Rakeback Stream: Send private rakeback notification to user
   */
  @OnEvent('rakeback:earned')
  handleRakebackEarned(data: { userId: string; amount: number; betAmount: number }) {
    // Send to specific user's room
    this.server.to(`user:${data.userId}`).emit('rakeback:earned', {
      amount: data.amount,
      betAmount: data.betAmount,
      timestamp: new Date(),
    });
  }

  /**
   * Live Feed: Broadcast wins, rakeback, jackpots to all connected clients
   */
  @OnEvent('live:feed')
  handleLiveFeed(data: { username: string; type: string; amount: number; gameType?: string; message?: string }) {
    this.server.emit('live:feed', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * The Vault: Broadcast jackpot updates and wins
   */
  @OnEvent('vault:update')
  handleVaultUpdate(data: { currentAmount: number }) {
    this.server.emit('vault:update', data);
  }

  @OnEvent('vault:win')
  handleVaultWin(data: { userId: string; amount: number; gameType: string }) {
    this.server.emit('vault:win', {
      ...data,
      timestamp: new Date(),
    });
  }

}
