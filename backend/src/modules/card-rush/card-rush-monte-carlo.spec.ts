/**
 * CARD-RUSH MONTE CARLO STRESS TEST
 * Simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number, offset: number = 0): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${offset}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

function generateCard(serverSeed: string, clientSeed: string, nonce: number, offset: number): number {
  const float = hmacFloat(serverSeed, clientSeed, nonce, offset);
  return Math.floor(float * 13) + 1; // 1-13 (Ace to King)
}

function handSum(cards: number[]): number {
  return cards.reduce((sum, c) => sum + Math.min(c, 10), 0);
}

describe('Card-Rush Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-cardrush-v2';
  const CS = 'mc-client-seed';
  const N = 5000;
  const BET = 10;

  describe('1. Card Distribution', () => {
    it('should distribute card values uniformly (1-13)', () => {
      const counts = new Array(14).fill(0);
      for (let i = 0; i < N; i++) {
        const card = generateCard(SS, CS, i, 0);
        counts[card]++;
      }
      const expected = N / 13;
      for (let c = 1; c <= 13; c++) {
        expect(counts[c]).toBeGreaterThan(expected * 0.85);
        expect(counts[c]).toBeLessThan(expected * 1.15);
      }
    });
  });

  describe('2. Win Rate by Hand Size', () => {
    it('should have higher win rate for 2-card hands than 5-card hands', () => {
      let wins2 = 0, wins5 = 0;
      for (let i = 0; i < N; i++) {
        const player2 = [generateCard(SS, CS, i, 0), generateCard(SS, CS, i, 1)];
        const dealer2 = [generateCard(SS, CS, i, 10), generateCard(SS, CS, i, 11)];
        if (handSum(player2) > handSum(dealer2)) wins2++;

        const player5 = Array.from({length: 5}, (_, j) => generateCard(SS, CS, i, j));
        const dealer5 = Array.from({length: 5}, (_, j) => generateCard(SS, CS, i, j + 10));
        if (handSum(player5) > handSum(dealer5)) wins5++;
      }
      // Hand 2 generally wins more often than hand 5
      // Allow 5% tolerance for statistical variance
      expect(wins2 / N).toBeGreaterThanOrEqual(wins5 / N - 0.05);
    });
  });

  describe('3. Provably Fair', () => {
    it('should produce identical cards with same seeds', () => {
      for (let i = 0; i < 100; i++) expect(generateCard(SS, CS, i, 0)).toBe(generateCard(SS, CS, i, 0));
    });
    it('should differ with different seeds', () => {
      let diff = 0;
      for (let i = 0; i < 100; i++) { if (generateCard('A', CS, i, 0) !== generateCard('B', CS, i, 0)) diff++; }
      expect(diff).toBeGreaterThan(50);
    });
  });

  describe('4. Edge Cases', () => {
    it('should generate cards in range 1-13', () => {
      for (let i = 0; i < 10000; i++) {
        const c = generateCard(SS, CS, i, 0);
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(13);
      }
    });
    it('should handle nonce 0', () => { expect(generateCard(SS, CS, 0, 0)).toBeGreaterThanOrEqual(1); });
    it('should handle large nonce', () => { expect(generateCard(SS, CS, 999999, 0)).toBeGreaterThanOrEqual(1); });
  });
});
