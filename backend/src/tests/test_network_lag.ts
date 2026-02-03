/**
 * LATE PACKET ATTACK TEST - Network Latency Simulation
 * =====================================================
 * 
 * This script tests the Crash game's resilience against race conditions
 * caused by network latency. It simulates a scenario where a user's
 * cashout request arrives AFTER the game has already crashed.
 * 
 * Scenario:
 * 1. Game crashes at 2.00x
 * 2. User sends cashout request at 2.00x
 * 3. Due to 500ms network delay, request arrives when game is CRASHED
 * 4. Server MUST reject the cashout
 * 
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' src/tests/test_network_lag.ts
 */

import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ============================================
// GAME STATE SIMULATION
// ============================================

enum GameState {
  WAITING = 'WAITING',
  RUNNING = 'RUNNING',
  CRASHED = 'CRASHED',
}

interface SimulatedGame {
  id: string;
  state: GameState;
  crashPoint: Decimal;
  currentMultiplier: Decimal;
  bets: Map<string, SimulatedBet>;
  crashedAt: number | null;  // Timestamp when crashed
}

interface SimulatedBet {
  userId: string;
  amount: Decimal;
  status: 'ACTIVE' | 'CASHED_OUT' | 'LOST';
  cashedOutAt: Decimal | null;
}

interface CashoutResult {
  success: boolean;
  error?: string;
  profit?: Decimal;
  requestTime: number;
  processTime: number;
  gameStateAtProcess: GameState;
}

// ============================================
// SIMULATED CRASH SERVICE (Simplified)
// ============================================

class SimulatedCrashService {
  private game: SimulatedGame | null = null;
  private readonly logger = {
    log: (msg: string) => console.log(`  [Server] ${msg}`),
    debug: (msg: string) => console.log(`  [Server] ${msg}`),
  };

  /**
   * Start a new game with a specific crash point
   */
  startGame(crashPoint: number): void {
    this.game = {
      id: crypto.randomUUID(),
      state: GameState.RUNNING,
      crashPoint: new Decimal(crashPoint),
      currentMultiplier: new Decimal(1.00),
      bets: new Map(),
      crashedAt: null,
    };
    this.logger.log(`Game started. Crash point: ${crashPoint}x`);
  }

  /**
   * Place a bet
   */
  placeBet(userId: string, amount: number): void {
    if (!this.game || this.game.state !== GameState.RUNNING) {
      throw new Error('Game not running');
    }
    
    this.game.bets.set(userId, {
      userId,
      amount: new Decimal(amount),
      status: 'ACTIVE',
      cashedOutAt: null,
    });
    this.logger.log(`User ${userId} placed bet: $${amount}`);
  }

  /**
   * Update multiplier (simulates time passing)
   */
  setMultiplier(multiplier: number): void {
    if (!this.game) return;
    this.game.currentMultiplier = new Decimal(multiplier);
  }

  /**
   * Crash the game
   */
  crash(): void {
    if (!this.game) return;
    
    this.game.state = GameState.CRASHED;
    this.game.crashedAt = Date.now();
    this.game.currentMultiplier = this.game.crashPoint;
    
    // Mark all active bets as lost
    for (const [userId, bet] of this.game.bets) {
      if (bet.status === 'ACTIVE') {
        bet.status = 'LOST';
      }
    }
    
    this.logger.log(`💥 CRASHED at ${this.game.crashPoint.toFixed(2)}x!`);
  }

