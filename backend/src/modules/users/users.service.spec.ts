/**
 * ============================================
 * USERS SERVICE - Comprehensive Test Suite
 * ============================================
 * Tests all UsersService methods against actual Prisma calls.
 * 
 * Coverage:
 *  1. getPlatformStats     - bet.count, user.count, bet.aggregate(_sum, _max)
 *  2. getUserStats         - bet.findMany → in-memory aggregation
 *  3. getUserProfile       - user.findUnique + getUserStats
 *  4. updateProfile        - user.findUnique, user.update, bcrypt/argon2 verify
 *  5. getUserBets          - bet.findMany + bet.count (paginated)
 *  6. getUserTransactions  - transaction.findMany + transaction.count (paginated)
 *  7. getUserFinancialSummary - transaction.aggregate, bet.aggregate, wallet.findMany
 *  8. Edge Cases           - empty data, not found, validation
 */

import { UsersService } from './users.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));
jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
}));

const bcrypt = require('bcrypt');
const argon2 = require('argon2');

const mockUser = {
  id: 'user-1',
  username: 'testplayer',
  email: 'test@example.com',
  role: 'USER',
  displayName: 'Test Player',
  avatarUrl: null,
  country: 'IL',
  language: 'en',
  timezone: 'Asia/Jerusalem',
  twoFactorEnabled: false,
  createdAt: new Date('2025-01-01'),
  totalWagered: 5000,
  vipLevel: 2,
  lastLoginAt: new Date(),
  wallets: [{ id: 'w1', balance: 500, currency: 'USD' }],
  passwordHash: '$2b$10$hashedpassword',
};

const mockBets = [
  { betAmount: 10, payout: 20, profit: 10, isWin: true, multiplier: 2, gameType: 'DICE' },
  { betAmount: 10, payout: 0, profit: -10, isWin: false, multiplier: 2, gameType: 'DICE' },
  { betAmount: 5, payout: 15, profit: 10, isWin: true, multiplier: 3, gameType: 'PLINKO' },
  { betAmount: 20, payout: 0, profit: -20, isWin: false, multiplier: 1.5, gameType: 'CRASH' },
];

