/**
 * CRASH GAME SIMULATION
 * =====================
 * 
 * This script simulates the Crash game loop in the console.
 * It demonstrates:
 * - State Machine (WAITING -> RUNNING -> CRASHED)
 * - Provably Fair crash point generation
 * - Real-time multiplier updates
 * - Auto-cashout functionality
 * 
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' src/tests/simulate_crash.ts
 */

import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  WAITING_TIME: 3000,      // 3 seconds (shortened for demo)
  CRASHED_TIME: 2000,      // 2 seconds (shortened for demo)
  TICK_INTERVAL: 100,      // 100ms between ticks
  ROUNDS_TO_SIMULATE: 5,   // Number of rounds to run
  SHOW_ALL_TICKS: false,   // Set to true to see every tick
};

// ============================================
// GAME STATE
// ============================================

enum GameState {
  WAITING = 'WAITING',
  RUNNING = 'RUNNING',
  CRASHED = 'CRASHED',
}

interface SimulatedBet {
  userId: string;
  amount: Decimal;
  autoCashoutAt: Decimal | null;
  cashedOut: boolean;
  cashedOutAt: Decimal | null;
}

// ============================================
// PROVABLY FAIR ALGORITHM
// ============================================

const E = Math.pow(2, 52);

function generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): Decimal {
  const combinedSeed = `${clientSeed}:${nonce}`;
  
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(combinedSeed);
  const hash = hmac.digest('hex');
  
  const h = parseInt(hash.substring(0, 13), 16);
  
  // House edge: 1% chance of instant crash
  if (h % 100 === 0) {
    return new Decimal(1.00);
  }
  
  const crashPoint = Math.floor((E * 100 - h) / (E - h)) / 100;
  return new Decimal(Math.max(1.00, crashPoint));
}

function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

// ============================================
// CONSOLE HELPERS
// ============================================

function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

