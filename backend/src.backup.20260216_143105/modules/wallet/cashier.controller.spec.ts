/**
 * 💰 CashierController - Comprehensive Unit Tests
 * 
 * Aligned with current CashierController implementation:
 * - All endpoints are tenant-scoped (siteId from req.tenant)
 * - Validation is handled by the service layer, not the controller
 * - Methods: getBalances, getTransactions, deposit, withdraw, getPending, getAllTransactions, processTransaction, directDeposit
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BadRequestException } from '@nestjs/common';

// ============================================
// MOCK DATA
// ============================================
const mockBalances = [
  { currency: 'USDT', balance: '1000.00', address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7' },
  { currency: 'BTC', balance: '0.05', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { currency: 'ETH', balance: '0.5', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE2a' },
];

const mockTransactions = [
  { id: 'tx-1', type: 'DEPOSIT', status: 'CONFIRMED', amount: '1000.00', currency: 'USDT', createdAt: new Date('2024-01-15') },
  { id: 'tx-2', type: 'WITHDRAWAL', status: 'PENDING', amount: '500.00', currency: 'USDT', createdAt: new Date('2024-01-16') },
];

const mockDepositResult = { success: true, transactionId: 'tx-new-1', message: 'Deposit request submitted', status: 'PENDING' };
const mockWithdrawResult = { success: true, transactionId: 'tx-new-2', message: 'Withdrawal request submitted', status: 'PENDING' };
const mockPendingTransactions = [{ id: 'tx-pending-1', type: 'DEPOSIT', status: 'PENDING', amount: '500.00', currency: 'USDT' }];

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
  adminDirectDeposit: jest.fn().mockResolvedValue({ success: true, message: 'Deposit completed', newBalance: '1500.00' }),
};

// ============================================
// HELPER: Create mock request
// ============================================
function mockReq(userId = 'user-1', role = 'USER', siteId = 'site-001') {
  return { user: { id: userId, role, siteId }, tenant: { siteId } };
}

function adminReq(siteId = 'site-001') {
  return { user: { id: 'admin-1', role: 'ADMIN', siteId }, tenant: { siteId } };
}

// ============================================
// TESTS
// ============================================
describe('💰 CashierController - Comprehensive Unit Tests', () => {
  let controller: CashierController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashierController],
      providers: [{ provide: CashierService, useValue: mockCashierService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<CashierController>(CashierController);
  });

  // ==================== BALANCES ====================
  describe('💵 Balance Endpoints', () => {
    describe('GET /cashier/balances', () => {
      it('Should return user balances with siteId', async () => {
        const req = mockReq();
        const result = await controller.getBalances(req);
        expect(result).toEqual(mockBalances);
        expect(mockCashierService.getUserBalances).toHaveBeenCalledWith('user-1', 'site-001');
      });

      it('Should return balances for all currencies', async () => {
        const result = await controller.getBalances(mockReq());
        expect(result.length).toBe(3);
        expect(result.map((b: any) => b.currency)).toContain('USDT');
        expect(result.map((b: any) => b.currency)).toContain('BTC');
        expect(result.map((b: any) => b.currency)).toContain('ETH');
      });

      it('Should include wallet addresses', async () => {
        const result = await controller.getBalances(mockReq());
        result.forEach((b: any) => {
          expect(b.address).toBeDefined();
          expect(typeof b.address).toBe('string');
        });
      });

      it('Should pass null siteId when tenant is missing', async () => {
        const req = { user: { id: 'user-1' } };
        await controller.getBalances(req);
        expect(mockCashierService.getUserBalances).toHaveBeenCalledWith('user-1', null);
      });
    });
  });

  // ==================== TRANSACTIONS ====================
  describe('📜 Transaction History', () => {
    describe('GET /cashier/transactions', () => {
      it('Should return user transactions with default limit', async () => {
        const result = await controller.getTransactions(mockReq());
        expect(result).toEqual(mockTransactions);
        expect(mockCashierService.getUserTransactions).toHaveBeenCalledWith('user-1', 50, 'site-001');
      });

      it('Should parse limit from query string', async () => {
        await controller.getTransactions(mockReq(), '20');
        expect(mockCashierService.getUserTransactions).toHaveBeenCalledWith('user-1', 20, 'site-001');
      });

      it('Should use default limit 50 when not specified', async () => {
        await controller.getTransactions(mockReq());
        expect(mockCashierService.getUserTransactions).toHaveBeenCalledWith('user-1', 50, 'site-001');
      });
    });
  });

  // ==================== DEPOSIT ====================
  describe('💳 Deposit Endpoints', () => {
    describe('POST /cashier/deposit', () => {
      it('Should create deposit request with valid data', async () => {
        const body = { amount: 100, currency: 'USDT', txHash: 'tx-hash-abc123def456' };
        const result = await controller.deposit(mockReq(), body);
        expect(result).toEqual(mockDepositResult);
        expect(mockCashierService.createDepositRequest).toHaveBeenCalledWith(
          'user-1', 100, 'USDT', 'tx-hash-abc123def456', 'site-001',
        );
      });

      it('Should accept all supported currencies', async () => {
        for (const currency of ['USDT', 'BTC', 'ETH', 'SOL', 'TRX']) {
          jest.clearAllMocks();
          await controller.deposit(mockReq(), { amount: 100, currency, txHash: `tx-${currency}` });
          expect(mockCashierService.createDepositRequest).toHaveBeenCalledWith(
            'user-1', 100, currency, `tx-${currency}`, 'site-001',
          );
        }
      });

      it('Should default currency to USDT when not provided', async () => {
        const body = { amount: 100, currency: undefined as any, txHash: 'tx-123' };
        await controller.deposit(mockReq(), body);
        expect(mockCashierService.createDepositRequest).toHaveBeenCalledWith(
          'user-1', 100, 'USDT', 'tx-123', 'site-001',
        );
      });

      it('Should pass through service errors', async () => {
        mockCashierService.createDepositRequest.mockRejectedValueOnce(
          new BadRequestException('Invalid amount'),
        );
        await expect(controller.deposit(mockReq(), { amount: -1, currency: 'USDT', txHash: 'tx' }))
          .rejects.toThrow(BadRequestException);
      });
    });
  });

  // ==================== WITHDRAWAL ====================
  describe('💸 Withdrawal Endpoints', () => {
    describe('POST /cashier/withdraw', () => {
      it('Should create withdrawal request with valid data', async () => {
        const body = { amount: 500, currency: 'USDT', walletAddress: 'TRC20_wallet_address_here' };
        const result = await controller.withdraw(mockReq(), body);
        expect(result).toEqual(mockWithdrawResult);
        expect(mockCashierService.createWithdrawRequest).toHaveBeenCalledWith(
          'user-1', 500, 'USDT', 'TRC20_wallet_address_here', 'site-001',
        );
      });

      it('Should accept all supported currencies', async () => {
        for (const currency of ['USDT', 'BTC', 'ETH']) {
          jest.clearAllMocks();
          await controller.withdraw(mockReq(), { amount: 100, currency, walletAddress: `addr-${currency}` });
          expect(mockCashierService.createWithdrawRequest).toHaveBeenCalledWith(
            'user-1', 100, currency, `addr-${currency}`, 'site-001',
          );
        }
      });

      it('Should default currency to USDT when not provided', async () => {
        const body = { amount: 100, currency: undefined as any, walletAddress: 'addr-123' };
        await controller.withdraw(mockReq(), body);
        expect(mockCashierService.createWithdrawRequest).toHaveBeenCalledWith(
          'user-1', 100, 'USDT', 'addr-123', 'site-001',
        );
      });

      it('Should pass through service errors (insufficient balance)', async () => {
        mockCashierService.createWithdrawRequest.mockRejectedValueOnce(
          new BadRequestException('Insufficient balance'),
        );
        await expect(controller.withdraw(mockReq(), { amount: 999999, currency: 'USDT', walletAddress: 'addr' }))
          .rejects.toThrow(BadRequestException);
      });
    });
  });

  // ==================== ADMIN: PENDING ====================
  describe('🔐 Admin Endpoints', () => {
    describe('GET /cashier/admin/pending', () => {
      it('Should return pending transactions for ADMIN (null siteId = see all)', async () => {
        const req = adminReq();
        const result = await controller.getPending(req);
        expect(result).toEqual(mockPendingTransactions);
        expect(mockCashierService.getPendingTransactions).toHaveBeenCalledWith(null);
      });

      it('Should scope to siteId for SUPER_MASTER', async () => {
        const req = { user: { id: 'sm-1', role: 'SUPER_MASTER' }, tenant: { siteId: 'brand-x' } };
        await controller.getPending(req);
        expect(mockCashierService.getPendingTransactions).toHaveBeenCalledWith('brand-x');
      });
    });

    describe('GET /cashier/admin/transactions', () => {
      it('Should return all transactions with default limit', async () => {
        await controller.getAllTransactions(adminReq());
        expect(mockCashierService.getAllTransactions).toHaveBeenCalledWith(100, null);
      });

      it('Should parse custom limit', async () => {
        await controller.getAllTransactions(adminReq(), '25');
        expect(mockCashierService.getAllTransactions).toHaveBeenCalledWith(25, null);
      });
    });

    describe('POST /cashier/admin/process', () => {
      it('Should process (approve) a transaction', async () => {
        const body = { transactionId: 'tx-1', action: 'APPROVE' as const };
        await controller.processTransaction(adminReq(), body);
        expect(mockCashierService.processTransaction).toHaveBeenCalledWith('tx-1', 'APPROVE', 'admin-1', undefined);
      });

      it('Should process (reject) a transaction with note', async () => {
        const body = { transactionId: 'tx-2', action: 'REJECT' as const, note: 'Suspicious activity' };
        await controller.processTransaction(adminReq(), body);
        expect(mockCashierService.processTransaction).toHaveBeenCalledWith('tx-2', 'REJECT', 'admin-1', 'Suspicious activity');
      });

      it('Should throw BadRequestException when transactionId is missing', async () => {
        const body = { transactionId: '', action: 'APPROVE' as const };
        await expect(controller.processTransaction(adminReq(), body)).rejects.toThrow(BadRequestException);
      });

      it('Should throw BadRequestException when action is missing', async () => {
        const body = { transactionId: 'tx-1', action: '' as any };
        await expect(controller.processTransaction(adminReq(), body)).rejects.toThrow(BadRequestException);
      });
    });

    describe('POST /cashier/admin/direct-deposit', () => {
      it('Should execute admin direct deposit', async () => {
        const body = { userId: 'user-target', amount: 1000, currency: 'USDT' };
        await controller.directDeposit(adminReq(), body);
        expect(mockCashierService.adminDirectDeposit).toHaveBeenCalledWith(
          'user-target', 1000, 'USDT', 'admin-1', undefined,
        );
      });

      it('Should pass note to service', async () => {
        const body = { userId: 'user-target', amount: 500, currency: 'BTC', note: 'Bonus reward' };
        await controller.directDeposit(adminReq(), body);
        expect(mockCashierService.adminDirectDeposit).toHaveBeenCalledWith(
          'user-target', 500, 'BTC', 'admin-1', 'Bonus reward',
        );
      });

      it('Should default currency to USDT', async () => {
        const body = { userId: 'user-target', amount: 100, currency: undefined as any };
        await controller.directDeposit(adminReq(), body);
        expect(mockCashierService.adminDirectDeposit).toHaveBeenCalledWith(
          'user-target', 100, 'USDT', 'admin-1', undefined,
        );
      });
    });
  });

  // ==================== TENANT ISOLATION ====================
  describe('🏢 Tenant Isolation', () => {
    it('Should pass siteId from tenant to all service calls', async () => {
      const req = mockReq('user-1', 'USER', 'brand-alpha');
      await controller.getBalances(req);
      expect(mockCashierService.getUserBalances).toHaveBeenCalledWith('user-1', 'brand-alpha');
    });

    it('Should pass different siteId for different tenants', async () => {
      await controller.getBalances(mockReq('user-1', 'USER', 'brand-a'));
      expect(mockCashierService.getUserBalances).toHaveBeenCalledWith('user-1', 'brand-a');

      jest.clearAllMocks();
      await controller.getBalances(mockReq('user-2', 'USER', 'brand-b'));
      expect(mockCashierService.getUserBalances).toHaveBeenCalledWith('user-2', 'brand-b');
    });
  });

  // ==================== INTEGRATION FLOW ====================
  describe('🔄 Full Flow Integration', () => {
    it('Should complete deposit -> check balance -> withdraw flow', async () => {
      const userReq = mockReq();

      // 1. Deposit
      const depositResult = await controller.deposit(userReq, { amount: 100, currency: 'USDT', txHash: 'tx-flow-1' });
      expect(depositResult.success).toBe(true);

      // 2. Check balance
      const balances = await controller.getBalances(userReq);
      expect(balances.length).toBeGreaterThan(0);

      // 3. Withdraw
      const withdrawResult = await controller.withdraw(userReq, { amount: 50, currency: 'USDT', walletAddress: 'addr-flow-1' });
      expect(withdrawResult.success).toBe(true);

      // 4. Check transactions
      const txns = await controller.getTransactions(userReq);
      expect(txns).toBeDefined();
    });
  });
});
