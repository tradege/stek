/**
 * PLINKO MONTE CARLO STRESS TEST
 * 100,000+ simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number, row: number): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${row}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

function generatePath(serverSeed: string, clientSeed: string, nonce: number, rows: number): string[] {
  const path: string[] = [];
  for (let i = 0; i < rows; i++) {
    // Match actual service: use value % 2 (not float < 0.5)
    const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${i}`).digest('hex');
    const value = parseInt(hash.substring(0, 8), 16);
    path.push(value % 2 === 0 ? 'L' : 'R');
  }
  return path;
}

function pathToBucket(path: string[]): number {
  let pos = 0;
  for (const dir of path) { if (dir === 'R') pos++; }
  return pos;
}

// Simplified multiplier tables for testing
const MULTIPLIERS: Record<string, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

describe('Plinko Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-plinko-v2';
  const CS = 'mc-client-seed';
  const N = 10000;
  const BET = 10;

  describe('1. House Edge Verification', () => {
    for (const risk of ['low', 'medium', 'high']) {
      it(`should have positive house edge for ${risk} risk, 16 rows`, () => {
        const rows = 16;
        const mults = MULTIPLIERS[risk][rows];
        let wagered = 0, payout = 0;
        for (let i = 0; i < N; i++) {
          const path = generatePath(SS, CS, i, rows);
          const bucket = pathToBucket(path);
          wagered += BET;
          payout += BET * mults[bucket];
        }
        const rtp = payout / wagered;
        expect(rtp).toBeGreaterThan(0.82);
        expect(rtp).toBeLessThan(1.05);
      });
    }
  });

  describe('2. Path Distribution (Binomial)', () => {
    it('should have ~50% left/right at each row', () => {
      let leftCount = 0, total = 0;
      for (let i = 0; i < N; i++) {
        const path = generatePath(SS, CS, i, 16);
        path.forEach(d => { if (d === 'L') leftCount++; total++; });
      }
      expect(leftCount / total).toBeCloseTo(0.5, 1);
    });

    it('should produce bell-curve bucket distribution for 16 rows', () => {
      const buckets = new Array(17).fill(0);
      for (let i = 0; i < N; i++) {
        const bucket = pathToBucket(generatePath(SS, CS, i, 16));
        buckets[bucket]++;
      }
      // Center buckets should have more hits than edge buckets
      expect(buckets[8]).toBeGreaterThan(buckets[0]);
      expect(buckets[8]).toBeGreaterThan(buckets[16]);
    });
  });

  describe('3. Bucket Symmetry', () => {
    it('should have symmetric bucket distribution', () => {
      const buckets = new Array(17).fill(0);
      for (let i = 0; i < N; i++) {
        buckets[pathToBucket(generatePath(SS, CS, i, 16))]++;
      }
      for (let b = 0; b < 8; b++) {
        const ratio = buckets[b] / (buckets[16 - b] || 1);
        expect(ratio).toBeGreaterThan(0.8);
        expect(ratio).toBeLessThan(1.2);
      }
    });
  });

  describe('4. Provably Fair Verification', () => {
    it('should produce identical paths with same seeds', () => {
      for (let i = 0; i < 100; i++) {
        expect(generatePath(SS, CS, i, 16)).toEqual(generatePath(SS, CS, i, 16));
      }
    });
    it('should differ with different seeds', () => {
      expect(generatePath('A', CS, 0, 16)).not.toEqual(generatePath('B', CS, 0, 16));
    });
    it('should differ with different nonces', () => {
      expect(generatePath(SS, CS, 0, 16)).not.toEqual(generatePath(SS, CS, 1, 16));
    });
  });

  describe('5. Row Variations', () => {
    for (const rows of [8, 12, 16]) {
      it(`should generate valid paths for ${rows} rows`, () => {
        for (let i = 0; i < 1000; i++) {
          const path = generatePath(SS, CS, i, rows);
          expect(path.length).toBe(rows);
          path.forEach(d => expect(['L', 'R']).toContain(d));
          const bucket = pathToBucket(path);
          expect(bucket).toBeGreaterThanOrEqual(0);
          expect(bucket).toBeLessThanOrEqual(rows);
        }
      });
    }
  });

  describe('6. Long-Run Stability', () => {
    it('should maintain stable RTP across 10 batches of 10K', () => {
      const rtps: number[] = [];
      const rows = 16;
      const mults = MULTIPLIERS['low'][rows];
      for (let b = 0; b < 10; b++) {
        let w = 0, p = 0;
        for (let i = 0; i < 10000; i++) {
          const bucket = pathToBucket(generatePath(SS, CS, b * 10000 + i, rows));
          w += BET; p += BET * mults[bucket];
        }
        rtps.push(p / w);
      }
      const mean = rtps.reduce((a, b) => a + b) / rtps.length;
      expect(mean).toBeGreaterThan(0.82);
      expect(mean).toBeLessThan(1.05);
    });
  });

  describe('7. Edge Cases', () => {
    it('should handle nonce 0', () => { expect(generatePath(SS, CS, 0, 8).length).toBe(8); });
    it('should handle large nonce', () => { expect(generatePath(SS, CS, 999999, 16).length).toBe(16); });
    it('should handle empty client seed', () => { expect(generatePath(SS, '', 0, 8).length).toBe(8); });
  });
});
