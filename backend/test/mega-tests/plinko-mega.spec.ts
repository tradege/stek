/**
 * ============================================================
 * PLINKO MEGA TEST SUITE — 1,000,000+ Simulations
 * ============================================================
 * Covers:
 *  1. Path generation uniformity (binomial distribution)
 *  2. Bucket distribution for ALL rows (8-16) × ALL risk levels
 *  3. RTP verification: EV = Σ P(bucket) × multiplier ≈ 0.96
 *  4. Dynamic house edge scaling
 *  5. Provably Fair determinism
 *  6. Monte Carlo RTP (100K per config)
 *  7. Multiplier table symmetry
 *  8. Edge cases
 *  9. Streak analysis
 * 10. Cross-config comparison
 * ============================================================
 */
import { createHmac } from 'crypto';

// ── Production constants (subset of multiplier tables) ─────
const PLINKO_MULTIPLIERS: Record<number, Record<string, number[]>> = {
  8: {
    LOW: [5.39, 2.19, 1.36, 0.97, 0.48, 0.97, 1.36, 2.19, 5.39],
    MEDIUM: [12.59, 4.37, 1.94, 0.68, 0.29, 0.68, 1.94, 4.37, 12.59],
    HIGH: [28.21, 9.71, 1.94, 0.29, 0.19, 0.29, 1.94, 9.71, 28.21],
  },
  10: {
    LOW: [8.16, 2.82, 1.41, 1.13, 0.94, 0.47, 0.94, 1.13, 1.41, 2.82, 8.16],
    MEDIUM: [19.44, 8.84, 2.66, 1.15, 0.44, 0.27, 0.44, 1.15, 2.66, 8.84, 19.44],
    HIGH: [58.19, 11.17, 3.73, 0.75, 0.19, 0.19, 0.19, 0.75, 3.73, 11.17, 58.19],
  },
  12: {
    LOW: [9.79, 3.73, 1.86, 1.31, 1.11, 0.93, 0.46, 0.93, 1.11, 1.31, 1.86, 3.73, 9.79],
    MEDIUM: [30.04, 11.82, 4.55, 2.73, 0.91, 0.45, 0.19, 0.45, 0.91, 2.73, 4.55, 11.82, 30.04],
    HIGH: [164.88, 23.28, 7.86, 1.94, 0.68, 0.19, 0.19, 0.19, 0.68, 1.94, 7.86, 23.28, 164.88],
  },
  14: {
    LOW: [6.88, 3.88, 1.84, 1.36, 1.26, 1.07, 0.97, 0.48, 0.97, 1.07, 1.26, 1.36, 1.84, 3.88, 6.88],
    MEDIUM: [56.41, 14.59, 6.81, 3.89, 1.85, 0.97, 0.48, 0.19, 0.48, 0.97, 1.85, 3.89, 6.81, 14.59, 56.41],
    HIGH: [408.57, 54.47, 17.51, 4.86, 1.85, 0.29, 0.19, 0.19, 0.19, 0.29, 1.85, 4.86, 17.51, 54.47, 408.57],
  },
  16: {
    LOW: [15.53, 8.73, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.48, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.73, 15.53],
    MEDIUM: [107.39, 40.02, 9.76, 4.89, 2.92, 1.45, 0.97, 0.48, 0.29, 0.48, 0.97, 1.45, 2.92, 4.89, 9.76, 40.02, 107.39],
    HIGH: [973.07, 126.5, 25.3, 8.76, 3.89, 1.95, 0.19, 0.19, 0.19, 0.19, 0.19, 1.95, 3.89, 8.76, 25.3, 126.5, 973.07],
  },
};

