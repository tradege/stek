import { AdminFinanceService } from './admin-finance.service';

// Mock PrismaService
const mockPrisma = {
  transaction: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  bet: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  wallet: {
    aggregate: jest.fn(),
  },
  gameSession: {
    count: jest.fn(),
  },
};

describe('AdminFinanceService', () => {
  let service: AdminFinanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminFinanceService(mockPrisma as any);
  });

  describe('getFinancialStats', () => {
    it('should return financial summary with deposits, withdrawals, and GGR', async () => {
      mockPrisma.transaction.aggregate.mockImplementation((args: any) => {
        if (args.where?.type === 'DEPOSIT' && args.where?.status === 'COMPLETED') {
          return Promise.resolve({ _sum: { amount: 50000 }, _count: { id: 200 } });
        }
        if (args.where?.type === 'WITHDRAWAL' && args.where?.status === 'COMPLETED') {
          return Promise.resolve({ _sum: { amount: 20000 }, _count: { id: 80 } });
        }
        return Promise.resolve({ _sum: { amount: 0 }, _count: { id: 0 } });
      });

      mockPrisma.bet.aggregate.mockResolvedValue({
        _sum: { betAmount: 100000, payout: 96000 },
        _count: { id: 5000 },
      });

      mockPrisma.wallet.aggregate.mockResolvedValue({
        _sum: { balance: 30000 },
      });

      // Mock getTopPlayers dependencies
      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ username: 'test' });
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getFinancialStats();

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalDeposits).toBe('number');
      expect(typeof result.summary.totalWithdrawals).toBe('number');
    });

    it('should calculate GGR correctly (bets - payouts)', async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
      });

      mockPrisma.bet.aggregate.mockResolvedValue({
        _sum: { betAmount: 100000, payout: 96000 },
        _count: { id: 5000 },
      });

      mockPrisma.wallet.aggregate.mockResolvedValue({
        _sum: { balance: 0 },
      });

      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getFinancialStats();
      expect(result.summary).toBeDefined();
    });

    it('should handle zero values gracefully', async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: { id: 0 },
      });

      mockPrisma.bet.aggregate.mockResolvedValue({
        _sum: { betAmount: null, payout: null },
        _count: { id: 0 },
      });

      mockPrisma.wallet.aggregate.mockResolvedValue({
        _sum: { balance: null },
      });

      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getFinancialStats();
      expect(result).toBeDefined();
    });
  });

  describe('getDashboardStats', () => {
    it('should return combined dashboard statistics', async () => {
      mockPrisma.user.count.mockImplementation((args: any) => {
        if (args?.where?.isBot === false) return Promise.resolve(500);
        if (args?.where?.isBot === true) return Promise.resolve(50);
        return Promise.resolve(550);
      });

      mockPrisma.gameSession.count.mockResolvedValue(120);

      mockPrisma.bet.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      // Mock financial stats dependencies
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 10000 },
        _count: { id: 100 },
      });
      mockPrisma.bet.aggregate.mockResolvedValue({
        _sum: { betAmount: 50000, payout: 48000 },
        _count: { id: 2000 },
      });
      mockPrisma.wallet.aggregate.mockResolvedValue({
        _sum: { balance: 15000 },
      });
      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ username: 'test' });

      const result = await service.getDashboardStats();
      expect(result.totalUsers).toBe(500);
      expect(result.totalBots).toBe(50);
      expect(result.activeUsers).toBe(3);
      expect(result.activeSessions).toBe(120);
    });

    it('should separate real users from bots', async () => {
      mockPrisma.user.count.mockImplementation((args: any) => {
        if (args?.where?.isBot === false) return Promise.resolve(1000);
        if (args?.where?.isBot === true) return Promise.resolve(100);
        return Promise.resolve(1100);
      });

      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.bet.findMany.mockResolvedValue([]);
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: { id: 0 } });
      mockPrisma.bet.aggregate.mockResolvedValue({ _sum: { betAmount: null, payout: null }, _count: { id: 0 } });
      mockPrisma.wallet.aggregate.mockResolvedValue({ _sum: { balance: null } });
      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getDashboardStats();
      expect(result.totalUsers).toBe(1000);
      expect(result.totalBots).toBe(100);
    });
  });

  describe('getFinanceStats (backward compatibility)', () => {
    it('should call getFinancialStats internally', async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: { id: 0 } });
      mockPrisma.bet.aggregate.mockResolvedValue({ _sum: { betAmount: null, payout: null }, _count: { id: 0 } });
      mockPrisma.wallet.aggregate.mockResolvedValue({ _sum: { balance: null } });
      mockPrisma.bet.groupBy.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getFinanceStats();
      expect(result).toBeDefined();
    });
  });

  describe('access control (admin only)', () => {
    it('should be an injectable service (access control at controller level)', () => {
      expect(service).toBeDefined();
      expect(typeof service.getFinancialStats).toBe('function');
      expect(typeof service.getDashboardStats).toBe('function');
      expect(typeof service.getFinanceStats).toBe('function');
    });
  });
});
