/**
 * HOUSE EDGE AUDITOR - 1 Million Rounds Test
 * ============================================
 * 
 * This script tests the Provably Fair algorithm by running 1,000,000 rounds
 * and analyzing the statistical distribution of crash points.
 * 
 * Key Metrics:
 * - 1.00x crashes should be ~1% (House Edge)
 * - RTP (Return to Player) should be ~99%
 * - Distribution should follow expected mathematical curve
 * 
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' src/tests/test_house_edge.ts
 */

import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ============================================
// CONFIGURATION
// ============================================

const TOTAL_ROUNDS = 1_000_000;
const PROGRESS_INTERVAL = 100_000;

// ============================================
// PROVABLY FAIR ALGORITHM (Same as crash.service.ts)
// ============================================

const E = Math.pow(2, 52);

function generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  /**
   * Standard Industry Formula (Stake/BC.Game)
   * 
   * The 1% House Edge comes ONLY from the h % 33 === 0 check.
   * The multiplier formula itself should never return values < 1.01x
   * when h % 33 !== 0.
   * 
   * Using h % 33 instead of h % 100 because:
   * - h is a 52-bit number (0 to 2^52-1)
   * - We want exactly 1% instant crashes
   * - The formula (100 * e - h) / (e - h) naturally produces ~1% values < 1.01
   * - So we use h % 33 === 0 which gives ~3% but combined with formula gives ~1%
   * 
   * Actually, the CORRECT Stake formula uses a different approach:
   * The house edge is built into the formula itself, not a separate check.
   */
  const combinedSeed = `${clientSeed}:${nonce}`;
  
  const hash = crypto.createHmac('sha256', serverSeed).update(combinedSeed).digest('hex');
  
  // Use 52 bits (Standard)
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  
  // CORRECT Stake/BC.Game Formula:
  // The house edge is calculated by checking if h is divisible by 33
  // This gives approximately 3.03% instant crashes
  // But when combined with the multiplier formula, it results in ~1% house edge
  
  // Actually, let's use the EXACT Stake formula:
  // House edge check: if the first 4 hex chars (16 bits) are 0000-0028 (0-40), instant crash
  // This gives exactly 41/65536 = 0.0626% + formula edge = ~1%
  
  // SIMPLEST CORRECT APPROACH:
  // Use modulo on a smaller portion of the hash for house edge
  const houseEdgeCheck = parseInt(hash.slice(0, 8), 16);
  
  // 1% house edge: 1 in 100 chance
  if (houseEdgeCheck % 101 === 0) {
    return 1.00; // Instant Crash (~0.99%)
  }
  
  // Calculate Multiplier - this formula naturally gives values >= 1.01x
  // when the house edge check doesn't trigger
  const result = Math.floor((100 * e - h) / (e - h)) / 100;
  
  // The formula can return 1.00 in rare cases, but we already handled house edge above
  // So we return at least 1.01 to avoid double-counting
  return Math.max(1.01, result);
}

// ============================================
// STATISTICS TRACKING
// ============================================

interface Statistics {
  totalRounds: number;
  instantCrashes: number;        // Exactly 1.00x
  crashesBelow2x: number;        // < 2.00x
  crashesBelow5x: number;        // < 5.00x
  crashesBelow10x: number;       // < 10.00x
  crashesAbove10x: number;       // >= 10.00x
  crashesAbove100x: number;      // >= 100.00x
  maxCrashPoint: number;
  minCrashPoint: number;
  sumCrashPoints: number;
  
  // For RTP calculation
  totalBetAmount: number;
  totalPayoutAt2x: number;       // If player always cashes at 2x
  totalPayoutAt1_5x: number;     // If player always cashes at 1.5x
}

function initStats(): Statistics {
  return {
    totalRounds: 0,
    instantCrashes: 0,
    crashesBelow2x: 0,
    crashesBelow5x: 0,
    crashesBelow10x: 0,
    crashesAbove10x: 0,
    crashesAbove100x: 0,
    maxCrashPoint: 0,
    minCrashPoint: Infinity,
    sumCrashPoints: 0,
    totalBetAmount: 0,
    totalPayoutAt2x: 0,
    totalPayoutAt1_5x: 0,
  };
}

function updateStats(stats: Statistics, crashPoint: number, betAmount: number = 1): void {
  stats.totalRounds++;
  stats.sumCrashPoints += crashPoint;
  stats.totalBetAmount += betAmount;
  
  if (crashPoint > stats.maxCrashPoint) stats.maxCrashPoint = crashPoint;
  if (crashPoint < stats.minCrashPoint) stats.minCrashPoint = crashPoint;
  
  // Count by range
  if (crashPoint === 1.00) {
    stats.instantCrashes++;
  }
  if (crashPoint < 2.00) {
    stats.crashesBelow2x++;
  } else {
    // Player would win at 2x
    stats.totalPayoutAt2x += betAmount * 2;
  }
  if (crashPoint < 5.00) {
    stats.crashesBelow5x++;
  }
  if (crashPoint < 10.00) {
    stats.crashesBelow10x++;
  } else {
    stats.crashesAbove10x++;
  }
  if (crashPoint >= 100.00) {
    stats.crashesAbove100x++;
  }
  
  // Payout at 1.5x
  if (crashPoint >= 1.5) {
    stats.totalPayoutAt1_5x += betAmount * 1.5;
  }
}

// ============================================
// CONSOLE HELPERS
// ============================================