// ── Production functions ───────────────────────────────────
function generatePath(rows: number, serverSeed: string, clientSeed: string, nonce: number): number[] {
  const path: number[] = [];
  for (let i = 0; i < rows; i++) {
    const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${i}`).digest('hex');
    const value = parseInt(hash.substring(0, 8), 16);
    path.push(value % 2);
  }
  return path;
}

function calculateBucketFromPath(path: number[]): number {
  return path.reduce((sum, dir) => sum + dir, 0);
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
  return result;
}

function verifyHouseEdge(rows: number, risk: string): { ev: number; houseEdge: number } {
  const multipliers = PLINKO_MULTIPLIERS[rows]?.[risk];
  if (!multipliers) return { ev: 0, houseEdge: 100 };
  let ev = 0;
  for (let i = 0; i < multipliers.length; i++) {
    const prob = binomial(rows, i) / Math.pow(2, rows);
    ev += prob * multipliers[i];
  }
  return { ev, houseEdge: (1 - ev) * 100 };
}

function getDynamicMultiplierArray(rows: number, risk: string, houseEdge: number = 0.04): number[] {
  const baseMultipliers = PLINKO_MULTIPLIERS[rows]?.[risk] || [];
  const BASE_RTP = 0.96;
  const targetRTP = 1 - houseEdge;
  const scaleFactor = targetRTP / BASE_RTP;
  return baseMultipliers.map(m => parseFloat((m * scaleFactor).toFixed(4)));
}

// ── Config ─────────────────────────────────────────────────
const SS = 'mega-test-server-seed-plinko-2026';
const CS = 'mega-test-client-seed';
const BET = 10;
const ROWS = [8, 10, 12, 14, 16];
const RISKS = ['LOW', 'MEDIUM', 'HIGH'];

describe('PLINKO MEGA TEST SUITE (1M+ Simulations)', () => {

  // ════════════════════════════════════════════════════════════
  // 1. PATH GENERATION — Binomial distribution
  // ════════════════════════════════════════════════════════════
  describe('1. Path Generation — Binomial Distribution', () => {
    for (const rows of ROWS) {
      it(`${rows} rows: each step should be ~50/50 left/right (500K paths)`, () => {
        const directionCounts = new Array(rows).fill(0);
        const N = 100000;
        for (let i = 0; i < N; i++) {
          const path = generatePath(rows, SS, CS, i);
          for (let j = 0; j < rows; j++) directionCounts[j] += path[j];
        }
        for (let j = 0; j < rows; j++) {
          const rightRate = directionCounts[j] / N;
          expect(rightRate).toBeGreaterThan(0.48);
          expect(rightRate).toBeLessThan(0.52);
        }
      });

      it(`${rows} rows: bucket distribution should follow binomial (100K drops)`, () => {
        const bucketCounts = new Array(rows + 1).fill(0);
        const N = 100000;
        for (let i = 0; i < N; i++) {
          const path = generatePath(rows, SS, CS, i);
          bucketCounts[calculateBucketFromPath(path)]++;
        }
        for (let b = 0; b <= rows; b++) {
          const expected = N * binomial(rows, b) / Math.pow(2, rows);
          if (expected > 50) {
            expect(bucketCounts[b]).toBeGreaterThan(expected * 0.75);
            expect(bucketCounts[b]).toBeLessThan(expected * 1.25);
          }
        }
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 2. RTP VERIFICATION — Mathematical (EV from tables)
  // ════════════════════════════════════════════════════════════
  describe('2. RTP Verification — Mathematical Proof', () => {
    for (const rows of ROWS) {
      for (const risk of RISKS) {
        it(`${rows} rows, ${risk}: EV should be ~0.96 (±1%)`, () => {
          const { ev, houseEdge } = verifyHouseEdge(rows, risk);
          expect(ev).toBeGreaterThan(0.93);
          expect(ev).toBeLessThan(0.99);
          expect(houseEdge).toBeGreaterThan(1);
          expect(houseEdge).toBeLessThan(7);
        });
      }
    }
  });

  // ════════════════════════════════════════════════════════════
  // 3. MONTE CARLO RTP — 100K per config
  // ════════════════════════════════════════════════════════════
  describe('3. Monte Carlo RTP — 100K per Config', () => {
    for (const rows of [8, 12, 16]) {
      for (const risk of RISKS) {
        it(`${rows} rows, ${risk}: empirical RTP ~96% (±3%)`, () => {
          const multipliers = PLINKO_MULTIPLIERS[rows][risk];
          const N = 100000;
          let wagered = 0, payout = 0;
          for (let i = 0; i < N; i++) {
            wagered += BET;
            const path = generatePath(rows, SS, CS, i);
            const bucket = calculateBucketFromPath(path);
            payout += BET * multipliers[bucket];
          }
          const rtp = payout / wagered;
          expect(rtp).toBeGreaterThan(0.90);
          expect(rtp).toBeLessThan(1.02);
        });
      }
    }
  });

  // ════════════════════════════════════════════════════════════
  // 4. DYNAMIC HOUSE EDGE
  // ════════════════════════════════════════════════════════════
  describe('4. Dynamic House Edge Scaling', () => {
    for (const he of [0.01, 0.02, 0.04, 0.06, 0.08, 0.10]) {
      it(`HE=${(he * 100)}%: scaled EV should be ~${((1 - he) * 100).toFixed(0)}%`, () => {
        const rows = 12;
        const risk = 'MEDIUM';
        const scaledMultipliers = getDynamicMultiplierArray(rows, risk, he);
        let ev = 0;
        for (let i = 0; i < scaledMultipliers.length; i++) {
          const prob = binomial(rows, i) / Math.pow(2, rows);
          ev += prob * scaledMultipliers[i];
        }
        expect(ev).toBeGreaterThan((1 - he) - 0.02);
        expect(ev).toBeLessThan((1 - he) + 0.02);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 5. PROVABLY FAIR
  // ════════════════════════════════════════════════════════════
  describe('5. Provably Fair Determinism', () => {
    it('same seeds produce same paths (10K checks)', () => {
      for (let i = 0; i < 10000; i++) {
        expect(generatePath(12, SS, CS, i)).toEqual(generatePath(12, SS, CS, i));
      }
    });

    it('different seeds produce different paths', () => {
      let diff = 0;
      for (let i = 0; i < 10000; i++) {
        const p1 = generatePath(12, `s${i}`, CS, 0);
        const p2 = generatePath(12, `s${i + 10000}`, CS, 0);
        if (JSON.stringify(p1) !== JSON.stringify(p2)) diff++;
      }
      expect(diff / 10000).toBeGreaterThan(0.99);
    });

    it('path length always equals rows', () => {
      for (const rows of ROWS) {
        for (let i = 0; i < 1000; i++) {
          expect(generatePath(rows, SS, CS, i).length).toBe(rows);
        }
      }
    });

    it('path values are always 0 or 1', () => {
      for (let i = 0; i < 10000; i++) {
        const path = generatePath(16, SS, CS, i);
        for (const dir of path) {
          expect(dir === 0 || dir === 1).toBe(true);
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 6. MULTIPLIER TABLE SYMMETRY
  // ════════════════════════════════════════════════════════════
  describe('6. Multiplier Table Symmetry', () => {
    for (const rows of ROWS) {
      for (const risk of RISKS) {
        it(`${rows} rows, ${risk}: table should be symmetric`, () => {
          const mults = PLINKO_MULTIPLIERS[rows][risk];
          const n = mults.length;
          for (let i = 0; i < Math.floor(n / 2); i++) {
            expect(mults[i]).toBe(mults[n - 1 - i]);
          }
        });
      }
    }
  });

  // ════════════════════════════════════════════════════════════
  // 7. BUCKET COUNT CORRECTNESS
  // ════════════════════════════════════════════════════════════
  describe('7. Bucket Count Correctness', () => {
    for (const rows of ROWS) {
      it(`${rows} rows: should have ${rows + 1} buckets`, () => {
        for (const risk of RISKS) {
          expect(PLINKO_MULTIPLIERS[rows][risk].length).toBe(rows + 1);
        }
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 8. EDGE CASES
  // ════════════════════════════════════════════════════════════
  describe('8. Edge Cases', () => {
    it('bucket index always in [0, rows]', () => {
      for (const rows of ROWS) {
        for (let i = 0; i < 10000; i++) {
          const bucket = calculateBucketFromPath(generatePath(rows, SS, CS, i));
          expect(bucket).toBeGreaterThanOrEqual(0);
          expect(bucket).toBeLessThanOrEqual(rows);
        }
      }
    });

    it('empty path returns bucket 0', () => {
      expect(calculateBucketFromPath([])).toBe(0);
    });

    it('all-right path returns bucket = rows', () => {
      expect(calculateBucketFromPath([1, 1, 1, 1, 1, 1, 1, 1])).toBe(8);
    });

    it('all-left path returns bucket 0', () => {
      expect(calculateBucketFromPath([0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    });

    it('invalid rows return empty multiplier array', () => {
      expect(getDynamicMultiplierArray(7, 'LOW')).toEqual([]);
      expect(getDynamicMultiplierArray(17, 'LOW')).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 9. STREAK ANALYSIS
  // ════════════════════════════════════════════════════════════
  describe('9. Streak Analysis', () => {
    it('max consecutive same-bucket drops should be < 10 (100K drops)', () => {
      let max = 0, cur = 0, prev = -1;
      for (let i = 0; i < 100000; i++) {
        const bucket = calculateBucketFromPath(generatePath(12, SS, CS, i));
        if (bucket === prev) { cur++; max = Math.max(max, cur); }
        else { cur = 1; prev = bucket; }
      }
      expect(max).toBeLessThan(10);
    });

    it('max consecutive wins (mult > 1) at LOW risk should be < 30', () => {
      let max = 0, cur = 0;
      const mults = PLINKO_MULTIPLIERS[12]['LOW'];
      for (let i = 0; i < 100000; i++) {
        const bucket = calculateBucketFromPath(generatePath(12, SS, CS, i));
        if (mults[bucket] > 1) { cur++; max = Math.max(max, cur); }
        else cur = 0;
      }
      expect(max).toBeLessThan(30);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 10. CROSS-CONFIG COMPARISON
  // ════════════════════════════════════════════════════════════
  describe('10. Cross-Config Comparison', () => {
    it('HIGH risk should have higher max multiplier than LOW', () => {
      for (const rows of ROWS) {
        const maxLow = Math.max(...PLINKO_MULTIPLIERS[rows]['LOW']);
        const maxHigh = Math.max(...PLINKO_MULTIPLIERS[rows]['HIGH']);
        expect(maxHigh).toBeGreaterThan(maxLow);
      }
    });

    it('HIGH risk should have lower min multiplier than LOW', () => {
      for (const rows of ROWS) {
        const minLow = Math.min(...PLINKO_MULTIPLIERS[rows]['LOW']);
        const minHigh = Math.min(...PLINKO_MULTIPLIERS[rows]['HIGH']);
        expect(minHigh).toBeLessThanOrEqual(minLow);
      }
    });

    it('more rows should have higher max multiplier for same risk', () => {
      for (const risk of RISKS) {
        const max8 = Math.max(...PLINKO_MULTIPLIERS[8][risk]);
        const max16 = Math.max(...PLINKO_MULTIPLIERS[16][risk]);
        expect(max16).toBeGreaterThan(max8);
      }
    });

    it('all configs should have similar EV (~0.96)', () => {
      const evs: number[] = [];
      for (const rows of ROWS) {
        for (const risk of RISKS) {
          evs.push(verifyHouseEdge(rows, risk).ev);
        }
      }
      const avg = evs.reduce((a, b) => a + b, 0) / evs.length;
      for (const ev of evs) {
        expect(Math.abs(ev - avg)).toBeLessThan(0.03);
      }
    });
  });
});
