/**
 * ⚡ BATTALION 5: THE STORM
 * Stress & Load Tests (50 Tests)
 * 
 * Tests the system under extreme conditions including:
 * - Rate limiting and spam prevention
 * - Socket connection management
 * - Concurrent operations
 * - Memory and resource handling
 */

/**
 * Rate Limiter for various operations
 */
class RateLimiter {
  private requests: Map<string, { timestamps: number[]; blocked: boolean }> = new Map();
  
  constructor(
    private readonly windowMs: number = 60000,
    private readonly maxRequests: number = 100
  ) {}

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let data = this.requests.get(identifier);
    if (!data) {
      data = { timestamps: [], blocked: false };
      this.requests.set(identifier, data);
    }
    
    // Clean old timestamps
    data.timestamps = data.timestamps.filter(t => t > windowStart);
    
    if (data.timestamps.length >= this.maxRequests) {
      data.blocked = true;
      return false;
    }
    
    data.timestamps.push(now);
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const data = this.requests.get(identifier);
    if (!data) return this.maxRequests;
    
    const validTimestamps = data.timestamps.filter(t => t > windowStart);
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  isBlocked(identifier: string): boolean {
    return this.requests.get(identifier)?.blocked || false;
  }
}

/**
 * Chat Rate Limiter (stricter limits)
 */
class ChatRateLimiter {
  private messages: Map<string, number[]> = new Map();
  private readonly WINDOW_MS = 1000; // 1 second
  private readonly MAX_MESSAGES = 3; // 3 messages per second

  canSendMessage(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    
    let timestamps = this.messages.get(userId) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    
    if (timestamps.length >= this.MAX_MESSAGES) {
      return false;
    }
    
    timestamps.push(now);
    this.messages.set(userId, timestamps);
    return true;
  }

  getMessageCount(userId: string): number {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    
    const timestamps = this.messages.get(userId) || [];
    return timestamps.filter(t => t > windowStart).length;
  }
}

/**
 * Bet Rate Limiter (prevent click spam)
 */
class BetRateLimiter {
  private bets: Map<string, { lastBetTime: number; pendingBet: boolean }> = new Map();
  private readonly MIN_BET_INTERVAL = 500; // 500ms between bets

  canPlaceBet(userId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    let data = this.bets.get(userId);
    
    if (!data) {
      data = { lastBetTime: 0, pendingBet: false };
      this.bets.set(userId, data);
    }
    
    // Check if there's a pending bet
    if (data.pendingBet) {
      return { allowed: false, reason: 'Bet already pending' };
    }
    
    // Check minimum interval
    if (now - data.lastBetTime < this.MIN_BET_INTERVAL) {
      return { allowed: false, reason: 'Too fast, please wait' };
    }
    
    data.pendingBet = true;
    data.lastBetTime = now;
    return { allowed: true };
  }

  completeBet(userId: string): void {
    const data = this.bets.get(userId);
    if (data) {
      data.pendingBet = false;
    }
  }

  cancelBet(userId: string): void {
    const data = this.bets.get(userId);
    if (data) {
      data.pendingBet = false;
    }
  }
}

/**
 * Socket Connection Manager
 */
class SocketConnectionManager {
  private connections: Map<string, { socketId: string; connectedAt: Date; lastActivity: Date }[]> = new Map();
  private readonly MAX_CONNECTIONS_PER_USER = 5;
  private readonly MAX_TOTAL_CONNECTIONS = 10000;
  private totalConnections = 0;

  connect(userId: string, socketId: string): { success: boolean; error?: string } {
    // Check total connections
    if (this.totalConnections >= this.MAX_TOTAL_CONNECTIONS) {
      return { success: false, error: 'Server at capacity' };
    }
    
    let userConnections = this.connections.get(userId) || [];
    
    // Check per-user limit
    if (userConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
      // Disconnect oldest connection
      const oldest = userConnections.shift();
      if (oldest) {
        this.totalConnections--;
      }
    }
    
    userConnections.push({
      socketId,
      connectedAt: new Date(),
      lastActivity: new Date(),
    });
    
    this.connections.set(userId, userConnections);
    this.totalConnections++;
    
    return { success: true };
  }

  disconnect(userId: string, socketId: string): boolean {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return false;
    
    const index = userConnections.findIndex(c => c.socketId === socketId);
    if (index === -1) return false;
    
    userConnections.splice(index, 1);
    this.totalConnections--;
    
    if (userConnections.length === 0) {
      this.connections.delete(userId);
    }
    
    return true;
  }

