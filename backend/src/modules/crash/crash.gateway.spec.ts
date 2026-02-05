/**
 * 🔌 Crash Gateway Unit Tests
 * 
 * Phase 35: Socket & Bot Coverage Booster
 * 
 * Tests the WebSocket Gateway with mocked dependencies
 * Based on actual crash.gateway.ts signatures
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CrashGateway } from './crash.gateway';
import { CrashService, GameState } from './crash.service';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import Decimal from 'decimal.js';

// ============================================
// MOCK SETUP
// ============================================

const createMockSocket = (id: string = 'socket-1', userId?: string, isGuest: boolean = false): any => ({
  id,
  data: { userId: userId || 'user-1', username: 'testuser' },
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  rooms: new Set(['crash']),
  handshake: isGuest ? { auth: {}, headers: {} } : {
    auth: { token: 'valid-token' },
    headers: {},
    time: new Date().toString(),
    address: '127.0.0.1',
    xdomain: false,
    secure: false,
    issued: Date.now(),
    url: '/',
    query: {},
  },
  disconnect: jest.fn(),
});

const createMockServer = (): Partial<Server> => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  in: jest.fn().mockReturnThis(),
  socketsJoin: jest.fn(),
  socketsLeave: jest.fn(),
});

const createMockCrashService = () => ({
  placeBet: jest.fn().mockResolvedValue({ 
    success: true, 
    bet: { id: 'bet-1', amount: new Decimal(100) } 
  }),
  cashout: jest.fn().mockResolvedValue({ 
    success: true, 
    multiplier: new Decimal(2.0), 
    profit: new Decimal(100) 
  }),
  cancelBet: jest.fn().mockResolvedValue({ success: true }),
  getCurrentRound: jest.fn().mockReturnValue({
    state: 'WAITING' as GameState,
    gameNumber: 1,
    serverSeedHash: 'hash123',
    clientSeed: 'seed123',
    currentMultiplier: new Decimal(1.0),
  }),
  getCrashHistory: jest.fn().mockReturnValue([]),
  setEventEmitter: jest.fn(),
  startGameLoop: jest.fn(),
  stopGameLoop: jest.fn(),
});

const createMockJwtService = () => ({
  verify: jest.fn().mockReturnValue({ sub: 'user-1', username: 'testuser', role: 'USER' }),
  sign: jest.fn().mockReturnValue('signed-token'),
});

const createMockEventEmitter = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
});

describe('🔌 Crash Gateway Unit Tests', () => {
  let gateway: CrashGateway;
  let crashService: ReturnType<typeof createMockCrashService>;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;
  let mockServer: ReturnType<typeof createMockServer>;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(async () => {
    crashService = createMockCrashService();
    jwtService = createMockJwtService();
    eventEmitter = createMockEventEmitter();
    mockServer = createMockServer();
    mockSocket = createMockSocket();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashGateway,
        { provide: CrashService, useValue: crashService },
        { provide: JwtService, useValue: jwtService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    gateway = module.get<CrashGateway>(CrashGateway);
    gateway.server = mockServer as unknown as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // LIFECYCLE TESTS
  // ============================================

  describe('🚀 Lifecycle Tests', () => {
    it('Should initialize gateway', () => {
      expect(gateway).toBeDefined();
    });

    it('Should call afterInit and set event emitter', () => {
      gateway.afterInit(mockServer as unknown as Server);
      expect(crashService.setEventEmitter).toHaveBeenCalled();
    });

    it('Should handle connection with valid token', () => {
      gateway.handleConnection(mockSocket as unknown as Socket);
      expect(jwtService.verify).toHaveBeenCalled();
    });

    it('Should handle disconnection', () => {
      gateway.handleDisconnect(mockSocket as unknown as Socket);
      // Should not throw
      expect(true).toBe(true);
    });

    it('Should handle connection with invalid token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      gateway.handleConnection(mockSocket as unknown as Socket);
      
      // Should emit auth error but not disconnect
      expect(mockSocket.emit).toHaveBeenCalledWith('auth:error', expect.any(Object));
    });

    it('Should handle guest connection without token', () => {
      const guestSocket = createMockSocket('guest-1', undefined, true);
      
      gateway.handleConnection(guestSocket as unknown as Socket);
      
      expect(guestSocket.emit).toHaveBeenCalledWith('auth:guest', expect.any(Object));
    });
  });

  // ============================================
  // BET PLACEMENT TESTS
  // ============================================

  describe('💰 Bet Placement Tests', () => {
    beforeEach(() => {
      // Simulate authenticated user
      gateway.handleConnection(mockSocket as unknown as Socket);
    });

    it('Should place bet successfully', async () => {
      const payload = { amount: 100 };
      
      await gateway.handlePlaceBet(mockSocket as unknown as Socket, payload);
      
      expect(crashService.placeBet).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:bet_placed', expect.any(Object));
    });

    it('Should place bet with auto-cashout', async () => {
      const payload = { amount: 100, autoCashoutAt: 2.0 };
      
      await gateway.handlePlaceBet(mockSocket as unknown as Socket, payload);
      
      expect(crashService.placeBet).toHaveBeenCalled();
    });

    it('Should emit error on bet failure', async () => {
      crashService.placeBet.mockResolvedValue({ success: false, error: 'Insufficient funds' });
      
      const payload = { amount: 100 };
      await gateway.handlePlaceBet(mockSocket as unknown as Socket, payload);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:error', expect.any(Object));
    });

    it('Should reject bet from unauthenticated user', async () => {
      const guestSocket = createMockSocket('guest-1', undefined, true);
      
      // Connect as guest
      jwtService.verify.mockImplementation(() => { throw new Error('No token'); });
      gateway.handleConnection(guestSocket as unknown as Socket);
      
      const payload = { amount: 100 };
      await gateway.handlePlaceBet(guestSocket as unknown as Socket, payload);
      
      expect(guestSocket.emit).toHaveBeenCalledWith('crash:error', expect.any(Object));
    });
  });

  // ============================================
  // CASHOUT TESTS
  // ============================================

  describe('💸 Cashout Tests', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as unknown as Socket);
    });

    it('Should cashout successfully', async () => {
      await gateway.handleCashout(mockSocket as unknown as Socket);
      
      expect(crashService.cashout).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:cashout', expect.objectContaining({
        success: true,
      }));
    });

    it('Should emit error on cashout failure', async () => {
      crashService.cashout.mockResolvedValue({ success: false, error: 'No active bet' });
      
      await gateway.handleCashout(mockSocket as unknown as Socket);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:cashout', expect.objectContaining({
        success: false,
      }));
    });

    it('Should reject cashout from unauthenticated user', async () => {
      const guestSocket = createMockSocket('guest-1', undefined, true);
      
      jwtService.verify.mockImplementation(() => { throw new Error('No token'); });
      gateway.handleConnection(guestSocket as unknown as Socket);
      
      await gateway.handleCashout(guestSocket as unknown as Socket);
      
      expect(guestSocket.emit).toHaveBeenCalledWith('crash:error', expect.any(Object));
    });
  });

  // ============================================
  // CHAT TESTS
  // ============================================

  describe('💬 Chat Tests', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as unknown as Socket);
    });

    it('Should join chat room', () => {
      gateway.handleChatJoin(mockSocket as unknown as Socket, { room: 'global' });
      
      expect(mockSocket.join).toHaveBeenCalledWith('chat:global');
    });

    it('Should send chat message', () => {
      gateway.handleChatSend(mockSocket as unknown as Socket, { room: 'global', message: 'Hello!' });
      
      expect(mockServer.emit).toHaveBeenCalledWith('chat:message', expect.any(Object));
    });

    it('Should reject empty chat message', () => {
      gateway.handleChatSend(mockSocket as unknown as Socket, { room: 'global', message: '' });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('chat:error', expect.any(Object));
    });

    it('Should reject chat from unauthenticated user', () => {
      const guestSocket = createMockSocket('guest-1', undefined, true);
      
      jwtService.verify.mockImplementation(() => { throw new Error('No token'); });
      gateway.handleConnection(guestSocket as unknown as Socket);
      
      gateway.handleChatSend(guestSocket as unknown as Socket, { room: 'global', message: 'Hello!' });
      
      expect(guestSocket.emit).toHaveBeenCalledWith('chat:error', expect.any(Object));
    });
  });

  // ============================================
  // EVENT HANDLING TESTS
  // ============================================

  describe('📡 Event Handling Tests', () => {
    it('Should handle tick event', () => {
      const tickData = { multiplier: '1.50', elapsed: 1000 };
      
      gateway.handleTickEvent(tickData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('crash:tick', tickData);
    });

    it('Should handle state change event', () => {
      const stateData = {
        state: 'RUNNING' as GameState,
        round: { 
          gameNumber: 1, 
          serverSeedHash: 'hash',
          clientSeed: 'seed',
          currentMultiplier: new Decimal(1.5),
        },
      };

      gateway.handleStateChangeEvent(stateData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('crash:state_change', expect.any(Object));
    });

    it('Should handle crashed event', () => {
      const crashData = { crashPoint: '2.50', gameNumber: 1 };
      
      gateway.handleCrashedEvent(crashData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('crash:crashed', crashData);
    });

    it('Should handle cashout event', () => {
      const cashoutData = { 
        userId: 'user-1',
        multiplier: '2.00',
        profit: '100',
      };
      
      gateway.handleCashoutEvent(cashoutData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('crash:cashout', expect.any(Object));
    });
  });

  // ============================================
  // BOT EVENT HANDLING TESTS
  // ============================================

  describe('🤖 Bot Event Handling Tests', () => {
    it('Should handle bot bet placed event', () => {
      const botBetData = {
        userId: 'bot-1',
        username: 'bot_player',
        amount: 50,
        targetCashout: 2.0,
        isBot: true,
      };

      gateway.handleBotBetPlaced(botBetData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('crash:bet_placed', expect.any(Object));
    });

    it('Should handle bot cashout event', () => {
      const botCashoutData = {
        userId: 'bot-1',
        username: 'bot_player',
        multiplier: 2.0,
        profit: 50,
        amount: 50,
        isBot: true,
      };

      gateway.handleBotCashout(botCashoutData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('crash:cashout', expect.any(Object));
    });

    it('Should handle bot chat message event', () => {
      const botChatData = {
        username: 'bot_player',
        message: 'Nice win!',
        timestamp: new Date(),
      };

      gateway.handleBotChatMessage(botChatData);
      
      expect(mockServer.emit).toHaveBeenCalledWith('chat:message', expect.any(Object));
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('⚠️ Error Handling Tests', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as unknown as Socket);
    });

    it('Should handle bet failure response', async () => {
      crashService.placeBet.mockResolvedValue({ success: false, error: 'Service unavailable' });
      
      const payload = { amount: 100 };
      await gateway.handlePlaceBet(mockSocket as unknown as Socket, payload);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:error', expect.any(Object));
    });

    it('Should handle cashout failure response', async () => {
      crashService.cashout.mockResolvedValue({ success: false, error: 'Service unavailable' });
      
      await gateway.handleCashout(mockSocket as unknown as Socket);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:cashout', expect.objectContaining({ success: false }));
    });
  });

  // ============================================
  // CONCURRENT OPERATIONS TESTS
  // ============================================

  describe('👥 Concurrent Operations Tests', () => {
    it('Should handle multiple connections', () => {
      const sockets = Array.from({ length: 10 }, (_, i) => 
        createMockSocket(`socket-${i}`, `user-${i}`)
      );

      sockets.forEach(socket => {
        gateway.handleConnection(socket as unknown as Socket);
      });

      // All should be connected
      expect(jwtService.verify).toHaveBeenCalledTimes(10);
    });

    it('Should handle multiple disconnections', () => {
      const sockets = Array.from({ length: 5 }, (_, i) => 
        createMockSocket(`socket-${i}`, `user-${i}`)
      );

      sockets.forEach(socket => {
        gateway.handleConnection(socket as unknown as Socket);
        gateway.handleDisconnect(socket as unknown as Socket);
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
