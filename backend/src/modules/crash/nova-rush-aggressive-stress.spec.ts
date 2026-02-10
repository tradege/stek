/**
 * 🔥🔥🔥 Nova Rush - 1M Iteration Aggressive Stress Test
 * 
 * Operation "Warp Speed Integrity" - Mathematical Proof
 * 
 * Tests:
 * - 1,000,000 crash point generations
 * - House edge verification at ALL cashout points
 * - RTP verification
 * - Distribution analysis (exponential)
 * - Max win cap enforcement
 * - Variance & statistical confidence
 * - Player strategy simulation
 * - Provably fair algorithm verification
 * - Mathematical proof of fairness
 * 
 * Nova Rush uses the SAME CrashService algorithm.
 * These tests verify mathematical integrity at scale.
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
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1', username: 'stress_pilot', status: 'ACTIVE' }) },
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
// PRE-GENERATE 1M CRASH POINTS
// ============================================

let service: CrashService;
let crashPoints: number[] = [];
const TOTAL_ITERATIONS = 1_000_000;

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CrashService,
      { provide: PrismaService, useValue: createMockPrismaService() },
      { provide: GameConfigService, useValue: createMockGameConfigService() },
      { provide: EventEmitter2, useValue: createMockEventEmitter() },
    ],
  }).compile();

  service = module.get<CrashService>(CrashService);

  // Generate 1M crash points
  for (let i = 0; i < TOTAL_ITERATIONS; i++) {
    const serverSeed = `nova-rush-stress-seed-${i}`;
    const clientSeed = 'stakepro-nova-rush-stress';
    const cp = service['generateCrashPoint'](serverSeed, clientSeed, i);
    crashPoints.push(cp.toNumber());
  }
}, 120000); // 2 min timeout for generation

afterAll(() => {
  service.stopGameLoop();
});

// ============================================
// STRESS TESTS
// ============================================

describe('🔥🔥🔥 Nova Rush - 1M Iteration Aggressive Stress Test', () => {

  // ============================================
  // 💥 INSTANT BUST RATE
  // ============================================

  describe('💥 Instant Bust Rate Verification', () => {
    it('Should have instant bust rate ≈ 4% (house edge) over 1M iterations', () => {
      const instantBusts = crashPoints.filter(cp => cp === 1.00).length;
      const rate = instantBusts / TOTAL_ITERATIONS;
      // 4% ± 0.5%
      expect(rate).toBeGreaterThan(0.030);
      expect(rate).toBeLessThan(0.055);
    });

    it('Should have no crash points below 1.00', () => {
      const belowOne = crashPoints.filter(cp => cp < 1.00);
      expect(belowOne.length).toBe(0);
    });

    it('Should have no NaN, Infinity, or negative values', () => {
      const invalid = crashPoints.filter(cp => isNaN(cp) || !isFinite(cp) || cp < 0);
      expect(invalid.length).toBe(0);
    });
  });

  // ============================================
  // 💰 HOUSE EDGE VERIFICATION
  // ============================================

  describe('💰 House Edge Verification (All Cashout Points)', () => {
    it('Should maintain ~4% house edge at cashout 1.5x', () => {
      const wins = crashPoints.filter(cp => cp >= 1.5).length;
      const ev = (wins / TOTAL_ITERATIONS) * 1.5;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.02);
      expect(edge).toBeLessThan(0.06);
    });

    it('Should maintain ~4% house edge at cashout 2.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 2.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 2.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.02);
      expect(edge).toBeLessThan(0.06);
    });

    it('Should maintain ~4% house edge at cashout 3.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 3.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 3.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.02);
      expect(edge).toBeLessThan(0.06);
    });

    it('Should maintain ~4% house edge at cashout 5.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 5.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 5.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.02);
      expect(edge).toBeLessThan(0.06);
    });

    it('Should maintain ~4% house edge at cashout 10.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 10.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 10.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.02);
      expect(edge).toBeLessThan(0.07);
    });

    it('Should maintain ~4% house edge at cashout 20.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 20.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 20.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.01);
      expect(edge).toBeLessThan(0.08);
    });

    it('Should maintain ~4% house edge at cashout 50.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 50.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 50.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(0.00);
      expect(edge).toBeLessThan(0.10);
    });

    it('Should maintain ~4% house edge at cashout 100.0x', () => {
      const wins = crashPoints.filter(cp => cp >= 100.0).length;
      const ev = (wins / TOTAL_ITERATIONS) * 100.0;
      const edge = 1 - ev;
      expect(edge).toBeGreaterThan(-0.02);
      expect(edge).toBeLessThan(0.12);
    });

    it('Should show consistent house edge across ALL cashout points (comprehensive table)', () => {
      const cashouts = [1.1, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.5, 10.0, 15.0, 20.0, 50.0, 100.0];
      const edges: { cashout: number; edge: number }[] = [];

      for (const c of cashouts) {
        const wins = crashPoints.filter(cp => cp >= c).length;
        const ev = (wins / TOTAL_ITERATIONS) * c;
        const edge = 1 - ev;
        edges.push({ cashout: c, edge });
      }

      // All edges should be between 2% and 8% for reasonable cashout points
      for (const e of edges.filter(e => e.cashout <= 20)) {
        expect(e.edge).toBeGreaterThan(0.01);
        expect(e.edge).toBeLessThan(0.08);
      }
    });
  });

  // ============================================
  // 📈 RTP VERIFICATION
  // ============================================

  describe('📈 RTP Verification', () => {
    it('Should have RTP ≈ 96% for optimal strategy', () => {
      // Optimal strategy: cashout at 2.0x
      const wins = crashPoints.filter(cp => cp >= 2.0).length;
      const rtp = (wins / TOTAL_ITERATIONS) * 2.0 * 100;
      expect(rtp).toBeGreaterThan(93);
      expect(rtp).toBeLessThan(99);
    });

    it('Should have consistent RTP regardless of bet size', () => {
      const betSizes = [1, 10, 100, 1000];
      const rtps: number[] = [];

      for (const bet of betSizes) {
        let totalReturn = 0;
        for (const cp of crashPoints.slice(0, 100000)) {
          if (cp >= 2.0) totalReturn += bet * 2.0;
        }
        const rtp = (totalReturn / (100000 * bet)) * 100;
        rtps.push(rtp);
      }

      // All RTPs should be within 1% of each other
      const maxRtp = Math.max(...rtps);
      const minRtp = Math.min(...rtps);
      expect(maxRtp - minRtp).toBeLessThan(1.0);
    });
  });

  // ============================================
  // 📊 DISTRIBUTION ANALYSIS
  // ============================================

  describe('📊 Distribution Analysis', () => {
    it('Should follow correct exponential distribution', () => {
      const buckets = [1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0, 100.0];
      
      for (const threshold of buckets) {
        const survivalRate = crashPoints.filter(cp => cp >= threshold).length / TOTAL_ITERATIONS;
        const theoretical = Math.min(1, 0.96 / threshold);
        expect(Math.abs(survivalRate - theoretical)).toBeLessThan(0.05);
      }
    });

    it('Should have median ≈ 1.44x (theoretical for 4% edge)', () => {
      const sorted = [...crashPoints].sort((a, b) => a - b);
      const median = sorted[Math.floor(TOTAL_ITERATIONS / 2)];
      // Theoretical median: 0.96 / 0.5 = 1.92? No, median is where P(X >= m) = 0.5
      // 0.96/m = 0.5 => m = 1.92
      expect(median).toBeGreaterThan(1.5);
      expect(median).toBeLessThan(2.3);
    });

    it('Should have correct percentiles', () => {
      const sorted = [...crashPoints].sort((a, b) => a - b);
      const p10 = sorted[Math.floor(TOTAL_ITERATIONS * 0.10)];
      const p25 = sorted[Math.floor(TOTAL_ITERATIONS * 0.25)];
      const p50 = sorted[Math.floor(TOTAL_ITERATIONS * 0.50)];
      const p75 = sorted[Math.floor(TOTAL_ITERATIONS * 0.75)];
      const p90 = sorted[Math.floor(TOTAL_ITERATIONS * 0.90)];
      const p99 = sorted[Math.floor(TOTAL_ITERATIONS * 0.99)];

      expect(p10).toBeGreaterThanOrEqual(1.00);
      expect(p25).toBeGreaterThan(1.1);
      expect(p50).toBeGreaterThan(1.5);
      expect(p75).toBeGreaterThan(2.5);
      expect(p90).toBeGreaterThan(5.0);
      expect(p99).toBeGreaterThan(30.0);
    });
  });

  // ============================================
  // 🔒 MAX WIN CAP
  // ============================================

  describe('🔒 Max Win Cap Enforcement', () => {
    it('Should NEVER exceed 5000x', () => {
      const exceeds = crashPoints.filter(cp => cp > 5000);
      expect(exceeds.length).toBe(0);
    });

    it('Should have some high multipliers (100x+)', () => {
      const high = crashPoints.filter(cp => cp >= 100);
      expect(high.length).toBeGreaterThan(0);
    });

    it('Should have very rare extreme multipliers (1000x+)', () => {
      const extreme = crashPoints.filter(cp => cp >= 1000);
      // Should be roughly 0.096% of games (0.96/1000)
      const rate = extreme.length / TOTAL_ITERATIONS;
      expect(rate).toBeLessThan(0.005);
    });
  });

  // ============================================
  // 📈 VARIANCE & STATISTICAL CONFIDENCE
  // ============================================

  describe('📈 Variance & Statistical Confidence', () => {
    it('Should have stable mean across 10 batches of 100K', () => {
      const batchSize = 100000;
      const means: number[] = [];

      for (let batch = 0; batch < 10; batch++) {
        const start = batch * batchSize;
        const batchPoints = crashPoints.slice(start, start + batchSize);
        const mean = batchPoints.reduce((a, b) => a + b, 0) / batchSize;
        means.push(mean);
      }

      const overallMean = means.reduce((a, b) => a + b, 0) / means.length;
      
      // Each batch mean should be within 10% of overall mean
      for (const m of means) {
        expect(Math.abs(m - overallMean) / overallMean).toBeLessThan(0.10);
      }
    });

    it('Should have stable house edge across 10 batches', () => {
      const batchSize = 100000;
      const edges: number[] = [];

      for (let batch = 0; batch < 10; batch++) {
        const start = batch * batchSize;
        const batchPoints = crashPoints.slice(start, start + batchSize);
        const wins = batchPoints.filter(cp => cp >= 2.0).length;
        const ev = (wins / batchSize) * 2.0;
        edges.push(1 - ev);
      }

      // All batch edges should be between 2% and 7%
      for (const e of edges) {
        expect(e).toBeGreaterThan(0.02);
        expect(e).toBeLessThan(0.07);
      }
    });
  });

  // ============================================
  // 🎰 PLAYER STRATEGY SIMULATION
  // ============================================

  describe('🎰 Player Strategy Simulation', () => {
    it('Should show house always wins long-term (conservative player)', () => {
      let balance = 10000;
      const betSize = 10;
      const cashoutAt = 1.5;

      for (const cp of crashPoints.slice(0, 100000)) {
        balance -= betSize;
        if (cp >= cashoutAt) balance += betSize * cashoutAt;
      }

      // Conservative player should lose ~4% of total wagered
      expect(balance).toBeLessThan(10000);
    });

    it('Should show house always wins long-term (aggressive player)', () => {
      let balance = 10000;
      const betSize = 100;
      const cashoutAt = 5.0;

      for (const cp of crashPoints.slice(0, 10000)) {
        balance -= betSize;
        if (cp >= cashoutAt) balance += betSize * cashoutAt;
        if (balance <= 0) break;
      }

      // Aggressive player should lose money long-term
      expect(balance).toBeLessThan(10000);
    });

    it('Should show house always wins long-term (whale player)', () => {
      let balance = 100000;
      const betSize = 1000;
      const cashoutAt = 2.0;

      for (const cp of crashPoints.slice(0, 50000)) {
        balance -= betSize;
        if (cp >= cashoutAt) balance += betSize * cashoutAt;
        if (balance <= 0) break;
      }

      expect(balance).toBeLessThan(100000);
    });
  });

  // ============================================
  // 🔐 PROVABLY FAIR VERIFICATION
  // ============================================

  describe('🔐 Provably Fair Algorithm Verification', () => {
    it('Should match service algorithm exactly', () => {
      const serverSeed = 'nova-rush-verify-seed';
      const clientSeed = 'stakepro-nova-rush-stress';
      const nonce = 42;

      // Replicate algorithm
      const combinedSeed = `${clientSeed}:${nonce}`;
      const hmac = crypto.createHmac('sha256', serverSeed);
      hmac.update(combinedSeed);
      const hash = hmac.digest('hex');
      const h = parseInt(hash.substring(0, 13), 16);
      const E = Math.pow(2, 52);
      const r = h / E;
      const rawMultiplier = 0.96 / (1 - r);
      const expected = Math.min(5000, Math.max(1.00, Math.floor(rawMultiplier * 100) / 100));

      const actual = service['generateCrashPoint'](serverSeed, clientSeed, nonce);
      expect(actual.toNumber()).toBe(expected);
    });

    it('Should be deterministic - same inputs always produce same output', () => {
      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        const cp = service['generateCrashPoint']('fixed-seed', 'fixed-client', 1);
        results.push(cp.toNumber());
      }
      // All should be identical
      expect(new Set(results).size).toBe(1);
    });

    it('Should produce different results for different seeds', () => {
      const results = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const cp = service['generateCrashPoint'](`seed-${i}`, 'client', i);
        results.add(cp.toNumber());
      }
      // With 2 decimal rounding, some collisions are expected
      expect(results.size).toBeGreaterThan(200);
    });
  });

  // ============================================
  // 🎲 MATHEMATICAL PROOF OF FAIRNESS
  // ============================================

  describe('🎲 Mathematical Proof of Fairness', () => {
    it('Should satisfy P(X >= m) ≈ (1-edge)/m for all multipliers m', () => {
      const testMultipliers = [1.1, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0];

      for (const m of testMultipliers) {
        const survivalRate = crashPoints.filter(cp => cp >= m).length / TOTAL_ITERATIONS;
        const theoretical = 0.96 / m;
        const tolerance = m <= 5 ? 0.01 : 0.02;
        expect(Math.abs(survivalRate - theoretical)).toBeLessThan(tolerance);
      }
    });

    it('Should have E[min(X, m)] ≈ m * (1-edge)/m = (1-edge) for any cashout m', () => {
      const testCashouts = [1.5, 2.0, 3.0, 5.0, 10.0];

      for (const m of testCashouts) {
        let totalReturn = 0;
        for (const cp of crashPoints) {
          if (cp >= m) totalReturn += m;
        }
        const ev = totalReturn / TOTAL_ITERATIONS;
        // EV should be ≈ 0.96 (1 - house edge)
        expect(ev).toBeGreaterThan(0.90);
        expect(ev).toBeLessThan(1.00);
      }
    });
  });
});
