/**
 * ================================================================
 * MONTE CARLO RTP VERIFICATION - Penalty & Crash
 * ================================================================
 * 
 * PENALTY GAME LOGIC:
 *   - Player bets, then kicks up to 10 penalty shots
 *   - Each kick: goalkeeper dives to 1 of 3 positions (RNG)
 *   - If goalkeeper matches player position = SAVED (game over, LOSE ALL)
 *   - If different = GOAL (multiplier increases)
 *   - Player can CASHOUT after any goal to collect winnings
 *   - If saved = lose entire bet (payout = 0)
 *   - Save chance per kick = 1/3 (33.33%)
 *   - P(reaching N goals) = (2/3)^N
 *   - Multiplier table: multiplier(N) = 0.96 * 1.5^N
 *   - RTP for ANY fixed cashout strategy = (2/3)^N * 0.96 * 1.5^N = 96%
 * 
 * CRASH GAME LOGIC:
 *   - Standard crash with 0.99 coefficient applied
 *   - Formula: ((1 - houseEdge) / (1 - r)) * 0.99
 * ================================================================
 */
import * as crypto from 'crypto';

// ============================================
// PENALTY CONSTANTS (from penalty.service.ts)
// ============================================
const PENALTY_MAX_ROUNDS = 10;
const MULTIPLIER_TABLE: Record<number, number> = {
  1: 1.44, 2: 2.16, 3: 3.24, 4: 4.86, 5: 7.29,
  6: 10.94, 7: 16.40, 8: 24.60, 9: 36.91, 10: 55.36,
};

// ============================================
// CRASH CONSTANTS (from crash.service.ts)
// ============================================
const CRASH_HOUSE_EDGE = 0.04;
const CRASH_COEFFICIENT = 0.99;
const CRASH_MAX_MULTIPLIER = 5000;
const E = Math.pow(2, 52);

// ============================================
// RNG HELPERS
// ============================================
function hmacRandom(seed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha256', seed);
  hmac.update(`sim:${nonce}`);
  const hash = hmac.digest('hex');
  return parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF;
}

function hmacRandom52(seed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha256', seed);
  hmac.update(`crash:${nonce}`);
  const hash = hmac.digest('hex');
  return parseInt(hash.substring(0, 13), 16) / E;
}

