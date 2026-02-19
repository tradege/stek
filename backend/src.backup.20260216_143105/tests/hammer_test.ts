/**
 * HAMMER TEST - Double Spend Attack Simulation
 * =============================================
 * 
 * This test simulates a "Double Spend" attack scenario:
 * - A user has $150 in their wallet
 * - 50 parallel requests attempt to bet $100 each
 * - EXPECTED: Only 1 request succeeds, 49 must fail
 * 
 * This proves our atomic Lua script prevents race conditions.
 * 
 * Usage:
 *   npx ts-node src/tests/hammer_test.ts
 * 
 * Requirements:
 *   - Redis running on localhost:6379
 *   - ioredis and decimal.js installed
 */

import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  
  // Test parameters
  USER_ID: 'test-user-' + uuidv4().slice(0, 8),
  INITIAL_BALANCE: new Decimal(150),  // User starts with $150
  BET_AMOUNT: new Decimal(100),       // Each bet is $100
  PARALLEL_REQUESTS: 50,              // 50 simultaneous bet attempts
  
  // Expected results
  EXPECTED_SUCCESSFUL_BETS: 1,        // Only 1 should succeed
  EXPECTED_FAILED_BETS: 49,           // 49 should fail
};

// ============================================
// LOAD LUA SCRIPT
// ============================================

const luaScriptPath = path.join(__dirname, '../redis/scripts/atomic_balance_update.lua');
let luaScript: string;

try {
  luaScript = fs.readFileSync(luaScriptPath, 'utf-8');
} catch (error) {
  console.error('❌ Failed to load Lua script. Make sure the file exists at:');
  console.error(`   ${luaScriptPath}`);
  process.exit(1);
}

// ============================================
// REDIS CLIENT
// ============================================

