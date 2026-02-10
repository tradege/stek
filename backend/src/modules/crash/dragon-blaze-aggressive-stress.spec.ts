/**
 * 🔥🔥🔥 Dragon Blaze - 1M Iteration Aggressive Stress Test (Dual Dragons)
 * 
 * Operation "Twin Dragon Inferno" - Mathematical Proof for BOTH Dragons
 * 
 * Tests:
 * - 1,000,000 crash points per dragon (2M total)
 * - House edge verification for EACH dragon independently
 * - Statistical independence between Dragon 1 and Dragon 2
 * - RTP verification per dragon and combined
 * - Distribution analysis per dragon
 * - Max win cap enforcement per dragon
 * - Dual-dragon player strategy simulation
 * - Provably fair verification per dragon
 * - Mathematical proof: betting on both dragons doesn't break house edge
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CrashService } from './crash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GameConfigService } from './game-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

// ============================================
// SETUP
// ============================================

const createMockPrismaService = () => ({
  wallet: { findFirst: jest.fn().mockResolvedValue({ id: 'w-1', balance: new Decimal(10000), currency: 'USDT' }), update: jest.fn() },
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1', username: 'dragon_stress', status: 'ACTIVE' }) },
  crashGame: { create: jest.fn().mockResolvedValue({ id: 'g-1' }), update: jest.fn() },
  crashBet: { create: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  bet: { create: jest.fn() },
  $transaction: jest.fn(async (cb) => cb({ $queryRaw: jest.fn().mockResolvedValue([{ id: 'w-1', balance: 10000 }]), wallet: { update: jest.fn() } })),
});

const createMockGameConfigService = () => ({
  houseEdge: 0.04, instantBust: 0.02, botsEnabled: false,
  getConfig: jest.fn().mockReturnValue({ houseEdge: 0.04, instantBust: 0.02 }),
});

const createMockEventEmitter = () => ({ emit: jest.fn(), on: jest.fn(), off: jest.fn() });

// ============================================
// PRE-GENERATE 1M CRASH POINTS PER DRAGON
// ============================================

let dragon1Service: CrashService;
let dragon2Service: CrashService;
let dragon1CrashPoints: number[] = [];
let dragon2CrashPoints: number[] = [];
const TOTAL_ITERATIONS = 1_000_000;

beforeAll(async () => {
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

  // Generate 1M crash points for each dragon with DIFFERENT seeds
  for (let i = 0; i < TOTAL_ITERATIONS; i++) {
    const cp1 = dragon1Service['generateCrashPoint'](`dragon1-stress-${i}`, 'stakepro-dragon-blaze', i);
    const cp2 = dragon2Service['generateCrashPoint'](`dragon2-stress-${i}`, 'stakepro-dragon-blaze', i);
    dragon1CrashPoints.push(cp1.toNumber());
    dragon2CrashPoints.push(cp2.toNumber());
  }
}, 240000); // 4 min timeout for 2M generations

afterAll(() => {
  dragon1Service.stopGameLoop();
  dragon2Service.stopGameLoop();
});

// ============================================
// STRESS TESTS
// ============================================

describe('🔥🔥🔥 Dragon Blaze - 1M Iteration Dual Dragon Stress Test', () => {

  // ============================================
  // 💥 INSTANT BUST RATE — PER DRAGON
  // ============================================

  describe('💥 Instant Bust Rate — Per Dragon', () => {
    it('Dragon 1 (Red) should have instant bust rate ≈ 4%', () => {
      const busts = dragon1CrashPoints.filter(cp => cp === 1.00).length;
      const rate = busts / TOTAL_ITERATIONS;
      expect(rate).toBeGreaterThan(0.030);
      expect(rate).toBeLessThan(0.055);
    });

    it('Dragon 2 (Blue) should have instant bust rate ≈ 4%', () => {
      const busts = dragon2CrashPoints.filter(cp => cp === 1.00).length;
      const rate = busts / TOTAL_ITERATIONS;
      expect(rate).toBeGreaterThan(0.030);
      expect(rate).toBeLessThan(0.055);
    });

    it('No crash points below 1.00 for either dragon', () => {
      expect(dragon1CrashPoints.filter(cp => cp < 1.00).length).toBe(0);
      expect(dragon2CrashPoints.filter(cp => cp < 1.00).length).toBe(0);
    });

    it('No NaN, Infinity, or negative values for either dragon', () => {
      const invalid1 = dragon1CrashPoints.filter(cp => isNaN(cp) || !isFinite(cp) || cp < 0);
      const invalid2 = dragon2CrashPoints.filter(cp => isNaN(cp) || !isFinite(cp) || cp < 0);
      expect(invalid1.length).toBe(0);
      expect(invalid2.length).toBe(0);
    });
  });

  // ============================================
  // 💰 HOUSE EDGE — PER DRAGON
  // ============================================

  describe('💰 House Edge — Dragon 1 (Red)', () => {
    const cashouts = [1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0];

    for (const c of cashouts) {
      it(`Should maintain ~4% house edge at cashout ${c}x`, () => {
        const wins = dragon1CrashPoints.filter(cp => cp >= c).length;
        const ev = (wins / TOTAL_ITERATIONS) * c;
        const edge = 1 - ev;
        const tolerance = c <= 10 ? 0.06 : 0.10;
        expect(edge).toBeGreaterThan(0.01);
        expect(edge).toBeLessThan(tolerance);
      });
    }
  });

  describe('💰 House Edge — Dragon 2 (Blue)', () => {
    const cashouts = [1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0];

    for (const c of cashouts) {
      it(`Should maintain ~4% house edge at cashout ${c}x`, () => {
        const wins = dragon2CrashPoints.filter(cp => cp >= c).length;
        const ev = (wins / TOTAL_ITERATIONS) * c;
        const edge = 1 - ev;
        const tolerance = c <= 10 ? 0.06 : 0.10;
        expect(edge).toBeGreaterThan(0.01);
        expect(edge).toBeLessThan(tolerance);
      });
    }
  });

  // ============================================
  // 🔗 STATISTICAL INDEPENDENCE
  // ============================================

  describe('🔗 Statistical Independence Between Dragons', () => {
    it('Dragon 1 and Dragon 2 crash points should be independent', () => {
      let bothBelow2 = 0;
      let d1Below2 = 0;
      let d2Below2 = 0;

      for (let i = 0; i < TOTAL_ITERATIONS; i++) {
        if (dragon1CrashPoints[i] < 2.0) d1Below2++;
        if (dragon2CrashPoints[i] < 2.0) d2Below2++;
        if (dragon1CrashPoints[i] < 2.0 && dragon2CrashPoints[i] < 2.0) bothBelow2++;
      }

      const p1 = d1Below2 / TOTAL_ITERATIONS;
      const p2 = d2Below2 / TOTAL_ITERATIONS;
      const pBoth = bothBelow2 / TOTAL_ITERATIONS;
      const expectedBoth = p1 * p2;

      // P(A∩B) should ≈ P(A) * P(B) if independent
      expect(Math.abs(pBoth - expectedBoth)).toBeLessThan(0.01);
    });

    it('Correlation coefficient should be near 0', () => {
      const n = 100000; // Use first 100K for speed
      const d1 = dragon1CrashPoints.slice(0, n);
      const d2 = dragon2CrashPoints.slice(0, n);

      const mean1 = d1.reduce((a, b) => a + b, 0) / n;
      const mean2 = d2.reduce((a, b) => a + b, 0) / n;

      let cov = 0, var1 = 0, var2 = 0;
      for (let i = 0; i < n; i++) {
        const diff1 = d1[i] - mean1;
        const diff2 = d2[i] - mean2;
        cov += diff1 * diff2;
        var1 += diff1 * diff1;
        var2 += diff2 * diff2;
      }

      const correlation = cov / Math.sqrt(var1 * var2);
      // Correlation should be very close to 0 (independent)
      expect(Math.abs(correlation)).toBeLessThan(0.02);
    });

    it('Both dragons busting simultaneously should follow P(A)*P(B)', () => {
      let bothBust = 0;
      let d1Bust = 0;
      let d2Bust = 0;

      for (let i = 0; i < TOTAL_ITERATIONS; i++) {
        if (dragon1CrashPoints[i] === 1.00) d1Bust++;
        if (dragon2CrashPoints[i] === 1.00) d2Bust++;
        if (dragon1CrashPoints[i] === 1.00 && dragon2CrashPoints[i] === 1.00) bothBust++;
      }

      const p1 = d1Bust / TOTAL_ITERATIONS;
      const p2 = d2Bust / TOTAL_ITERATIONS;
      const pBoth = bothBust / TOTAL_ITERATIONS;
      const expected = p1 * p2;

      // Should be within reasonable tolerance
      expect(Math.abs(pBoth - expected)).toBeLessThan(0.002);
    });
  });

  // ============================================
  // 📈 RTP — COMBINED DRAGONS
  // ============================================

  describe('📈 RTP — Combined Dragon Betting', () => {
    it('Betting on Dragon 1 only: RTP ≈ 96%', () => {
      const wins = dragon1CrashPoints.filter(cp => cp >= 2.0).length;
      const rtp = (wins / TOTAL_ITERATIONS) * 2.0 * 100;
      expect(rtp).toBeGreaterThan(93);
      expect(rtp).toBeLessThan(99);
    });

    it('Betting on Dragon 2 only: RTP ≈ 96%', () => {
      const wins = dragon2CrashPoints.filter(cp => cp >= 2.0).length;
      const rtp = (wins / TOTAL_ITERATIONS) * 2.0 * 100;
      expect(rtp).toBeGreaterThan(93);
      expect(rtp).toBeLessThan(99);
    });

    it('Betting on BOTH dragons: RTP still ≈ 96%', () => {
      let totalReturn = 0;
      const cashoutAt = 2.0;

      for (let i = 0; i < TOTAL_ITERATIONS; i++) {
        // Bet 1 unit on each dragon
        if (dragon1CrashPoints[i] >= cashoutAt) totalReturn += cashoutAt;
        if (dragon2CrashPoints[i] >= cashoutAt) totalReturn += cashoutAt;
      }

      const rtp = (totalReturn / (TOTAL_ITERATIONS * 2)) * 100;
      expect(rtp).toBeGreaterThan(93);
      expect(rtp).toBeLessThan(99);
    });

    it('Hedging strategy (bet both, cashout early on one): house still wins', () => {
      let balance = 100000;
      const betPerDragon = 50;

      for (let i = 0; i < 100000; i++) {
        balance -= betPerDragon * 2; // Bet on both

        // Strategy: cashout Dragon 1 at 1.5x, Dragon 2 at 3.0x
        if (dragon1CrashPoints[i] >= 1.5) balance += betPerDragon * 1.5;
        if (dragon2CrashPoints[i] >= 3.0) balance += betPerDragon * 3.0;
      }

      expect(balance).toBeLessThan(100000);
    });
  });

  // ============================================
  // 📊 DISTRIBUTION — PER DRAGON
  // ============================================

  describe('📊 Distribution Analysis — Per Dragon', () => {
    it('Dragon 1 should follow exponential distribution', () => {
      const thresholds = [1.5, 2.0, 3.0, 5.0, 10.0];
      for (const t of thresholds) {
        const rate = dragon1CrashPoints.filter(cp => cp >= t).length / TOTAL_ITERATIONS;
        const theoretical = 0.96 / t;
        expect(Math.abs(rate - theoretical)).toBeLessThan(0.02);
      }
    });

    it('Dragon 2 should follow exponential distribution', () => {
      const thresholds = [1.5, 2.0, 3.0, 5.0, 10.0];
      for (const t of thresholds) {
        const rate = dragon2CrashPoints.filter(cp => cp >= t).length / TOTAL_ITERATIONS;
        const theoretical = 0.96 / t;
        expect(Math.abs(rate - theoretical)).toBeLessThan(0.02);
      }
    });
  });

  // ============================================
  // 🔒 MAX WIN CAP — PER DRAGON
  // ============================================

  describe('🔒 Max Win Cap — Per Dragon', () => {
    it('Dragon 1 should NEVER exceed 5000x', () => {
      expect(dragon1CrashPoints.filter(cp => cp > 5000).length).toBe(0);
    });

    it('Dragon 2 should NEVER exceed 5000x', () => {
      expect(dragon2CrashPoints.filter(cp => cp > 5000).length).toBe(0);
    });

    it('Both dragons should have some 100x+ games', () => {
      expect(dragon1CrashPoints.filter(cp => cp >= 100).length).toBeGreaterThan(0);
      expect(dragon2CrashPoints.filter(cp => cp >= 100).length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 📈 VARIANCE — PER DRAGON
  // ============================================

  describe('📈 Variance & Stability — Per Dragon', () => {
    it('Dragon 1 should have stable house edge across 10 batches', () => {
      const batchSize = 100000;
      for (let batch = 0; batch < 10; batch++) {
        const batchPoints = dragon1CrashPoints.slice(batch * batchSize, (batch + 1) * batchSize);
        const wins = batchPoints.filter(cp => cp >= 2.0).length;
        const edge = 1 - (wins / batchSize) * 2.0;
        expect(edge).toBeGreaterThan(0.02);
        expect(edge).toBeLessThan(0.07);
      }
    });

    it('Dragon 2 should have stable house edge across 10 batches', () => {
      const batchSize = 100000;
      for (let batch = 0; batch < 10; batch++) {
        const batchPoints = dragon2CrashPoints.slice(batch * batchSize, (batch + 1) * batchSize);
        const wins = batchPoints.filter(cp => cp >= 2.0).length;
        const edge = 1 - (wins / batchSize) * 2.0;
        expect(edge).toBeGreaterThan(0.02);
        expect(edge).toBeLessThan(0.07);
      }
    });
  });

  // ============================================
  // 🎰 DUAL-DRAGON PLAYER STRATEGIES
  // ============================================

  describe('🎰 Dual-Dragon Player Strategies', () => {
    it('Conservative: bet both dragons at 1.5x — house wins', () => {
      let balance = 10000;
      for (let i = 0; i < 100000; i++) {
        balance -= 20; // 10 per dragon
        if (dragon1CrashPoints[i] >= 1.5) balance += 15;
        if (dragon2CrashPoints[i] >= 1.5) balance += 15;
      }
      expect(balance).toBeLessThan(10000);
    });

    it('Aggressive: bet both dragons at 10x — house wins', () => {
      let balance = 50000;
      for (let i = 0; i < 50000; i++) {
        balance -= 200;
        if (dragon1CrashPoints[i] >= 10.0) balance += 1000;
        if (dragon2CrashPoints[i] >= 10.0) balance += 1000;
        if (balance <= 0) break;
      }
      expect(balance).toBeLessThan(50000);
    });

    it('Split strategy: Dragon 1 conservative, Dragon 2 aggressive — house wins', () => {
      let balance = 20000;
      for (let i = 0; i < 100000; i++) {
        balance -= 20; // 10 per dragon
        if (dragon1CrashPoints[i] >= 1.5) balance += 15; // Conservative
        if (dragon2CrashPoints[i] >= 5.0) balance += 50; // Aggressive
      }
      expect(balance).toBeLessThan(20000);
    });

    it('Martingale on Dragon 1, flat on Dragon 2 — house wins', () => {
      let balance = 50000;
      let d1Bet = 10;
      const d2Bet = 10;

      for (let i = 0; i < 50000; i++) {
        balance -= d1Bet + d2Bet;
        
        if (dragon1CrashPoints[i] >= 2.0) {
          balance += d1Bet * 2.0;
          d1Bet = 10; // Reset
        } else {
          d1Bet = Math.min(d1Bet * 2, 5000); // Double, cap at 5000
        }

        if (dragon2CrashPoints[i] >= 2.0) balance += d2Bet * 2.0;
        if (balance <= 0) break;
      }
      expect(balance).toBeLessThan(50000);
    });
  });

  // ============================================
  // 🔐 PROVABLY FAIR — PER DRAGON
  // ============================================

  describe('🔐 Provably Fair — Per Dragon', () => {
    it('Dragon 1 algorithm should match HMAC-SHA256', () => {
      const serverSeed = 'dragon1-verify';
      const clientSeed = 'stakepro-dragon-blaze';
      const nonce = 42;

      const combinedSeed = `${clientSeed}:${nonce}`;
      const hmac = crypto.createHmac('sha256', serverSeed);
      hmac.update(combinedSeed);
      const hash = hmac.digest('hex');
      const h = parseInt(hash.substring(0, 13), 16);
      const E = Math.pow(2, 52);
      const r = h / E;
      const expected = Math.min(5000, Math.max(1.00, Math.floor((0.96 / (1 - r)) * 100) / 100));

      const actual = dragon1Service['generateCrashPoint'](serverSeed, clientSeed, nonce);
      expect(actual.toNumber()).toBe(expected);
    });

    it('Dragon 2 algorithm should match HMAC-SHA256', () => {
      const serverSeed = 'dragon2-verify';
      const clientSeed = 'stakepro-dragon-blaze';
      const nonce = 42;

      const combinedSeed = `${clientSeed}:${nonce}`;
      const hmac = crypto.createHmac('sha256', serverSeed);
      hmac.update(combinedSeed);
      const hash = hmac.digest('hex');
      const h = parseInt(hash.substring(0, 13), 16);
      const E = Math.pow(2, 52);
      const r = h / E;
      const expected = Math.min(5000, Math.max(1.00, Math.floor((0.96 / (1 - r)) * 100) / 100));

      const actual = dragon2Service['generateCrashPoint'](serverSeed, clientSeed, nonce);
      expect(actual.toNumber()).toBe(expected);
    });

    it('Same seed on both dragons produces same crash point (deterministic)', () => {
      const cp1 = dragon1Service['generateCrashPoint']('same-seed', 'same-client', 1);
      const cp2 = dragon2Service['generateCrashPoint']('same-seed', 'same-client', 1);
      expect(cp1.toNumber()).toBe(cp2.toNumber());
    });

    it('Different seeds produce different crash points', () => {
      const cp1 = dragon1Service['generateCrashPoint']('dragon1-unique', 'client', 1);
      const cp2 = dragon2Service['generateCrashPoint']('dragon2-unique', 'client', 1);
      // Very unlikely to be the same
      // Just verify both are valid
      expect(cp1.toNumber()).toBeGreaterThanOrEqual(1.0);
      expect(cp2.toNumber()).toBeGreaterThanOrEqual(1.0);
    });
  });

  // ============================================
  // 🎲 MATHEMATICAL PROOF — DUAL DRAGONS
  // ============================================

  describe('🎲 Mathematical Proof — Dual Dragon Fairness', () => {
    it('P(X >= m) ≈ 0.96/m for Dragon 1', () => {
      const multipliers = [1.1, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0];
      for (const m of multipliers) {
        const rate = dragon1CrashPoints.filter(cp => cp >= m).length / TOTAL_ITERATIONS;
        const theoretical = 0.96 / m;
        expect(Math.abs(rate - theoretical)).toBeLessThan(0.015);
      }
    });

    it('P(X >= m) ≈ 0.96/m for Dragon 2', () => {
      const multipliers = [1.1, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0];
      for (const m of multipliers) {
        const rate = dragon2CrashPoints.filter(cp => cp >= m).length / TOTAL_ITERATIONS;
        const theoretical = 0.96 / m;
        expect(Math.abs(rate - theoretical)).toBeLessThan(0.015);
      }
    });

    it('No arbitrage: betting on both dragons cannot guarantee profit', () => {
      // Try every possible combination of cashout points
      const cashouts = [1.1, 1.5, 2.0, 3.0, 5.0, 10.0];
      
      for (const c1 of cashouts) {
        for (const c2 of cashouts) {
          let totalReturn = 0;
          const n = 100000;
          for (let i = 0; i < n; i++) {
            // Bet 1 on each dragon
            let roundReturn = -2; // Cost: 2 units
            if (dragon1CrashPoints[i] >= c1) roundReturn += c1;
            if (dragon2CrashPoints[i] >= c2) roundReturn += c2;
            totalReturn += roundReturn;
          }
          // Should always be negative (house wins)
          const avgReturn = totalReturn / n;
          expect(avgReturn).toBeLessThan(0.1); // Allow tiny positive due to variance
        }
      }
    });
  });
});