function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ ...mockUser }),
      findMany: jest.fn().mockResolvedValue([mockUser]),
      update: jest.fn().mockResolvedValue({ ...mockUser }),
      count: jest.fn().mockResolvedValue(100),
    },
    bet: {
      findMany: jest.fn().mockResolvedValue([...mockBets]),
      count: jest.fn().mockResolvedValue(50),
      aggregate: jest.fn().mockImplementation((args: any) => {
        if (args?._max) {
          return Promise.resolve({ _max: { multiplier: 3 } });
        }
        return Promise.resolve({
          _sum: { betAmount: 45, payout: 35, profit: -10 },
          _count: 4,
        });
      }),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'tx-1', type: 'DEPOSIT', amount: 100, status: 'CONFIRMED', balanceBefore: 0, balanceAfter: 100, createdAt: new Date() },
      ]),
      count: jest.fn().mockResolvedValue(10),
      aggregate: jest.fn().mockImplementation((args: any) => {
        if (args?.where?.type === 'DEPOSIT') {
          return Promise.resolve({ _sum: { amount: 1000 }, _count: 5 });
        }
        if (args?.where?.type === 'WITHDRAWAL') {
          return Promise.resolve({ _sum: { amount: 200 }, _count: 2 });
        }
        return Promise.resolve({ _sum: { amount: 0 }, _count: 0 });
      }),
    },
    wallet: {
      findMany: jest.fn().mockResolvedValue([
        { currency: 'USD', balance: 500, bonusBalance: 50 },
      ]),
    },
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new UsersService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('1. getPlatformStats', () => {
    it('should return aggregated platform statistics', async () => {
      const result = await service.getPlatformStats();
      expect(result).toHaveProperty('totalWagered');
      expect(result).toHaveProperty('gamesPlayed');
      expect(result).toHaveProperty('highestWin');
      expect(result).toHaveProperty('activePlayers');
      expect(mockPrisma.bet.count).toHaveBeenCalled();
      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } });
      expect(mockPrisma.bet.aggregate).toHaveBeenCalledTimes(2);
    });

    it('should handle zero data gracefully', async () => {
      mockPrisma.bet.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.bet.aggregate.mockResolvedValue({ _sum: { betAmount: null }, _max: { multiplier: null } });
      const result = await service.getPlatformStats();
      expect(result.totalWagered).toBe(0);
      expect(result.gamesPlayed).toBe(0);
      expect(result.highestWin).toBe(0);
      expect(result.activePlayers).toBe(0);
    });
  });

  describe('2. getUserStats', () => {
    it('should compute stats from bet records', async () => {
      const result = await service.getUserStats('user-1');
      expect(result.totalBets).toBe(4);
      expect(result.wonBets).toBe(2);
      expect(result.lostBets).toBe(2);
      expect(result.winRate).toBe(50);
      expect(result.biggestMultiplier).toBe(3);
      expect(result.favoriteGame).toBe('DICE');
      expect(result.gameBreakdown).toHaveProperty('DICE');
      expect(result.gameBreakdown).toHaveProperty('PLINKO');
      expect(result.gameBreakdown).toHaveProperty('CRASH');
    });

    it('should handle user with zero bets', async () => {
      mockPrisma.bet.findMany.mockResolvedValue([]);
      const result = await service.getUserStats('user-1');
      expect(result.totalBets).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.biggestWin).toBe(0);
      expect(result.favoriteGame).toBe('N/A');
    });

    it('should correctly calculate total wager and profit', async () => {
      const result = await service.getUserStats('user-1');
      expect(result.totalWager).toBe(45);
      expect(result.totalWin).toBe(35);
      expect(result.totalProfit).toBe(-10);
    });
  });

  describe('3. getUserProfile', () => {
    it('should return user profile with stats', async () => {
      const result = await service.getUserProfile('user-1');
      expect(result).toHaveProperty('username', 'testplayer');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('stats');
      expect((result as any).stats).toHaveProperty('totalBets');
    });

    it('should return error object for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.getUserProfile('non-existent');
      expect(result).toEqual({ error: 'User not found' });
    });
  });

  describe('4. updateProfile', () => {
    it('should update display name', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, displayName: 'New Name' });
      const result = await service.updateProfile('user-1', { displayName: 'New Name' });
      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should reject short display name', async () => {
      await expect(service.updateProfile('user-1', { displayName: 'A' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject long display name (>30 chars)', async () => {
      await expect(service.updateProfile('user-1', { displayName: 'A'.repeat(31) }))
        .rejects.toThrow(BadRequestException);
    });

    it('should require password for email change', async () => {
      await expect(service.updateProfile('user-1', { email: 'new@test.com' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should allow email change with valid password (bcrypt)', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, email: 'new@test.com' });
      const result = await service.updateProfile('user-1', { email: 'new@test.com', password: 'correct' });
      expect(result.success).toBe(true);
    });

    it('should allow email change with argon2 hash', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser, passwordHash: '$argon2id$v=19$...' })
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, email: 'new@test.com' });
      const result = await service.updateProfile('user-1', { email: 'new@test.com', password: 'correct' });
      expect(result.success).toBe(true);
      expect(argon2.verify).toHaveBeenCalled();
    });

    it('should reject email change with wrong password', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);
      await expect(service.updateProfile('user-1', { email: 'new@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({ id: 'other-user' });
      await expect(service.updateProfile('user-1', { email: 'taken@test.com', password: 'correct' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should return no-changes message when no data provided', async () => {
      const result = await service.updateProfile('user-1', {});
      expect(result.success).toBe(true);
      expect(result.message).toContain('No changes');
    });

    it('should throw for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateProfile('bad-id', { displayName: 'Test' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should update language and timezone', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, language: 'he', timezone: 'Asia/Jerusalem' });
      const result = await service.updateProfile('user-1', { language: 'he', timezone: 'Asia/Jerusalem' });
      expect(result.success).toBe(true);
    });
  });

  describe('5. getUserBets', () => {
    it('should return paginated bets', async () => {
      mockPrisma.bet.findMany.mockResolvedValue([
        { id: 'b1', gameType: 'DICE', betAmount: 10, multiplier: 2, payout: 20, profit: 10, isWin: true, currency: 'USD', createdAt: new Date() },
      ]);
      mockPrisma.bet.count.mockResolvedValue(1);
      const result = await service.getUserBets('user-1', 1, 20);
      expect(result.bets).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
      expect(typeof result.bets[0].betAmount).toBe('number');
    });

    it('should filter by gameType', async () => {
      await service.getUserBets('user-1', 1, 20, 'DICE');
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', gameType: 'DICE' } }),
      );
    });

    it('should handle empty results', async () => {
      mockPrisma.bet.findMany.mockResolvedValue([]);
      mockPrisma.bet.count.mockResolvedValue(0);
      const result = await service.getUserBets('user-1');
      expect(result.bets).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('6. getUserTransactions', () => {
    it('should return paginated transactions', async () => {
      const result = await service.getUserTransactions('user-1', 1, 20);
      expect(result.transactions).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(typeof result.transactions[0].amount).toBe('number');
    });

    it('should filter by type', async () => {
      await service.getUserTransactions('user-1', 1, 20, 'DEPOSIT');
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', type: 'DEPOSIT' } }),
      );
    });
  });

  describe('7. getUserFinancialSummary', () => {
    it('should return complete financial summary', async () => {
      const result = await service.getUserFinancialSummary('user-1');
      expect(result.totalDeposited).toBe(1000);
      expect(result.totalWithdrawn).toBe(200);
      expect(result.depositCount).toBe(5);
      expect(result.withdrawalCount).toBe(2);
      expect(result.betCount).toBe(4);
      expect(result.wallets).toHaveLength(1);
      expect(result.wallets[0].balance).toBe(550);
      expect(result).toHaveProperty('netPnL');
    });

    it('should handle user with no activity', async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });
      mockPrisma.bet.aggregate.mockResolvedValue({ _sum: { betAmount: null, payout: null, profit: null }, _count: 0 });
      mockPrisma.wallet.findMany.mockResolvedValue([]);
      const result = await service.getUserFinancialSummary('user-1');
      expect(result.totalDeposited).toBe(0);
      expect(result.totalWagered).toBe(0);
      expect(result.wallets).toHaveLength(0);
    });
  });

  describe('8. Edge Cases', () => {
    it('should handle concurrent calls without interference', async () => {
      const [stats1, stats2] = await Promise.all([
        service.getUserStats('user-1'),
        service.getUserStats('user-2'),
      ]);
      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
    });
  });
});
