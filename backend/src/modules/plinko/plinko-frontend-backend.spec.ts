/**
 * ============================================
 * PLINKO - Frontend-Backend Consistency Test
 * ============================================
 * Verifies that the backend's calculated bucketIndex matches
 * the path-based bucket calculation, ensuring the frontend
 * animation will land on the correct bucket.
 *
 * This test catches the critical bug where the frontend physics
 * animation could show the ball landing on a different bucket
 * than what the backend calculated for payout.
 */

import { PlinkoService } from './plinko.service';
import {
  calculateBucketFromPath,
  getMultiplier,
  RiskLevel,
} from './plinko.constants';
import { BadRequestException } from '@nestjs/common';
import { VipService } from '../vip/vip.service';
import { RewardPoolService } from '../reward-pool/reward-pool.service';
import { CommissionProcessorService } from '../affiliate/commission-processor.service';

// Mock Date.now to bypass rate limiting (500ms between bets)
let mockTime = 1000000;
const originalDateNow = Date.now;
beforeAll(() => {
  Date.now = jest.fn(() => {
    mockTime += 1000; // Advance 1 second each call
    return mockTime;
  });
});
afterAll(() => {
  Date.now = originalDateNow;
});


const mockRewardPoolService = { contributeToPool: jest.fn() };
const mockCommissionProcessor = { processCommission: jest.fn() };
const mockVipService = {
  updateUserStats: jest.fn().mockResolvedValue(undefined),
  checkLevelUp: jest.fn().mockResolvedValue({ leveledUp: false, newLevel: 0, tierName: 'Bronze' }),
  processRakeback: jest.fn().mockResolvedValue(undefined),
  claimRakeback: jest.fn().mockResolvedValue({ success: true, amount: 0, message: 'OK' }),
  getVipStatus: jest.fn().mockResolvedValue({}),
};

