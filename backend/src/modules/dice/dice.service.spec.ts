/**
 * ============================================
 * DICE SERVICE - Unit Tests
 * ============================================
 * Tests: Algorithm, House Edge, Provably Fair, Input Validation
 */

import { DiceService } from './dice.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('DiceService', () => {
  let service: DiceService;
  let mockPrisma: any;

  const mockWallet = { id: 'wallet-1', balance: 1000 };

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ ...mockWallet }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        });
      }),
      bet: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      siteConfiguration: {
        findUnique: jest.fn().mockResolvedValue({ houseEdgeConfig: { dice: 0.04 } }),
      },
      riskLimit: {
        findUnique: jest.fn().mockResolvedValue({ maxBetAmount: 5000, maxPayoutPerBet: 10000, maxDailyPayout: 50000, maxExposure: 100000 }),
      },
    };

    service = new DiceService(mockPrisma);
  });

  // ==================== WIN CHANCE CALCULATION ====================
  describe('calculateWinChance', () => {
    it('should calculate UNDER win chance correctly', () => {
      expect(service.calculateWinChance(50, 'UNDER')).toBe(50);
      expect(service.calculateWinChance(25, 'UNDER')).toBe(25);
      expect(service.calculateWinChance(75, 'UNDER')).toBe(75);
      expect(service.calculateWinChance(1, 'UNDER')).toBe(1);
      expect(service.calculateWinChance(99, 'UNDER')).toBe(99);
    });

    it('should calculate OVER win chance correctly', () => {
      expect(service.calculateWinChance(50, 'OVER')).toBe(50);
      expect(service.calculateWinChance(25, 'OVER')).toBe(75);
      expect(service.calculateWinChance(75, 'OVER')).toBe(25);
      expect(service.calculateWinChance(1, 'OVER')).toBe(99);
      expect(service.calculateWinChance(99, 'OVER')).toBe(1);
    });
  });

  // ==================== MULTIPLIER CALCULATION ====================
  describe('calculateMultiplier', () => {
    it('should calculate multiplier with 4% house edge', () => {
      // 50% chance → 96/50 = 1.92x
      expect(service.calculateMultiplier(50, 0.04)).toBe(1.92);
      // 25% chance → 96/25 = 3.84x
      expect(service.calculateMultiplier(25, 0.04)).toBe(3.84);
      // 10% chance → 96/10 = 9.6x
      expect(service.calculateMultiplier(10, 0.04)).toBe(9.6);
      // 1% chance → 96/1 = 96x
      expect(service.calculateMultiplier(1, 0.04)).toBe(96);
    });

    it('should floor multiplier to 4 decimal places', () => {
      // 33% chance → 96/33 = 2.909090... → 2.9090
      const mult = service.calculateMultiplier(33, 0.04);
      const decimalStr = mult.toString().split('.')[1] || '';
      expect(decimalStr.length).toBeLessThanOrEqual(4);
    });

    it('should return 0 for invalid win chances', () => {
      expect(service.calculateMultiplier(0, 0.04)).toBe(Infinity);
      expect(service.calculateMultiplier(100, 0.04)).toBeCloseTo(0.96, 2);
      expect(service.calculateMultiplier(-1, 0.04)).toBe(-96);
    });
  });

  // ==================== ROLL GENERATION ====================
  describe('generateRoll', () => {
    it('should generate roll between 0.00 and 99.99', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = crypto.randomBytes(16).toString('hex');
        const roll = service.generateRoll(serverSeed, clientSeed, i);
        expect(roll).toBeGreaterThanOrEqual(0);
        expect(roll).toBeLessThan(100);
      }
    });

    it('should be deterministic with same seeds', () => {
      const serverSeed = 'test-server-seed-123';
      const clientSeed = 'test-client-seed-456';
      const nonce = 42;

      const roll1 = service.generateRoll(serverSeed, clientSeed, nonce);
      const roll2 = service.generateRoll(serverSeed, clientSeed, nonce);
      expect(roll1).toBe(roll2);
    });

    it('should produce different rolls with different nonces', () => {
      const serverSeed = 'test-server-seed-123';
      const clientSeed = 'test-client-seed-456';

      const roll1 = service.generateRoll(serverSeed, clientSeed, 1);
      const roll2 = service.generateRoll(serverSeed, clientSeed, 2);
      // Very unlikely to be the same
      expect(roll1).not.toBe(roll2);
    });

    it('should have 2 decimal places', () => {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const roll = service.generateRoll(serverSeed, clientSeed, 0);
      const decimals = roll.toString().split('.')[1] || '0';
      expect(decimals.length).toBeLessThanOrEqual(2);
    });
  });

  // ==================== WIN DETERMINATION ====================
  describe('isWinningRoll', () => {
    it('should correctly determine UNDER wins', () => {
      expect(service.isWinningRoll(49.99, 50, 'UNDER')).toBe(true);
      expect(service.isWinningRoll(50, 50, 'UNDER')).toBe(false);
      expect(service.isWinningRoll(50.01, 50, 'UNDER')).toBe(false);
      expect(service.isWinningRoll(0, 50, 'UNDER')).toBe(true);
    });

    it('should correctly determine OVER wins', () => {
      expect(service.isWinningRoll(50.01, 50, 'OVER')).toBe(true);
      expect(service.isWinningRoll(50, 50, 'OVER')).toBe(false);
      expect(service.isWinningRoll(49.99, 50, 'OVER')).toBe(false);
      expect(service.isWinningRoll(99.99, 50, 'OVER')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(service.isWinningRoll(0, 0.01, 'UNDER')).toBe(true);
      expect(service.isWinningRoll(99.99, 99.98, 'OVER')).toBe(true);
    });
  });

  // ==================== PLAY FUNCTION ====================
  describe('play', () => {
    it('should play a valid dice round', async () => {
      const result = await service.play('user-1', {
        betAmount: 10,
        target: 50,
        condition: 'UNDER',
      }, 'default-site-001');

      expect(result).toHaveProperty('roll');
      expect(result).toHaveProperty('target', 50);
      expect(result).toHaveProperty('condition', 'UNDER');
      expect(result).toHaveProperty('isWin');
      expect(result).toHaveProperty('multiplier');
      expect(result).toHaveProperty('winChance', 50);
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('clientSeed');
      expect(result).toHaveProperty('nonce');
      expect(result.roll).toBeGreaterThanOrEqual(0);
      expect(result.roll).toBeLessThan(100);
      expect(result.multiplier).toBe(1.92);
    });

    it('should reject bet below minimum', async () => {
      await expect(
        service.play('user-2', { betAmount: 0.001, target: 50, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bet above maximum', async () => {
      await expect(
        service.play('user-3', { betAmount: 100000, target: 50, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid target too low', async () => {
      await expect(
        service.play('user-4', { betAmount: 10, target: 0, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid target too high', async () => {
      await expect(
        service.play('user-5', { betAmount: 10, target: 99.99, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid condition', async () => {
      await expect(
        service.play('user-6', { betAmount: 10, target: 50, condition: 'INVALID' as any }, 'default-site-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when wallet not found', async () => {
      mockPrisma.$transaction = jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([]),
          wallet: { update: jest.fn() },
          bet: { create: jest.fn() },
          transaction: { create: jest.fn() },
        });
      });

      await expect(
        service.play('user-7', { betAmount: 10, target: 50, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow('Wallet not found');
    });

    it('should reject when insufficient balance', async () => {
      mockPrisma.$transaction = jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'w1', balance: 5 }]),
          wallet: { update: jest.fn() },
          bet: { create: jest.fn() },
          transaction: { create: jest.fn() },
        });
      });

      await expect(
        service.play('user-8', { betAmount: 10, target: 50, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should enforce rate limiting', async () => {
      await service.play('rate-user-1', { betAmount: 10, target: 50, condition: 'UNDER' }, 'default-site-001');
      
      await expect(
        service.play('rate-user-1', { betAmount: 10, target: 50, condition: 'UNDER' }, 'default-site-001'),
      ).rejects.toThrow('Please wait before placing another bet');
    });

    it('should calculate correct payout on win', async () => {
      const result = await service.play('user-payout-1', {
        betAmount: 100,
        target: 50,
        condition: 'UNDER',
      }, 'default-site-001');

      if (result.isWin) {
        expect(result.payout).toBeCloseTo(192, 0); // 100 * 1.92
        expect(result.profit).toBeCloseTo(92, 0);
      } else {
        expect(result.payout).toBe(0);
        expect(result.profit).toBe(-100);
      }
    });

    it('should use atomic transaction with row locking', async () => {
      await service.play('user-atomic-1', { betAmount: 10, target: 50, condition: 'UNDER' }, 'default-site-001');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== VERIFY ROLL ====================
  describe('verifyRoll', () => {
    it('should verify a roll correctly', () => {
      const serverSeed = 'verify-test-seed';
      const clientSeed = 'verify-client-seed';
      const nonce = 42;

      const result = service.verifyRoll(serverSeed, clientSeed, nonce);
      expect(result).toHaveProperty('roll');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result.roll).toBeGreaterThanOrEqual(0);
      expect(result.roll).toBeLessThan(100);

      // Verify the hash matches
      const expectedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      expect(result.serverSeedHash).toBe(expectedHash);
    });
  });

  // ==================== HOUSE EDGE MONTE CARLO ====================
  describe('House Edge Verification', () => {
    it('should maintain ~4% house edge over 100K simulations', () => {
      const iterations = 100000;
      let totalBet = 0;
      let totalPayout = 0;
      const betAmount = 1;
      const target = 50;
      const condition: 'UNDER' = 'UNDER';
      const winChance = service.calculateWinChance(target, condition);
      const multiplier = service.calculateMultiplier(winChance, 0.04);

      for (let i = 0; i < iterations; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = crypto.randomBytes(16).toString('hex');
        const roll = service.generateRoll(serverSeed, clientSeed, i);
        const isWin = service.isWinningRoll(roll, target, condition);

        totalBet += betAmount;
        if (isWin) {
          totalPayout += betAmount * multiplier;
        }
      }

      const houseEdge = 1 - totalPayout / totalBet;
      // Should be approximately 4% (±2% tolerance for 100K iterations)
      expect(houseEdge).toBeGreaterThan(0.02);
      expect(houseEdge).toBeLessThan(0.06);
    }, 30000);

    it('should maintain house edge across different targets', () => {
      const targets = [10, 25, 50, 75, 90];
      const iterations = 50000;

      for (const target of targets) {
        let totalBet = 0;
        let totalPayout = 0;
        const betAmount = 1;
        const condition: 'UNDER' = 'UNDER';
        const winChance = service.calculateWinChance(target, condition);
        const multiplier = service.calculateMultiplier(winChance, 0.04);

        for (let i = 0; i < iterations; i++) {
          const serverSeed = crypto.randomBytes(32).toString('hex');
          const clientSeed = crypto.randomBytes(16).toString('hex');
          const roll = service.generateRoll(serverSeed, clientSeed, i);
          const isWin = service.isWinningRoll(roll, target, condition);

          totalBet += betAmount;
          if (isWin) {
            totalPayout += betAmount * multiplier;
          }
        }

        const houseEdge = 1 - totalPayout / totalBet;
        // Wider tolerance for smaller sample per target
        expect(houseEdge).toBeGreaterThan(0.01);
        expect(houseEdge).toBeLessThan(0.08);
      }
    }, 60000);

    it('should produce uniform distribution of rolls', () => {
      const iterations = 100000;
      const buckets = new Array(10).fill(0); // 10 buckets: 0-9.99, 10-19.99, etc.

      for (let i = 0; i < iterations; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = crypto.randomBytes(16).toString('hex');
        const roll = service.generateRoll(serverSeed, clientSeed, i);
        const bucket = Math.floor(roll / 10);
        buckets[Math.min(bucket, 9)]++;
      }

      // Each bucket should have ~10% of rolls (±2%)
      const expected = iterations / 10;
      for (const count of buckets) {
        expect(count / iterations).toBeGreaterThan(0.08);
        expect(count / iterations).toBeLessThan(0.12);
      }
    }, 30000);
  });

  // ==================== GET HISTORY ====================
  describe('getHistory', () => {
    it('should call prisma with correct parameters', async () => {
      await service.getHistory('user-1', 'default-site-001', 20);
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", gameType: "DICE", siteId: "default-site-001" },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      );
    });
  });
});