const redis = new Redis({
  host: CONFIG.REDIS_HOST,
  port: CONFIG.REDIS_PORT,
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Execute a single bet transaction using the Lua script
 */
async function placeBet(
  userId: string,
  amount: Decimal,
  transactionId: string
): Promise<{ success: boolean; newBalance: string; errorCode?: string }> {
  const balanceKey = `wallet:${userId}:USDT:balance`;
  const processedKey = `wallet:${userId}:processed`;

  try {
    const result = await redis.eval(
      luaScript,
      2,
      balanceKey,
      processedKey,
      amount.negated().toString(), // Negative for deduction
      transactionId,
      'BET'
    ) as string[];

    const [status, value, _txId] = result;

    if (status === 'OK') {
      return { success: true, newBalance: value };
    } else {
      return { success: false, newBalance: _txId, errorCode: value };
    }
  } catch (error) {
    return { success: false, newBalance: '0', errorCode: 'REDIS_ERROR' };
  }
}

/**
 * Set initial balance for the test user
 */
async function setInitialBalance(userId: string, amount: Decimal): Promise<void> {
  const balanceKey = `wallet:${userId}:USDT:balance`;
  await redis.set(balanceKey, amount.toString());
}

/**
 * Get current balance
 */
async function getBalance(userId: string): Promise<Decimal> {
  const balanceKey = `wallet:${userId}:USDT:balance`;
  const balance = await redis.get(balanceKey);
  return new Decimal(balance || '0');
}

/**
 * Clean up test data
 */
async function cleanup(userId: string): Promise<void> {
  const pattern = `wallet:${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// ============================================
// MAIN TEST
// ============================================

async function runHammerTest(): Promise<void> {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🔨 HAMMER TEST - Double Spend Attack               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  User ID:           ${CONFIG.USER_ID.padEnd(40)}║`);
  console.log(`║  Initial Balance:   $${CONFIG.INITIAL_BALANCE.toString().padEnd(39)}║`);
  console.log(`║  Bet Amount:        $${CONFIG.BET_AMOUNT.toString().padEnd(39)}║`);
  console.log(`║  Parallel Requests: ${CONFIG.PARALLEL_REQUESTS.toString().padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Step 1: Clean up any existing test data
  console.log('🧹 Cleaning up previous test data...');
  await cleanup(CONFIG.USER_ID);

  // Step 2: Set initial balance
  console.log(`💰 Setting initial balance: $${CONFIG.INITIAL_BALANCE}`);
  await setInitialBalance(CONFIG.USER_ID, CONFIG.INITIAL_BALANCE);

  // Verify initial balance
  const initialBalance = await getBalance(CONFIG.USER_ID);
  console.log(`✅ Balance confirmed: $${initialBalance}\n`);

  // Step 3: Create 50 parallel bet requests
  console.log(`🚀 Launching ${CONFIG.PARALLEL_REQUESTS} parallel bet requests...\n`);

  const startTime = Date.now();

  // Create array of promises for parallel execution
  const betPromises = Array.from({ length: CONFIG.PARALLEL_REQUESTS }, (_, index) => {
    const transactionId = `tx-${index + 1}-${uuidv4().slice(0, 8)}`;
    return placeBet(CONFIG.USER_ID, CONFIG.BET_AMOUNT, transactionId)
      .then(result => ({
        requestId: index + 1,
        transactionId,
        ...result,
      }));
  });

  // Execute all bets in parallel
  const results = await Promise.all(betPromises);

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Step 4: Analyze results
  const successfulBets = results.filter(r => r.success);
  const failedBets = results.filter(r => !r.success);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         📊 RESULTS                            ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Show successful bets
  console.log('✅ SUCCESSFUL BETS:');
  if (successfulBets.length === 0) {
    console.log('   None\n');
  } else {
    successfulBets.forEach(bet => {
      console.log(`   Request #${bet.requestId}: TX=${bet.transactionId}, New Balance=$${bet.newBalance}`);
    });
    console.log('');
  }

  // Show failed bets summary
  console.log('❌ FAILED BETS:');
  const failedByReason = failedBets.reduce((acc, bet) => {
    const reason = bet.errorCode || 'UNKNOWN';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(failedByReason).forEach(([reason, count]) => {
    console.log(`   ${reason}: ${count} requests`);
  });
  console.log('');

  // Final balance
  const finalBalance = await getBalance(CONFIG.USER_ID);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       📈 FINAL STATE                          ');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`   Initial Balance:    $${CONFIG.INITIAL_BALANCE}`);
  console.log(`   Final Balance:      $${finalBalance}`);
  console.log(`   Total Deducted:     $${CONFIG.INITIAL_BALANCE.minus(finalBalance)}`);
  console.log(`   Execution Time:     ${duration}ms`);
  console.log(`   Requests/Second:    ${Math.round(CONFIG.PARALLEL_REQUESTS / (duration / 1000))}`);
  console.log('');

  // Step 5: Validate results
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                      🧪 TEST VALIDATION                       ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'Successful bets count',
      expected: CONFIG.EXPECTED_SUCCESSFUL_BETS,
      actual: successfulBets.length,
      passed: successfulBets.length === CONFIG.EXPECTED_SUCCESSFUL_BETS,
    },
    {
      name: 'Failed bets count',
      expected: CONFIG.EXPECTED_FAILED_BETS,
      actual: failedBets.length,
      passed: failedBets.length === CONFIG.EXPECTED_FAILED_BETS,
    },
    {
      name: 'Final balance is correct',
      expected: CONFIG.INITIAL_BALANCE.minus(CONFIG.BET_AMOUNT).toString(),
      actual: finalBalance.toString(),
      passed: finalBalance.equals(CONFIG.INITIAL_BALANCE.minus(CONFIG.BET_AMOUNT)),
    },
    {
      name: 'No double spend occurred',
      expected: 'true',
      actual: (successfulBets.length <= 1).toString(),
      passed: successfulBets.length <= 1,
    },
  ];

  let allPassed = true;
  tests.forEach(test => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`   ${icon} ${test.name}`);
    console.log(`      Expected: ${test.expected}`);
    console.log(`      Actual:   ${test.actual}`);
    console.log('');
    if (!test.passed) allPassed = false;
  });

  // Final verdict
  console.log('═══════════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('   🎉 ALL TESTS PASSED! The wallet is SECURE against double spend.');
  } else {
    console.log('   ⚠️  SOME TESTS FAILED! Review the implementation.');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Cleanup
  await cleanup(CONFIG.USER_ID);
  await redis.quit();

  process.exit(allPassed ? 0 : 1);
}

// ============================================
// RUN TEST
// ============================================

runHammerTest().catch(error => {
  console.error('❌ Test failed with error:', error);
  redis.quit();
  process.exit(1);
});
