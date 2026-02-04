import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Currency, TransactionType as PrismaTransactionType, UserStatus } from '@prisma/client';
import {
  BalanceRequestDto,
  BalanceResponseDto,
  TransactionRequestDto,
  TransactionResponseDto,
  TransactionType,
  IntegrationErrorCode,
} from './integration.dto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user balance for external provider
   */
  async getBalance(dto: BalanceRequestDto): Promise<BalanceResponseDto> {
    try {
      // Map string currency to enum
      const currency = this.mapCurrency(dto.currency || 'USDT');
      
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: {
          wallets: {
            where: { currency },
          },
        },
      });

      if (!user) {
        return {
          status: 'ERROR',
          error: 'User not found',
        };
      }

      // Check if user is blocked
      if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
        return {
          status: 'ERROR',
          error: 'User is blocked',
        };
      }

      const wallet = user.wallets[0];
      const balance = wallet ? Number(wallet.balance) : 0;

      this.logger.log(`Balance check for user ${dto.userId}: ${balance} ${dto.currency}`);

      return {
        status: 'OK',
        balance: Number(balance.toFixed(2)),
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
   * Process transaction (BET / WIN / REFUND) from external provider
   */
  async processTransaction(dto: TransactionRequestDto): Promise<TransactionResponseDto> {
    try {
      // 1. Check for duplicate transaction (idempotency)
      const existingTx = await this.prisma.transaction.findFirst({
        where: { externalRef: dto.transactionId },
      });

      if (existingTx) {
        this.logger.warn(`Duplicate transaction detected: ${dto.transactionId}`);
        
        // Return the same result as before (idempotent)
        return {
          status: 'OK',
          newBalance: Number(existingTx.balanceAfter),
          txId: existingTx.id,
        };
      }

      // Map string currency to enum
      const currency = this.mapCurrency(dto.currency || 'USDT');

      // 2. Get user and wallet
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: {
          wallets: {
            where: { currency },
          },
        },
      });

      if (!user) {
        return {
          status: 'ERROR',
          error: 'User not found',
          errorCode: IntegrationErrorCode.USER_NOT_FOUND,
        };
      }

      // Check if user is blocked
      if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
        return {
          status: 'ERROR',
          error: 'User is blocked',
          errorCode: IntegrationErrorCode.USER_BLOCKED,
        };
      }

      let wallet = user.wallets[0];

      // Create wallet if doesn't exist
      if (!wallet) {
        wallet = await this.prisma.wallet.create({
          data: {
            userId: user.id,
            currency,
            balance: 0,
            lockedBalance: 0,
          },
        });
      }

      const currentBalance = new Decimal(wallet.balance);
      let newBalance: Decimal;
      let transactionType: PrismaTransactionType;

      // 3. Process based on transaction type
      switch (dto.type) {
        case TransactionType.BET:
          // Check sufficient funds
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
}
