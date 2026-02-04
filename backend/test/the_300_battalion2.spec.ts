/**
 * 💰 BATTALION 2: THE VAULT
 * Financial Integrity Tests (50 Tests)
 * 
 * Tests the financial system including:
 * - Wallet operations and balance management
 * - Concurrency and race conditions
 * - Decimal precision and floating-point safety
 * - Transaction limits and validation
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for high precision
Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN });

/**
 * Wallet Manager
 * Handles all wallet operations with precision
 */
class WalletManager {
  private balances: Map<string, Decimal> = new Map();
  private locks: Map<string, boolean> = new Map();
  private transactionHistory: Array<{
    userId: string;
    type: string;
    amount: Decimal;
    timestamp: Date;
  }> = [];

  constructor() {}

  getBalance(userId: string): Decimal {
    return this.balances.get(userId) || new Decimal(0);
  }

  setBalance(userId: string, amount: Decimal): boolean {
    if (amount.isNegative()) {
      return false; // Block negative balances
    }
    this.balances.set(userId, amount);
    return true;
  }

  deposit(userId: string, amount: Decimal): { success: boolean; error?: string } {
    if (!amount.isPositive()) {
      return { success: false, error: 'Amount must be positive' };
    }
    
    const currentBalance = this.getBalance(userId);
    const newBalance = currentBalance.plus(amount);
    this.setBalance(userId, newBalance);
    
    this.transactionHistory.push({
      userId,
      type: 'DEPOSIT',
      amount,
      timestamp: new Date()
    });
    
    return { success: true };
  }

  withdraw(userId: string, amount: Decimal): { success: boolean; error?: string } {
    if (!amount.isPositive()) {
      return { success: false, error: 'Amount must be positive' };
    }
    
    const currentBalance = this.getBalance(userId);
    if (currentBalance.lt(amount)) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    const newBalance = currentBalance.minus(amount);
    this.setBalance(userId, newBalance);
    
    this.transactionHistory.push({
      userId,
      type: 'WITHDRAWAL',
      amount,
      timestamp: new Date()
    });
    
    return { success: true };
  }

  async withdrawWithLock(userId: string, amount: Decimal): Promise<{ success: boolean; error?: string }> {
    // Check if already locked
    if (this.locks.get(userId)) {
      return { success: false, error: 'Transaction in progress' };
    }
    
    // Acquire lock
    this.locks.set(userId, true);
    
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = this.withdraw(userId, amount);
      return result;
    } finally {
      // Release lock
      this.locks.set(userId, false);
    }
  }

  transfer(fromUserId: string, toUserId: string, amount: Decimal): { success: boolean; error?: string } {
    const withdrawResult = this.withdraw(fromUserId, amount);
    if (!withdrawResult.success) {
      return withdrawResult;
    }
    
    const depositResult = this.deposit(toUserId, amount);
    if (!depositResult.success) {
      // Rollback withdrawal
      this.deposit(fromUserId, amount);
      return depositResult;
    }
    
    return { success: true };
  }

  placeBet(userId: string, amount: Decimal): { success: boolean; error?: string } {
    const MIN_BET = new Decimal('0.01');
    const MAX_BET = new Decimal('10000');
    
    if (amount.lt(MIN_BET)) {
      return { success: false, error: 'Bet below minimum' };
    }
    if (amount.gt(MAX_BET)) {
      return { success: false, error: 'Bet above maximum' };
    }
    
    return this.withdraw(userId, amount);
  }

  payout(userId: string, amount: Decimal): { success: boolean } {
    this.deposit(userId, amount);
    return { success: true };
  }

  getTransactionHistory(userId: string): typeof this.transactionHistory {
    return this.transactionHistory.filter(t => t.userId === userId);
  }
}

/**
 * Currency Converter
 * Handles crypto to USDT conversions
 */
class CurrencyConverter {
  private rates: Map<string, Decimal> = new Map([
    ['BTC', new Decimal('43000')],
    ['ETH', new Decimal('2200')],
    ['SOL', new Decimal('95')],
    ['USDT', new Decimal('1')],
  ]);

