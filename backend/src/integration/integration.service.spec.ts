/**
 * 🎯 THE "BAD COP" TESTS - Integration Service Unit Tests
 * 
 * These tests use Jest Mocks to force error conditions that cannot be
 * triggered naturally through E2E tests. The goal is to achieve 100% coverage
 * by testing all error handlers and edge cases.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationService } from './integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, IntegrationErrorCode } from './integration.dto';
import { UserStatus, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('🎯 IntegrationService - Bad Cop Tests (Error Handlers)', () => {
  let service: IntegrationService;
  let prisma: PrismaService;

  // Mock data
  const mockUserId = 'test-user-123';
  const mockWalletId = 'test-wallet-456';
  const mockTransactionId = 'ext-tx-789';

  const mockUser = {
    id: mockUserId,
    email: 'test@test.com',
    status: UserStatus.ACTIVE,
    wallets: [{
      id: mockWalletId,
      balance: new Decimal(100),
      currency: Currency.USDT,
    }],
  };

  const mockBannedUser = {
    ...mockUser,
    status: UserStatus.BANNED,
  };

  const mockSuspendedUser = {
    ...mockUser,
    status: UserStatus.SUSPENDED,
  };

  const mockUserNoWallet = {
    ...mockUser,
    wallets: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            transaction: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            wallet: {
              create: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('📦 getBalance - Error Scenarios', () => {
    it('1.1 - Should return error when database connection fails', async () => {
      // Mock database connection error
      jest.spyOn(prisma.user, 'findUnique').mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'USDT',
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Internal server error');
    });

    it('1.2 - Should return error when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const result = await service.getBalance({
        userId: 'non-existent-user',
        currency: 'USDT',
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('User not found');
    });

    it('1.3 - Should return error when user is BANNED', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockBannedUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'USDT',
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('User is blocked');
    });

    it('1.4 - Should return error when user is SUSPENDED', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockSuspendedUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'USDT',
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('User is blocked');
    });

    it('1.5 - Should return 0 balance when user has no wallet', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUserNoWallet as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'USDT',
      });

      expect(result.status).toBe('OK');
      expect(result.balance).toBe(0);
    });

    it('1.6 - Should default to USDT when currency not specified', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
      });

      expect(result.status).toBe('OK');
      expect(result.currency).toBe('USDT');
    });

    it('1.7 - Should handle BTC currency', async () => {
      const btcUser = {
        ...mockUser,
        wallets: [{
          id: mockWalletId,
          balance: new Decimal(0.5),
          currency: Currency.BTC,
        }],
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(btcUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'BTC',
      });

      expect(result.status).toBe('OK');
      expect(result.balance).toBe(0.5);
    });

    it('1.8 - Should handle ETH currency', async () => {
      const ethUser = {
        ...mockUser,
        wallets: [{
          id: mockWalletId,
          balance: new Decimal(2.5),
          currency: Currency.ETH,
        }],
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(ethUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'ETH',
      });

      expect(result.status).toBe('OK');
      expect(result.balance).toBe(2.5);
    });

    it('1.9 - Should handle SOL currency', async () => {
      const solUser = {
        ...mockUser,
        wallets: [{
          id: mockWalletId,
          balance: new Decimal(10),
          currency: Currency.SOL,
        }],
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(solUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'SOL',
      });

      expect(result.status).toBe('OK');
      expect(result.balance).toBe(10);
    });

    it('1.10 - Should default unknown currency to USDT', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'UNKNOWN',
      });

      expect(result.status).toBe('OK');
    });
  });

  describe('💰 processTransaction - Error Scenarios', () => {
    it('2.1 - Should return error when database connection fails', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Internal server error');
      expect(result.errorCode).toBe(IntegrationErrorCode.INTERNAL_ERROR);
    });

    it('2.2 - Should return error when user not found', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const result = await service.processTransaction({
        userId: 'non-existent-user',
        amount: 50,
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('User not found');
    });

    it('2.3 - Should return error when user is BANNED', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockBannedUser as any);

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('User is blocked');
    });

    it('2.4 - Should return error when user has no wallet', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUserNoWallet as any);

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Internal server error');
    });

    it('2.5 - Should return error for insufficient funds on BET', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 500, // More than balance (100)
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Insufficient funds');
      expect(result.errorCode).toBe(IntegrationErrorCode.INSUFFICIENT_FUNDS);
    });

    it('2.6 - Should return idempotent response for duplicate transaction', async () => {
      const existingTx = {
        id: 'existing-tx-id',
        balanceAfter: new Decimal(50),
        externalRef: mockTransactionId,
      };
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(existingTx as any);

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('OK');
      expect(result.txId).toBe('existing-tx-id');
      expect(result.newBalance).toBe(50);
    });

    it('2.7 - Should process WIN transaction successfully', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return {
          id: 'new-tx-id',
          balanceAfter: new Decimal(200),
        };
      });

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 100,
        type: TransactionType.WIN,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('OK');
      expect(result.newBalance).toBe(200);
    });

    it('2.8 - Should process REFUND transaction successfully', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return {
          id: 'refund-tx-id',
          balanceAfter: new Decimal(150),
        };
      });

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: TransactionType.REFUND,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('OK');
      expect(result.newBalance).toBe(150);
    });

    it('2.9 - Should return error for invalid transaction type', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: 'INVALID' as TransactionType,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Invalid transaction type');
    });

    it('2.10 - Should handle database transaction failure (concurrency lock)', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma, '$transaction').mockRejectedValue(
        new Error('Deadlock detected')
      );

      const result = await service.processTransaction({
        userId: mockUserId,
        amount: 50,
        type: TransactionType.BET,
        gameId: 'test-game',
        transactionId: mockTransactionId,
      });

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Internal server error');
      expect(result.errorCode).toBe(IntegrationErrorCode.INTERNAL_ERROR);
    });
  });

  describe('🔄 rollbackTransaction - Error Scenarios', () => {
    it('3.1 - Should return error when database connection fails', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await service.rollbackTransaction(mockTransactionId);

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Internal server error');
      expect(result.errorCode).toBe(IntegrationErrorCode.INTERNAL_ERROR);
    });

    it('3.2 - Should return error when transaction not found', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const result = await service.rollbackTransaction('non-existent-tx');

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Transaction not found');
    });

    it('3.3 - Should return idempotent response for already cancelled transaction', async () => {
      const cancelledTx = {
        id: 'cancelled-tx-id',
        status: 'CANCELLED',
        balanceBefore: new Decimal(100),
        walletId: mockWalletId,
        wallet: {
              create: jest.fn(), id: mockWalletId },
      };
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(cancelledTx as any);

      const result = await service.rollbackTransaction(mockTransactionId);

      expect(result.status).toBe('OK');
      expect(result.newBalance).toBe(100);
      expect(result.txId).toBe('cancelled-tx-id');
    });

    it('3.4 - Should rollback transaction successfully', async () => {
      const activeTx = {
        id: 'active-tx-id',
        status: 'CONFIRMED',
        balanceBefore: new Decimal(150),
        walletId: mockWalletId,
        wallet: {
              create: jest.fn(), id: mockWalletId },
        metadata: { gameId: 'test-game' },
      };
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(activeTx as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return activeTx;
      });

      const result = await service.rollbackTransaction(mockTransactionId);

      expect(result.status).toBe('OK');
      expect(result.newBalance).toBe(150);
    });

    it('3.5 - Should handle rollback database failure', async () => {
      const activeTx = {
        id: 'active-tx-id',
        status: 'CONFIRMED',
        balanceBefore: new Decimal(150),
        walletId: mockWalletId,
        wallet: {
              create: jest.fn(), id: mockWalletId },
      };
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(activeTx as any);
      jest.spyOn(prisma, '$transaction').mockRejectedValue(
        new Error('Database lock timeout')
      );

      const result = await service.rollbackTransaction(mockTransactionId);

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Internal server error');
      expect(result.errorCode).toBe(IntegrationErrorCode.INTERNAL_ERROR);
    });
  });

  describe('🗺️ mapCurrency - Edge Cases', () => {
    it('4.1 - Should handle lowercase currency', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'usdt',
      });

      expect(result.status).toBe('OK');
    });

    it('4.2 - Should handle mixed case currency', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.getBalance({
        userId: mockUserId,
        currency: 'Usdt',
      });

      expect(result.status).toBe('OK');
    });
  });

  describe('🔐 authenticate - Seamless Wallet Authentication', () => {
    it('5.1 - Should authenticate with valid token', async () => {
      const result = await service.authenticate('valid-token-123');

      expect(result).toMatchObject({
        success: true,
        userId: 'user_from_token',
        balance: 0,
        currency: 'USDT',
        message: 'Authenticated successfully (mock)',
      });
    });

    it('5.2 - Should authenticate with different token formats', async () => {
      const tokens = [
        'jwt-token-abc123',
        'bearer-xyz789',
        'session-token-def456',
      ];

      for (const token of tokens) {
        const result = await service.authenticate(token);
        expect(result.success).toBe(true);
        expect(result.userId).toBe('user_from_token');
      }
    });

    it('5.3 - Should return consistent structure', async () => {
      const result = await service.authenticate('test-token');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('message');
    });

    it('5.4 - Should handle empty token gracefully', async () => {
      const result = await service.authenticate('');

      expect(result).toMatchObject({
        success: true,
        userId: 'user_from_token',
      });
    });

    it('5.5 - Should handle long tokens', async () => {
      const longToken = 'a'.repeat(1000);
      const result = await service.authenticate(longToken);

      expect(result.success).toBe(true);
    });
  });
});
