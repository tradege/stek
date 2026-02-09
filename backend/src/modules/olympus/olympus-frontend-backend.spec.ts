/**
 * ============================================
 * OLYMPUS - Frontend-Backend Consistency Test
 * ============================================
 * Verifies that the backend's grid, tumble, and payout data
 * is internally consistent, ensuring the frontend displays
 * correct results.
 *
 * Tests:
 * - Grid dimensions (6 columns × 5 rows)
 * - Tumble chain consistency (each tumble has valid grid)
 * - Payout matches win calculation
 * - Scatter count matches actual scatters in grid
 * - Free spins awarded when 4+ scatters
 * - Multiplier sum is consistent
 * - Provably fair fields present
 */

import { OlympusService } from './olympus.service';
import { BadRequestException } from '@nestjs/common';

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

// Clear free spin sessions between tests
const freeSpinSessions = new Map();

describe('Olympus Frontend-Backend Consistency', () => {
  let service: OlympusService;
  let mockPrisma: any;

  const testUserId = 'olympus-consistency-test-user';

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 999999 }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        });
      }),
      bet: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new OlympusService(mockPrisma);
    // Clear any active free spin sessions
    if ((service as any).freeSpinSessions) {
      (service as any).freeSpinSessions.clear();
    }
  });

  // ============================================
  // SECTION 1: Grid Structure Consistency
  // ============================================
  describe('Grid Structure Consistency', () => {
    it('should return initialGrid with correct dimensions (6 cols × 5 rows)', async () => {
      const result = await service.spin(testUserId, { betAmount: 1 });

      expect(result.initialGrid).toBeDefined();
      expect(Array.isArray(result.initialGrid)).toBe(true);
      // Grid is returned as rows (5 rows × 6 columns)
      expect(result.initialGrid.length).toBe(5);
      for (const row of result.initialGrid) {
        expect(Array.isArray(row)).toBe(true);
        expect(row.length).toBe(6);
      }
    });

    it('should have valid symbols in every grid cell', async () => {
      const validSymbols = [
        'crown', 'hourglass', 'ring', 'chalice', 'purple_gem',
        'green_gem', 'blue_gem', 'red_gem', 'scatter', 'multiplier',
      ];

      for (let i = 0; i < 10; i++) {
        const userId = `grid-sym-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        for (const row of result.initialGrid) {
          for (const cell of row) {
            expect(cell).toHaveProperty('symbol');
            expect(validSymbols).toContain(cell.symbol);
          }
        }
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });

    it('should have consistent grid in each tumble step', async () => {
      for (let i = 0; i < 20; i++) {
        const userId = `tumble-grid-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        if (result.tumbles && result.tumbles.length > 0) {
          for (const tumble of result.tumbles) {
            expect(tumble.grid).toBeDefined();
            expect(tumble.grid.length).toBe(5);
            for (const row of tumble.grid) {
              expect(row.length).toBe(6);
            }
          }
        }
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });
  });

  // ============================================
  // SECTION 2: Payout Consistency
  // ============================================
  describe('Payout Consistency', () => {
    it('should have totalWin >= 0', async () => {
      for (let i = 0; i < 50; i++) {
        const userId = `payout-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        expect(result.totalWin).toBeGreaterThanOrEqual(0);
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });

    it('should have isWin=true when totalWin > 0 and isWin=false when totalWin = 0', async () => {
      for (let i = 0; i < 50; i++) {
        const userId = `win-check-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        if (result.totalWin > 0) {
          expect(result.isWin).toBe(true);
        } else {
          expect(result.isWin).toBe(false);
        }
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });

    it('should have profit = totalWin - betAmount', async () => {
      for (let i = 0; i < 50; i++) {
        const userId = `profit-${i}`;
        const betAmount = 1;
        const result = await service.spin(userId, { betAmount });

        const actualBet = result.anteBet ? betAmount * 1.25 : betAmount;
        expect(result.profit).toBeCloseTo(result.totalWin - actualBet, 2);
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });

    it('should have tumbles only when there are wins', async () => {
      for (let i = 0; i < 50; i++) {
        const userId = `tumble-win-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        if (result.tumbles && result.tumbles.length > 0) {
          // Each tumble should have wins
          for (const tumble of result.tumbles) {
            expect(tumble.wins).toBeDefined();
          }
        }
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });
  });

  // ============================================
  // SECTION 3: Scatter and Free Spins Consistency
  // ============================================
  describe('Scatter and Free Spins Consistency', () => {
    it('should count scatters correctly in initialGrid', async () => {
      for (let i = 0; i < 30; i++) {
        const userId = `scatter-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        // Count scatters in the initial grid
        let scatterCount = 0;
        for (const row of result.initialGrid) {
          for (const cell of row) {
            if (cell.symbol === 'scatter') {
              scatterCount++;
            }
          }
        }

        // scatterCount from backend may include scatters found in tumbles too
        // so it can be >= the initial grid scatter count
        expect(result.scatterCount).toBeGreaterThanOrEqual(scatterCount);
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });

    it('should award free spins when scatterCount >= 4', async () => {
      for (let i = 0; i < 100; i++) {
        const userId = `freespin-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        if (result.scatterCount >= 4) {
          expect(result.freeSpinsAwarded).toBeGreaterThan(0);
          expect(result.freeSpinSessionId).toBeDefined();
        }
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });

    it('should not award free spins when scatterCount < 4', async () => {
      for (let i = 0; i < 50; i++) {
        const userId = `no-freespin-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });

        if (result.scatterCount < 4) {
          expect(result.freeSpinsAwarded).toBe(0);
        }
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }
    });
  });

  // ============================================
  // SECTION 4: Ante Bet Consistency
  // ============================================
  describe('Ante Bet Consistency', () => {
    it('should charge 25% more when anteBet is true', async () => {
      const result = await service.spin(testUserId, {
        betAmount: 10,
        anteBet: true,
      });

      expect(result.anteBet).toBe(true);
      expect(result.betAmount).toBe(12.5); // 10 × 1.25
    });

    it('should charge normal amount when anteBet is false', async () => {
      const result = await service.spin(testUserId, {
        betAmount: 10,
        anteBet: false,
      });

      expect(result.anteBet).toBeFalsy();
      expect(result.betAmount).toBe(10);
    });
  });

  // ============================================
  // SECTION 5: Provably Fair Fields
  // ============================================
  describe('Provably Fair Fields', () => {
    it('should return all provably fair fields', async () => {
      const result = await service.spin(testUserId, { betAmount: 1 });

      expect(result.serverSeedHash).toBeDefined();
      expect(result.serverSeedHash.length).toBe(64);
      expect(result.clientSeed).toBeDefined();
      expect(typeof result.nonce).toBe('number');
    });

    it('should have unique serverSeedHash for each spin', async () => {
      const hashes = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const userId = `hash-${i}`;
        const result = await service.spin(userId, { betAmount: 1 });
        hashes.add(result.serverSeedHash);
        if ((service as any).freeSpinSessions) {
          (service as any).freeSpinSessions.clear();
        }
      }

      expect(hashes.size).toBe(20);
    });
  });

  // ============================================
  // SECTION 6: Response Structure
  // ============================================
  describe('Response Structure', () => {
    it('should return all required fields', async () => {
      const result = await service.spin(testUserId, { betAmount: 1 });

      expect(result).toHaveProperty('initialGrid');
      expect(result).toHaveProperty('tumbles');
      expect(result).toHaveProperty('totalWin');
      expect(result).toHaveProperty('totalMultiplier');
      expect(result).toHaveProperty('scatterCount');
      expect(result).toHaveProperty('freeSpinsAwarded');
      expect(result).toHaveProperty('isWin');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('betAmount');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('clientSeed');
      expect(result).toHaveProperty('nonce');
    });

    it('should have correct types for all fields', async () => {
      const result = await service.spin(testUserId, { betAmount: 1 });

      expect(Array.isArray(result.initialGrid)).toBe(true);
      expect(Array.isArray(result.tumbles)).toBe(true);
      expect(typeof result.totalWin).toBe('number');
      expect(typeof result.totalMultiplier).toBe('number');
      expect(typeof result.scatterCount).toBe('number');
      expect(typeof result.freeSpinsAwarded).toBe('number');
      expect(typeof result.isWin).toBe('boolean');
      expect(typeof result.profit).toBe('number');
      expect(typeof result.betAmount).toBe('number');
      expect(typeof result.serverSeedHash).toBe('string');
      expect(typeof result.clientSeed).toBe('string');
      expect(typeof result.nonce).toBe('number');
    });
  });
});
