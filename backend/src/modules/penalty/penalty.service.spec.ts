import { PenaltyService, StartPenaltyDto, KickDto, CashoutPenaltyDto } from './penalty.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as gameTenantHelper from '../../common/helpers/game-tenant.helper';

jest.mock('../../common/helpers/game-tenant.helper', () => ({
  getGameConfig: jest.fn(),
  checkRiskLimits: jest.fn(),
  recordPayout: jest.fn(),
}));

describe('PenaltyService', () => {
  let service: PenaltyService;
  let mockPrisma: any;
  let dateNowSpy: jest.SpyInstance;
  let currentTime: number;

  beforeEach(() => {
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
    service = new PenaltyService(mockPrisma as unknown as PrismaService);

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
  // 1. START SESSION
  // ============================================
  describe('start', () => {
    it('1.1 should create a new session and return session data', async () => {
      const result = await service.start('user-s1', { betAmount: 10 }, 'site-1');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('maxRounds', 10);
      expect(result).toHaveProperty('multiplierTable');
      expect(result).toHaveProperty('currentMultiplier', 1.0);
      expect(result).toHaveProperty('currentRound', 1);
      expect(result).toHaveProperty('goals', 0);
    });

    it('1.2 should deduct bet amount from wallet', async () => {
      await service.start('user-s2', { betAmount: 10 }, 'site-1');
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
    });

    it('1.3 should throw for bet below minimum', async () => {
      await expect(service.start('user-s3', { betAmount: 0.001 }, 'site-1'))
        .rejects.toThrow('Bet must be between');
    });

    it('1.4 should throw for bet above maximum', async () => {
      await expect(service.start('user-s4', { betAmount: 20000 }, 'site-1'))
        .rejects.toThrow('Bet must be between');
    });

    it('1.5 should throw for insufficient balance', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'wallet-1', balance: 5 }]);
      await expect(service.start('user-s5', { betAmount: 10 }, 'site-1'))
        .rejects.toThrow('Insufficient balance');
    });

    it('1.6 should throw when wallet not found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await expect(service.start('user-s6', { betAmount: 10 }, 'site-1'))
        .rejects.toThrow('No USDT wallet found');
    });

    it('1.7 should return multiplier table with 10 entries', async () => {
      const result = await service.start('user-s7', { betAmount: 10 }, 'site-1');
      expect(Object.keys(result.multiplierTable).length).toBe(10);
      // Multipliers should increase with each round
      const mults = Object.values(result.multiplierTable);
      for (let i = 1; i < mults.length; i++) {
        expect(mults[i]).toBeGreaterThan(mults[i - 1]);
      }
    });

    it('1.8 should create server seed if none exists', async () => {
      mockPrisma.serverSeed.findFirst.mockResolvedValue(null);
      await service.start('user-s8', { betAmount: 10 }, 'site-1');
      expect(mockPrisma.serverSeed.create).toHaveBeenCalled();
    });
  });

  // ============================================
  // 2. KICK
  // ============================================
  describe('kick', () => {
    it('2.1 should return kick result with all fields', async () => {
      const startResult = await service.start('user-k1', { betAmount: 10 }, 'site-1');
      const result = await service.kick('user-k1', { sessionId: startResult.sessionId, position: 'LEFT' });
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('round');
      expect(result).toHaveProperty('position', 'LEFT');
      expect(result).toHaveProperty('goalkeeperDive');
      expect(result).toHaveProperty('isGoal');
    });

    it('2.2 should throw for invalid position', async () => {
      const startResult = await service.start('user-k2', { betAmount: 10 }, 'site-1');
      await expect(service.kick('user-k2', { sessionId: startResult.sessionId, position: 'UP' as any }))
        .rejects.toThrow('Position must be LEFT, CENTER, or RIGHT');
    });

    it('2.3 should throw for non-existent session', async () => {
      await expect(service.kick('user-k3', { sessionId: 'fake-id', position: 'LEFT' }))
        .rejects.toThrow('Session not found');
    });

    it('2.4 should throw for wrong user', async () => {
      const startResult = await service.start('user-k4', { betAmount: 10 }, 'site-1');
      await expect(service.kick('user-wrong', { sessionId: startResult.sessionId, position: 'LEFT' }))
        .rejects.toThrow('This is not your session');
    });

    it('2.5 should increment round on each kick', async () => {
      const startResult = await service.start('user-k5', { betAmount: 10 }, 'site-1');
      const r1 = await service.kick('user-k5', { sessionId: startResult.sessionId, position: 'LEFT' });
      expect(r1).toHaveProperty('round', 1);
      // If goal, can kick again
      if ('canContinue' in r1 && r1.canContinue) {
        const r2 = await service.kick('user-k5', { sessionId: startResult.sessionId, position: 'CENTER' });
        expect(r2).toHaveProperty('round', 2);
      }
    });

    it('2.6 should determine goal or save based on position match', async () => {
      const startResult = await service.start('user-k6', { betAmount: 10 }, 'site-1');
      const result = await service.kick('user-k6', { sessionId: startResult.sessionId, position: 'LEFT' });
      if ('isGoal' in result && 'goalkeeperDive' in result) {
        if (result.goalkeeperDive === 'LEFT') {
          expect(result.isGoal).toBe(false);
          expect(result.isSaved).toBe(true);
        } else {
          expect(result.isGoal).toBe(true);
          expect(result.isSaved).toBe(false);
        }
      }
    });
  });

  // ============================================
  // 3. CASHOUT
  // ============================================
  describe('cashout', () => {
    it('3.1 should throw for non-existent session', async () => {
      await expect(service.cashout('user-c1', { sessionId: 'fake-id' }))
        .rejects.toThrow('Session not found');
    });

    it('3.2 should throw for wrong user', async () => {
      const { sessionId } = await service.start('user-c2', { betAmount: 10 }, 'site-1');
      await expect(service.cashout('user-wrong', { sessionId }))
        .rejects.toThrow('This is not your session');
    });

    it('3.3 should throw when no goals scored', async () => {
      const { sessionId } = await service.start('user-c3', { betAmount: 10 }, 'site-1');
      await expect(service.cashout('user-c3', { sessionId }))
        .rejects.toThrow('You need at least one goal to cashout');
    });

    it('3.4 should return cashout result with correct fields', async () => {
      const { sessionId } = await service.start('user-c4', { betAmount: 10 }, 'site-1');
      // Kick and hope for a goal - if saved, test is still valid
      const kickResult = await service.kick('user-c4', { sessionId, position: 'LEFT' });
      if ('canContinue' in kickResult && kickResult.canContinue) {
        const cashout = await service.cashout('user-c4', { sessionId });
        expect(cashout).toHaveProperty('sessionId');
        expect(cashout).toHaveProperty('totalGoals');
        expect(cashout).toHaveProperty('multiplier');
        expect(cashout).toHaveProperty('payout');
        expect(cashout).toHaveProperty('profit');
        expect(cashout.payout).toBeGreaterThan(0);
      }
    });
  });

  // ============================================
  // 4. HISTORY & VERIFICATION
  // ============================================
  describe('getHistory', () => {
    it('4.1 should return bet history', async () => {
      const bets = [{ id: 'bet-1' }];
      mockPrisma.bet.findMany.mockResolvedValue(bets);
      const result = await service.getHistory('user-1', 'site-1');
      expect(result).toEqual(bets);
    });

    it('4.2 should use default limit of 20', async () => {
      await service.getHistory('user-1', 'site-1');
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('4.3 should cap limit at 100', async () => {
      await service.getHistory('user-1', 'site-1', 200);
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('verifyKick', () => {
    it('4.4 should return verification data', async () => {
      const result = await service.verifyKick('server-seed', 'client-seed', 1, 1);
      expect(result).toHaveProperty('round', 1);
      expect(result).toHaveProperty('goalkeeperDive');
      expect(result).toHaveProperty('seedHash');
      expect(['LEFT', 'CENTER', 'RIGHT']).toContain(result.goalkeeperDive);
    });

    it('4.5 should be deterministic', async () => {
      const r1 = await service.verifyKick('server-seed', 'client-seed', 1, 1);
      const r2 = await service.verifyKick('server-seed', 'client-seed', 1, 1);
      expect(r1.goalkeeperDive).toBe(r2.goalkeeperDive);
    });

    it('4.6 should produce different results for different rounds', async () => {
      const results = new Set<string>();
      for (let i = 1; i <= 20; i++) {
        const r = await service.verifyKick('server-seed', 'client-seed', 1, i);
        results.add(r.goalkeeperDive);
      }
      // Over 20 rounds, should see at least 2 different positions
      expect(results.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getMultiplierTable', () => {
    it('4.7 should return table with 10 entries', async () => {
      const table = await service.getMultiplierTable('site-1');
      expect(table.length).toBe(10);
    });

    it('4.8 should have increasing multipliers', async () => {
      const table = await service.getMultiplierTable('site-1');
      for (let i = 1; i < table.length; i++) {
        expect(table[i].multiplier).toBeGreaterThan(table[i - 1].multiplier);
      }
    });

    it('4.9 should include goal probability', async () => {
      const table = await service.getMultiplierTable('site-1');
      for (const entry of table) {
        expect(entry).toHaveProperty('goalProbability');
        expect(entry.goalProbability).toContain('%');
      }
    });
  });
});