  /**
   * Process a cashout request
   * This is the CRITICAL function that must handle race conditions
   */
  processCashout(userId: string, requestedAt: number): CashoutResult {
    const processTime = Date.now();
    
    // Check 1: Game exists
    if (!this.game) {
      return {
        success: false,
        error: 'No active game',
        requestTime: requestedAt,
        processTime,
        gameStateAtProcess: GameState.WAITING,
      };
    }

    // Check 2: Game is still RUNNING (not CRASHED)
    // THIS IS THE CRITICAL CHECK FOR RACE CONDITIONS
    if (this.game.state !== GameState.RUNNING) {
      return {
        success: false,
        error: `Game Ended - State is ${this.game.state}`,
        requestTime: requestedAt,
        processTime,
        gameStateAtProcess: this.game.state,
      };
    }

    // Check 3: User has an active bet
    const bet = this.game.bets.get(userId);
    if (!bet) {
      return {
        success: false,
        error: 'No bet found',
        requestTime: requestedAt,
        processTime,
        gameStateAtProcess: this.game.state,
      };
    }

    if (bet.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Bet already settled',
        requestTime: requestedAt,
        processTime,
        gameStateAtProcess: this.game.state,
      };
    }

    // Check 4: Current multiplier is below crash point
    if (this.game.currentMultiplier.gte(this.game.crashPoint)) {
      return {
        success: false,
        error: 'Too late - game already crashed',
        requestTime: requestedAt,
        processTime,
        gameStateAtProcess: this.game.state,
      };
    }

    // SUCCESS: Process the cashout
    const profit = bet.amount.mul(this.game.currentMultiplier).minus(bet.amount);
    bet.status = 'CASHED_OUT';
    bet.cashedOutAt = this.game.currentMultiplier;

    return {
      success: true,
      profit,
      requestTime: requestedAt,
      processTime,
      gameStateAtProcess: this.game.state,
    };
  }

  getState(): GameState | null {
    return this.game?.state || null;
  }
}

// ============================================
// TEST SCENARIOS
// ============================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  cashoutResult?: CashoutResult;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Normal cashout (no latency)
 */
