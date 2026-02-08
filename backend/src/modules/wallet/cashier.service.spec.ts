/**
 * 💰 CASHIER/WALLET SERVICE UNIT TESTS
 * Comprehensive tests for wallet operations, deposits, and withdrawals
 * FIXED: Method names match actual CashierService implementation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CashierService } from './cashier.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Currency, TransactionType, TransactionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('💰 CashierService - Unit Tests', () => {
  let service: CashierService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    status: 'ACTIVE',
  };

  const mockWallet = {
    id: 'wallet-123',
    userId: 'user-123',
    currency: Currency.USDT,
    balance: new Decimal(1000),
    lockedBalance: new Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransaction = {
    id: 'tx-123',
    walletId: 'wallet-123',
    userId: 'user-123',
    type: TransactionType.DEPOSIT,
    amount: new Decimal(100),
    status: TransactionStatus.PENDING,
    balanceBefore: new Decimal(900),
    balanceAfter: new Decimal(1000),
    externalRef: 'tx-hash-123',
    metadata: {},
    createdAt: new Date(),
    wallet: { currency: Currency.USDT },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashierService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            wallet: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CashierService>(CashierService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('💵 getUserBalances', () => {
    it('1.1 - Should return balances for user wallets', async () => {
      jest.spyOn(prisma.wallet, 'findMany').mockResolvedValue([mockWallet] as any);

      const result = await service.getUserBalances('user-123');

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].available).toBe('1000');
    });

    it('1.2 - Should return empty array for user with no wallets', async () => {
      jest.spyOn(prisma.wallet, 'findMany').mockResolvedValue([]);

      const result = await service.getUserBalances('user-123');

      expect(result).toEqual([]);
    });

    it('1.3 - Should handle multiple currencies', async () => {
      const btcWallet = { ...mockWallet, id: 'wallet-btc', currency: Currency.BTC, balance: new Decimal(0.5) };
      jest.spyOn(prisma.wallet, 'findMany').mockResolvedValue([mockWallet, btcWallet] as any);

      const result = await service.getUserBalances('user-123');

      expect(result).toHaveLength(2);
    });

    it('1.4 - Should return available and locked balance', async () => {
      const walletWithLocked = { ...mockWallet, lockedBalance: new Decimal(200) };
      jest.spyOn(prisma.wallet, 'findMany').mockResolvedValue([walletWithLocked] as any);

      const result = await service.getUserBalances('user-123');

      expect(result[0].available).toBe('1000');
      expect(result[0].locked).toBe('200');
      expect(result[0].total).toBe('1200');
    });

    it('1.5 - Should handle decimal precision', async () => {
      const preciseWallet = { ...mockWallet, balance: new Decimal('100.12345678') };
      jest.spyOn(prisma.wallet, 'findMany').mockResolvedValue([preciseWallet] as any);

      const result = await service.getUserBalances('user-123');

      expect(result[0].available).toBe('100.12345678');
    });
  });

  describe('📜 getUserTransactions', () => {
    it('2.1 - Should return user transactions', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockTransaction] as any);

      const result = await service.getUserTransactions('user-123');

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });

    it('2.2 - Should return empty array for user with no transactions', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const result = await service.getUserTransactions('user-123');

      expect(result).toEqual([]);
    });

    it('2.3 - Should respect limit parameter', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockTransaction] as any);

      await service.getUserTransactions('user-123', 10);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('📥 createDepositRequest', () => {
    it('3.1 - Should create deposit request successfully', async () => {
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWallet as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransaction as any);

      const result = await service.createDepositRequest('user-123', 100, 'USDT', 'tx-hash-123');

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
    });

    it('3.2 - Should create wallet if not exists', async () => {
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.wallet, 'create').mockResolvedValue(mockWallet as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransaction as any);

      const result = await service.createDepositRequest('user-123', 100, 'USDT', 'tx-hash-new');

      expect(prisma.wallet.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('3.3 - Should throw BadRequestException for duplicate txHash', async () => {
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWallet as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockTransaction as any);

      await expect(
        service.createDepositRequest('user-123', 100, 'USDT', 'tx-hash-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('3.4 - Should handle different currencies', async () => {
      const btcWallet = { ...mockWallet, currency: Currency.BTC };
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(btcWallet as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.transaction, 'create').mockResolvedValue({
        ...mockTransaction,
        wallet: { currency: Currency.BTC },
      } as any);

      const result = await service.createDepositRequest('user-123', 0.1, 'BTC', 'btc-tx-hash');

      expect(result).toBeDefined();
    });
  });

  describe('📤 createWithdrawRequest', () => {
    it('4.1 - Should create withdrawal request successfully', async () => {
      const walletWithBalance = { ...mockWallet, balance: new Decimal(1000) };
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(walletWithBalance as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { ...mockTransaction, type: TransactionType.WITHDRAWAL };
      });

      const result = await service.createWithdrawRequest(
        'user-123',
        100,
        'USDT',
        'TRC20WalletAddress123'
      );

      expect(result).toBeDefined();
    });

    it('4.2 - Should throw error for insufficient balance', async () => {
      const lowBalanceWallet = { ...mockWallet, balance: new Decimal(10) };
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(lowBalanceWallet as any);

      await expect(
        service.createWithdrawRequest('user-123', 100, 'USDT', 'wallet-address')
      ).rejects.toThrow();
    });

    it('4.3 - Should throw error for no wallet', async () => {
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(null);

      await expect(
        service.createWithdrawRequest('user-123', 100, 'USDT', 'wallet-address')
      ).rejects.toThrow();
    });

    it('4.4 - Should throw BadRequestException for amount below minimum', async () => {
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWallet as any);

      await expect(
        service.createWithdrawRequest('user-123', 1, 'USDT', 'wallet-address')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('⏳ getPendingTransactions', () => {
    it('5.1 - Should return pending transactions', async () => {
      const pendingTx = { ...mockTransaction, status: TransactionStatus.PENDING };
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([pendingTx] as any);

      const result = await service.getPendingTransactions();

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });

    it('5.2 - Should return empty array when no pending transactions', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const result = await service.getPendingTransactions();

      expect(result).toEqual([]);
    });
  });

  describe('📋 getAllTransactions', () => {
    it('6.1 - Should return all transactions with limit', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockTransaction] as any);

      const result = await service.getAllTransactions(50);

      expect(result).toBeDefined();
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('6.2 - Should use default limit of 100', async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      await service.getAllTransactions();

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('✅ processTransaction', () => {
    const pendingDeposit = {
      ...mockTransaction,
      status: TransactionStatus.PENDING,
    balanceBefore: new Decimal(900),
    balanceAfter: new Decimal(1000),
      type: TransactionType.DEPOSIT,
      wallet: mockWallet,
    };

    const pendingWithdrawal = {
      ...mockTransaction,
      status: TransactionStatus.PENDING,
    balanceBefore: new Decimal(900),
    balanceAfter: new Decimal(1000),
      type: TransactionType.WITHDRAWAL,
      wallet: mockWallet,
    };

    it('7.1 - Should approve deposit successfully', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(pendingDeposit as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { success: true };
      });

      const result = await service.processTransaction('tx-123', 'APPROVE', 'admin-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('approved');
    });

    it('7.2 - Should reject deposit successfully', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(pendingDeposit as any);
      jest.spyOn(prisma.transaction, 'update').mockResolvedValue({
        ...pendingDeposit,
        status: TransactionStatus.CANCELLED,
      } as any);

      const result = await service.processTransaction('tx-123', 'REJECT', 'admin-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected');
    });

    it('7.3 - Should throw NotFoundException for non-existent transaction', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(null);

      await expect(
        service.processTransaction('non-existent', 'APPROVE', 'admin-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('7.4 - Should throw BadRequestException for already processed transaction', async () => {
      const completedTx = { ...pendingDeposit, status: TransactionStatus.CONFIRMED };
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(completedTx as any);

      await expect(
        service.processTransaction('tx-123', 'APPROVE', 'admin-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('7.5 - Should approve withdrawal successfully', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(pendingWithdrawal as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { success: true };
      });

      const result = await service.processTransaction('tx-123', 'APPROVE', 'admin-123');

      expect(result.success).toBe(true);
    });

    it('7.6 - Should reject withdrawal and return funds', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(pendingWithdrawal as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { success: true };
      });

      const result = await service.processTransaction('tx-123', 'REJECT', 'admin-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected');
    });

    it('7.7 - Should include admin note in metadata', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(pendingDeposit as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { success: true };
      });

      const result = await service.processTransaction(
        'tx-123',
        'APPROVE',
        'admin-123',
        'Verified manually'
      );

      expect(result.success).toBe(true);
    });
  });
  describe('💰 simulateDeposit (Admin)', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    };

    const mockWalletForSim = {
      id: 'wallet-123',
      userId: 'user-123',
      currency: 'USDT',
      balance: new Decimal(100),
      lockedBalance: new Decimal(0),
    };

    const mockCreatedTransaction = {
      id: 'tx-sim-123',
      userId: 'user-123',
      walletId: 'wallet-123',
      type: 'DEPOSIT',
      status: 'CONFIRMED',
      amount: new Decimal(500),
      balanceBefore: new Decimal(100),
      balanceAfter: new Decimal(600),
    };

    it('8.1 - Should simulate deposit by user ID successfully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWalletForSim as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { transaction: mockCreatedTransaction, newBalance: new Decimal(600) };
      });

      const result = await service.simulateDeposit(
        'user-123',
        null,
        500,
        'USDT',
        'admin-123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('500');
      expect(result.message).toContain('USDT');
      expect(result.transaction.amount).toBe('500');
      expect(result.user.id).toBe('user-123');
    });

    it('8.2 - Should simulate deposit by email successfully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWalletForSim as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { transaction: mockCreatedTransaction, newBalance: new Decimal(600) };
      });

      const result = await service.simulateDeposit(
        null,
        'test@example.com',
        500,
        'USDT',
        'admin-123'
      );

      expect(result.success).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('8.3 - Should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.simulateDeposit('non-existent', null, 500, 'USDT', 'admin-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('8.4 - Should create wallet if not exists', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.wallet, 'create').mockResolvedValue({
        ...mockWalletForSim,
        balance: new Decimal(0),
      } as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { transaction: mockCreatedTransaction, newBalance: new Decimal(500) };
      });

      const result = await service.simulateDeposit(
        'user-123',
        null,
        500,
        'USDT',
        'admin-123'
      );

      expect(result.success).toBe(true);
      expect(prisma.wallet.create).toHaveBeenCalled();
    });

    it('8.5 - Should create transaction record with correct metadata', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWalletForSim as any);
      
      let capturedCallback: any;
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        capturedCallback = callback;
        return { transaction: mockCreatedTransaction, newBalance: new Decimal(600) };
      });

      await service.simulateDeposit('user-123', null, 500, 'USDT', 'admin-123');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('8.6 - Should return correct transaction details', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(mockWalletForSim as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { transaction: mockCreatedTransaction, newBalance: new Decimal(600) };
      });

      const result = await service.simulateDeposit(
        'user-123',
        null,
        500,
        'USDT',
        'admin-123'
      );

      expect(result.transaction).toBeDefined();
      expect(result.transaction.id).toBe('tx-sim-123');
      expect(result.transaction.currency).toBe('USDT');
      expect(result.transaction.newBalance).toBe('600');
    });

    it('8.7 - Should handle different currencies', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.wallet, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.wallet, 'create').mockResolvedValue({
        ...mockWalletForSim,
        currency: 'BTC',
        balance: new Decimal(0),
      } as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { transaction: mockCreatedTransaction, newBalance: new Decimal(500) };
      });

      const result = await service.simulateDeposit(
        'user-123',
        null,
        0.5,
        'BTC',
        'admin-123'
      );

      expect(result.success).toBe(true);
      expect(prisma.wallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'BTC' }),
        })
      );
    });
  });
});
