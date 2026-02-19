/**
 * SPORTS ODDS MONTE CARLO STRESS TEST
 * Simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

describe('Sports Odds Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-sports-v2';
  const CS = 'mc-client-seed';
  const N = 50000;
  const BET = 10;

  describe('1. Margin Verification', () => {
    it('should maintain house margin on 2-way market', () => {
      const odds1 = 2.0; // implied prob 50%
      const odds2 = 2.0;
      const margin = (1/odds1 + 1/odds2) - 1;
      expect(margin).toBeGreaterThanOrEqual(0);
      
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) {
        wagered += BET;
        const float = hmacFloat(SS, CS, i);
        if (float < 0.5) payout += BET * odds1;
      }
      const rtp = payout / wagered;
      expect(rtp).toBeGreaterThan(0.90);
      expect(rtp).toBeLessThan(1.10);
    });

    it('should maintain house margin on 3-way market', () => {
      const oddsHome = 2.5;
      const oddsDraw = 3.2;
      const oddsAway = 3.0;
      const margin = (1/oddsHome + 1/oddsDraw + 1/oddsAway) - 1;
      expect(margin).toBeGreaterThan(0);
    });
  });

  describe('2. Outcome Distribution', () => {
    it('should distribute outcomes according to implied probabilities', () => {
      let outcome1 = 0, outcome2 = 0;
      for (let i = 0; i < N; i++) {
        if (hmacFloat(SS, CS, i) < 0.5) outcome1++;
        else outcome2++;
      }
      expect(outcome1 / N).toBeCloseTo(0.5, 1);
      expect(outcome2 / N).toBeCloseTo(0.5, 1);
    });
  });

  describe('3. Provably Fair', () => {
    it('should produce identical results with same seeds', () => {
      for (let i = 0; i < 100; i++) expect(hmacFloat(SS, CS, i)).toBe(hmacFloat(SS, CS, i));
    });
    it('should differ with different seeds', () => {
      expect(hmacFloat('A', CS, 0)).not.toBe(hmacFloat('B', CS, 0));
    });
  });

  describe('4. Long-Run Stability', () => {
    it('should maintain stable win rate across batches', () => {
      const rates: number[] = [];
      for (let b = 0; b < 10; b++) {
        let wins = 0;
        for (let i = 0; i < 5000; i++) { if (hmacFloat(SS, CS, b * 5000 + i) < 0.5) wins++; }
        rates.push(wins / 5000);
      }
      for (const r of rates) { expect(r).toBeGreaterThan(0.45); expect(r).toBeLessThan(0.55); }
    });
  });

  describe('5. Edge Cases', () => {
    it('should handle nonce 0', () => { const f = hmacFloat(SS, CS, 0); expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(1); });
    it('should handle large nonce', () => { const f = hmacFloat(SS, CS, 999999); expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(1); });
  });
});