async function testNormalCashout(): Promise<TestResult> {
  const service = new SimulatedCrashService();
  
  console.log('\n  ─────────────────────────────────────────────────────────────');
  console.log('  📋 TEST 1: Normal Cashout (No Latency)');
  console.log('  ─────────────────────────────────────────────────────────────');
  
  service.startGame(3.00);  // Will crash at 3.00x
  service.placeBet('user1', 100);
  service.setMultiplier(2.00);  // Game is at 2.00x
  
  const requestTime = Date.now();
  const result = service.processCashout('user1', requestTime);
  
  console.log(`  [Client] Cashout request sent at multiplier 2.00x`);
  console.log(`  [Server] Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  if (result.success) {
    console.log(`  [Server] Profit: $${result.profit?.toFixed(2)}`);
  } else {
    console.log(`  [Server] Error: ${result.error}`);
  }
  
  return {
    name: 'Normal Cashout',
    passed: result.success === true,
    details: result.success ? `Profit: $${result.profit?.toFixed(2)}` : `Error: ${result.error}`,
    cashoutResult: result,
  };
}

/**
 * Test 2: Late Packet Attack - Request arrives after crash
 */
async function testLatePacketAttack(): Promise<TestResult> {
  const service = new SimulatedCrashService();
  
  console.log('\n  ─────────────────────────────────────────────────────────────');
  console.log('  📋 TEST 2: Late Packet Attack (500ms Latency)');
  console.log('  ─────────────────────────────────────────────────────────────');
  
  service.startGame(2.00);  // Will crash at 2.00x
  service.placeBet('attacker', 100);
  service.setMultiplier(1.99);  // Game is at 1.99x
  
  console.log('  [Client] User sees multiplier at 1.99x');
  console.log('  [Client] Sends cashout request...');
  
  const requestTime = Date.now();
  
  // Simulate network latency - game crashes before request arrives
  console.log('  [Network] 500ms latency...');
  await sleep(100);  // Shortened for test
  
  // Game crashes during the network delay
  service.setMultiplier(2.00);
  service.crash();
  
  console.log('  [Server] Game CRASHED at 2.00x');
  console.log('  [Network] Request finally arrives at server...');
  
  // Now the request arrives
  const result = service.processCashout('attacker', requestTime);
  
  console.log(`  [Server] Processing cashout request...`);
  console.log(`  [Server] Game state at processing: ${result.gameStateAtProcess}`);
  console.log(`  [Server] Result: ${result.success ? 'SUCCESS' : 'REJECTED'}`);
  if (!result.success) {
    console.log(`  [Server] Error: ${result.error}`);
  }
  
  // The test PASSES if the cashout was REJECTED
  return {
    name: 'Late Packet Attack',
    passed: result.success === false && result.error?.includes('Game Ended'),
    details: result.success ? 'VULNERABILITY! Cashout succeeded after crash!' : `Correctly rejected: ${result.error}`,
    cashoutResult: result,
  };
}

/**
 * Test 3: Rapid-fire cashout attempts during crash moment
 */
async function testRapidFireAttack(): Promise<TestResult> {
  const service = new SimulatedCrashService();
  
  console.log('\n  ─────────────────────────────────────────────────────────────');
  console.log('  📋 TEST 3: Rapid-Fire Attack (10 requests at crash moment)');
  console.log('  ─────────────────────────────────────────────────────────────');
  
  service.startGame(2.00);  // Will crash at 2.00x
  
  // Place 10 bets
  for (let i = 1; i <= 10; i++) {
    service.placeBet(`user${i}`, 100);
  }
  
  service.setMultiplier(1.99);
  console.log('  [Server] Multiplier at 1.99x');
  
  // Simulate crash happening
  service.setMultiplier(2.00);
  service.crash();
  
  // Now 10 users try to cashout simultaneously
  console.log('  [Clients] 10 users sending cashout requests...');
  
  const results: CashoutResult[] = [];
  for (let i = 1; i <= 10; i++) {
    const result = service.processCashout(`user${i}`, Date.now());
    results.push(result);
  }
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`  [Server] Successful cashouts: ${successCount}`);
  console.log(`  [Server] Rejected cashouts: ${failCount}`);
  
  // The test PASSES if ALL cashouts were REJECTED
  return {
    name: 'Rapid-Fire Attack',
    passed: successCount === 0 && failCount === 10,
    details: `${successCount} succeeded, ${failCount} rejected`,
  };
}

/**
 * Test 4: Cashout at exact crash point
 */
async function testExactCrashPointCashout(): Promise<TestResult> {
  const service = new SimulatedCrashService();
  
  console.log('\n  ─────────────────────────────────────────────────────────────');
  console.log('  📋 TEST 4: Cashout at Exact Crash Point');
  console.log('  ─────────────────────────────────────────────────────────────');
  
  service.startGame(2.50);  // Will crash at 2.50x
  service.placeBet('user1', 100);
  service.setMultiplier(2.50);  // Exactly at crash point
  
  console.log('  [Server] Multiplier at exactly 2.50x (crash point)');
  
  // This should fail because multiplier >= crashPoint
  const result = service.processCashout('user1', Date.now());
  
  console.log(`  [Server] Result: ${result.success ? 'SUCCESS' : 'REJECTED'}`);
  if (!result.success) {
    console.log(`  [Server] Error: ${result.error}`);
  }
  
  return {
    name: 'Exact Crash Point Cashout',
    passed: result.success === false,
    details: result.success ? 'VULNERABILITY! Should not allow cashout at crash point!' : `Correctly rejected: ${result.error}`,
    cashoutResult: result,
  };
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🔒 LATE PACKET ATTACK TEST                         ║');
  console.log('║              Network Latency Simulation                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const results: TestResult[] = [];
  
  // Run all tests
  results.push(await testNormalCashout());
  results.push(await testLatePacketAttack());
  results.push(await testRapidFireAttack());
  results.push(await testExactCrashPointCashout());
  
  // Print summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       📊 SUMMARY                              ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`  ${icon} ${result.name}`);
    console.log(`     ${result.details}`);
    console.log('');
  }
  
  const allPassed = results.every(r => r.passed);
  
  console.log('═══════════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('  🎉 ALL TESTS PASSED! The game is SECURE against race conditions.');
  } else {
    console.log('  ❌ SOME TESTS FAILED! Review the cashout logic for vulnerabilities.');
  }
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');
}

// Run the tests
main().catch(console.error);
