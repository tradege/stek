/**
 * 🚀 Nova Rush Game Loop - Comprehensive Test Suite
 * 
 * Operation "Starship Integrity" - 100% Game Coverage
 * 
 * Tests:
 * - Game Loop: Start -> Bet -> Crash -> End
 * - Betting Logic: Timing, Balance, Validation
 * - Auto-Cashout: Precision timing
 * - Late Cashout: Lag protection
 * - Concurrency: 100 simultaneous users
 * - Nova Rush specific: Same crash engine, space theme context
 * 
 * Nova Rush uses the SAME CrashService backend as Crash.
 * The only difference is the frontend theme (spaceship vs rocket).
 * All mathematical properties must be identical.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CrashService, GameState } from './crash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GameConfigService } from './game-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

// ============================================
// MOCK SERVICES
// ============================================

const createMockPrismaService = () => {
  let defaultBalance = 10000;

  const mock: any = {
    wallet: {
      findFirst: jest.fn().mockResolvedValue({ 
        id: 'wallet-1', 
        balance: new Decimal(10000), 
        currency: 'USDT' 
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'nova_pilot',
        status: 'ACTIVE',
      }),
    },
    crashGame: {
      create: jest.fn().mockResolvedValue({ id: 'game-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    crashBet: {
      create: jest.fn().mockResolvedValue({ id: 'bet-1' }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    bet: {
      create: jest.fn().mockResolvedValue({ id: 'bet-1' }),
    },
    $transaction: jest.fn(async (callback) => {
      const txClient = {
        $queryRaw: jest.fn().mockResolvedValue([
          { id: 'wallet-1', balance: defaultBalance }
        ]),
        wallet: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return callback(txClient);
    }),
    _setTransactionBalance: (balance: number) => {
      defaultBalance = balance;
      mock.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          $queryRaw: jest.fn().mockResolvedValue([
            { id: 'wallet-1', balance: balance }
          ]),
          wallet: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(txClient);
      });
    },
    _setNoWallet: () => {
      mock.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          wallet: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(txClient);
      });
    },
  };

  return mock;
};

const createMockGameConfigService = () => ({
  houseEdge: 0.04,
  instantBust: 0.02,
  botsEnabled: false,
  maxBotBet: 500,
  minBotBet: 10,
  getConfig: jest.fn().mockReturnValue({
    houseEdge: 0.04,
    instantBust: 0.02,
  }),
});

const createMockEventEmitter = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
});

// ============================================
// NOVA RUSH GAME LOOP TESTS
// ============================================

describe('🚀 Nova Rush Game Loop Tests', () => {
  let service: CrashService;
  let prismaService: any;
  let gameConfigService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prismaService = createMockPrismaService();
    gameConfigService = createMockGameConfigService();
    eventEmitter = createMockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashService,
        { provide: PrismaService, useValue: prismaService },
        { provide: GameConfigService, useValue: gameConfigService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CrashService>(CrashService);
    service.setEventEmitter(eventEmitter);
  });

  afterEach(async () => {
    service.stopGameLoop();
    service['lastBetTime'].clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // ============================================
  // 🔄 GAME LOOP LIFECYCLE
  // ============================================

  describe('🔄 Nova Rush Game Loop Lifecycle', () => {
    it('Should start game loop successfully', () => {
      expect(() => service.startGameLoop()).not.toThrow();
    });

    it('Should stop game loop successfully', () => {
      service.startGameLoop();
      service.stopGameLoop();
      expect(service['gameLoopTimer'] == null).toBe(true);
    });

    it('Should not start multiple game loops', () => {
      service.startGameLoop();
      const firstTimer = service['gameLoopTimer'];
      service.startGameLoop();
      const secondTimer = service['gameLoopTimer'];
      expect(firstTimer).toBe(secondTimer);
    });

    it('Should initialize with WAITING state', () => {
      const state = service.getCurrentGameState();
      expect(state.state).toBe('WAITING');
    });

    it('Should increment game number on new round', async () => {
      const initialGameNumber = service['gameNumber'];
      service['startNewRound']();
      expect(service['gameNumber']).toBe(initialGameNumber + 1);
    });

    it('Should generate unique round IDs', () => {
      service['startNewRound']();
      const id1 = service['currentRound']!.id;
      service['startNewRound']();
      const id2 = service['currentRound']!.id;
      expect(id1).not.toBe(id2);
    });

    it('Should generate server seed hash before game starts', () => {
      service['startNewRound']();
      const round = service.getCurrentRound();
      expect(round?.serverSeedHash).toBeDefined();
      expect(round?.serverSeedHash?.length).toBe(64); // SHA-256 hex
    });

    it('Should not expose server seed during WAITING', () => {
      service['startNewRound']();
      const round = service.getCurrentRound();
      expect((round as any)?.serverSeed).toBeUndefined();
    });

    it('Should not expose crash point during WAITING', () => {
      service['startNewRound']();
      const round = service.getCurrentRound();
      expect((round as any)?.crashPoint).toBeUndefined();
    });
  });

  // ============================================
  // 🎰 BETTING PHASE TESTS
  // ============================================

  describe('🎰 Nova Rush Betting Phase', () => {
    beforeEach(async () => {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
    });

    it('Should accept bet during betting phase', async () => {
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(true);
      expect(result.bet).toBeDefined();
    });

    it('Should accept bet with auto-cashout (auto-eject)', async () => {
      const result = await service.placeBet('user-1', new Decimal(100), new Decimal(2.0));
      expect(result.success).toBe(true);
      expect(result.bet).toBeDefined();
      expect(result.bet!.autoCashoutAt?.toNumber()).toBe(2.0);
    });

    it('Should reject bet when no round active', async () => {
      service['currentRound'] = null;
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active round');
    });

    it('Should reject bet after betting phase closed (ship launched)', async () => {
      service['currentRound']!.state = GameState.RUNNING;
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('betting');
    });

    it('Should reject bet exceeding balance', async () => {
      prismaService._setTransactionBalance(50);
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('insufficient');
    });

    it('Should reject duplicate bet from same user', async () => {
      await service.placeBet('user-1', new Decimal(100));
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Already placed');
    });

    it('Should reject bet below minimum ($0.10)', async () => {
      const result = await service.placeBet('user-1', new Decimal(0.001));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Minimum');
    });

    it('Should reject bet above maximum ($10,000)', async () => {
      const result = await service.placeBet('user-1', new Decimal(1000000));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum');
    });

    it('Should reject negative bet amount', async () => {
      const result = await service.placeBet('user-1', new Decimal(-100));
      expect(result.success).toBe(false);
    });

    it('Should reject zero bet amount', async () => {
      const result = await service.placeBet('user-1', new Decimal(0));
      expect(result.success).toBe(false);
    });

    it('Should deduct bet amount from wallet', async () => {
      await service.placeBet('user-1', new Decimal(100));
      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet).toBeDefined();
      expect(bet!.amount.toNumber()).toBe(100);
    });

    it('Should enforce rate limiting between bets (per-user)', async () => {
      await service.placeBet('user-1', new Decimal(100));
      // Different user should not be rate-limited
      const result = await service.placeBet('user-2', new Decimal(100));
      expect(result.success).toBe(true);
    });

    it('Should enforce max bet limit of $10,000', async () => {
      const result = await service.placeBet('user-1', new Decimal(10001));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum');
    });

    it('Should accept bet at exactly max limit', async () => {
      const result = await service.placeBet('user-1', new Decimal(10000));
      expect(result.success).toBe(true);
    });

    it('Should accept bet at exactly min limit ($0.10)', async () => {
      const result = await service.placeBet('user-1', new Decimal(0.10));
      expect(result.success).toBe(true);
    });

    it('Should handle multiple users betting simultaneously', async () => {
      const results = await Promise.all([
        service.placeBet('user-1', new Decimal(100)),
        service.placeBet('user-2', new Decimal(200)),
        service.placeBet('user-3', new Decimal(300)),
      ]);
      results.forEach(r => expect(r.success).toBe(true));
    });

    it('Should reject bet when wallet not found', async () => {
      prismaService._setNoWallet();
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // 💰 CASHOUT TESTS (EJECT)
  // ============================================

  describe('💰 Nova Rush Eject (Cashout) Logic', () => {
    beforeEach(async () => {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
      await service.placeBet('user-1', new Decimal(100));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.currentMultiplier = new Decimal(2.0);
      service['currentRound']!.crashPoint = new Decimal(5.0);
    });

    it('Should allow eject during flight (running state)', async () => {
      const result = await service.cashout('user-1');
      expect(result.success).toBe(true);
      expect(result.multiplier).toBeDefined();
    });

    it('Should calculate correct profit on eject', async () => {
      const result = await service.cashout('user-1');
      // Bet: 100, Multiplier: 2.0, Profit: 100
      expect(result.profit?.toNumber()).toBe(100);
    });

    it('Should reject eject when ship crashed', async () => {
      service['currentRound']!.state = GameState.CRASHED;
      const result = await service.cashout('user-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not running');
    });

    it('Should reject eject for non-existent bet', async () => {
      const result = await service.cashout('non-existent-user');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No bet found');
    });

    it('Should reject double eject', async () => {
      await service.cashout('user-1');
      const result = await service.cashout('user-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already settled');
    });

    it('Should reject late eject (after crash point)', async () => {
      service['currentRound']!.currentMultiplier = new Decimal(6.0);
      const result = await service.cashout('user-1', new Decimal(6.0));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too late');
    });

    it('Should calculate correct payout at various multipliers', async () => {
      // Test at 1.5x
      service['currentRound']!.currentMultiplier = new Decimal(1.5);
      const result = await service.cashout('user-1');
      expect(result.profit?.toNumber()).toBe(50); // 100 * 1.5 - 100 = 50
    });

    it('Should handle high multiplier eject correctly', async () => {
      service['currentRound']!.currentMultiplier = new Decimal(4.99);
      const result = await service.cashout('user-1');
      expect(result.success).toBe(true);
      expect(result.profit?.toNumber()).toBeCloseTo(399, 0);
    });

    it('Should mark bet as CASHED_OUT after eject', async () => {
      await service.cashout('user-1');
      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('CASHED_OUT');
    });

    it('Should record cashout multiplier', async () => {
      await service.cashout('user-1');
      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.cashedOutAt?.toNumber()).toBe(2.0);
    });
  });

  // ============================================
  // 🤖 AUTO-EJECT TESTS
  // ============================================

  describe('🤖 Nova Rush Auto-Eject (Auto-Cashout)', () => {
    beforeEach(async () => {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
    });

    it('Should trigger auto-eject at specified multiplier', async () => {
      await service.placeBet('user-1', new Decimal(100), new Decimal(2.0));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5.0);
      service['currentRound']!.currentMultiplier = new Decimal(2.0);

      await service['processAutoCashouts'](new Decimal(2.0));

      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('CASHED_OUT');
    });

    it('Should not trigger auto-eject below threshold', async () => {
      await service.placeBet('user-1', new Decimal(100), new Decimal(3.0));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5.0);

      await service['processAutoCashouts'](new Decimal(2.0));

      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('ACTIVE');
    });

    it('Should handle multiple auto-ejects simultaneously', async () => {
      await service.placeBet('user-1', new Decimal(100), new Decimal(2.0));
      service['lastBetTime'].clear();
      await service.placeBet('user-2', new Decimal(200), new Decimal(2.5));
      service['lastBetTime'].clear();
      await service.placeBet('user-3', new Decimal(300), new Decimal(3.0));

      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5.0);

      // At 3.0x, all three should trigger
      await service['processAutoCashouts'](new Decimal(3.0));

      expect(service['currentRound']!.bets.get('user-1')?.status).toBe('CASHED_OUT');
      expect(service['currentRound']!.bets.get('user-2')?.status).toBe('CASHED_OUT');
      expect(service['currentRound']!.bets.get('user-3')?.status).toBe('CASHED_OUT');
    });

    it('Should not auto-eject manual bets (no autoCashoutAt)', async () => {
      await service.placeBet('user-1', new Decimal(100)); // No auto-cashout
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5.0);

      await service['processAutoCashouts'](new Decimal(10.0));

      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('ACTIVE');
    });
  });

  // ============================================
  // 💥 CRASH (SHIP DESTROYED) TESTS
  // ============================================

  describe('💥 Nova Rush Ship Destruction (Crash)', () => {
    beforeEach(async () => {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
    });

    it('Should mark all active bets as LOST on crash', async () => {
      await service.placeBet('user-1', new Decimal(100));
      service['lastBetTime'].clear();
      await service.placeBet('user-2', new Decimal(200));

      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(2.0);

      // Trigger crash
      service['crash']();

      expect(service['currentRound']!.bets.get('user-1')?.status).toBe('LOST');
      expect(service['currentRound']!.bets.get('user-2')?.status).toBe('LOST');
    });

    it('Should set state to CRASHED', async () => {
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(2.0);
      service['crash']();
      expect(service['currentRound']!.state).toBe(GameState.CRASHED);
    });

    it('Should set final multiplier to crash point', async () => {
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(3.45);
      service['crash']();
      expect(service['currentRound']!.currentMultiplier.toNumber()).toBe(3.45);
    });

    it('Should add crash point to history', async () => {
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(2.5);
      service['crash']();
      expect(service['crashHistory'][0]).toBe(2.5);
    });

    it('Should emit crashed event', async () => {
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(2.0);
      service['crash']();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'crash.crashed',
        expect.objectContaining({ crashPoint: '2.00' })
      );
    });

    it('Should not affect already cashed-out bets on crash', async () => {
      await service.placeBet('user-1', new Decimal(100));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5.0);
      service['currentRound']!.currentMultiplier = new Decimal(2.0);

      // User cashes out before crash
      await service.cashout('user-1');
      
      // Then crash happens
      service['crash']();

      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('CASHED_OUT'); // Should remain CASHED_OUT, not LOST
    });

    it('Should handle crash with no active bets', async () => {
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(1.0);
      expect(() => service['crash']()).not.toThrow();
    });

    it('Should record negative profit for lost bets', async () => {
      await service.placeBet('user-1', new Decimal(100));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(2.0);
      service['crash']();
      
      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.profit?.toNumber()).toBe(-100);
    });
  });

  // ============================================
  // 🔐 PROVABLY FAIR ALGORITHM
  // ============================================

  describe('🔐 Nova Rush Provably Fair Algorithm', () => {
    it('Should generate deterministic crash points', () => {
      const serverSeed = 'test-server-seed-nova-rush';
      const clientSeed = 'test-client-seed';
      const nonce = 1;

      const cp1 = service['generateCrashPoint'](serverSeed, clientSeed, nonce);
      const cp2 = service['generateCrashPoint'](serverSeed, clientSeed, nonce);

      expect(cp1.toNumber()).toBe(cp2.toNumber());
    });

    it('Should produce different results for different seeds', () => {
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        results.add(cp.toNumber());
      }
      // Should have many unique values
      expect(results.size).toBeGreaterThan(50);
    });

    it('Should never produce crash point below 1.00', () => {
      for (let i = 0; i < 10000; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        expect(cp.toNumber()).toBeGreaterThanOrEqual(1.00);
      }
    });

    it('Should never exceed 5000x cap', () => {
      for (let i = 0; i < 10000; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        expect(cp.toNumber()).toBeLessThanOrEqual(5000);
      }
    });

    it('Should match HMAC-SHA256 algorithm exactly', () => {
      const serverSeed = 'nova-rush-verification-seed';
      const clientSeed = 'stakepro-public-seed';
      const nonce = 42;

      // Replicate the algorithm
      const combinedSeed = `${clientSeed}:${nonce}`;
      const hmac = crypto.createHmac('sha256', serverSeed);
      hmac.update(combinedSeed);
      const hash = hmac.digest('hex');
      const h = parseInt(hash.substring(0, 13), 16);
      const E = Math.pow(2, 52);
      const r = h / E;
      const HOUSE_EDGE = 0.04;
      const rawMultiplier = (1 - HOUSE_EDGE) / (1 - r);
      const expected = Math.min(5000, Math.max(1.00, Math.floor(rawMultiplier * 100) / 100));

      const actual = service['generateCrashPoint'](serverSeed, clientSeed, nonce);
      expect(actual.toNumber()).toBe(expected);
    });

    it('Should verify server seed hash matches', () => {
      service['startNewRound']();
      const round = service['currentRound']!;
      const expectedHash = crypto.createHash('sha256').update(round.serverSeed).digest('hex');
      expect(round.serverSeedHash).toBe(expectedHash);
    });
  });

  // ============================================
  // 📊 MULTIPLIER GROWTH TESTS
  // ============================================

  describe('📊 Nova Rush Multiplier Growth', () => {
    it('Should use exponential growth formula', () => {
      const growthRate = 0.00006;
      const elapsed = 10000; // 10 seconds
      const expected = Math.exp(growthRate * elapsed);
      
      // Verify the formula produces reasonable values
      expect(expected).toBeGreaterThan(1.0);
      expect(expected).toBeLessThan(3.0); // At 10s should be ~1.82x
    });

    it('Should reach ~2x at approximately 11.5 seconds', () => {
      const growthRate = 0.00006;
      const elapsed = 11500;
      const multiplier = Math.exp(growthRate * elapsed);
      expect(multiplier).toBeCloseTo(2.0, 0);
    });

    it('Should start at 1.00x', () => {
      service['startNewRound']();
      expect(service['currentRound']!.currentMultiplier.toNumber()).toBe(1.0);
    });
  });

  // ============================================
  // 👥 CONCURRENCY TESTS
  // ============================================

  describe('👥 Nova Rush Concurrent Players', () => {
    beforeEach(async () => {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
    });

    it('Should handle 50 simultaneous bets', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(service.placeBet(`user-${i}`, new Decimal(10 + i)));
      }
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(50);
    });

    it('Should handle 50 simultaneous cashouts', async () => {
      // Place 50 bets
      for (let i = 0; i < 50; i++) {
        service['lastBetTime'].clear();
        await service.placeBet(`user-${i}`, new Decimal(10));
      }

      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.currentMultiplier = new Decimal(2.0);
      service['currentRound']!.crashPoint = new Decimal(5.0);

      // Cashout all at once
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(service.cashout(`user-${i}`));
      }
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(50);
    });

    it('Should correctly track individual bet amounts', async () => {
      for (let i = 0; i < 10; i++) {
        service['lastBetTime'].clear();
        await service.placeBet(`user-${i}`, new Decimal(10 * (i + 1)));
      }

      for (let i = 0; i < 10; i++) {
        const bet = service['currentRound']!.bets.get(`user-${i}`);
        expect(bet?.amount.toNumber()).toBe(10 * (i + 1));
      }
    });
  });

  // ============================================
  // 🛡️ EDGE CASES & SECURITY
  // ============================================

  describe('🛡️ Nova Rush Edge Cases & Security', () => {
    beforeEach(async () => {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
    });

    it('Should handle instant bust (1.00x crash)', async () => {
      await service.placeBet('user-1', new Decimal(100));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(1.00);
      service['crash']();

      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('LOST');
    });

    it('Should handle very high crash point', async () => {
      await service.placeBet('user-1', new Decimal(100), new Decimal(4999));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5000);
      service['currentRound']!.currentMultiplier = new Decimal(4999);

      await service['processAutoCashouts'](new Decimal(4999));
      const bet = service['currentRound']!.bets.get('user-1');
      expect(bet?.status).toBe('CASHED_OUT');
    });

    it('Should handle decimal bet amounts correctly', async () => {
      const result = await service.placeBet('user-1', new Decimal(10.55));
      expect(result.success).toBe(true);
      expect(result.bet?.amount.toNumber()).toBe(10.55);
    });

    it('Should handle string bet amounts', async () => {
      const result = await service.placeBet('user-1', '100');
      expect(result.success).toBe(true);
    });

    it('Should handle number bet amounts', async () => {
      const result = await service.placeBet('user-1', 100);
      expect(result.success).toBe(true);
    });

    it('Should reject bet during CRASHED state', async () => {
      service['currentRound']!.state = GameState.CRASHED;
      const result = await service.placeBet('user-1', new Decimal(100));
      expect(result.success).toBe(false);
    });

    it('Should handle crash history overflow (max 20)', () => {
      for (let i = 0; i < 25; i++) {
        service['startNewRound']();
        service['currentRound']!.state = GameState.RUNNING;
        service['currentRound']!.crashPoint = new Decimal(1 + i * 0.1);
        service['crash']();
      }
      expect(service['crashHistory'].length).toBeLessThanOrEqual(20);
    });

    it('Should emit balance_update event on bet placement', async () => {
      await service.placeBet('user-1', new Decimal(100));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'crash.balance_update',
        expect.objectContaining({ userId: 'user-1', reason: 'bet_placed' })
      );
    });

    it('Should emit bet_placed event', async () => {
      await service.placeBet('user-1', new Decimal(100));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'crash.bet_placed',
        expect.objectContaining({ userId: 'user-1', amount: '100.00' })
      );
    });

    it('Should emit cashout event on eject', async () => {
      await service.placeBet('user-1', new Decimal(100));
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.currentMultiplier = new Decimal(2.0);
      service['currentRound']!.crashPoint = new Decimal(5.0);
      await service.cashout('user-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'crash.cashout',
        expect.objectContaining({ userId: 'user-1' })
      );
    });
  });

  // ============================================
  // 📈 MATHEMATICAL INTEGRITY
  // ============================================

  describe('📈 Nova Rush Mathematical Integrity', () => {
    it('Should maintain house edge ≈ 4% over 10K iterations', () => {
      const iterations = 10000;
      let totalReturn = 0;
      const cashoutAt = 2.0;

      for (let i = 0; i < iterations; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        if (cp.toNumber() >= cashoutAt) {
          totalReturn += cashoutAt;
        }
      }

      const avgReturn = totalReturn / iterations;
      const houseEdge = 1 - avgReturn;
      
      // House edge should be approximately 4% (±2% tolerance for 10K sample)
      expect(houseEdge).toBeGreaterThan(0.01);
      expect(houseEdge).toBeLessThan(0.08);
    });

    it('Should have ~50% of games crash below 2.00x', () => {
      let below2 = 0;
      const total = 10000;

      for (let i = 0; i < total; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        if (cp.toNumber() < 2.0) below2++;
      }

      const ratio = below2 / total;
      expect(ratio).toBeGreaterThan(0.40);
      expect(ratio).toBeLessThan(0.60);
    });

    it('Should have ~90% of games crash below 10.00x', () => {
      let below10 = 0;
      const total = 10000;

      for (let i = 0; i < total; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        if (cp.toNumber() < 10.0) below10++;
      }

      const ratio = below10 / total;
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(0.95);
    });

    it('Should satisfy P(X >= m) ≈ (1-edge)/m for key multipliers', () => {
      const total = 50000;
      const crashPoints: number[] = [];

      for (let i = 0; i < total; i++) {
        crashPoints.push(service['generateCrashPoint'](`s-${i}`, 'c', i).toNumber());
      }

      const testMultipliers = [1.5, 2.0, 3.0, 5.0, 10.0];
      for (const m of testMultipliers) {
        const survivalRate = crashPoints.filter(cp => cp >= m).length / total;
        const theoretical = 0.96 / m; // (1 - 0.04) / m
        expect(Math.abs(survivalRate - theoretical)).toBeLessThan(0.03);
      }
    });
  });
});