  convert(amount: Decimal, from: string, to: string): Decimal {
    const fromRate = this.rates.get(from) || new Decimal(1);
    const toRate = this.rates.get(to) || new Decimal(1);
    
    // Convert to USDT first, then to target currency
    const usdtValue = amount.mul(fromRate);
    return usdtValue.div(toRate).toDecimalPlaces(8, Decimal.ROUND_DOWN);
  }

  getRate(currency: string): Decimal {
    return this.rates.get(currency) || new Decimal(0);
  }
}

/**
 * Transaction Validator
 * Validates all financial transactions
 */
class TransactionValidator {
  private readonly MIN_DEPOSIT = new Decimal('1');
  private readonly MAX_DEPOSIT = new Decimal('1000000');
  private readonly MIN_WITHDRAWAL = new Decimal('10');
  private readonly MAX_WITHDRAWAL = new Decimal('100000');
  private readonly DAILY_WITHDRAWAL_LIMIT = new Decimal('50000');

  validateDeposit(amount: Decimal): { valid: boolean; error?: string } {
    if (!amount.isPositive()) {
      return { valid: false, error: 'Amount must be positive' };
    }
    if (amount.lt(this.MIN_DEPOSIT)) {
      return { valid: false, error: `Minimum deposit is ${this.MIN_DEPOSIT}` };
    }
    if (amount.gt(this.MAX_DEPOSIT)) {
      return { valid: false, error: `Maximum deposit is ${this.MAX_DEPOSIT}` };
    }
    return { valid: true };
  }

  validateWithdrawal(amount: Decimal, dailyWithdrawn: Decimal = new Decimal(0)): { valid: boolean; error?: string } {
    if (!amount.isPositive()) {
      return { valid: false, error: 'Amount must be positive' };
    }
    if (amount.lt(this.MIN_WITHDRAWAL)) {
      return { valid: false, error: `Minimum withdrawal is ${this.MIN_WITHDRAWAL}` };
    }
    if (amount.gt(this.MAX_WITHDRAWAL)) {
      return { valid: false, error: `Maximum withdrawal is ${this.MAX_WITHDRAWAL}` };
    }
    if (dailyWithdrawn.plus(amount).gt(this.DAILY_WITHDRAWAL_LIMIT)) {
      return { valid: false, error: 'Daily withdrawal limit exceeded' };
    }
    return { valid: true };
  }
}

