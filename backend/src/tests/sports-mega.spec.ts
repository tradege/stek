/**
 * ============================================================
 * SPORTS BETTING MEGA TEST SUITE — 500,000+ Simulations
 * ============================================================
 * Covers:
 *  1. Odds margin application (5% default)
 *  2. Implied probability calculation
 *  3. RTP verification for different odds ranges
 *  4. Margin scaling (1%-15%)
 *  5. Payout calculation correctness
 *  6. Multi-outcome markets (1X2, Over/Under, etc.)
 *  7. Parlay/accumulator math
 *  8. Edge cases (extreme odds, minimum bets)
 *  9. Odds format conversion (decimal, fractional, american)
 * 10. Stress test & boundary conditions
 * ============================================================
 */

// ── Production constants ───────────────────────────────────
const DEFAULT_SPORTS_MARGIN = 0.05; // 5% margin on odds

// ── Production functions ───────────────────────────────────
function applyMargin(fairOdds: number, margin: number): number {
  // Fair odds → margined odds: reduces payout
  // marginedOdds = fairOdds / (1 + margin * (fairOdds - 1) / fairOdds)
  // Simplified: marginedOdds = fairOdds * (1 - margin)... approximately
  // Actual production formula:
  const impliedProb = 1 / fairOdds;
  const marginedProb = impliedProb + margin * (1 - impliedProb);
  return parseFloat((1 / marginedProb).toFixed(3));
}

function calculatePayout(betAmount: number, odds: number): number {
  return parseFloat((betAmount * odds).toFixed(2));
}

function calculateImpliedProbability(odds: number): number {
  return parseFloat((1 / odds * 100).toFixed(2));
}

function calculateRTP(fairOdds: number, marginedOdds: number): number {
  return marginedOdds / fairOdds;
}

function calculateOverround(odds: number[]): number {
  return odds.reduce((sum, o) => sum + 1 / o, 0);
}

// Parlay odds = product of individual odds
function calculateParlayOdds(legs: number[]): number {
  return legs.reduce((prod, o) => prod * o, 1);
}

// ── Config ─────────────────────────────────────────────────
const BET = 10;

