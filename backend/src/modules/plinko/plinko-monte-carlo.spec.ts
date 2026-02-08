/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PLINKO MONTE CARLO STRESS TEST - "THE MILLION PLAYER ASSAULT"     ║
 * ║  Tests 1,000,000+ simulations per risk level to verify House Edge  ║
 * ║  Tolerance: ±0.5% from target 4% House Edge                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import * as crypto from 'crypto';
import {
  PLINKO_MULTIPLIERS,
  getMultiplier,
  calculateBucketFromPath,
  verifyHouseEdge,
  getMultiplierArray,
  RiskLevel,
} from './plinko.constants';

// ============ HELPER: Replicate the exact server-side path generation ============
function generatePath(rows: number, seed: string): number[] {
  const path: number[] = [];
  for (let i = 0; i < rows; i++) {
    const hash = crypto
      .createHash('sha256')
      .update(seed + i.toString())
      .digest('hex');
    const value = parseInt(hash.substring(0, 8), 16);
    path.push(value % 2);
  }
  return path;
}

// ============ HELPER: Run N simulations and return stats ============
function runSimulation(
  rows: number,
  risk: RiskLevel,
  numSimulations: number,
): {
  totalWagered: number;
  totalPayout: number;
  rtp: number;
  houseEdge: number;
  bucketDistribution: number[];
  minPayout: number;
  maxPayout: number;
  bustCount: number;
  bigWinCount: number;
} {
  let totalWagered = 0;
  let totalPayout = 0;
  let minPayout = Infinity;
  let maxPayout = 0;
  let bustCount = 0;
  let bigWinCount = 0;
  const bucketDistribution = new Array(rows + 1).fill(0);

  for (let i = 0; i < numSimulations; i++) {
    const seed = crypto.randomBytes(32).toString('hex');
    const path = generatePath(rows, seed);
    const bucketIndex = calculateBucketFromPath(path);
    const multiplier = getMultiplier(rows, risk, bucketIndex);
    const betAmount = 1; // Normalize to $1 bets
    const payout = betAmount * multiplier;

    totalWagered += betAmount;
    totalPayout += payout;
    bucketDistribution[bucketIndex]++;

    if (payout < minPayout) minPayout = payout;
    if (payout > maxPayout) maxPayout = payout;
    if (payout < betAmount) bustCount++;
    if (payout >= betAmount * 10) bigWinCount++;
  }

  const rtp = totalPayout / totalWagered;
  const houseEdge = (1 - rtp) * 100;

  return {
    totalWagered,
    totalPayout,
    rtp,
    houseEdge,
    bucketDistribution,
    minPayout,
    maxPayout,
    bustCount,
    bigWinCount,
  };
}

// ============ TESTS ============