describe('Plinko Frontend-Backend Consistency', () => {
  let service: PlinkoService;
  let mockPrisma: any;

  const testUserId = 'consistency-test-user';

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 999999 }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
      serverSeed: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'seed-1',
          userId: 'test-user',
          seed: 'a'.repeat(64),
          seedHash: 'b'.repeat(64),
          isActive: true,
          nonce: 0,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'seed-1',
          userId: 'test-user',
          seed: 'a'.repeat(64),
          seedHash: 'b'.repeat(64),
          isActive: true,
          nonce: 0,
        }),
        update: jest.fn().mockResolvedValue({ nonce: 1 }),
      },
      siteConfiguration: {
        findUnique: jest.fn().mockResolvedValue({ houseEdgeConfig: { dice: 0.04, mines: 0.03, plinko: 0.03, crash: 0.04, olympus: 0.04 } }),
      },
      riskLimit: {
        findUnique: jest.fn().mockResolvedValue({ maxBetAmount: 5000, maxPayoutPerBet: 10000, maxDailyPayout: 50000, maxExposure: 100000 }),
      },
        });
      }),
      serverSeed: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'seed-1',
          userId: 'test-user',
          seed: 'a'.repeat(64),
          seedHash: 'b'.repeat(64),
          isActive: true,
          nonce: 0,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'seed-1',
          userId: 'test-user',
          seed: 'a'.repeat(64),
          seedHash: 'b'.repeat(64),
          isActive: true,
          nonce: 0,
        }),
        update: jest.fn().mockResolvedValue({ nonce: 1 }),
      },
      siteConfiguration: {
        findUnique: jest.fn().mockResolvedValue({ houseEdgeConfig: { dice: 0.04, mines: 0.03, plinko: 0.03, crash: 0.04, olympus: 0.04 } }),
      },
      bet: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new PlinkoService(mockPrisma, mockVipService as any, mockRewardPoolService as any, mockCommissionProcessor as any);
  });

  // ==================== PATH-BUCKET CONSISTENCY ====================
  describe('Path to Bucket Mapping', () => {
    it('should have bucketIndex matching the sum of path directions', async () => {
      // Run 100 drops and verify each one
      for (let i = 0; i < 100; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows: 16,
          risk: 'MEDIUM' as RiskLevel,
        });

        // The backend calculates bucketIndex from the path
        // bucketIndex = sum of 1s in the path array
        const expectedBucket = calculateBucketFromPath(result.path);
        expect(result.bucketIndex).toBe(expectedBucket);
      }
    });

    it('should have multiplier matching the bucket position in config', async () => {
      const risks: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      const rowOptions = [8, 12, 16];

      for (const risk of risks) {
        for (const rows of rowOptions) {
          const result = await service.play(testUserId, {
            betAmount: 1,
            rows,
            risk,
          });

          const expectedMultiplier = getMultiplier(rows, risk, result.bucketIndex);
          expect(result.multiplier).toBe(expectedMultiplier);
        }
      }
    });

    it('should have payout = betAmount * multiplier', async () => {
      for (let i = 0; i < 50; i++) {
        const betAmount = 1;
        const result = await service.play(testUserId, {
          betAmount,
          rows: 16,
          risk: 'MEDIUM' as RiskLevel,
        });

        const expectedPayout = betAmount * result.multiplier;
        expect(result.payout).toBeCloseTo(expectedPayout, 2);
      }
    });
  });

  // ==================== PATH VALIDITY ====================
  describe('Path Validity', () => {
    it('should have path length equal to rows count', async () => {
      for (const rows of [8, 12, 16]) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows,
          risk: 'MEDIUM' as RiskLevel,
        });

        expect(result.path.length).toBe(rows);
      }
    });

    it('should have path containing only 0s and 1s', async () => {
      for (let i = 0; i < 50; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows: 16,
          risk: 'MEDIUM' as RiskLevel,
        });

        for (const direction of result.path) {
          expect([0, 1]).toContain(direction);
        }
      }
    });

    it('should have bucketIndex in valid range (0 to rows)', async () => {
      for (const rows of [8, 12, 16]) {
        for (let i = 0; i < 30; i++) {
          const result = await service.play(testUserId, {
            betAmount: 1,
            rows,
            risk: 'MEDIUM' as RiskLevel,
          });

          expect(result.bucketIndex).toBeGreaterThanOrEqual(0);
          expect(result.bucketIndex).toBeLessThanOrEqual(rows);
        }
      }
    });
  });

  // ==================== FRONTEND ANIMATION SAFETY ====================
  describe('Frontend Animation Safety', () => {
    it('should always return bucketIndex (never undefined or null)', async () => {
      for (let i = 0; i < 50; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows: 16,
          risk: 'MEDIUM' as RiskLevel,
        });

        expect(result.bucketIndex).toBeDefined();
        expect(result.bucketIndex).not.toBeNull();
        expect(typeof result.bucketIndex).toBe('number');
      }
    });

    it('should always return path (never undefined or null)', async () => {
      for (let i = 0; i < 50; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows: 16,
          risk: 'MEDIUM' as RiskLevel,
        });

        expect(result.path).toBeDefined();
        expect(result.path).not.toBeNull();
        expect(Array.isArray(result.path)).toBe(true);
      }
    });

    it('should always return multiplier (never undefined or null)', async () => {
      for (let i = 0; i < 50; i++) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows: 16,
          risk: 'MEDIUM' as RiskLevel,
        });

        expect(result.multiplier).toBeDefined();
        expect(result.multiplier).not.toBeNull();
        expect(typeof result.multiplier).toBe('number');
        expect(result.multiplier).toBeGreaterThan(0);
      }
    });

    it('should have consistent data across all risk levels', async () => {
      for (const risk of (['LOW', 'MEDIUM', 'HIGH'] as const)) {
        const result = await service.play(testUserId, {
          betAmount: 1,
          rows: 16,
          risk,
        });

        // bucketIndex from path should match returned bucketIndex
        const pathBucket = calculateBucketFromPath(result.path);
        expect(result.bucketIndex).toBe(pathBucket);

        // multiplier should be from the correct config
        const expectedMultiplier = getMultiplier(16, risk, result.bucketIndex);
        expect(result.multiplier).toBe(expectedMultiplier);
      }
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle all-left path (bucketIndex = 0)', () => {
      // A path of all 0s should give bucketIndex 0
      const allLeftPath = new Array(16).fill(0);
      const bucket = calculateBucketFromPath(allLeftPath);
      expect(bucket).toBe(0);
    });

    it('should handle all-right path (bucketIndex = rows)', () => {
      // A path of all 1s should give bucketIndex = rows
      const rows = 16;
      const allRightPath = new Array(rows).fill(1);
      const bucket = calculateBucketFromPath(allRightPath);
      expect(bucket).toBe(rows);
    });

    it('should handle alternating path', () => {
      const rows = 16;
      const alternatingPath = Array.from({ length: rows }, (_, i) => i % 2);
      const bucket = calculateBucketFromPath(alternatingPath);
      expect(bucket).toBe(rows / 2);
    });
  });
});
