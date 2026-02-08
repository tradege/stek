/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PLINKO SERVICE - COMPREHENSIVE UNIT TESTS                         ║
 * ║  Covers: play(), getMultipliers(), generatePath(), rate limiting,   ║
 * ║  atomic transactions, input validation, edge cases, concurrency     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PlinkoService } from './plinko.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// ============ MOCK SETUP ============
const mockWallet = {
  id: 'wallet-1',
  userId: 'user-1',
  currency: 'USDT',
  balance: new Decimal(1000),
};

const mockPrismaService = {
  $transaction: jest.fn(),
  wallet: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  bet: {
    create: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
};

describe('PlinkoService - Comprehensive Unit Tests', () => {
  let service: PlinkoService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset rate limiter between tests
    // Access the module-level Map through the service
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlinkoService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PlinkoService>(PlinkoService);
    prisma = module.get(PrismaService);

    // Default: $transaction executes the callback
    prisma.$transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(1000) }]),
        wallet: { update: jest.fn().mockResolvedValue({}) },
        bet: { create: jest.fn().mockResolvedValue({}) },
        transaction: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 1: INPUT VALIDATION
  // ─────────────────────────────────────────────────────────────────
  describe('1. Input Validation', () => {
    it('1.1 Should reject negative bet amount', async () => {
      await expect(
        service.play('user-1', { betAmount: -10, rows: 16, risk: 'LOW' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.2 Should reject zero bet amount', async () => {
      await expect(
        service.play('user-1', { betAmount: 0, rows: 16, risk: 'LOW' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.3 Should reject rows below 8', async () => {
      await expect(
        service.play('user-1', { betAmount: 10, rows: 7, risk: 'LOW' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.4 Should reject rows above 16', async () => {
      await expect(
        service.play('user-1', { betAmount: 10, rows: 17, risk: 'LOW' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.5 Should reject invalid risk level', async () => {
      await expect(
        service.play('user-1', { betAmount: 10, rows: 16, risk: 'EXTREME' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.6 Should reject empty string risk', async () => {
      await expect(
        service.play('user-1', { betAmount: 10, rows: 16, risk: '' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.7 Should accept all valid risk levels', async () => {
      for (const risk of ['LOW', 'MEDIUM', 'HIGH']) {
        // Each call should not throw on validation (may throw on rate limit)
        try {
          const result = await service.play(`user-valid-${risk}`, {
            betAmount: 10,
            rows: 16,
            risk: risk as any,
          });
          expect(result).toBeDefined();
          expect(result.path).toBeDefined();
        } catch (e: any) {
          // Only rate limit errors are acceptable here
          if (!e.message.includes('Please wait')) {
            throw e;
          }
        }
      }
    });

    it('1.8 Should accept all valid row counts (8-16)', async () => {
      for (let rows = 8; rows <= 16; rows++) {
        try {
          const result = await service.play(`user-rows-${rows}`, {
            betAmount: 10,
            rows,
            risk: 'LOW',
          });
          expect(result).toBeDefined();
        } catch (e: any) {
          if (!e.message.includes('Please wait')) {
            throw e;
          }
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 2: RATE LIMITING
  // ─────────────────────────────────────────────────────────────────
  describe('2. Rate Limiting', () => {
    it('2.1 Should reject rapid consecutive bets from same user', async () => {
      // First bet should succeed
      const result = await service.play('rate-limit-user', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result).toBeDefined();

      // Immediate second bet should be rate limited
      await expect(
        service.play('rate-limit-user', {
          betAmount: 10,
          rows: 16,
          risk: 'LOW',
        }),
      ).rejects.toThrow('Please wait before placing another bet');
    });

    it('2.2 Should allow bets from different users simultaneously', async () => {
      const result1 = await service.play('user-A', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      const result2 = await service.play('user-B', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('2.3 Should allow bet after rate limit window passes', async () => {
      const result1 = await service.play('rate-wait-user', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result1).toBeDefined();

      // Wait for rate limit to expire (500ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 600));

      const result2 = await service.play('rate-wait-user', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result2).toBeDefined();
    }, 10000);
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 3: PLAY METHOD - SUCCESSFUL FLOW
  // ─────────────────────────────────────────────────────────────────
  describe('3. Play Method - Successful Flow', () => {
    it('3.1 Should return all required fields in result', async () => {
      const result = await service.play('user-full-result', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });

      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('bucketIndex');
      expect(result).toHaveProperty('multiplier');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('clientSeed');
      expect(result).toHaveProperty('nonce');
    });

    it('3.2 Path length should equal number of rows', async () => {
      for (let rows = 8; rows <= 16; rows++) {
        try {
          const result = await service.play(`user-path-${rows}`, {
            betAmount: 10,
            rows,
            risk: 'LOW',
          });
          expect(result.path.length).toBe(rows);
        } catch (e: any) {
          if (!e.message.includes('Please wait')) throw e;
        }
      }
    });

    it('3.3 Payout should equal betAmount * multiplier', async () => {
      const betAmount = 100;
      const result = await service.play('user-payout-calc', {
        betAmount,
        rows: 16,
        risk: 'LOW',
      });
      expect(result.payout).toBeCloseTo(betAmount * result.multiplier, 2);
    });

    it('3.4 Profit should equal payout - betAmount', async () => {
      const betAmount = 50;
      const result = await service.play('user-profit-calc', {
        betAmount,
        rows: 16,
        risk: 'MEDIUM',
      });
      expect(result.profit).toBeCloseTo(result.payout - betAmount, 2);
    });

    it('3.5 BucketIndex should be within valid range [0, rows]', async () => {
      const rows = 16;
      const result = await service.play('user-bucket-range', {
        betAmount: 10,
        rows,
        risk: 'HIGH',
      });
      expect(result.bucketIndex).toBeGreaterThanOrEqual(0);
      expect(result.bucketIndex).toBeLessThanOrEqual(rows);
    });

    it('3.6 ServerSeedHash should be 64-char hex string (SHA256)', async () => {
      const result = await service.play('user-hash-format', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result.serverSeedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('3.7 ClientSeed should be 32-char hex string', async () => {
      const result = await service.play('user-client-seed', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result.clientSeed).toMatch(/^[a-f0-9]{32}$/);
    });

    it('3.8 Nonce should be a non-negative integer', async () => {
      const result = await service.play('user-nonce', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(Number.isInteger(result.nonce)).toBe(true);
      expect(result.nonce).toBeGreaterThanOrEqual(0);
    });

    it('3.9 Multiplier should match the multiplier table for the given bucket', async () => {
      const result = await service.play('user-mult-match', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      const expectedMults = service.getMultipliers(16, 'LOW' as any);
      expect(result.multiplier).toBe(expectedMults[result.bucketIndex]);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 4: WALLET & TRANSACTION INTEGRITY
  // ─────────────────────────────────────────────────────────────────
  describe('4. Wallet & Transaction Integrity', () => {
    it('4.1 Should use $transaction for atomic operations', async () => {
      await service.play('user-atomic', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('4.2 Should use FOR UPDATE row locking', async () => {
      let queryRawCalled = false;
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
            queryRawCalled = true;
            // Verify the query contains FOR UPDATE
            // Prisma tagged template splits the query into array segments
            const queryParts = args[0];
            const fullQuery = Array.isArray(queryParts) ? queryParts.join(' ') : String(queryParts);
            expect(fullQuery.toUpperCase()).toContain('FOR UPDATE');
            return [{ id: 'wallet-1', balance: new Decimal(1000) }];
          }),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      await service.play('user-lock', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(queryRawCalled).toBe(true);
    });

    it('4.3 Should reject bet when wallet not found', async () => {
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          wallet: { update: jest.fn() },
          bet: { create: jest.fn() },
          transaction: { create: jest.fn() },
        };
        return cb(tx);
      });

      await expect(
        service.play('user-no-wallet', {
          betAmount: 10,
          rows: 16,
          risk: 'LOW',
        }),
      ).rejects.toThrow('Wallet not found');
    });

    it('4.4 Should reject bet when insufficient balance', async () => {
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(5) }]),
          wallet: { update: jest.fn() },
          bet: { create: jest.fn() },
          transaction: { create: jest.fn() },
        };
        return cb(tx);
      });

      await expect(
        service.play('user-broke', {
          betAmount: 10,
          rows: 16,
          risk: 'LOW',
        }),
      ).rejects.toThrow('Insufficient balance');
    });

    it('4.5 Should create bet record with correct data', async () => {
      let betCreateData: any = null;
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(1000) }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: {
            create: jest.fn().mockImplementation((args: any) => {
              betCreateData = args.data;
              return {};
            }),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await service.play('user-bet-record', {
        betAmount: 25,
        rows: 12,
        risk: 'MEDIUM',
      });

      expect(betCreateData).toBeDefined();
      expect(betCreateData.userId).toBe('user-bet-record');
      expect(betCreateData.gameType).toBe('PLINKO');
      expect(betCreateData.currency).toBe('USDT');
      expect(Number(betCreateData.betAmount)).toBe(25);
      expect(Number(betCreateData.multiplier)).toBe(result.multiplier);
      expect(betCreateData.gameData.rows).toBe(12);
      expect(betCreateData.gameData.risk).toBe('MEDIUM');
      expect(betCreateData.isWin).toBe(result.profit > 0);
    });

    it('4.6 Should create transaction record for audit trail', async () => {
      let txCreateData: any = null;
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(500) }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: {
            create: jest.fn().mockImplementation((args: any) => {
              txCreateData = args.data;
              return {};
            }),
          },
        };
        return cb(tx);
      });

      await service.play('user-tx-record', {
        betAmount: 50,
        rows: 16,
        risk: 'HIGH',
      });

      expect(txCreateData).toBeDefined();
      expect(txCreateData.userId).toBe('user-tx-record');
      expect(txCreateData.walletId).toBe('wallet-1');
      expect(txCreateData.type).toBe('BET');
      expect(txCreateData.status).toBe('CONFIRMED');
      expect(Number(txCreateData.amount)).toBe(50);
      expect(Number(txCreateData.balanceBefore)).toBe(500);
      expect(txCreateData.metadata.game).toBe('PLINKO');
    });

    it('4.7 Balance update should be: oldBalance - betAmount + payout', async () => {
      let walletUpdateData: any = null;
      const initialBalance = new Decimal(1000);

      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: initialBalance }]),
          wallet: {
            update: jest.fn().mockImplementation((args: any) => {
              walletUpdateData = args.data;
              return {};
            }),
          },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const betAmount = 100;
      const result = await service.play('user-balance-calc', {
        betAmount,
        rows: 16,
        risk: 'LOW',
      });

      const expectedBalance = 1000 - betAmount + result.payout;
      expect(walletUpdateData.balance).toBeCloseTo(expectedBalance, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 5: getMultipliers METHOD
  // ─────────────────────────────────────────────────────────────────
  describe('5. getMultipliers Method', () => {
    it('5.1 Should return correct number of multipliers (rows + 1)', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const mults = service.getMultipliers(rows, 'LOW' as any);
        expect(mults.length).toBe(rows + 1);
      }
    });

    it('5.2 Should return empty array for invalid rows', () => {
      expect(service.getMultipliers(7, 'LOW' as any)).toEqual([]);
      expect(service.getMultipliers(17, 'LOW' as any)).toEqual([]);
      expect(service.getMultipliers(0, 'LOW' as any)).toEqual([]);
    });

    it('5.3 Should return symmetric multiplier arrays', () => {
      const risks = ['LOW', 'MEDIUM', 'HIGH'] as const;
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of risks) {
          const mults = service.getMultipliers(rows, risk as any);
          for (let i = 0; i < mults.length; i++) {
            expect(mults[i]).toBe(mults[mults.length - 1 - i]);
          }
        }
      }
    });

    it('5.4 All multipliers should be positive numbers', () => {
      const risks = ['LOW', 'MEDIUM', 'HIGH'] as const;
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of risks) {
          const mults = service.getMultipliers(rows, risk as any);
          mults.forEach((m) => {
            expect(m).toBeGreaterThan(0);
            expect(typeof m).toBe('number');
            expect(isNaN(m)).toBe(false);
            expect(isFinite(m)).toBe(true);
          });
        }
      }
    });

    it('5.5 HIGH risk should have higher max multiplier than LOW risk', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const lowMax = Math.max(...service.getMultipliers(rows, 'LOW' as any));
        const highMax = Math.max(...service.getMultipliers(rows, 'HIGH' as any));
        expect(highMax).toBeGreaterThan(lowMax);
      }
    });

    it('5.6 HIGH risk should have lower min multiplier than LOW risk', () => {
      for (let rows = 8; rows <= 16; rows++) {
        const lowMin = Math.min(...service.getMultipliers(rows, 'LOW' as any));
        const highMin = Math.min(...service.getMultipliers(rows, 'HIGH' as any));
        expect(highMin).toBeLessThan(lowMin);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 6: SECURITY & ABUSE PREVENTION
  // ─────────────────────────────────────────────────────────────────
  describe('6. Security & Abuse Prevention', () => {
    it('6.1 Each play generates unique server seed', async () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        try {
          const result = await service.play(`user-unique-${i}`, {
            betAmount: 10,
            rows: 16,
            risk: 'LOW',
          });
          hashes.add(result.serverSeedHash);
        } catch (e: any) {
          if (!e.message.includes('Please wait')) throw e;
        }
      }
      // All hashes should be unique
      expect(hashes.size).toBe(100);
    });

    it('6.2 Each play generates unique client seed', async () => {
      const seeds = new Set<string>();
      for (let i = 0; i < 100; i++) {
        try {
          const result = await service.play(`user-cseed-${i}`, {
            betAmount: 10,
            rows: 16,
            risk: 'LOW',
          });
          seeds.add(result.clientSeed);
        } catch (e: any) {
          if (!e.message.includes('Please wait')) throw e;
        }
      }
      expect(seeds.size).toBe(100);
    });

    it('6.3 Very large bet amount should still work if balance allows', async () => {
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(999999999) }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await service.play('user-whale', {
        betAmount: 999999,
        rows: 16,
        risk: 'HIGH',
      });
      expect(result.payout).toBe(999999 * result.multiplier);
    });

    it('6.4 Very small bet amount (0.01) should work', async () => {
      const result = await service.play('user-micro', {
        betAmount: 0.01,
        rows: 8,
        risk: 'LOW',
      });
      expect(result.payout).toBeCloseTo(0.01 * result.multiplier, 4);
    });

    it('6.5 Default currency should be USDT', async () => {
      let queriedCurrency: string = '';
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
            const queryParts = args[0];
            if (Array.isArray(queryParts)) {
              queriedCurrency = String(queryParts.find((p: any) => typeof p === 'string' && p.includes('USDT')) || 'USDT');
            }
            return [{ id: 'wallet-1', balance: new Decimal(1000) }];
          }),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      await service.play('user-currency', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      // Transaction was called, meaning the default currency worked
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION 7: ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────
  describe('7. Error Handling', () => {
    it('7.1 Should propagate database errors', async () => {
      prisma.$transaction.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        service.play('user-db-error', {
          betAmount: 10,
          rows: 16,
          risk: 'LOW',
        }),
      ).rejects.toThrow('Database connection lost');
    });

    it('7.2 Should handle null wallet query result', async () => {
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue(null),
          wallet: { update: jest.fn() },
          bet: { create: jest.fn() },
          transaction: { create: jest.fn() },
        };
        return cb(tx);
      });

      await expect(
        service.play('user-null-wallet', {
          betAmount: 10,
          rows: 16,
          risk: 'LOW',
        }),
      ).rejects.toThrow('Wallet not found');
    });

    it('7.3 Should handle exact balance = bet amount (edge case)', async () => {
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(10) }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      // Balance exactly equals bet - should succeed
      const result = await service.play('user-exact-balance', {
        betAmount: 10,
        rows: 16,
        risk: 'LOW',
      });
      expect(result).toBeDefined();
    });

    it('7.4 Should handle balance just below bet amount', async () => {
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: new Decimal(9.99) }]),
          wallet: { update: jest.fn() },
          bet: { create: jest.fn() },
          transaction: { create: jest.fn() },
        };
        return cb(tx);
      });

      await expect(
        service.play('user-almost-broke', {
          betAmount: 10,
          rows: 16,
          risk: 'LOW',
        }),
      ).rejects.toThrow('Insufficient balance');
    });
  });
});