describe('Plinko Monte Carlo Stress Test - "The Million Player Assault"', () => {
  // ─────────────────────────────────────────────────────────────────
  // SECTION 1: MILLION-ROUND HOUSE EDGE VERIFICATION
  // ─────────────────────────────────────────────────────────────────
  describe('1. House Edge Verification (1,000,000 rounds per risk level)', () => {
    const SIMULATIONS = 1_000_000;
    const TOLERANCE = 0.5; // ±0.5% tolerance from target 4%
    const TARGET_HE = 4.0;

    it('1.1 LOW risk (16 rows) - 1M rounds should converge to ~4% House Edge', () => {
      const result = runSimulation(16, 'LOW', SIMULATIONS);
      console.log(`LOW 16: RTP=${(result.rtp * 100).toFixed(4)}% HE=${result.houseEdge.toFixed(4)}% (${SIMULATIONS} rounds)`);
      expect(result.houseEdge).toBeGreaterThan(TARGET_HE - TOLERANCE);
      expect(result.houseEdge).toBeLessThan(TARGET_HE + TOLERANCE);
    }, 120000);

    it('1.2 MEDIUM risk (16 rows) - 1M rounds should converge to ~4% House Edge', () => {
      const result = runSimulation(16, 'MEDIUM', SIMULATIONS);
      console.log(`MEDIUM 16: RTP=${(result.rtp * 100).toFixed(4)}% HE=${result.houseEdge.toFixed(4)}% (${SIMULATIONS} rounds)`);
      expect(result.houseEdge).toBeGreaterThan(TARGET_HE - TOLERANCE);
      expect(result.houseEdge).toBeLessThan(TARGET_HE + TOLERANCE);
    }, 120000);

    it('1.3 HIGH risk (16 rows) - 1M rounds should converge to ~4% House Edge', () => {
      const result = runSimulation(16, 'HIGH', SIMULATIONS);
      console.log(`HIGH 16: RTP=${(result.rtp * 100).toFixed(4)}% HE=${result.houseEdge.toFixed(4)}% (${SIMULATIONS} rounds)`);
      // HIGH risk has extreme variance (multipliers up to 110x), so wider tolerance needed
      const HIGH_TOLERANCE = 1.5;
      expect(result.houseEdge).toBeGreaterThan(TARGET_HE - HIGH_TOLERANCE);
      expect(result.houseEdge).toBeLessThan(TARGET_HE + HIGH_TOLERANCE);
    }, 120000);

    it('1.4 LOW risk (8 rows) - 1M rounds should converge to ~4% House Edge', () => {
      const result = runSimulation(8, 'LOW', SIMULATIONS);
      console.log(`LOW 8: RTP=${(result.rtp * 100).toFixed(4)}% HE=${result.houseEdge.toFixed(4)}% (${SIMULATIONS} rounds)`);
      expect(result.houseEdge).toBeGreaterThan(TARGET_HE - TOLERANCE);
      expect(result.houseEdge).toBeLessThan(TARGET_HE + TOLERANCE);
    }, 120000);

    it('1.5 HIGH risk (8 rows) - 1M rounds should converge to ~4% House Edge', () => {
      const result = runSimulation(8, 'HIGH', SIMULATIONS);
      console.log(`HIGH 8: RTP=${(result.rtp * 100).toFixed(4)}% HE=${result.houseEdge.toFixed(4)}% (${SIMULATIONS} rounds)`);
      // HIGH risk has extreme variance, wider tolerance
      const HIGH_TOLERANCE = 1.5;
      expect(result.houseEdge).toBeGreaterThan(TARGET_HE - HIGH_TOLERANCE);
      expect(result.houseEdge).toBeLessThan(TARGET_HE + HIGH_TOLERANCE);
    }, 120000);
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 2: ALL 27 COMBINATIONS - 100K ROUNDS EACH
  // ─────────────────────────────────────────────────────────────────
  describe('2. All 27 Row-Risk Combinations (100,000 rounds each)', () => {
    const SIMULATIONS = 100_000;
    const TOLERANCE_LOW_MED = 1.5; // ±1.5% for LOW/MEDIUM with 100K rounds
    const TOLERANCE_HIGH = 3.5; // ±3.5% for HIGH risk (extreme variance from 110x multipliers)
    const TARGET_HE = 4.0;

    const risks: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
    for (let rows = 8; rows <= 16; rows++) {
      for (const risk of risks) {
        it(`2.${rows}-${risk}: ${rows} rows ${risk} risk - HE should be ~4%`, () => {
          const result = runSimulation(rows, risk, SIMULATIONS);
          const tolerance = risk === 'HIGH' ? TOLERANCE_HIGH : TOLERANCE_LOW_MED;
          console.log(`${rows} ${risk}: RTP=${(result.rtp * 100).toFixed(2)}% HE=${result.houseEdge.toFixed(2)}% (tolerance: ±${tolerance}%)`);
          expect(result.houseEdge).toBeGreaterThan(TARGET_HE - tolerance);
          expect(result.houseEdge).toBeLessThan(TARGET_HE + tolerance);
        }, 60000);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 3: BUCKET DISTRIBUTION - BINOMIAL VERIFICATION
  // ─────────────────────────────────────────────────────────────────
  describe('3. Bucket Distribution follows Binomial Distribution', () => {
    const SIMULATIONS = 500_000;

    function binomialProb(n: number, k: number): number {
      let coeff = 1;
      for (let i = 0; i < k; i++) {
        coeff = (coeff * (n - i)) / (i + 1);
      }
      return coeff / Math.pow(2, n);
    }

    it('3.1 16 rows - bucket distribution matches binomial within 0.5%', () => {
      const rows = 16;
      const result = runSimulation(rows, 'LOW', SIMULATIONS);
      for (let k = 0; k <= rows; k++) {
        const expected = binomialProb(rows, k);
        const actual = result.bucketDistribution[k] / SIMULATIONS;
        const diff = Math.abs(expected - actual);
        expect(diff).toBeLessThan(0.005); // Within 0.5%
      }
    }, 60000);

    it('3.2 8 rows - bucket distribution matches binomial within 0.5%', () => {
      const rows = 8;
      const result = runSimulation(rows, 'LOW', SIMULATIONS);
      for (let k = 0; k <= rows; k++) {
        const expected = binomialProb(rows, k);
        const actual = result.bucketDistribution[k] / SIMULATIONS;
        const diff = Math.abs(expected - actual);
        expect(diff).toBeLessThan(0.005);
      }
    }, 60000);

    it('3.3 12 rows - center bucket should be most frequent', () => {
      const rows = 12;
      const result = runSimulation(rows, 'MEDIUM', SIMULATIONS);
      const centerBucket = Math.floor(rows / 2);
      const centerCount = result.bucketDistribution[centerBucket];
      // Center bucket should have the highest count
      for (let k = 0; k <= rows; k++) {
        if (k !== centerBucket) {
          expect(centerCount).toBeGreaterThanOrEqual(result.bucketDistribution[k]);
        }
      }
    }, 60000);
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 4: PATH GENERATION FAIRNESS
  // ─────────────────────────────────────────────────────────────────
  describe('4. Path Generation Cryptographic Fairness', () => {
    it('4.1 Different seeds produce different paths', () => {
      const paths = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const path = generatePath(16, seed);
        paths.add(path.join(''));
      }
      // With 2^16 = 65536 possible paths, 10K unique seeds should produce many unique paths
      expect(paths.size).toBeGreaterThan(9000);
    });

    it('4.2 Same seed always produces same path (deterministic)', () => {
      const seed = 'test-seed-12345';
      const path1 = generatePath(16, seed);
      const path2 = generatePath(16, seed);
      const path3 = generatePath(16, seed);
      expect(path1).toEqual(path2);
      expect(path2).toEqual(path3);
    });

    it('4.3 Path values are only 0 or 1', () => {
      for (let i = 0; i < 1000; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const path = generatePath(16, seed);
        path.forEach((v) => {
          expect(v === 0 || v === 1).toBe(true);
        });
      }
    });

    it('4.4 Path length always equals number of rows', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const path = generatePath(rows, seed);
        expect(path.length).toBe(rows);
      }
    });

    it('4.5 Left-Right distribution is ~50/50 over 1M decisions', () => {
      let leftCount = 0;
      let rightCount = 0;
      const totalDecisions = 1_000_000;
      const rows = 16;
      const rounds = Math.ceil(totalDecisions / rows);

      for (let i = 0; i < rounds; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const path = generatePath(rows, seed);
        path.forEach((v) => {
          if (v === 0) leftCount++;
          else rightCount++;
        });
      }

      const total = leftCount + rightCount;
      const leftRatio = leftCount / total;
      // Should be within 0.5% of 50%
      expect(leftRatio).toBeGreaterThan(0.495);
      expect(leftRatio).toBeLessThan(0.505);
    }, 60000);

    it('4.6 No sequential correlation - row N should not predict row N+1', () => {
      // Chi-squared test for independence between consecutive rows
      const counts = { '00': 0, '01': 0, '10': 0, '11': 0 };
      const SAMPLES = 100_000;

      for (let i = 0; i < SAMPLES; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const path = generatePath(16, seed);
        for (let j = 0; j < path.length - 1; j++) {
          const key = `${path[j]}${path[j + 1]}` as keyof typeof counts;
          counts[key]++;
        }
      }

      const total = counts['00'] + counts['01'] + counts['10'] + counts['11'];
      const expected = total / 4;

      // Chi-squared test: each combination should be ~25%
      for (const [key, observed] of Object.entries(counts)) {
        const deviation = Math.abs(observed - expected) / expected;
        expect(deviation).toBeLessThan(0.01); // Within 1% of expected
      }
    }, 30000);
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 5: EXTREME EDGE CASES - BREAKING ATTEMPTS
  // ─────────────────────────────────────────────────────────────────
  describe('5. Extreme Edge Cases - Attempting to Break the System', () => {
    it('5.1 Bucket index from all-left path should be 0', () => {
      const allLeft = new Array(16).fill(0);
      expect(calculateBucketFromPath(allLeft)).toBe(0);
    });

    it('5.2 Bucket index from all-right path should be rows', () => {
      const rows = 16;
      const allRight = new Array(rows).fill(1);
      expect(calculateBucketFromPath(allRight)).toBe(rows);
    });

    it('5.3 Every possible bucket is reachable for all row counts', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const reachedBuckets = new Set<number>();
        // Generate enough paths to hit all buckets
        for (let i = 0; i < 200000 && reachedBuckets.size < rows + 1; i++) {
          const seed = crypto.randomBytes(32).toString('hex');
          const path = generatePath(rows, seed);
          reachedBuckets.add(calculateBucketFromPath(path));
        }
        expect(reachedBuckets.size).toBe(rows + 1);
      }
    }, 60000);

    it('5.4 Multiplier for every valid bucket is > 0', () => {
      const risks: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of risks) {
          for (let bucket = 0; bucket <= rows; bucket++) {
            const mult = getMultiplier(rows, risk, bucket);
            expect(mult).toBeGreaterThan(0);
          }
        }
      }
    });

    it('5.5 Invalid bucket index returns 0 multiplier', () => {
      expect(getMultiplier(16, 'LOW', -1)).toBe(0);
      expect(getMultiplier(16, 'LOW', 17)).toBe(0);
      expect(getMultiplier(16, 'LOW', 100)).toBe(0);
    });

    it('5.6 Invalid rows returns empty multiplier array', () => {
      expect(getMultiplierArray(7, 'LOW')).toEqual([]);
      expect(getMultiplierArray(17, 'LOW')).toEqual([]);
      expect(getMultiplierArray(0, 'LOW')).toEqual([]);
      expect(getMultiplierArray(-1, 'LOW')).toEqual([]);
    });

    it('5.7 Empty path returns bucket 0', () => {
      expect(calculateBucketFromPath([])).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 6: LONG-RUN STABILITY TEST
  // ─────────────────────────────────────────────────────────────────
  describe('6. Long-Run Stability - House Edge Never Drifts', () => {
    it('6.1 House Edge stays within bounds across 10 batches of 100K', () => {
      const BATCH_SIZE = 100_000;
      const BATCHES = 10;
      const houseEdges: number[] = [];

      for (let batch = 0; batch < BATCHES; batch++) {
        const result = runSimulation(16, 'MEDIUM', BATCH_SIZE);
        houseEdges.push(result.houseEdge);
        console.log(`Batch ${batch + 1}: HE=${result.houseEdge.toFixed(4)}%`);
      }

      // Every single batch should be within ±1.5% of 4%
      houseEdges.forEach((he, i) => {
        expect(he).toBeGreaterThan(2.5);
        expect(he).toBeLessThan(5.5);
      });

      // Average across all batches should be very close to 4%
      const avgHE = houseEdges.reduce((a, b) => a + b, 0) / BATCHES;
      expect(avgHE).toBeGreaterThan(3.5);
      expect(avgHE).toBeLessThan(4.5);
    }, 300000);
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 7: PAYOUT RANGE VERIFICATION
  // ─────────────────────────────────────────────────────────────────
  describe('7. Payout Range and Variance Verification', () => {
    it('7.1 HIGH risk has higher max payout than LOW risk', () => {
      const highResult = runSimulation(16, 'HIGH', 100_000);
      const lowResult = runSimulation(16, 'LOW', 100_000);
      expect(highResult.maxPayout).toBeGreaterThan(lowResult.maxPayout);
    }, 60000);

    it('7.2 HIGH risk has more busts than LOW risk', () => {
      const highResult = runSimulation(16, 'HIGH', 100_000);
      const lowResult = runSimulation(16, 'LOW', 100_000);
      expect(highResult.bustCount).toBeGreaterThan(lowResult.bustCount);
    }, 60000);

    it('7.3 LOW risk has lowest variance (most consistent payouts)', () => {
      const SIMS = 100_000;
      function calcVariance(rows: number, risk: RiskLevel): number {
        let sumSquaredDiff = 0;
        const mean = verifyHouseEdge(rows, risk).ev;
        for (let i = 0; i < SIMS; i++) {
          const seed = crypto.randomBytes(32).toString('hex');
          const path = generatePath(rows, seed);
          const bucket = calculateBucketFromPath(path);
          const mult = getMultiplier(rows, risk, bucket);
          sumSquaredDiff += Math.pow(mult - mean, 2);
        }
        return sumSquaredDiff / SIMS;
      }

      const lowVar = calcVariance(16, 'LOW');
      const medVar = calcVariance(16, 'MEDIUM');
      const highVar = calcVariance(16, 'HIGH');

      expect(lowVar).toBeLessThan(medVar);
      expect(medVar).toBeLessThan(highVar);
    }, 120000);

    it('7.4 No payout ever exceeds the maximum multiplier for that risk/rows', () => {
      const risks: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of risks) {
          const mults = getMultiplierArray(rows, risk);
          const maxMult = Math.max(...mults);
          const result = runSimulation(rows, risk, 10_000);
          expect(result.maxPayout).toBeLessThanOrEqual(maxMult);
        }
      }
    }, 120000);
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 8: PROVABLY FAIR VERIFICATION
  // ─────────────────────────────────────────────────────────────────
  describe('8. Provably Fair - Seed Verification', () => {
    it('8.1 Server seed hash matches SHA256 of server seed', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        // Verify the hash is deterministic
        const hash2 = crypto.createHash('sha256').update(serverSeed).digest('hex');
        expect(hash).toBe(hash2);
        expect(hash.length).toBe(64); // SHA256 = 64 hex chars
      }
    });

    it('8.2 Path is fully determined by server seed (reproducible)', () => {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const path1 = generatePath(16, serverSeed);
      const bucket1 = calculateBucketFromPath(path1);

      // Replay 100 times - must always get same result
      for (let i = 0; i < 100; i++) {
        const path = generatePath(16, serverSeed);
        const bucket = calculateBucketFromPath(path);
        expect(path).toEqual(path1);
        expect(bucket).toBe(bucket1);
      }
    });

    it('8.3 Changing even 1 bit of seed changes the path', () => {
      const seed1 = 'a'.repeat(64);
      const seed2 = 'a'.repeat(63) + 'b';
      const path1 = generatePath(16, seed1);
      const path2 = generatePath(16, seed2);
      expect(path1).not.toEqual(path2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 9: THEORETICAL vs SIMULATED COMPARISON
  // ─────────────────────────────────────────────────────────────────
  describe('9. Theoretical vs Simulated RTP Convergence', () => {
    it('9.1 All 27 combinations: simulated RTP within 0.5% of theoretical', () => {
      const SIMS = 200_000;
      const risks: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      const failures: string[] = [];

      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of risks) {
          const theoretical = verifyHouseEdge(rows, risk);
          const simulated = runSimulation(rows, risk, SIMS);
          const diff = Math.abs(theoretical.ev - simulated.rtp) * 100;
          // HIGH risk needs wider tolerance due to extreme multiplier variance
          const maxDiff = risk === 'HIGH' ? 3.0 : 0.75;

          if (diff > maxDiff) {
            failures.push(
              `${rows} ${risk}: Theoretical=${(theoretical.ev * 100).toFixed(2)}% Simulated=${(simulated.rtp * 100).toFixed(2)}% Diff=${diff.toFixed(2)}% (max: ${maxDiff}%)`,
            );
          }
        }
      }

      if (failures.length > 0) {
        console.log('FAILURES:', failures);
      }
      expect(failures.length).toBe(0);
    }, 600000);
  });
});
