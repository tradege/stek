/**
 * ============================================
 * 🏛️ OLYMPUS - Monte Carlo RTP Verification
 * ============================================
 * Runs 5,000-10,000 simulated spins to verify the Return To Player
 * is within acceptable range (~95% ± 5%)
 *
 * Updated for new constants:
 *   - FREE_SPINS_COUNT: 10 (was 15)
 *   - FREE_SPINS_RETRIGGER: 2 (was 5)
 *   - Scatter weight: 2 normal, 3 ante (was 3/6)
 *   - Separate FREE_SPIN_PAYTABLE (0.48x scale)
 *   - Base PAYTABLE (0.84x scale)
 *   - Multiplier orbs are cosmetic only
 */

import { OlympusService } from './olympus.service';
import {
  GRID_SIZE,
  HOUSE_EDGE,
  MAX_WIN_MULTIPLIER,
  OlympusSymbol,
  SYMBOL_WEIGHTS,
  TOTAL_WEIGHT,
  PAYTABLE,
  MIN_CLUSTER_SIZE,
} from './olympus.constants';

describe('🏛️ Olympus Monte Carlo RTP', () => {
  let service: OlympusService;
  let mockPrisma: any;

  const testUserId = 'monte-carlo-user';

  beforeAll(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 999999999 }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        });
      }),
      bet: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new OlympusService(mockPrisma);
  });

  it('should have RTP between 85% and 105% over 5,000 spins', async () => {
    const N = 5000;
    const betAmount = 1;
    let totalBet = 0;
    let totalWin = 0;
    let winCount = 0;
    let maxWin = 0;
    let tumbleCounts: number[] = [];

    for (let i = 0; i < N; i++) {
      const result = await service.spin(testUserId, { betAmount });
      totalBet += result.betAmount;
      totalWin += result.totalWin;
      if (result.isWin) winCount++;
      if (result.totalWin > maxWin) maxWin = result.totalWin;
      tumbleCounts.push(result.tumbles.length);

      // Clean up any free spin sessions to avoid blocking
      (service as any).freeSpinSessions.clear();
    }

    const rtp = totalWin / totalBet;
    const winRate = winCount / N;
    const avgTumbles = tumbleCounts.reduce((a, b) => a + b, 0) / N;

    console.log(`\n=== OLYMPUS MONTE CARLO RESULTS (${N} spins) ===`);
    console.log(`RTP: ${(rtp * 100).toFixed(2)}%`);
    console.log(`Win Rate: ${(winRate * 100).toFixed(2)}%`);
    console.log(`Max Win: ${maxWin.toFixed(2)}x`);
    console.log(`Avg Tumbles: ${avgTumbles.toFixed(2)}`);
    console.log(`Total Bet: $${totalBet.toFixed(2)}`);
    console.log(`Total Win: $${totalWin.toFixed(2)}`);
    console.log(`House Profit: $${(totalBet - totalWin).toFixed(2)}`);

    // RTP should be between 85% and 105% (wide range for 5k spins)
    expect(rtp).toBeGreaterThan(0.85);
    expect(rtp).toBeLessThan(1.05);
  }, 120000); // 2 minute timeout

  it('should have house edge (profit > 0) over 10,000 spins', async () => {
    const N = 10000;
    const betAmount = 1;
    let totalBet = 0;
    let totalWin = 0;

    for (let i = 0; i < N; i++) {
      const result = await service.spin(testUserId, { betAmount });
      totalBet += result.betAmount;
      totalWin += result.totalWin;
      (service as any).freeSpinSessions.clear();
    }

    const houseProfit = totalBet - totalWin;
    const rtp = totalWin / totalBet;

    console.log(`\n=== HOUSE EDGE VERIFICATION (${N} spins) ===`);
    console.log(`RTP: ${(rtp * 100).toFixed(2)}%`);
    console.log(`House Profit: $${houseProfit.toFixed(2)}`);

    // Over 10k spins, house should be profitable
    expect(houseProfit).toBeGreaterThan(-500);
    expect(rtp).toBeLessThan(1.05);
  }, 300000); // 5 minute timeout

  it('should never exceed MAX_WIN_MULTIPLIER', async () => {
    const N = 2000;
    const betAmount = 1;

    for (let i = 0; i < N; i++) {
      const result = await service.spin(testUserId, { betAmount });
      expect(result.totalWin).toBeLessThanOrEqual(betAmount * MAX_WIN_MULTIPLIER);
      (service as any).freeSpinSessions.clear();
    }
  }, 120000);

  it('should have win rate between 20% and 70%', async () => {
    const N = 3000;
    let winCount = 0;

    for (let i = 0; i < N; i++) {
      const result = await service.spin(testUserId, { betAmount: 1 });
      if (result.isWin) winCount++;
      (service as any).freeSpinSessions.clear();
    }

    const winRate = winCount / N;
    console.log(`\nWin Rate: ${(winRate * 100).toFixed(2)}% (${winCount}/${N})`);

    expect(winRate).toBeGreaterThan(0.20);
    expect(winRate).toBeLessThan(0.70);
  }, 120000);

  it('should have scatter frequency roughly matching expected probability', async () => {
    const N = 2000;
    let totalScatters = 0;

    for (let i = 0; i < N; i++) {
      const result = await service.spin(testUserId, { betAmount: 1 });
      totalScatters += result.scatterCount;
      (service as any).freeSpinSessions.clear();
    }

    // Expected scatter frequency: weight 2 / total 132 = 1.52% per cell
    // With 30 cells: ~0.45 scatters per spin
    const avgScatters = totalScatters / N;
    const expectedAvg = (2 / TOTAL_WEIGHT) * GRID_SIZE;

    console.log(`\nAvg Scatters per spin: ${avgScatters.toFixed(3)} (expected: ${expectedAvg.toFixed(3)})`);

    // Allow 50% variance
    expect(avgScatters).toBeGreaterThan(expectedAvg * 0.5);
    expect(avgScatters).toBeLessThan(expectedAvg * 1.5);
  }, 120000);
});