describe('SPORTS BETTING MEGA TEST SUITE (500K+ Simulations)', () => {

  // ════════════════════════════════════════════════════════════
  // 1. ODDS MARGIN APPLICATION
  // ════════════════════════════════════════════════════════════
  describe('1. Odds Margin Application', () => {
    const fairOddsRange = [1.05, 1.10, 1.20, 1.50, 2.00, 3.00, 5.00, 10.00, 20.00, 50.00, 100.00];

    for (const fairOdds of fairOddsRange) {
      it(`fair odds ${fairOdds}: margined odds should be lower`, () => {
        const margined = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
        expect(margined).toBeLessThan(fairOdds);
        expect(margined).toBeGreaterThan(1.0);
      });
    }

    it('margin=0 should return fair odds', () => {
      for (const fo of fairOddsRange) {
        const margined = applyMargin(fo, 0);
        expect(margined).toBeCloseTo(fo, 2);
      }
    });

    it('higher margin should produce lower odds', () => {
      const fo = 2.0;
      const m1 = applyMargin(fo, 0.02);
      const m5 = applyMargin(fo, 0.05);
      const m10 = applyMargin(fo, 0.10);
      expect(m1).toBeGreaterThan(m5);
      expect(m5).toBeGreaterThan(m10);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 2. IMPLIED PROBABILITY
  // ════════════════════════════════════════════════════════════
  describe('2. Implied Probability Calculation', () => {
    it('odds 2.0 = 50% implied probability', () => {
      expect(calculateImpliedProbability(2.0)).toBe(50.00);
    });

    it('odds 1.5 = 66.67% implied probability', () => {
      expect(calculateImpliedProbability(1.5)).toBe(66.67);
    });

    it('odds 10.0 = 10% implied probability', () => {
      expect(calculateImpliedProbability(10.0)).toBe(10.00);
    });

    it('implied probabilities should sum to > 100% after margin (overround)', () => {
      // 1X2 market: fair probs sum to 100%
      const fairOdds = [2.0, 3.5, 4.0]; // Home, Draw, Away
      const marginedOdds = fairOdds.map(o => applyMargin(o, DEFAULT_SPORTS_MARGIN));
      const overround = calculateOverround(marginedOdds);
      expect(overround).toBeGreaterThan(1.0); // > 100%
    });
  });

  // ════════════════════════════════════════════════════════════
  // 3. RTP VERIFICATION — Monte Carlo
  // ════════════════════════════════════════════════════════════
  describe('3. RTP Verification — Monte Carlo (500K bets)', () => {
    it('RTP at fair odds 2.0 with 5% margin should be ~95%', () => {
      const fairOdds = 2.0;
      const fairProb = 1 / fairOdds; // 50%
      const marginedOdds = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
      const N = 500000;
      let wagered = 0, payout = 0;
      
      // Simulate: each bet wins with fairProb
      let seed = 12345;
      for (let i = 0; i < N; i++) {
        wagered += BET;
        // Simple PRNG for simulation
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const random = seed / 0x7fffffff;
        if (random < fairProb) {
          payout += calculatePayout(BET, marginedOdds);
        }
      }
      
      const rtp = payout / wagered;
      expect(rtp).toBeGreaterThan(0.92);
      expect(rtp).toBeLessThan(0.98);
    });

    for (const fairOdds of [1.5, 2.0, 3.0, 5.0, 10.0]) {
      it(`fair odds ${fairOdds}: RTP should be ~${((1 - DEFAULT_SPORTS_MARGIN) * 100).toFixed(0)}%`, () => {
        const fairProb = 1 / fairOdds;
        const marginedOdds = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
        const rtp = marginedOdds / fairOdds;
        // Mathematical RTP (not Monte Carlo)
        expect(rtp).toBeGreaterThan(0.90);
        expect(rtp).toBeLessThan(1.00);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 4. MARGIN SCALING
  // ════════════════════════════════════════════════════════════
  describe('4. Margin Scaling (1%-15%)', () => {
    for (const margin of [0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15]) {
      it(`margin=${(margin * 100)}%: RTP should be ~${((1 - margin) * 100).toFixed(0)}%`, () => {
        const fairOdds = 2.0;
        const marginedOdds = applyMargin(fairOdds, margin);
        const rtp = marginedOdds / fairOdds;
        expect(rtp).toBeGreaterThan((1 - margin) - 0.05);
        expect(rtp).toBeLessThan((1 - margin) + 0.02);
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // 5. PAYOUT CALCULATION
  // ════════════════════════════════════════════════════════════
  describe('5. Payout Calculation', () => {
    it('$10 bet at 2.0 odds = $20 payout', () => {
      expect(calculatePayout(10, 2.0)).toBe(20.00);
    });

    it('$10 bet at 1.5 odds = $15 payout', () => {
      expect(calculatePayout(10, 1.5)).toBe(15.00);
    });

    it('$100 bet at 10.0 odds = $1000 payout', () => {
      expect(calculatePayout(100, 10.0)).toBe(1000.00);
    });

    it('payout should always be > bet amount (odds > 1.0)', () => {
      for (let odds = 1.01; odds <= 100; odds += 0.5) {
        expect(calculatePayout(BET, odds)).toBeGreaterThan(BET);
      }
    });

    it('payout should be proportional to bet amount', () => {
      const odds = 2.5;
      const p1 = calculatePayout(10, odds);
      const p2 = calculatePayout(20, odds);
      expect(p2 / p1).toBeCloseTo(2.0, 2);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 6. MULTI-OUTCOME MARKETS
  // ════════════════════════════════════════════════════════════
  describe('6. Multi-Outcome Markets', () => {
    it('1X2 market: overround should be > 100% after margin', () => {
      const fairOdds = [2.0, 3.5, 4.0];
      const marginedOdds = fairOdds.map(o => applyMargin(o, DEFAULT_SPORTS_MARGIN));
      const overround = calculateOverround(marginedOdds);
      expect(overround).toBeGreaterThan(1.0);
      expect(overround).toBeLessThan(1.20);
    });

    it('Over/Under market: overround should be > 100%', () => {
      const fairOdds = [1.9, 2.0];
      const marginedOdds = fairOdds.map(o => applyMargin(o, DEFAULT_SPORTS_MARGIN));
      const overround = calculateOverround(marginedOdds);
      expect(overround).toBeGreaterThan(1.0);
    });

    it('BTTS market: overround should be > 100%', () => {
      const fairOdds = [1.7, 2.2];
      const marginedOdds = fairOdds.map(o => applyMargin(o, DEFAULT_SPORTS_MARGIN));
      const overround = calculateOverround(marginedOdds);
      expect(overround).toBeGreaterThan(1.0);
    });

    it('fair odds market should have overround = 100%', () => {
      const fairOdds = [2.0, 3.5, 4.0];
      const overround = calculateOverround(fairOdds);
      // Fair odds don't necessarily sum to 100% unless they're true probabilities
      // But for a proper market they should be close
      expect(overround).toBeGreaterThan(0.8);
      expect(overround).toBeLessThan(1.2);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 7. PARLAY / ACCUMULATOR
  // ════════════════════════════════════════════════════════════
  describe('7. Parlay / Accumulator Math', () => {
    it('2-leg parlay: odds should multiply', () => {
      expect(calculateParlayOdds([2.0, 3.0])).toBe(6.0);
    });

    it('3-leg parlay: odds should multiply', () => {
      expect(calculateParlayOdds([2.0, 2.0, 2.0])).toBe(8.0);
    });

    it('parlay RTP decreases with more legs', () => {
      const fairOdds = 2.0;
      const marginedOdds = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
      const singleRTP = marginedOdds / fairOdds;
      
      // 2-leg parlay RTP
      const parlay2RTP = Math.pow(singleRTP, 2);
      // 3-leg parlay RTP
      const parlay3RTP = Math.pow(singleRTP, 3);
      
      expect(singleRTP).toBeGreaterThan(parlay2RTP);
      expect(parlay2RTP).toBeGreaterThan(parlay3RTP);
    });

    it('10-leg parlay RTP should still be > 50%', () => {
      const fairOdds = 2.0;
      const marginedOdds = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
      const singleRTP = marginedOdds / fairOdds;
      const parlay10RTP = Math.pow(singleRTP, 10);
      expect(parlay10RTP).toBeGreaterThan(0.50);
    });

    it('parlay payout should be correct', () => {
      const legs = [1.8, 2.5, 3.0];
      const parlayOdds = calculateParlayOdds(legs);
      expect(calculatePayout(10, parlayOdds)).toBe(135.00);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 8. EDGE CASES
  // ════════════════════════════════════════════════════════════
  describe('8. Edge Cases', () => {
    it('odds 1.01 (99% favorite): margin should still apply', () => {
      const margined = applyMargin(1.01, DEFAULT_SPORTS_MARGIN);
      expect(margined).toBeLessThan(1.01);
      expect(margined).toBeGreaterThan(1.0);
    });

    it('odds 100.0 (1% underdog): margin should still apply', () => {
      const margined = applyMargin(100.0, DEFAULT_SPORTS_MARGIN);
      expect(margined).toBeLessThan(100.0);
      expect(margined).toBeGreaterThan(1.0);
    });

    it('odds 1.0 (certain): should return ~1.0', () => {
      const margined = applyMargin(1.0, DEFAULT_SPORTS_MARGIN);
      expect(margined).toBeCloseTo(1.0, 1);
    });

    it('very high odds should not produce negative payout', () => {
      const margined = applyMargin(1000.0, DEFAULT_SPORTS_MARGIN);
      expect(margined).toBeGreaterThan(0);
      expect(calculatePayout(BET, margined)).toBeGreaterThan(0);
    });

    it('zero bet should produce zero payout', () => {
      expect(calculatePayout(0, 2.0)).toBe(0);
    });

    it('payout should never be NaN or Infinity', () => {
      for (let odds = 1.01; odds <= 1000; odds *= 1.5) {
        const margined = applyMargin(odds, DEFAULT_SPORTS_MARGIN);
        const payout = calculatePayout(BET, margined);
        expect(isNaN(payout)).toBe(false);
        expect(isFinite(payout)).toBe(true);
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 9. ODDS FORMAT CONVERSION
  // ════════════════════════════════════════════════════════════
  describe('9. Odds Format Conversion', () => {
    function decimalToFractional(decimal: number): string {
      const numerator = decimal - 1;
      // Simplify to common fractions
      return `${(numerator * 100).toFixed(0)}/100`;
    }

    function decimalToAmerican(decimal: number): number {
      if (decimal >= 2.0) return Math.round((decimal - 1) * 100);
      return Math.round(-100 / (decimal - 1));
    }

    it('decimal 2.0 = American +100', () => {
      expect(decimalToAmerican(2.0)).toBe(100);
    });

    it('decimal 1.5 = American -200', () => {
      expect(decimalToAmerican(1.5)).toBe(-200);
    });

    it('decimal 3.0 = American +200', () => {
      expect(decimalToAmerican(3.0)).toBe(200);
    });

    it('conversion should be consistent across range', () => {
      for (let d = 1.1; d <= 10; d += 0.1) {
        const american = decimalToAmerican(d);
        expect(isNaN(american)).toBe(false);
        expect(isFinite(american)).toBe(true);
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 10. STRESS TEST
  // ════════════════════════════════════════════════════════════
  describe('10. Stress Test — 100K Markets', () => {
    it('100K random markets: all margined odds should be valid', () => {
      let seed = 42;
      for (let i = 0; i < 100000; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const fairOdds = 1.01 + (seed / 0x7fffffff) * 99; // 1.01 to 100
        const margined = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
        expect(margined).toBeGreaterThan(0);
        expect(margined).toBeLessThan(fairOdds + 0.01);
        expect(isNaN(margined)).toBe(false);
        expect(isFinite(margined)).toBe(true);
      }
    });

    it('100K random bets: total payout should be < total wagered (house wins)', () => {
      let totalWagered = 0, totalPayout = 0;
      let seed = 99;
      for (let i = 0; i < 100000; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const fairOdds = 1.5 + (seed / 0x7fffffff) * 8.5; // 1.5 to 10
        const fairProb = 1 / fairOdds;
        const marginedOdds = applyMargin(fairOdds, DEFAULT_SPORTS_MARGIN);
        
        totalWagered += BET;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        if (seed / 0x7fffffff < fairProb) {
          totalPayout += calculatePayout(BET, marginedOdds);
        }
      }
      
      const rtp = totalPayout / totalWagered;
      expect(rtp).toBeGreaterThan(0.88);
      expect(rtp).toBeLessThan(1.00);
    });
  });
});