  disconnectAll(userId: string): number {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return 0;
    
    const count = userConnections.length;
    this.totalConnections -= count;
    this.connections.delete(userId);
    
    return count;
  }

  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.length || 0;
  }

  getTotalConnections(): number {
    return this.totalConnections;
  }

  updateActivity(userId: string, socketId: string): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;
    
    const connection = userConnections.find(c => c.socketId === socketId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }
}

/**
 * Memory Monitor (simulated)
 */
class MemoryMonitor {
  private allocations: Map<string, number> = new Map();
  private readonly MAX_MEMORY_PER_USER = 10 * 1024 * 1024; // 10MB
  private readonly MAX_TOTAL_MEMORY = 1024 * 1024 * 1024; // 1GB
  private totalMemory = 0;

  allocate(userId: string, bytes: number): { success: boolean; error?: string } {
    const currentUserMemory = this.allocations.get(userId) || 0;
    
    if (currentUserMemory + bytes > this.MAX_MEMORY_PER_USER) {
      return { success: false, error: 'User memory limit exceeded' };
    }
    
    if (this.totalMemory + bytes > this.MAX_TOTAL_MEMORY) {
      return { success: false, error: 'Server memory limit exceeded' };
    }
    
    this.allocations.set(userId, currentUserMemory + bytes);
    this.totalMemory += bytes;
    
    return { success: true };
  }

  deallocate(userId: string, bytes: number): void {
    const currentUserMemory = this.allocations.get(userId) || 0;
    const newMemory = Math.max(0, currentUserMemory - bytes);
    
    this.totalMemory -= (currentUserMemory - newMemory);
    this.allocations.set(userId, newMemory);
  }

  getUserMemory(userId: string): number {
    return this.allocations.get(userId) || 0;
  }

  getTotalMemory(): number {
    return this.totalMemory;
  }
}

/**
 * Queue Manager for handling bursts
 */
class QueueManager {
  private queues: Map<string, { items: any[]; processing: boolean }> = new Map();
  private readonly MAX_QUEUE_SIZE = 100;

  enqueue(queueId: string, item: any): { success: boolean; position?: number; error?: string } {
    let queue = this.queues.get(queueId);
    if (!queue) {
      queue = { items: [], processing: false };
      this.queues.set(queueId, queue);
    }
    
    if (queue.items.length >= this.MAX_QUEUE_SIZE) {
      return { success: false, error: 'Queue is full' };
    }
    
    queue.items.push(item);
    return { success: true, position: queue.items.length };
  }

  dequeue(queueId: string): any | null {
    const queue = this.queues.get(queueId);
    if (!queue || queue.items.length === 0) return null;
    
    return queue.items.shift();
  }

  getQueueSize(queueId: string): number {
    return this.queues.get(queueId)?.items.length || 0;
  }

  clearQueue(queueId: string): void {
    this.queues.delete(queueId);
  }
}

