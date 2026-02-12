/**
 * ============================================
 * DICE - Monte Carlo Stress Test
 * ============================================
 * Runs 100,000+ iterations to verify:
 * - House edge is consistently ~4%
 * - RTP is ~96%
 * - Roll distribution is uniform
 * - Win rate matches expected probability
 * - No exploitable patterns exist
 */

import { DiceService } from './dice.service';

// Mock Date.now to bypass rate limiting
let mockTime = 1000000;
const originalDateNow = Date.now;
beforeAll(() => {
  Date.now = jest.fn(() => {
    mockTime += 1000;
    return mockTime;
  });
});
afterAll(() => {
  Date.now = originalDateNow;
});

describe('Dice Monte Carlo Stress Test', () => {
  let service: DiceService;
  let mockPrisma: any;

  beforeEach(() => {
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

    service = new DiceService(mockPrisma);
  });

  // ============================================
  // SECTION 1: RTP Verification (100K spins)
  // ============================================
  describe('RTP Verification', () => {
    it('should have RTP between 93% and 99% over 100K UNDER bets at target=50', async () => {
      const ITERATIONS = 100000;
      const BET = 1;
      let totalWagered = 0;
      let totalReturned = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-rtp-${i}`;
        const result = await service.play(userId, {
          betAmount: BET,
          target: 50,
          condition: 'UNDER',
        }, 'default-site-001');

        totalWagered += BET;
        totalReturned += result.payout;
      }

      const rtp = (totalReturned / totalWagered) * 100;
      console.log(`Dice RTP (target=50, UNDER, ${ITERATIONS} iterations): ${rtp.toFixed(2)}%`);

      expect(rtp).toBeGreaterThan(93);
      expect(rtp).toBeLessThan(99);
    }, 300000); // 5 min timeout

    it('should have RTP between 93% and 99% for OVER bets at target=50', async () => {
      const ITERATIONS = 100000;
      const BET = 1;
      let totalWagered = 0;
      let totalReturned = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-rtp-over-${i}`;
        const result = await service.play(userId, {
          betAmount: BET,
          target: 50,
          condition: 'OVER',
        }, 'default-site-001');

        totalWagered += BET;
        totalReturned += result.payout;
      }

      const rtp = (totalReturned / totalWagered) * 100;
      console.log(`Dice RTP (target=50, OVER, ${ITERATIONS} iterations): ${rtp.toFixed(2)}%`);

      expect(rtp).toBeGreaterThan(93);
      expect(rtp).toBeLessThan(99);
    }, 300000);

    it('should have consistent RTP across different targets', async () => {
      const targets = [10, 25, 50, 75, 90];
      const ITERATIONS = 20000;
      const BET = 1;

      for (const target of targets) {
        let totalWagered = 0;
        let totalReturned = 0;

        for (let i = 0; i < ITERATIONS; i++) {
          const userId = `mc-target-${target}-${i}`;
          const result = await service.play(userId, {
            betAmount: BET,
            target,
            condition: 'UNDER',
          }, 'default-site-001');

          totalWagered += BET;
          totalReturned += result.payout;
        }

        const rtp = (totalReturned / totalWagered) * 100;
        console.log(`Dice RTP (target=${target}, ${ITERATIONS} iterations): ${rtp.toFixed(2)}%`);

        // Wider tolerance for fewer iterations
        expect(rtp).toBeGreaterThan(90);
        expect(rtp).toBeLessThan(102);
      }
    }, 600000); // 10 min timeout
  });

  // ============================================
  // SECTION 2: Win Rate Verification
  // ============================================
  describe('Win Rate Verification', () => {
    it('should have ~50% win rate for target=50 UNDER', async () => {
      const ITERATIONS = 50000;
      let wins = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-wr-${i}`;
        const result = await service.play(userId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        }, 'default-site-001');

        if (result.isWin) wins++;
      }

      const winRate = (wins / ITERATIONS) * 100;
      console.log(`Dice win rate (target=50, UNDER): ${winRate.toFixed(2)}%`);

      expect(winRate).toBeGreaterThan(48);
      expect(winRate).toBeLessThan(52);
    }, 300000);

    it('should have ~25% win rate for target=25 UNDER', async () => {
      const ITERATIONS = 50000;
      let wins = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-wr25-${i}`;
        const result = await service.play(userId, {
          betAmount: 1,
          target: 25,
          condition: 'UNDER',
        }, 'default-site-001');

        if (result.isWin) wins++;
      }

      const winRate = (wins / ITERATIONS) * 100;
      console.log(`Dice win rate (target=25, UNDER): ${winRate.toFixed(2)}%`);

      expect(winRate).toBeGreaterThan(23);
      expect(winRate).toBeLessThan(27);
    }, 300000);
  });

  // ============================================
  // SECTION 3: Roll Distribution Uniformity
  // ============================================
  describe('Roll Distribution Uniformity', () => {
    it('should have uniform roll distribution across 10 buckets', async () => {
      const ITERATIONS = 100000;
      const buckets = new Array(10).fill(0); // 0-9.99, 10-19.99, ..., 90-99.99

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-dist-${i}`;
        const result = await service.play(userId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        }, 'default-site-001');

        const bucketIndex = Math.min(Math.floor(result.roll / 10), 9);
        buckets[bucketIndex]++;
      }

      const expected = ITERATIONS / 10;
      console.log('Roll distribution buckets:', buckets.map((b, i) => `${i * 10}-${(i + 1) * 10}: ${b}`));

      for (let i = 0; i < 10; i++) {
        // Each bucket should be within 5% of expected
        expect(buckets[i]).toBeGreaterThan(expected * 0.95);
        expect(buckets[i]).toBeLessThan(expected * 1.05);
      }
    }, 300000);
  });

  // ============================================
  // SECTION 4: House Edge Verification
  // ============================================
  describe('House Edge Verification', () => {
    it('should have house edge between 2% and 6% over 100K bets', async () => {
      const ITERATIONS = 100000;
      const BET = 1;
      let totalWagered = 0;
      let totalReturned = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-he-${i}`;
        const result = await service.play(userId, {
          betAmount: BET,
          target: 50,
          condition: 'UNDER',
        }, 'default-site-001');

        totalWagered += BET;
        totalReturned += result.payout;
      }

      const houseEdge = ((totalWagered - totalReturned) / totalWagered) * 100;
      console.log(`Dice house edge (${ITERATIONS} iterations): ${houseEdge.toFixed(2)}%`);

      expect(houseEdge).toBeGreaterThan(2);
      expect(houseEdge).toBeLessThan(6);
    }, 300000);
  });

  // ============================================
  // SECTION 5: No Exploitable Patterns
  // ============================================
  describe('No Exploitable Patterns', () => {
    it('should not have predictable win/loss streaks', async () => {
      const ITERATIONS = 10000;
      let maxWinStreak = 0;
      let maxLossStreak = 0;
      let currentWinStreak = 0;
      let currentLossStreak = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const userId = `mc-streak-${i}`;
        const result = await service.play(userId, {
          betAmount: 1,
          target: 50,
          condition: 'UNDER',
        }, 'default-site-001');

        if (result.isWin) {
          currentWinStreak++;
          currentLossStreak = 0;
          maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else {
          currentLossStreak++;
          currentWinStreak = 0;
          maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        }
      }

      console.log(`Max win streak: ${maxWinStreak}, Max loss streak: ${maxLossStreak}`);

      // With 50% chance, max streak of 25+ in 10K is extremely unlikely
      expect(maxWinStreak).toBeLessThan(30);
      expect(maxLossStreak).toBeLessThan(30);
    }, 300000);
  });
});