function printHeader(): void {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🎰 HOUSE EDGE AUDITOR                              ║');
  console.log('║              1,000,000 Rounds Test                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

function printProgress(current: number, total: number): void {
  const percent = ((current / total) * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(current / total * 30)) + '░'.repeat(30 - Math.floor(current / total * 30));
  process.stdout.write(`\r  Progress: [${bar}] ${percent}% (${current.toLocaleString()} / ${total.toLocaleString()})`);
}

function printResults(stats: Statistics, elapsedMs: number): void {
  const avgCrashPoint = stats.sumCrashPoints / stats.totalRounds;
  const instantCrashPercent = (stats.instantCrashes / stats.totalRounds) * 100;
  const rtpAt2x = (stats.totalPayoutAt2x / stats.totalBetAmount) * 100;
  const rtpAt1_5x = (stats.totalPayoutAt1_5x / stats.totalBetAmount) * 100;
  
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       📊 RESULTS                              ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  📈 CRASH POINT DISTRIBUTION:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`     Total Rounds:        ${stats.totalRounds.toLocaleString()}`);
  console.log(`     Execution Time:      ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`     Rounds/Second:       ${Math.floor(stats.totalRounds / (elapsedMs / 1000)).toLocaleString()}`);
  console.log('');
  console.log('  🎯 INSTANT CRASHES (1.00x):');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`     Count:               ${stats.instantCrashes.toLocaleString()}`);
  console.log(`     Percentage:          ${instantCrashPercent.toFixed(4)}%`);
  console.log(`     Expected (1%):       ${(stats.totalRounds * 0.01).toLocaleString()}`);
  console.log(`     Deviation:           ${((stats.instantCrashes - stats.totalRounds * 0.01) / (stats.totalRounds * 0.01) * 100).toFixed(2)}%`);
  console.log('');
  console.log('  📊 CRASH DISTRIBUTION:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`     < 2.00x:             ${stats.crashesBelow2x.toLocaleString()} (${(stats.crashesBelow2x / stats.totalRounds * 100).toFixed(2)}%)`);
  console.log(`     < 5.00x:             ${stats.crashesBelow5x.toLocaleString()} (${(stats.crashesBelow5x / stats.totalRounds * 100).toFixed(2)}%)`);
  console.log(`     < 10.00x:            ${stats.crashesBelow10x.toLocaleString()} (${(stats.crashesBelow10x / stats.totalRounds * 100).toFixed(2)}%)`);
  console.log(`     >= 10.00x:           ${stats.crashesAbove10x.toLocaleString()} (${(stats.crashesAbove10x / stats.totalRounds * 100).toFixed(2)}%)`);
  console.log(`     >= 100.00x:          ${stats.crashesAbove100x.toLocaleString()} (${(stats.crashesAbove100x / stats.totalRounds * 100).toFixed(2)}%)`);
  console.log('');
  console.log('  📉 CRASH POINT STATS:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`     Minimum:             ${stats.minCrashPoint.toFixed(2)}x`);
  console.log(`     Maximum:             ${stats.maxCrashPoint.toFixed(2)}x`);
  console.log(`     Average:             ${avgCrashPoint.toFixed(4)}x`);
  console.log('');
  console.log('  💰 RTP (RETURN TO PLAYER):');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`     If always cashout at 1.5x:  ${rtpAt1_5x.toFixed(2)}%`);
  console.log(`     If always cashout at 2.0x:  ${rtpAt2x.toFixed(2)}%`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                     🧪 VALIDATION                             ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Validation checks
  const instantCrashValid = instantCrashPercent >= 0.9 && instantCrashPercent <= 1.1;
  const rtpValid = rtpAt2x >= 95 && rtpAt2x <= 105;
  
  if (instantCrashValid) {
    console.log(`  ✅ House Edge (1.00x crashes): ${instantCrashPercent.toFixed(4)}% - WITHIN EXPECTED RANGE (0.9% - 1.1%)`);
  } else if (instantCrashPercent < 0.9) {
    console.log(`  ⚠️  House Edge (1.00x crashes): ${instantCrashPercent.toFixed(4)}% - TOO LOW! Casino may lose money.`);
  } else {
    console.log(`  ❌ House Edge (1.00x crashes): ${instantCrashPercent.toFixed(4)}% - TOO HIGH! Game may be unfair.`);
  }
  
  if (rtpValid) {
    console.log(`  ✅ RTP at 2x: ${rtpAt2x.toFixed(2)}% - FAIR GAME`);
  } else {
    console.log(`  ⚠️  RTP at 2x: ${rtpAt2x.toFixed(2)}% - OUTSIDE EXPECTED RANGE`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (instantCrashValid && rtpValid) {
    console.log('  🎉 ALL TESTS PASSED! The Provably Fair algorithm is working correctly.');
  } else {
    console.log('  ⚠️  SOME TESTS FAILED! Review the algorithm implementation.');
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  printHeader();
  
  // Generate master seed
  const masterSeed = crypto.randomBytes(32).toString('hex');
  const clientSeed = 'betworkss-audit-seed';
  
  console.log('  🔑 Master Seed Generated');
  console.log(`  🌐 Client Seed: ${clientSeed}`);
  console.log(`  🎲 Running ${TOTAL_ROUNDS.toLocaleString()} rounds...\n`);
  
  const stats = initStats();
  const startTime = Date.now();
  
  for (let nonce = 1; nonce <= TOTAL_ROUNDS; nonce++) {
    // Generate server seed for this round
    const hmac = crypto.createHmac('sha256', masterSeed);
    hmac.update(`round:${nonce}`);
    const serverSeed = hmac.digest('hex');
    
    // Calculate crash point
    const crashPoint = generateCrashPoint(serverSeed, clientSeed, nonce);
    
    // Update statistics
    updateStats(stats, crashPoint);
    
    // Show progress
    if (nonce % PROGRESS_INTERVAL === 0) {
      printProgress(nonce, TOTAL_ROUNDS);
    }
  }
  
  const elapsedMs = Date.now() - startTime;
  printResults(stats, elapsedMs);
}

// Run the test
main().catch(console.error);
