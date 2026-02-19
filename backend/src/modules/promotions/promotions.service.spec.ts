import { PromotionsService } from './promotions.service';

const mockPrisma = {
  promotion: {
    findMany: jest.fn(),
  },
};

describe('PromotionsService', () => {
  let service: PromotionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromotionsService(mockPrisma as any);
  });

  describe('getActivePromotions', () => {
    it('should return only active promotions', async () => {
      const mockPromotions = [
        {
          id: 'promo-1',
          title: 'Welcome Bonus',
          description: '100% deposit bonus up to $1000',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: BigInt(1000) as any,
          wagerReq: 30,
          minDeposit: BigInt(10) as any,
          currency: 'USDT',
          imageUrl: '/images/welcome.png',
          active: true,
          startsAt: new Date('2026-01-01'),
          expiresAt: null,
          createdAt: new Date(),
        },
        {
          id: 'promo-2',
          title: 'Weekend Reload',
          description: '50% reload bonus',
          type: 'RELOAD_BONUS',
          bonusPercent: 50,
          maxBonus: BigInt(500) as any,
          wagerReq: 25,
          minDeposit: BigInt(20) as any,
          currency: 'USDT',
          imageUrl: '/images/reload.png',
          active: true,
          startsAt: new Date('2026-02-01'),
          expiresAt: new Date('2026-12-31'),
          createdAt: new Date(),
        },
      ];

      mockPrisma.promotion.findMany.mockResolvedValue(mockPromotions);

      const result = await service.getActivePromotions();

      expect(result).toHaveLength(2);
      expect(mockPrisma.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
          }),
        }),
      );
    });

    it('should filter out expired promotions', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([]);

      await service.getActivePromotions();

      const findManyCall = mockPrisma.promotion.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      // Should include null expiresAt OR expiresAt >= now
      expect(findManyCall.where.OR).toEqual(
        expect.arrayContaining([
          { expiresAt: null },
          { expiresAt: { gte: expect.any(Date) } },
        ]),
      );
    });

    it('should return correct promotion data structure', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([
        {
          id: 'promo-1',
          title: 'Test Promo',
          description: 'Test description',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: BigInt(1000) as any,
          wagerReq: 30,
          minDeposit: BigInt(10) as any,
          currency: 'USDT',
          imageUrl: '/test.png',
          active: true,
          startsAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.getActivePromotions();

      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'promo-1',
          title: 'Test Promo',
          description: 'Test description',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: expect.any(Number),
          wagerReq: 30,
          minDeposit: expect.any(Number),
          currency: 'USDT',
          imageUrl: '/test.png',
        }),
      );
    });

    it('should convert Decimal fields to numbers', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([
        {
          id: 'promo-1',
          title: 'Test',
          description: 'Test',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: { toString: () => '1000.00' } as any,
          wagerReq: 30,
          minDeposit: { toString: () => '10.00' } as any,
          currency: 'USDT',
          imageUrl: null,
          active: true,
          startsAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.getActivePromotions();
      expect(typeof result[0].maxBonus).toBe('number');
      expect(typeof result[0].minDeposit).toBe('number');
    });

    it('should order promotions by createdAt descending', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([]);

      await service.getActivePromotions();

      expect(mockPrisma.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return empty array when no active promotions', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([]);

      const result = await service.getActivePromotions();
      expect(result).toEqual([]);
    });
  });

  describe('getAllPromotions', () => {
    it('should return all promotions including inactive', async () => {
      const mockAll = [
        {
          id: 'promo-1',
          title: 'Active',
          description: 'Active promo',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: BigInt(1000) as any,
          wagerReq: 30,
          minDeposit: BigInt(10) as any,
          currency: 'USDT',
          imageUrl: null,
          active: true,
          startsAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
        },
        {
          id: 'promo-2',
          title: 'Inactive',
          description: 'Inactive promo',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 50,
          maxBonus: BigInt(500) as any,
          wagerReq: 20,
          minDeposit: BigInt(5) as any,
          currency: 'USDT',
          imageUrl: null,
          active: false,
          startsAt: new Date(),
          expiresAt: new Date('2025-12-31'),
          createdAt: new Date(),
        },
      ];

      mockPrisma.promotion.findMany.mockResolvedValue(mockAll);

      const result = await service.getAllPromotions();

      expect(result).toHaveLength(2);
      // Should include the active field in response
      expect(result[0]).toHaveProperty('active');
      expect(result[1]).toHaveProperty('active');
    });

    it('should not filter by active status', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([]);

      await service.getAllPromotions();

      const findManyCall = mockPrisma.promotion.findMany.mock.calls[0][0];
      // Should NOT have active: true filter
      expect(findManyCall.where).toBeDefined();
    });
  });
});
