/**
 * ============================================
 * 🏢 SUPER ADMIN SERVICE - UNIT TESTS
 * ============================================
 * White-label core: tenant CRUD, isolation, stats
 * Tests: createTenant, suspendTenant, getTenantStats, data isolation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SuperAdminService } from './super-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';
import { RewardPoolService } from '../reward-pool/reward-pool.service';

// ============================================
// MOCK SETUP
// ============================================

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
}));

const mockPrisma = {
  siteConfiguration: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  user: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  wallet: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
  },
  bet: {
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { betAmount: 0, payout: 0, profit: 0 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  transaction: {
    create: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  fraudAlert: {
    count: jest.fn().mockResolvedValue(0),
  },
  $transaction: jest.fn(),
};

describe('🏢 SuperAdminService - Unit Tests', () => {
  let service: SuperAdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RewardPoolService,
          useValue: {
            contributeToPool: jest.fn().mockResolvedValue(undefined),
            getPoolStatus: jest.fn().mockResolvedValue({ balance: 0 }),
          },
        },
        SuperAdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SuperAdminService>(SuperAdminService);
  });

  // ============================================
  // 🏗️ CREATE TENANT
  // ============================================

  describe('🏗️ createTenant', () => {
    const validTenantData = {
      brandName: 'TestBrand',
      domain: 'testbrand.example.com',
      ownerEmail: 'admin@testbrand.com',
      ownerPassword: 'SecurePass123!',
      ownerUsername: 'testbrand_admin',
      ggrFee: 12,
      allowedGames: ['crash', 'dice', 'mines'],
    };

    it('1.1 - Should create tenant with all required fields', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null); // No existing
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // No existing user

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new', brandName: 'TestBrand' }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'user-new', username: 'testbrand_admin', email: 'admin@testbrand.com', role: 'ADMIN',
    emailVerificationToken: null,
    affiliateCarryover: new Decimal(0),
    totalBets: 0,
    claimableRakeback: new Decimal(0),
    siteId: "default-site",
          }),
        },
        wallet: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      const result = await service.createTenant(validTenantData);
      expect(result.success).toBe(true);
      expect(result.tenant).toBeDefined();
      expect(result.adminCredentials).toBeDefined();
      expect(result.adminCredentials.email).toBe('admin@testbrand.com');
    });

    it('1.2 - Should reject duplicate brand name', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce({
        id: 'existing', brandName: 'TestBrand',
      });

      await expect(service.createTenant(validTenantData))
        .rejects.toThrow(BadRequestException);
    });

    it('1.3 - Should reject duplicate domain', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce({
        id: 'existing', domain: 'testbrand.example.com',
      });

      await expect(service.createTenant(validTenantData))
        .rejects.toThrow(BadRequestException);
    });

    it('1.4 - Should reject duplicate owner email', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'existing-user' });

      await expect(service.createTenant(validTenantData))
        .rejects.toThrow(BadRequestException);
    });

    it('1.5 - Should lowercase domain on creation', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant({ ...validTenantData, domain: 'UPPERCASE.COM' });
      expect(mockTx.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            domain: 'uppercase.com',
          }),
        }),
      );
    });

    it('1.6 - Should lowercase owner email on creation', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'admin@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant({ ...validTenantData, ownerEmail: 'ADMIN@TEST.COM' });
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'admin@test.com',
          }),
        }),
      );
    });

    it('1.7 - Should hash admin password with bcrypt', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant(validTenantData);
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 10);
    });

    it('1.8 - Should create admin with ADMIN role', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant(validTenantData);
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'ADMIN',
            siteId: 'site-new',
          }),
        }),
      );
    });

    it('1.9 - Should create wallet for admin with 0 balance', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant(validTenantData);
      expect(mockTx.wallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: 0,
            lockedBalance: 0,
            currency: 'USDT',
          }),
        }),
      );
    });

    it('1.10 - Should set default house edge config for all games', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant(validTenantData);
      expect(mockTx.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            houseEdgeConfig: expect.objectContaining({
              crash: 0.04,
              dice: 0.04,
              mines: 0.04,
              ggrFee: 12,
            }),
          }),
        }),
      );
    });

    it('1.11 - Should set default colors if not provided', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant(validTenantData);
      expect(mockTx.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            primaryColor: '#00F0FF',
            backgroundColor: '#0A0E17',
          }),
        }),
      );
    });

    it('1.12 - Should use transaction for atomic creation', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockTx = {
        siteConfiguration: {
          create: jest.fn().mockResolvedValue({ id: 'site-new' }),
          update: jest.fn(),
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new', username: 'test', email: 'test@test.com', role: 'ADMIN' }),
        },
        wallet: { create: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn(mockTx));

      await service.createTenant(validTenantData);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================
  // 🔄 TOGGLE TENANT STATUS (SUSPEND/ACTIVATE)
  // ============================================

  describe('🔄 toggleTenantStatus (suspend/activate)', () => {
    it('2.1 - Should toggle active tenant to inactive', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', active: true,
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({
        id: 'site-1', active: false,
      });

      const result = await service.toggleTenantStatus('site-1');
      expect(result.success).toBe(true);
      expect(result.active).toBe(false);
    });

    it('2.2 - Should toggle inactive tenant to active', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', active: false,
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({
        id: 'site-1', active: true,
      });

      const result = await service.toggleTenantStatus('site-1');
      expect(result.success).toBe(true);
      expect(result.active).toBe(true);
    });

    it('2.3 - Should throw NotFoundException for non-existent tenant', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce(null);

      await expect(service.toggleTenantStatus('non-existent'))
        .rejects.toThrow(NotFoundException);
    });

    it('2.4 - Should update active field to opposite value', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', active: true,
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({
        id: 'site-1', active: false,
      });

      await service.toggleTenantStatus('site-1');
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'site-1' },
        data: { active: false },
      });
    });
  });

  // ============================================
  // 📊 GET TENANT STATS
  // ============================================

  describe('📊 getTenantById (stats)', () => {
    it('3.1 - Should return tenant with financial stats', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1',
        brandName: 'TestBrand',
        adminUserId: 'admin-1',
        _count: { users: 50, bets: 1000, transactions: 200 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({
        _sum: { betAmount: 50000, payout: 45000 },
        _count: 1000,
      });
      mockPrisma.user.count.mockResolvedValueOnce(50);
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1', username: 'admin', email: 'admin@test.com', role: 'ADMIN',
      });

      const result = await service.getTenantById('site-1');
      expect(result.stats.totalPlayers).toBe(50);
      expect(result.stats.totalBets).toBe(1000);
      expect(result.stats.totalWagered).toBe(50000);
      expect(result.stats.totalPayout).toBe(45000);
      expect(result.stats.ggr).toBe(5000);
    });

    it('3.2 - Should throw NotFoundException for non-existent tenant', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce(null);

      await expect(service.getTenantById('non-existent'))
        .rejects.toThrow(NotFoundException);
    });

    it('3.3 - Should include owner info when adminUserId exists', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
        _count: { users: 0, bets: 0, transactions: 0 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({ _sum: { betAmount: 0, payout: 0 } });
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1', username: 'admin', email: 'admin@test.com', role: 'ADMIN',
    emailVerificationToken: null,
    affiliateCarryover: new Decimal(0),
    totalBets: 0,
    claimableRakeback: new Decimal(0),
      });

      const result = await service.getTenantById('site-1');
      expect(result.owner).toBeDefined();
      expect(result.owner!.email).toBe('admin@test.com');
    });

    it('3.4 - Should handle null owner gracefully', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
        _count: { users: 0, bets: 0, transactions: 0 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({ _sum: { betAmount: 0, payout: 0 } });
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);

      const result = await service.getTenantById('site-1');
      expect(result.owner).toBeNull();
    });
  });

  // ============================================
  // 🗑️ DELETE TENANT
  // ============================================

  describe('🗑️ deleteTenant', () => {
    it('4.1 - Should delete existing tenant', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({ id: 'site-1' });
      mockPrisma.siteConfiguration.delete.mockResolvedValueOnce({});

      const result = await service.deleteTenant('site-1');
      expect(result.message).toBe('Tenant deleted successfully');
      expect(result.id).toBe('site-1');
    });

    it('4.2 - Should throw NotFoundException for non-existent tenant', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteTenant('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // ✏️ UPDATE TENANT
  // ============================================

  describe('✏️ updateTenant', () => {
    it('5.1 - Should update brand name', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', brandName: 'OldName', houseEdgeConfig: {},
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({
        id: 'site-1', brandName: 'NewName',
      });

      const result = await service.updateTenant('site-1', { brandName: 'NewName' });
      expect(result.success).toBe(true);
    });

    it('5.2 - Should update colors', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', houseEdgeConfig: {},
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({ id: 'site-1' });

      await service.updateTenant('site-1', { primaryColor: '#FF0000' });
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            primaryColor: '#FF0000',
          }),
        }),
      );
    });

    it('5.3 - Should merge houseEdgeConfig when updating ggrFee', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1',
        houseEdgeConfig: { crash: 0.04, ggrFee: 12, allowedGames: ['crash'] },
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({ id: 'site-1' });

      await service.updateTenant('site-1', { ggrFee: 15 });
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            houseEdgeConfig: expect.objectContaining({
              crash: 0.04,
              ggrFee: 15,
            }),
          }),
        }),
      );
    });

    it('5.4 - Should throw NotFoundException for non-existent tenant', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce(null);

      await expect(service.updateTenant('non-existent', { brandName: 'Test' }))
        .rejects.toThrow(NotFoundException);
    });

    it('5.5 - Should only update provided fields', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', houseEdgeConfig: {},
      });
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({ id: 'site-1' });

      await service.updateTenant('site-1', { brandName: 'NewName' });
      const updateCall = mockPrisma.siteConfiguration.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('domain');
      expect(updateCall.data).not.toHaveProperty('primaryColor');
    });
  });

  // ============================================
  // 📊 DASHBOARD STATS
  // ============================================

  describe('📊 getDashboardStats', () => {
    it('6.1 - Should return all dashboard metrics', async () => {
      mockPrisma.siteConfiguration.count
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(3); // active
      mockPrisma.user.count
        .mockResolvedValueOnce(100)  // realPlayerCount
        .mockResolvedValueOnce(10); // botCount
      mockPrisma.bet.aggregate
        .mockResolvedValueOnce({ _sum: { betAmount: 100000, payout: 90000 }, _count: 5000 })  // realBetsAgg
        .mockResolvedValueOnce({ _sum: { betAmount: 20000, payout: 18000 }, _count: 1000 }); // botBetsAgg

      const result = await service.getDashboardStats();
      expect(result.totalBrands).toBe(5);
      expect(result.activeBrands).toBe(3);
      expect(result.inactiveBrands).toBe(2);
      expect(result.totalPlayers).toBe(100);
      expect(result.totalBets).toBe(5000);
      expect(result.totalWagered).toBe(100000);
      expect(result.totalPayout).toBe(90000);
      expect(result.totalGGR).toBe(10000);
    });

    it('6.2 - Should calculate GGR as wagered - payout', async () => {
      mockPrisma.siteConfiguration.count.mockResolvedValue(0);
      mockPrisma.user.count
        .mockResolvedValueOnce(0)   // realPlayerCount
        .mockResolvedValueOnce(0);  // botCount
      mockPrisma.bet.aggregate
        .mockResolvedValueOnce({ _sum: { betAmount: 50000, payout: 48000 }, _count: 100 })  // realBetsAgg
        .mockResolvedValueOnce({ _sum: { betAmount: 0, payout: 0 }, _count: 0 });           // botBetsAgg

      const result = await service.getDashboardStats();
      expect(result.totalGGR).toBe(2000);
    });

    it('6.3 - Should handle null aggregates', async () => {
      mockPrisma.siteConfiguration.count.mockResolvedValue(0);
      mockPrisma.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.bet.aggregate
        .mockResolvedValueOnce({ _sum: { betAmount: null, payout: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { betAmount: null, payout: null }, _count: 0 });

      const result = await service.getDashboardStats();
      expect(result.totalWagered).toBe(0);
      expect(result.totalPayout).toBe(0);
      expect(result.totalGGR).toBe(0);
    });
  });

  // ============================================
  // 👤 ADMIN MANAGEMENT
  // ============================================

  describe('👤 Admin Management', () => {
    it('7.1 - Should create tenant admin', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', brandName: 'TestBrand', adminUserId: null,
      });
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'admin-new', email: 'admin@test.com', username: 'admin',
      });
      mockPrisma.wallet.create.mockResolvedValueOnce({});
      mockPrisma.siteConfiguration.update.mockResolvedValueOnce({});

      const result = await service.createTenantAdmin('site-1', 'admin@test.com', 'pass123', 'admin');
      expect(result.success).toBe(true);
      expect(result.admin.email).toBe('admin@test.com');
    });

    it('7.2 - Should reject if tenant already has admin', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'existing-admin',
      });

      await expect(service.createTenantAdmin('site-1', 'admin@test.com', 'pass', 'admin'))
        .rejects.toThrow('Tenant already has an admin user');
    });

    it('7.3 - Should reset admin password', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
      });
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.resetAdminPassword('site-1', 'newpass123');
      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
    });

    it('7.4 - Should throw if no admin linked for password reset', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
      });

      await expect(service.resetAdminPassword('site-1', 'newpass'))
        .rejects.toThrow(NotFoundException);
    });

    it('7.5 - Should get tenant admin info', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1', email: 'admin@test.com', username: 'admin',
      });
      mockPrisma.wallet.findFirst.mockResolvedValueOnce({
        balance: 500,
      });

      const result = await service.getTenantAdmin('site-1');
      expect(result.hasAdmin).toBe(true);
      expect(result.admin!.balance).toBe(500);
    });

    it('7.6 - Should return hasAdmin=false when no admin', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
      });

      const result = await service.getTenantAdmin('site-1');
      expect(result.hasAdmin).toBe(false);
      expect(result.admin).toBeNull();
    });
  });

  // ============================================
  // 💰 CREDITS MANAGEMENT
  // ============================================

  describe('💰 addCreditsToAdmin', () => {
    it('8.1 - Should add credits to admin wallet', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
      });
      mockPrisma.wallet.findFirst.mockResolvedValueOnce({
        id: 'wallet-1', balance: 100,
      });
      mockPrisma.wallet.update.mockResolvedValueOnce({
        id: 'wallet-1', balance: 600,
      });
      mockPrisma.transaction.create.mockResolvedValueOnce({});

      const result = await service.addCreditsToAdmin('site-1', 500);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(600);
      expect(result.added).toBe(500);
    });

    it('8.2 - Should log transaction for credit addition', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
      });
      mockPrisma.wallet.findFirst.mockResolvedValueOnce({
        id: 'wallet-1', balance: 100,
      });
      mockPrisma.wallet.update.mockResolvedValueOnce({
        id: 'wallet-1', balance: 600,
      });
      mockPrisma.transaction.create.mockResolvedValueOnce({});

      await service.addCreditsToAdmin('site-1', 500, 'Test credit');
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DEPOSIT',
            amount: 500,
            status: 'CONFIRMED',
            metadata: expect.objectContaining({
              source: 'SUPER_ADMIN',
            }),
          }),
        }),
      );
    });

    it('8.3 - Should throw if no admin linked', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
      });

      await expect(service.addCreditsToAdmin('site-1', 500))
        .rejects.toThrow(NotFoundException);
    });

    it('8.4 - Should throw if admin wallet not found', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
      });
      mockPrisma.wallet.findFirst.mockResolvedValueOnce(null);

      await expect(service.addCreditsToAdmin('site-1', 500))
        .rejects.toThrow(NotFoundException);
    });

    it('8.5 - Should handle negative amount (deduction) as WITHDRAWAL', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: 'admin-1',
      });
      mockPrisma.wallet.findFirst.mockResolvedValueOnce({
        id: 'wallet-1', balance: 1000,
      });
      mockPrisma.wallet.update.mockResolvedValueOnce({
        id: 'wallet-1', balance: 500,
      });
      mockPrisma.transaction.create.mockResolvedValueOnce({});

      await service.addCreditsToAdmin('site-1', -500);
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'WITHDRAWAL',
            amount: 500, // abs value
          }),
        }),
      );
    });
  });

  // ============================================
  // 🏠 DATA ISOLATION
  // ============================================

  describe('🏠 Data Isolation Between Tenants', () => {
    it('9.1 - Should query bets only for specific siteId', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
        _count: { users: 0, bets: 0, transactions: 0 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({ _sum: { betAmount: 0, payout: 0 }, _count: 0 });
      mockPrisma.user.count.mockResolvedValueOnce(0);
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);

      await service.getTenantById('site-1');
      expect(mockPrisma.bet.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: 'site-1' }),
        }),
      );
    });

    it('9.2 - Should query users only for specific siteId in tenant count', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
        _count: { users: 10, bets: 0, transactions: 0 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({ _sum: { betAmount: 0, payout: 0 }, _count: 0 });
      mockPrisma.user.count.mockResolvedValueOnce(10);
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);

      const result = await service.getTenantById('site-1');
      expect(result.stats.totalPlayers).toBe(10);
    });

    it('9.3 - Should not leak data between tenants in getAllTenants', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValueOnce([
        { id: 'site-1', brandName: 'Brand1', houseEdgeConfig: { ggrFee: 10 }, _count: { users: 5, bets: 100, transactions: 20 } },
        { id: 'site-2', brandName: 'Brand2', houseEdgeConfig: { ggrFee: 15 }, _count: { users: 10, bets: 200, transactions: 40 } },
      ]);
      mockPrisma.bet.aggregate
        .mockResolvedValueOnce({ _sum: { betAmount: 1000, payout: 900, profit: 100 } })
        .mockResolvedValueOnce({ _sum: { betAmount: 2000, payout: 1800, profit: 200 } });

      const result = await service.getAllTenants();
      expect(result).toHaveLength(2);
      // Each tenant should have its own stats
      expect(result[0].stats.totalWagered).toBe(1000);
      expect(result[1].stats.totalWagered).toBe(2000);
    });
  });

  // ============================================
  // 🔧 EDGE CASES
  // ============================================

  describe('🔧 Edge Cases', () => {
    it('10.1 - Should handle tenant with no bets', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
        _count: { users: 0, bets: 0, transactions: 0 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({ _sum: { betAmount: null, payout: null } });
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);

      const result = await service.getTenantById('site-1');
      expect(result.stats.totalWagered).toBe(0);
      expect(result.stats.ggr).toBe(0);
    });

    it('10.2 - Should handle negative GGR (payout > wagered)', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        id: 'site-1', adminUserId: null,
        _count: { users: 0, bets: 0, transactions: 0 },
      });
      mockPrisma.bet.aggregate.mockResolvedValueOnce({
        _sum: { betAmount: 1000, payout: 1500 },
      });
      mockPrisma.bet.findMany.mockResolvedValueOnce([]);

      const result = await service.getTenantById('site-1');
      expect(result.stats.ggr).toBe(-500);
    });

    it('10.3 - Should default ggrFee to 12 if not in config', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValueOnce([
        { id: 'site-1', houseEdgeConfig: null, _count: { users: 0, bets: 0, transactions: 0 } },
      ]);
      mockPrisma.bet.aggregate.mockResolvedValueOnce({ _sum: { betAmount: 0, payout: 0, profit: 0 } });

      const result = await service.getAllTenants();
      expect(result[0].stats.ggrFee).toBe(12);
    });
  });
});
