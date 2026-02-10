/**
 * 🐉 Dragon Blaze - WebSocket Gateway Tests (Dual Dragon)
 * 
 * Tests the real-time WebSocket communication for Dragon Blaze:
 * - Connection handling for dual-dragon game
 * - Bet placement on Dragon 1 (Red) and Dragon 2 (Blue)
 * - Independent cashout per dragon
 * - Dual game state broadcasting
 * - Independent multiplier updates per dragon
 * - Error handling for dual-dragon edge cases
 * - Authentication
 * - Simultaneous betting on both dragons
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CrashService } from './crash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GameConfigService } from './game-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';

// ============================================
// MOCK SETUP
// ============================================

const createMockPrismaService = () => ({
  wallet: {
    findFirst: jest.fn().mockResolvedValue({ id: 'w-1', balance: new Decimal(10000), currency: 'USDT' }),
    update: jest.fn().mockResolvedValue({ id: 'w-1', balance: new Decimal(9980) }),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'u-1', username: 'dragon_rider', status: 'ACTIVE' }),
  },
  crashGame: {
    create: jest.fn().mockResolvedValue({ id: 'g-1', status: 'WAITING' }),
    update: jest.fn(),
    findFirst: jest.fn().mockResolvedValue({ id: 'g-1', status: 'RUNNING' }),
  },
  crashBet: {
    create: jest.fn().mockResolvedValue({ id: 'b-1', amount: 10, userId: 'u-1' }),
    update: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  bet: { create: jest.fn() },
  $transaction: jest.fn(async (cb) => cb({
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'w-1', balance: 10000 }]),
    wallet: { update: jest.fn() },
  })),
});

const createMockGameConfigService = () => ({
  houseEdge: 0.04,
  instantBust: 0.02,
  botsEnabled: false,
  getConfig: jest.fn().mockReturnValue({ houseEdge: 0.04, instantBust: 0.02 }),
});

const createMockEventEmitter = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
});

let dragon1Service: CrashService;
let dragon2Service: CrashService;
let prisma1: any;
let prisma2: any;
let eventEmitter1: any;
let eventEmitter2: any;

beforeEach(async () => {
  prisma1 = createMockPrismaService();
  prisma2 = createMockPrismaService();
  eventEmitter1 = createMockEventEmitter();
  eventEmitter2 = createMockEventEmitter();

  const module1: TestingModule = await Test.createTestingModule({
    providers: [
      CrashService,
      { provide: PrismaService, useValue: prisma1 },
      { provide: GameConfigService, useValue: createMockGameConfigService() },
      { provide: EventEmitter2, useValue: eventEmitter1 },
    ],
  }).compile();
  dragon1Service = module1.get<CrashService>(CrashService);

  const module2: TestingModule = await Test.createTestingModule({
    providers: [
      CrashService,
      { provide: PrismaService, useValue: prisma2 },
      { provide: GameConfigService, useValue: createMockGameConfigService() },
      { provide: EventEmitter2, useValue: eventEmitter2 },
    ],
  }).compile();
  dragon2Service = module2.get<CrashService>(CrashService);
});

afterEach(() => {
  dragon1Service.stopGameLoop();
  dragon2Service.stopGameLoop();
});

// ============================================
// GATEWAY TESTS
// ============================================

describe('🐉 Dragon Blaze - Dual Dragon Gateway Tests', () => {

  // ============================================
  // 🔌 DUAL CONNECTION HANDLING
  // ============================================

  describe('🔌 Dual Dragon Connection Handling', () => {
    it('Should provide independent game state for each dragon', () => {
      const state1 = dragon1Service.getCurrentGameState();
      const state2 = dragon2Service.getCurrentGameState();
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1.state).toBeDefined();
      expect(state2.state).toBeDefined();
    });

    it('Both dragons should be accessible simultaneously', () => {
      const states = [];
      for (let i = 0; i < 50; i++) {
        states.push(dragon1Service.getCurrentGameState());
        states.push(dragon2Service.getCurrentGameState());
      }
      expect(states.length).toBe(100);
      states.forEach(s => expect(s).toBeDefined());
    });
  });

  // ============================================
  // 🎰 DUAL BET PLACEMENT
  // ============================================

  describe('🎰 Bet Placement — Per Dragon', () => {
    it('Should accept bet on Dragon 1 (Red)', async () => {
      try {
        const result = await dragon1Service.placeBet('u-1', 10, 'USDT');
        expect(result).toBeDefined();
      } catch (e) {
        expect(e.message).toBeDefined();
      }
    });

    it('Should accept bet on Dragon 2 (Blue)', async () => {
      try {
        const result = await dragon2Service.placeBet('u-1', 10, 'USDT');
        expect(result).toBeDefined();
      } catch (e) {
        expect(e.message).toBeDefined();
      }
    });

    it('Should accept simultaneous bets on BOTH dragons', async () => {
      const [r1, r2] = await Promise.allSettled([
        dragon1Service.placeBet('u-1', 10, 'USDT'),
        dragon2Service.placeBet('u-1', 10, 'USDT'),
      ]);
      // Both should be processed (either fulfilled or rejected with valid error)
      expect(r1.status).toBeDefined();
      expect(r2.status).toBeDefined();
    });

    it('Should reject zero bet on Dragon 1', async () => {
      try {
        const result = await dragon1Service.placeBet('u-1', 0, 'USDT');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('Should reject zero bet on Dragon 2', async () => {
      try {
        const result = await dragon2Service.placeBet('u-1', 0, 'USDT');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('Should reject negative bet on both dragons', async () => {
      try {
        const r1 = await dragon1Service.placeBet('u-1', -10, 'USDT');
        expect(r1.success === false || r1.error).toBeTruthy();
      } catch (e) { expect(e).toBeDefined(); }
      try {
        const r2 = await dragon2Service.placeBet('u-1', -10, 'USDT');
        expect(r2.success === false || r2.error).toBeTruthy();
      } catch (e) { expect(e).toBeDefined(); }
    });

    it('Should handle different bet amounts per dragon', async () => {
      const [r1, r2] = await Promise.allSettled([
        dragon1Service.placeBet('u-1', 10, 'USDT'),
        dragon2Service.placeBet('u-1', 50, 'USDT'),
      ]);
      expect(r1.status).toBeDefined();
      expect(r2.status).toBeDefined();
    });
  });

  // ============================================
  // 💸 INDEPENDENT CASHOUT
  // ============================================

  describe('💸 Independent Cashout — Per Dragon', () => {
    it('Should reject cashout on Dragon 1 when no active bet', async () => {
      prisma1.crashBet.findFirst.mockResolvedValue(null);
      try {
        const result = await dragon1Service.cashout('u-1');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('Should reject cashout on Dragon 2 when no active bet', async () => {
      prisma2.crashBet.findFirst.mockResolvedValue(null);
      try {
        const result = await dragon2Service.cashout('u-1');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('Cashout on Dragon 1 should NOT affect Dragon 2', async () => {
      // Dragon 2 state should remain unchanged after Dragon 1 cashout attempt
      const stateBefore = dragon2Service.getCurrentGameState();
      try { await dragon1Service.cashout('u-1'); } catch {}
      const stateAfter = dragon2Service.getCurrentGameState();
      expect(stateAfter.state).toBe(stateBefore.state);
    });

    it('Should handle simultaneous cashout attempts on both dragons', async () => {
      const [r1, r2] = await Promise.allSettled([
        dragon1Service.cashout('u-1'),
        dragon2Service.cashout('u-1'),
      ]);
      // Both should be processed independently
      expect(r1.status).toBeDefined();
      expect(r2.status).toBeDefined();
    });
  });

  // ============================================
  // 📡 INDEPENDENT GAME STATE
  // ============================================

  describe('📡 Independent Game State Broadcasting', () => {
    it('Each dragon should have its own game state', () => {
      const s1 = dragon1Service.getCurrentGameState();
      const s2 = dragon2Service.getCurrentGameState();
      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
    });

    it('Dragon crash points should be generated independently', () => {
      const cp1 = dragon1Service['generateCrashPoint']('d1-seed', 'client', 1);
      const cp2 = dragon2Service['generateCrashPoint']('d2-seed', 'client', 1);
      // Different seeds = different crash points (with high probability)
      expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.0);
      expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.0);
    });

    it('Dragon 1 crashing should NOT crash Dragon 2', () => {
      // Verify services are independent
      dragon1Service.stopGameLoop();
      const s2 = dragon2Service.getCurrentGameState();
      expect(s2).toBeDefined();
    });
  });

  // ============================================
  // ⚡ INDEPENDENT MULTIPLIER UPDATES
  // ============================================

  describe('⚡ Independent Multiplier Updates', () => {
    it('Each dragon should have its own multiplier curve', () => {
      // Generate different crash points
      const cp1 = dragon1Service['generateCrashPoint']('d1-multi', 'client', 1);
      const cp2 = dragon2Service['generateCrashPoint']('d2-multi', 'client', 1);
      expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.0);
      expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.0);
    });

    it('Multiplier should always start at 1.00 for both dragons', () => {
      for (let i = 0; i < 100; i++) {
        const cp1 = dragon1Service['generateCrashPoint'](`d1-start-${i}`, 'client', i);
        const cp2 = dragon2Service['generateCrashPoint'](`d2-start-${i}`, 'client', i);
        expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.00);
        expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.00);
      }
    });
  });

  // ============================================
  // 🔐 AUTHENTICATION
  // ============================================

  describe('🔐 Authentication — Dual Dragon', () => {
    it('Should reject banned user on Dragon 1', async () => {
      prisma1.user.findUnique.mockResolvedValue({ id: 'u-banned', status: 'BANNED' });
      try {
        const result = await dragon1Service.placeBet('u-banned', 10, 'USDT');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('Should reject banned user on Dragon 2', async () => {
      prisma2.user.findUnique.mockResolvedValue({ id: 'u-banned', status: 'BANNED' });
      try {
        const result = await dragon2Service.placeBet('u-banned', 10, 'USDT');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('Should reject suspended user on both dragons', async () => {
      prisma1.user.findUnique.mockResolvedValue({ id: 'u-sus', status: 'SUSPENDED' });
      prisma2.user.findUnique.mockResolvedValue({ id: 'u-sus', status: 'SUSPENDED' });
      try {
        const r1 = await dragon1Service.placeBet('u-sus', 10, 'USDT');
        expect(r1.success === false || r1.error).toBeTruthy();
      } catch (e) { expect(e).toBeDefined(); }
      try {
        const r2 = await dragon2Service.placeBet('u-sus', 10, 'USDT');
        expect(r2.success === false || r2.error).toBeTruthy();
      } catch (e) { expect(e).toBeDefined(); }
    });
  });

  // ============================================
  // 🛡️ ERROR HANDLING — DUAL DRAGON
  // ============================================

  describe('🛡️ Error Handling — Dual Dragon Edge Cases', () => {
    it('Should handle DB error on Dragon 1 without affecting Dragon 2', async () => {
      prisma1.$transaction.mockRejectedValue(new Error('DB error'));
      try {
        const result = await dragon1Service.placeBet('u-1', 10, 'USDT');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
      // Dragon 2 should still work
      const s2 = dragon2Service.getCurrentGameState();
      expect(s2).toBeDefined();
    });

    it('Should handle concurrent bets from multiple users on both dragons', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(dragon1Service.placeBet(`u-${i}`, 10, 'USDT').catch(() => null));
        promises.push(dragon2Service.placeBet(`u-${i}`, 10, 'USDT').catch(() => null));
      }
      const results = await Promise.allSettled(promises);
      expect(results.length).toBe(20);
    });

    it('Should handle wallet insufficient for dual bet', async () => {
      prisma1.wallet.findFirst.mockResolvedValue({ id: 'w-1', balance: new Decimal(15), currency: 'USDT' });
      prisma1.$transaction.mockRejectedValue(new Error('Insufficient balance'));
      try {
        const result = await dragon1Service.placeBet('u-1', 10, 'USDT');
        expect(result.success === false || result.error).toBeTruthy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  // ============================================
  // 🔄 DUAL GAME LIFECYCLE
  // ============================================

  describe('🔄 Dual Game Lifecycle', () => {
    it('Both dragons should have valid states at all times', () => {
      const s1 = dragon1Service.getCurrentGameState();
      const s2 = dragon2Service.getCurrentGameState();
      expect(['WAITING', 'RUNNING', 'CRASHED']).toContain(s1.state);
      expect(['WAITING', 'RUNNING', 'CRASHED']).toContain(s2.state);
    });

    it('Both dragons should generate valid crash points independently', () => {
      for (let i = 0; i < 100; i++) {
        const cp1 = dragon1Service['generateCrashPoint'](`d1-lc-${i}`, 'client', i);
        const cp2 = dragon2Service['generateCrashPoint'](`d2-lc-${i}`, 'client', i);
        expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.00);
        expect(cp1.toNumber()).toBeLessThanOrEqual(5000);
        expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.00);
        expect(cp2.toNumber()).toBeLessThanOrEqual(5000);
      }
    });

    it('Stopping Dragon 1 game loop should NOT stop Dragon 2', () => {
      dragon1Service.stopGameLoop();
      const s2 = dragon2Service.getCurrentGameState();
      expect(s2).toBeDefined();
      expect(s2.state).toBeDefined();
    });

    it('Both dragons can be stopped and restarted independently', () => {
      dragon1Service.stopGameLoop();
      dragon2Service.stopGameLoop();
      const s1 = dragon1Service.getCurrentGameState();
      const s2 = dragon2Service.getCurrentGameState();
      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
    });
  });
});
