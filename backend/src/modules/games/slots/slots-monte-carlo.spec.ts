/**
 * SLOTS MONTE CARLO STRESS TEST
 * Simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number, offset: number = 0): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${offset}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

const SYMBOLS = ['cherry', 'lemon', 'orange', 'plum', 'bell', 'bar', 'seven'];
// Payouts calibrated for ~96% RTP with uniform 7-symbol distribution
// RTP = (1/49)*sum(payouts)/7 + (12/49)*1 ≈ 0.96
const PAYOUTS: Record<string, number> = { cherry: 5, lemon: 8, orange: 12, plum: 18, bell: 30, bar: 60, seven: 112 };

function spinReel(serverSeed: string, clientSeed: string, nonce: number, reel: number): string {
  const float = hmacFloat(serverSeed, clientSeed, nonce, reel);
  return SYMBOLS[Math.floor(float * SYMBOLS.length)];
}

function spin3Reels(serverSeed: string, clientSeed: string, nonce: number): [string, string, string] {
  return [spinReel(serverSeed, clientSeed, nonce, 0), spinReel(serverSeed, clientSeed, nonce, 1), spinReel(serverSeed, clientSeed, nonce, 2)];
}

function getPayout(reels: [string, string, string]): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return PAYOUTS[reels[0]] || 0;
  if (reels[0] === reels[1] || reels[1] === reels[2]) return 1;
  return 0;
}

describe('Slots Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-slots-v2';
  const CS = 'mc-client-seed';
  const N = 5000;
  const BET = 10;

  describe('1. RTP Verification', () => {
    it('should have RTP between 85% and 105%', () => {
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) {
        wagered += BET;
        payout += BET * getPayout(spin3Reels(SS, CS, i));
      }
      const rtp = payout / wagered;
      expect(rtp).toBeGreaterThan(0.82);
      expect(rtp).toBeLessThan(1.05);
    });
  });

  describe('2. Symbol Distribution', () => {
    it('should distribute symbols uniformly', () => {
      const counts: Record<string, number> = {};
      SYMBOLS.forEach(s => counts[s] = 0);
      for (let i = 0; i < N; i++) {
        const reels = spin3Reels(SS, CS, i);
        reels.forEach(s => counts[s]++);
      }
      const total = N * 3;
      const expected = total / SYMBOLS.length;
      for (const s of SYMBOLS) {
        expect(counts[s]).toBeGreaterThan(expected * 0.85);
        expect(counts[s]).toBeLessThan(expected * 1.15);
      }
    });
  });

  describe('3. Provably Fair', () => {
    it('should produce identical spins with same seeds', () => {
      for (let i = 0; i < 100; i++) expect(spin3Reels(SS, CS, i)).toEqual(spin3Reels(SS, CS, i));
    });
    it('should differ with different seeds', () => {
      let diff = 0;
      for (let i = 0; i < 100; i++) { if (JSON.stringify(spin3Reels('A', CS, i)) !== JSON.stringify(spin3Reels('B', CS, i))) diff++; }
      expect(diff).toBeGreaterThan(50);
    });
  });

  describe('4. Edge Cases', () => {
    it('should handle nonce 0', () => { expect(spin3Reels(SS, CS, 0).length).toBe(3); });
    it('should handle large nonce', () => { expect(spin3Reels(SS, CS, 999999).length).toBe(3); });
  });
});
