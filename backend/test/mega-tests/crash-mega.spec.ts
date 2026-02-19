/**
 * ============================================================
 * CRASH MEGA TEST SUITE — 1,000,000+ Simulations
 * ============================================================
 * Covers:
 *  1. Crash point distribution (inverse transform)
 *  2. RTP verification for all cashout multipliers
 *  3. Instant crash rate (1.00x)
 *  4. Cap at 5000x verification
 *  5. Dual dragon independence
 *  6. Provably Fair determinism
 *  7. Long-run convergence
 *  8. Streak analysis (consecutive instant crashes)
 *  9. Dynamic house edge
 * 10. Percentile & median verification
 * ============================================================
 */
import { createHmac, randomBytes } from 'crypto';

// ── Exact replica of production Crash functions ────────────
const E = Math.pow(16, 13); // 2^52

function generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number, houseEdge: number = 0.04): number {
  const combinedSeed = `${clientSeed}:${nonce}`;
  const hash = createHmac('sha256', serverSeed).update(combinedSeed).digest('hex');
  const h = parseInt(hash.substring(0, 13), 16);
  const r = h / E;
  const rawMultiplier = (1 - houseEdge) / (1 - r);
  const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
  return Math.min(crashPoint, 5000.00);
}

function generateSecondCrashPoint(serverSeed: string, clientSeed: string, nonce: number, houseEdge: number = 0.04): number {
  const combinedSeed = `${clientSeed}:${nonce}:dragon2`;
  const hash = createHmac('sha256', serverSeed).update(combinedSeed).digest('hex');
  const h = parseInt(hash.substring(0, 13), 16);
  const r = h / E;
  const rawMultiplier = (1 - houseEdge) / (1 - r);
  const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
  return Math.min(crashPoint, 5000.00);
}

// ── Config ─────────────────────────────────────────────────
const N = 1_000_000;
const DEFAULT_HE = 0.04;
const BET = 10;
const SS = 'mega-test-server-seed-crash-2026';
const CS = 'mega-test-client-seed';

