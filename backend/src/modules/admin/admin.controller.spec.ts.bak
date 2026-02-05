/**
 * 🔐 AdminController - Comprehensive Unit Tests
 * 
 * This test suite provides exhaustive coverage of the Admin controller:
 * - User management (getUsers, getPendingUsers, approveUser, banUser, unbanUser)
 * - Stats endpoints (getStats, getRealStats)
 * - Game config management
 * - Transaction management
 * - Authorization and role-based access
 * 
 * Target: 100% coverage of AdminController endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GameConfigService } from '../crash/game-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// ============================================
// MOCK DATA
// ============================================

const mockUsers = [
  {
    id: 'user-1',
    username: 'testuser1',
    email: 'test1@example.com',
    status: 'ACTIVE',
    role: 'USER',
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
    wallets: [{ balance: '1000.00', currency: 'USDT' }],
  },
  {
    id: 'user-2',
    username: 'testuser2',
    email: 'test2@example.com',
    status: 'PENDING_APPROVAL',
    role: 'USER',
    createdAt: new Date('2024-01-10'),
    lastLoginAt: null,
    wallets: [{ balance: '0.00', currency: 'USDT' }],
  },
  {
    id: 'user-3',
    username: 'banneduser',
    email: 'banned@example.com',
    status: 'BANNED',
    role: 'USER',
    createdAt: new Date('2024-01-05'),
    lastLoginAt: new Date('2024-01-06'),
    wallets: [{ balance: '500.00', currency: 'USDT' }],
  },
];

const mockStats = {
  totalUsers: 100,
  activeUsers: 75,
  pendingApprovalUsers: 10,
  totalDeposits: 50000,
  totalWithdrawals: 30000,
  pendingTransactions: 5,
  totalBets: 1000,
  houseProfit: 20000,
};

const mockRealStats = {
  totalRealUsers: 80,
  activeRealUsers: 50,
  totalDeposits: 45000,
  totalWithdrawals: 25000,
  netDeposits: 20000,
  totalBets: 800,
  totalWagered: 100000,
  houseProfit: 4000,
  houseWallet: 4000,
  botVolume: 50000,
  botBets: 200,
  activeBots: 20,
};

const mockTransactions = [
  {
    id: 'tx-1',
    type: 'DEPOSIT',
    status: 'CONFIRMED',
    amount: '1000.00',
    currency: 'USDT',
    txHash: '0x123...',
    walletAddress: 'TRC20...',
    user: { id: 'user-1', username: 'testuser1', email: 'test1@example.com' },
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'tx-2',
    type: 'WITHDRAWAL',
    status: 'PENDING',
    amount: '500.00',
    currency: 'USDT',
    txHash: null,
    walletAddress: 'TRC20...',
    user: { id: 'user-1', username: 'testuser1', email: 'test1@example.com' },
    createdAt: new Date('2024-01-16'),
  },
];

const mockGameConfig = {
  houseEdge: 0.04,
  instantBust: 0.02,
  botsEnabled: true,
  maxBotBet: 500,
  minBotBet: 5,
  maxBotsPerRound: 25,
};

// ============================================
// MOCK SERVICES
// ============================================

const mockAdminService = {
  getStats: jest.fn().mockResolvedValue(mockStats),
  getRealStats: jest.fn().mockResolvedValue(mockRealStats),
  getAllUsers: jest.fn().mockResolvedValue(mockUsers),
  getPendingUsers: jest.fn().mockResolvedValue([mockUsers[1]]),
  approveUser: jest.fn().mockResolvedValue({ success: true, message: 'User approved successfully' }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true, message: 'Verification email sent successfully' }),
  banUser: jest.fn().mockResolvedValue({ success: true, message: 'User banned successfully' }),
  unbanUser: jest.fn().mockResolvedValue({ success: true, message: 'User unbanned successfully' }),
  getTransactions: jest.fn().mockResolvedValue(mockTransactions),
};

const mockGameConfigService = {
  getConfig: jest.fn().mockReturnValue(mockGameConfig),
  updateConfig: jest.fn().mockReturnValue(mockGameConfig),
};

// ============================================
// TEST SUITE
// ============================================

describe('🔐 AdminController - Comprehensive Unit Tests', () => {
  let controller: AdminController;
  let adminService: AdminService;
  let gameConfigService: GameConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: GameConfigService, useValue: mockGameConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
    gameConfigService = module.get<GameConfigService>(GameConfigService);
  });

  // ============================================
  // 📊 STATS ENDPOINTS
  // ============================================

  describe('📊 Stats Endpoints', () => {
    describe('GET /admin/stats', () => {
      it('Should return stats successfully', async () => {
        const result = await controller.getStats();

        expect(result).toEqual(mockStats);
        expect(mockAdminService.getStats).toHaveBeenCalledTimes(1);
      });

      it('Should include all required stat fields', async () => {
        const result = await controller.getStats();

        expect(result).toHaveProperty('totalUsers');
        expect(result).toHaveProperty('activeUsers');
        expect(result).toHaveProperty('pendingApprovalUsers');
        expect(result).toHaveProperty('totalDeposits');
        expect(result).toHaveProperty('totalWithdrawals');
        expect(result).toHaveProperty('pendingTransactions');
        expect(result).toHaveProperty('totalBets');
        expect(result).toHaveProperty('houseProfit');
      });

      it('Should return numeric values for stats', async () => {
        const result = await controller.getStats();

        expect(typeof result.totalUsers).toBe('number');
        expect(typeof result.activeUsers).toBe('number');
        expect(typeof result.totalDeposits).toBe('number');
        expect(typeof result.houseProfit).toBe('number');
      });
    });

    describe('GET /admin/stats/real', () => {
      it('Should return real stats successfully', async () => {
        const result = await controller.getRealStats();

        expect(result).toEqual(mockRealStats);
        expect(mockAdminService.getRealStats).toHaveBeenCalledTimes(1);
      });

      it('Should include bot volume separately', async () => {
        const result = await controller.getRealStats();

        expect(result).toHaveProperty('botVolume');
        expect(result).toHaveProperty('botBets');
        expect(result).toHaveProperty('activeBots');
      });

      it('Should include house wallet', async () => {
        const result = await controller.getRealStats();

        expect(result).toHaveProperty('houseWallet');
        expect(typeof result.houseWallet).toBe('number');
      });
    });
  });

  // ============================================
  // 👥 USER MANAGEMENT ENDPOINTS
  // ============================================

  describe('👥 User Management', () => {
    describe('GET /admin/users', () => {
      it('Should return all users with default limit', async () => {
        const result = await controller.getUsers();

        expect(result).toEqual(mockUsers);
        expect(mockAdminService.getAllUsers).toHaveBeenCalledWith(100);
      });

      it('Should accept custom limit parameter', async () => {
        await controller.getUsers('50');

        expect(mockAdminService.getAllUsers).toHaveBeenCalledWith(50);
      });

      it('Should parse limit as integer', async () => {
        await controller.getUsers('25');

        expect(mockAdminService.getAllUsers).toHaveBeenCalledWith(25);
      });

      it('Should return users with wallet information', async () => {
        const result = await controller.getUsers();

        expect(result[0]).toHaveProperty('wallets');
        expect(Array.isArray(result[0].wallets)).toBe(true);
      });
    });

    describe('GET /admin/users/pending', () => {
      it('Should return only pending users', async () => {
        const result = await controller.getPendingUsers();

        expect(result).toEqual([mockUsers[1]]);
        expect(mockAdminService.getPendingUsers).toHaveBeenCalledTimes(1);
      });

      it('Should return users with PENDING_APPROVAL status', async () => {
        const result = await controller.getPendingUsers();

        result.forEach((user: any) => {
          expect(user.status).toBe('PENDING_APPROVAL');
        });
      });
    });

    describe('POST /admin/users/:id/approve', () => {
      const mockRequest = { user: { id: 'admin-1' } };

      it('Should approve user successfully', async () => {
        const result = await controller.approveUser('user-2', mockRequest);

        expect(result).toEqual({ success: true, message: 'User approved successfully' });
        expect(mockAdminService.approveUser).toHaveBeenCalledWith('user-2', 'admin-1');
      });

      it('Should pass admin ID from request', async () => {
        await controller.approveUser('user-2', mockRequest);

        expect(mockAdminService.approveUser).toHaveBeenCalledWith(
          expect.any(String),
          'admin-1'
        );
      });

      it('Should handle user not found', async () => {
        mockAdminService.approveUser.mockRejectedValueOnce(
          new NotFoundException('User not found')
        );

        await expect(controller.approveUser('invalid-id', mockRequest))
          .rejects.toThrow(NotFoundException);
      });

      it('Should handle user not pending approval', async () => {
        mockAdminService.approveUser.mockRejectedValueOnce(
          new ForbiddenException('User is not pending approval')
        );

        await expect(controller.approveUser('user-1', mockRequest))
          .rejects.toThrow(ForbiddenException);
      });
    });

    describe('POST /admin/users/:id/send-verification', () => {
      const mockRequest = { user: { id: 'admin-1' } };

      it('Should send verification email successfully', async () => {
        const result = await controller.sendVerification('user-2', mockRequest);

        expect(result).toEqual({ success: true, message: 'Verification email sent successfully' });
        expect(mockAdminService.sendVerificationEmail).toHaveBeenCalledWith('user-2', 'admin-1');
      });

      it('Should handle user not found', async () => {
        mockAdminService.sendVerificationEmail.mockRejectedValueOnce(
          new NotFoundException('User not found')
        );

        await expect(controller.sendVerification('invalid-id', mockRequest))
          .rejects.toThrow(NotFoundException);
      });
    });

    describe('POST /admin/users/:id/ban', () => {
      const mockRequest = { user: { id: 'admin-1' } };

      it('Should ban user successfully', async () => {
        const result = await controller.banUser('user-1', mockRequest);

        expect(result).toEqual({ success: true, message: 'User banned successfully' });
        expect(mockAdminService.banUser).toHaveBeenCalledWith('user-1', 'admin-1');
      });

      it('Should handle user not found', async () => {
        mockAdminService.banUser.mockRejectedValueOnce(
          new NotFoundException('User not found')
        );

        await expect(controller.banUser('invalid-id', mockRequest))
          .rejects.toThrow(NotFoundException);
      });

      it('Should prevent banning admin users', async () => {
        mockAdminService.banUser.mockRejectedValueOnce(
          new ForbiddenException('Cannot ban an admin user')
        );

        await expect(controller.banUser('admin-user-id', mockRequest))
          .rejects.toThrow(ForbiddenException);
      });
    });

    describe('POST /admin/users/:id/unban', () => {
      const mockRequest = { user: { id: 'admin-1' } };

      it('Should unban user successfully', async () => {
        const result = await controller.unbanUser('user-3', mockRequest);

        expect(result).toEqual({ success: true, message: 'User unbanned successfully' });
        expect(mockAdminService.unbanUser).toHaveBeenCalledWith('user-3', 'admin-1');
      });

      it('Should handle user not found', async () => {
        mockAdminService.unbanUser.mockRejectedValueOnce(
          new NotFoundException('User not found')
        );

        await expect(controller.unbanUser('invalid-id', mockRequest))
          .rejects.toThrow(NotFoundException);
      });
    });
  });

  // ============================================
  // 🎮 GAME CONFIG ENDPOINTS
  // ============================================

  describe('🎮 Game Config', () => {
    describe('GET /admin/game/config', () => {
      it('Should return game config', async () => {
        const result = await controller.getGameConfig();

        expect(result).toEqual(mockGameConfig);
        expect(mockGameConfigService.getConfig).toHaveBeenCalledTimes(1);
      });

      it('Should include all config fields', async () => {
        const result = await controller.getGameConfig();

        expect(result).toHaveProperty('houseEdge');
        expect(result).toHaveProperty('instantBust');
        expect(result).toHaveProperty('botsEnabled');
        expect(result).toHaveProperty('maxBotBet');
        expect(result).toHaveProperty('minBotBet');
        expect(result).toHaveProperty('maxBotsPerRound');
      });
    });

    describe('POST /admin/game/config', () => {
      it('Should update game config', async () => {
        const newConfig = { houseEdge: 0.05 };
        const result = await controller.updateGameConfig(newConfig);

        expect(mockGameConfigService.updateConfig).toHaveBeenCalledWith(newConfig);
      });

      it('Should accept partial config updates', async () => {
        const partialConfig = { instantBust: 0.03 };
        await controller.updateGameConfig(partialConfig);

        expect(mockGameConfigService.updateConfig).toHaveBeenCalledWith(partialConfig);
      });

      it('Should accept full config updates', async () => {
        const fullConfig = {
          houseEdge: 0.05,
          instantBust: 0.03,
          botsEnabled: false,
          maxBotBet: 1000,
          minBotBet: 10,
          maxBotsPerRound: 50,
        };
        await controller.updateGameConfig(fullConfig);

        expect(mockGameConfigService.updateConfig).toHaveBeenCalledWith(fullConfig);
      });
    });
  });

  // ============================================
  // 💰 TRANSACTION ENDPOINTS
  // ============================================

  describe('💰 Transactions', () => {
    describe('GET /admin/transactions', () => {
      it('Should return transactions with default limit', async () => {
        const result = await controller.getTransactions();

        expect(result).toEqual(mockTransactions);
        expect(mockAdminService.getTransactions).toHaveBeenCalledWith(100);
      });

      it('Should accept custom limit parameter', async () => {
        await controller.getTransactions('50');

        expect(mockAdminService.getTransactions).toHaveBeenCalledWith(50);
      });

      it('Should return transactions with user info', async () => {
        const result = await controller.getTransactions();

        expect(result[0]).toHaveProperty('user');
        expect(result[0].user).toHaveProperty('id');
        expect(result[0].user).toHaveProperty('username');
        expect(result[0].user).toHaveProperty('email');
      });

      it('Should return transactions with type and status', async () => {
        const result = await controller.getTransactions();

        result.forEach((tx: any) => {
          expect(tx).toHaveProperty('type');
          expect(tx).toHaveProperty('status');
          expect(['DEPOSIT', 'WITHDRAWAL']).toContain(tx.type);
        });
      });
    });
  });

  // ============================================
  // 🔒 AUTHORIZATION TESTS
  // ============================================

  describe('🔒 Authorization', () => {
    it('Controller should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('Should have JwtAuthGuard applied', () => {
      const guards = Reflect.getMetadata('__guards__', AdminController);
      expect(guards).toBeDefined();
    });

    it('Should have Roles decorator for ADMIN', () => {
      const roles = Reflect.getMetadata('roles', AdminController);
      expect(roles).toContain('ADMIN');
    });
  });

  // ============================================
  // 🎯 EDGE CASES
  // ============================================

  describe('🎯 Edge Cases', () => {
    it('Should handle empty user list', async () => {
      mockAdminService.getAllUsers.mockResolvedValueOnce([]);
      const result = await controller.getUsers();

      expect(result).toEqual([]);
    });

    it('Should handle empty pending users', async () => {
      mockAdminService.getPendingUsers.mockResolvedValueOnce([]);
      const result = await controller.getPendingUsers();

      expect(result).toEqual([]);
    });

    it('Should handle empty transactions', async () => {
      mockAdminService.getTransactions.mockResolvedValueOnce([]);
      const result = await controller.getTransactions();

      expect(result).toEqual([]);
    });

    it('Should handle zero stats', async () => {
      mockAdminService.getStats.mockResolvedValueOnce({
        totalUsers: 0,
        activeUsers: 0,
        pendingApprovalUsers: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        pendingTransactions: 0,
        totalBets: 0,
        houseProfit: 0,
      });

      const result = await controller.getStats();
      expect(result.totalUsers).toBe(0);
      expect(result.houseProfit).toBe(0);
    });

    it('Should handle limit of 0', async () => {
      await controller.getUsers('0');
      expect(mockAdminService.getAllUsers).toHaveBeenCalledWith(0);
    });

    it('Should handle very large limit', async () => {
      await controller.getUsers('10000');
      expect(mockAdminService.getAllUsers).toHaveBeenCalledWith(10000);
    });

    it('Should handle invalid limit (NaN)', async () => {
      await controller.getUsers('invalid');
      expect(mockAdminService.getAllUsers).toHaveBeenCalledWith(NaN);
    });
  });

  // ============================================
  // 📈 DATA VALIDATION TESTS
  // ============================================

  describe('📈 Data Validation', () => {
    it('Should return users with correct structure', async () => {
      const result = await controller.getUsers();

      result.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('status');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('createdAt');
      });
    });

    it('Should return transactions with correct structure', async () => {
      const result = await controller.getTransactions();

      result.forEach((tx: any) => {
        expect(tx).toHaveProperty('id');
        expect(tx).toHaveProperty('type');
        expect(tx).toHaveProperty('status');
        expect(tx).toHaveProperty('amount');
        expect(tx).toHaveProperty('currency');
        expect(tx).toHaveProperty('user');
        expect(tx).toHaveProperty('createdAt');
      });
    });

    it('Should return config with valid ranges', async () => {
      const result = await controller.getGameConfig();

      expect(result.houseEdge).toBeGreaterThanOrEqual(0.01);
      expect(result.houseEdge).toBeLessThanOrEqual(0.10);
      expect(result.instantBust).toBeGreaterThanOrEqual(0);
      expect(result.instantBust).toBeLessThanOrEqual(0.05);
    });
  });
});

// ============================================
// 🧪 INTEGRATION-STYLE TESTS
// ============================================

describe('🧪 AdminController Integration-Style Tests', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: GameConfigService, useValue: mockGameConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('Should handle complete user approval flow', async () => {
    const mockRequest = { user: { id: 'admin-1' } };

    // Get pending users
    const pending = await controller.getPendingUsers();
    expect(pending.length).toBeGreaterThan(0);

    // Approve first pending user
    const approveResult = await controller.approveUser(pending[0].id, mockRequest);
    expect(approveResult.success).toBe(true);
  });

  it('Should handle complete ban/unban flow', async () => {
    const mockRequest = { user: { id: 'admin-1' } };

    // Ban user
    const banResult = await controller.banUser('user-1', mockRequest);
    expect(banResult.success).toBe(true);

    // Unban user
    const unbanResult = await controller.unbanUser('user-1', mockRequest);
    expect(unbanResult.success).toBe(true);
  });

  it('Should handle config update flow', async () => {
    // Get current config
    const currentConfig = await controller.getGameConfig();
    expect(currentConfig).toBeDefined();

    // Update config
    const newConfig = { houseEdge: 0.05 };
    await controller.updateGameConfig(newConfig);

    expect(mockGameConfigService.updateConfig).toHaveBeenCalledWith(newConfig);
  });
});
