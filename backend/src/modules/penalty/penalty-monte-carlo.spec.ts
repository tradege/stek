/**
 * PENALTY MONTE CARLO STRESS TEST
 * Simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

// Goalkeeper saves ~33% of the time
function isGoal(serverSeed: string, clientSeed: string, nonce: number): boolean {
  return hmacFloat(serverSeed, clientSeed, nonce) > 0.33;
}

describe('Penalty Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-penalty-v2';
  const CS = 'mc-client-seed';
  const N = 50000;

  describe('1. Goal Rate Verification', () => {
    it('should have ~67% goal rate', () => {
      let goals = 0;
      for (let i = 0; i < N; i++) { if (isGoal(SS, CS, i)) goals++; }
      expect(goals / N).toBeCloseTo(0.67, 1);
    });
  });

  describe('2. Consecutive Goals Distribution', () => {
    it('should have decreasing probability for consecutive goals', () => {
      let streaks: Record<number, number> = {};
      let current = 0;
      for (let i = 0; i < N; i++) {
        if (isGoal(SS, CS, i)) { current++; }
        else { if (current > 0) streaks[current] = (streaks[current] || 0) + 1; current = 0; }
      }
      // Streak of 1 should be more common than streak of 5
      expect((streaks[1] || 0)).toBeGreaterThan((streaks[5] || 0));
    });
  });

  describe('3. Provably Fair Verification', () => {
    it('should produce identical results with same seeds', () => {
      for (let i = 0; i < 100; i++) expect(isGoal(SS, CS, i)).toBe(isGoal(SS, CS, i));
    });
    it('should differ with different seeds', () => {
      let diff = 0;
      for (let i = 0; i < 100; i++) { if (isGoal('A', CS, i) !== isGoal('B', CS, i)) diff++; }
      expect(diff).toBeGreaterThan(10);
    });
  });

  describe('4. Long-Run Stability', () => {
    it('should maintain stable goal rate across batches', () => {
      const rates: number[] = [];
      for (let b = 0; b < 10; b++) {
        let goals = 0;
        for (let i = 0; i < 5000; i++) { if (isGoal(SS, CS, b * 5000 + i)) goals++; }
        rates.push(goals / 5000);
      }
      for (const r of rates) { expect(r).toBeGreaterThan(0.60); expect(r).toBeLessThan(0.75); }
    });
  });

  describe('5. Edge Cases', () => {
    it('should handle nonce 0', () => { expect(typeof isGoal(SS, CS, 0)).toBe('boolean'); });
    it('should handle large nonce', () => { expect(typeof isGoal(SS, CS, 999999)).toBe('boolean'); });
  });
});
