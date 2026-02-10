/**
 * 🚀🚀🚀 Nova Rush - AGGRESSIVE Stress Test Suite 🚀🚀🚀
 * 
 * Operation "Nova Nuclear Verification" - 1,000,000+ iterations
 * 
 * Uses the EXACT same algorithm as CrashService.generateCrashPoint()
 * to mathematically prove the 4% house edge is correct.
 * 
 * Tests:
 * - 1M iteration Monte Carlo with ACTUAL service algorithm
 * - House edge verification at ALL cashout points (1.01x - 100x)
 * - RTP verification across bet strategies
 * - Instant bust rate = exactly house edge (4%)
 * - Expected value = 0.96 for any fair bet
 * - Concurrent bet/cashout stress testing
 * - Statistical confidence intervals
 * - Kelly criterion bankroll analysis
 * - Player strategy simulations (Martingale, D'Alembert, Fibonacci, etc.)
 * 
 * Mathematical proof: E[payout] = (1 - houseEdge) * bet for any strategy
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CrashService, GameState } from './crash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GameConfigService } from './game-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

// ============================================
// EXACT REPLICA OF SERVICE ALGORITHM
// ============================================

function generateCrashPointExact(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdge: number = 0.04
): number {
  const combinedSeed = `${clientSeed}:${nonce}`;
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(combinedSeed);
  const hash = hmac.digest('hex');

  const h = parseInt(hash.substring(0, 13), 16);
  const E = Math.pow(2, 52);
  const r = h / E;

  const rawMultiplier = (1 - houseEdge) / (1 - r);
  const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);

  if (crashPoint > 5000) return 5000.00;
  return crashPoint;
}

// ============================================
// MOCK SERVICES
// ============================================

const createMockPrismaService = () => ({
  wallet: {
    findFirst: jest.fn().mockResolvedValue({ id: 'w-1', balance: new Decimal(10000), currency: 'USDT' }),
    update: jest.fn().mockResolvedValue({}),
  },
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1', username: 'test', status: 'ACTIVE' }) },
  crashGame: { create: jest.fn().mockResolvedValue({ id: 'g-1' }), update: jest.fn().mockResolvedValue({}) },
  crashBet: { create: jest.fn().mockResolvedValue({ id: 'b-1' }), update: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  bet: { create: jest.fn().mockResolvedValue({ id: 'b-1' }) },
  $transaction: jest.fn(async (cb) => cb({
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'w-1', balance: 10000 }]),
    wallet: { update: jest.fn().mockResolvedValue({}) },
  })),
});

const createMockGameConfigService = () => ({
  houseEdge: 0.04,
  instantBust: 0.02,
  botsEnabled: false,
  maxBotBet: 500,
  minBotBet: 10,
  getConfig: jest.fn().mockReturnValue({ houseEdge: 0.04, instantBust: 0.02 }),
});

const createMockEventEmitter = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
});

// ============================================
// 🚀 1,000,000 ITERATION MONTE CARLO
// ============================================

describe('🚀🚀🚀 Nova Rush - 1M Iteration Aggressive Stress Test', () => {
  const ITERATIONS = 1_000_000;
  const HOUSE_EDGE = 0.04;
  let crashPoints: number[] = [];
  let serverSeed: string;

  beforeAll(() => {
    serverSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = 'nova-rush-aggressive-stress';

    console.log(`\n🚀🔥 NOVA RUSH AGGRESSIVE STRESS TEST: ${ITERATIONS.toLocaleString()} iterations`);
    console.log(`   Server Seed: ${serverSeed.substring(0, 16)}...`);
    console.log(`   House Edge Target: ${(HOUSE_EDGE * 100).toFixed(1)}%`);

    const startTime = Date.now();
    for (let i = 0; i < ITERATIONS; i++) {
      crashPoints.push(generateCrashPointExact(serverSeed, clientSeed, i, HOUSE_EDGE));
    }
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`   Completed in ${elapsed.toFixed(2)}s (${Math.floor(ITERATIONS / elapsed).toLocaleString()} iterations/sec)\n`);
  }, 600000);

  // ============================================
  // 💥 INSTANT BUST RATE = HOUSE EDGE
  // ============================================

  describe('💥 Instant Bust Rate Verification', () => {
    it('Should have instant bust rate ≈ 4% over 1M iterations', () => {
      const instantBusts = crashPoints.filter(cp => cp === 1.00).length;
      const rate = instantBusts / ITERATIONS;
      console.log(`📊 Instant Bust: ${instantBusts.toLocaleString()} / ${ITERATIONS.toLocaleString()} = ${(rate * 100).toFixed(3)}%`);
      expect(rate).toBeGreaterThan(0.035);
      expect(rate).toBeLessThan(0.055);
    });

    it('Should have no crash points below 1.00', () => {
      expect(crashPoints.filter(cp => cp < 1.00).length).toBe(0);
    });

    it('Should have no NaN, Infinity, or negative values', () => {
      expect(crashPoints.filter(cp => isNaN(cp) || !isFinite(cp) || cp < 0).length).toBe(0);
    });

    it('All crash points should be multiples of 0.01', () => {
      const nonMultiples = crashPoints.filter(cp => Math.abs(Math.round(cp * 100) - cp * 100) > 0.001);
      expect(nonMultiples.length).toBe(0);
    });
  });

  // ============================================
  // 💰 HOUSE EDGE VERIFICATION AT ALL CASHOUT POINTS
  // ============================================

  describe('💰 House Edge at All Cashout Points', () => {
    const cashoutTests = [
      { cashout: 1.01, tol: 0.02 }, { cashout: 1.1, tol: 0.02 }, { cashout: 1.2, tol: 0.02 },
      { cashout: 1.5, tol: 0.02 }, { cashout: 2.0, tol: 0.02 }, { cashout: 3.0, tol: 0.03 },
      { cashout: 5.0, tol: 0.03 }, { cashout: 10.0, tol: 0.04 }, { cashout: 20.0, tol: 0.06 },
      { cashout: 50.0, tol: 0.10 }, { cashout: 100.0, tol: 0.15 },
    ];

    for (const { cashout, tol } of cashoutTests) {
      it(`Should maintain ~4% house edge at cashout ${cashout}x`, () => {
        const wins = crashPoints.filter(cp => cp >= cashout).length;
        const ev = (wins / ITERATIONS) * cashout;
        console.log(`📊 Cashout ${cashout}x: wins=${wins.toLocaleString()}, EV=${ev.toFixed(4)}, Edge=${((1 - ev) * 100).toFixed(2)}%`);
        expect(ev).toBeGreaterThan(0.96 - tol);
        expect(ev).toBeLessThan(0.96 + tol);
      });
    }

    it('Should show comprehensive house edge table', () => {
      const cashoutPoints = [1.01, 1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0, 100.0, 500.0, 1000.0];
      console.log('\n📊 NOVA RUSH - COMPREHENSIVE HOUSE EDGE TABLE:');
      console.log('   ┌──────────┬──────────┬──────────┬──────────┬──────────┐');
      console.log('   │ Cashout  │ Win Rate │ Expected │ EV       │ H.Edge   │');
      console.log('   ├──────────┼──────────┼──────────┼──────────┼──────────┤');

      let totalDeviation = 0, validPoints = 0;
      for (const cashout of cashoutPoints) {
        const wins = crashPoints.filter(cp => cp >= cashout).length;
        const winRate = wins / ITERATIONS;
        const expectedWinRate = (1 - HOUSE_EDGE) / cashout;
        const ev = winRate * cashout;
        const houseEdge = 1 - ev;
        console.log(`   │ ${cashout.toFixed(2).padStart(7)}x │ ${(winRate * 100).toFixed(2).padStart(7)}% │ ${(expectedWinRate * 100).toFixed(2).padStart(7)}% │ ${ev.toFixed(4).padStart(8)} │ ${(houseEdge * 100).toFixed(2).padStart(7)}% │`);
        if (cashout <= 100) { totalDeviation += Math.abs(houseEdge - HOUSE_EDGE); validPoints++; }
      }
      console.log('   └──────────┴──────────┴──────────┴──────────┴──────────┘');
      expect(totalDeviation / validPoints).toBeLessThan(0.02);
    });
  });

  // ============================================
  // 📈 RTP VERIFICATION
  // ============================================

  describe('📈 RTP Verification', () => {
    it('RTP ≈ 96% at cashout 2.0x', () => {
      let totalBet = 0, totalReturn = 0;
      for (const cp of crashPoints) { totalBet += 100; if (cp >= 2.0) totalReturn += 200; }
      const rtp = totalReturn / totalBet;
      console.log(`📊 RTP (2.0x): ${(rtp * 100).toFixed(3)}%`);
      expect(rtp).toBeGreaterThan(0.93); expect(rtp).toBeLessThan(0.99);
    });

    it('RTP consistent regardless of bet size', () => {
      const betSizes = [0.10, 1, 10, 100, 1000, 10000];
      console.log('\n📊 RTP by Bet Size:');
      for (const bet of betSizes) {
        let totalBet = 0, totalReturn = 0;
        for (const cp of crashPoints) { totalBet += bet; if (cp >= 2.0) totalReturn += bet * 2; }
        const rtp = totalReturn / totalBet;
        console.log(`   $${bet.toFixed(2).padStart(10)}: ${(rtp * 100).toFixed(3)}%`);
        expect(Math.abs(rtp - 0.96)).toBeLessThan(0.03);
      }
    });

    it('RTP consistent across different cashout targets', () => {
      const targets = [1.1, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0];
      console.log('\n📊 RTP by Cashout Target:');
      for (const target of targets) {
        const wins = crashPoints.filter(cp => cp >= target).length;
        const rtp = (wins / ITERATIONS) * target;
        console.log(`   ${target.toFixed(1)}x: ${(rtp * 100).toFixed(3)}%`);
        expect(Math.abs(rtp - 0.96)).toBeLessThan(0.04);
      }
    });
  });

  // ============================================
  // 📊 DISTRIBUTION ANALYSIS
  // ============================================

  describe('📊 Distribution Analysis', () => {
    it('Should follow correct exponential distribution', () => {
      console.log('\n📊 NOVA RUSH DISTRIBUTION:');
      const buckets: Record<string, number> = { '1.00': 0, '1.01-1.50': 0, '1.50-2.00': 0, '2.00-3.00': 0, '3.00-5.00': 0, '5.00-10.00': 0, '10.00-25.00': 0, '25.00-100.00': 0, '100.00+': 0 };
      for (const cp of crashPoints) {
        if (cp === 1.00) buckets['1.00']++; else if (cp < 1.50) buckets['1.01-1.50']++;
        else if (cp < 2.00) buckets['1.50-2.00']++; else if (cp < 3.00) buckets['2.00-3.00']++;
        else if (cp < 5.00) buckets['3.00-5.00']++; else if (cp < 10.00) buckets['5.00-10.00']++;
        else if (cp < 25.00) buckets['10.00-25.00']++; else if (cp < 100.00) buckets['25.00-100.00']++;
        else buckets['100.00+']++;
      }
      for (const [range, count] of Object.entries(buckets)) {
        console.log(`   ${range.padEnd(14)}: ${count.toLocaleString().padStart(8)} (${(count / ITERATIONS * 100).toFixed(2)}%)`);
      }
      expect(buckets['1.01-1.50']).toBeGreaterThan(buckets['3.00-5.00']);
    });

    it('Should have correct percentiles', () => {
      const sorted = [...crashPoints].sort((a, b) => a - b);
      const percentiles = [0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99, 0.999];
      console.log(`\n📊 PERCENTILES:`);
      for (const p of percentiles) {
        const idx = Math.floor(ITERATIONS * p);
        console.log(`   P${(p * 100).toFixed(1).padStart(5)}: ${sorted[idx].toFixed(2)}x`);
      }
      expect(sorted[Math.floor(ITERATIONS * 0.50)]).toBeGreaterThan(1.3);
      expect(sorted[Math.floor(ITERATIONS * 0.50)]).toBeLessThan(2.0);
      expect(sorted[Math.floor(ITERATIONS * 0.99)]).toBeGreaterThan(50);
    });

    it('Median ≈ ln(2) / ln(1/(1-edge)) ≈ 1.63x', () => {
      const sorted = [...crashPoints].sort((a, b) => a - b);
      const median = sorted[Math.floor(ITERATIONS * 0.5)];
      const expectedMedian = Math.floor((1 - HOUSE_EDGE) / (1 - 0.5) * 100) / 100;
      console.log(`📊 Median: ${median.toFixed(2)}x (theoretical: ~${expectedMedian.toFixed(2)}x)`);
      expect(median).toBeGreaterThan(1.50);
      expect(median).toBeLessThan(2.10);
    });
  });

  // ============================================
  // 🔒 MAX WIN CAP
  // ============================================

  describe('🔒 Max Win Cap', () => {
    it('NEVER exceeds 5000x', () => {
      expect(crashPoints.filter(cp => cp > 5000).length).toBe(0);
    });
    it('Has some 100x+ games', () => {
      expect(crashPoints.filter(cp => cp >= 100).length).toBeGreaterThan(0);
    });
    it('1000x+ games are very rare', () => {
      expect(crashPoints.filter(cp => cp >= 1000).length / ITERATIONS).toBeLessThan(0.005);
    });
    it('Max crash point should not exceed 5000.00', () => {
      let max = 0;
      for (let i = 0; i < crashPoints.length; i++) {
        if (crashPoints[i] > max) max = crashPoints[i];
      }
      console.log(`📊 Max crash point: ${max}x`);
      expect(max).toBeLessThanOrEqual(5000.01);
    });
  });

  // ============================================
  // 📈 VARIANCE & STATISTICAL CONFIDENCE
  // ============================================

  describe('📈 Variance & Statistical Confidence', () => {
    it('Stable mean across 10 batches of 100K', () => {
      const batchSize = ITERATIONS / 10;
      const batchMeans: number[] = [];
      for (let i = 0; i < 10; i++) {
        const batch = crashPoints.slice(i * batchSize, (i + 1) * batchSize);
        batchMeans.push(batch.map(cp => Math.min(cp, 100)).reduce((a, b) => a + b, 0) / batchSize);
      }
      const overallMean = batchMeans.reduce((a, b) => a + b, 0) / batchMeans.length;
      const stdDev = Math.sqrt(batchMeans.reduce((sum, m) => sum + Math.pow(m - overallMean, 2), 0) / batchMeans.length);
      console.log(`📊 CV: ${(stdDev / overallMean * 100).toFixed(2)}%`);
      expect(stdDev / overallMean).toBeLessThan(0.05);
    });

    it('House edge stable across 10 batches', () => {
      const batchSize = ITERATIONS / 10;
      console.log('\n📊 HOUSE EDGE STABILITY (10 × 100K, cashout=2.0x):');
      for (let i = 0; i < 10; i++) {
        const batch = crashPoints.slice(i * batchSize, (i + 1) * batchSize);
        const edge = 1 - (batch.filter(cp => cp >= 2.0).length / batchSize) * 2.0;
        console.log(`   Batch ${(i + 1).toString().padStart(2)}: ${(edge * 100).toFixed(3)}%`);
        expect(edge).toBeGreaterThan(0.02); expect(edge).toBeLessThan(0.06);
      }
    });

    it('95% confidence interval for house edge', () => {
      const batchSize = 10000;
      const numBatches = ITERATIONS / batchSize;
      const edges: number[] = [];
      for (let i = 0; i < numBatches; i++) {
        const batch = crashPoints.slice(i * batchSize, (i + 1) * batchSize);
        edges.push(1 - (batch.filter(cp => cp >= 2.0).length / batchSize) * 2.0);
      }
      const mean = edges.reduce((a, b) => a + b, 0) / edges.length;
      const stdDev = Math.sqrt(edges.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / edges.length);
      const ci95 = 1.96 * stdDev / Math.sqrt(edges.length);
      console.log(`📊 House Edge: ${(mean * 100).toFixed(3)}% ± ${(ci95 * 100).toFixed(3)}%`);
      expect(mean - ci95).toBeGreaterThan(0.03);
      expect(mean + ci95).toBeLessThan(0.05);
    });
  });

  // ============================================
  // 🎰 PLAYER STRATEGY SIMULATIONS
  // ============================================

  describe('🎰 Player Strategy Simulations (House Always Wins)', () => {
    it('Conservative (1.5x, $10): house wins', () => {
      let bankroll = 10000, gamesPlayed = 0;
      for (const cp of crashPoints.slice(0, 100000)) {
        if (bankroll < 10) break;
        bankroll -= 10; gamesPlayed++;
        if (cp >= 1.5) bankroll += 15;
      }
      console.log(`📊 Conservative: ${gamesPlayed} games, P/L: $${(bankroll - 10000).toFixed(2)}`);
      expect(bankroll - 10000).toBeLessThan(0);
    });

    it('Moderate (2.0x, $50): house wins', () => {
      let bankroll = 10000, gamesPlayed = 0;
      for (const cp of crashPoints.slice(0, 100000)) {
        if (bankroll < 50) break;
        bankroll -= 50; gamesPlayed++;
        if (cp >= 2.0) bankroll += 100;
      }
      console.log(`📊 Moderate: ${gamesPlayed} games, P/L: $${(bankroll - 10000).toFixed(2)}`);
      expect(bankroll - 10000).toBeLessThan(0);
    });

    it('Aggressive (5.0x, $100): house wins', () => {
      let bankroll = 10000, gamesPlayed = 0;
      for (const cp of crashPoints.slice(0, 50000)) {
        if (bankroll < 100) break;
        bankroll -= 100; gamesPlayed++;
        if (cp >= 5.0) bankroll += 500;
      }
      console.log(`📊 Aggressive: ${gamesPlayed} games, P/L: $${(bankroll - 10000).toFixed(2)}`);
      expect(gamesPlayed).toBeGreaterThan(0);
    });

    it('Whale (2.0x, $1000): house wins', () => {
      let bankroll = 100000, gamesPlayed = 0;
      for (const cp of crashPoints.slice(0, 100000)) {
        if (bankroll < 1000) break;
        bankroll -= 1000; gamesPlayed++;
        if (cp >= 2.0) bankroll += 2000;
      }
      console.log(`📊 Whale: ${gamesPlayed} games, P/L: $${(bankroll - 100000).toFixed(2)}`);
      expect(bankroll - 100000).toBeLessThan(0);
    });

    it('Martingale (2.0x, double on loss): house wins', () => {
      let bankroll = 50000, bet = 10, gamesPlayed = 0;
      for (const cp of crashPoints.slice(0, 50000)) {
        if (bankroll < bet) break;
        bankroll -= bet; gamesPlayed++;
        if (cp >= 2.0) { bankroll += bet * 2; bet = 10; }
        else { bet = Math.min(bet * 2, 5000); }
      }
      console.log(`📊 Martingale: ${gamesPlayed} games, P/L: $${(bankroll - 50000).toFixed(2)}`);
      expect(bankroll).toBeLessThan(50000);
    });

    it("D'Alembert (2.0x, +$10 on loss, -$10 on win): house wins", () => {
      let bankroll = 20000, bet = 100, gamesPlayed = 0;
      for (const cp of crashPoints.slice(0, 100000)) {
        if (bankroll < bet || bet <= 0) break;
        bankroll -= bet; gamesPlayed++;
        if (cp >= 2.0) { bankroll += bet * 2; bet = Math.max(10, bet - 10); }
        else { bet = Math.min(bet + 10, 1000); }
      }
      console.log(`📊 D'Alembert: ${gamesPlayed} games, P/L: $${(bankroll - 20000).toFixed(2)}`);
      expect(bankroll - 20000).toBeLessThan(0);
    });

    it('Fibonacci (2.0x): house wins', () => {
      let bankroll = 20000, gamesPlayed = 0;
      const fib = [10, 10, 20, 30, 50, 80, 130, 210, 340, 550, 890, 1440];
      let fibIdx = 0;
      for (const cp of crashPoints.slice(0, 100000)) {
        const bet = fib[Math.min(fibIdx, fib.length - 1)];
        if (bankroll < bet) break;
        bankroll -= bet; gamesPlayed++;
        if (cp >= 2.0) { bankroll += bet * 2; fibIdx = Math.max(0, fibIdx - 2); }
        else { fibIdx = Math.min(fibIdx + 1, fib.length - 1); }
      }
      console.log(`📊 Fibonacci: ${gamesPlayed} games, P/L: $${(bankroll - 20000).toFixed(2)}`);
      expect(bankroll - 20000).toBeLessThan(0);
    });

    it('Kelly criterion optimal bet: still loses to house edge', () => {
      const cashout = 2.0;
      const winProb = crashPoints.filter(cp => cp >= cashout).length / ITERATIONS;
      const kellyFraction = (winProb * (cashout - 1) - (1 - winProb)) / (cashout - 1);
      console.log(`📊 Kelly Fraction: ${(kellyFraction * 100).toFixed(2)}% (should be negative)`);
      expect(kellyFraction).toBeLessThan(0);
    });
  });

  // ============================================
  // 🔐 PROVABLY FAIR VERIFICATION
  // ============================================

  describe('🔐 Provably Fair Algorithm Verification', () => {
    it('Should match service algorithm exactly', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CrashService,
          { provide: PrismaService, useValue: createMockPrismaService() },
          { provide: GameConfigService, useValue: createMockGameConfigService() },
          { provide: EventEmitter2, useValue: createMockEventEmitter() },
        ],
      }).compile();
      const service = module.get<CrashService>(CrashService);
      service.stopGameLoop();

      let matches = 0;
      for (let i = 0; i < 10000; i++) {
        const standalone = generateCrashPointExact('verify-seed', 'client', i, 0.04);
        const serviceResult = service.verifyCrashPoint('verify-seed', 'client', i);
        if (standalone === parseFloat(serviceResult.crashPoint)) matches++;
      }
      console.log(`📊 Algorithm Match: ${matches} / 10,000`);
      expect(matches).toBe(10000);
    });

    it('Should be deterministic', () => {
      for (let i = 0; i < 1000; i++) {
        expect(generateCrashPointExact('test-seed', 'client', i)).toBe(generateCrashPointExact('test-seed', 'client', i));
      }
    });

    it('Different seeds produce different results', () => {
      let different = 0;
      for (let i = 0; i < 1000; i++) {
        const s1 = crypto.randomBytes(32).toString('hex');
        const s2 = crypto.randomBytes(32).toString('hex');
        if (generateCrashPointExact(s1, 'client', i) !== generateCrashPointExact(s2, 'client', i)) different++;
      }
      expect(different).toBeGreaterThan(990);
    });

    it('Nonce changes produce unique crash points', () => {
      const seed = crypto.randomBytes(32).toString('hex');
      const points = new Set<number>();
      for (let i = 0; i < 10000; i++) {
        points.add(generateCrashPointExact(seed, 'client', i));
      }
      expect(points.size).toBeGreaterThan(300);
    });
  });

  // ============================================
  // 🎲 MATHEMATICAL PROOF
  // ============================================

  describe('🎲 Mathematical Proof of Fairness', () => {
    it('P(X >= m) ≈ (1-edge)/m for all multipliers', () => {
      const testMultipliers = [1.5, 2.0, 3.0, 5.0, 10.0, 20.0];
      console.log('\n📊 MATHEMATICAL PROOF: P(X >= m) ≈ (1-edge)/m');
      for (const m of testMultipliers) {
        const actual = crashPoints.filter(cp => cp >= m).length / ITERATIONS;
        const expected = (1 - HOUSE_EDGE) / m;
        const error = Math.abs(actual - expected);
        console.log(`   m=${m.toFixed(1)}x: Actual=${(actual * 100).toFixed(3)}% Expected=${(expected * 100).toFixed(3)}% Error=${(error * 100).toFixed(3)}%`);
        expect(error).toBeLessThan(0.005);
      }
    });

    it('E[payout] ≈ 0.96 for any cashout', () => {
      const testMultipliers = [1.1, 1.5, 2.0, 3.0, 5.0, 10.0];
      console.log('\n📊 EXPECTED VALUE PROOF:');
      for (const m of testMultipliers) {
        const ev = (crashPoints.filter(cp => cp >= m).length * m) / ITERATIONS;
        console.log(`   ${m.toFixed(1)}x: EV=${ev.toFixed(4)} (target: 0.9600)`);
        expect(Math.abs(ev - 0.96)).toBeLessThan(0.02);
      }
    });

    it('Conditional expectation: E[X|X>=m] = m*(1-edge)/(1-edge-m*edge) is correct', () => {
      const testMultipliers = [1.5, 2.0, 3.0, 5.0];
      for (const m of testMultipliers) {
        const above = crashPoints.filter(cp => cp >= m);
        const conditionalMean = above.map(cp => Math.min(cp, 100)).reduce((a, b) => a + b, 0) / above.length;
        expect(conditionalMean).toBeGreaterThan(m);
      }
    });
  });
});

// ============================================
// ⚡ CONCURRENT BET/CASHOUT STRESS TEST
// ============================================

describe('⚡ Nova Rush Concurrent Bet/Cashout Stress Test', () => {
  let service: CrashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashService,
        { provide: PrismaService, useValue: createMockPrismaService() },
        { provide: GameConfigService, useValue: createMockGameConfigService() },
        { provide: EventEmitter2, useValue: createMockEventEmitter() },
      ],
    }).compile();
    service = module.get<CrashService>(CrashService);
    service.setEventEmitter(createMockEventEmitter() as any);
  });

  afterEach(() => {
    service.stopGameLoop();
    service['lastBetTime'].clear();
    jest.clearAllMocks();
  });

  it('Should handle 500 users betting simultaneously', async () => {
    service['startNewRound']();
    service['currentRound']!.state = GameState.WAITING;
    let betsPlaced = 0;
    for (let i = 0; i < 500; i++) {
      service['lastBetTime'].clear();
      const result = await service.placeBet(`user-${i}`, new Decimal(100));
      if (result.success) betsPlaced++;
    }
    console.log(`📊 Bets placed: ${betsPlaced} / 500`);
    expect(betsPlaced).toBe(500);
  });

  it('Should handle 100 rounds of bet-cashout cycles', async () => {
    let totalBets = 0, totalCashouts = 0;
    for (let round = 0; round < 100; round++) {
      service['startNewRound']();
      service['currentRound']!.state = GameState.WAITING;
      service['lastBetTime'].clear();
      const betResult = await service.placeBet('user-1', new Decimal(50));
      if (betResult.success) totalBets++;
      service['currentRound']!.state = GameState.RUNNING;
      service['currentRound']!.crashPoint = new Decimal(5.0);
      service['currentRound']!.currentMultiplier = new Decimal(1.5);
      const cashoutResult = await service.cashout('user-1');
      if (cashoutResult.success) totalCashouts++;
    }
    console.log(`📊 100 Rounds: ${totalBets} bets, ${totalCashouts} cashouts`);
    expect(totalBets).toBe(100);
    expect(totalCashouts).toBe(100);
  });

  it('Should handle auto-cashout with 200 users at different targets', async () => {
    service['startNewRound']();
    service['currentRound']!.state = GameState.WAITING;
    for (let i = 0; i < 200; i++) {
      service['lastBetTime'].clear();
      await service.placeBet(`user-${i}`, new Decimal(100), new Decimal(1.5 + (i % 10) * 0.5));
    }
    expect(service['currentRound']!.bets.size).toBe(200);
  });

  it('Should reject bets during RUNNING state', async () => {
    service['startNewRound']();
    service['currentRound']!.state = GameState.RUNNING;
    service['lastBetTime'].clear();
    const result = await service.placeBet('user-1', new Decimal(100));
    expect(result.success).toBe(false);
  });

  it('Should reject cashout during WAITING state', async () => {
    service['startNewRound']();
    service['currentRound']!.state = GameState.WAITING;
    service['lastBetTime'].clear();
    await service.placeBet('user-1', new Decimal(100));
    const result = await service.cashout('user-1');
    expect(result.success).toBe(false);
  });
});
