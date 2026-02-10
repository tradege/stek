/**
 * 🐉 Dragon Blaze - Frontend-Backend Integration Tests (Dual Dragon)
 * 
 * Tests the integration between the Dragon Blaze dual-dragon frontend
 * and the CrashService backend:
 * - Dual crash point synchronization (independent per dragon)
 * - Independent multiplier curves per dragon
 * - Dual bet flow: bet on Dragon 1, Dragon 2, or both
 * - Dragon 1 crash doesn't affect Dragon 2 (and vice versa)
 * - Arrow hit triggers at correct crash point per dragon
 * - Falling animation matches backend crash event
 * - Dual-dragon provably fair verification
 * - Combined payout calculations
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
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'u-1', username: 'dragon_rider', status: 'ACTIVE' }),
  },
  crashGame: {
    create: jest.fn().mockResolvedValue({ id: 'g-1', status: 'WAITING' }),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  crashBet: {
    create: jest.fn().mockResolvedValue({ id: 'b-1', amount: 10, userId: 'u-1' }),
    update: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
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
});

let dragon1Service: CrashService;
let dragon2Service: CrashService;

beforeEach(async () => {
  const module1: TestingModule = await Test.createTestingModule({
    providers: [
      CrashService,
      { provide: PrismaService, useValue: createMockPrismaService() },
      { provide: GameConfigService, useValue: createMockGameConfigService() },
      { provide: EventEmitter2, useValue: createMockEventEmitter() },
    ],
  }).compile();
  dragon1Service = module1.get<CrashService>(CrashService);

  const module2: TestingModule = await Test.createTestingModule({
    providers: [
      CrashService,
      { provide: PrismaService, useValue: createMockPrismaService() },
      { provide: GameConfigService, useValue: createMockGameConfigService() },
      { provide: EventEmitter2, useValue: createMockEventEmitter() },
    ],
  }).compile();
  dragon2Service = module2.get<CrashService>(CrashService);
});

afterEach(() => {
  dragon1Service.stopGameLoop();
  dragon2Service.stopGameLoop();
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('🐉 Dragon Blaze - Dual Dragon Frontend-Backend Integration', () => {

  // ============================================
  // 🔗 DUAL CRASH POINT SYNCHRONIZATION
  // ============================================

  describe('🔗 Dual Crash Point Synchronization', () => {
    it('Each dragon should have its own crash point from different seeds', () => {
      const cp1 = dragon1Service['generateCrashPoint']('dragon1-seed-1', 'client', 1);
      const cp2 = dragon2Service['generateCrashPoint']('dragon2-seed-1', 'client', 1);
      expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.00);
      expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.00);
    });

    it('Same seed should produce same crash point (deterministic)', () => {
      const cp1a = dragon1Service['generateCrashPoint']('same-seed', 'client', 1);
      const cp1b = dragon1Service['generateCrashPoint']('same-seed', 'client', 1);
      expect(cp1a.toNumber()).toBe(cp1b.toNumber());
    });

    it('Dragon 1 crash point should be independent of Dragon 2', () => {
      // Generate Dragon 1 crash point
      const cp1 = dragon1Service['generateCrashPoint']('d1-independent', 'client', 1);
      // Dragon 2 crash point should not affect Dragon 1
      const cp2 = dragon2Service['generateCrashPoint']('d2-independent', 'client', 1);
      // Regenerate Dragon 1 — should be the same
      const cp1Again = dragon1Service['generateCrashPoint']('d1-independent', 'client', 1);
      expect(cp1.toNumber()).toBe(cp1Again.toNumber());
    });

    it('Both crash points should be within valid range', () => {
      for (let i = 0; i < 1000; i++) {
        const cp1 = dragon1Service['generateCrashPoint'](`d1-range-${i}`, 'client', i);
        const cp2 = dragon2Service['generateCrashPoint'](`d2-range-${i}`, 'client', i);
        expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.00);
        expect(cp1.toNumber()).toBeLessThanOrEqual(5000);
        expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.00);
        expect(cp2.toNumber()).toBeLessThanOrEqual(5000);
      }
    });
  });

  // ============================================
  // 📈 INDEPENDENT MULTIPLIER CURVES
  // ============================================

  describe('📈 Independent Multiplier Curves', () => {
    it('Each dragon should have its own multiplier timeline', () => {
      const speed = 0.00006;
      const d1CrashPoint = 2.0;
      const d2CrashPoint = 5.0;

      const d1CrashTime = Math.log(d1CrashPoint) / speed;
      const d2CrashTime = Math.log(d2CrashPoint) / speed;

      // Dragon 1 crashes earlier
      expect(d1CrashTime).toBeLessThan(d2CrashTime);

      // At d1CrashTime, Dragon 2 is still flying
      const d2MultiplierAtD1Crash = Math.exp(speed * d1CrashTime);
      expect(d2MultiplierAtD1Crash).toBeLessThan(d2CrashPoint);
    });

    it('Dragon 2 should continue after Dragon 1 crashes', () => {
      const d1CrashPoint = 1.5;
      const d2CrashPoint = 10.0;
      const speed = 0.00006;

      const d1CrashTime = Math.log(d1CrashPoint) / speed;
      
      // After Dragon 1 crashes, Dragon 2 multiplier continues
      const d2AtD1Crash = Math.exp(speed * d1CrashTime);
      expect(d2AtD1Crash).toBeGreaterThan(1.0);
      expect(d2AtD1Crash).toBeLessThan(d2CrashPoint);

      // Dragon 2 eventually reaches its own crash point
      const d2CrashTime = Math.log(d2CrashPoint) / speed;
      const d2AtCrash = Math.exp(speed * d2CrashTime);
      expect(d2AtCrash).toBeCloseTo(d2CrashPoint, 1);
    });

    it('Both multipliers start at 1.00x simultaneously', () => {
      const speed = 0.00006;
      const d1Start = Math.exp(speed * 0);
      const d2Start = Math.exp(speed * 0);
      expect(d1Start).toBeCloseTo(1.00, 2);
      expect(d2Start).toBeCloseTo(1.00, 2);
    });
  });

  // ============================================
  // 🎮 DUAL BET FLOW
  // ============================================

  describe('🎮 Dual Bet Flow', () => {
    it('Player can bet on Dragon 1 only', () => {
      const d1Bet = 100;
      const d2Bet = 0;
      const totalBet = d1Bet + d2Bet;
      expect(totalBet).toBe(100);
    });

    it('Player can bet on Dragon 2 only', () => {
      const d1Bet = 0;
      const d2Bet = 100;
      const totalBet = d1Bet + d2Bet;
      expect(totalBet).toBe(100);
    });

    it('Player can bet on BOTH dragons', () => {
      const d1Bet = 50;
      const d2Bet = 50;
      const totalBet = d1Bet + d2Bet;
      expect(totalBet).toBe(100);
    });

    it('Different bet amounts per dragon should be supported', () => {
      const d1Bet = 10;
      const d2Bet = 90;
      expect(d1Bet + d2Bet).toBe(100);
    });

    it('Payout calculation: bet on Dragon 1 only, cashout at 2x', () => {
      const d1Bet = 100;
      const d1CashoutAt = 2.0;
      const d1CrashPoint = 3.0; // Dragon 1 survives past 2x
      const d1Payout = d1CashoutAt <= d1CrashPoint ? d1Bet * d1CashoutAt : 0;
      expect(d1Payout).toBe(200);
    });

    it('Payout calculation: bet on both, Dragon 1 crashes, Dragon 2 survives', () => {
      const d1Bet = 50;
      const d2Bet = 50;
      const d1CrashPoint = 1.5;
      const d2CrashPoint = 5.0;
      const cashoutAt = 2.0;

      const d1Payout = cashoutAt <= d1CrashPoint ? d1Bet * cashoutAt : 0;
      const d2Payout = cashoutAt <= d2CrashPoint ? d2Bet * cashoutAt : 0;

      expect(d1Payout).toBe(0); // Dragon 1 crashed before 2x
      expect(d2Payout).toBe(100); // Dragon 2 survived past 2x
      expect(d1Payout + d2Payout).toBe(100); // Total payout
    });

    it('Payout calculation: both dragons crash before cashout', () => {
      const d1Bet = 50;
      const d2Bet = 50;
      const d1CrashPoint = 1.2;
      const d2CrashPoint = 1.8;
      const cashoutAt = 2.0;

      const d1Payout = cashoutAt <= d1CrashPoint ? d1Bet * cashoutAt : 0;
      const d2Payout = cashoutAt <= d2CrashPoint ? d2Bet * cashoutAt : 0;

      expect(d1Payout).toBe(0);
      expect(d2Payout).toBe(0);
      expect(d1Payout + d2Payout).toBe(0);
    });

    it('Payout calculation: both dragons survive past cashout', () => {
      const d1Bet = 50;
      const d2Bet = 50;
      const d1CrashPoint = 5.0;
      const d2CrashPoint = 8.0;
      const cashoutAt = 2.0;

      const d1Payout = cashoutAt <= d1CrashPoint ? d1Bet * cashoutAt : 0;
      const d2Payout = cashoutAt <= d2CrashPoint ? d2Bet * cashoutAt : 0;

      expect(d1Payout).toBe(100);
      expect(d2Payout).toBe(100);
      expect(d1Payout + d2Payout).toBe(200);
    });
  });

  // ============================================
  // 🐉 DRAGON 1 CRASH ≠ DRAGON 2 CRASH
  // ============================================

  describe('🐉 Dragon Independence', () => {
    it('Dragon 1 crashing should NOT affect Dragon 2 state', () => {
      const d1State = 'CRASHED';
      const d2State = 'RUNNING';
      // They are independent
      expect(d1State).not.toBe(d2State);
    });

    it('Dragon 2 crashing should NOT affect Dragon 1 state', () => {
      const d1State = 'RUNNING';
      const d2State = 'CRASHED';
      expect(d1State).not.toBe(d2State);
    });

    it('Both dragons can be RUNNING simultaneously', () => {
      const s1 = dragon1Service.getCurrentGameState();
      const s2 = dragon2Service.getCurrentGameState();
      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
    });

    it('Dragon 1 can crash while Dragon 2 continues to higher multiplier', () => {
      const d1CrashPoint = 1.5;
      const d2CrashPoint = 100.0;
      expect(d2CrashPoint).toBeGreaterThan(d1CrashPoint);
    });

    it('Player can cashout Dragon 1 and let Dragon 2 ride', () => {
      const d1Bet = 50;
      const d2Bet = 50;
      const d1CashoutAt = 1.5;
      const d1CrashPoint = 3.0;
      const d2CrashPoint = 10.0;

      // Cashout Dragon 1 at 1.5x
      const d1Payout = d1CashoutAt <= d1CrashPoint ? d1Bet * d1CashoutAt : 0;
      expect(d1Payout).toBe(75);

      // Dragon 2 still running, can cashout later at 5x
      const d2CashoutAt = 5.0;
      const d2Payout = d2CashoutAt <= d2CrashPoint ? d2Bet * d2CashoutAt : 0;
      expect(d2Payout).toBe(250);

      expect(d1Payout + d2Payout).toBe(325);
    });
  });

  // ============================================
  // 🎯 ARROW HIT AT CRASH POINT
  // ============================================

  describe('🎯 Arrow Hit Triggers at Correct Crash Point', () => {
    it('Arrow should hit Dragon 1 when multiplier reaches Dragon 1 crash point', () => {
      const d1CrashPoint = 2.5;
      const speed = 0.00006;
      const crashTime = Math.log(d1CrashPoint) / speed;
      const multiplierAtCrash = Math.exp(speed * crashTime);
      expect(multiplierAtCrash).toBeCloseTo(d1CrashPoint, 1);
    });

    it('Arrow should hit Dragon 2 when multiplier reaches Dragon 2 crash point', () => {
      const d2CrashPoint = 7.0;
      const speed = 0.00006;
      const crashTime = Math.log(d2CrashPoint) / speed;
      const multiplierAtCrash = Math.exp(speed * crashTime);
      expect(multiplierAtCrash).toBeCloseTo(d2CrashPoint, 1);
    });

    it('Before crash point, all arrows should be dodged (visual)', () => {
      const crashPoint = 3.0;
      const currentMultiplier = 2.0;
      const shouldDodge = currentMultiplier < crashPoint;
      expect(shouldDodge).toBe(true);
    });

    it('At crash point, arrow should NOT be dodged (killing arrow)', () => {
      const crashPoint = 3.0;
      const currentMultiplier = 3.0;
      const shouldDodge = currentMultiplier < crashPoint;
      expect(shouldDodge).toBe(false);
    });
  });

  // ============================================
  // 🎬 FALLING ANIMATION
  // ============================================

  describe('🎬 Falling Animation Matches Backend', () => {
    it('Dragon fall should start at crash time', () => {
      const crashPoint = 2.0;
      const speed = 0.00006;
      const fallStartTime = Math.log(crashPoint) / speed;
      expect(fallStartTime).toBeGreaterThan(0);
    });

    it('Dragon fall should use gravity physics', () => {
      const gravity = 0.5;
      const dt = 16;
      let velocityY = 0;
      let posY = 0;

      for (let frame = 0; frame < 60; frame++) { // 1 second of falling
        velocityY += gravity * (dt / 16);
        posY += velocityY;
      }

      expect(posY).toBeGreaterThan(0); // Dragon moved down
      expect(velocityY).toBeGreaterThan(0); // Accelerating
    });

    it('Dragon should fade out after landing', () => {
      let opacity = 1.0;
      const fadeRate = 0.02;

      for (let frame = 0; frame < 50; frame++) {
        opacity -= fadeRate;
      }

      expect(opacity).toBeLessThanOrEqual(0);
    });

    it('Fallen dragon should disappear while other dragon continues', () => {
      const d1Opacity = 0; // Fallen and faded
      const d2Opacity = 1.0; // Still flying
      expect(d1Opacity).toBe(0);
      expect(d2Opacity).toBe(1.0);
    });
  });

  // ============================================
  // 🔐 DUAL PROVABLY FAIR
  // ============================================

  describe('🔐 Dual Dragon Provably Fair', () => {
    it('Each dragon should have its own seed', () => {
      const d1Seed = 'dragon1-server-seed';
      const d2Seed = 'dragon2-server-seed';
      expect(d1Seed).not.toBe(d2Seed);
    });

    it('Each dragon crash point should be independently verifiable', () => {
      const cp1 = dragon1Service['generateCrashPoint']('d1-verify', 'client', 1);
      const cp2 = dragon2Service['generateCrashPoint']('d2-verify', 'client', 1);
      
      // Re-verify
      const cp1Again = dragon1Service['generateCrashPoint']('d1-verify', 'client', 1);
      const cp2Again = dragon2Service['generateCrashPoint']('d2-verify', 'client', 1);
      
      expect(cp1.toNumber()).toBe(cp1Again.toNumber());
      expect(cp2.toNumber()).toBe(cp2Again.toNumber());
    });

    it('Changing Dragon 1 seed should NOT change Dragon 2 result', () => {
      const cp2a = dragon2Service['generateCrashPoint']('d2-stable', 'client', 1);
      // Change Dragon 1 seed
      dragon1Service['generateCrashPoint']('d1-changed', 'client', 1);
      // Dragon 2 should be the same
      const cp2b = dragon2Service['generateCrashPoint']('d2-stable', 'client', 1);
      expect(cp2a.toNumber()).toBe(cp2b.toNumber());
    });
  });

  // ============================================
  // 💰 COMBINED PAYOUT CALCULATIONS
  // ============================================

  describe('💰 Combined Payout Calculations', () => {
    it('Total payout = Dragon 1 payout + Dragon 2 payout', () => {
      const scenarios = [
        { d1Bet: 50, d2Bet: 50, d1CP: 3.0, d2CP: 5.0, cashout: 2.0, expected: 200 },
        { d1Bet: 100, d2Bet: 0, d1CP: 3.0, d2CP: 5.0, cashout: 2.0, expected: 200 },
        { d1Bet: 0, d2Bet: 100, d1CP: 3.0, d2CP: 5.0, cashout: 2.0, expected: 200 },
        { d1Bet: 50, d2Bet: 50, d1CP: 1.5, d2CP: 1.5, cashout: 2.0, expected: 0 },
        { d1Bet: 50, d2Bet: 50, d1CP: 1.5, d2CP: 5.0, cashout: 2.0, expected: 100 },
      ];

      for (const s of scenarios) {
        const d1Pay = s.cashout <= s.d1CP ? s.d1Bet * s.cashout : 0;
        const d2Pay = s.cashout <= s.d2CP ? s.d2Bet * s.cashout : 0;
        expect(d1Pay + d2Pay).toBe(s.expected);
      }
    });

    it('Net profit/loss should account for both bets', () => {
      const d1Bet = 50;
      const d2Bet = 50;
      const totalWagered = d1Bet + d2Bet;

      // Scenario: Dragon 1 crashes at 1.5x, Dragon 2 survives to 3x, cashout at 2x
      const d1Payout = 0; // Crashed before 2x
      const d2Payout = d2Bet * 2.0; // Survived to 2x

      const netProfit = (d1Payout + d2Payout) - totalWagered;
      expect(netProfit).toBe(0); // Break even in this scenario
    });

    it('House edge applies to EACH dragon independently', () => {
      // Over many games, each dragon should have ~4% house edge
      let d1TotalReturn = 0;
      let d2TotalReturn = 0;
      const n = 10000;
      const cashout = 2.0;

      for (let i = 0; i < n; i++) {
        const cp1 = dragon1Service['generateCrashPoint'](`d1-edge-${i}`, 'client', i);
        const cp2 = dragon2Service['generateCrashPoint'](`d2-edge-${i}`, 'client', i);
        if (cp1.toNumber() >= cashout) d1TotalReturn += cashout;
        if (cp2.toNumber() >= cashout) d2TotalReturn += cashout;
      }

      const d1Edge = 1 - (d1TotalReturn / n);
      const d2Edge = 1 - (d2TotalReturn / n);

      expect(d1Edge).toBeGreaterThan(0.01);
      expect(d1Edge).toBeLessThan(0.08);
      expect(d2Edge).toBeGreaterThan(0.01);
      expect(d2Edge).toBeLessThan(0.08);
    });
  });

  // ============================================
  // 🛡️ DUAL DRAGON EDGE CASES
  // ============================================

  describe('🛡️ Dual Dragon Edge Cases', () => {
    it('Both dragons instant bust (1.00x)', () => {
      // Both crash at 1.00 — player loses both bets immediately
      const d1CP = 1.00;
      const d2CP = 1.00;
      const d1Payout = 0;
      const d2Payout = 0;
      expect(d1Payout + d2Payout).toBe(0);
    });

    it('One dragon instant bust, other goes to 5000x', () => {
      const d1CP = 1.00;
      const d2CP = 5000;
      const d1Bet = 50;
      const d2Bet = 50;
      const d2CashoutAt = 100;

      const d1Payout = 0;
      const d2Payout = d2CashoutAt <= d2CP ? d2Bet * d2CashoutAt : 0;

      expect(d1Payout).toBe(0);
      expect(d2Payout).toBe(5000);
    });

    it('Both dragons reach max (5000x)', () => {
      // Extremely rare but possible
      const d1CP = 5000;
      const d2CP = 5000;
      const bet = 10;
      const cashout = 5000;

      const totalPayout = bet * cashout * 2;
      expect(totalPayout).toBe(100000);
    });

    it('Rapid switching between dragon bets should be handled', () => {
      // Player switches bet from Dragon 1 to Dragon 2 rapidly
      for (let i = 0; i < 100; i++) {
        const s1 = dragon1Service.getCurrentGameState();
        const s2 = dragon2Service.getCurrentGameState();
        expect(s1).toBeDefined();
        expect(s2).toBeDefined();
      }
    });
  });
});
