/**
 * App Gateway - WebSocket Real-Time Communication
 * ================================================
 */

import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  role?: string;
  lastChatTime?: number;
  lastHeartbeat?: number;
}

// Socket-based Rate Limiter (prevents DDoS by Socket ID)
class SocketRateLimiter {
  private timestamps: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  public blockedCount: number = 0;
  public allowedCount: number = 0;

  constructor(windowMs: number = 1000, maxRequests: number = 1) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Cleanup old entries every 30 seconds
    setInterval(() => this.cleanup(), 30000);
  }

  isRateLimited(socketId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get or create timestamps array
    let timestamps = this.timestamps.get(socketId);
    if (!timestamps) {
      timestamps = [];
      this.timestamps.set(socketId, timestamps);
    }
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(t => t > windowStart);
    this.timestamps.set(socketId, validTimestamps);
    
    // Check if rate limited
    if (validTimestamps.length >= this.maxRequests) {
      this.blockedCount++;
      return true;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.allowedCount++;
    return false;
  }

  removeSocket(socketId: string): void {
    this.timestamps.delete(socketId);
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [socketId, timestamps] of this.timestamps.entries()) {
      const validTimestamps = timestamps.filter(t => t > windowStart);
      if (validTimestamps.length === 0) {
        this.timestamps.delete(socketId);
      } else {
        this.timestamps.set(socketId, validTimestamps);
      }
    }
  }

  getSize(): number {
    return this.timestamps.size;
  }

  getStats(): { blocked: number; allowed: number; blockRate: number } {
    const total = this.blockedCount + this.allowedCount;
    return {
      blocked: this.blockedCount,
      allowed: this.allowedCount,
      blockRate: total > 0 ? (this.blockedCount / total) * 100 : 0
    };
  }

  resetStats(): void {
    this.blockedCount = 0;
    this.allowedCount = 0;
  }
}

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

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isVIP?: boolean;
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
// CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'betworkss-secret-key-change-in-production';
const CHAT_RATE_LIMIT_MS = 1000;  // 1 message per second
const MAX_CHAT_MESSAGE_LENGTH = 500;
const STALE_CONNECTION_TIMEOUT = 300000; // 5 minutes

// ============================================
// APP GATEWAY CLASS
// ============================================

export class AppGateway {
  private io: Server;
  private eventBus: EventEmitter;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();  // userId -> Set of socketIds
  private chatRateLimiter: SocketRateLimiter = new SocketRateLimiter(1000, 1);  // 1 msg per second per socket

  // Statistics
  private stats = {
    totalConnections: 0,
    currentConnections: 0,
    messagesPerSecond: 0,
    peakConnections: 0,
  };

  constructor(io: Server, eventBus?: EventEmitter) {
    this.io = io;
    this.eventBus = eventBus || new EventEmitter();
    this.setupNamespace();
    this.setupEventListeners();
    // Broadcast platform stats every 10 seconds
    setInterval(() => {
      const stats = this.getStats();
      this.io.of('/casino').emit('stats:global', {
        onlineUsers: stats.connectedUsers,
        betsToday: stats.totalConnections,
        totalVolume: 0,
      });
    }, 10000);

    // FIX-2: Periodic Cleanup of Stale Connections
    setInterval(() => this.cleanupStaleConnections(), 60000); // Every minute
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    for (const [socketId, socket] of this.connectedClients.entries()) {
      const lastActive = socket.lastHeartbeat || (socket as any).connectedTime || now;
      if (now - lastActive > STALE_CONNECTION_TIMEOUT) {
        socket.disconnect(true);
        this.handleDisconnect(socket);
      }
    }

    // Secondary deep cleanup for userSockets Map
    for (const [userId, sockets] of this.userSockets.entries()) {
      for (const socketId of sockets) {
        if (!this.connectedClients.has(socketId)) {
          sockets.delete(socketId);
        }
      }
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  // ============================================
  // NAMESPACE SETUP
  // ============================================

  private setupNamespace(): void {
    const casino = this.io.of('/casino');

    // Authentication middleware
    casino.use((socket: AuthenticatedSocket, next) => {
      this.authenticateSocket(socket, next);
    });

    // Connection handler
    casino.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  private authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow anonymous connections for public rooms (game watching)
      socket.userId = `anon_${socket.id}`;
      socket.username = 'Guest';
      socket.role = 'GUEST';
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.role = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication failed: Invalid token'));
    }
  }

  // ============================================
  // CONNECTION HANDLING
  // ============================================

  private handleConnection(socket: AuthenticatedSocket): void {
    // Track connection
    (socket as any).connectedTime = Date.now();
    socket.lastHeartbeat = Date.now();
    this.connectedClients.set(socket.id, socket);
    this.stats.totalConnections++;
    this.stats.currentConnections++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.stats.currentConnections);

    // Track user sockets (for private messages)
    if (socket.userId && !socket.userId.startsWith('anon_')) {
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId)!.add(socket.id);

      // Join private room
      socket.join(`user:${socket.userId}`);
    }