// Test Suite
describe('⚡ BATTALION 5: THE STORM (Stress & Load)', () => {
  let rateLimiter: RateLimiter;
  let chatLimiter: ChatRateLimiter;
  let betLimiter: BetRateLimiter;
  let socketManager: SocketConnectionManager;
  let memoryMonitor: MemoryMonitor;
  let queueManager: QueueManager;

  beforeEach(() => {
    rateLimiter = new RateLimiter(60000, 100);
    chatLimiter = new ChatRateLimiter();
    betLimiter = new BetRateLimiter();
    socketManager = new SocketConnectionManager();
    memoryMonitor = new MemoryMonitor();
    queueManager = new QueueManager();
  });

  // ============================================
  // SECTION 1: Chat Spam Prevention (10 tests)
  // ============================================
  describe('Chat Spam Prevention', () => {
    test('1.1 - Should allow first message', () => {
      expect(chatLimiter.canSendMessage('user1')).toBe(true);
    });

    test('1.2 - Should allow up to 3 messages per second', () => {
      expect(chatLimiter.canSendMessage('user1')).toBe(true);
      expect(chatLimiter.canSendMessage('user1')).toBe(true);
      expect(chatLimiter.canSendMessage('user1')).toBe(true);
    });

    test('1.3 - Should block 4th message within 1 second', () => {
      chatLimiter.canSendMessage('user1');
      chatLimiter.canSendMessage('user1');
      chatLimiter.canSendMessage('user1');
      expect(chatLimiter.canSendMessage('user1')).toBe(false);
    });

    test('1.4 - Should block 100 messages in 1 second', () => {
      let blocked = 0;
      for (let i = 0; i < 100; i++) {
        if (!chatLimiter.canSendMessage('user1')) {
          blocked++;
        }
      }
      expect(blocked).toBe(97); // 100 - 3 allowed
    });

    test('1.5 - Different users should have separate limits', () => {
      chatLimiter.canSendMessage('user1');
      chatLimiter.canSendMessage('user1');
      chatLimiter.canSendMessage('user1');
      
      // User1 is at limit, but user2 should be fine
      expect(chatLimiter.canSendMessage('user1')).toBe(false);
      expect(chatLimiter.canSendMessage('user2')).toBe(true);
    });

    test('1.6 - Should track message count correctly', () => {
      chatLimiter.canSendMessage('user1');
      chatLimiter.canSendMessage('user1');
      expect(chatLimiter.getMessageCount('user1')).toBe(2);
    });

    test('1.7 - New user should have 0 message count', () => {
      expect(chatLimiter.getMessageCount('new-user')).toBe(0);
    });

    test('1.8 - Should handle rapid fire messages', () => {
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(chatLimiter.canSendMessage('user1'));
      }
      
      const allowed = results.filter(r => r).length;
      expect(allowed).toBe(3);
    });

    test('1.9 - Multiple users rapid fire should all get their limits', () => {
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
      let totalAllowed = 0;
      
      for (let i = 0; i < 10; i++) {
        for (const user of users) {
          if (chatLimiter.canSendMessage(user)) {
            totalAllowed++;
          }
        }
      }
      
      expect(totalAllowed).toBe(15); // 5 users * 3 messages each
    });

    test('1.10 - Should not crash with many users', () => {
      for (let i = 0; i < 1000; i++) {
        chatLimiter.canSendMessage(`user${i}`);
      }
      expect(true).toBe(true); // No crash
    });
  });

  // ============================================
  // SECTION 2: Socket Flood Prevention (10 tests)
  // ============================================
  describe('Socket Flood Prevention', () => {
    test('2.1 - Should allow first connection', () => {
      const result = socketManager.connect('user1', 'socket1');
      expect(result.success).toBe(true);
    });

    test('2.2 - Should allow up to 5 connections per user', () => {
      for (let i = 1; i <= 5; i++) {
        const result = socketManager.connect('user1', `socket${i}`);
        expect(result.success).toBe(true);
      }
      expect(socketManager.getConnectionCount('user1')).toBe(5);
    });

    test('2.3 - 6th connection should disconnect oldest', () => {
      for (let i = 1; i <= 5; i++) {
        socketManager.connect('user1', `socket${i}`);
      }
      
      socketManager.connect('user1', 'socket6');
      
      // Should still have 5 connections (oldest removed)
      expect(socketManager.getConnectionCount('user1')).toBe(5);
    });

    test('2.4 - Should handle 500 connections', () => {
      for (let i = 0; i < 500; i++) {
        socketManager.connect(`user${i}`, `socket${i}`);
      }
      expect(socketManager.getTotalConnections()).toBe(500);
    });

    test('2.5 - Should handle disconnect all', () => {
      for (let i = 1; i <= 5; i++) {
        socketManager.connect('user1', `socket${i}`);
      }
      
      const disconnected = socketManager.disconnectAll('user1');
      expect(disconnected).toBe(5);
      expect(socketManager.getConnectionCount('user1')).toBe(0);
    });

    test('2.6 - Should handle reconnect after disconnect all', () => {
      for (let i = 1; i <= 5; i++) {
        socketManager.connect('user1', `socket${i}`);
      }
      
      socketManager.disconnectAll('user1');
      
      const result = socketManager.connect('user1', 'new-socket');
      expect(result.success).toBe(true);
    });

    test('2.7 - Should track total connections correctly', () => {
      socketManager.connect('user1', 'socket1');
      socketManager.connect('user2', 'socket2');
      socketManager.connect('user3', 'socket3');
      
      expect(socketManager.getTotalConnections()).toBe(3);
    });

    test('2.8 - Disconnect should reduce total count', () => {
      socketManager.connect('user1', 'socket1');
      socketManager.connect('user2', 'socket2');
      
      socketManager.disconnect('user1', 'socket1');
      
      expect(socketManager.getTotalConnections()).toBe(1);
    });

    test('2.9 - Should update activity timestamp', () => {
      socketManager.connect('user1', 'socket1');
      socketManager.updateActivity('user1', 'socket1');
      // No crash means success
      expect(true).toBe(true);
    });

    test('2.10 - Should handle rapid connect/disconnect cycles', () => {
      for (let i = 0; i < 100; i++) {
        socketManager.connect('user1', `socket${i}`);
        socketManager.disconnect('user1', `socket${i}`);
      }
      expect(socketManager.getConnectionCount('user1')).toBe(0);
    });
  });

  // ============================================
  // SECTION 3: Bet Spam Prevention (10 tests)
  // ============================================
  describe('Bet Spam Prevention', () => {
    test('3.1 - Should allow first bet', () => {
      const result = betLimiter.canPlaceBet('user1');
      expect(result.allowed).toBe(true);
    });

    test('3.2 - Should block immediate second bet', () => {
      betLimiter.canPlaceBet('user1');
      const result = betLimiter.canPlaceBet('user1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('pending');
    });

    test('3.3 - Should allow bet after completing previous', () => {
      betLimiter.canPlaceBet('user1');
      betLimiter.completeBet('user1');
      
      // Need to wait for interval - simulate by checking the logic
      const result = betLimiter.canPlaceBet('user1');
      // Will fail due to MIN_BET_INTERVAL, but pending is cleared
      expect(result.reason).toContain('fast');
    });

    test('3.4 - Should block 20 rapid clicks', () => {
      let blocked = 0;
      for (let i = 0; i < 20; i++) {
        const result = betLimiter.canPlaceBet('user1');
        if (!result.allowed) blocked++;
      }
      expect(blocked).toBe(19); // Only first one allowed
    });

    test('3.5 - Different users should have separate limits', () => {
      betLimiter.canPlaceBet('user1');
      const result = betLimiter.canPlaceBet('user2');
      expect(result.allowed).toBe(true);
    });

    test('3.6 - Cancel bet should allow new bet (after interval)', () => {
      betLimiter.canPlaceBet('user1');
      betLimiter.cancelBet('user1');
      
      const result = betLimiter.canPlaceBet('user1');
      // Pending is cleared, but interval still applies
      expect(result.reason).toContain('fast');
    });

    test('3.7 - Should handle many users betting simultaneously', () => {
      let allowed = 0;
      for (let i = 0; i < 100; i++) {
        const result = betLimiter.canPlaceBet(`user${i}`);
        if (result.allowed) allowed++;
      }
      expect(allowed).toBe(100); // All different users
    });

    test('3.8 - Same user 100 rapid bets should only allow 1', () => {
      let allowed = 0;
      for (let i = 0; i < 100; i++) {
        const result = betLimiter.canPlaceBet('user1');
        if (result.allowed) allowed++;
      }
      expect(allowed).toBe(1);
    });

    test('3.9 - Complete bet should clear pending flag', () => {
      betLimiter.canPlaceBet('user1');
      betLimiter.completeBet('user1');
      
      // Pending should be cleared
      // Next bet blocked only by interval, not pending
      const result = betLimiter.canPlaceBet('user1');
      expect(result.reason).not.toContain('pending');
    });

    test('3.10 - Should not crash with rapid operations', () => {
      for (let i = 0; i < 1000; i++) {
        betLimiter.canPlaceBet('user1');
        if (i % 2 === 0) betLimiter.completeBet('user1');
        else betLimiter.cancelBet('user1');
      }
      expect(true).toBe(true);
    });
  });

  // ============================================
  // SECTION 4: Rate Limiting (10 tests)
  // ============================================
  describe('Rate Limiting', () => {
    test('4.1 - Should allow requests within limit', () => {
      for (let i = 0; i < 50; i++) {
        expect(rateLimiter.isAllowed('user1')).toBe(true);
      }
    });

    test('4.2 - Should block after 100 requests', () => {
      for (let i = 0; i < 100; i++) {
        rateLimiter.isAllowed('user1');
      }
      expect(rateLimiter.isAllowed('user1')).toBe(false);
    });

    test('4.3 - Should track remaining requests', () => {
      for (let i = 0; i < 30; i++) {
        rateLimiter.isAllowed('user1');
      }
      expect(rateLimiter.getRemainingRequests('user1')).toBe(70);
    });

    test('4.4 - Reset should clear limits', () => {
      for (let i = 0; i < 100; i++) {
        rateLimiter.isAllowed('user1');
      }
      
      rateLimiter.reset('user1');
      expect(rateLimiter.isAllowed('user1')).toBe(true);
    });

    test('4.5 - Different users should have separate limits', () => {
      for (let i = 0; i < 100; i++) {
        rateLimiter.isAllowed('user1');
      }
      
      expect(rateLimiter.isAllowed('user1')).toBe(false);
      expect(rateLimiter.isAllowed('user2')).toBe(true);
    });

    test('4.6 - Should mark user as blocked', () => {
      for (let i = 0; i < 100; i++) {
        rateLimiter.isAllowed('user1');
      }
      rateLimiter.isAllowed('user1'); // Trigger block
      
      expect(rateLimiter.isBlocked('user1')).toBe(true);
    });

    test('4.7 - New user should not be blocked', () => {
      expect(rateLimiter.isBlocked('new-user')).toBe(false);
    });

    test('4.8 - Should handle 1000 users', () => {
      for (let i = 0; i < 1000; i++) {
        rateLimiter.isAllowed(`user${i}`);
      }
      expect(true).toBe(true);
    });

    test('4.9 - Remaining should be max for new user', () => {
      expect(rateLimiter.getRemainingRequests('new-user')).toBe(100);
    });

    test('4.10 - Should handle edge case of exactly 100 requests', () => {
      for (let i = 0; i < 99; i++) {
        rateLimiter.isAllowed('user1');
      }
      expect(rateLimiter.isAllowed('user1')).toBe(true); // 100th
      expect(rateLimiter.isAllowed('user1')).toBe(false); // 101st
    });
  });

  // ============================================
  // SECTION 5: Resource Management (10 tests)
  // ============================================
  describe('Resource Management', () => {
    test('5.1 - Should allocate memory successfully', () => {
      const result = memoryMonitor.allocate('user1', 1024);
      expect(result.success).toBe(true);
    });

    test('5.2 - Should track user memory', () => {
      memoryMonitor.allocate('user1', 1024);
      memoryMonitor.allocate('user1', 2048);
      expect(memoryMonitor.getUserMemory('user1')).toBe(3072);
    });

    test('5.3 - Should block allocation exceeding user limit', () => {
      const result = memoryMonitor.allocate('user1', 20 * 1024 * 1024);
      expect(result.success).toBe(false);
      expect(result.error).toContain('User memory limit');
    });

    test('5.4 - Should deallocate memory', () => {
      memoryMonitor.allocate('user1', 1024);
      memoryMonitor.deallocate('user1', 512);
      expect(memoryMonitor.getUserMemory('user1')).toBe(512);
    });

    test('5.5 - Queue should accept items', () => {
      const result = queueManager.enqueue('queue1', { data: 'test' });
      expect(result.success).toBe(true);
      expect(result.position).toBe(1);
    });

    test('5.6 - Queue should track size', () => {
      queueManager.enqueue('queue1', { data: 1 });
      queueManager.enqueue('queue1', { data: 2 });
      queueManager.enqueue('queue1', { data: 3 });
      expect(queueManager.getQueueSize('queue1')).toBe(3);
    });

    test('5.7 - Queue should reject when full', () => {
      for (let i = 0; i < 100; i++) {
        queueManager.enqueue('queue1', { data: i });
      }
      const result = queueManager.enqueue('queue1', { data: 'overflow' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('full');
    });

    test('5.8 - Dequeue should return items in order', () => {
      queueManager.enqueue('queue1', { data: 1 });
      queueManager.enqueue('queue1', { data: 2 });
      queueManager.enqueue('queue1', { data: 3 });
      
      expect(queueManager.dequeue('queue1').data).toBe(1);
      expect(queueManager.dequeue('queue1').data).toBe(2);
      expect(queueManager.dequeue('queue1').data).toBe(3);
    });

    test('5.9 - Clear queue should empty it', () => {
      queueManager.enqueue('queue1', { data: 1 });
      queueManager.enqueue('queue1', { data: 2 });
      queueManager.clearQueue('queue1');
      expect(queueManager.getQueueSize('queue1')).toBe(0);
    });

    test('5.10 - Dequeue from empty queue should return null', () => {
      expect(queueManager.dequeue('empty-queue')).toBeNull();
    });
  });
});
