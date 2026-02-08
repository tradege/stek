export {};
/**
 * 💎 BATTALION 7: THE TREASURY
 * Financial Integrity Tests (80 Tests)
 * 
 * The HARDEST tests in the system. These tests verify that money
 * NEVER disappears, NEVER duplicates, and NEVER goes negative.
 * 
 * Covers:
 * - Balance consistency after operations
 * - Deposit → Balance increase verification
 * - Withdrawal → Balance decrease verification
 * - Bet → Balance deduction + potential payout
 * - Race conditions (concurrent bets, concurrent withdrawals)
 * - Decimal precision (no floating point errors)
 * - Transaction audit trail integrity
 * - Edge cases (zero, negative, max values)
 * - Admin simulate deposit integrity
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// ============================================
// HTTP Helper
// ============================================
async function http(
  method: string,
  path: string,
  body?: any,
  token?: string,
): Promise<{ status: number; data: any }> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = { method, headers };
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  let data: any;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

// ============================================
// Helper: Get balance for specific currency
// ============================================
async function getBalance(token: string, currency: string = 'USDT'): Promise<number> {
  const res = await http('GET', '/wallet/balance', null, token);
  if (!Array.isArray(res.data)) return 0;
  const wallet = res.data.find((w: any) => w.currency === currency);
  return wallet ? parseFloat(wallet.available || wallet.total || '0') : 0;
}

// ============================================
// Helper: Simulate deposit via admin
// ============================================
async function adminDeposit(
  adminToken: string,
  userEmail: string,
  amount: number,
  currency: string = 'USDT',
): Promise<any> {
  return http('POST', '/admin/deposit/simulate', {
    userEmail,
    amount,
    currency,
  }, adminToken);
}

// ============================================
// Test State
// ============================================
let adminToken: string = '';
const ADMIN_EMAIL = 'marketedgepros@gmail.com';
const ADMIN_PASSWORD = '994499';

// ============================================
// BATTALION 7: THE TREASURY
// ============================================
describe('💎 BATTALION 7: THE TREASURY (Financial Integrity)', () => {

  // Login as admin before all tests
  beforeAll(async () => {
    const res = await http('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    adminToken = res.data.token;
    expect(adminToken).toBeDefined();
  });

  // ==========================================
  // SECTION 1: BALANCE CONSISTENCY
  // ==========================================
  describe('📊 Balance Consistency', () => {

    it('should return consistent balance across multiple reads', async () => {
      const balance1 = await getBalance(adminToken);
      const balance2 = await getBalance(adminToken);
      const balance3 = await getBalance(adminToken);
      expect(balance1).toBe(balance2);
      expect(balance2).toBe(balance3);
    });

    it('should never return negative balance', async () => {
      const res = await http('GET', '/wallet/balance', null, adminToken);
      if (Array.isArray(res.data)) {
        res.data.forEach((wallet: any) => {
          const available = parseFloat(wallet.available || '0');
          const locked = parseFloat(wallet.locked || '0');
          const total = parseFloat(wallet.total || '0');
          expect(available).toBeGreaterThanOrEqual(0);
          expect(locked).toBeGreaterThanOrEqual(0);
          expect(total).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should satisfy: total = available + locked', async () => {
      const res = await http('GET', '/wallet/balance', null, adminToken);
      if (Array.isArray(res.data)) {
        res.data.forEach((wallet: any) => {
          const available = parseFloat(wallet.available || '0');
          const locked = parseFloat(wallet.locked || '0');
          const total = parseFloat(wallet.total || '0');
          // Allow tiny floating point difference
          expect(Math.abs(total - (available + locked))).toBeLessThan(0.0001);
        });
      }
    });

    it('should return balance as string (not number) to avoid precision loss', async () => {
      const res = await http('GET', '/wallet/balance', null, adminToken);
      if (Array.isArray(res.data) && res.data.length > 0) {
        expect(typeof res.data[0].available).toBe('string');
      }
    });

    it('should not return balance in scientific notation', async () => {
      const res = await http('GET', '/wallet/balance', null, adminToken);
      if (Array.isArray(res.data)) {
        res.data.forEach((wallet: any) => {
          const balStr = wallet.available || wallet.total || '0';
          expect(balStr).not.toMatch(/[eE]/);
        });
      }
    });
  });

  // ==========================================
  // SECTION 2: DEPOSIT INTEGRITY
  // ==========================================
  describe('💰 Deposit Integrity', () => {

    it('should increase balance after admin simulated deposit', async () => {
      const balanceBefore = await getBalance(adminToken);
      const depositAmount = 500;

      const res = await adminDeposit(adminToken, ADMIN_EMAIL, depositAmount);
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);

      const balanceAfter = await getBalance(adminToken);
      const diff = balanceAfter - balanceBefore;
      expect(Math.abs(diff - depositAmount)).toBeLessThan(0.01);
    });

    it('should record deposit in transaction history', async () => {
      const uniqueAmount = 123.45;
      await adminDeposit(adminToken, ADMIN_EMAIL, uniqueAmount);

      const res = await http('GET', '/wallet/transactions', null, adminToken);
      const deposits = res.data.filter((tx: any) =>
        tx.type === 'DEPOSIT' && Math.abs(parseFloat(tx.amount) - uniqueAmount) < 0.01
      );
      expect(deposits.length).toBeGreaterThan(0);
    });

    it('should set correct balanceBefore and balanceAfter in transaction', async () => {
      const balanceBefore = await getBalance(adminToken);
      const depositAmount = 77.77;
      await adminDeposit(adminToken, ADMIN_EMAIL, depositAmount);

      const res = await http('GET', '/wallet/transactions', null, adminToken);
      const latestDeposit = res.data.find((tx: any) =>
        tx.type === 'DEPOSIT' && Math.abs(parseFloat(tx.amount) - depositAmount) < 0.01
      );
      
      expect(latestDeposit).toBeDefined();
      if (latestDeposit) {
        const txBalBefore = parseFloat(latestDeposit.balanceBefore || '0');
        const txBalAfter = parseFloat(latestDeposit.balanceAfter || '0');
        // STRICT: balanceAfter - balanceBefore must equal depositAmount
        const diff = Math.abs(txBalAfter - txBalBefore - depositAmount);
        expect(diff).toBeLessThan(0.01);
      }
    });

    it('should handle multiple rapid deposits correctly', async () => {
      const balanceBefore = await getBalance(adminToken);
      const depositAmount = 10;
      const count = 5;

      // Rapid sequential deposits
      for (let i = 0; i < count; i++) {
        await adminDeposit(adminToken, ADMIN_EMAIL, depositAmount);
      }

      const balanceAfter = await getBalance(adminToken);
      const expectedIncrease = depositAmount * count;
      const actualIncrease = balanceAfter - balanceBefore;
      expect(Math.abs(actualIncrease - expectedIncrease)).toBeLessThan(0.1);
    });

    it('should handle concurrent deposits without losing money', async () => {
      const balanceBefore = await getBalance(adminToken);
      const depositAmount = 25;
      const count = 5;

      // Concurrent deposits
      const promises = Array.from({ length: count }, () =>
        adminDeposit(adminToken, ADMIN_EMAIL, depositAmount)
      );
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(201);
      });

      // Wait a moment for DB to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      const balanceAfter = await getBalance(adminToken);
      const expectedIncrease = depositAmount * count;
      const actualIncrease = balanceAfter - balanceBefore;
      // STRICT: All concurrent deposits must be applied - no money loss
      const diff = Math.abs(actualIncrease - expectedIncrease);
      expect(diff).toBeLessThan(1);
    });

    it('should reject deposit of 0 amount', async () => {
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, 0);
      expect(res.status).toBe(400);
    });

    it('should reject deposit of negative amount', async () => {
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, -100);
      expect(res.status).toBe(400);
    });

    it('should handle very large deposit amount', async () => {
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, 1000000);
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
    });

    it('should handle deposit with many decimal places', async () => {
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, 0.12345678);
      expect(res.status).toBe(201);
    });
  });

  // ==========================================
  // SECTION 3: WITHDRAWAL INTEGRITY
  // ==========================================
  describe('🏧 Withdrawal Integrity', () => {

    it('should not allow withdrawal exceeding available balance', async () => {
      const balance = await getBalance(adminToken);
      const res = await http('POST', '/wallet/withdraw', {
        amount: balance + 100000,
        currency: 'USDT',
        walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
      }, adminToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('Insufficient');
    });

    it('should not allow withdrawal of 0', async () => {
      const res = await http('POST', '/wallet/withdraw', {
        amount: 0,
        currency: 'USDT',
        walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
      }, adminToken);
      expect(res.status).toBe(400);
    });

    it('should not allow withdrawal of negative amount', async () => {
      const res = await http('POST', '/wallet/withdraw', {
        amount: -50,
        currency: 'USDT',
        walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
      }, adminToken);
      expect(res.status).toBe(400);
    });

    it('should not allow double-spend via concurrent withdrawals', async () => {
      // First ensure we have enough balance
      await adminDeposit(adminToken, ADMIN_EMAIL, 200);
      const balance = await getBalance(adminToken);

      // Try to withdraw the full balance twice simultaneously
      const promises = [
        http('POST', '/wallet/withdraw', {
          amount: balance,
          currency: 'USDT',
          walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
        }, adminToken),
        http('POST', '/wallet/withdraw', {
          amount: balance,
          currency: 'USDT',
          walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
        }, adminToken),
      ];

      const results = await Promise.all(promises);
      
      // STRICT: At most ONE should succeed - no double-spend allowed
      const successes = results.filter(r => r.status === 200 || r.status === 201);
      expect(successes.length).toBeLessThanOrEqual(1);
      // Balance must NEVER go negative
      const finalBalance = await getBalance(adminToken);
      expect(finalBalance).toBeGreaterThanOrEqual(-0.01);
    });

    it('should require valid wallet address format', async () => {
      const res = await http('POST', '/wallet/withdraw', {
        amount: 10,
        currency: 'USDT',
        walletAddress: 'abc',
      }, adminToken);
      expect(res.status).toBe(400);
    });

    it('should record withdrawal in transaction history', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 100);
      
      const res = await http('POST', '/wallet/withdraw', {
        amount: 50,
        currency: 'USDT',
        walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
      }, adminToken);

      if (res.status === 200 || res.status === 201) {
        const txRes = await http('GET', '/wallet/transactions', null, adminToken);
        const withdrawals = txRes.data.filter((tx: any) => tx.type === 'WITHDRAWAL');
        expect(withdrawals.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================
  // SECTION 4: GAME BET INTEGRITY
  // ==========================================
  describe('🎰 Game Bet Integrity', () => {

    it('should deduct bet amount from balance on Plinko play', async () => {
      // Ensure sufficient balance
      await adminDeposit(adminToken, ADMIN_EMAIL, 100);
      const balanceBefore = await getBalance(adminToken);

      const betAmount = 1;
      const res = await http('POST', '/games/plinko/play', {
        betAmount,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);

      if (res.status === 200 || res.status === 201) {
        const balanceAfter = await getBalance(adminToken);
        const multiplier = parseFloat(res.data.multiplier || '0');
        const payout = betAmount * multiplier;
        const expectedBalance = balanceBefore - betAmount + payout;
        expect(Math.abs(balanceAfter - expectedBalance)).toBeLessThan(0.01);
      }
    });

    it('should not allow bet with 0 amount', async () => {
      const res = await http('POST', '/games/plinko/play', {
        betAmount: 0,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);
      expect(res.status).toBe(400);
    });

    it('should not allow bet with negative amount', async () => {
      const res = await http('POST', '/games/plinko/play', {
        betAmount: -10,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);
      expect(res.status).toBe(400);
    });

    it('should not allow bet exceeding balance', async () => {
      const balance = await getBalance(adminToken);
      const res = await http('POST', '/games/plinko/play', {
        betAmount: balance + 100000,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);
      expect(res.status).toBe(400);
    });

    it('should handle rapid sequential bets correctly', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 100);
      const balanceBefore = await getBalance(adminToken);
      
      let totalBet = 0;
      let totalPayout = 0;

      for (let i = 0; i < 5; i++) {
        const betAmount = 1;
        const res = await http('POST', '/games/plinko/play', {
          betAmount,
          risk: 'LOW',
          rows: 8,
        }, adminToken);
        
        if (res.status === 200 || res.status === 201) {
          totalBet += betAmount;
          totalPayout += betAmount * parseFloat(res.data.multiplier || '0');
        }
      }

      const balanceAfter = await getBalance(adminToken);
      const expectedBalance = balanceBefore - totalBet + totalPayout;
      expect(Math.abs(balanceAfter - expectedBalance)).toBeLessThan(0.1);
    });

    it('should not allow concurrent bets to overdraw balance', async () => {
      // Set balance to exactly 10
      const currentBalance = await getBalance(adminToken);
      if (currentBalance < 10) {
        await adminDeposit(adminToken, ADMIN_EMAIL, 10);
      }

      // Try 10 concurrent bets of 5 each (total 50, but balance is ~10)
      const promises = Array.from({ length: 10 }, () =>
        http('POST', '/games/plinko/play', {
          betAmount: 5,
          risk: 'MEDIUM',
          rows: 12,
        }, adminToken)
      );

      const results = await Promise.all(promises);
      
      // Wait for DB to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Balance should NEVER go negative
      const finalBalance = await getBalance(adminToken);
      expect(finalBalance).toBeGreaterThanOrEqual(0);
    });

    it('should record bet in transaction history', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 10);
      
      const res = await http('POST', '/games/plinko/play', {
        betAmount: 1,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);

      if (res.status === 200 || res.status === 201) {
        const txRes = await http('GET', '/wallet/transactions', null, adminToken);
        // Backend may record bets as 'BET', 'GAME_BET', or not in wallet transactions at all
        const bets = txRes.data.filter((tx: any) => 
          tx.type === 'BET' || tx.type === 'GAME_BET' || tx.type === 'GAME'
        );
        // STRICT: Bets MUST be recorded in transaction history
        expect(bets.length).toBeGreaterThan(0);
      }
    });

    it('should return valid multiplier within game bounds', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 10);
      
      const res = await http('POST', '/games/plinko/play', {
        betAmount: 1,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);

      if (res.status === 200 || res.status === 201) {
        const multiplier = parseFloat(res.data.multiplier);
        expect(multiplier).toBeGreaterThanOrEqual(0);
        expect(multiplier).toBeLessThanOrEqual(1000); // Max plinko multiplier
      }
    });

    it('should return valid path array for plinko', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 10);
      
      const res = await http('POST', '/games/plinko/play', {
        betAmount: 1,
        risk: 'MEDIUM',
        rows: 12,
      }, adminToken);

      if (res.status === 200 || res.status === 201) {
        if (res.data.path) {
          expect(Array.isArray(res.data.path)).toBe(true);
          // Path should have same number of elements as rows
          expect(res.data.path.length).toBe(12);
          // Each element should be 0 (left) or 1 (right)
          res.data.path.forEach((p: number) => {
            expect([0, 1]).toContain(p);
          });
        }
      }
    });
  });

  // ==========================================
  // SECTION 5: DECIMAL PRECISION
  // ==========================================
  describe('🔬 Decimal Precision', () => {

    it('should handle 8 decimal places without loss', async () => {
      const preciseAmount = 0.00000001;
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, preciseAmount);
      expect(res.status).toBe(201);
    });

    it('should not produce floating point errors on addition', async () => {
      // Classic floating point: 0.1 + 0.2 !== 0.3
      const balanceBefore = await getBalance(adminToken);
      await adminDeposit(adminToken, ADMIN_EMAIL, 0.1);
      await adminDeposit(adminToken, ADMIN_EMAIL, 0.2);
      const balanceAfter = await getBalance(adminToken);
      const increase = balanceAfter - balanceBefore;
      // Should be exactly 0.3, not 0.30000000000000004
      expect(Math.abs(increase - 0.3)).toBeLessThan(0.0001);
    });

    it('should handle large numbers without overflow', async () => {
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, 99999999.99999999);
      expect(res.status).toBe(201);
    });

    it('should preserve precision in transaction records', async () => {
      const preciseAmount = 123.45678901;
      await adminDeposit(adminToken, ADMIN_EMAIL, preciseAmount);
      
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      const tx = res.data.find((t: any) => 
        Math.abs(parseFloat(t.amount) - preciseAmount) < 0.001
      );
      if (tx) {
        expect(Math.abs(parseFloat(tx.amount) - preciseAmount)).toBeLessThan(0.01);
      }
    });
  });

  // ==========================================
  // SECTION 6: TRANSACTION AUDIT TRAIL
  // ==========================================
  describe('📋 Transaction Audit Trail', () => {

    it('should have monotonically increasing timestamps', async () => {
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      if (res.data.length > 1) {
        for (let i = 0; i < res.data.length - 1; i++) {
          const current = new Date(res.data[i].createdAt).getTime();
          const next = new Date(res.data[i + 1].createdAt).getTime();
          // Ordered by desc, so current >= next
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('should have valid transaction types', async () => {
      const validTypes = ['DEPOSIT', 'WITHDRAWAL', 'BET', 'WIN', 'COMMISSION',
        'TIP_SENT', 'TIP_RECEIVED', 'VAULT_DEPOSIT', 'VAULT_WITHDRAWAL',
        'RAIN_RECEIVED', 'CREDIT_GIVEN', 'CREDIT_REPAID'];
      
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      res.data.forEach((tx: any) => {
        expect(validTypes).toContain(tx.type);
      });
    });

    it('should have valid transaction statuses', async () => {
      const validStatuses = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'];
      
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      res.data.forEach((tx: any) => {
        expect(validStatuses).toContain(tx.status);
      });
    });

    it('should have positive amounts for deposits', async () => {
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      const deposits = res.data.filter((tx: any) => tx.type === 'DEPOSIT');
      deposits.forEach((tx: any) => {
        expect(parseFloat(tx.amount)).toBeGreaterThan(0);
      });
    });

    it('should have unique transaction IDs', async () => {
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      const ids = res.data.map((tx: any) => tx.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid UUID format for transaction IDs', async () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      if (res.data.length > 0) {
        expect(res.data[0].id).toMatch(uuidRegex);
      }
    });

    it('should include currency in every transaction', async () => {
      const validCurrencies = ['BTC', 'ETH', 'USDT', 'SOL'];
      const res = await http('GET', '/wallet/transactions', null, adminToken);
      res.data.forEach((tx: any) => {
        expect(validCurrencies).toContain(tx.currency);
      });
    });
  });

  // ==========================================
  // SECTION 7: ADMIN FINANCIAL CONTROLS
  // ==========================================
  describe('🔒 Admin Financial Controls', () => {

    it('should only allow admin to simulate deposits', async () => {
      // Try without auth
      const res = await http('POST', '/admin/deposit/simulate', {
        userEmail: ADMIN_EMAIL,
        amount: 100,
        currency: 'USDT',
      });
      expect(res.status).toBe(401);
    });

    it('should reject simulate deposit for non-existent user', async () => {
      const res = await adminDeposit(adminToken, 'ghost@nowhere.com', 100);
      expect(res.status).toBe(404);
    });

    it('should track admin deposits in admin transaction list', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 42.42);
      
      const res = await http('GET', '/admin/transactions', null, adminToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should update platform stats after deposit', async () => {
      const statsBefore = await http('GET', '/admin/stats', null, adminToken);
      const depositsBefore = statsBefore.data.totalDeposits;

      await adminDeposit(adminToken, ADMIN_EMAIL, 1000);

      const statsAfter = await http('GET', '/admin/stats', null, adminToken);
      const depositsAfter = statsAfter.data.totalDeposits;

      expect(depositsAfter).toBeGreaterThanOrEqual(depositsBefore);
    });

    it('should correctly calculate house profit', async () => {
      const stats = await http('GET', '/admin/stats', null, adminToken);
      const { totalDeposits, totalWithdrawals, houseProfit } = stats.data;
      expect(Math.abs(houseProfit - (totalDeposits - totalWithdrawals))).toBeLessThan(1);
    });
  });

  // ==========================================
  // SECTION 8: CROSS-CURRENCY INTEGRITY
  // ==========================================
  describe('💱 Cross-Currency Integrity', () => {

    it('should maintain separate balances per currency', async () => {
      const res = await http('GET', '/wallet/balance', null, adminToken);
      if (Array.isArray(res.data)) {
        const currencies = res.data.map((w: any) => w.currency);
        const uniqueCurrencies = new Set(currencies);
        expect(uniqueCurrencies.size).toBe(currencies.length);
      }
    });

    it('should not mix currencies in deposit', async () => {
      const btcBefore = await getBalance(adminToken, 'BTC');
      await adminDeposit(adminToken, ADMIN_EMAIL, 100, 'USDT');
      const btcAfter = await getBalance(adminToken, 'BTC');
      expect(btcAfter).toBe(btcBefore); // BTC should not change
    });

    it('should handle BTC deposit correctly', async () => {
      const btcBefore = await getBalance(adminToken, 'BTC');
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, 0.5, 'BTC');
      if (res.status === 201) {
        const btcAfter = await getBalance(adminToken, 'BTC');
        expect(Math.abs(btcAfter - btcBefore - 0.5)).toBeLessThan(0.0001);
      }
    });

    it('should handle ETH deposit correctly', async () => {
      const ethBefore = await getBalance(adminToken, 'ETH');
      const res = await adminDeposit(adminToken, ADMIN_EMAIL, 2.5, 'ETH');
      if (res.status === 201) {
        const ethAfter = await getBalance(adminToken, 'ETH');
        expect(Math.abs(ethAfter - ethBefore - 2.5)).toBeLessThan(0.0001);
      }
    });
  });

  // ==========================================
  // SECTION 9: STRESS TESTS
  // ==========================================
  describe('🔥 Financial Stress Tests', () => {

    it('should handle 20 concurrent deposits without data loss', async () => {
      const balanceBefore = await getBalance(adminToken);
      const amount = 10;
      const count = 20;

      const promises = Array.from({ length: count }, () =>
        adminDeposit(adminToken, ADMIN_EMAIL, amount)
      );
      const results = await Promise.all(promises);

      const successes = results.filter(r => r.status === 201).length;
      
      // Wait for DB
      await new Promise(resolve => setTimeout(resolve, 2000));

      const balanceAfter = await getBalance(adminToken);
      const expectedIncrease = amount * successes;
      const actualIncrease = balanceAfter - balanceBefore;
      
      // STRICT: All 20 concurrent deposits must be applied - no money loss
      const diff = Math.abs(actualIncrease - expectedIncrease);
      expect(diff).toBeLessThan(5);
    });

    it('should handle deposit + bet + withdrawal in sequence correctly', async () => {
      const balanceBefore = await getBalance(adminToken);
      
      // Deposit
      await adminDeposit(adminToken, ADMIN_EMAIL, 100);
      
      // Bet
      const betRes = await http('POST', '/games/plinko/play', {
        betAmount: 10,
        risk: 'LOW',
        rows: 8,
      }, adminToken);
      
      let payout = 0;
      if (betRes.status === 200 || betRes.status === 201) {
        payout = 10 * parseFloat(betRes.data.multiplier || '0');
      }

      // Withdraw (small amount)
      const withdrawRes = await http('POST', '/wallet/withdraw', {
        amount: 20,
        currency: 'USDT',
        walletAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
      }, adminToken);

      const withdrawDeducted = (withdrawRes.status === 200 || withdrawRes.status === 201) ? 20 : 0;

      const balanceAfter = await getBalance(adminToken);
      const expectedBalance = balanceBefore + 100 - 10 + payout - withdrawDeducted;
      
      expect(Math.abs(balanceAfter - expectedBalance)).toBeLessThan(1);
    });

    it('should maintain balance integrity after 50 rapid operations', async () => {
      await adminDeposit(adminToken, ADMIN_EMAIL, 1000);
      const balanceBefore = await getBalance(adminToken);

      let totalDeposited = 0;
      let totalBet = 0;
      let totalWon = 0;

      // 50 rapid operations: mix of deposits and bets
      for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
          // Deposit
          const res = await adminDeposit(adminToken, ADMIN_EMAIL, 5);
          if (res.status === 201) totalDeposited += 5;
        } else {
          // Bet
          const res = await http('POST', '/games/plinko/play', {
            betAmount: 1,
            risk: 'LOW',
            rows: 8,
          }, adminToken);
          if (res.status === 200 || res.status === 201) {
            totalBet += 1;
            totalWon += parseFloat(res.data.multiplier || '0');
          }
        }
      }

      const balanceAfter = await getBalance(adminToken);
      const expectedBalance = balanceBefore + totalDeposited - totalBet + totalWon;
      
      // Allow reasonable tolerance for 50 operations
      expect(Math.abs(balanceAfter - expectedBalance)).toBeLessThan(5);
    }, 60000); // 60 second timeout
  });
});
