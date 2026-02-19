/**
 * MINES MONTE CARLO STRESS TEST
 * 100,000+ simulations using HMAC-SHA256 provably fair engine
 */
import { createHmac } from 'crypto';

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number, offset: number = 0): number {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${offset}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

function generateMines(serverSeed: string, clientSeed: string, nonce: number, mineCount: number): number[] {
  const positions: number[] = [];
  const available = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 0; i < mineCount; i++) {
    const float = hmacFloat(serverSeed, clientSeed, nonce, i);
    const idx = Math.floor(float * available.length);
    positions.push(available[idx]);
    available.splice(idx, 1);
  }
  return positions.sort((a, b) => a - b);
}

describe('Mines Monte Carlo Stress Test', () => {
  const SS = 'mc-server-seed-mines-v2';
  const CS = 'mc-client-seed';
  const N = 50000;

  describe('1. Mine Distribution Uniformity', () => {
    it('should distribute mines uniformly across all 25 tiles (3 mines)', () => {
      const tileCounts = new Array(25).fill(0);
      for (let i = 0; i < N; i++) {
        const mines = generateMines(SS, CS, i, 3);
        mines.forEach(m => tileCounts[m]++);
      }
      const expected = (N * 3) / 25;
      for (let t = 0; t < 25; t++) {
        expect(tileCounts[t]).toBeGreaterThan(expected * 0.85);
        expect(tileCounts[t]).toBeLessThan(expected * 1.15);
      }
    });

    it('should distribute mines uniformly with 5 mines', () => {
      const tileCounts = new Array(25).fill(0);
      for (let i = 0; i < N; i++) {
        const mines = generateMines(SS, CS, i, 5);
        mines.forEach(m => tileCounts[m]++);
      }
      const expected = (N * 5) / 25;
      for (let t = 0; t < 25; t++) {
        expect(tileCounts[t]).toBeGreaterThan(expected * 0.85);
        expect(tileCounts[t]).toBeLessThan(expected * 1.15);
      }
    });
  });

  describe('2. Mine Count Correctness', () => {
    for (const count of [1, 3, 5, 10, 24]) {
      it(`should always generate exactly ${count} mines`, () => {
        for (let i = 0; i < 1000; i++) {
          const mines = generateMines(SS, CS, i, count);
          expect(mines.length).toBe(count);
          expect(new Set(mines).size).toBe(count); // no duplicates
        }
      });
    }
  });

  describe('3. Mine Position Validity', () => {
    it('should only generate positions 0-24', () => {
      for (let i = 0; i < 10000; i++) {
        const mines = generateMines(SS, CS, i, 5);
        mines.forEach(m => { expect(m).toBeGreaterThanOrEqual(0); expect(m).toBeLessThan(25); });
      }
    });

    it('should never have duplicate mine positions', () => {
      for (let i = 0; i < 10000; i++) {
        const mines = generateMines(SS, CS, i, 10);
        expect(new Set(mines).size).toBe(mines.length);
      }
    });
  });

  describe('4. First-Click Survival Rate', () => {
    it('should have ~88% survival on first click with 3 mines', () => {
      let survived = 0;
      for (let i = 0; i < N; i++) {
        const mines = generateMines(SS, CS, i, 3);
        const clickTile = Math.floor(hmacFloat(SS, `click-${CS}`, i, 99) * 25);
        if (!mines.includes(clickTile)) survived++;
      }
      expect(survived / N).toBeCloseTo(0.88, 1);
    });
  });

  describe('5. Provably Fair Verification', () => {
    it('should produce identical mines with same seeds', () => {
      for (let i = 0; i < 100; i++) {
        expect(generateMines(SS, CS, i, 5)).toEqual(generateMines(SS, CS, i, 5));
      }
    });
    it('should differ with different seeds', () => {
      expect(generateMines('A', CS, 0, 5)).not.toEqual(generateMines('B', CS, 0, 5));
    });
  });

  describe('6. Edge Cases', () => {
    it('should handle 1 mine', () => { const m = generateMines(SS, CS, 0, 1); expect(m.length).toBe(1); });
    it('should handle 24 mines', () => { const m = generateMines(SS, CS, 0, 24); expect(m.length).toBe(24); });
    it('should handle nonce 0', () => { const m = generateMines(SS, CS, 0, 3); expect(m.length).toBe(3); });
    it('should handle large nonce', () => { const m = generateMines(SS, CS, 999999, 3); expect(m.length).toBe(3); });
  });
});
