import { VipService } from './vip.service';
import { Decimal } from '@prisma/client/runtime/library';

// Mock the vip.config module
jest.mock('../users/vip.config', () => ({
  VIP_TIERS: [
    { level: 0, name: 'Bronze', icon: '🥉', minWager: 0, rakebackRate: 0.05, levelUpBonus: 0, withdrawalLimitDaily: 5000 },
    { level: 1, name: 'Silver', icon: '🥈', minWager: 1000, rakebackRate: 0.07, levelUpBonus: 10, withdrawalLimitDaily: 10000 },
    { level: 2, name: 'Gold', icon: '🥇', minWager: 5000, rakebackRate: 0.10, levelUpBonus: 25, withdrawalLimitDaily: 25000 },
    { level: 3, name: 'Platinum', icon: '💎', minWager: 25000, rakebackRate: 0.12, levelUpBonus: 50, withdrawalLimitDaily: 50000 },
    { level: 4, name: 'Diamond', icon: '💠', minWager: 100000, rakebackRate: 0.15, levelUpBonus: 100, withdrawalLimitDaily: 100000 },
  ],
  calculateVipLevel: (totalWagered: number) => {
    if (totalWagered >= 100000) return 4;
    if (totalWagered >= 25000) return 3;
    if (totalWagered >= 5000) return 2;
    if (totalWagered >= 1000) return 1;
    return 0;
  },
  getRakebackRate: (level: number) => {
    const rates = [0.05, 0.07, 0.10, 0.12, 0.15];
    return rates[level] || 0.05;
  },
  getVipTier: (level: number) => {
    const tiers = [
      { level: 0, name: 'Bronze', rakebackRate: 0.05, withdrawalLimitDaily: 5000 },
      { level: 1, name: 'Silver', rakebackRate: 0.07, withdrawalLimitDaily: 10000 },
      { level: 2, name: 'Gold', rakebackRate: 0.10, withdrawalLimitDaily: 25000 },
      { level: 3, name: 'Platinum', rakebackRate: 0.12, withdrawalLimitDaily: 50000 },
      { level: 4, name: 'Diamond', rakebackRate: 0.15, withdrawalLimitDaily: 100000 },
    ];
    return tiers[level] || tiers[0];
  },
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(),
};

describe('VipService', () => {
  let service: VipService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VipService(mockPrisma as any);
    // Mock $transaction to execute the callback
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(mockPrisma);
      }
      return Promise.all(cb);
    });
  });

  describe('processRakeback', () => {
    it('should calculate rakeback correctly: betAmount × houseEdge × rakebackRate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 0, // Bronze = 5% rakeback
        isBot: false,
      });

      mockPrisma.user.update.mockResolvedValue({});

      await service.processRakeback('user-1', 100, 0.04);

      // Rakeback = 100 × 0.04 × 0.05 = 0.20
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          claimableRakeback: { increment: expect.closeTo(0.20, 4) },
        },
      });
    });

    it('should not process rakeback for bots', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'bot-1',
        vipLevel: 0,
        isBot: true,
      });

      await service.processRakeback('bot-1', 1000, 0.04);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should not process rakeback for non-existent users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.processRakeback('nonexistent', 100, 0.04);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should use higher rakeback rate for higher VIP levels', async () => {
      // Gold level = 10% rakeback
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-gold',
        vipLevel: 2,
        isBot: false,
      });

      mockPrisma.user.update.mockResolvedValue({});

      await service.processRakeback('user-gold', 100, 0.04);

      // Rakeback = 100 × 0.04 × 0.10 = 0.40
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-gold' },
        data: {
          claimableRakeback: { increment: expect.closeTo(0.40, 4) },
        },
      });
    });

    it('should handle zero bet amount', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 0,
        isBot: false,
      });

      await service.processRakeback('user-1', 0, 0.04);

      // 0 × 0.04 × 0.05 = 0, should not update
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(service.processRakeback('user-1', 100, 0.04)).resolves.not.toThrow();
    });
  });

  describe('checkLevelUp', () => {
    it('should detect level-up when threshold is crossed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 0, // Currently Bronze
        totalWagered: 1500, // Above Silver threshold (1000)
        siteId: 'site-1',
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
        balance: 100,
      });
      mockPrisma.wallet.update.mockResolvedValue({});

      const result = await service.checkLevelUp('user-1');

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(1); // Silver
      expect(result.tierName).toBe('Silver');
    });

    it('should not level up when threshold is not crossed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 0,
        totalWagered: 500, // Below Silver threshold (1000)
      });

      const result = await service.checkLevelUp('user-1');

      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(0);
    });

    it('should not level up when already at correct level', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 1, // Already Silver
        totalWagered: 1500, // Still Silver range
      });

      const result = await service.checkLevelUp('user-1');

      expect(result.leveledUp).toBe(false);
    });

    it('should handle multi-level jumps', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-whale',
        vipLevel: 0, // Currently Bronze
        totalWagered: 150000, // Above Diamond threshold (100000)
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.wallet.findFirst.mockResolvedValue({ id: 'w-1', balance: 0 });
      mockPrisma.wallet.update.mockResolvedValue({});

      const result = await service.checkLevelUp('user-whale');

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(4); // Diamond
    });
  });

  describe('claimRakeback', () => {
    it('should transfer claimable rakeback to USDT wallet', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        claimableRakeback: 25.50,
        siteId: "site-1",
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
        currency: 'USDT',
        balance: 100,
      });
      mockPrisma.wallet.update.mockResolvedValue({});

      const result = await service.claimRakeback('user-1', 'site-1');

      expect(result.success).toBe(true);
      expect(result.amount).toBe(25.50);
      expect(result.message).toContain('25.50');
    });

    it('should reject claim when no rakeback available', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        claimableRakeback: new Decimal(0),
      });

      await expect(service.claimRakeback('user-1')).rejects.toThrow('No rakeback available');
    });

    it('should reject claim for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.claimRakeback('nonexistent')).rejects.toThrow('User not found');
    });

    it('should reset claimable rakeback to 0 after claim', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        claimableRakeback: 50,
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.wallet.findFirst.mockResolvedValue({ id: 'w-1', balance: 100 });
      mockPrisma.wallet.update.mockResolvedValue({});

      await service.claimRakeback('user-1');

      // Should reset claimableRakeback in the transaction
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            claimableRakeback: expect.anything(), // Decimal(0)
          }),
        }),
      );
    });

    it('should reject when no USDT wallet found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        claimableRakeback: 50,
      });

      mockPrisma.wallet.findFirst.mockResolvedValue(null);

      await expect(service.claimRakeback('user-1')).rejects.toThrow();
    });
  });

  describe('getVipStatus', () => {
    it('should return complete VIP status for user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 1,
        totalWagered: 2500,
        totalBets: 150,
        claimableRakeback: 12.50,
      });

      const result = await service.getVipStatus('user-1');

      expect(result.level).toBe(1);
      expect(result.tierName).toBe('Silver');
      expect(result.totalWagered).toBe(2500);
      expect(result.totalBets).toBe(150);
      expect(result.claimableRakeback).toBe(12.50);
    });

    it('should include next tier progress information', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 1, // Silver
        totalWagered: 3000,
        totalBets: 200,
        claimableRakeback: new Decimal(0),
      });

      const result = await service.getVipStatus('user-1');

      expect(result.nextTier).toBeDefined();
      expect(result.nextTier.name).toBe('Gold');
      expect(result.nextTier.minWager).toBe(5000);
      expect(result.nextTier.wagerRemaining).toBe(2000); // 5000 - 3000
      expect(result.nextTier.progress).toBe(60); // (3000/5000) * 100
    });

    it('should return null nextTier for max level', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-diamond',
        vipLevel: 4, // Diamond (max)
        totalWagered: 200000,
        totalBets: 5000,
        claimableRakeback: 100,
      });

      const result = await service.getVipStatus('user-diamond');

      expect(result.nextTier).toBeNull();
    });

    it('should throw for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getVipStatus('nonexistent')).rejects.toThrow('User not found');
    });

    it('should include rakeback rate as percentage string', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        vipLevel: 0,
        totalWagered: 0,
        totalBets: 0,
        claimableRakeback: new Decimal(0),
      });

      const result = await service.getVipStatus('user-1');
      expect(result.rakebackRate).toContain('%');
    });
  });
});
