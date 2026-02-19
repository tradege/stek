/**
 * ============================================================
 * LIMBO MEGA TEST SUITE — 1,000,000+ Simulations
 * ============================================================
 * Covers:
 *  1. RTP verification for 50+ target multipliers (1.01x - 1000x)
 *  2. Result distribution (inverse transform / heavy-tail)
 *  3. Win rate accuracy for every target
 *  4. Provably Fair determinism
 *  5. Edge cases: min/max multiplier, boundary values
 *  6. Long-run convergence (500K)
 *  7. Streak analysis
 *  8. Dynamic house edge (1%-10%)
 *  9. Distribution tail analysis (high multipliers)
 * 10. Median & percentile verification
 * ============================================================
 */
import { createHmac, randomBytes } from 'crypto';

// ── Exact replica of production Limbo functions ────────────
const MAX_TARGET = 1000000;

function generateResult(serverSeed: string, clientSeed: string, nonce: number, houseEdge: number): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  const rawValue = parseInt(hash.substring(0, 13), 16);
  const maxValue = Math.pow(16, 13);
  const random = rawValue / maxValue;
  if (random === 0) return MAX_TARGET;
  const houseEdgeFactor = 1 - houseEdge;
  const result = houseEdgeFactor / random;
  return parseFloat(Math.max(1.00, Math.min(result, MAX_TARGET)).toFixed(2));
}

function calculateWinChance(targetMultiplier: number, houseEdge: number): number {
  const chance = ((1 / targetMultiplier) * (1 - houseEdge)) * 100;
  return parseFloat(Math.max(0.0001, chance).toFixed(4));
}

// ── Config ─────────────────────────────────────────────────
const N = 1_000_000;
const DEFAULT_HE = 0.04;
const BET = 10;
const SS = 'mega-test-server-seed-limbo-2026';
const CS = 'mega-test-client-seed';

