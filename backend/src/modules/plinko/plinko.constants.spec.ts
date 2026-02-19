/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PLINKO CONSTANTS - MATHEMATICAL VERIFICATION TESTS                ║
 * ║  Covers: All 27 row-risk combinations, RTP, symmetry, helper       ║
 * ║  functions, edge cases, binomial distribution compliance            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import {
  PLINKO_MULTIPLIERS,
  getMultiplier,
  getMultiplierArray,
  calculateBucketFromPath,
  verifyHouseEdge,
  RiskLevel,
  PHYSICS,
  VISUALS,
  RISK_COLORS,
} from './plinko.constants';

// ============ HELPER ============
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}


const mockVipService = {
  updateUserStats: jest.fn().mockResolvedValue(undefined),
  checkLevelUp: jest.fn().mockResolvedValue({ leveledUp: false, newLevel: 0, tierName: 'Bronze' }),
  processRakeback: jest.fn().mockResolvedValue(undefined),
  claimRakeback: jest.fn().mockResolvedValue({ success: true, amount: 0, message: 'OK' }),
  getVipStatus: jest.fn().mockResolvedValue({}),
};

describe('Plinko Constants - Mathematical Verification', () => {
  const ALL_RISKS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

  // ─────────────────────────────────────────────────────────────────
  // SECTION 1: MULTIPLIER TABLE STRUCTURE
  // ─────────────────────────────────────────────────────────────────
  describe('1. Multiplier Table Structure', () => {
    it('1.1 Should have entries for all rows 8-16', () => {
      for (let rows = 8; rows <= 16; rows++) {
        expect(PLINKO_MULTIPLIERS[rows]).toBeDefined();
      }
    });

    it('1.2 Each row should have LOW, MEDIUM, HIGH risk levels', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          expect(PLINKO_MULTIPLIERS[rows][risk]).toBeDefined();
          expect(Array.isArray(PLINKO_MULTIPLIERS[rows][risk])).toBe(true);
        }
      }
    });

    it('1.3 Each multiplier array should have exactly (rows + 1) elements', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          expect(PLINKO_MULTIPLIERS[rows][risk].length).toBe(rows + 1);
        }
      }
    });

    it('1.4 Total combinations should be exactly 27 (9 rows × 3 risks)', () => {
      let count = 0;
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          if (PLINKO_MULTIPLIERS[rows]?.[risk]) count++;
        }
      }
      expect(count).toBe(27);
    });

    it('1.5 Should NOT have entries for rows outside 8-16', () => {
      expect(PLINKO_MULTIPLIERS[7]).toBeUndefined();
      expect(PLINKO_MULTIPLIERS[17]).toBeUndefined();
      expect(PLINKO_MULTIPLIERS[0]).toBeUndefined();
      expect(PLINKO_MULTIPLIERS[-1]).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 2: ALL 27 COMBINATIONS - RTP & HOUSE EDGE
  // ─────────────────────────────────────────────────────────────────
  describe('2. RTP & House Edge for All 27 Combinations', () => {
    const TARGET_HE = 4.0;
    const TOLERANCE = 0.5; // ±0.5%

    for (let rows = 8; rows <= 16; rows++) {
      for (const risk of ALL_RISKS) {
        it(`2.${rows}-${risk}: House Edge should be ~4% (±0.5%)`, () => {
          const { ev, houseEdge } = verifyHouseEdge(rows, risk);
          expect(houseEdge).toBeGreaterThan(TARGET_HE - TOLERANCE);
          expect(houseEdge).toBeLessThan(TARGET_HE + TOLERANCE);
          // Also verify RTP is ~96%
          expect(ev * 100).toBeGreaterThan(95.5);
          expect(ev * 100).toBeLessThan(96.5);
        });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 3: SYMMETRY VERIFICATION
  // ─────────────────────────────────────────────────────────────────
  describe('3. Multiplier Symmetry (Mirror Property)', () => {
    for (let rows = 8; rows <= 16; rows++) {
      for (const risk of ALL_RISKS) {
        it(`3.${rows}-${risk}: Multipliers should be perfectly symmetric`, () => {
          const mults = PLINKO_MULTIPLIERS[rows][risk];
          for (let i = 0; i < mults.length; i++) {
            expect(mults[i]).toBe(mults[mults.length - 1 - i]);
          }
        });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 4: RISK LEVEL ORDERING
  // ─────────────────────────────────────────────────────────────────
  describe('4. Risk Level Ordering (LOW < MEDIUM < HIGH variance)', () => {
    for (let rows = 8; rows <= 16; rows++) {
      it(`4.${rows}: HIGH max multiplier > MEDIUM max > LOW max`, () => {
        const lowMax = Math.max(...PLINKO_MULTIPLIERS[rows].LOW);
        const medMax = Math.max(...PLINKO_MULTIPLIERS[rows].MEDIUM);
        const highMax = Math.max(...PLINKO_MULTIPLIERS[rows].HIGH);
        expect(highMax).toBeGreaterThan(medMax);
        expect(medMax).toBeGreaterThan(lowMax);
      });

      it(`4.${rows}: HIGH min multiplier < MEDIUM min < LOW min`, () => {
        const lowMin = Math.min(...PLINKO_MULTIPLIERS[rows].LOW);
        const medMin = Math.min(...PLINKO_MULTIPLIERS[rows].MEDIUM);
        const highMin = Math.min(...PLINKO_MULTIPLIERS[rows].HIGH);
        expect(highMin).toBeLessThanOrEqual(medMin);
        expect(medMin).toBeLessThanOrEqual(lowMin);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 5: ALL MULTIPLIERS ARE POSITIVE
  // ─────────────────────────────────────────────────────────────────
  describe('5. All Multipliers Are Valid Positive Numbers', () => {
    it('5.1 Every multiplier across all 27 combinations is > 0', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          PLINKO_MULTIPLIERS[rows][risk].forEach((m, i) => {
            expect(m).toBeGreaterThan(0);
            expect(typeof m).toBe('number');
            expect(isNaN(m)).toBe(false);
            expect(isFinite(m)).toBe(true);
          });
        }
      }
    });

    it('5.2 No multiplier exceeds 1000x', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          PLINKO_MULTIPLIERS[rows][risk].forEach((m) => {
            expect(m).toBeLessThan(1000);
          });
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 6: getMultiplier() FUNCTION
  // ─────────────────────────────────────────────────────────────────
  describe('6. getMultiplier() Function', () => {
    it('6.1 Returns correct multiplier for valid inputs', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const mults = PLINKO_MULTIPLIERS[rows][risk];
          for (let i = 0; i < mults.length; i++) {
            expect(getMultiplier(rows, risk, i)).toBe(mults[i]);
          }
        }
      }
    });

    it('6.2 Returns 0 for negative bucket index', () => {
      expect(getMultiplier(16, 'LOW', -1)).toBe(0);
      expect(getMultiplier(16, 'LOW', -100)).toBe(0);
    });

    it('6.3 Returns 0 for bucket index > rows', () => {
      expect(getMultiplier(16, 'LOW', 17)).toBe(0);
      expect(getMultiplier(8, 'HIGH', 9)).toBe(0);
    });

    it('6.4 Returns 0 for invalid rows', () => {
      expect(getMultiplier(7, 'LOW', 0)).toBe(0);
      expect(getMultiplier(17, 'LOW', 0)).toBe(0);
    });

    it('6.5 Edge bucket (index 0) always returns the highest multiplier for that risk', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const edgeMult = getMultiplier(rows, risk, 0);
          const maxMult = Math.max(...PLINKO_MULTIPLIERS[rows][risk]);
          expect(edgeMult).toBe(maxMult);
        }
      }
    });

    it('6.6 Center bucket always has the lowest multiplier', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const centerIdx = Math.floor((rows + 1) / 2);
          const centerMult = getMultiplier(rows, risk, centerIdx);
          const minMult = Math.min(...PLINKO_MULTIPLIERS[rows][risk]);
          // Center should be the minimum (or very close to it for even rows)
          expect(centerMult).toBeLessThanOrEqual(minMult * 1.01 + 0.01);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 7: getMultiplierArray() FUNCTION
  // ─────────────────────────────────────────────────────────────────
  describe('7. getMultiplierArray() Function', () => {
    it('7.1 Returns full array for valid inputs', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const arr = getMultiplierArray(rows, risk);
          expect(arr).toEqual(PLINKO_MULTIPLIERS[rows][risk]);
        }
      }
    });

    it('7.2 Returns empty array for invalid rows', () => {
      expect(getMultiplierArray(7, 'LOW')).toEqual([]);
      expect(getMultiplierArray(17, 'LOW')).toEqual([]);
    });

    it('7.3 Returns empty array for invalid risk', () => {
      expect(getMultiplierArray(16, 'INVALID' as any)).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 8: calculateBucketFromPath() FUNCTION
  // ─────────────────────────────────────────────────────────────────
  describe('8. calculateBucketFromPath() Function', () => {
    it('8.1 All-left path (all 0s) returns bucket 0', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const path = new Array(rows).fill(0);
        expect(calculateBucketFromPath(path)).toBe(0);
      }
    });

    it('8.2 All-right path (all 1s) returns bucket = rows', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const path = new Array(rows).fill(1);
        expect(calculateBucketFromPath(path)).toBe(rows);
      }
    });

    it('8.3 Bucket = sum of path values (number of rights)', () => {
      // Test 1000 random paths
      for (let i = 0; i < 1000; i++) {
        const rows = 8 + Math.floor(Math.random() * 9);
        const path = Array.from({ length: rows }, () => Math.round(Math.random()));
        const expectedBucket = path.reduce((sum, v) => sum + v, 0);
        expect(calculateBucketFromPath(path)).toBe(expectedBucket);
      }
    });

    it('8.4 Empty path returns 0', () => {
      expect(calculateBucketFromPath([])).toBe(0);
    });

    it('8.5 Single-element paths', () => {
      expect(calculateBucketFromPath([0])).toBe(0);
      expect(calculateBucketFromPath([1])).toBe(1);
    });

    it('8.6 Alternating path returns rows/2', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const path = Array.from({ length: rows }, (_, i) => i % 2);
        const expected = path.reduce((s, v) => s + v, 0);
        expect(calculateBucketFromPath(path)).toBe(expected);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 9: verifyHouseEdge() FUNCTION
  // ─────────────────────────────────────────────────────────────────
  describe('9. verifyHouseEdge() Function', () => {
    it('9.1 Returns correct EV and House Edge for all 27 combinations', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const { ev, houseEdge } = verifyHouseEdge(rows, risk);

          // Manually calculate expected EV
          const mults = PLINKO_MULTIPLIERS[rows][risk];
          let expectedEV = 0;
          for (let k = 0; k <= rows; k++) {
            expectedEV += (binomial(rows, k) / Math.pow(2, rows)) * mults[k];
          }

          expect(ev).toBeCloseTo(expectedEV, 6);
          expect(houseEdge).toBeCloseTo((1 - expectedEV) * 100, 4);
        }
      }
    });

    it('9.2 House Edge is always positive (house always wins long-term)', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const { houseEdge } = verifyHouseEdge(rows, risk);
          expect(houseEdge).toBeGreaterThan(0);
        }
      }
    });

    it('9.3 RTP is always less than 100% (no player advantage)', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const { ev } = verifyHouseEdge(rows, risk);
          expect(ev).toBeLessThan(1);
        }
      }
    });

    it('9.4 RTP is always greater than 90% (not exploitative)', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const { ev } = verifyHouseEdge(rows, risk);
          expect(ev).toBeGreaterThan(0.9);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 10: PHYSICS & VISUAL CONSTANTS
  // ─────────────────────────────────────────────────────────────────
  describe('10. Physics & Visual Constants', () => {
    it('10.1 PHYSICS constants should have required fields', () => {
      expect(PHYSICS).toBeDefined();
      expect(PHYSICS.GRAVITY).toBeDefined();
      expect(PHYSICS.GRAVITY).toBeGreaterThan(0);
      expect(PHYSICS.BALL_RADIUS).toBeDefined();
      expect(PHYSICS.BALL_RADIUS).toBeGreaterThan(0);
    });

    it('10.2 VISUALS constants should have required fields', () => {
      expect(VISUALS).toBeDefined();
    });

    it('10.3 RISK_COLORS should have all three risk levels', () => {
      expect(RISK_COLORS).toBeDefined();
      expect(RISK_COLORS.LOW).toBeDefined();
      expect(RISK_COLORS.MEDIUM).toBeDefined();
      expect(RISK_COLORS.HIGH).toBeDefined();
    });

    it('10.4 Each risk color should have bg, text, and border', () => {
      for (const risk of ALL_RISKS) {
        expect(RISK_COLORS[risk].bg).toBeDefined();
        expect(RISK_COLORS[risk].text).toBeDefined();
        expect(RISK_COLORS[risk].border).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 11: MATHEMATICAL STRESS TEST - BINOMIAL COMPLIANCE
  // ─────────────────────────────────────────────────────────────────
  describe('11. Binomial Distribution Compliance', () => {
    it('11.1 Sum of binomial probabilities equals 1 for all row counts', () => {
      for (let rows = 8; rows <= 16; rows++) {
        let sum = 0;
        for (let k = 0; k <= rows; k++) {
          sum += binomial(rows, k) / Math.pow(2, rows);
        }
        expect(sum).toBeCloseTo(1, 10);
      }
    });

    it('11.2 Center bucket has highest probability for all row counts', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const centerK = Math.floor(rows / 2);
        const centerProb = binomial(rows, centerK) / Math.pow(2, rows);
        for (let k = 0; k <= rows; k++) {
          if (k !== centerK && k !== centerK + 1) {
            const prob = binomial(rows, k) / Math.pow(2, rows);
            expect(centerProb).toBeGreaterThanOrEqual(prob);
          }
        }
      }
    });

    it('11.3 Edge buckets have lowest probability', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const edgeProb = binomial(rows, 0) / Math.pow(2, rows);
        for (let k = 1; k < rows; k++) {
          const prob = binomial(rows, k) / Math.pow(2, rows);
          expect(prob).toBeGreaterThan(edgeProb);
        }
      }
    });

    it('11.4 Multipliers compensate for probability (high prob = low mult)', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          const mults = PLINKO_MULTIPLIERS[rows][risk];
          // Edge (low probability) should have highest multiplier
          const edgeMult = mults[0];
          const centerMult = mults[Math.floor(mults.length / 2)];
          expect(edgeMult).toBeGreaterThan(centerMult);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 12: CROSS-VALIDATION - INDEPENDENT RTP CALCULATION
  // ─────────────────────────────────────────────────────────────────
  describe('12. Cross-Validation: Independent RTP Calculation', () => {
    it('12.1 Independent RTP calculation matches verifyHouseEdge()', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ALL_RISKS) {
          // Method 1: verifyHouseEdge
          const { ev: ev1 } = verifyHouseEdge(rows, risk);

          // Method 2: Manual calculation
          const mults = PLINKO_MULTIPLIERS[rows][risk];
          let ev2 = 0;
          for (let k = 0; k <= rows; k++) {
            const prob = binomial(rows, k) / Math.pow(2, rows);
            ev2 += prob * mults[k];
          }

          // Method 3: Using getMultiplier function
          let ev3 = 0;
          for (let k = 0; k <= rows; k++) {
            const prob = binomial(rows, k) / Math.pow(2, rows);
            ev3 += prob * getMultiplier(rows, risk, k);
          }

          expect(ev1).toBeCloseTo(ev2, 8);
          expect(ev2).toBeCloseTo(ev3, 8);
        }
      }
    });
  });
});