// ============================================
// PENALTY MONTE CARLO
// ============================================
describe('PENALTY Monte Carlo RTP Verification', () => {
  const serverSeed = crypto.randomBytes(32).toString('hex');

  it('should verify multiplier table gives exactly 96% RTP at every cashout level', () => {
    // Mathematical proof: For each level N,
    // RTP = P(reach N) * multiplier(N) = (2/3)^N * 0.96 * 1.5^N = 0.96
    const goalChance = 2 / 3;

    console.log('');
    console.log('='.repeat(55));
    console.log('  PENALTY - Theoretical RTP per Cashout Level');
    console.log('='.repeat(55));

    for (let n = 1; n <= PENALTY_MAX_ROUNDS; n++) {
      const pReach = Math.pow(goalChance, n);
      const multiplier = MULTIPLIER_TABLE[n];
      const rtp = pReach * multiplier;
      const status = Math.abs(rtp - 0.96) < 0.005 ? 'PASS' : 'FAIL';
      console.log(`  Level ${n.toString().padStart(2)}: P(reach)=${(pReach * 100).toFixed(2).padStart(6)}% x ${multiplier.toString().padStart(5)}x = RTP ${(rtp * 100).toFixed(2)}% [${status}]`);
      
      // Each level should give ~96% RTP (within 0.5% tolerance for rounding)
      expect(rtp).toBeGreaterThan(0.955);
      expect(rtp).toBeLessThan(0.965);
    }
    console.log('='.repeat(55));
    console.log('  ALL levels give exactly 96% RTP - Table is PERFECT');
  });

  it('should simulate 1M games with fixed cashout at level 1 and confirm ~96% RTP', () => {
    const ROUNDS = 1_000_000;
    const CASHOUT_AT = 1; // Always cashout after 1 goal
    let totalBet = 0;
    let totalWin = 0;
    let wins = 0;

    for (let i = 0; i < ROUNDS; i++) {
      totalBet += 1;
      // Simulate: can the player score 1 goal?
      const gkRandom = hmacRandom(serverSeed, i * 2);
      const plRandom = hmacRandom(serverSeed, i * 2 + 1);
      const gkPos = Math.floor(gkRandom * 3);
      const plPos = Math.floor(plRandom * 3);

      if (gkPos !== plPos) {
        // GOAL - cashout
        totalWin += MULTIPLIER_TABLE[CASHOUT_AT];
        wins++;
      }
      // else: SAVED - lose bet
    }

    const rtp = totalWin / totalBet;
    const winRate = wins / ROUNDS;

    console.log('');
    console.log('='.repeat(55));
    console.log('  PENALTY SIM - Fixed Cashout at Level 1');
    console.log('='.repeat(55));
    console.log(`  Rounds:    ${ROUNDS.toLocaleString()}`);
    console.log(`  Win Rate:  ${(winRate * 100).toFixed(2)}% (expected: 66.67%)`);
    console.log(`  RTP:       ${(rtp * 100).toFixed(4)}%`);
    console.log('='.repeat(55));

    expect(rtp).toBeGreaterThan(0.94);
    expect(rtp).toBeLessThan(0.98);
    expect(winRate).toBeGreaterThan(0.65);
    expect(winRate).toBeLessThan(0.68);
    console.log(`  RTP ${(rtp * 100).toFixed(2)}% is GREEN (target: 96%)`);
  }, 60000);

  it('should simulate 1M games with fixed cashout at level 5 and confirm ~96% RTP', () => {
    const ROUNDS = 1_000_000;
    const CASHOUT_AT = 5;
    let totalBet = 0;
    let totalWin = 0;
    let wins = 0;

    for (let i = 0; i < ROUNDS; i++) {
      totalBet += 1;
      let goals = 0;

      for (let round = 1; round <= CASHOUT_AT; round++) {
        const gkRandom = hmacRandom(serverSeed, i * PENALTY_MAX_ROUNDS * 2 + round);
        const plRandom = hmacRandom(serverSeed, i * PENALTY_MAX_ROUNDS * 2 + round + PENALTY_MAX_ROUNDS);
        const gkPos = Math.floor(gkRandom * 3);
        const plPos = Math.floor(plRandom * 3);

        if (gkPos === plPos) {
          break; // SAVED - game over
        } else {
          goals++;
        }
      }

      if (goals === CASHOUT_AT) {
        totalWin += MULTIPLIER_TABLE[CASHOUT_AT];
        wins++;
      }
    }

    const rtp = totalWin / totalBet;
    const winRate = wins / ROUNDS;
    const expectedWinRate = Math.pow(2 / 3, CASHOUT_AT);

    console.log('');
    console.log('='.repeat(55));
    console.log(`  PENALTY SIM - Fixed Cashout at Level ${CASHOUT_AT}`);
    console.log('='.repeat(55));
    console.log(`  Rounds:         ${ROUNDS.toLocaleString()}`);
    console.log(`  Win Rate:       ${(winRate * 100).toFixed(2)}% (expected: ${(expectedWinRate * 100).toFixed(2)}%)`);
    console.log(`  Multiplier:     ${MULTIPLIER_TABLE[CASHOUT_AT]}x`);
    console.log(`  RTP:            ${(rtp * 100).toFixed(4)}%`);
    console.log('='.repeat(55));

    expect(rtp).toBeGreaterThan(0.94);
    expect(rtp).toBeLessThan(0.98);
    console.log(`  RTP ${(rtp * 100).toFixed(2)}% is GREEN (target: 96%)`);
  }, 60000);

  it('should simulate 1M games with random cashout strategy and confirm ~96% RTP', () => {
    const ROUNDS = 1_000_000;
    let totalBet = 0;
    let totalWin = 0;
    let cashoutDistribution: Record<number, number> = {};

    for (let i = 0; i < ROUNDS; i++) {
      totalBet += 1;

      // Random cashout level (1-10, uniform)
      const cashoutRandom = hmacRandom(serverSeed, i * 100 + 99);
      const cashoutAt = Math.floor(cashoutRandom * PENALTY_MAX_ROUNDS) + 1;

      let goals = 0;
      for (let round = 1; round <= cashoutAt; round++) {
        const gkRandom = hmacRandom(serverSeed, i * PENALTY_MAX_ROUNDS * 2 + round);
        const plRandom = hmacRandom(serverSeed, i * PENALTY_MAX_ROUNDS * 2 + round + PENALTY_MAX_ROUNDS);
        const gkPos = Math.floor(gkRandom * 3);
        const plPos = Math.floor(plRandom * 3);

        if (gkPos === plPos) {
          break; // SAVED
        } else {
          goals++;
        }
      }

      if (goals === cashoutAt) {
        totalWin += MULTIPLIER_TABLE[cashoutAt];
        cashoutDistribution[cashoutAt] = (cashoutDistribution[cashoutAt] || 0) + 1;
      }
    }

    const rtp = totalWin / totalBet;

    console.log('');
    console.log('='.repeat(55));
    console.log('  PENALTY SIM - Random Cashout Strategy');
    console.log('='.repeat(55));
    console.log(`  Rounds:    ${ROUNDS.toLocaleString()}`);
    console.log(`  RTP:       ${(rtp * 100).toFixed(4)}%`);
    console.log('  Cashout Distribution:');
    for (let n = 1; n <= PENALTY_MAX_ROUNDS; n++) {
      const count = cashoutDistribution[n] || 0;
      console.log(`    Level ${n.toString().padStart(2)}: ${count.toLocaleString().padStart(8)} successful cashouts`);
    }
    console.log('='.repeat(55));

    expect(rtp).toBeGreaterThan(0.93);
    expect(rtp).toBeLessThan(0.99);
    console.log(`  RTP ${(rtp * 100).toFixed(2)}% is GREEN (target: 96%)`);
  }, 60000);
});

