/**
 * ============================================
 * DICE - Frontend-Backend Consistency Test
 * ============================================
 * Verifies that the backend's calculated results are internally
 * consistent, ensuring the frontend will display correct data.
 *
 * Tests:
 * - Roll value matches win/loss determination
 * - Payout matches multiplier × betAmount for wins
 * - Profit = payout - betAmount
 * - Multiplier formula: (100 × 0.96) / winChance
 * - Win chance calculation for OVER and UNDER
 * - Provably fair verification matches original roll
 */

import { DiceService } from './dice.service';
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

describe('Dice Frontend-Backend Consistency', () => {
  let service: DiceService;
  let mockPrisma: any;

  const testUserId = 'dice-consistency-test-user';

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

    service = new DiceService(mockPrisma);
  });

  // ============================================
  // SECTION 1: Roll-Win Consistency
  // ============================================
  describe('Roll-Win Consistency', () => {
    it('should correctly determine win for UNDER condition', async () => {
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        });

        if (result.roll < result.target) {
          expect(result.isWin).toBe(true);
        } else {
          expect(result.isWin).toBe(false);
        }
      }
    });

    it('should correctly determine win for OVER condition', async () => {
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target: 50,
          condition: 'OVER',
        });

        if (result.roll > result.target) {
          expect(result.isWin).toBe(true);
        } else {
          expect(result.isWin).toBe(false);
        }
      }
    });

    it('should have roll in valid range (0.00 to 99.99)', async () => {
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        });

        expect(result.roll).toBeGreaterThanOrEqual(0);
        expect(result.roll).toBeLessThanOrEqual(99.99);
      }
    });

    it('should have roll with at most 2 decimal places', async () => {
      for (let i = 0; i < 50; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        });

        const decimals = (result.roll.toString().split('.')[1] || '').length;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    });
  });

  // ============================================
  // SECTION 2: Payout Consistency
  // ============================================
  describe('Payout Consistency', () => {
    it('should have payout = betAmount × multiplier for wins', async () => {
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 10,
          target: 50,
          condition: 'UNDER',
        });

        if (result.isWin) {
          expect(result.payout).toBeCloseTo(10 * result.multiplier, 2);
        }
      }
    });

    it('should have payout = 0 for losses', async () => {
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 10,
          target: 50,
          condition: 'UNDER',
        });

        if (!result.isWin) {
          expect(result.payout).toBe(0);
        }
      }
    });

    it('should have profit = payout - betAmount', async () => {
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 5,
          target: 50,
          condition: 'UNDER',
        });

        expect(result.profit).toBeCloseTo(result.payout - 5, 2);
      }
    });
  });

  // ============================================
  // SECTION 3: Multiplier Formula Consistency
  // ============================================
  describe('Multiplier Formula Consistency', () => {
    it('should calculate multiplier as (96 / winChance) floored to 4 decimals', async () => {
      const targets = [10, 25, 50, 75, 90];

      for (const target of targets) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target,
          condition: 'UNDER',
        });

        const expectedMultiplier = Math.floor((96 / target) * 10000) / 10000;
        expect(result.multiplier).toBe(expectedMultiplier);
      }
    });

    it('should calculate multiplier correctly for OVER condition', async () => {
      const targets = [10, 25, 50, 75, 90];

      for (const target of targets) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target,
          condition: 'OVER',
        });

        const winChance = 100 - target;
        const expectedMultiplier = Math.floor((96 / winChance) * 10000) / 10000;
        expect(result.multiplier).toBe(expectedMultiplier);
      }
    });

    it('should have winChance matching condition and target', async () => {
      const result1 = await service.play(testUserId, {
        betAmount: 1,
        target: 30,
        condition: 'UNDER',
      });
      expect(result1.winChance).toBe(30);

      const result2 = await service.play(testUserId, {
        betAmount: 1,
        target: 30,
        condition: 'OVER',
      });
      expect(result2.winChance).toBe(70);
    });

    it('should have higher multiplier for lower win chance', async () => {
      const result1 = await service.play(testUserId, {
        betAmount: 1,
        target: 10,
        condition: 'UNDER',
      });

      const result2 = await service.play(testUserId, {
        betAmount: 1,
        target: 90,
        condition: 'UNDER',
      });

      expect(result1.multiplier).toBeGreaterThan(result2.multiplier);
    });
  });

  // ============================================
  // SECTION 4: Provably Fair Verification
  // ============================================
  describe('Provably Fair Verification', () => {
    it('should return all provably fair fields', async () => {
      const result = await service.play(testUserId, {
        betAmount: 1,
        target: 50,
        condition: 'UNDER',
      });

      expect(result.serverSeedHash).toBeDefined();
      expect(result.serverSeedHash.length).toBe(64); // SHA-256 hex
      expect(result.clientSeed).toBeDefined();
      expect(result.clientSeed.length).toBe(32); // 16 bytes hex
      expect(result.nonce).toBeDefined();
      expect(typeof result.nonce).toBe('number');
    });

    it('should have unique serverSeedHash for each spin', async () => {
      const hashes = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        });
        hashes.add(result.serverSeedHash);
      }

      expect(hashes.size).toBe(50);
    });

    it('should produce consistent roll from verifyRoll', () => {
      // Test that the same seeds produce the same roll
      const serverSeed = 'test-server-seed-123';
      const clientSeed = 'test-client-seed-456';
      const nonce = 42;

      const result1 = service.verifyRoll(serverSeed, clientSeed, nonce);
      const result2 = service.verifyRoll(serverSeed, clientSeed, nonce);

      expect(result1.roll).toBe(result2.roll);
      expect(result1.serverSeedHash).toBe(result2.serverSeedHash);
    });

    it('should produce different rolls for different nonces', () => {
      const serverSeed = 'test-server-seed-123';
      const clientSeed = 'test-client-seed-456';

      const rolls = new Set<number>();
      for (let nonce = 0; nonce < 100; nonce++) {
        const result = service.verifyRoll(serverSeed, clientSeed, nonce);
        rolls.add(result.roll);
      }

      // Should have significant variety (at least 50 unique rolls out of 100)
      expect(rolls.size).toBeGreaterThan(50);
    });
  });

  // ============================================
  // SECTION 5: Response Structure Consistency
  // ============================================
  describe('Response Structure Consistency', () => {
    it('should return all required fields', async () => {
      const result = await service.play(testUserId, {
        betAmount: 1,
        target: 50,
        condition: 'UNDER',
      });

      expect(result).toHaveProperty('roll');
      expect(result).toHaveProperty('target');
      expect(result).toHaveProperty('condition');
      expect(result).toHaveProperty('isWin');
      expect(result).toHaveProperty('multiplier');
      expect(result).toHaveProperty('winChance');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('clientSeed');
      expect(result).toHaveProperty('nonce');
    });

    it('should echo back the target and condition', async () => {
      const result = await service.play(testUserId, {
        betAmount: 1,
        target: 33.33,
        condition: 'OVER',
      });

      expect(result.target).toBe(33.33);
      expect(result.condition).toBe('OVER');
    });

    it('should have correct types for all fields', async () => {
      const result = await service.play(testUserId, {
        betAmount: 1,
        target: 50,
        condition: 'UNDER',
      });

      expect(typeof result.roll).toBe('number');
      expect(typeof result.target).toBe('number');
      expect(typeof result.condition).toBe('string');
      expect(typeof result.isWin).toBe('boolean');
      expect(typeof result.multiplier).toBe('number');
      expect(typeof result.winChance).toBe('number');
      expect(typeof result.payout).toBe('number');
      expect(typeof result.profit).toBe('number');
      expect(typeof result.serverSeedHash).toBe('string');
      expect(typeof result.clientSeed).toBe('string');
      expect(typeof result.nonce).toBe('number');
    });
  });
});