describe('CRASH MEGA TEST SUITE (1M+ Simulations)', () => {

  // ════════════════════════════════════════════════════════════
  // 1. CRASH POINT DISTRIBUTION
  // ════════════════════════════════════════════════════════════
  describe('1. Crash Point Distribution (1M rounds)', () => {
    const crashPoints: number[] = [];

    beforeAll(() => {
      for (let i = 0; i < N; i++) {
        crashPoints.push(generateCrashPoint(SS, CS, i, DEFAULT_HE));
      }
    });

    it('all crash points should be ≥ 1.00', () => {
      for (const cp of crashPoints) expect(cp).toBeGreaterThanOrEqual(1.00);
    });

    it('all crash points should be ≤ 5000.00 (cap)', () => {
      for (const cp of crashPoints) expect(cp).toBeLessThanOrEqual(5000.00);
    });

    it('~4% of rounds should instant-crash at 1.00x', () => {
      // P(crash at 1.00) = houseEdge = 4%
      const instant = crashPoints.filter(cp => cp === 1.00).length;
      expect(instant / N).toBeGreaterThan(0.03);
      expect(instant / N).toBeLessThan(0.05);
    });

    it('~48% of rounds should crash below 2.00x', () => {
      const below2 = crashPoints.filter(cp => cp < 2.00).length;
      expect(below2 / N).toBeGreaterThan(0.45);
      expect(below2 / N).toBeLessThan(0.55);
    });

    it('~90.4% should crash below 10.00x', () => {
      const below10 = crashPoints.filter(cp => cp < 10.00).length;
      expect(below10 / N).toBeGreaterThan(0.88);
      expect(below10 / N).toBeLessThan(0.93);
    });

    it('~99.04% should crash below 100.00x', () => {
      const below100 = crashPoints.filter(cp => cp < 100.00).length;
      expect(below100 / N).toBeGreaterThan(0.985);
      expect(below100 / N).toBeLessThan(0.995);
    });

    it('some rounds should reach 1000x+ (at least 1 in 1M)', () => {
      const above1000 = crashPoints.filter(cp => cp >= 1000.00).length;
      expect(above1000).toBeGreaterThan(0);
    });

    it('cap at 5000x should be hit rarely', () => {
      const capped = crashPoints.filter(cp => cp === 5000.00).length;
      expect(capped / N).toBeLessThan(0.001);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 2. RTP VERIFICATION — All cashout multipliers
  // ════════════════════════════════════════════════════════════
  describe('2. RTP Verification — All Cashout Multipliers', () => {
    const cashouts = [1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0, 100.0, 500.0, 1000.0];

    for (const cashout of cashouts) {
      it(`cashout=${cashout}x: RTP should be ~96% (±3%)`, () => {
        const SIMS = cashout >= 100 ? 500_000 : 100_000;
        let wagered = 0, payout = 0;
        for (let i = 0; i < SIMS; i++) {
          wagered += BET;
          const cp = generateCrashPoint(SS, CS, i, DEFAULT_HE);
          if (cp >= cashout) payout += BET * cashout;
        }
        const rtp = payout / wagered;
        const tolerance = cashout >= 100 ? 0.10 : 0.03;
        expect(rtp).toBeGreaterThan(0.96 - tolerance);
        expect(rtp).toBeLessThan(0.96 + tolerance);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 3. INSTANT CRASH ANALYSIS
  // ════════════════════════════════════════════════════════════
  describe('3. Instant Crash Analysis', () => {
    it('instant crash rate should be exactly ~HE (4%)', () => {
      let instant = 0;
      for (let i = 0; i < N; i++) {
        if (generateCrashPoint(SS, CS, i, DEFAULT_HE) === 1.00) instant++;
      }
      expect(instant / N).toBeGreaterThan(0.035);
      expect(instant / N).toBeLessThan(0.045);
    });

    it('with HE=10%, instant crash should be ~10%', () => {
      let instant = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateCrashPoint(SS, CS, i, 0.10) === 1.00) instant++;
      }
      expect(instant / 100000).toBeGreaterThan(0.08);
      expect(instant / 100000).toBeLessThan(0.12);
    });

    it('with HE=1%, instant crash should be ~1%', () => {
      let instant = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateCrashPoint(SS, CS, i, 0.01) === 1.00) instant++;
      }
      expect(instant / 100000).toBeGreaterThan(0.005);
      expect(instant / 100000).toBeLessThan(0.02);
    });

    it('max consecutive instant crashes should be < 10 in 100K', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateCrashPoint(SS, CS, i, DEFAULT_HE) === 1.00) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(10);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 4. 5000x CAP VERIFICATION
  // ════════════════════════════════════════════════════════════
  describe('4. Cap at 5000x', () => {
    it('no crash point should exceed 5000.00', () => {
      for (let i = 0; i < 100000; i++) {
        expect(generateCrashPoint(SS, CS, i, DEFAULT_HE)).toBeLessThanOrEqual(5000.00);
      }
    });

    it('crash points near cap should be exactly 5000.00 (not 5000.01)', () => {
      // Generate many rounds and check any that hit cap
      for (let i = 0; i < N; i++) {
        const cp = generateCrashPoint(SS, CS, i, DEFAULT_HE);
        if (cp >= 4999) expect(cp).toBe(5000.00);
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 5. DUAL DRAGON INDEPENDENCE
  // ════════════════════════════════════════════════════════════
  describe('5. Dual Dragon Independence', () => {
    it('dragon1 and dragon2 should produce different crash points', () => {
      let different = 0;
      for (let i = 0; i < 10000; i++) {
        const d1 = generateCrashPoint(SS, CS, i, DEFAULT_HE);
        const d2 = generateSecondCrashPoint(SS, CS, i, DEFAULT_HE);
        if (d1 !== d2) different++;
      }
      expect(different / 10000).toBeGreaterThan(0.99);
    });

    it('dragon2 should also have ~4% instant crash rate', () => {
      let instant = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateSecondCrashPoint(SS, CS, i, DEFAULT_HE) === 1.00) instant++;
      }
      expect(instant / 100000).toBeGreaterThan(0.03);
      expect(instant / 100000).toBeLessThan(0.05);
    });

    it('correlation between d1 and d2 should be near 0', () => {
      const d1s: number[] = [], d2s: number[] = [];
      for (let i = 0; i < 50000; i++) {
        d1s.push(Math.min(generateCrashPoint(SS, CS, i, DEFAULT_HE), 100));
        d2s.push(Math.min(generateSecondCrashPoint(SS, CS, i, DEFAULT_HE), 100));
      }
      const mean1 = d1s.reduce((a, b) => a + b, 0) / d1s.length;
      const mean2 = d2s.reduce((a, b) => a + b, 0) / d2s.length;
      let cov = 0, var1 = 0, var2 = 0;
      for (let i = 0; i < d1s.length; i++) {
        cov += (d1s[i] - mean1) * (d2s[i] - mean2);
        var1 += Math.pow(d1s[i] - mean1, 2);
        var2 += Math.pow(d2s[i] - mean2, 2);
      }
      const correlation = cov / Math.sqrt(var1 * var2);
      expect(Math.abs(correlation)).toBeLessThan(0.02);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 6. PROVABLY FAIR
  // ════════════════════════════════════════════════════════════
  describe('6. Provably Fair Determinism', () => {
    it('10K crash points with same seeds are identical', () => {
      for (let i = 0; i < 10000; i++) {
        expect(generateCrashPoint(SS, CS, i)).toBe(generateCrashPoint(SS, CS, i));
      }
    });

    it('different seeds produce different crash points', () => {
      let diff = 0;
      for (let i = 0; i < 10000; i++) {
        if (generateCrashPoint(`s${i}`, CS, 0) !== generateCrashPoint(`s${i + 10000}`, CS, 0)) diff++;
      }
      expect(diff / 10000).toBeGreaterThan(0.99);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 7. LONG-RUN CONVERGENCE
  // ════════════════════════════════════════════════════════════
  describe('7. Long-Run Convergence', () => {
    it('100 batches × 5K at cashout=2x: avg RTP ~96%', () => {
      const rtps: number[] = [];
      for (let b = 0; b < 100; b++) {
        let w = 0, p = 0;
        for (let i = 0; i < 5000; i++) {
          w += BET;
          if (generateCrashPoint(SS, CS, b * 5000 + i) >= 2.0) p += BET * 2.0;
        }
        rtps.push(p / w);
      }
      const avg = rtps.reduce((a, b) => a + b, 0) / 100;
      expect(avg).toBeGreaterThan(0.93);
      expect(avg).toBeLessThan(0.99);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 8. STREAK ANALYSIS
  // ════════════════════════════════════════════════════════════
  describe('8. Streak Analysis', () => {
    it('max consecutive crashes below 2x should be < 25', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateCrashPoint(SS, CS, i) < 2.0) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(25);
    });

    it('max consecutive crashes above 2x should be < 25', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (generateCrashPoint(SS, CS, i) >= 2.0) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(25);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 9. DYNAMIC HOUSE EDGE
  // ════════════════════════════════════════════════════════════
  describe('9. Dynamic House Edge', () => {
    for (const he of [0.01, 0.02, 0.04, 0.06, 0.08, 0.10]) {
      it(`HE=${(he * 100)}%: RTP at 2x should be ~${((1 - he) * 100).toFixed(0)}%`, () => {
        let w = 0, p = 0;
        for (let i = 0; i < 100000; i++) {
          w += BET;
          if (generateCrashPoint(SS, CS, i, he) >= 2.0) p += BET * 2.0;
        }
        const rtp = p / w;
        expect(rtp).toBeGreaterThan((1 - he) - 0.03);
        expect(rtp).toBeLessThan((1 - he) + 0.03);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 10. PERCENTILE VERIFICATION
  // ════════════════════════════════════════════════════════════
  describe('10. Percentile Verification', () => {
    it('median crash point should be ~1.92x', () => {
      const cps: number[] = [];
      for (let i = 0; i < 100000; i++) cps.push(generateCrashPoint(SS, CS, i));
      cps.sort((a, b) => a - b);
      const median = cps[Math.floor(cps.length * 0.5)];
      expect(median).toBeGreaterThan(1.7);
      expect(median).toBeLessThan(2.1);
    });

    it('P95 crash point should be ~19.2x', () => {
      const cps: number[] = [];
      for (let i = 0; i < 100000; i++) cps.push(generateCrashPoint(SS, CS, i));
      cps.sort((a, b) => a - b);
      const p95 = cps[Math.floor(cps.length * 0.95)];
      expect(p95).toBeGreaterThan(14);
      expect(p95).toBeLessThan(25);
    });
  });
});