    // Setup event handlers
    this.setupSocketHandlers(socket);

    // Send welcome message
    socket.emit('connected', {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
      role: socket.role,
      serverTime: new Date(),
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });

    // FIX-2: Heartbeat listener
    socket.on('heartbeat', () => {
      socket.lastHeartbeat = Date.now();
      socket.emit('heartbeat:ack', { timestamp: Date.now() });
    });
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    if (this.connectedClients.has(socket.id)) {
      this.connectedClients.delete(socket.id);
      this.stats.currentConnections--;

      // Remove from rate limiter
      this.chatRateLimiter.removeSocket(socket.id);

      // Remove from user sockets
      if (socket.userId && this.userSockets.has(socket.userId)) {
        this.userSockets.get(socket.userId)!.delete(socket.id);
        if (this.userSockets.get(socket.userId)!.size === 0) {
          this.userSockets.delete(socket.userId);
        }
      }
    }
  }

  // ============================================
  // SOCKET EVENT HANDLERS
  // ============================================

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    // Join Crash game room
    socket.on('join:crash', () => {
      socket.join('room:crash');
      socket.emit('joined', { room: 'crash' });
    });

    // Leave Crash game room
    socket.on('leave:crash', () => {
      socket.leave('room:crash');
      socket.emit('left', { room: 'crash' });
    });

    // Join Chat room
    socket.on('join:chat', () => {
      socket.join('room:chat');
      socket.emit('joined', { room: 'chat' });
    });

    // Leave Chat room
    socket.on('leave:chat', () => {
      socket.leave('room:chat');
      socket.emit('left', { room: 'chat' });
    });

    // Chat message (with rate limiting)
    socket.on('chat:message', (data: { message: string }) => {
      this.handleChatMessage(socket, data);
    });

    // Place bet (forward to game service)
    socket.on('crash:bet', (data: { amount: number; autoCashout?: number }) => {
      if (socket.role === 'GUEST') {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Please login to place bets' });
        return;
      }
      this.eventBus.emit('bet:place', {
        userId: socket.userId,
        username: socket.username,
        ...data,
      });
    });

    // Cashout (forward to game service)
    socket.on('crash:cashout', () => {
      if (socket.role === 'GUEST') {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Please login to cashout' });
        return;
      }
      this.eventBus.emit('bet:cashout', {
        userId: socket.userId,
        username: socket.username,
      });
    });

    // Stats request handler
    socket.on('stats:request', () => {
      const stats = this.getStats();
      socket.emit('stats:global', {
        onlineUsers: stats.connectedUsers,
        betsToday: stats.totalConnections,
        totalVolume: 0,
      });
    });

    socket.on('ping', (timestamp: number) => {
      socket.emit('pong', { sent: timestamp, received: Date.now() });
    });
  }

  // ============================================
  // CHAT HANDLING (WITH RATE LIMITING)
  // ============================================

  private handleChatMessage(socket: AuthenticatedSocket, data: { message: string }): void {
    // Check if authenticated
    if (socket.role === 'GUEST') {
      socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Please login to chat' });
      return;
    }

    // Rate limiting by Socket ID (prevents DDoS)
    if (this.chatRateLimiter.isRateLimited(socket.id)) {
      socket.emit('error', { 
        code: 'RATE_LIMITED', 
        message: 'Please wait before sending another message',
        retryAfter: CHAT_RATE_LIMIT_MS,
      });
      return;
    }

    // Validate message
    if (!data.message || typeof data.message !== 'string') {
      socket.emit('error', { code: 'INVALID_MESSAGE', message: 'Message is required' });
      return;
    }

    const message = data.message.trim();
    if (message.length === 0 || message.length > MAX_CHAT_MESSAGE_LENGTH) {
      socket.emit('error', { 
        code: 'INVALID_MESSAGE', 
        message: `Message must be 1-${MAX_CHAT_MESSAGE_LENGTH} characters` 
      });
      return;
    }

    // Broadcast to chat room
    const chatMessage: ChatMessage = {
      userId: socket.userId!,
      username: socket.username!,
      message,
      timestamp: new Date(),
      isVIP: socket.role === 'SUPER_MASTER' || socket.role === 'ADMIN',
    };

    this.io.of('/casino').to('room:chat').emit('chat:message', chatMessage);
  }

  // ============================================
  // GAME EVENTS (Called by CrashService)
  // ============================================

  /**
   * Broadcast game tick to all clients in crash room
   * Uses volatile emit to prevent lag accumulation
   */
  public broadcastTick(tick: GameTick): void {
    this.io.of('/casino').to('room:crash').volatile.emit('crash:tick', tick);
  }

  /**
   * Broadcast game state change (WAITING, RUNNING, CRASHED)
   */
  public broadcastStateChange(state: GameTick): void {
    this.io.of('/casino').to('room:crash').emit('crash:state', state);
  }

  /**
   * Broadcast when a player places a bet
   */
  public broadcastBetPlaced(bet: BetPlaced): void {
    this.io.of('/casino').to('room:crash').emit('crash:bet_placed', bet);
  }

  /**
   * Broadcast when a player cashes out
   */
  public broadcastCashout(cashout: CashoutEvent): void {
    this.io.of('/casino').to('room:crash').emit('crash:cashout', cashout);
  }

  // ============================================
  // PRIVATE EVENTS (Called by WalletService)
  // ============================================

  /**
   * Send balance update to specific user only
   */
  public sendBalanceUpdate(update: BalanceUpdate): void {
    this.io.of('/casino').to(`user:${update.userId}`).emit('balance:update', update);
  }

  /**
   * Send notification to specific user
   */
  public sendNotification(userId: string, notification: { type: string; title: string; message: string }): void {
    this.io.of('/casino').to(`user:${userId}`).emit('notification', notification);
  }

  /**
   * Send bet result to specific user
   */
  public sendBetResult(userId: string, result: { gameId: string; won: boolean; multiplier?: number; profit?: number }): void {
    this.io.of('/casino').to(`user:${userId}`).emit('crash:result', result);
  }

  // ============================================
  // EVENT BUS LISTENERS
  // ============================================

  private setupEventListeners(): void {
    // Listen for game ticks from CrashService
    this.eventBus.on('crash:tick', (tick: GameTick) => {
      this.broadcastTick(tick);
    });

    // Listen for state changes
    this.eventBus.on('crash:state', (state: GameTick) => {
      this.broadcastStateChange(state);
    });

    // Listen for balance updates from WalletService
    this.eventBus.on('wallet:update', (update: BalanceUpdate) => {
      this.sendBalanceUpdate(update);
    });

    // Listen for bet placements
    this.eventBus.on('crash:bet_placed', (bet: BetPlaced) => {
      this.broadcastBetPlaced(bet);
    });

    // Listen for cashouts
    this.eventBus.on('crash:cashout', (cashout: CashoutEvent) => {
      this.broadcastCashout(cashout);
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get current connection statistics
   */
  public getStats(): typeof this.stats & { connectedUsers: number } {
    return {
      ...this.stats,
      connectedUsers: this.userSockets.size,
    };
  }

  /**
   * Check if a user is online
   */
  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get number of clients in a room
   */
  public async getRoomSize(room: string): Promise<number> {
    const sockets = await this.io.of('/casino').in(room).fetchSockets();
    return sockets.length;
  }

  /**
   * Broadcast system message to all connected clients
   */
  public broadcastSystemMessage(message: string): void {
    this.io.of('/casino').emit('system:message', {
      type: 'SYSTEM',
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Get rate limiter statistics
   */
  public getRateLimiterStats(): { blocked: number; allowed: number; blockRate: number } {
    return this.chatRateLimiter.getStats();
  }

  /**
   * Reset rate limiter statistics
   */
  public resetRateLimiterStats(): void {
    this.chatRateLimiter.resetStats();
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createGateway(io: Server, eventBus?: EventEmitter): AppGateway {
  return new AppGateway(io, eventBus);
}

export default AppGateway;
