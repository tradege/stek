/**
 * 💰 CashierController - Comprehensive Unit Tests
 * 
 * This test suite provides exhaustive coverage of the Cashier controller:
 * - Wallet balance endpoints
 * - Deposit functionality (valid/invalid currency, amount validation)
 * - Withdrawal functionality (insufficient funds, validation)
 * - Transaction history
 * - Admin transaction management
 * - Deposit address generation
 * 
 * Target: 100% coverage of CashierController endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CashierController, AdminCashierController } from './cashier.controller';
import { CashierService } from './cashier.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// ============================================
// MOCK DATA
// ============================================

const mockBalances = [
  { currency: 'USDT', balance: '1000.00', address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' },
  { currency: 'BTC', balance: '0.05', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { currency: 'ETH', balance: '0.5', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE2a' },
];

const mockTransactions = [
  {
    id: 'tx-1',
    type: 'DEPOSIT',
    status: 'CONFIRMED',
    amount: '1000.00',
    currency: 'USDT',
    txHash: '0x123abc...',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'tx-2',
    type: 'WITHDRAWAL',
    status: 'PENDING',
    amount: '500.00',
    currency: 'USDT',
    walletAddress: 'TRC20...',
    createdAt: new Date('2024-01-16'),
  },
];

const mockDepositResult = {
  success: true,
  transactionId: 'tx-new-1',
  message: 'Deposit request submitted',
  status: 'PENDING',
};

const mockWithdrawResult = {
  success: true,
  transactionId: 'tx-new-2',
  message: 'Withdrawal request submitted',
  status: 'PENDING',
};

const mockPendingTransactions = [
  {
    id: 'tx-pending-1',
    type: 'DEPOSIT',
    status: 'PENDING',
    amount: '500.00',
    currency: 'USDT',
    user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
    createdAt: new Date('2024-01-17'),
  },
];

// ============================================
// MOCK SERVICES
// ============================================

const mockCashierService = {
  getUserBalances: jest.fn().mockResolvedValue(mockBalances),
  getUserTransactions: jest.fn().mockResolvedValue(mockTransactions),
  createDepositRequest: jest.fn().mockResolvedValue(mockDepositResult),
  createWithdrawRequest: jest.fn().mockResolvedValue(mockWithdrawResult),
  getPendingTransactions: jest.fn().mockResolvedValue(mockPendingTransactions),
  getAllTransactions: jest.fn().mockResolvedValue(mockTransactions),
  processTransaction: jest.fn().mockResolvedValue({ success: true, message: 'Transaction approved' }),
  simulateDeposit: jest.fn().mockResolvedValue({ success: true, message: 'Deposit simulated', newBalance: '1500.00' }),
};

// ============================================
// CASHIER CONTROLLER TESTS
// ============================================

describe('💰 CashierController - Comprehensive Unit Tests', () => {
  let controller: CashierController;
  let cashierService: CashierService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashierController],
      providers: [
        { provide: CashierService, useValue: mockCashierService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CashierController>(CashierController);
    cashierService = module.get<CashierService>(CashierService);
  });

  // ============================================
  // 💵 BALANCE ENDPOINTS
  // ============================================

  describe('💵 Balance Endpoints', () => {
    describe('GET /wallet/balance', () => {
      it('Should return user balances', async () => {
        const mockRequest = { user: { id: 'user-1' } };
        const result = await controller.getBalance(mockRequest);

        expect(result).toEqual(mockBalances);
        expect(mockCashierService.getUserBalances).toHaveBeenCalledWith('user-1');
      });

      it('Should return balances for all currencies', async () => {
        const mockRequest = { user: { id: 'user-1' } };
        const result = await controller.getBalance(mockRequest);

        expect(result.length).toBe(3);
        expect(result.map((b: any) => b.currency)).toContain('USDT');
        expect(result.map((b: any) => b.currency)).toContain('BTC');
        expect(result.map((b: any) => b.currency)).toContain('ETH');
      });

      it('Should include wallet addresses', async () => {
        const mockRequest = { user: { id: 'user-1' } };
        const result = await controller.getBalance(mockRequest);

        result.forEach((balance: any) => {
          expect(balance).toHaveProperty('address');
          expect(balance.address.length).toBeGreaterThan(10);
        });
      });
    });
  });

  // ============================================
  // 📜 TRANSACTION HISTORY
  // ============================================

  describe('📜 Transaction History', () => {
    describe('GET /wallet/transactions', () => {
      it('Should return user transactions', async () => {
        const mockRequest = { user: { id: 'user-1' } };
        const result = await controller.getTransactions(mockRequest);

        expect(result).toEqual(mockTransactions);
        expect(mockCashierService.getUserTransactions).toHaveBeenCalledWith('user-1');
      });

      it('Should return transactions with correct structure', async () => {
        const mockRequest = { user: { id: 'user-1' } };
        const result = await controller.getTransactions(mockRequest);

        result.forEach((tx: any) => {
          expect(tx).toHaveProperty('id');
          expect(tx).toHaveProperty('type');
          expect(tx).toHaveProperty('status');
          expect(tx).toHaveProperty('amount');
          expect(tx).toHaveProperty('currency');
          expect(tx).toHaveProperty('createdAt');
        });
      });
    });
  });

  // ============================================
  // 💳 DEPOSIT ENDPOINTS
  // ============================================

  describe('💳 Deposit Endpoints', () => {
    describe('POST /wallet/deposit', () => {
      const mockRequest = { user: { id: 'user-1' } };

      it('Should create deposit request with valid data', async () => {
        const dto = { amount: 100, currency: 'USDT', txHash: '0x1234567890abcdef' };
        const result = await controller.deposit(mockRequest, dto);

        expect(result).toEqual(mockDepositResult);
        expect(mockCashierService.createDepositRequest).toHaveBeenCalledWith(
          'user-1',
          100,
          'USDT',
          '0x1234567890abcdef'
        );
      });

      it('Should accept all supported currencies', async () => {
        const currencies = ['USDT', 'BTC', 'ETH', 'SOL'];
        
        for (const currency of currencies) {
          const dto = { amount: 100, currency, txHash: '0x1234567890abcdef' };
          await controller.deposit(mockRequest, dto);
          
          expect(mockCashierService.createDepositRequest).toHaveBeenCalledWith(
            'user-1',
            100,
            currency.toUpperCase(),
            expect.any(String)
          );
        }
      });

      it('Should convert currency to uppercase', async () => {
        const dto = { amount: 100, currency: 'usdt', txHash: '0x1234567890abcdef' };
        await controller.deposit(mockRequest, dto);

        expect(mockCashierService.createDepositRequest).toHaveBeenCalledWith(
          'user-1',
          100,
          'USDT',
          expect.any(String)
        );
      });

      it('Should reject invalid amount (0)', async () => {
        const dto = { amount: 0, currency: 'USDT', txHash: '0x1234567890abcdef' };

        await expect(controller.deposit(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject negative amount', async () => {
        const dto = { amount: -100, currency: 'USDT', txHash: '0x1234567890abcdef' };

        await expect(controller.deposit(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject invalid transaction hash (too short)', async () => {
        const dto = { amount: 100, currency: 'USDT', txHash: 'short' };

        await expect(controller.deposit(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject unsupported currency', async () => {
        const dto = { amount: 100, currency: 'DOGE', txHash: '0x1234567890abcdef' };

        await expect(controller.deposit(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject missing currency', async () => {
        const dto = { amount: 100, currency: '', txHash: '0x1234567890abcdef' };

        await expect(controller.deposit(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });
    });

    describe('GET /wallet/deposit-address/:currency', () => {
      it('Should return USDT deposit address', async () => {
        const result = await controller.getDepositAddress('USDT');

        expect(result).toHaveProperty('currency', 'USDT');
        expect(result).toHaveProperty('address');
        expect(result).toHaveProperty('network', 'TRC20');
        expect(result).toHaveProperty('minDeposit', 10);
      });

      it('Should return BTC deposit address', async () => {
        const result = await controller.getDepositAddress('BTC');

        expect(result).toHaveProperty('currency', 'BTC');
        expect(result).toHaveProperty('network', 'Bitcoin');
        expect(result).toHaveProperty('minDeposit', 0.0001);
      });

      it('Should return ETH deposit address', async () => {
        const result = await controller.getDepositAddress('ETH');

        expect(result).toHaveProperty('currency', 'ETH');
        expect(result).toHaveProperty('network', 'ERC20');
        expect(result).toHaveProperty('minDeposit', 0.005);
      });

      it('Should return SOL deposit address', async () => {
        const result = await controller.getDepositAddress('SOL');

        expect(result).toHaveProperty('currency', 'SOL');
        expect(result).toHaveProperty('network', 'Solana');
        expect(result).toHaveProperty('minDeposit', 0.1);
      });

      it('Should handle lowercase currency', async () => {
        const result = await controller.getDepositAddress('usdt');

        expect(result.currency).toBe('USDT');
      });

      it('Should reject unsupported currency', async () => {
        await expect(controller.getDepositAddress('DOGE'))
          .rejects.toThrow(BadRequestException);
      });
    });
  });

  // ============================================
  // 💸 WITHDRAWAL ENDPOINTS
  // ============================================

  describe('💸 Withdrawal Endpoints', () => {
    describe('POST /wallet/withdraw', () => {
      const mockRequest = { user: { id: 'user-1' } };

      it('Should create withdrawal request with valid data', async () => {
        const dto = { amount: 100, currency: 'USDT', walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' };
        const result = await controller.withdraw(mockRequest, dto);

        expect(result).toEqual(mockWithdrawResult);
        expect(mockCashierService.createWithdrawRequest).toHaveBeenCalledWith(
          'user-1',
          100,
          'USDT',
          'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7'
        );
      });

      it('Should accept all supported currencies', async () => {
        const currencies = ['USDT', 'BTC', 'ETH', 'SOL'];
        
        for (const currency of currencies) {
          const dto = { amount: 100, currency, walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' };
          await controller.withdraw(mockRequest, dto);
          
          expect(mockCashierService.createWithdrawRequest).toHaveBeenCalledWith(
            'user-1',
            100,
            currency.toUpperCase(),
            expect.any(String)
          );
        }
      });

      it('Should reject invalid amount (0)', async () => {
        const dto = { amount: 0, currency: 'USDT', walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' };

        await expect(controller.withdraw(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject negative amount', async () => {
        const dto = { amount: -100, currency: 'USDT', walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' };

        await expect(controller.withdraw(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject invalid wallet address (too short)', async () => {
        const dto = { amount: 100, currency: 'USDT', walletAddress: 'short' };

        await expect(controller.withdraw(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject unsupported currency', async () => {
        const dto = { amount: 100, currency: 'DOGE', walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' };

        await expect(controller.withdraw(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should handle insufficient funds error', async () => {
        mockCashierService.createWithdrawRequest.mockRejectedValueOnce(
          new BadRequestException('Insufficient funds')
        );

        const dto = { amount: 1000000, currency: 'USDT', walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' };

        await expect(controller.withdraw(mockRequest, dto))
          .rejects.toThrow(BadRequestException);
      });
    });
  });
});

// ============================================
// ADMIN CASHIER CONTROLLER TESTS
// ============================================

describe('🔐 AdminCashierController - Comprehensive Unit Tests', () => {
  let controller: AdminCashierController;
  let cashierService: CashierService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCashierController],
      providers: [
        { provide: CashierService, useValue: mockCashierService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminCashierController>(AdminCashierController);
    cashierService = module.get<CashierService>(CashierService);
  });

  // ============================================
  // 📋 PENDING TRANSACTIONS
  // ============================================

  describe('📋 Pending Transactions', () => {
    describe('GET /admin/transactions/pending', () => {
      it('Should return pending transactions for admin', async () => {
        const mockRequest = { user: { id: 'admin-1', role: 'ADMIN' } };
        const result = await controller.getPendingTransactions(mockRequest);

        expect(result).toEqual(mockPendingTransactions);
        expect(mockCashierService.getPendingTransactions).toHaveBeenCalledTimes(1);
      });

      it('Should reject non-admin users', async () => {
        const mockRequest = { user: { id: 'user-1', role: 'USER' } };

        await expect(controller.getPendingTransactions(mockRequest))
          .rejects.toThrow(ForbiddenException);
      });
    });
  });

  // ============================================
  // 📊 ALL TRANSACTIONS
  // ============================================

  describe('📊 All Transactions', () => {
    describe('GET /admin/transactions', () => {
      it('Should return all transactions for admin', async () => {
        const mockRequest = { user: { id: 'admin-1', role: 'ADMIN' } };
        const result = await controller.getAllTransactions(mockRequest);

        expect(result).toEqual(mockTransactions);
        expect(mockCashierService.getAllTransactions).toHaveBeenCalledTimes(1);
      });

      it('Should reject non-admin users', async () => {
        const mockRequest = { user: { id: 'user-1', role: 'USER' } };

        await expect(controller.getAllTransactions(mockRequest))
          .rejects.toThrow(ForbiddenException);
      });
    });
  });

  // ============================================
  // ✅ TRANSACTION APPROVAL
  // ============================================

  describe('✅ Transaction Approval', () => {
    describe('POST /admin/transactions/approve', () => {
      const mockAdminRequest = { user: { id: 'admin-1', role: 'ADMIN' } };

      it('Should approve transaction', async () => {
        const dto = { transactionId: 'tx-1', action: 'APPROVE' as const };
        const result = await controller.approveTransaction(mockAdminRequest, dto);

        expect(result).toEqual({ success: true, message: 'Transaction approved' });
        expect(mockCashierService.processTransaction).toHaveBeenCalledWith(
          'tx-1',
          'APPROVE',
          'admin-1',
          undefined
        );
      });

      it('Should reject transaction', async () => {
        const dto = { transactionId: 'tx-1', action: 'REJECT' as const, adminNote: 'Invalid txHash' };
        await controller.approveTransaction(mockAdminRequest, dto);

        expect(mockCashierService.processTransaction).toHaveBeenCalledWith(
          'tx-1',
          'REJECT',
          'admin-1',
          'Invalid txHash'
        );
      });

      it('Should reject non-admin users', async () => {
        const mockRequest = { user: { id: 'user-1', role: 'USER' } };
        const dto = { transactionId: 'tx-1', action: 'APPROVE' as const };

        await expect(controller.approveTransaction(mockRequest, dto))
          .rejects.toThrow(ForbiddenException);
      });

      it('Should reject missing transaction ID', async () => {
        const dto = { transactionId: '', action: 'APPROVE' as const };

        await expect(controller.approveTransaction(mockAdminRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject invalid action', async () => {
        const dto = { transactionId: 'tx-1', action: 'INVALID' as any };

        await expect(controller.approveTransaction(mockAdminRequest, dto))
          .rejects.toThrow(BadRequestException);
      });
    });
  });

  // ============================================
  // 🎭 SIMULATE DEPOSIT
  // ============================================

  describe('🎭 Simulate Deposit', () => {
    describe('POST /admin/deposit/simulate', () => {
      const mockAdminRequest = { user: { id: 'admin-1', role: 'ADMIN' } };

      it('Should simulate deposit by user ID', async () => {
        const dto = { userId: 'user-1', amount: 1000, currency: 'USDT' };
        const result = await controller.simulateDeposit(mockAdminRequest, dto);

        expect(result).toEqual({ success: true, message: 'Deposit simulated', newBalance: '1500.00' });
        expect(mockCashierService.simulateDeposit).toHaveBeenCalledWith(
          'user-1',
          null,
          1000,
          'USDT',
          'admin-1'
        );
      });

      it('Should simulate deposit by user email', async () => {
        const dto = { userEmail: 'test@example.com', amount: 1000, currency: 'USDT' };
        await controller.simulateDeposit(mockAdminRequest, dto);

        expect(mockCashierService.simulateDeposit).toHaveBeenCalledWith(
          null,
          'test@example.com',
          1000,
          'USDT',
          'admin-1'
        );
      });

      it('Should accept all supported currencies', async () => {
        const currencies = ['USDT', 'BTC', 'ETH', 'SOL'];
        
        for (const currency of currencies) {
          const dto = { userId: 'user-1', amount: 100, currency };
          await controller.simulateDeposit(mockAdminRequest, dto);
          
          expect(mockCashierService.simulateDeposit).toHaveBeenCalledWith(
            'user-1',
            null,
            100,
            currency.toUpperCase(),
            'admin-1'
          );
        }
      });

      it('Should reject non-admin users', async () => {
        const mockRequest = { user: { id: 'user-1', role: 'USER' } };
        const dto = { userId: 'user-1', amount: 1000, currency: 'USDT' };

        await expect(controller.simulateDeposit(mockRequest, dto))
          .rejects.toThrow(ForbiddenException);
      });

      it('Should reject invalid amount', async () => {
        const dto = { userId: 'user-1', amount: 0, currency: 'USDT' };

        await expect(controller.simulateDeposit(mockAdminRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject unsupported currency', async () => {
        const dto = { userId: 'user-1', amount: 1000, currency: 'DOGE' };

        await expect(controller.simulateDeposit(mockAdminRequest, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('Should reject missing user identifier', async () => {
        const dto = { amount: 1000, currency: 'USDT' };

        await expect(controller.simulateDeposit(mockAdminRequest, dto as any))
          .rejects.toThrow(BadRequestException);
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

    it('Should check admin role for all endpoints', async () => {
      const mockUserRequest = { user: { id: 'user-1', role: 'USER' } };

      await expect(controller.getPendingTransactions(mockUserRequest))
        .rejects.toThrow(ForbiddenException);
      
      await expect(controller.getAllTransactions(mockUserRequest))
        .rejects.toThrow(ForbiddenException);
      
      await expect(controller.approveTransaction(mockUserRequest, { transactionId: 'tx-1', action: 'APPROVE' }))
        .rejects.toThrow(ForbiddenException);
      
      await expect(controller.simulateDeposit(mockUserRequest, { userId: 'user-1', amount: 100, currency: 'USDT' }))
        .rejects.toThrow(ForbiddenException);
    });
  });
});

// ============================================
// 🧪 INTEGRATION-STYLE TESTS
// ============================================

describe('🧪 Wallet Integration-Style Tests', () => {
  let cashierController: CashierController;
  let adminController: AdminCashierController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashierController, AdminCashierController],
      providers: [
        { provide: CashierService, useValue: mockCashierService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    cashierController = module.get<CashierController>(CashierController);
    adminController = module.get<AdminCashierController>(AdminCashierController);
  });

  it('Should handle complete deposit flow', async () => {
    const userRequest = { user: { id: 'user-1' } };
    const adminRequest = { user: { id: 'admin-1', role: 'ADMIN' } };

    // 1. Get deposit address
    const address = await cashierController.getDepositAddress('USDT');
    expect(address.address).toBeDefined();

    // 2. Submit deposit
    const depositResult = await cashierController.deposit(userRequest, {
      amount: 100,
      currency: 'USDT',
      txHash: '0x1234567890abcdef',
    });
    expect(depositResult.success).toBe(true);

    // 3. Admin approves
    const approveResult = await adminController.approveTransaction(adminRequest, {
      transactionId: depositResult.transactionId,
      action: 'APPROVE',
    });
    expect(approveResult.success).toBe(true);
  });

  it('Should handle complete withdrawal flow', async () => {
    const userRequest = { user: { id: 'user-1' } };
    const adminRequest = { user: { id: 'admin-1', role: 'ADMIN' } };

    // 1. Check balance
    const balances = await cashierController.getBalance(userRequest);
    expect(balances.length).toBeGreaterThan(0);

    // 2. Submit withdrawal
    const withdrawResult = await cashierController.withdraw(userRequest, {
      amount: 100,
      currency: 'USDT',
      walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
    });
    expect(withdrawResult.success).toBe(true);

    // 3. Admin approves
    const approveResult = await adminController.approveTransaction(adminRequest, {
      transactionId: withdrawResult.transactionId,
      action: 'APPROVE',
    });
    expect(approveResult.success).toBe(true);
  });

  it('Should handle admin simulate deposit flow', async () => {
    const userRequest = { user: { id: 'user-1' } };
    const adminRequest = { user: { id: 'admin-1', role: 'ADMIN' } };

    // 1. Get initial balance
    const initialBalances = await cashierController.getBalance(userRequest);

    // 2. Admin simulates deposit
    const simulateResult = await adminController.simulateDeposit(adminRequest, {
      userId: 'user-1',
      amount: 500,
      currency: 'USDT',
    });
    expect(simulateResult.success).toBe(true);
  });
});
