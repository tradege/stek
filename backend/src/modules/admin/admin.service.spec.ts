import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    status: UserStatus.PENDING_APPROVAL,
    role: 'USER',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-123',
    role: 'ADMIN',
    status: UserStatus.ACTIVE,
  };

  const mockPrismaService = {
    user: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    bet: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('📊 getStats', () => {
    it('1.1 - Should return dashboard statistics', async () => {
      jest.spyOn(prisma.user, 'count')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(90)
        .mockResolvedValueOnce(5);
      jest.spyOn(prisma.transaction, 'count').mockResolvedValue(3);
      (prisma.transaction as any).groupBy = jest.fn().mockResolvedValue([
        { type: 'DEPOSIT', _sum: { amount: new Decimal(50000) } },
        { type: 'WITHDRAWAL', _sum: { amount: new Decimal(20000) } },
      ]);
      (prisma.bet as any).aggregate = jest.fn().mockResolvedValue({
        _sum: { betAmount: new Decimal(100000), payout: new Decimal(70000), profit: new Decimal(-30000) },
        _count: 1000,
      });
      (prisma.bet as any).groupBy = jest.fn().mockResolvedValue([
        { userId: 'user-1' }, { userId: 'user-2' },
      ]);

      const result = await service.getStats();

      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(90);
      expect(result.pendingApprovalUsers).toBe(5);
      expect(result.totalGGR).toBe(30000);
      expect(result.houseProfit).toBe(30000);
      expect(result.totalBets).toBe(1000);
      expect(result.activeUsersLast24h).toBe(2);
      expect(result.stats.wagered).toBe(100000);
      expect(result.stats.payouts).toBe(70000);
    });

    it('1.2 - Should handle zero values', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.transaction, 'count').mockResolvedValue(0);
      (prisma.transaction as any).groupBy = jest.fn().mockResolvedValue([]);
      (prisma.bet as any).aggregate = jest.fn().mockResolvedValue({
        _sum: { betAmount: null, payout: null, profit: null },
        _count: 0,
      });
      (prisma.bet as any).groupBy = jest.fn().mockResolvedValue([]);

      const result = await service.getStats();
      expect(result.totalDeposits).toBe(0);
      expect(result.totalWithdrawals).toBe(0);
      expect(result.totalGGR).toBe(0);
      expect(result.totalBets).toBe(0);
    });
  });

  describe('✅ approveUser', () => {
    it('4.1 - Should approve pending user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE } as any);

      const result = await service.approveUser('user-123', 'admin-123');

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('4.2 - Should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.approveUser('non-existent', 'admin-123')).rejects.toThrow(NotFoundException);
    });

    it('4.3 - Should throw ForbiddenException for already active user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE } as any);
      await expect(service.approveUser('user-123', 'admin-123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('🚫 banUser', () => {
    it('6.1 - Should ban user successfully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE } as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({ ...mockUser, status: UserStatus.BANNED } as any);

      const result = await service.banUser('user-123', 'admin-123');

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { status: UserStatus.BANNED },
      });
    });

    it('6.2 - Should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.banUser('non-existent', 'admin-123')).rejects.toThrow(NotFoundException);
    });

    it('6.3 - Should throw ForbiddenException when banning admin', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminUser as any);
      await expect(service.banUser('admin-123', 'admin-456')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('🔓 unbanUser', () => {
    it('7.1 - Should unban user successfully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...mockUser, status: UserStatus.BANNED } as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE } as any);

      const result = await service.unbanUser('user-123', 'admin-123');

      expect(result.success).toBe(true);
    });

    it('7.2 - Should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.unbanUser('non-existent', 'admin-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('👥 getAllUsers', () => {
    it('2.1 - Should return users with wallets', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([{
        ...mockUser,
        wallets: [{ balance: new Decimal(100), currency: 'USDT' }],
      }] as any);

      const result = await service.getAllUsers();
      expect(result).toHaveLength(1);
      expect(result[0].wallets[0].balance).toBe('100');
    });

    it('2.2 - Should respect limit parameter', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
      await service.getAllUsers(50);
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });
  });

  describe('⏳ getPendingUsers', () => {
    it('3.1 - Should return only pending users', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockUser] as any);
      const result = await service.getPendingUsers();
      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: 'PENDING_APPROVAL' },
      }));
    });
  });

  describe('📧 sendVerificationEmail', () => {
    it('5.1 - Should send verification email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({} as any);

      const result = await service.sendVerificationEmail('user-123', 'admin-123');
      expect(result.success).toBe(true);
    });

    it('5.2 - Should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.sendVerificationEmail('non-existent', 'admin-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('💳 getTransactions', () => {
    it('8.1 - Should return transactions', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([{
        id: 'tx-123',
        type: 'DEPOSIT',
        status: 'CONFIRMED',
        amount: new Decimal(100),
        externalRef: 'TX123',
        metadata: { walletAddress: 'TRX123' },
        createdAt: new Date(),
        user: { id: 'user-123', username: 'testuser', email: 'test@example.com' },
        wallet: { currency: 'USDT' },
      }] as any);

      const result = await service.getTransactions();
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe('100');
    });
  });
});