describe('LIMBO MEGA TEST SUITE (1M+ Simulations)', () => {

  // ════════════════════════════════════════════════════════════
  // 1. RTP VERIFICATION — Wide range of targets
  // ════════════════════════════════════════════════════════════
  describe('1. RTP Verification — All Target Multipliers', () => {
    const targets = [1.01, 1.05, 1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0, 100.0, 500.0, 1000.0];
    let nonceCounter = 0;

    for (const target of targets) {
      it(`target=${target}x: RTP should be ~96% (±3%)`, () => {
        const SIMS = target >= 100 ? 200_000 : 50_000;
        let wagered = 0, payout = 0;
        for (let i = 0; i < SIMS; i++) {
          wagered += BET;
          const result = generateResult(SS, CS, nonceCounter++, DEFAULT_HE);
          if (result >= target) payout += BET * target;
        }
        const rtp = payout / wagered;
        const tolerance = target >= 500 ? 0.15 : target >= 100 ? 0.10 : 0.03;
        expect(rtp).toBeGreaterThan(0.96 - tolerance);
        expect(rtp).toBeLessThan(0.96 + tolerance);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 2. RESULT DISTRIBUTION — Heavy-tail verification
  // ════════════════════════════════════════════════════════════
  describe('2. Result Distribution (1M results)', () => {
    const results: number[] = [];

    beforeAll(() => {
      for (let i = 0; i < N; i++) {
        results.push(generateResult(SS, CS, i, DEFAULT_HE));
      }
    });

    it('all results should be ≥ 1.00', () => {
      for (const r of results) expect(r).toBeGreaterThanOrEqual(1.00);
    });

    it('~50% of results should be < 1.92x (median of inverse distribution)', () => {
      const below = results.filter(r => r < 1.92).length;
      expect(below / N).toBeGreaterThan(0.45);
      expect(below / N).toBeLessThan(0.55);
    });

    it('~96% of results should be ≥ 1.00x (all valid)', () => {
      const valid = results.filter(r => r >= 1.00).length;
      expect(valid / N).toBe(1.0);
    });

    it('~48% of results should be ≥ 2.00x', () => {
      // P(result >= 2) = (1-HE)/2 = 0.48
      const above2 = results.filter(r => r >= 2.0).length;
      expect(above2 / N).toBeGreaterThan(0.45);
      expect(above2 / N).toBeLessThan(0.51);
    });

    it('~9.6% of results should be ≥ 10.00x', () => {
      // P(result >= 10) = (1-HE)/10 = 0.096
      const above10 = results.filter(r => r >= 10.0).length;
      expect(above10 / N).toBeGreaterThan(0.085);
      expect(above10 / N).toBeLessThan(0.107);
    });

    it('~0.96% of results should be ≥ 100.00x', () => {
      const above100 = results.filter(r => r >= 100.0).length;
      expect(above100 / N).toBeGreaterThan(0.007);
      expect(above100 / N).toBeLessThan(0.013);
    });

    it('~0.096% of results should be ≥ 1000.00x', () => {
      const above1000 = results.filter(r => r >= 1000.0).length;
      expect(above1000 / N).toBeGreaterThan(0.0005);
      expect(above1000 / N).toBeLessThan(0.0015);
    });

    it('mean result should be close to theoretical E[X]', () => {
      // For capped distribution, E[X] depends on cap. With cap at 1M, mean ≈ large
      // But practically, mean of 1M samples should be around 10-30 due to heavy tail
      const mean = results.reduce((a, b) => a + b, 0) / N;
      expect(mean).toBeGreaterThan(5);
      expect(mean).toBeLessThan(100);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 3. WIN RATE ACCURACY — Theoretical vs empirical
  // ════════════════════════════════════════════════════════════
  describe('3. Win Rate Accuracy', () => {
    const targetWinRates: [number, number][] = [
      [1.01, 95.05], [1.5, 64.00], [2.0, 48.00], [3.0, 32.00],
      [5.0, 19.20], [10.0, 9.60], [20.0, 4.80], [50.0, 1.92],
      [100.0, 0.96],
    ];

    for (const [target, expectedWinRate] of targetWinRates) {
      it(`target=${target}x: win rate should be ~${expectedWinRate}%`, () => {
        const SIMS = target >= 50 ? 500_000 : 100_000;
        let wins = 0;
        for (let i = 0; i < SIMS; i++) {
          if (generateResult(SS, CS, i, DEFAULT_HE) >= target) wins++;
        }
        const actualRate = (wins / SIMS) * 100;
        const tolerance = target >= 50 ? 0.5 : 2.0;
        expect(actualRate).toBeGreaterThan(expectedWinRate - tolerance);
        expect(actualRate).toBeLessThan(expectedWinRate + tolerance);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 4. PROVABLY FAIR
  // ════════════════════════════════════════════════════════════
  describe('4. Provably Fair Determinism', () => {
    it('10K results with same seeds are identical', () => {
      for (let i = 0; i < 10000; i++) {
        expect(generateResult(SS, CS, i, DEFAULT_HE)).toBe(generateResult(SS, CS, i, DEFAULT_HE));
      }
    });

    it('different server seeds produce different results', () => {
      let diff = 0;
      for (let i = 0; i < 10000; i++) {
        if (generateResult(`s${i}`, CS, 0, DEFAULT_HE) !== generateResult(`s${i + 10000}`, CS, 0, DEFAULT_HE)) diff++;
      }
      expect(diff / 10000).toBeGreaterThan(0.99);
    });

    it('different nonces produce different results', () => {
      let diff = 0;
      for (let i = 0; i < 10000; i++) {
        if (generateResult(SS, CS, i, DEFAULT_HE) !== generateResult(SS, CS, i + 1, DEFAULT_HE)) diff++;
      }
      expect(diff / 10000).toBeGreaterThan(0.99);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 5. EDGE CASES
  // ════════════════════════════════════════════════════════════
  describe('5. Edge Cases', () => {
    it('result is always ≥ 1.00 (100K checks)', () => {
      for (let i = 0; i < 100000; i++) {
        expect(generateResult(SS, CS, i, DEFAULT_HE)).toBeGreaterThanOrEqual(1.00);
      }
    });

    it('result is always ≤ MAX_TARGET', () => {
      for (let i = 0; i < 100000; i++) {
        expect(generateResult(SS, CS, i, DEFAULT_HE)).toBeLessThanOrEqual(MAX_TARGET);
      }
    });

    it('HE=0 produces results ≥ 1.00', () => {
      for (let i = 0; i < 1000; i++) {
        expect(generateResult(SS, CS, i, 0)).toBeGreaterThanOrEqual(1.00);
      }
    });

    it('HE=0.99 produces mostly 1.00', () => {
      let ones = 0;
      for (let i = 0; i < 10000; i++) {
        if (generateResult(SS, CS, i, 0.99) === 1.00) ones++;
      }
      expect(ones / 10000).toBeGreaterThan(0.95);
    });

    it('nonce 0 and MAX_SAFE_INTEGER produce valid results', () => {
      expect(generateResult(SS, CS, 0, DEFAULT_HE)).toBeGreaterThanOrEqual(1.00);
      expect(generateResult(SS, CS, Number.MAX_SAFE_INTEGER, DEFAULT_HE)).toBeGreaterThanOrEqual(1.00);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 6. LONG-RUN CONVERGENCE
  // ════════════════════════════════════════════════════════════
  describe('6. Long-Run Convergence (500K)', () => {
    it('cumulative RTP at target=2x converges to 0.96', () => {
      const target = 2.0;
      let wagered = 0, payout = 0;
      const checkpoints = [10000, 50000, 100000, 250000, 500000];
      const rtps: number[] = [];
      for (let i = 0; i < 500000; i++) {
        wagered += BET;
        if (generateResult(SS, CS, i, DEFAULT_HE) >= target) payout += BET * target;
        if (checkpoints.includes(i + 1)) rtps.push(payout / wagered);
      }
      expect(rtps[rtps.length - 1]).toBeGreaterThan(0.93);
      expect(rtps[rtps.length - 1]).toBeLessThan(0.99);
    });

    it('100 batches of 5K at target=2x: avg RTP ~0.96', () => {
      const target = 2.0;
      const batchRTPs: number[] = [];
      for (let b = 0; b < 100; b++) {
        let w = 0, p = 0;
        for (let i = 0; i < 5000; i++) {
          w += BET;
          if (generateResult(SS, CS, b * 5000 + i, DEFAULT_HE) >= target) p += BET * target;
        }
        batchRTPs.push(p / w);
      }
      const avg = batchRTPs.reduce((a, b) => a + b, 0) / 100;
      expect(avg).toBeGreaterThan(0.93);
      expect(avg).toBeLessThan(0.99);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 7. STREAK ANALYSIS
  // ════════════════════════════════════════════════════════════
  describe('7. Streak Analysis', () => {
    it('max win streak at 2x (48% win) should be < 25', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateResult(SS, CS, i, DEFAULT_HE) >= 2.0) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(25);
      expect(max).toBeGreaterThan(3);
    });

    it('max loss streak at 2x should be < 30', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateResult(SS, CS, i, DEFAULT_HE) < 2.0) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(30);
    });

    it('max win streak at 10x (9.6% win) should be < 10', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateResult(SS, CS, i, DEFAULT_HE) >= 10.0) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(10);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 8. DYNAMIC HOUSE EDGE
  // ════════════════════════════════════════════════════════════
  describe('8. Dynamic House Edge', () => {
    for (const he of [0.01, 0.02, 0.04, 0.06, 0.08, 0.10]) {
      it(`HE=${(he * 100)}%: RTP at 2x should be ~${((1 - he) * 100).toFixed(0)}%`, () => {
        let w = 0, p = 0;
        for (let i = 0; i < 100000; i++) {
          w += BET;
          if (generateResult(SS, CS, i, he) >= 2.0) p += BET * 2.0;
        }
        const rtp = p / w;
        expect(rtp).toBeGreaterThan((1 - he) - 0.03);
        expect(rtp).toBeLessThan((1 - he) + 0.03);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 9. TAIL DISTRIBUTION
  // ════════════════════════════════════════════════════════════
  describe('9. Tail Distribution Analysis (1M)', () => {
    it('frequency of results in each order of magnitude follows 1/x', () => {
      const ranges = [
        { min: 1, max: 2, expected: 0.52 },    // ~52%
        { min: 2, max: 10, expected: 0.384 },   // ~38.4%
        { min: 10, max: 100, expected: 0.0864 }, // ~8.64%
        { min: 100, max: 1000, expected: 0.00864 }, // ~0.864%
      ];
      const counts = ranges.map(() => 0);
      for (let i = 0; i < N; i++) {
        const r = generateResult(SS, CS, i, DEFAULT_HE);
        for (let j = 0; j < ranges.length; j++) {
          if (r >= ranges[j].min && r < ranges[j].max) { counts[j]++; break; }
        }
      }
      for (let j = 0; j < ranges.length; j++) {
        const actual = counts[j] / N;
        const tolerance = ranges[j].expected * 0.15;
        expect(actual).toBeGreaterThan(ranges[j].expected - tolerance);
        expect(actual).toBeLessThan(ranges[j].expected + tolerance);
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 10. PERCENTILE VERIFICATION
  // ════════════════════════════════════════════════════════════
  describe('10. Percentile Verification', () => {
    it('median (P50) should be ~1.92x', () => {
      const results: number[] = [];
      for (let i = 0; i < 100000; i++) results.push(generateResult(SS, CS, i, DEFAULT_HE));
      results.sort((a, b) => a - b);
      const p50 = results[Math.floor(results.length * 0.5)];
      expect(p50).toBeGreaterThan(1.7);
      expect(p50).toBeLessThan(2.1);
    });

    it('P90 should be ~9.6x', () => {
      const results: number[] = [];
      for (let i = 0; i < 100000; i++) results.push(generateResult(SS, CS, i, DEFAULT_HE));
      results.sort((a, b) => a - b);
      const p90 = results[Math.floor(results.length * 0.9)];
      expect(p90).toBeGreaterThan(7);
      expect(p90).toBeLessThan(13);
    });

    it('P99 should be ~96x', () => {
      const results: number[] = [];
      for (let i = 0; i < 100000; i++) results.push(generateResult(SS, CS, i, DEFAULT_HE));
      results.sort((a, b) => a - b);
      const p99 = results[Math.floor(results.length * 0.99)];
      expect(p99).toBeGreaterThan(60);
      expect(p99).toBeLessThan(140);
    });
  });
});