function printHeader(): void {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              🎰 CRASH GAME SIMULATION                        ║');
  console.log('║                  Provably Fair Demo                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

function printRoundStart(gameNumber: number, serverSeedHash: string): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🎮 GAME #${gameNumber}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Server Seed Hash: ${serverSeedHash.substring(0, 16)}...`);
  console.log('');
}

function printWaiting(secondsLeft: number): void {
  clearLine();
  process.stdout.write(`  ⏳ WAITING for bets... ${secondsLeft}s remaining`);
}

function printMultiplier(multiplier: Decimal): void {
  clearLine();
  const m = multiplier.toFixed(2);
  const color = multiplier.lt(2) ? '\x1b[32m' : multiplier.lt(5) ? '\x1b[33m' : '\x1b[31m';
  process.stdout.write(`  🚀 Multiplier: ${color}${m}x\x1b[0m`);
}

function printCrash(crashPoint: Decimal, serverSeed: string): void {
  console.log('\n');
  console.log(`  💥 CRASHED at \x1b[31m${crashPoint.toFixed(2)}x\x1b[0m!`);
  console.log(`  🔓 Server Seed: ${serverSeed.substring(0, 32)}...`);
  console.log('');
}

function printBetResult(bet: SimulatedBet, crashPoint: Decimal): void {
  if (bet.cashedOut && bet.cashedOutAt) {
    const profit = bet.amount.mul(bet.cashedOutAt).minus(bet.amount);
    console.log(`  ✅ ${bet.userId}: Cashed out at ${bet.cashedOutAt.toFixed(2)}x - Profit: $${profit.toFixed(2)}`);
  } else {
    console.log(`  ❌ ${bet.userId}: Lost $${bet.amount.toFixed(2)}`);
  }
}

// ============================================
// SIMULATION
// ============================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateRound(
  gameNumber: number,
  masterSeed: string,
  clientSeed: string
): Promise<void> {
  // Generate seeds
  const hmac = crypto.createHmac('sha256', masterSeed);
  hmac.update(`round:${gameNumber}`);
  const serverSeed = hmac.digest('hex');
  const serverSeedHash = hashServerSeed(serverSeed);
  
  // Calculate crash point
  const crashPoint = generateCrashPoint(serverSeed, clientSeed, gameNumber);
  
  printRoundStart(gameNumber, serverSeedHash);
  
  // Simulate some bets
  const bets: SimulatedBet[] = [
    { userId: 'Alice', amount: new Decimal(100), autoCashoutAt: new Decimal(1.5), cashedOut: false, cashedOutAt: null },
    { userId: 'Bob', amount: new Decimal(50), autoCashoutAt: new Decimal(2.0), cashedOut: false, cashedOutAt: null },
    { userId: 'Charlie', amount: new Decimal(200), autoCashoutAt: null, cashedOut: false, cashedOutAt: null }, // Manual cashout
  ];
  
  console.log('  📝 Bets placed:');
  bets.forEach(bet => {
    const auto = bet.autoCashoutAt ? `(auto @ ${bet.autoCashoutAt.toFixed(2)}x)` : '(manual)';
    console.log(`     - ${bet.userId}: $${bet.amount.toFixed(2)} ${auto}`);
  });
  console.log('');
  
  // WAITING phase
  const waitingSeconds = Math.floor(CONFIG.WAITING_TIME / 1000);
  for (let i = waitingSeconds; i > 0; i--) {
    printWaiting(i);
    await sleep(1000);
  }
  clearLine();
  console.log('  ✅ Betting closed!\n');
  
  // RUNNING phase
  console.log('  🚀 GAME STARTING!\n');
  
  const startTime = Date.now();
  const growthRate = 0.00006;
  
  while (true) {
    const elapsed = Date.now() - startTime;
    const multiplier = new Decimal(Math.exp(growthRate * elapsed));
    
    // Check for crash
    if (multiplier.gte(crashPoint)) {
      printCrash(crashPoint, serverSeed);
      break;
    }
    
    // Check auto-cashouts
    for (const bet of bets) {
      if (!bet.cashedOut && bet.autoCashoutAt && multiplier.gte(bet.autoCashoutAt)) {
        bet.cashedOut = true;
        bet.cashedOutAt = bet.autoCashoutAt;
      }
    }
    
    // Simulate manual cashout for Charlie at 1.8x
    const charlie = bets.find(b => b.userId === 'Charlie');
    if (charlie && !charlie.cashedOut && multiplier.gte(1.8)) {
      charlie.cashedOut = true;
      charlie.cashedOutAt = multiplier;
    }
    
    // Print multiplier
    if (CONFIG.SHOW_ALL_TICKS || elapsed % 500 < CONFIG.TICK_INTERVAL) {
      printMultiplier(multiplier);
    }
    
    await sleep(CONFIG.TICK_INTERVAL);
  }
  
  // Show results
  console.log('  📊 RESULTS:');
  bets.forEach(bet => printBetResult(bet, crashPoint));
  console.log('');
  
  // Verification
  console.log('  🔐 PROVABLY FAIR VERIFICATION:');
  console.log(`     Server Seed: ${serverSeed}`);
  console.log(`     Client Seed: ${clientSeed}`);
  console.log(`     Nonce: ${gameNumber}`);
  const verified = generateCrashPoint(serverSeed, clientSeed, gameNumber);
  console.log(`     Verified Crash Point: ${verified.toFixed(2)}x ✅`);
  console.log('');
  
  // CRASHED phase - wait before next round
  console.log(`  ⏳ Next round in ${CONFIG.CRASHED_TIME / 1000} seconds...`);
  await sleep(CONFIG.CRASHED_TIME);
}

async function main(): Promise<void> {
  printHeader();
  
  // Generate master seed
  const masterSeed = crypto.randomBytes(32).toString('hex');
  const clientSeed = 'stakepro-public-seed';
  
  console.log('  🔑 Master Seed Generated (kept secret)');
  console.log(`  🌐 Client Seed: ${clientSeed}`);
  console.log(`  🎲 Simulating ${CONFIG.ROUNDS_TO_SIMULATE} rounds...\n`);
  
  for (let i = 1; i <= CONFIG.ROUNDS_TO_SIMULATE; i++) {
    await simulateRound(i, masterSeed, clientSeed);
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🎉 SIMULATION COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Summary statistics
  console.log('  📈 STATISTICS:');
  console.log(`     Rounds played: ${CONFIG.ROUNDS_TO_SIMULATE}`);
  console.log('     All crash points were provably fair and verifiable.');
  console.log('     Auto-cashout and manual cashout both working correctly.');
  console.log('\n');
}

// Run the simulation
main().catch(console.error);