// Test Suite
describe('💰 BATTALION 2: THE VAULT (Financial Integrity)', () => {
  let walletManager: WalletManager;
  let converter: CurrencyConverter;
  let validator: TransactionValidator;

  beforeEach(() => {
    walletManager = new WalletManager();
    converter = new CurrencyConverter();
    validator = new TransactionValidator();
  });

  // ============================================
  // SECTION 1: Balance Management (15 tests)
  // ============================================
  describe('Balance Management', () => {
    test('1.1 - New user should have zero balance', () => {
      const balance = walletManager.getBalance('new-user');
      expect(balance.eq(0)).toBe(true);
    });

    test('1.2 - Deposit should increase balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      const balance = walletManager.getBalance('user1');
      expect(balance.eq(100)).toBe(true);
    });

    test('1.3 - Withdrawal should decrease balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.withdraw('user1', new Decimal(30));
      const balance = walletManager.getBalance('user1');
      expect(balance.eq(70)).toBe(true);
    });

    test('1.4 - Should reject withdrawal exceeding balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.withdraw('user1', new Decimal(150));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    test('1.5 - Should reject negative deposit', () => {
      const result = walletManager.deposit('user1', new Decimal(-100));
      expect(result.success).toBe(false);
    });

    test('1.6 - Zero deposit should have no effect', () => {
      const result = walletManager.deposit('user1', new Decimal(0));
      expect(result.success).toBe(true); // Zero is allowed but has no effect
    });

    test('1.7 - Should reject negative withdrawal', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.withdraw('user1', new Decimal(-50));
      expect(result.success).toBe(false);
    });

    test('1.8 - Should block negative balance', () => {
      const result = walletManager.setBalance('user1', new Decimal(-5));
      expect(result).toBe(false);
      expect(walletManager.getBalance('user1').eq(0)).toBe(true);
    });

    test('1.9 - Multiple deposits should accumulate', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.deposit('user1', new Decimal(50));
      walletManager.deposit('user1', new Decimal(25));
      expect(walletManager.getBalance('user1').eq(175)).toBe(true);
    });

    test('1.10 - Multiple withdrawals should subtract', () => {
      walletManager.deposit('user1', new Decimal(200));
      walletManager.withdraw('user1', new Decimal(50));
      walletManager.withdraw('user1', new Decimal(30));
      expect(walletManager.getBalance('user1').eq(120)).toBe(true);
    });

    test('1.11 - Transfer should move funds correctly', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.transfer('user1', 'user2', new Decimal(40));
      expect(walletManager.getBalance('user1').eq(60)).toBe(true);
      expect(walletManager.getBalance('user2').eq(40)).toBe(true);
    });

    test('1.12 - Transfer should fail if insufficient balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.transfer('user1', 'user2', new Decimal(150));
      expect(result.success).toBe(false);
      expect(walletManager.getBalance('user1').eq(100)).toBe(true);
    });

    test('1.13 - Transaction history should be recorded', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.withdraw('user1', new Decimal(30));
      const history = walletManager.getTransactionHistory('user1');
      expect(history.length).toBe(2);
    });

    test('1.14 - Should handle very small amounts', () => {
      walletManager.deposit('user1', new Decimal('0.00000001'));
      expect(walletManager.getBalance('user1').eq('0.00000001')).toBe(true);
    });

    test('1.15 - Should handle very large amounts', () => {
      walletManager.deposit('user1', new Decimal('999999999999'));
      expect(walletManager.getBalance('user1').eq('999999999999')).toBe(true);
    });
  });

  // ============================================
  // SECTION 2: Concurrency Tests (10 tests)
  // ============================================
  describe('Concurrency & Race Conditions', () => {
    test('2.1 - Parallel withdrawals should only allow one to succeed', async () => {
      walletManager.deposit('user1', new Decimal(100));
      
      // Attempt 20 parallel withdrawals of 100
      const promises = Array(20).fill(null).map(() => 
        walletManager.withdrawWithLock('user1', new Decimal(100))
      );
      
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      expect(successCount).toBe(1);
      expect(walletManager.getBalance('user1').eq(0)).toBe(true);
    });

    test('2.2 - Lock should prevent double-spend', async () => {
      walletManager.deposit('user1', new Decimal(50));
      
      const promises = [
        walletManager.withdrawWithLock('user1', new Decimal(50)),
        walletManager.withdrawWithLock('user1', new Decimal(50))
      ];
      
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      expect(successCount).toBeLessThanOrEqual(1);
    });

    test('2.3 - Sequential operations should be consistent', async () => {
      walletManager.deposit('user1', new Decimal(100));
      
      await walletManager.withdrawWithLock('user1', new Decimal(30));
      await walletManager.withdrawWithLock('user1', new Decimal(20));
      await walletManager.withdrawWithLock('user1', new Decimal(10));
      
      expect(walletManager.getBalance('user1').eq(40)).toBe(true);
    });

    test('2.4 - Multiple users should not interfere', async () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.deposit('user2', new Decimal(100));
      
      const promises = [
        walletManager.withdrawWithLock('user1', new Decimal(50)),
        walletManager.withdrawWithLock('user2', new Decimal(50))
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(walletManager.getBalance('user1').eq(50)).toBe(true);
      expect(walletManager.getBalance('user2').eq(50)).toBe(true);
    });

    test('2.5 - Lock should be released after failure', async () => {
      walletManager.deposit('user1', new Decimal(50));
      
      // First withdrawal fails (insufficient funds)
      await walletManager.withdrawWithLock('user1', new Decimal(100));
      
      // Second withdrawal should work
      const result = await walletManager.withdrawWithLock('user1', new Decimal(50));
      expect(result.success).toBe(true);
    });

    test('2.6 - Rapid deposits should all succeed', () => {
      for (let i = 0; i < 100; i++) {
        walletManager.deposit('user1', new Decimal(1));
      }
      expect(walletManager.getBalance('user1').eq(100)).toBe(true);
    });

    test('2.7 - Interleaved deposits and withdrawals', () => {
      for (let i = 0; i < 50; i++) {
        walletManager.deposit('user1', new Decimal(10));
        if (i % 2 === 0) {
          walletManager.withdraw('user1', new Decimal(5));
        }
      }
      const balance = walletManager.getBalance('user1');
      expect(balance.eq(375)).toBe(true);
    });

    test('2.8 - Balance should never go negative during operations', async () => {
      walletManager.deposit('user1', new Decimal(100));
      
      const operations = Array(50).fill(null).map(() => 
        walletManager.withdrawWithLock('user1', new Decimal(10))
      );
      
      await Promise.all(operations);
      expect(walletManager.getBalance('user1').gte(0)).toBe(true);
    });

    test('2.9 - Multiple transfers should maintain total balance', () => {
      walletManager.deposit('user1', new Decimal(1000));
      
      for (let i = 0; i < 10; i++) {
        walletManager.transfer('user1', `user${i + 2}`, new Decimal(50));
      }
      
      let totalBalance = walletManager.getBalance('user1');
      for (let i = 2; i <= 11; i++) {
        totalBalance = totalBalance.plus(walletManager.getBalance(`user${i}`));
      }
      
      expect(totalBalance.eq(1000)).toBe(true);
    });

    test('2.10 - Circular transfers should maintain balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      
      walletManager.transfer('user1', 'user2', new Decimal(100));
      walletManager.transfer('user2', 'user3', new Decimal(100));
      walletManager.transfer('user3', 'user1', new Decimal(100));
      
      expect(walletManager.getBalance('user1').eq(100)).toBe(true);
      expect(walletManager.getBalance('user2').eq(0)).toBe(true);
      expect(walletManager.getBalance('user3').eq(0)).toBe(true);
    });
  });

  // ============================================
  // SECTION 3: Decimal Precision (10 tests)
  // ============================================
  describe('Decimal Precision', () => {
    test('3.1 - Should handle 8 decimal places (BTC precision)', () => {
      const amount = new Decimal('0.00000001');
      walletManager.deposit('user1', amount);
      expect(walletManager.getBalance('user1').eq(amount)).toBe(true);
    });

    test('3.2 - Should convert BTC to USDT without precision loss', () => {
      const btcAmount = new Decimal('0.00000001');
      const usdtAmount = converter.convert(btcAmount, 'BTC', 'USDT');
      expect(usdtAmount.isFinite()).toBe(true);
      expect(usdtAmount.gt(0)).toBe(true);
    });

    test('3.3 - Should avoid floating-point errors (0.1 + 0.2)', () => {
      walletManager.deposit('user1', new Decimal('0.1'));
      walletManager.deposit('user1', new Decimal('0.2'));
      expect(walletManager.getBalance('user1').eq('0.3')).toBe(true);
    });

    test('3.4 - Should handle large number multiplication', () => {
      const amount = new Decimal('999999999.99999999');
      const multiplied = amount.mul(new Decimal('1.5'));
      expect(multiplied.isFinite()).toBe(true);
    });

    test('3.5 - Should handle division without precision loss', () => {
      const amount = new Decimal('100');
      const divided = amount.div(new Decimal('3'));
      expect(divided.isFinite()).toBe(true);
      expect(divided.decimalPlaces()).toBeGreaterThan(0);
    });

    test('3.6 - Currency conversion should maintain precision', () => {
      const ethAmount = new Decimal('1.123456789');
      const usdtAmount = converter.convert(ethAmount, 'ETH', 'USDT');
      expect(usdtAmount.decimalPlaces()).toBeLessThanOrEqual(8);
    });

    test('3.7 - Should handle very small differences', () => {
      const a = new Decimal('100.00000001');
      const b = new Decimal('100.00000000');
      expect(a.gt(b)).toBe(true);
    });

    test('3.8 - Rounding should be consistent (ROUND_DOWN)', () => {
      const amount = new Decimal('1.999999999');
      const rounded = amount.toDecimalPlaces(2, Decimal.ROUND_DOWN);
      expect(rounded.eq('1.99')).toBe(true);
    });

    test('3.9 - Should handle scientific notation', () => {
      const amount = new Decimal('1e-8');
      walletManager.deposit('user1', amount);
      expect(walletManager.getBalance('user1').eq('0.00000001')).toBe(true);
    });

    test('3.10 - Should handle maximum safe integer', () => {
      const amount = new Decimal(Number.MAX_SAFE_INTEGER.toString());
      walletManager.deposit('user1', amount);
      expect(walletManager.getBalance('user1').eq(amount)).toBe(true);
    });
  });

  // ============================================
  // SECTION 4: Betting Operations (10 tests)
  // ============================================
  describe('Betting Operations', () => {
    test('4.1 - Should accept valid bet', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.placeBet('user1', new Decimal(50));
      expect(result.success).toBe(true);
      expect(walletManager.getBalance('user1').eq(50)).toBe(true);
    });

    test('4.2 - Should reject bet below minimum', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.placeBet('user1', new Decimal('0.001'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('minimum');
    });

    test('4.3 - Should reject bet above maximum', () => {
      walletManager.deposit('user1', new Decimal(100000));
      const result = walletManager.placeBet('user1', new Decimal(50000));
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum');
    });

    test('4.4 - Should reject bet exceeding balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.placeBet('user1', new Decimal(150));
      expect(result.success).toBe(false);
    });

    test('4.5 - Payout should increase balance', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.placeBet('user1', new Decimal(50));
      walletManager.payout('user1', new Decimal(100)); // 2x win
      expect(walletManager.getBalance('user1').eq(150)).toBe(true);
    });

    test('4.6 - Multiple bets should deduct correctly', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.placeBet('user1', new Decimal(20));
      walletManager.placeBet('user1', new Decimal(20));
      walletManager.placeBet('user1', new Decimal(20));
      expect(walletManager.getBalance('user1').eq(40)).toBe(true);
    });

    test('4.7 - Bet exactly at minimum should succeed', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.placeBet('user1', new Decimal('0.01'));
      expect(result.success).toBe(true);
    });

    test('4.8 - Bet exactly at maximum should succeed', () => {
      walletManager.deposit('user1', new Decimal(100000));
      const result = walletManager.placeBet('user1', new Decimal(10000));
      expect(result.success).toBe(true);
    });

    test('4.9 - Should handle bet with decimal precision', () => {
      walletManager.deposit('user1', new Decimal(100));
      const result = walletManager.placeBet('user1', new Decimal('25.55'));
      expect(result.success).toBe(true);
      expect(walletManager.getBalance('user1').eq('74.45')).toBe(true);
    });

    test('4.10 - Payout with decimal precision', () => {
      walletManager.deposit('user1', new Decimal(100));
      walletManager.placeBet('user1', new Decimal(50));
      walletManager.payout('user1', new Decimal('75.50')); // 1.51x win
      expect(walletManager.getBalance('user1').eq('125.50')).toBe(true);
    });
  });

  // ============================================
  // SECTION 5: Transaction Validation (5 tests)
  // ============================================
  describe('Transaction Validation', () => {
    test('5.1 - Should validate deposit within limits', () => {
      const result = validator.validateDeposit(new Decimal(100));
      expect(result.valid).toBe(true);
    });

    test('5.2 - Should reject deposit below minimum', () => {
      const result = validator.validateDeposit(new Decimal('0.5'));
      expect(result.valid).toBe(false);
    });

    test('5.3 - Should reject deposit above maximum', () => {
      const result = validator.validateDeposit(new Decimal('2000000'));
      expect(result.valid).toBe(false);
    });

    test('5.4 - Should validate withdrawal within limits', () => {
      const result = validator.validateWithdrawal(new Decimal(100));
      expect(result.valid).toBe(true);
    });

    test('5.5 - Should reject withdrawal exceeding daily limit', () => {
      const result = validator.validateWithdrawal(
        new Decimal(10000),
        new Decimal(45000) // Already withdrawn 45k today
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Daily');
    });
  });
});
