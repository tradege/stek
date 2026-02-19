/**
 * DICE MONTE CARLO STRESS TEST
 * 100,000+ simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

function diceRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  return Math.floor(hmacFloat(serverSeed, clientSeed, nonce) * 10000) / 100;
}

describe('Dice Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-dice-v2';
  const CS = 'mc-client-seed';
  const N = 100000;
  const BET = 10;
  const RTP = 0.96;

  describe('1. House Edge Verification', () => {
    it('should converge to ~4% house edge for rollOver 50', () => {
      const target = 50;
      const mult = (100 * RTP) / (100 - target);
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) { wagered += BET; if (diceRoll(SS, CS, i) > target) payout += BET * mult; }
      const he = 1 - payout / wagered;
      expect(he).toBeGreaterThan(0.01); expect(he).toBeLessThan(0.08);
    });

    it('should converge to ~4% house edge for rollUnder 50', () => {
      const target = 50;
      const mult = (100 * RTP) / target;
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) { wagered += BET; if (diceRoll(SS, CS, i) < target) payout += BET * mult; }
      const he = 1 - payout / wagered;
      expect(he).toBeGreaterThan(0.01); expect(he).toBeLessThan(0.08);
    });
  });

  describe('2. Roll Distribution Uniformity', () => {
    it('should produce uniform distribution across 0-99 range', () => {
      const buckets = new Array(100).fill(0);
      for (let i = 0; i < N; i++) { const r = Math.floor(diceRoll(SS, CS, i)); if (r >= 0 && r < 100) buckets[r]++; }
      const exp = N / 100;
      for (let b = 0; b < 100; b++) { expect(buckets[b]).toBeGreaterThan(exp * 0.8); expect(buckets[b]).toBeLessThan(exp * 1.2); }
    });

    it('should have no bias toward low or high rolls', () => {
      let low = 0, high = 0;
      for (let i = 0; i < N; i++) { if (diceRoll(SS, CS, i) < 50) low++; else high++; }
      expect(low / high).toBeGreaterThan(0.95); expect(low / high).toBeLessThan(1.05);
    });
  });

  describe('3. Win Rate Accuracy', () => {
    for (const [target, expected] of [[10, 0.90], [25, 0.75], [50, 0.50], [75, 0.25], [95, 0.05]]) {
      it(`should have ~${(expected as number) * 100}% win rate for rollOver ${target}`, () => {
        let wins = 0;
        for (let i = 0; i < N; i++) { if (diceRoll(SS, CS, i) > (target as number)) wins++; }
        expect(wins / N).toBeCloseTo(expected as number, 1);
      });
    }
  });

  describe('4. Provably Fair Seed Verification', () => {
    it('should produce identical results with same seeds', () => {
      for (let i = 0; i < 100; i++) expect(diceRoll(SS, CS, i)).toBe(diceRoll(SS, CS, i));
    });
    it('should differ with different server seeds', () => { expect(diceRoll('A', CS, 0)).not.toBe(diceRoll('B', CS, 0)); });
    it('should differ with different client seeds', () => { expect(diceRoll(SS, 'A', 0)).not.toBe(diceRoll(SS, 'B', 0)); });
    it('should differ with different nonces', () => { expect(diceRoll(SS, CS, 0)).not.toBe(diceRoll(SS, CS, 1)); });
  });

  describe('5. Long-Run Stability', () => {
    it('should maintain stable house edge across 10 batches of 10K', () => {
      const edges: number[] = [];
      for (let b = 0; b < 10; b++) {
        let w = 0, p = 0; const mult = (100 * RTP) / 50;
        for (let i = 0; i < 10000; i++) { w += BET; if (diceRoll(SS, CS, b * 10000 + i) > 50) p += BET * mult; }
        edges.push(1 - p / w);
      }
      for (const e of edges) { expect(e).toBeGreaterThan(-0.02); expect(e).toBeLessThan(0.10); }
    });
  });

  describe('6. Edge Cases', () => {
    it('should handle nonce = 0', () => { const r = diceRoll(SS, CS, 0); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(100); });
    it('should handle large nonces', () => { const r = diceRoll(SS, CS, 999999999); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(100); });
    it('should always produce rolls in [0, 100)', () => { for (let i = 0; i < 10000; i++) { const r = diceRoll(SS, CS, i); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(100); } });
  });

  describe('7. Avalanche Effect', () => {
    it('should completely change result when 1 char changes', () => {
      expect(Math.abs(diceRoll('seed-abc', CS, 0) - diceRoll('seed-abd', CS, 0))).toBeGreaterThan(0);
    });
  });
});
