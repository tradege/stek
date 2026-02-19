/**
 * LIMBO MONTE CARLO STRESS TEST
 * 100,000+ simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  // Use 13 hex chars (52 bits) to match the actual service
  const rawValue = parseInt(hash.substring(0, 13), 16);
  const maxValue = Math.pow(16, 13);
  return rawValue / maxValue;
}

function limboMultiplier(serverSeed: string, clientSeed: string, nonce: number): number {
  const float = hmacFloat(serverSeed, clientSeed, nonce);
  if (float === 0) return 10000; // MAX_TARGET
  const he = 0.04;
  const result = (1 - he) / float;
  return parseFloat(Math.max(1.00, Math.min(result, 10000)).toFixed(2));
}

describe('Limbo Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-limbo-v2';
  const CS = 'mc-client-seed';
  const N = 10000;
  const BET = 10;

  describe('1. House Edge Verification', () => {
    it('should converge to ~4% house edge for target 2x', () => {
      const target = 2;
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) {
        wagered += BET;
        const mult = limboMultiplier(SS, CS, i);
        if (mult >= target) payout += BET * target;
      }
      const rtp = payout / wagered;
      // With correct 52-bit precision: RTP = ~96% for any target
      // For target 2x: winChance = 0.96/2 = 48%, payout = 48% * 2 = 96%
      expect(rtp).toBeGreaterThan(0.90);
      expect(rtp).toBeLessThan(1.02);
    });

    it('should converge to ~4% house edge for target 1.5x', () => {
      const target = 1.5;
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) {
        wagered += BET;
        if (limboMultiplier(SS, CS, i) >= target) payout += BET * target;
      }
      const rtp = payout / wagered;
      // For target 1.5x: winChance = 0.96/1.5 = 64%, payout = 64% * 1.5 = 96%
      expect(rtp).toBeGreaterThan(0.90);
      expect(rtp).toBeLessThan(1.02);
    });
  });

  describe('2. Multiplier Distribution', () => {
    it('should produce multipliers >= 1.00', () => {
      for (let i = 0; i < 10000; i++) {
        expect(limboMultiplier(SS, CS, i)).toBeGreaterThanOrEqual(1.00);
      }
    });

    it('should have decreasing frequency for higher multipliers', () => {
      let above2 = 0, above5 = 0, above10 = 0, above100 = 0;
      for (let i = 0; i < N; i++) {
        const m = limboMultiplier(SS, CS, i);
        if (m >= 2) above2++;
        if (m >= 5) above5++;
        if (m >= 10) above10++;
        if (m >= 100) above100++;
      }
      expect(above2).toBeGreaterThan(above5);
      expect(above5).toBeGreaterThan(above10);
      expect(above10).toBeGreaterThan(above100);
    });
  });

  describe('3. Provably Fair Verification', () => {
    it('should produce identical results with same seeds', () => {
      for (let i = 0; i < 100; i++) expect(limboMultiplier(SS, CS, i)).toBe(limboMultiplier(SS, CS, i));
    });
    it('should differ with different seeds', () => { expect(limboMultiplier('A', CS, 0)).not.toBe(limboMultiplier('B', CS, 0)); });
    it('should differ with different nonces', () => { expect(limboMultiplier(SS, CS, 0)).not.toBe(limboMultiplier(SS, CS, 1)); });
  });

  describe('4. Long-Run Stability', () => {
    it('should maintain stable win rate across batches', () => {
      const rates: number[] = [];
      for (let b = 0; b < 10; b++) {
        let wins = 0;
        for (let i = 0; i < 10000; i++) { if (limboMultiplier(SS, CS, b * 10000 + i) >= 2) wins++; }
        rates.push(wins / 10000);
      }
      const mean = rates.reduce((a, b) => a + b) / rates.length;
      for (const r of rates) expect(Math.abs(r - mean)).toBeLessThan(0.03);
    });
  });

  describe('5. Edge Cases', () => {
    it('should handle nonce 0', () => { expect(limboMultiplier(SS, CS, 0)).toBeGreaterThanOrEqual(1); });
    it('should handle large nonce', () => { expect(limboMultiplier(SS, CS, 999999)).toBeGreaterThanOrEqual(1); });
    it('should never produce negative multipliers', () => { for (let i = 0; i < 10000; i++) expect(limboMultiplier(SS, CS, i)).toBeGreaterThan(0); });
  });
});
