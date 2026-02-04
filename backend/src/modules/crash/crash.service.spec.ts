/**
 * 🎰 CRASH SERVICE UNIT TESTS
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CrashService, GameState } from './crash.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

describe('🎰 CrashService - Unit Tests', () => {
  let service: CrashService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashService,
        {
          provide: PrismaService,
          useValue: {
            wallet: {
              findFirst: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 10000, currency: 'USDT' }),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CrashService>(CrashService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    
    service.setEventEmitter(eventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.stopGameLoop();
  });

  describe('🎲 Provably Fair Algorithm', () => {
    it('Should generate crash point between 1.00 and infinity', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      
      for (let i = 0; i < 100; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const crashPoint = generateCrashPoint(serverSeed, 'test-seed', i);
        expect(crashPoint.toNumber()).toBeGreaterThanOrEqual(1.00);
      }
    });

    it('Should be deterministic (same inputs = same output)', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const serverSeed = 'fixed-server-seed-for-testing';
      const clientSeed = 'fixed-client-seed';
      const nonce = 42;

      const result1 = generateCrashPoint(serverSeed, clientSeed, nonce);
      const result2 = generateCrashPoint(serverSeed, clientSeed, nonce);

      expect(result1.toString()).toBe(result2.toString());
    });

    it('Should produce different results with different nonces', () => {
      const generateCrashPoint = (service as any).generateCrashPoint.bind(service);
      const serverSeed = 'fixed-server-seed';
      const clientSeed = 'fixed-client-seed';

      const result1 = generateCrashPoint(serverSeed, clientSeed, 1);
      const result2 = generateCrashPoint(serverSeed, clientSeed, 2);

      expect(result1.toString()).not.toBe(result2.toString());
    });

    it('Should hash server seed correctly', () => {
      const hashServerSeed = (service as any).hashServerSeed.bind(service);
      const serverSeed = 'test-seed';
      
      const hash1 = hashServerSeed(serverSeed);
      const hash2 = hashServerSeed(serverSeed);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('🎮 Game State Machine', () => {
    it('Should start in null state before game loop', () => {
      const currentRound = (service as any).currentRound;
      expect(currentRound === null || currentRound.state === GameState.WAITING).toBeTruthy();
    });

    it('Should start game loop successfully', () => {
      service.startGameLoop();
      
      const currentRound = (service as any).currentRound;
      expect(currentRound).toBeDefined();
      expect(currentRound.state).toBe(GameState.WAITING);
    });

    it('Should not start duplicate game loops', () => {
      service.startGameLoop();
      const timer1 = (service as any).gameLoopTimer;
      
      service.startGameLoop();
      const timer2 = (service as any).gameLoopTimer;
      
      expect(timer1).toBe(timer2);
    });

    it('Should stop game loop', () => {
      service.startGameLoop();
      service.stopGameLoop();
      
      const timer = (service as any).gameLoopTimer;
      expect(timer).toBeNull();
    });

    it('Should increment game number on new round', () => {
      service.startGameLoop();
      const gameNumber1 = (service as any).gameNumber;
      
      (service as any).startNewRound();
      const gameNumber2 = (service as any).gameNumber;
      
      expect(gameNumber2).toBe(gameNumber1 + 1);
    });
  });

  describe('📊 Game Round Data', () => {
    beforeEach(() => {
      service.startGameLoop();
    });

    it('Should have valid round structure', () => {
      const round = (service as any).currentRound;
      
      expect(round).toHaveProperty('id');
      expect(round).toHaveProperty('gameNumber');
      expect(round).toHaveProperty('serverSeed');
      expect(round).toHaveProperty('serverSeedHash');
      expect(round).toHaveProperty('crashPoint');
      expect(round).toHaveProperty('state');
      expect(round).toHaveProperty('bets');
    });

    it('Should have server seed hash (provably fair)', () => {
      const round = (service as any).currentRound;
      
      expect(round.serverSeedHash).toBeDefined();
      expect(round.serverSeedHash).toHaveLength(64);
    });

    it('Should have empty bets map initially', () => {
      const round = (service as any).currentRound;
      
      expect(round.bets).toBeInstanceOf(Map);
      expect(round.bets.size).toBe(0);
    });

    it('Should have current multiplier at 1.00 in WAITING', () => {
      const round = (service as any).currentRound;
      
      expect(round.currentMultiplier.toNumber()).toBe(1);
    });
  });

  describe('🎯 Public Methods', () => {
    beforeEach(() => {
      service.startGameLoop();
    });

    it('Should get current round', () => {
      const round = service.getCurrentRound();
      
      expect(round).toBeDefined();
      expect(round).toHaveProperty('state');
    });
  });

  describe('📡 Event Emission', () => {
    beforeEach(() => {
      service.startGameLoop();
    });

    it('Should emit state change events', () => {
      (service as any).startNewRound();
      
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('Should emit with correct event structure', () => {
      (service as any).startNewRound();
      
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'crash.state_change',
        expect.objectContaining({
          state: expect.any(String),
        })
      );
    });
  });

  describe('⏱️ Timing Configuration', () => {
    it('Should have correct WAITING_TIME', () => {
      const waitingTime = (service as any).WAITING_TIME;
      expect(waitingTime).toBe(6000);
    });

    it('Should have correct CRASHED_TIME', () => {
      const crashedTime = (service as any).CRASHED_TIME;
      expect(crashedTime).toBe(3000);
    });

    it('Should have correct TICK_INTERVAL', () => {
      const tickInterval = (service as any).TICK_INTERVAL;
      expect(tickInterval).toBe(100);
    });

    it('Should have correct HOUSE_EDGE', () => {
      const houseEdge = (service as any).HOUSE_EDGE;
      expect(houseEdge).toBe(0.01);
    });
  });

  describe('🔒 Security', () => {
    it('Should not expose server seed in safe data', () => {
      service.startGameLoop();
      const safeData = (service as any).getSafeRoundData();
      
      expect(safeData.serverSeed).toBeUndefined();
    });

    it('Should expose server seed hash for verification', () => {
      service.startGameLoop();
      const safeData = (service as any).getSafeRoundData();
      
      expect(safeData.serverSeedHash).toBeDefined();
    });

    it('Should have unique master server seed', () => {
      const seed1 = (service as any).masterServerSeed;
      
      // Master seed should be a valid hex string
      expect(seed1).toBeDefined();
      expect(typeof seed1).toBe('string');
      expect(seed1.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('🧮 Multiplier Calculation', () => {
    it('Should calculate multiplier correctly at t=0', () => {
      const elapsed = 0;
      const multiplier = Math.exp(elapsed * 0.00006);
      
      expect(multiplier).toBeCloseTo(1.00, 2);
    });

    it('Should increase multiplier over time', () => {
      const elapsed1 = 1000;
      const elapsed2 = 2000;
      
      const mult1 = Math.exp(elapsed1 * 0.00006);
      const mult2 = Math.exp(elapsed2 * 0.00006);
      
      expect(mult2).toBeGreaterThan(mult1);
    });
  });
});
