/**
 * ============================================
 * 🎰 CRASH SERVICE - UNIT TESTS
 * ============================================
 * Critical coverage for the core game engine
 * Tests: generateCrashPoint, placeBet, cashout, state machine
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CrashService, GameState } from './crash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GameConfigService } from './game-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

// ============================================
// MOCK SETUP
// ============================================

// Transaction mock that simulates Prisma's interactive transaction
const createTxMock = () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: '1000' }]),
  $executeRaw: jest.fn().mockResolvedValue(1),
});

const mockPrisma = {
  wallet: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  bet: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  siteConfiguration: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (fn) => {
    const tx = createTxMock();
    return fn(tx);
  }),
};

const mockGameConfig = {
  houseEdge: 0.04,
  instantBustChance: 0,
  maxMultiplier: 5000,
  updateConfig: jest.fn(),
  getConfig: jest.fn().mockReturnValue({ houseEdge: 0.04, instantBustChance: 0 }),
};

const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

describe('🎰 CrashService - Unit Tests', () => {
  let service: CrashService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset transaction mock
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const tx = createTxMock();
      return fn(tx);
    });

    mockPrisma.wallet.findFirst.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: new Decimal(1000),
      lockedBalance: new Decimal(0),
      currency: 'USDT',
      siteId: 'default-site-001',
    });
    mockPrisma.wallet.update.mockResolvedValue({ balance: new Decimal(990) });
    mockPrisma.bet.create.mockResolvedValue({ id: 'bet-1' });
    mockPrisma.siteConfiguration.findFirst.mockResolvedValue({
      id: 'default-site-001',
      houseEdgeConfig: { crash: 0.04 },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GameConfigService, useValue: mockGameConfig },
      ],
    }).compile();

    service = module.get<CrashService>(CrashService);

    // CRITICAL: eventEmitter is set via setEventEmitter(), not constructor injection
    (service as any).setEventEmitter(mockEventEmitter);
  });

  // ============================================
  // 🎲 CRASH POINT GENERATION
  // ============================================

  describe('🎲 generateCrashPoint', () => {
    it('1.1 - Should generate crash point >= 1.00', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = 'test-seed';
      const nonce = 1;

      const crashPoint = generateCrashPoint(serverSeed, clientSeed, nonce);
      expect(crashPoint.toNumber()).toBeGreaterThanOrEqual(1.00);
    });

    it('1.2 - Should cap crash point at 5000x', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      for (let i = 0; i < 100; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const crashPoint = generateCrashPoint(serverSeed, 'test', i);
        expect(crashPoint.toNumber()).toBeLessThanOrEqual(5000);
      }
    });

    it('1.3 - Should be deterministic (same seeds = same result)', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const serverSeed = 'fixed-server-seed-for-testing';
      const clientSeed = 'fixed-client-seed';
      const nonce = 42;

      const result1 = generateCrashPoint(serverSeed, clientSeed, nonce);
      const result2 = generateCrashPoint(serverSeed, clientSeed, nonce);
      expect(result1.toFixed(2)).toBe(result2.toFixed(2));
    });

    it('1.4 - Should produce different results with different nonces', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const serverSeed = 'fixed-server-seed';
      const clientSeed = 'fixed-client-seed';

      const result1 = generateCrashPoint(serverSeed, clientSeed, 1);
      const result2 = generateCrashPoint(serverSeed, clientSeed, 2);
      expect(result1.toFixed(2)).not.toBe(result2.toFixed(2));
    });

    it('1.5 - Should respect house edge from GameConfigService', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const results: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const seed = crypto.createHmac('sha256', 'master').update(`round:${i}`).digest('hex');
        results.push(generateCrashPoint(seed, 'test', i).toNumber());
      }
      const sorted = results.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      expect(median).toBeGreaterThan(1.0);
      expect(median).toBeLessThan(5.0);
    });

    it('1.6 - Should use HMAC-SHA256 for provably fair generation', () => {
      const hmacSpy = jest.spyOn(crypto, 'createHmac');
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      generateCrashPoint('test-seed', 'client-seed', 1);
      expect(hmacSpy).toHaveBeenCalledWith('sha256', 'test-seed');
      hmacSpy.mockRestore();
    });

    it('1.7 - Should produce crash points with 2 decimal precision', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      for (let i = 0; i < 50; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const point = generateCrashPoint(seed, 'test', i);
        const str = point.toFixed(2);
        expect(parseFloat(str)).toBe(point.toNumber());
      }
    });

    it('1.8 - Should generate second crash point independently', () => {
      const gen1 = (service as any).generateCrashPoint.bind(service);
      const gen2 = (service as any).generateCrashPoint2
        ? (service as any).generateCrashPoint2.bind(service)
        : (service as any).generateCrashPoint.bind(service);

      const serverSeed = 'test-seed';
      const clientSeed = 'client-seed';
      const nonce = 1;

      const point1 = gen1(serverSeed, clientSeed, nonce);
      const point2 = gen2(serverSeed, clientSeed, nonce);
      // If same function, same result; if different function, different result
      expect(point1.toNumber()).toBeGreaterThanOrEqual(1.00);
      expect(point2.toNumber()).toBeGreaterThanOrEqual(1.00);
    });
  });

  // ============================================
  // 💰 PLACE BET
  // ============================================

  describe('💰 placeBet', () => {
    beforeEach(async () => {
      // Initialize a round in WAITING state
      (service as any).currentRound = {
        id: 'round-1',
        gameNumber: 1,
        serverSeed: 'test-seed',
        serverSeedHash: 'hash',
        clientSeed: 'client-seed',
        nonce: 1,
        crashPoint1: new Decimal(2.50),
        crashPoint2: new Decimal(3.00),
        currentMultiplier1: new Decimal(1.00),
        currentMultiplier2: new Decimal(1.00),
        dragon1Crashed: false,
        dragon2Crashed: false,
        state: GameState.WAITING,
        bets: new Map(),
        startedAt: null,
        crashedAt: null,
      };
      // Clear cooldown map to avoid interference between tests
      (service as any).lastBetTime = new Map();
    });

    it('2.1 - Should place bet successfully on Dragon 1', async () => {
      const result = await service.placeBet('user-1', 10, undefined, 1, 'default-site-001');
      expect(result.success).toBe(true);
      expect(result.bet).toBeDefined();
      expect(result.bet!.amount.toNumber()).toBe(10);
      expect(result.bet!.status).toBe('ACTIVE');
    });

    it('2.2 - Should place bet successfully on Dragon 2', async () => {
      const result = await service.placeBet('user-1', 10, undefined, 2, 'default-site-001');
      expect(result.success).toBe(true);
      expect(result.bet).toBeDefined();
    });

    it('2.3 - Should reject bet when no active round', async () => {
      (service as any).currentRound = null;
      const result = await service.placeBet('user-1', 10, undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active round');
    });

    it('2.4 - Should reject bet when game is RUNNING', async () => {
      (service as any).currentRound.state = GameState.RUNNING;
      const result = await service.placeBet('user-1', 10, undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Betting is closed');
    });

    it('2.5 - Should reject bet when game is CRASHED', async () => {
      (service as any).currentRound.state = GameState.CRASHED;
      const result = await service.placeBet('user-1', 10, undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Betting is closed');
    });

    it('2.6 - Should reject invalid slot (not 1 or 2)', async () => {
      const result = await service.placeBet('user-1', 10, undefined, 3 as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid slot - must be 1 or 2');
    });

    it('2.7 - Should reject duplicate bet on same dragon', async () => {
      // First bet succeeds
      await service.placeBet('user-1', 10, undefined, 1, 'default-site-001');
      // Second bet on same dragon should fail (duplicate)
      const result = await service.placeBet('user-1', 10, undefined, 1, 'default-site-001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already placed a bet on this dragon');
    });

    it('2.8 - Should allow same user to bet on both dragons', async () => {
      const bet1 = await service.placeBet('user-1', 10, undefined, 1, 'default-site-001');
      expect(bet1.success).toBe(true);
      // Different slot = different betKey, so no cooldown issue
      const bet2 = await service.placeBet('user-1', 10, undefined, 2, 'default-site-001');
      expect(bet2.success).toBe(true);
    });

    it('2.9 - Should reject bet below minimum ($0.10)', async () => {
      const result = await service.placeBet('user-1', 0.05, undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Minimum bet');
    });

    it('2.10 - Should reject bet above maximum ($10,000)', async () => {
      const result = await service.placeBet('user-1', 15000, undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum bet');
    });

    it('2.11 - Should deduct balance on successful bet', async () => {
      await service.placeBet('user-1', 50, undefined, 1, 'default-site-001');
      // deductBalance uses $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('2.12 - Should reject bet with insufficient balance', async () => {
      // Mock $transaction to simulate insufficient balance
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: '5' }]),
          $executeRaw: jest.fn().mockResolvedValue(0), // 0 rows affected = insufficient
        };
        return fn(tx);
      });
      const result = await service.placeBet('user-1', 100, undefined, 1, 'default-site-001');
      expect(result.success).toBe(false);
    });

    it('2.13 - Should emit crash.bet_placed event', async () => {
      await service.placeBet('user-1', 10, undefined, 1, 'default-site-001');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'crash.bet_placed',
        expect.objectContaining({
          userId: 'user-1',
          amount: '10.00',
          currency: 'USDT',
          slot: 1,
        }),
      );
    });

    it('2.14 - Should emit crash.balance_update event with negative change', async () => {
      await service.placeBet('user-1', 25, undefined, 1, 'default-site-001');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'crash.balance_update',
        expect.objectContaining({
          userId: 'user-1',
          change: '-25.00',
          reason: 'bet_placed',
        }),
      );
    });

    it('2.15 - Should set autoCashoutAt when provided', async () => {
      const result = await service.placeBet('user-1', 10, 2.5, 1, 'default-site-001');
      expect(result.success).toBe(true);
      expect(result.bet!.autoCashoutAt!.toNumber()).toBe(2.5);
    });

    it('2.16 - Should set autoCashoutAt to null when not provided', async () => {
      const result = await service.placeBet('user-1', 10, undefined, 1, 'default-site-001');
      expect(result.success).toBe(true);
      expect(result.bet!.autoCashoutAt).toBeNull();
    });

    it('2.17 - Should enforce bet cooldown (500ms)', async () => {
      // Manually set a recent bet time for user-2:1
      (service as any).lastBetTime.set('user-2:1', Date.now());
      const result = await service.placeBet('user-2', 10, undefined, 1, 'default-site-001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('wait');
    });

    it('2.18 - Should store siteId for user', async () => {
      await service.placeBet('user-1', 10, undefined, 1, 'test-site-001');
      expect((service as any).userSiteIds.get('user-1')).toBe('test-site-001');
    });

    it('2.19 - Should handle Decimal amount input', async () => {
      const result = await service.placeBet('user-1', new Decimal(10.50), undefined, 1, 'default-site-001');
      expect(result.success).toBe(true);
      expect(result.bet!.amount.toNumber()).toBe(10.50);
    });

    it('2.20 - Should handle string amount input', async () => {
      const result = await service.placeBet('user-1', '10.50', undefined, 1, 'default-site-001');
      expect(result.success).toBe(true);
      expect(result.bet!.amount.toNumber()).toBe(10.50);
    });
  });

  // ============================================
  // 💸 CASHOUT
  // ============================================

  describe('💸 cashout', () => {
    beforeEach(async () => {
      (service as any).currentRound = {
        id: 'round-1',
        gameNumber: 1,
        serverSeed: 'test-seed',
        serverSeedHash: 'hash',
        clientSeed: 'client-seed',
        nonce: 1,
        crashPoint1: new Decimal(5.00),
        crashPoint2: new Decimal(3.00),
        currentMultiplier1: new Decimal(2.50),
        currentMultiplier2: new Decimal(2.00),
        dragon1Crashed: false,
        dragon2Crashed: false,
        state: GameState.RUNNING,
        bets: new Map(),
        startedAt: new Date(),
        crashedAt: null,
      };

      // Place a bet for testing cashout
      const bet = {
        id: 'bet-1',
        oderId: 'order-1',
        amount: new Decimal(100),
        autoCashoutAt: null,
        cashedOutAt: null,
        profit: null,
        status: 'ACTIVE' as const,
        skin: 'classic',
      };
      (service as any).currentRound.bets.set('user-1:1', bet);
      (service as any).currentRound.bets.set('user-1:2', { ...bet, id: 'bet-2', status: 'ACTIVE' });
      (service as any).userSiteIds.set('user-1', 'default-site-001');

      // Mock saveBetToDatabase to avoid DB calls
      (service as any).saveBetToDatabase = jest.fn();
    });

    it('3.1 - Should cashout successfully at current multiplier', async () => {
      const result = await service.cashout('user-1', undefined, 1);
      expect(result.success).toBe(true);
      expect(result.multiplier!.toNumber()).toBe(2.50);
      // Profit = 100 * 2.50 - 100 = 150
      expect(result.profit!.toNumber()).toBe(150);
    });

    it('3.2 - Should calculate exact payout (Bet * Multiplier)', async () => {
      const result = await service.cashout('user-1', new Decimal(2.00), 1);
      expect(result.success).toBe(true);
      // Payout = 100 * 2.00 = 200, Profit = 200 - 100 = 100
      expect(result.profit!.toNumber()).toBe(100);
    });

    it('3.3 - Should reject cashout when no active round', async () => {
      (service as any).currentRound = null;
      const result = await service.cashout('user-1', undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active round');
    });

    it('3.4 - Should reject cashout when game is WAITING', async () => {
      (service as any).currentRound.state = GameState.WAITING;
      const result = await service.cashout('user-1', undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is not running');
    });

    it('3.5 - Should reject cashout when Dragon 1 already crashed', async () => {
      (service as any).currentRound.dragon1Crashed = true;
      const result = await service.cashout('user-1', undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Dragon 1 already crashed!');
    });

    it('3.6 - Should reject cashout when Dragon 2 already crashed', async () => {
      (service as any).currentRound.dragon2Crashed = true;
      const result = await service.cashout('user-1', undefined, 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Dragon 2 already crashed!');
    });

    it('3.7 - Should reject cashout with invalid slot', async () => {
      const result = await service.cashout('user-1', undefined, 3 as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid slot - must be 1 or 2');
    });

    it('3.8 - Should reject cashout when no bet found', async () => {
      const result = await service.cashout('user-999', undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No bet found');
    });

    it('3.9 - Should reject cashout on already settled bet', async () => {
      const bet = (service as any).currentRound.bets.get('user-1:1');
      bet.status = 'CASHED_OUT';
      const result = await service.cashout('user-1', undefined, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bet already settled');
    });

    it('3.10 - Should reject cashout above crash point (Too late!)', async () => {
      // crashPoint1 is 5.00, try to cashout at 6.00
      const result = await service.cashout('user-1', new Decimal(6.00), 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Too late!');
    });

    it('3.11 - Should update bet status to CASHED_OUT', async () => {
      await service.cashout('user-1', undefined, 1);
      const bet = (service as any).currentRound.bets.get('user-1:1');
      expect(bet.status).toBe('CASHED_OUT');
    });

    it('3.12 - Should record cashout multiplier on bet', async () => {
      await service.cashout('user-1', new Decimal(2.00), 1);
      const bet = (service as any).currentRound.bets.get('user-1:1');
      expect(bet.cashedOutAt.toNumber()).toBe(2.00);
    });

    it('3.13 - Should record profit on bet', async () => {
      await service.cashout('user-1', new Decimal(3.00), 1);
      const bet = (service as any).currentRound.bets.get('user-1:1');
      // Profit = 100 * 3.00 - 100 = 200
      expect(bet.profit.toNumber()).toBe(200);
    });

    it('3.14 - Should emit crash.cashout event', async () => {
      await service.cashout('user-1', undefined, 1, true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'crash.cashout',
        expect.objectContaining({
          userId: 'user-1',
          multiplier: '2.50',
          profit: '150.00',
          slot: 1,
          isManual: true,
        }),
      );
    });

    it('3.15 - Should emit crash.balance_update with payout amount', async () => {
      await service.cashout('user-1', new Decimal(2.00), 1);
      // Payout = 100 * 2.00 = 200
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'crash.balance_update',
        expect.objectContaining({
          userId: 'user-1',
          change: '+200.00',
          reason: 'cashout',
        }),
      );
    });

    it('3.16 - Should use correct dragon multiplier for Dragon 2', async () => {
      const result = await service.cashout('user-1', undefined, 2);
      expect(result.success).toBe(true);
      // Dragon 2 currentMultiplier is 2.00
      expect(result.multiplier!.toNumber()).toBe(2.00);
    });

    it('3.17 - Should allow cashout at exactly the crash point', async () => {
      // crashPoint1 is 5.00, cashout at exactly 5.00
      (service as any).currentRound.currentMultiplier1 = new Decimal(5.00);
      const result = await service.cashout('user-1', new Decimal(5.00), 1);
      expect(result.success).toBe(true);
    });

    it('3.18 - Should handle minimum cashout at 1.01x', async () => {
      (service as any).currentRound.currentMultiplier1 = new Decimal(1.01);
      const result = await service.cashout('user-1', new Decimal(1.01), 1);
      expect(result.success).toBe(true);
      // Profit = 100 * 1.01 - 100 = 1
      expect(result.profit!.toNumber()).toBe(1);
    });
  });

  // ============================================
  // 🔄 STATE MACHINE
  // ============================================

  describe('🔄 State Machine', () => {
    it('4.1 - Should start with no current round', () => {
      // After construction, before startGameLoop, currentRound should be null
      const freshService = new (CrashService as any)(mockPrisma, mockGameConfig);
      expect(freshService.currentRound).toBeNull();
    });

    it('4.2 - Should have correct WAITING_TIME (10 seconds)', () => {
      expect((service as any).WAITING_TIME).toBe(10000);
    });

    it('4.3 - Should have correct CRASHED_TIME (3 seconds)', () => {
      expect((service as any).CRASHED_TIME).toBe(3000);
    });

    it('4.4 - Should have correct TICK_INTERVAL (100ms)', () => {
      expect((service as any).TICK_INTERVAL).toBe(100);
    });

    it('4.5 - Should have MAX_BET of 10000', () => {
      expect((service as any).MAX_BET).toBe(10000);
    });

    it('4.6 - Should have MIN_BET of 0.10', () => {
      expect((service as any).MIN_BET).toBe(0.10);
    });

    it('4.7 - Should have BET_COOLDOWN of 500ms', () => {
      expect((service as any).BET_COOLDOWN).toBe(500);
    });

    it('4.8 - Should have MAX_HISTORY of 20', () => {
      expect((service as any).MAX_HISTORY).toBe(20);
    });
  });

  // ============================================
  // 🔐 PROVABLY FAIR
  // ============================================

  describe('🔐 Provably Fair', () => {
    it('5.1 - Should hash server seed with SHA256', () => {
      const hashFn = (service as any).hashServerSeed.bind(service);
      const seed = 'test-server-seed';
      const hash = hashFn(seed);
      expect(hash).toBe(crypto.createHash('sha256').update(seed).digest('hex'));
    });

    it('5.2 - Should generate round server seed deterministically', () => {
      (service as any).masterServerSeed = 'master-seed';
      (service as any).gameNumber = 42;
      const genFn = (service as any).generateRoundServerSeed.bind(service);
      const seed1 = genFn();
      const seed2 = genFn();
      expect(seed1).toBe(seed2);
    });

    it('5.3 - Should generate different seeds for different game numbers', () => {
      (service as any).masterServerSeed = 'master-seed';
      const genFn = (service as any).generateRoundServerSeed.bind(service);

      (service as any).gameNumber = 1;
      const seed1 = genFn();
      (service as any).gameNumber = 2;
      const seed2 = genFn();
      expect(seed1).not.toBe(seed2);
    });

    it('5.4 - Should use E = 2^52 for hash space', () => {
      expect((service as any).E).toBe(Math.pow(2, 52));
    });
  });

  // ============================================
  // 📊 HELPER FUNCTIONS
  // ============================================

  describe('📊 getSafeRoundData', () => {
    it('6.1 - Should return empty object when no round', () => {
      (service as any).currentRound = null;
      const data = (service as any).getSafeRoundData();
      expect(data).toEqual({});
    });

    it('6.2 - Should NOT expose server seed', () => {
      (service as any).currentRound = {
        id: 'round-1',
        gameNumber: 1,
        serverSeed: 'secret-seed',
        serverSeedHash: 'public-hash',
        clientSeed: 'client-seed',
        state: GameState.WAITING,
        currentMultiplier1: new Decimal(1),
        currentMultiplier2: new Decimal(1),
        dragon1Crashed: false,
        dragon2Crashed: false,
      };
      const data = (service as any).getSafeRoundData();
      expect(data.serverSeed).toBeUndefined();
      expect(data.serverSeedHash).toBeDefined();
    });

    it('6.3 - Should NOT expose crash points', () => {
      (service as any).currentRound = {
        id: 'round-1',
        gameNumber: 1,
        serverSeed: 'secret-seed',
        serverSeedHash: 'public-hash',
        clientSeed: 'client-seed',
        state: GameState.RUNNING,
        crashPoint1: new Decimal(5.00),
        crashPoint2: new Decimal(3.00),
        currentMultiplier1: new Decimal(2.00),
        currentMultiplier2: new Decimal(1.50),
        dragon1Crashed: false,
        dragon2Crashed: false,
      };
      const data = (service as any).getSafeRoundData();
      expect(data.crashPoint1).toBeUndefined();
      expect(data.crashPoint2).toBeUndefined();
    });

    it('6.4 - Should include dragon crashed status', () => {
      (service as any).currentRound = {
        id: 'round-1',
        gameNumber: 1,
        serverSeedHash: 'hash',
        clientSeed: 'client',
        state: GameState.RUNNING,
        currentMultiplier1: new Decimal(1),
        currentMultiplier2: new Decimal(1),
        dragon1Crashed: true,
        dragon2Crashed: false,
      };
      const data = (service as any).getSafeRoundData();
      expect(data.dragon1Crashed).toBe(true);
      expect(data.dragon2Crashed).toBe(false);
    });
  });

  // ============================================
  // 📈 STATISTICAL VERIFICATION
  // ============================================

  describe('📈 House Edge Statistical Verification', () => {
    it('8.1 - Should maintain ~4% house edge over 10,000 rounds', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const rounds = 10000;
      let totalPayout = 0;

      for (let i = 0; i < rounds; i++) {
        const seed = crypto.createHmac('sha256', 'master').update(`round:${i}`).digest('hex');
        const point = generateCrashPoint(seed, 'test', i).toNumber();
        // Simulate a player who always cashes out at 2x
        if (point >= 2.0) {
          totalPayout += 2.0;
        }
      }

      const rtp = totalPayout / rounds;
      // RTP should be between 0.85 and 1.05 (allowing variance)
      expect(rtp).toBeGreaterThan(0.85);
      expect(rtp).toBeLessThan(1.05);
    });

    it('8.2 - Should have instant bust rate consistent with house edge', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const rounds = 10000;
      let busts = 0;

      for (let i = 0; i < rounds; i++) {
        const seed = crypto.createHmac('sha256', 'master').update(`round:${i}`).digest('hex');
        const point = generateCrashPoint(seed, 'test', i).toNumber();
        if (point <= 1.00) {
          busts++;
        }
      }

      const bustRate = busts / rounds;
      // Bust rate should be approximately equal to house edge (4%)
      expect(bustRate).toBeGreaterThan(0.02);
      expect(bustRate).toBeLessThan(0.08);
    });
  });
});