// ============================================
// CRASH MONTE CARLO (with 0.99 coefficient)
// ============================================
describe('CRASH Monte Carlo RTP Verification (0.99 coefficient)', () => {
  const SIMULATION_ROUNDS = 1_000_000;
  const serverSeed = crypto.randomBytes(32).toString('hex');

  function generateCrashPoint(nonce: number): number {
    const r = hmacRandom52(serverSeed, nonce);
    const rawMultiplier = ((1 - CRASH_HOUSE_EDGE) / (1 - r)) * CRASH_COEFFICIENT;
    const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
    return Math.min(crashPoint, CRASH_MAX_MULTIPLIER);
  }

  it(`should have correct bust rate over ${SIMULATION_ROUNDS.toLocaleString()} rounds`, () => {
    let crashAt1Count = 0;
    let maxCrash = 0;
    let crashDistribution: Record<string, number> = {
      '1.00x': 0, '1.01-1.50x': 0, '1.51-2.00x': 0,
      '2.01-5.00x': 0, '5.01-10.00x': 0, '10.01-50.00x': 0,
      '50.01-100.00x': 0, '100.01+': 0,
    };

    for (let i = 0; i < SIMULATION_ROUNDS; i++) {
      const cp = generateCrashPoint(i);
      if (cp <= 1.00) { crashDistribution['1.00x']++; crashAt1Count++; }
      else if (cp <= 1.50) crashDistribution['1.01-1.50x']++;
      else if (cp <= 2.00) crashDistribution['1.51-2.00x']++;
      else if (cp <= 5.00) crashDistribution['2.01-5.00x']++;
      else if (cp <= 10.00) crashDistribution['5.01-10.00x']++;
      else if (cp <= 50.00) crashDistribution['10.01-50.00x']++;
      else if (cp <= 100.00) crashDistribution['50.01-100.00x']++;
      else crashDistribution['100.01+']++;
      if (cp > maxCrash) maxCrash = cp;
    }

    const bustRate = crashAt1Count / SIMULATION_ROUNDS;

    console.log('');
    console.log('='.repeat(55));
    console.log('  CRASH MONTE CARLO RESULTS (0.99 coefficient)');
    console.log('='.repeat(55));
    console.log(`  Simulations:    ${SIMULATION_ROUNDS.toLocaleString()}`);
    console.log(`  Bust at 1.00x:  ${crashAt1Count.toLocaleString()} (${(bustRate * 100).toFixed(2)}%)`);
    console.log(`  Max Crash:      ${maxCrash.toFixed(2)}x`);
    console.log('  Distribution:');
    for (const [range, count] of Object.entries(crashDistribution)) {
      const pct = ((count / SIMULATION_ROUNDS) * 100).toFixed(2);
      console.log(`    ${range.padEnd(14)}: ${count.toLocaleString().padStart(8)} (${pct}%)`);
    }
    console.log('='.repeat(55));

    expect(bustRate).toBeGreaterThan(0.03);
    expect(bustRate).toBeLessThan(0.07);
    console.log(`  Bust rate ${(bustRate * 100).toFixed(2)}% is GREEN [3%-7%]`);
  }, 120000);

  it('should simulate fixed 2x cashout strategy and confirm ~96% RTP', () => {
    const ROUNDS = 1_000_000;
    const CASHOUT_AT = 2.00;
    let totalBet = 0;
    let totalWin = 0;
    let wins = 0;

    for (let i = 0; i < ROUNDS; i++) {
      totalBet += 1;
      const crashPoint = generateCrashPoint(i);
      if (crashPoint >= CASHOUT_AT) {
        totalWin += CASHOUT_AT;
        wins++;
      }
    }

    const rtp = totalWin / totalBet;
    const winRate = wins / ROUNDS;

    console.log('');
    console.log('='.repeat(55));
    console.log('  CRASH SIM - Fixed 2x Cashout Strategy');
    console.log('='.repeat(55));
    console.log(`  Rounds:    ${ROUNDS.toLocaleString()}`);
    console.log(`  Win Rate:  ${(winRate * 100).toFixed(2)}%`);
    console.log(`  RTP:       ${(rtp * 100).toFixed(4)}%`);
    console.log('='.repeat(55));

    // With 0.99 coefficient: RTP should be ~95% (0.96 * 0.99 = 0.9504)
    expect(rtp).toBeGreaterThan(0.92);
    expect(rtp).toBeLessThan(0.98);
    console.log(`  RTP ${(rtp * 100).toFixed(2)}% is GREEN (target: ~95%)`);
  }, 60000);

  it('should verify 0.99 coefficient reduces crash points', () => {
    const SAMPLE = 100000;
    let sumWith = 0;
    let sumWithout = 0;

    for (let i = 0; i < SAMPLE; i++) {
      const r = hmacRandom52(serverSeed, i + SIMULATION_ROUNDS);
      const raw099 = ((1 - CRASH_HOUSE_EDGE) / (1 - r)) * 0.99;
      const cp099 = Math.min(Math.max(1.00, Math.floor(raw099 * 100) / 100), CRASH_MAX_MULTIPLIER);
      sumWith += cp099;

      const rawNo = (1 - CRASH_HOUSE_EDGE) / (1 - r);
      const cpNo = Math.min(Math.max(1.00, Math.floor(rawNo * 100) / 100), CRASH_MAX_MULTIPLIER);
      sumWithout += cpNo;
    }

    const avgWith = sumWith / SAMPLE;
    const avgWithout = sumWithout / SAMPLE;

    console.log(`  Avg WITH 0.99:    ${avgWith.toFixed(4)}x`);
    console.log(`  Avg WITHOUT 0.99: ${avgWithout.toFixed(4)}x`);

    expect(avgWith).toBeLessThan(avgWithout);
    console.log(`  0.99 coefficient correctly reduces crash points`);
  }, 60000);
});
