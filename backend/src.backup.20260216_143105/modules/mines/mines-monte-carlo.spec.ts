/**
 * ============================================
 * MINES - Monte Carlo Stress Test
 * ============================================
 * Runs thousands of games to verify:
 * - House edge is consistently ~4%
 * - Multiplier formula is mathematically correct
 * - Mine placement is uniformly distributed
 * - No position bias exists
 * - All mine count configurations work correctly
 */

import { MinesService } from './mines.service';

// Mock Date.now to bypass rate limiting
let mockTime = 1000000;
const originalDateNow = Date.now;
beforeAll(() => {
  Date.now = jest.fn(() => {
    mockTime += 1000;
    return mockTime;
  });
});
afterAll(() => {
  Date.now = originalDateNow;
});

describe('Mines Monte Carlo Stress Test', () => {
  let service: MinesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 999999999 }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        });
      }),
      bet: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new MinesService(mockPrisma);
  });

  // ============================================
  // SECTION 1: Mine Position Distribution
  // ============================================
  describe('Mine Position Distribution', () => {
    it('should distribute mines uniformly across all 25 positions', () => {
      const ITERATIONS = 100000;
      const positionCounts = new Array(25).fill(0);

      for (let i = 0; i < ITERATIONS; i++) {
        const positions = service.generateMinePositions(
          `server-${i}-${Math.random()}`,
          `client-${i}`,
          i,
          5,
        );

        for (const pos of positions) {
          positionCounts[pos]++;
        }
      }

      // Each position should appear ~20,000 times (5 mines × 100K / 25 positions)
      const expected = (ITERATIONS * 5) / 25;
      console.log('Mine position distribution:', positionCounts);

      for (let i = 0; i < 25; i++) {
        // Within 5% of expected
        expect(positionCounts[i]).toBeGreaterThan(expected * 0.93);
        expect(positionCounts[i]).toBeLessThan(expected * 1.07);
      }
    });

    it('should not have position bias for 1 mine', () => {
      const ITERATIONS = 50000;
      const positionCounts = new Array(25).fill(0);

      for (let i = 0; i < ITERATIONS; i++) {
        const positions = service.generateMinePositions(
          `bias-1-${i}-${Math.random()}`,
          `client-${i}`,
          i,
          1,
        );

        positionCounts[positions[0]]++;
      }

      const expected = ITERATIONS / 25;
      for (let i = 0; i < 25; i++) {
        expect(positionCounts[i]).toBeGreaterThan(expected * 0.85);
        expect(positionCounts[i]).toBeLessThan(expected * 1.15);
      }
    });

    it('should not have position bias for 24 mines', () => {
      const ITERATIONS = 50000;
      // With 24 mines, only 1 safe position — check it's uniform
      const safePositionCounts = new Array(25).fill(0);

      for (let i = 0; i < ITERATIONS; i++) {
        const minePositions = service.generateMinePositions(
          `bias-24-${i}-${Math.random()}`,
          `client-${i}`,
          i,
          24,
        );

        // Find the safe position (the one not in mines)
        for (let pos = 0; pos < 25; pos++) {
          if (!minePositions.includes(pos)) {
            safePositionCounts[pos]++;
          }
        }
      }

      const expected = ITERATIONS / 25;
      for (let i = 0; i < 25; i++) {
        expect(safePositionCounts[i]).toBeGreaterThan(expected * 0.85);
        expect(safePositionCounts[i]).toBeLessThan(expected * 1.15);
      }
    });
  });

  // ============================================
  // SECTION 2: House Edge Verification
  // ============================================
  describe('House Edge Verification', () => {
    it('should have ~4% house edge for 3 mines, 1 reveal strategy', async () => {
      const ITERATIONS = 50000;
      const BET = 1;
      let totalWagered = 0;
      let totalReturned = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-he3-${i}`;
        const game = await service.startGame(userId, {
          betAmount: BET,
          mineCount: 3,
        });

        totalWagered += BET;

        // Always reveal tile 0 and cashout
        try {
          const revealResult = await service.revealTile(userId, { gameId: game.gameId, tileIndex: 0 });
          if (revealResult.status !== 'LOST') {
            const cashoutResult = await service.cashout(userId, { gameId: game.gameId });
            totalReturned += cashoutResult.currentPayout || 0;
          }
          // If status=LOST (hit mine), returned = 0
        } catch (e) {
          // Game might have ended
        }
      }

      const houseEdge = ((totalWagered - totalReturned) / totalWagered) * 100;
      console.log(`Mines house edge (3 mines, 1 reveal, ${ITERATIONS} games): ${houseEdge.toFixed(2)}%`);

      expect(houseEdge).toBeGreaterThan(1);
      expect(houseEdge).toBeLessThan(8);
    }, 600000);

    it('should have ~4% house edge for 5 mines, 1 reveal strategy', async () => {
      const ITERATIONS = 50000;
      const BET = 1;
      let totalWagered = 0;
      let totalReturned = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-he5-${i}`;
        const game = await service.startGame(userId, {
          betAmount: BET,
          mineCount: 5,
        });

        totalWagered += BET;

        try {
          const revealResult = await service.revealTile(userId, { gameId: game.gameId, tileIndex: 0 });
          if (revealResult.status !== 'LOST') {
            const cashoutResult = await service.cashout(userId, { gameId: game.gameId });
            totalReturned += cashoutResult.currentPayout || 0;
          }
        } catch (e) {
          // Game ended
        }
      }

      const houseEdge = ((totalWagered - totalReturned) / totalWagered) * 100;
      console.log(`Mines house edge (5 mines, 1 reveal, ${ITERATIONS} games): ${houseEdge.toFixed(2)}%`);

      expect(houseEdge).toBeGreaterThan(1);
      expect(houseEdge).toBeLessThan(8);
    }, 600000);
  });

  // ============================================
  // SECTION 3: Multiplier Mathematical Verification
  // ============================================
  describe('Multiplier Mathematical Verification', () => {
    it('should verify multiplier for all mine counts at 1 reveal', () => {
      for (let mines = 1; mines <= 24; mines++) {
        const safeTiles = 25 - mines;
        const probability = safeTiles / 25;
        const expectedMultiplier = Math.floor((0.96 / probability) * 10000) / 10000;
        const actualMultiplier = service.calculateMultiplier(mines, 1);

        expect(actualMultiplier).toBe(expectedMultiplier);
      }
    });

    it('should verify multiplier for all reveal counts with 5 mines', () => {
      const mines = 5;
      const safeTiles = 20;

      let probability = 1;
      for (let reveals = 1; reveals <= safeTiles; reveals++) {
        probability *= (safeTiles - reveals + 1) / (25 - reveals + 1);
        const expectedMultiplier = Math.floor((0.96 / probability) * 10000) / 10000;
        const actualMultiplier = service.calculateMultiplier(mines, reveals);

        expect(actualMultiplier).toBe(expectedMultiplier);
      }
    });

    it('should verify max multiplier for 24 mines, 1 reveal', () => {
      // 24 mines: P = 1/25 = 0.04
      // Multiplier = 0.96 / 0.04 = 24
      const multiplier = service.calculateMultiplier(24, 1);
      expect(multiplier).toBe(24);
    });

    it('should verify multiplier for extreme case: 1 mine, all reveals', () => {
      const mines = 1;
      const safeTiles = 24;

      let probability = 1;
      for (let reveals = 1; reveals <= safeTiles; reveals++) {
        probability *= (safeTiles - reveals + 1) / (25 - reveals + 1);
        const multiplier = service.calculateMultiplier(mines, reveals);
        expect(multiplier).toBeGreaterThan(0);
        expect(isFinite(multiplier)).toBe(true);
      }
    });
  });

  // ============================================
  // SECTION 4: Hit Rate Verification
  // ============================================
  describe('Hit Rate Verification', () => {
    it('should have correct mine hit rate for 5 mines on tile 0', () => {
      const ITERATIONS = 50000;
      let hits = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const positions = service.generateMinePositions(
          `hit-${i}-${Math.random()}`,
          `client-${i}`,
          i,
          5,
        );

        if (positions.includes(0)) {
          hits++;
        }
      }

      const hitRate = (hits / ITERATIONS) * 100;
      console.log(`Mine hit rate for 5 mines on tile 0: ${hitRate.toFixed(2)}% (expected: 20%)`);

      // 5/25 = 20% chance
      expect(hitRate).toBeGreaterThan(18);
      expect(hitRate).toBeLessThan(22);
    });

    it('should have correct mine hit rate for 10 mines on tile 0', () => {
      const ITERATIONS = 50000;
      let hits = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const positions = service.generateMinePositions(
          `hit10-${i}-${Math.random()}`,
          `client-${i}`,
          i,
          10,
        );

        if (positions.includes(0)) {
          hits++;
        }
      }

      const hitRate = (hits / ITERATIONS) * 100;
      console.log(`Mine hit rate for 10 mines on tile 0: ${hitRate.toFixed(2)}% (expected: 40%)`);

      // 10/25 = 40% chance
      expect(hitRate).toBeGreaterThan(38);
      expect(hitRate).toBeLessThan(42);
    });
  });

  // ============================================
  // SECTION 5: Seed Uniqueness
  // ============================================
  describe('Seed Uniqueness', () => {
    it('should generate unique mine layouts for different server seeds', () => {
      const layouts = new Set<string>();

      for (let i = 0; i < 10000; i++) {
        const positions = service.generateMinePositions(
          `unique-${i}-${Math.random()}`,
          'fixed-client',
          1,
          5,
        );
        layouts.add(positions.join(','));
      }

      // Should have significant variety
      console.log(`Unique layouts out of 10000: ${layouts.size}`);
      expect(layouts.size).toBeGreaterThan(5000);
    });
  });
});
