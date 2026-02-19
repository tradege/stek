import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Currency } from '@prisma/client';
import { TransactionType as PrismaTransactionType } from '@prisma/client';
import {
  BalanceRequestDto,
  BalanceResponseDto,
  TransactionRequestDto,
  TransactionResponseDto,
  TransactionType,
  IntegrationErrorCode,
} from './integration.dto';
import Decimal from 'decimal.js';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Get user balance
   */
  async getBalance(dto: BalanceRequestDto): Promise<BalanceResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: {
          wallets: true,
        },
      });

      if (!user) {
        return {
          status: 'ERROR',
          error: 'User not found',
        };
      }

      const currency = this.mapCurrency(dto.currency || 'USDT');
      const wallet = user.wallets.find((w) => w.currency === currency);

      if (!wallet) {
        return {
          status: 'ERROR',
          error: 'Wallet not found',
        };
      }

      return {
        status: 'OK',
        balance: Number(new Decimal(wallet.balance.toString()).plus(wallet.bonusBalance || 0).toFixed(2)),
        currency: dto.currency || 'USDT',
      };
    } catch (error) {
      this.logger.error(`Balance check failed: ${error.message}`);
      return {
        status: 'ERROR',
        error: 'Internal server error',
      };
    }
  }

  /**
   * Process a transaction (BET, WIN, REFUND)
   */
  async processTransaction(
    dto: TransactionRequestDto,
  ): Promise<TransactionResponseDto> {
    try {
      
    // PRODUCTION SAFEGUARD: Block test transactions in production
    if (process.env.NODE_ENV === 'production') {
      if (dto.gameId?.startsWith('test-') || dto.gameId === 'test-game' || 
          dto.gameId === 'consistency-test' ||
          dto.transactionId?.startsWith('test-') || 
          dto.transactionId?.startsWith('decimal-test') ||
          dto.transactionId?.startsWith('consistency-')) {
        this.logger.warn(`BLOCKED test transaction in production: ${dto.transactionId}`);
        return { status: 'ERROR', error: 'Test transactions are not allowed in production' };
      }
    }

    // 1. Idempotency check - if transaction already exists, return success
      const existingTx = await this.prisma.transaction.findFirst({
        where: { externalRef: dto.transactionId },
      });

      if (existingTx) {
        this.logger.warn(
          `Duplicate transaction detected: ${dto.transactionId}`,
        );
        return {
          status: 'OK',
          newBalance: Number(existingTx.balanceAfter),
          txId: existingTx.id,
        };
      }

      // 2. Find user and wallet
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: { wallets: true },
      });

      if (!user) {
        return {
          status: 'ERROR',
          error: 'User not found',
          errorCode: IntegrationErrorCode.USER_NOT_FOUND,
        };
      }

      const wallet = user.wallets.find((w) => w.currency === Currency.USDT);
      if (!wallet) {
        return {
          status: 'ERROR',
          error: 'Wallet not found',
          errorCode: IntegrationErrorCode.USER_NOT_FOUND,
        };
      }

      // 3. Calculate new balance based on transaction type
      const currentBalance = new Decimal(wallet.balance.toString());
      let newBalance: Decimal;
      let transactionType: PrismaTransactionType;

      switch (dto.type) {
        case TransactionType.BET:
          if (currentBalance.lessThan(dto.amount)) {
            this.logger.warn(
              `Insufficient funds for user ${dto.userId}: ${currentBalance} < ${dto.amount}`
            );
            return {
              status: 'ERROR',
              error: 'Insufficient funds',
              errorCode: IntegrationErrorCode.INSUFFICIENT_FUNDS,
            };
          }
          newBalance = currentBalance.minus(dto.amount);
          transactionType = PrismaTransactionType.BET;
          break;

        case TransactionType.WIN:
          newBalance = currentBalance.plus(dto.amount);
          transactionType = PrismaTransactionType.WIN;
          break;

        case TransactionType.REFUND:
          newBalance = currentBalance.plus(dto.amount);
          // Use WIN type for refunds since there's no REFUND in the enum
          transactionType = PrismaTransactionType.WIN;
          break;

        default:
          return {
            status: 'ERROR',
            error: 'Invalid transaction type',
            errorCode: IntegrationErrorCode.INVALID_AMOUNT,
          };
      }

      // 4. Execute transaction atomically
      const result = await this.prisma.$transaction(async (tx) => {
        // Update wallet balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance },
        });

        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            userId: user.id,
            walletId: wallet.id,
            type: transactionType,
            amount: dto.amount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            status: 'CONFIRMED',
            externalRef: dto.transactionId,
            metadata: {
              gameId: dto.gameId,
              roundId: dto.roundId,
              provider: 'EXTERNAL',
              originalType: dto.type,
            },
          },
        });

        return transaction;
      });

      this.logger.log(
        `Transaction processed: ${dto.type} ${dto.amount} for user ${dto.userId}, ` +
        `new balance: ${newBalance}, txId: ${result.id}`
      );

      return {
        status: 'OK',
        newBalance: Number(newBalance.toFixed(2)),
        txId: result.id,
      };
    } catch (error) {
      this.logger.error(`Transaction failed: ${error.message}`, error.stack);
      return {
        status: 'ERROR',
        error: 'Internal server error',
        errorCode: IntegrationErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Rollback a transaction (for error recovery)
   */
  async rollbackTransaction(transactionId: string): Promise<TransactionResponseDto> {
    try {
      const transaction = await this.prisma.transaction.findFirst({
        where: { externalRef: transactionId },
        include: { wallet: true },
      });

      if (!transaction) {
        return {
          status: 'ERROR',
          error: 'Transaction not found',
        };
      }

      if (transaction.status === 'CANCELLED') {
        return {
          status: 'OK',
          newBalance: Number(transaction.balanceBefore),
          txId: transaction.id,
        };
      }

      // Reverse the transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Restore original balance
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: transaction.balanceBefore },
        });

        // Mark transaction as cancelled
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...(transaction.metadata as object),
              rolledBackAt: new Date().toISOString(),
            },
          },
        });

        return transaction;
      });

      this.logger.log(`Transaction rolled back: ${transactionId}`);

      return {
        status: 'OK',
        newBalance: Number(result.balanceBefore),
        txId: result.id,
      };
    } catch (error) {
      this.logger.error(`Rollback failed: ${error.message}`);
      return {
        status: 'ERROR',
        error: 'Internal server error',
        errorCode: IntegrationErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Map string currency to Prisma Currency enum
   */
  private mapCurrency(currency: string): Currency {
    const currencyMap: Record<string, Currency> = {
      'BTC': Currency.BTC,
      'ETH': Currency.ETH,
      'USDT': Currency.USDT,
      'SOL': Currency.SOL,
    };
    return currencyMap[currency.toUpperCase()] || Currency.USDT;
  }

  /**
   * Authenticate user session for Seamless Wallet
   * 
   * REAL IMPLEMENTATION:
   * 1. Validates the JWT token issued by our auth system
   * 2. Extracts user ID from token payload
   * 3. Fetches user data and wallet balance from database
   * 4. Returns user session data to the game provider
   * 
   * This is the Seamless Wallet handshake - when a player opens
   * a game from an external provider, the provider calls this
   * endpoint with the player's token to verify their identity
   * and get their current balance.
   */
  async authenticate(token: string): Promise<any> {
    try {
      // 1. Validate and decode the JWT token
      let payload: any;
      try {
        payload = this.jwtService.verify(token);
      } catch (jwtError) {
        this.logger.warn(`Invalid token: ${jwtError.message}`);
        return {
          success: false,
          error: 'Invalid or expired token',
          errorCode: 'INVALID_TOKEN',
        };
      }

      // 2. Extract user ID from token (our JWT uses 'sub' for user ID)
      const userId = payload.sub;
      if (!userId) {
        return {
          success: false,
          error: 'Token missing user identifier',
          errorCode: 'INVALID_TOKEN',
        };
      }

      // 3. Fetch user from database with wallets
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          wallets: true,
        },
      });

      if (!user) {
        this.logger.warn(`User not found for token sub: ${userId}`);
        return {
          success: false,
          error: 'User not found',
          errorCode: 'USER_NOT_FOUND',
        };
      }

      // 4. Check user status
      if (user.status !== 'ACTIVE') {
        this.logger.warn(`User ${userId} is not active: ${user.status}`);
        return {
          success: false,
          error: 'User account is not active',
          errorCode: 'USER_DISABLED',
        };
      }

      // 5. Get USDT wallet balance
      const usdtWallet = user.wallets.find((w) => w.currency === Currency.USDT);
      const balance = usdtWallet
        ? Number(new Decimal(usdtWallet.balance.toString()).toFixed(2))
        : 0;

      this.logger.log(
        `User authenticated: ${user.username} (${userId}), balance: ${balance} USDT`
      );

      // 6. Return session data to provider
      return {
        success: true,
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        balance: balance,
        currency: 'USDT',
        country: 'IL',
        sessionId: `session_${Date.now()}_${userId}`,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }
}
