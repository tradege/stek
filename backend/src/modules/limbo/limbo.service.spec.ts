import { LimboService } from './limbo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as gameTenantHelper from '../../common/helpers/game-tenant.helper';

jest.mock('../../common/helpers/game-tenant.helper', () => ({
  getGameConfig: jest.fn(),
  checkRiskLimits: jest.fn(),
  recordPayout: jest.fn(),
}));

describe('LimboService', () => {
  let service: LimboService;
  let mockPrisma: any;
  let dateNowSpy: jest.SpyInstance;
  let currentTime: number;

  beforeEach(() => {
    // Mock Date.now to bypass rate limiting - advance time by 2 seconds each call
    currentTime = 1000000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      currentTime += 2000;
      return currentTime;
    });

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 10000 }]),
      serverSeed: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'seed-id', seed: 'server-seed',
          seedHash: crypto.createHash('sha256').update('server-seed').digest('hex'),
          nonce: 0,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'seed-id', seed: 'new-server-seed',
          seedHash: crypto.createHash('sha256').update('new-server-seed').digest('hex'),
          nonce: 0,
        }),
        update: jest.fn(),
      },
      wallet: { update: jest.fn() },
      bet: { create: jest.fn(), findMany: jest.fn() },
      transaction: { create: jest.fn() },
    };
    service = new LimboService(mockPrisma as unknown as PrismaService);

    (gameTenantHelper.getGameConfig as jest.Mock).mockResolvedValue({
      houseEdge: 0.04, maxBetAmount: 10000, minBetAmount: 0.01,
    });
    (gameTenantHelper.checkRiskLimits as jest.Mock).mockResolvedValue({ allowed: true });
    (gameTenantHelper.recordPayout as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dateNowSpy.mockRestore();
  });

  // ============================================
  // 1. PROVABLY FAIR RNG
  // ============================================
  describe('generateResult', () => {
    it('1.1 should generate a result between 1.00 and 10000', () => {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const result = service.generateResult(serverSeed, clientSeed, 1, 0.04);
      expect(result).toBeGreaterThanOrEqual(1.0);
      expect(result).toBeLessThanOrEqual(10000);
    });

    it('1.2 should be deterministic with the same seeds and nonce', () => {
      const result1 = service.generateResult('server-seed', 'client-seed', 1, 0.04);
      const result2 = service.generateResult('server-seed', 'client-seed', 1, 0.04);
      expect(result1).toBe(result2);
    });

    it('1.3 should produce different results with different nonces', () => {
      const result1 = service.generateResult('server-seed', 'client-seed', 1, 0.04);
      const result2 = service.generateResult('server-seed', 'client-seed', 2, 0.04);
      expect(result1).not.toBe(result2);
    });

    it('1.4 should produce different results with different server seeds', () => {
      const result1 = service.generateResult('seed-a', 'client-seed', 1, 0.04);
      const result2 = service.generateResult('seed-b', 'client-seed', 1, 0.04);
      expect(result1).not.toBe(result2);
    });

    it('1.5 should produce different results with different client seeds', () => {
      const result1 = service.generateResult('server-seed', 'client-a', 1, 0.04);
      const result2 = service.generateResult('server-seed', 'client-b', 1, 0.04);
      expect(result1).not.toBe(result2);
    });

    it('1.6 should have 2 decimal places', () => {
      const result = service.generateResult('server-seed', 'client-seed', 1, 0.04);
      const decimals = result.toString().split('.')[1] || '';
      expect(decimals.length).toBeLessThanOrEqual(2);
    });

    it('1.7 should respect house edge - higher edge means lower average result', () => {
      let sumLow = 0, sumHigh = 0;
      for (let i = 0; i < 1000; i++) {
        sumLow += service.generateResult('seed', 'client', i, 0.01);
        sumHigh += service.generateResult('seed', 'client', i, 0.10);
      }
      expect(sumLow / 1000).toBeGreaterThan(sumHigh / 1000);
    });
  });

  // ============================================
  // 2. WIN CHANCE CALCULATION
  // ============================================
  describe('calculateWinChance', () => {
    it('2.1 should calculate win chance correctly for target 2x', () => {
      expect(service.calculateWinChance(2, 0.04)).toBeCloseTo(48, 0);
    });

    it('2.2 should calculate win chance correctly for target 10x', () => {
      expect(service.calculateWinChance(10, 0.04)).toBeCloseTo(9.6, 1);
    });

    it('2.3 should calculate win chance correctly for target 100x', () => {
      expect(service.calculateWinChance(100, 0.04)).toBeCloseTo(0.96, 2);
    });

    it('2.4 should return lower win chance for higher targets', () => {
      const chance2x = service.calculateWinChance(2, 0.04);
      const chance10x = service.calculateWinChance(10, 0.04);
      const chance100x = service.calculateWinChance(100, 0.04);
      expect(chance2x).toBeGreaterThan(chance10x);
      expect(chance10x).toBeGreaterThan(chance100x);
    });

    it('2.5 should never return negative win chance', () => {
      const chance = service.calculateWinChance(10000, 0.04);
      expect(chance).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 3. PLAY - SUCCESSFUL FLOW
  // ============================================
  describe('play - successful flow', () => {
    const siteId = 'site-1';
    const playDto = { betAmount: 10, targetMultiplier: 2 };

    it('3.1 should return all required fields in result', async () => {
      const result = await service.play('user-play-1', playDto, siteId);
      expect(result).toHaveProperty('resultMultiplier');
      expect(result).toHaveProperty('targetMultiplier');
      expect(result).toHaveProperty('isWin');
      expect(result).toHaveProperty('winChance');
      expect(result).toHaveProperty('multiplier');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('clientSeed');
      expect(result).toHaveProperty('nonce');
    });

    it('3.2 should handle win scenario correctly', async () => {
      jest.spyOn(service, 'generateResult').mockReturnValue(3);
      const result = await service.play('user-play-2', playDto, siteId);
      expect(result.isWin).toBe(true);
      expect(result.multiplier).toBe(2);
      expect(result.payout).toBe(20);
      expect(result.profit).toBe(10);
    });

    it('3.3 should handle loss scenario correctly', async () => {
      jest.spyOn(service, 'generateResult').mockReturnValue(1.5);
      const result = await service.play('user-play-3', playDto, siteId);
      expect(result.isWin).toBe(false);
      expect(result.multiplier).toBe(0);
      expect(result.payout).toBe(0);
      expect(result.profit).toBe(-10);
    });

    it('3.4 should create a new server seed if one does not exist', async () => {
      mockPrisma.serverSeed.findFirst.mockResolvedValue(null);
      await service.play('user-play-4', playDto, siteId);
      expect(mockPrisma.serverSeed.create).toHaveBeenCalled();
    });

    it('3.5 should use an existing server seed and increment nonce', async () => {
      mockPrisma.serverSeed.findFirst.mockResolvedValue({
        id: 'seed-id', seed: 'existing-seed',
        seedHash: 'existing-hash', nonce: 10,
      });
      await service.play('user-play-5', playDto, siteId);
      expect(mockPrisma.serverSeed.create).not.toHaveBeenCalled();
      expect(mockPrisma.serverSeed.update).toHaveBeenCalledWith({
        where: { id: 'seed-id' }, data: { nonce: 11 },
      });
    });
  });

  // ============================================
  // 4. PLAY - INPUT VALIDATION
  // ============================================
  describe('play - input validation', () => {
    const siteId = 'site-1';

    it('4.1 should throw for target multiplier below minimum (1.01)', async () => {
      await expect(service.play('user-v1', { betAmount: 10, targetMultiplier: 1 }, siteId))
        .rejects.toThrow('Target must be between 1.01x and 10000x');
    });

    it('4.2 should throw for target multiplier above maximum (10000)', async () => {
      await expect(service.play('user-v2', { betAmount: 10, targetMultiplier: 10001 }, siteId))
        .rejects.toThrow('Target must be between 1.01x and 10000x');
    });

    it('4.3 should throw for bet amount below minimum', async () => {
      await expect(service.play('user-v3', { betAmount: 0.001, targetMultiplier: 2 }, siteId))
        .rejects.toThrow('Bet must be between 0.01 and 10000');
    });

    it('4.4 should throw for bet amount above maximum', async () => {
      await expect(service.play('user-v4', { betAmount: 20000, targetMultiplier: 2 }, siteId))
        .rejects.toThrow('Bet must be between 0.01 and 10000');
    });

    it('4.5 should throw for insufficient balance', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'wallet-1', balance: 5 }]);
      await expect(service.play('user-v5', { betAmount: 10, targetMultiplier: 2 }, siteId))
        .rejects.toThrow('Insufficient balance');
    });

    it('4.6 should throw when wallet not found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await expect(service.play('user-v6', { betAmount: 10, targetMultiplier: 2 }, siteId))
        .rejects.toThrow('No USDT wallet found');
    });

    it('4.7 should throw when payout exceeds risk limits', async () => {
      (gameTenantHelper.checkRiskLimits as jest.Mock).mockResolvedValue({ allowed: false, reason: 'Payout exceeds risk limits' });
      jest.spyOn(service, 'generateResult').mockReturnValue(3);
      await expect(service.play('user-v7', { betAmount: 10, targetMultiplier: 2 }, siteId))
        .rejects.toThrow('Payout exceeds risk limits');
    });
  });

  // ============================================
  // 5. PLAY - RATE LIMITING
  // ============================================
  describe('play - rate limiting', () => {
    it('5.1 should throw for rapid consecutive bets from same user', async () => {
      // Reset Date.now to return fixed time for this test
      dateNowSpy.mockRestore();
      const fixedTime = 1000000;
      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedTime);

      await service.play('user-rl1', { betAmount: 10, targetMultiplier: 2 }, 'site-1');

      // Same time = within rate limit
      await expect(service.play('user-rl1', { betAmount: 10, targetMultiplier: 2 }, 'site-1'))
        .rejects.toThrow('Please wait before placing another bet');
    });

    it('5.2 should allow bets from different users simultaneously', async () => {
      dateNowSpy.mockRestore();
      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(2000000);

      await service.play('user-rl2a', { betAmount: 10, targetMultiplier: 2 }, 'site-1');
      // Different user should not be rate limited
      await expect(service.play('user-rl2b', { betAmount: 10, targetMultiplier: 2 }, 'site-1'))
        .resolves.toBeDefined();
    });
  });

  // ============================================
  // 6. WALLET & TRANSACTION INTEGRITY
  // ============================================
  describe('play - wallet & transaction integrity', () => {
    it('6.1 should use $transaction for atomic operations', async () => {
      await service.play('user-w1', { betAmount: 10, targetMultiplier: 2 }, 'site-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('6.2 should create bet record', async () => {
      await service.play('user-w2', { betAmount: 10, targetMultiplier: 2 }, 'site-1');
      expect(mockPrisma.bet.create).toHaveBeenCalled();
    });

    it('6.3 should create transaction record', async () => {
      await service.play('user-w3', { betAmount: 10, targetMultiplier: 2 }, 'site-1');
      expect(mockPrisma.transaction.create).toHaveBeenCalled();
    });

    it('6.4 should update wallet balance', async () => {
      await service.play('user-w4', { betAmount: 10, targetMultiplier: 2 }, 'site-1');
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
    });

    it('6.5 should record payout on win', async () => {
      jest.spyOn(service, 'generateResult').mockReturnValue(6);
      await service.play('user-w5', { betAmount: 5, targetMultiplier: 5 }, 'site-1');
      expect(gameTenantHelper.recordPayout).toHaveBeenCalled();
    });

    it('6.6 should not record payout on loss', async () => {
      jest.spyOn(service, 'generateResult').mockReturnValue(1.5);
      await service.play('user-w6', { betAmount: 5, targetMultiplier: 5 }, 'site-1');
      expect(gameTenantHelper.recordPayout).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 7. HISTORY & VERIFICATION
  // ============================================
  describe('getHistory', () => {
    it('7.1 should return bet history', async () => {
      const bets = [{ id: 'bet-1' }, { id: 'bet-2' }];
      mockPrisma.bet.findMany.mockResolvedValue(bets);
      const result = await service.getHistory('user-1', 'site-1');
      expect(result).toEqual(bets);
    });

    it('7.2 should use default limit of 20', async () => {
      await service.getHistory('user-1', 'site-1');
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('7.3 should cap limit at 100', async () => {
      await service.getHistory('user-1', 'site-1', 200);
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('7.4 should filter by userId, siteId, and gameType', async () => {
      await service.getHistory('user-1', 'site-1');
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', siteId: 'site-1', gameType: 'LIMBO' },
        }),
      );
    });
  });

  describe('verifyResult', () => {
    it('7.5 should return resultMultiplier and seedHash', async () => {
      const result = await service.verifyResult('server-seed', 'client-seed', 1);
      expect(result).toHaveProperty('resultMultiplier');
      expect(result).toHaveProperty('seedHash');
    });

    it('7.6 should produce deterministic verification', async () => {
      const result1 = await service.verifyResult('server-seed', 'client-seed', 1);
      const result2 = await service.verifyResult('server-seed', 'client-seed', 1);
      expect(result1.resultMultiplier).toBe(result2.resultMultiplier);
    });

    it('7.7 should return correct SHA-256 hash of server seed', async () => {
      const result = await service.verifyResult('server-seed', 'client-seed', 1);
      const expectedHash = crypto.createHash('sha256').update('server-seed').digest('hex');
      expect(result.seedHash).toBe(expectedHash);
    });
  });
});
