/**
 * ============================================
 * 🔍 FRAUD DETECTION SERVICE - UNIT TESTS
 * ============================================
 * Security layer: verify fraud detection logic
 * Tests: checkHighWinRate, checkRapidBetting, checkLargeWithdrawals,
 *        checkDepositWithdrawalRatio, alertManagement
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FraudService } from './fraud.service';
import { PrismaService } from '../../prisma/prisma.service';

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  siteConfiguration: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  bet: {
    groupBy: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  transaction: {
    findMany: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  fraudAlert: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    update: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

describe('🔍 FraudService - Unit Tests', () => {
  let service: FraudService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FraudService>(FraudService);
  });

  // ============================================
  // 🎯 CHECK 1: HIGH WIN RATE
  // ============================================

  describe('🎯 checkHighWinRate', () => {
    it('1.1 - Should flag user with >80% win rate over 50+ bets', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 100 },
      ]);
      mockPrisma.bet.count.mockResolvedValueOnce(85); // 85% win rate

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      const alerts = await checkHighWinRate('site-1');
      expect(alerts).toBe(1);
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'HIGH_WIN_RATE',
            userId: 'user-1',
            siteId: 'site-1',
          }),
        }),
      );
    });

    it('1.2 - Should NOT flag user with <80% win rate', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 100 },
      ]);
      mockPrisma.bet.count.mockResolvedValueOnce(70); // 70% win rate

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      const alerts = await checkHighWinRate('site-1');
      expect(alerts).toBe(0);
      expect(mockPrisma.fraudAlert.create).not.toHaveBeenCalled();
    });

    it('1.3 - Should NOT flag user with <50 bets even if high win rate', async () => {
      // groupBy with having clause should filter these out
      mockPrisma.bet.groupBy.mockResolvedValueOnce([]); // No users meet threshold

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      const alerts = await checkHighWinRate('site-1');
      expect(alerts).toBe(0);
    });

    it('1.4 - Should set severity CRITICAL for >90% win rate', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 100 },
      ]);
      mockPrisma.bet.count.mockResolvedValueOnce(95); // 95% win rate

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      await checkHighWinRate('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'CRITICAL',
          }),
        }),
      );
    });

    it('1.5 - Should set severity HIGH for 80-90% win rate', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 100 },
      ]);
      mockPrisma.bet.count.mockResolvedValueOnce(85); // 85% win rate

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      await checkHighWinRate('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'HIGH',
          }),
        }),
      );
    });

    it('1.6 - Should NOT create duplicate alert for same user', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 100 },
      ]);
      mockPrisma.bet.count.mockResolvedValueOnce(90);
      // Existing alert found
      mockPrisma.fraudAlert.findFirst.mockResolvedValueOnce({ id: 'existing-alert' });

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      const alerts = await checkHighWinRate('site-1');
      expect(alerts).toBe(0);
      expect(mockPrisma.fraudAlert.create).not.toHaveBeenCalled();
    });

    it('1.7 - Should include win rate details in alert', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 60 },
      ]);
      mockPrisma.bet.count.mockResolvedValueOnce(50); // 83.3%

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      await checkHighWinRate('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: expect.objectContaining({
              totalBets: 60,
              wins: 50,
              losses: 10,
            }),
          }),
        }),
      );
    });

    it('1.8 - Should flag multiple users in same scan', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 100 },
        { userId: 'user-2', _count: 80 },
      ]);
      mockPrisma.bet.count
        .mockResolvedValueOnce(90)  // user-1: 90%
        .mockResolvedValueOnce(70); // user-2: 87.5%

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      const alerts = await checkHighWinRate('site-1');
      expect(alerts).toBe(2);
    });

    it('1.9 - Should only check non-bot users', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([]);

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      await checkHighWinRate('site-1');
      expect(mockPrisma.bet.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { isBot: false },
          }),
        }),
      );
    });
  });

  // ============================================
  // ⚡ CHECK 2: RAPID BETTING
  // ============================================

  describe('⚡ checkRapidBetting', () => {
    it('2.1 - Should flag user with >100 bets in 1 hour', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 150 },
      ]);

      const checkRapidBetting = (service as any).checkRapidBetting.bind(service);
      const alerts = await checkRapidBetting('site-1');
      expect(alerts).toBe(1);
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'RAPID_BETTING',
            severity: 'MEDIUM',
          }),
        }),
      );
    });

    it('2.2 - Should NOT flag user with <100 bets in 1 hour', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([]); // No users meet threshold

      const checkRapidBetting = (service as any).checkRapidBetting.bind(service);
      const alerts = await checkRapidBetting('site-1');
      expect(alerts).toBe(0);
    });

    it('2.3 - Should include bet count in alert details', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 200 },
      ]);

      const checkRapidBetting = (service as any).checkRapidBetting.bind(service);
      await checkRapidBetting('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: { betsInLastHour: 200 },
          }),
        }),
      );
    });

    it('2.4 - Should NOT create duplicate rapid betting alert within same hour', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([
        { userId: 'user-1', _count: 150 },
      ]);
      mockPrisma.fraudAlert.findFirst.mockResolvedValueOnce({ id: 'existing' });

      const checkRapidBetting = (service as any).checkRapidBetting.bind(service);
      const alerts = await checkRapidBetting('site-1');
      expect(alerts).toBe(0);
    });

    it('2.5 - Should only check bets from last hour', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([]);

      const checkRapidBetting = (service as any).checkRapidBetting.bind(service);
      await checkRapidBetting('site-1');
      expect(mockPrisma.bet.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ============================================
  // 💸 CHECK 3: LARGE WITHDRAWALS
  // ============================================

  describe('💸 checkLargeWithdrawals', () => {
    it('3.1 - Should flag withdrawal >= $5,000', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { userId: 'user-1', amount: 5000, id: 'tx-1' },
      ]);

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      const alerts = await checkLargeWithdrawals('site-1');
      expect(alerts).toBe(1);
    });

    it('3.2 - Should set severity HIGH for withdrawal >= $10,000', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { userId: 'user-1', amount: 15000, id: 'tx-1' },
      ]);

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      await checkLargeWithdrawals('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'HIGH',
            alertType: 'LARGE_WITHDRAWAL',
          }),
        }),
      );
    });

    it('3.3 - Should set severity MEDIUM for $5,000-$9,999', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { userId: 'user-1', amount: 7500, id: 'tx-1' },
      ]);

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      await checkLargeWithdrawals('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'MEDIUM',
          }),
        }),
      );
    });

    it('3.4 - Should NOT flag withdrawal < $5,000', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]); // No large withdrawals

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      const alerts = await checkLargeWithdrawals('site-1');
      expect(alerts).toBe(0);
    });

    it('3.5 - Should include amount and transaction ID in details', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { userId: 'user-1', amount: 8000, id: 'tx-123' },
      ]);

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      await checkLargeWithdrawals('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: { amount: 8000, transactionId: 'tx-123' },
          }),
        }),
      );
    });

    it('3.6 - Should only check withdrawals from last 24 hours', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      await checkLargeWithdrawals('site-1');
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'WITHDRAWAL',
            amount: { gte: 5000 },
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('3.7 - Should NOT create duplicate alert for same transaction', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { userId: 'user-1', amount: 6000, id: 'tx-1' },
      ]);
      mockPrisma.fraudAlert.findFirst.mockResolvedValueOnce({ id: 'existing' });

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      const alerts = await checkLargeWithdrawals('site-1');
      expect(alerts).toBe(0);
    });
  });

  // ============================================
  // 📊 CHECK 4: DEPOSIT-TO-WITHDRAWAL RATIO
  // ============================================

  describe('📊 checkDepositWithdrawalRatio', () => {
    it('4.1 - Should flag user with withdrawal/deposit ratio > 3x', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })   // deposits
        .mockResolvedValueOnce({ _sum: { amount: 500 } });  // withdrawals (5x ratio)

      const checkRatio = (service as any).checkDepositWithdrawalRatio.bind(service);
      const alerts = await checkRatio('site-1');
      expect(alerts).toBe(1);
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'SUSPICIOUS_RATIO',
            severity: 'HIGH',
          }),
        }),
      );
    });

    it('4.2 - Should NOT flag user with ratio <= 3x', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })   // deposits
        .mockResolvedValueOnce({ _sum: { amount: 200 } });  // withdrawals (2x ratio)

      const checkRatio = (service as any).checkDepositWithdrawalRatio.bind(service);
      const alerts = await checkRatio('site-1');
      expect(alerts).toBe(0);
    });

    it('4.3 - Should NOT flag user with zero deposits', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })    // no deposits
        .mockResolvedValueOnce({ _sum: { amount: 500 } }); // withdrawals

      const checkRatio = (service as any).checkDepositWithdrawalRatio.bind(service);
      const alerts = await checkRatio('site-1');
      expect(alerts).toBe(0);
    });

    it('4.4 - Should include ratio details in alert', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 400 } });

      const checkRatio = (service as any).checkDepositWithdrawalRatio.bind(service);
      await checkRatio('site-1');
      expect(mockPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: expect.objectContaining({
              totalDeposits: 100,
              totalWithdrawals: 400,
              ratio: '4.00',
            }),
          }),
        }),
      );
    });

    it('4.5 - Should handle null amounts gracefully', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const checkRatio = (service as any).checkDepositWithdrawalRatio.bind(service);
      const alerts = await checkRatio('site-1');
      expect(alerts).toBe(0);
    });
  });

  // ============================================
  // 🔄 SCAN ALL BRANDS
  // ============================================

  describe('🔄 scanAllBrands', () => {
    it('5.1 - Should scan all active sites', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValueOnce([
        { id: 'site-1', brandName: 'Brand1' },
        { id: 'site-2', brandName: 'Brand2' },
      ]);
      // Mock scanBrand to return 0 alerts
      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.scanAllBrands();
      expect(result.scanned).toBe(2);
    });

    it('5.2 - Should return total alert count across all brands', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValueOnce([
        { id: 'site-1', brandName: 'Brand1' },
      ]);
      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.scanAllBrands();
      expect(result).toHaveProperty('newAlerts');
      expect(typeof result.newAlerts).toBe('number');
    });

    it('5.3 - Should handle empty site list', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValueOnce([]);

      const result = await service.scanAllBrands();
      expect(result.scanned).toBe(0);
      expect(result.newAlerts).toBe(0);
    });
  });

  // ============================================
  // 📋 ALERT MANAGEMENT
  // ============================================

  describe('📋 Alert Management', () => {
    it('6.1 - Should get alerts for specific site', async () => {
      mockPrisma.fraudAlert.findMany.mockResolvedValueOnce([
        { id: 'alert-1', alertType: 'HIGH_WIN_RATE' },
      ]);
      mockPrisma.fraudAlert.groupBy.mockResolvedValueOnce([
        { severity: 'HIGH', _count: 1 },
      ]);

      const result = await service.getAlerts('site-1');
      expect(result.alerts).toHaveLength(1);
      expect(result.stats.total).toBe(1);
    });

    it('6.2 - Should filter alerts by status', async () => {
      mockPrisma.fraudAlert.findMany.mockResolvedValueOnce([]);
      mockPrisma.fraudAlert.groupBy.mockResolvedValueOnce([]);

      await service.getAlerts('site-1', 'OPEN');
      expect(mockPrisma.fraudAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OPEN',
          }),
        }),
      );
    });

    it('6.3 - Should respect limit parameter', async () => {
      mockPrisma.fraudAlert.findMany.mockResolvedValueOnce([]);
      mockPrisma.fraudAlert.groupBy.mockResolvedValueOnce([]);

      await service.getAlerts('site-1', undefined, 10);
      expect(mockPrisma.fraudAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('6.4 - Should default limit to 50', async () => {
      mockPrisma.fraudAlert.findMany.mockResolvedValueOnce([]);
      mockPrisma.fraudAlert.groupBy.mockResolvedValueOnce([]);

      await service.getAlerts('site-1');
      expect(mockPrisma.fraudAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it('6.5 - Should update alert status', async () => {
      await service.updateAlertStatus('alert-1', 'REVIEWED', 'admin@test.com');
      expect(mockPrisma.fraudAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: {
          status: 'REVIEWED',
          reviewedBy: 'admin@test.com',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('6.6 - Should get fraud summary', async () => {
      mockPrisma.fraudAlert.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5); // open
      mockPrisma.fraudAlert.groupBy
        .mockResolvedValueOnce([{ alertType: 'HIGH_WIN_RATE', _count: 3 }])
        .mockResolvedValueOnce([{ severity: 'HIGH', _count: 4 }]);

      const result = await service.getFraudSummary('site-1');
      expect(result.total).toBe(10);
      expect(result.open).toBe(5);
      expect(result.byType).toHaveProperty('HIGH_WIN_RATE');
      expect(result.bySeverity).toHaveProperty('HIGH');
    });

    it('6.7 - Should get fraud summary for ALL sites', async () => {
      mockPrisma.fraudAlert.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(8);
      mockPrisma.fraudAlert.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getFraudSummary('ALL');
      expect(result.total).toBe(20);
    });

    it('6.8 - Should get alerts for ALL sites', async () => {
      mockPrisma.fraudAlert.findMany.mockResolvedValueOnce([]);
      mockPrisma.fraudAlert.groupBy.mockResolvedValueOnce([]);

      await service.getAlerts('ALL');
      // When siteId is 'ALL', should not filter by siteId
      expect(mockPrisma.fraudAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            siteId: 'ALL',
          }),
        }),
      );
    });
  });

  // ============================================
  // 🛡️ SECURITY EDGE CASES
  // ============================================

  describe('🛡️ Security Edge Cases', () => {
    it('7.1 - Should only scan non-bot users for win rate', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([]);

      const checkHighWinRate = (service as any).checkHighWinRate.bind(service);
      await checkHighWinRate('site-1');
      expect(mockPrisma.bet.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { isBot: false },
          }),
        }),
      );
    });

    it('7.2 - Should only check non-bot users for rapid betting', async () => {
      mockPrisma.bet.groupBy.mockResolvedValueOnce([]);

      const checkRapidBetting = (service as any).checkRapidBetting.bind(service);
      await checkRapidBetting('site-1');
      expect(mockPrisma.bet.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { isBot: false },
          }),
        }),
      );
    });

    it('7.3 - Should only check non-bot users for large withdrawals', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);

      const checkLargeWithdrawals = (service as any).checkLargeWithdrawals.bind(service);
      await checkLargeWithdrawals('site-1');
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { isBot: false },
          }),
        }),
      );
    });

    it('7.4 - Should only check non-bot users for deposit ratio', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const checkRatio = (service as any).checkDepositWithdrawalRatio.bind(service);
      await checkRatio('site-1');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isBot: false,
          }),
        }),
      );
    });

    it('7.5 - Should order alerts by creation date descending', async () => {
      mockPrisma.fraudAlert.findMany.mockResolvedValueOnce([]);
      mockPrisma.fraudAlert.groupBy.mockResolvedValueOnce([]);

      await service.getAlerts('site-1');
      expect(mockPrisma.fraudAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
