// @ts-nocheck
import { CrashService } from './crash.service';
import * as crypto from 'crypto';

describe('CrashService - Monte Carlo Simulation', () => {
  let service: CrashService;
  const HOUSE_EDGE = 0.04;
  const ITERATIONS = 10000;

  beforeAll(() => {
    // GameConfigService has a getter `houseEdge` that returns a number
    const mockGameConfig = {
      houseEdge: HOUSE_EDGE,
      instantBust: 0.02,
      botsEnabled: false,
      getConfig: () => ({ houseEdge: HOUSE_EDGE, instantBust: 0.02, botsEnabled: false, maxBotBet: 500, minBotBet: 5, maxBotsPerRound: 25 }),
    };
    service = new CrashService(null as any, mockGameConfig as any, null as any, null as any, null as any);
  });

  // ============================================
  // 1. RTP VERIFICATION
  // ============================================
  it('should have an RTP between 85% and 99% over 10,000 rounds (2x cashout)', () => {
    let totalBet = 0;
    let totalReturn = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const nonce = i + 1;
      const betAmount = 1;
      const cashoutAt = 2.0;

      const crashPoint = (service as any).generateCrashPoint(serverSeed, clientSeed, nonce);

      totalBet += betAmount;
      if (parseFloat(crashPoint.toString()) >= cashoutAt) {
        totalReturn += betAmount * cashoutAt;
      }
    }

    const rtp = (totalReturn / totalBet) * 100;
    console.log(`Simulated RTP with 2x cashout: ${rtp.toFixed(2)}%`);
    expect(rtp).toBeGreaterThanOrEqual(85);
    expect(rtp).toBeLessThanOrEqual(99);
  });

  // ============================================
  // 2. CRASH POINT DISTRIBUTION
  // ============================================
  it('should generate crash points >= 1.00', () => {
    for (let i = 0; i < 1000; i++) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const crashPoint = (service as any).generateCrashPoint(serverSeed, clientSeed, i + 1);
      expect(parseFloat(crashPoint.toString())).toBeGreaterThanOrEqual(1.0);
    }
  });

  // ============================================
  // 3. DETERMINISM
  // ============================================
  it('should be deterministic with same seeds', () => {
    const serverSeed = 'fixed-server-seed-for-testing';
    const clientSeed = 'fixed-client-seed-for-testing';
    const nonce = 42;

    const point1 = (service as any).generateCrashPoint(serverSeed, clientSeed, nonce);
    const point2 = (service as any).generateCrashPoint(serverSeed, clientSeed, nonce);

    expect(point1.toString()).toBe(point2.toString());
  });

  // ============================================
  // 4. DIFFERENT SEEDS = DIFFERENT RESULTS
  // ============================================
  it('should produce different crash points with different seeds', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const crashPoint = (service as any).generateCrashPoint(serverSeed, clientSeed, i + 1);
      results.add(crashPoint.toString());
    }
    // At least 50 unique values out of 100 (high variance expected)
    expect(results.size).toBeGreaterThan(50);
  });

  // ============================================
  // 5. INSTANT CRASH RATE
  // ============================================
  it('should have reasonable instant crash rate (crash at 1.00x) with 4% house edge', () => {
    let instantCrashes = 0;
    const N = 10000;

    for (let i = 0; i < N; i++) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const crashPoint = parseFloat((service as any).generateCrashPoint(serverSeed, clientSeed, i + 1).toString());
      if (crashPoint <= 1.01) {
        instantCrashes++;
      }
    }

    const instantRate = (instantCrashes / N) * 100;
    console.log(`Instant crash rate (<=1.01x): ${instantRate.toFixed(2)}%`);

    // Should be roughly around the house edge percentage (1-12%)
    expect(instantRate).toBeGreaterThanOrEqual(1);
    expect(instantRate).toBeLessThanOrEqual(12);
  });

  // ============================================
  // 6. HIGH MULTIPLIER RARITY
  // ============================================
  it('should rarely produce very high multipliers', () => {
    let highMultiplierCount = 0;
    const N = 10000;
    const THRESHOLD = 100;

    for (let i = 0; i < N; i++) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const crashPoint = parseFloat((service as any).generateCrashPoint(serverSeed, clientSeed, i + 1).toString());
      if (crashPoint >= THRESHOLD) {
        highMultiplierCount++;
      }
    }

    const highRate = (highMultiplierCount / N) * 100;
    console.log(`High multiplier rate (>=${THRESHOLD}x): ${highRate.toFixed(2)}%`);

    // Should be less than 3% for 100x+
    expect(highRate).toBeLessThan(3);
  });

  // ============================================
  // 7. CRASH POINT CAPPED AT 5000
  // ============================================
  it('should cap crash points at 5000x', () => {
    for (let i = 0; i < 10000; i++) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const crashPoint = parseFloat((service as any).generateCrashPoint(serverSeed, clientSeed, i + 1).toString());
      expect(crashPoint).toBeLessThanOrEqual(5000);
    }
  });
});
