import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import Decimal from 'decimal.js';

/**
 * Transaction types supported by the wallet system
 */
export enum TransactionType {
  BET = 'BET',
  WIN = 'WIN',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  COMMISSION = 'COMMISSION',
  TIP_SENT = 'TIP_SENT',
  TIP_RECEIVED = 'TIP_RECEIVED',
  REFUND = 'REFUND',
}

/**
 * Result of a wallet transaction
 */
export interface TransactionResult {
  success: boolean;
  transactionId: string;
  newBalance: Decimal;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Wallet Service
 * 
 * This service handles all wallet operations using Redis for atomic,
 * high-performance balance updates. It uses a Lua script to ensure
 * that all balance operations are atomic and race-condition free.
 * 
 * Key Features:
 * - Atomic balance updates via Redis Lua scripts
 * - Idempotency protection (prevents duplicate transactions)
 * - Support for 10,000+ transactions per second
 * - Automatic audit logging
 */
@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private redis: Redis;
  private luaScript: string;
  private luaScriptSha: string;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    });
  }

  /**
   * Initialize the service - load and cache the Lua script
   */
  async onModuleInit(): Promise<void> {
    try {
      // Load the Lua script from file
      const scriptPath = path.join(
        __dirname,
        '../../redis/scripts/atomic_balance_update.lua'
      );
      this.luaScript = fs.readFileSync(scriptPath, 'utf-8');

      // Pre-load the script into Redis for better performance
      // SCRIPT LOAD returns a SHA1 hash that can be used with EVALSHA
      this.luaScriptSha = await this.redis.script('LOAD', this.luaScript);
      
      this.logger.log(`Lua script loaded successfully. SHA: ${this.luaScriptSha}`);
    } catch (error) {
      this.logger.error('Failed to load Lua script', error);
      throw error;
    }
  }

  /**
   * Get the Redis key for a user's wallet balance
   */
  private getBalanceKey(userId: string, currency: string = 'USDT'): string {
    return `wallet:${userId}:${currency}:balance`;
  }

  /**
   * Get the Redis key for processed transactions (idempotency)
   */
  private getProcessedKey(userId: string): string {
    return `wallet:${userId}:processed`;
  }

  /**
   * Process a wallet transaction atomically
   * 
   * @param userId - The user's unique identifier
   * @param amount - The amount to add (positive) or deduct (negative)
   * @param type - The type of transaction
   * @param currency - The currency (default: USDT)
   * @param transactionId - Optional transaction ID for idempotency
   * @returns TransactionResult with success status and new balance
   */
  async processTransaction(
    userId: string,
    amount: Decimal | number | string,
    type: TransactionType,
    currency: string = 'USDT',
    transactionId?: string
  ): Promise<TransactionResult> {
    // Generate transaction ID if not provided
    const txId = transactionId || uuidv4();
    
    // Convert amount to Decimal for precision
    const decimalAmount = new Decimal(amount);
    
    // Get Redis keys
    const balanceKey = this.getBalanceKey(userId, currency);
    const processedKey = this.getProcessedKey(userId);

    try {
      // Execute the Lua script atomically using EVALSHA (faster than EVAL)
      const result = await this.redis.evalsha(
        this.luaScriptSha,
        2, // Number of keys
        balanceKey,
        processedKey,
        decimalAmount.toString(),
        txId,
        type
      ) as string[];

      // Parse the result
      const [status, value, returnedTxId] = result;

      if (status === 'OK') {
        this.logger.debug(
          `Transaction ${txId} successful. New balance: ${value}`
        );
        
        return {
          success: true,
          transactionId: returnedTxId,
          newBalance: new Decimal(value),
        };
      } else {
        // status === 'ERROR'
        const errorCode = value;
        const currentBalance = returnedTxId;
        
        this.logger.warn(
          `Transaction ${txId} failed. Error: ${errorCode}, Balance: ${currentBalance}`
        );

        return {
          success: false,
          transactionId: txId,
          newBalance: new Decimal(currentBalance),
          errorCode: errorCode,
          errorMessage: this.getErrorMessage(errorCode),
        };
      }
    } catch (error) {
      this.logger.error(`Transaction ${txId} error:`, error);
      
      // If EVALSHA fails (script not cached), fall back to EVAL
      if (error.message?.includes('NOSCRIPT')) {
        this.logger.warn('Script not found in Redis, reloading...');
        this.luaScriptSha = await this.redis.script('LOAD', this.luaScript);
        // Retry the transaction
        return this.processTransaction(userId, amount, type, currency, txId);
      }

      throw error;
    }
  }

  /**
   * Place a bet - convenience method for betting transactions
   * 
   * @param userId - The user's unique identifier
   * @param amount - The bet amount (must be positive, will be negated internally)
   * @param currency - The currency (default: USDT)
   * @returns TransactionResult
   */
  async placeBet(
    userId: string,
    amount: Decimal | number | string,
    currency: string = 'USDT'
  ): Promise<TransactionResult> {
    const decimalAmount = new Decimal(amount);
    
    if (decimalAmount.lte(0)) {
      return {
        success: false,
        transactionId: '',
        newBalance: new Decimal(0),
        errorCode: 'INVALID_AMOUNT',
        errorMessage: 'Bet amount must be positive',
      };
    }

    // Negate the amount for deduction
    return this.processTransaction(
      userId,
      decimalAmount.negated(),
      TransactionType.BET,
      currency
    );
  }

  /**
   * Credit winnings - convenience method for win transactions
   * 
   * @param userId - The user's unique identifier
   * @param amount - The win amount (must be positive)
   * @param currency - The currency (default: USDT)
   * @returns TransactionResult
   */
  async creditWin(
    userId: string,
    amount: Decimal | number | string,
    currency: string = 'USDT'
  ): Promise<TransactionResult> {
    const decimalAmount = new Decimal(amount);
    
    if (decimalAmount.lte(0)) {
      return {
        success: false,
        transactionId: '',
        newBalance: new Decimal(0),
        errorCode: 'INVALID_AMOUNT',
        errorMessage: 'Win amount must be positive',
      };
    }

    return this.processTransaction(
      userId,
      decimalAmount,
      TransactionType.WIN,
      currency
    );
  }

  /**
   * Get current balance for a user
   * 
   * @param userId - The user's unique identifier
   * @param currency - The currency (default: USDT)
   * @returns Current balance as Decimal
   */
  async getBalance(
    userId: string,
    currency: string = 'USDT'
  ): Promise<Decimal> {
    const balanceKey = this.getBalanceKey(userId, currency);
    const balance = await this.redis.get(balanceKey);
    return new Decimal(balance || '0');
  }

  /**
   * Set initial balance for a user (for testing/deposits)
   * 
   * @param userId - The user's unique identifier
   * @param amount - The initial balance
   * @param currency - The currency (default: USDT)
   */
  async setBalance(
    userId: string,
    amount: Decimal | number | string,
    currency: string = 'USDT'
  ): Promise<void> {
    const balanceKey = this.getBalanceKey(userId, currency);
    await this.redis.set(balanceKey, new Decimal(amount).toString());
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      INSUFFICIENT_FUNDS: 'Insufficient balance for this transaction',
      DUPLICATE_TRANSACTION: 'This transaction has already been processed',
      INVALID_AMOUNT: 'Invalid transaction amount',
    };
    return messages[errorCode] || 'Unknown error occurred';
  }

  /**
   * Clean up Redis connection on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
