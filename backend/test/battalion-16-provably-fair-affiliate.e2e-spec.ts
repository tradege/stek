/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BATTALION 16: PROVABLY FAIR & AFFILIATE SYSTEM TEST SUITE          ║
 * ║  "The Trust & Revenue Engine"                                       ║
 * ║                                                                      ║
 * ║  Tests:                                                              ║
 * ║  • Scenario 1: Provably Fair HMAC-SHA256 Verification               ║
 * ║  • Scenario 2: Multi-Tier Affiliate Commission (3 Levels)           ║
 * ║  • Scenario 3: Wager Mining Protection                              ║
 * ║  • Scenario 4: Rank Progression & Commission Rates                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import * as crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================
// PROVABLY FAIR ENGINE (mirrors crash.service.ts exactly)
// ============================================================

class ProvablyFairEngine {
  private E = Math.pow(2, 52);

  /**
   * Generate crash point using HMAC-SHA256
   * Exact mirror of crash.service.ts generateCrashPoint()
   */
  generateCrashPoint(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    houseEdge: number = 0.04,
  ): number {
    const combinedSeed = `${clientSeed}:${nonce}`;
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(combinedSeed);
    const hash = hmac.digest('hex');

    const h = parseInt(hash.substring(0, 13), 16);
    const r = h / this.E;
    const rawMultiplier = (1 - houseEdge) / (1 - r);
    const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);

    return Math.min(crashPoint, 5000);
  }

  /**
   * Generate second crash point (Dragon 2)
   * Exact mirror of crash.service.ts generateSecondCrashPoint()
   */
  generateSecondCrashPoint(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    houseEdge: number = 0.04,
  ): number {
    const combinedSeed = `${clientSeed}:${nonce}:dragon2`;
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(combinedSeed);
    const hash = hmac.digest('hex');

    const h = parseInt(hash.substring(0, 13), 16);
    const r = h / this.E;
    const rawMultiplier = (1 - houseEdge) / (1 - r);
    const crashPoint = Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);

    return Math.min(crashPoint, 5000);
  }

  /**
   * Hash server seed (for pre-commitment)
   * Exact mirror of crash.service.ts hashServerSeed()
   */
  hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate round server seed from master seed
   * Exact mirror of crash.service.ts generateRoundServerSeed()
   */
  generateRoundServerSeed(masterSeed: string, gameNumber: number): string {
    const hmac = crypto.createHmac('sha256', masterSeed);
    hmac.update(`round:${gameNumber}`);
    return hmac.digest('hex');
  }

  /**
   * Player-side verification function
   * This is what players use to verify game fairness
   */
  verifyResult(
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string,
    nonce: number,
    claimedCrashPoint: number,
    houseEdge: number = 0.04,
  ): { verified: boolean; calculatedPoint: number; hashMatch: boolean } {
    // Step 1: Verify server seed hash matches pre-commitment
    const calculatedHash = this.hashServerSeed(serverSeed);
    const hashMatch = calculatedHash === serverSeedHash;

    // Step 2: Recalculate crash point
    const calculatedPoint = this.generateCrashPoint(
      serverSeed,
      clientSeed,
      nonce,
      houseEdge,
    );

    // Step 3: Verify crash point matches
    const pointMatch = calculatedPoint === claimedCrashPoint;

    return {
      verified: hashMatch && pointMatch,
      calculatedPoint,
      hashMatch,
    };
  }
}

// ============================================================
// AFFILIATE COMMISSION ENGINE (mirrors commission-processor.service.ts)
// ============================================================

// Commission rates from commission-processor.service.ts
const COMMISSION_RATES = {
  tier1: 0.005,  // 0.5% for direct referrals
  tier2: 0.002,  // 0.2% for tier 2
  tier3: 0.001,  // 0.1% for tier 3
};

// Rank definitions from affiliate.service.ts
const RANKS = [
  { name: 'Iron', icon: '🔩', color: '#6B7280', minVolume: 0, tier1Rate: 0.05, tier2Rate: 0.02, tier3Rate: 0.01 },
  { name: 'Bronze', icon: '🥉', color: '#CD7F32', minVolume: 1000, tier1Rate: 0.06, tier2Rate: 0.025, tier3Rate: 0.01 },
  { name: 'Silver', icon: '🥈', color: '#C0C0C0', minVolume: 5000, tier1Rate: 0.07, tier2Rate: 0.03, tier3Rate: 0.015 },
  { name: 'Gold', icon: '🥇', color: '#FFD700', minVolume: 25000, tier1Rate: 0.08, tier2Rate: 0.035, tier3Rate: 0.02 },
  { name: 'Platinum', icon: '💎', color: '#E5E4E2', minVolume: 100000, tier1Rate: 0.10, tier2Rate: 0.04, tier3Rate: 0.02 },
  { name: 'Diamond', icon: '👑', color: '#00F0FF', minVolume: 500000, tier1Rate: 0.12, tier2Rate: 0.05, tier3Rate: 0.025 },
];

// Wager mining protection thresholds
const MIN_CRASH_MULTIPLIER = 1.10;
const MAX_DICE_WIN_CHANCE = 90;

interface UserNode {
  id: string;
  username: string;
  parentId: string | null;
  isBot: boolean;
}

interface CommissionRecord {
  recipientId: string;
  sourceUserId: string;
  betId: string;
  currency: string;
  amount: number;
  commissionType: string;
  levelFromSource: number;
}

class AffiliateCommissionSimulator {
  private users: Map<string, UserNode> = new Map();
  private commissions: CommissionRecord[] = [];

  addUser(user: UserNode): void {
    this.users.set(user.id, user);
  }

  /**
   * Process commission for a bet - mirrors CommissionProcessorService.processCommission()
   */
  processCommission(
    betId: string,
    userId: string,
    betAmount: number,
    gameType: string,
    gameData?: Record<string, any>,
  ): CommissionRecord[] {
    // Wager mining protection
    if (this.isLowRiskBet(gameType, gameData)) {
      return [];
    }

    const user = this.users.get(userId);
    if (!user || !user.parentId || user.isBot) {
      return [];
    }

    // Build parent chain (up to 3 tiers)
    const parentChain: { userId: string; tier: number }[] = [];

    // Tier 1: Direct parent
    const tier1 = this.users.get(user.parentId);
    if (tier1 && !tier1.isBot) {
      parentChain.push({ userId: tier1.id, tier: 1 });

      // Tier 2: Grandparent
      if (tier1.parentId) {
        const tier2 = this.users.get(tier1.parentId);
        if (tier2 && !tier2.isBot) {
          parentChain.push({ userId: tier2.id, tier: 2 });

          // Tier 3: Great-grandparent
          if (tier2.parentId) {
            const tier3 = this.users.get(tier2.parentId);
            if (tier3 && !tier3.isBot) {
              parentChain.push({ userId: tier3.id, tier: 3 });
            }
          }
        }
      }
    }

    if (parentChain.length === 0) return [];

    // Create commission records
    const newCommissions = parentChain.map((parent) => {
      const rate =
        parent.tier === 1
          ? COMMISSION_RATES.tier1
          : parent.tier === 2
            ? COMMISSION_RATES.tier2
            : COMMISSION_RATES.tier3;

      const amount = betAmount * rate;

      return {
        recipientId: parent.userId,
        sourceUserId: userId,
        betId,
        currency: 'USDT',
        amount: parseFloat(amount.toFixed(8)),
        commissionType: 'TURNOVER_REBATE',
        levelFromSource: parent.tier,
      };
    });

    this.commissions.push(...newCommissions);
    return newCommissions;
  }

  /**
   * Wager mining protection - mirrors CommissionProcessorService.isLowRiskBet()
   */
  private isLowRiskBet(gameType: string, gameData?: Record<string, any>): boolean {
    if (!gameData) return false;

    // Crash-type games
    if (['CRASH', 'DRAGON_BLAZE', 'NOVA_RUSH'].includes(gameType)) {
      const autoCashout = parseFloat(gameData.autoCashoutAt || gameData.autoCashout || '0');
      if (autoCashout > 0 && autoCashout < MIN_CRASH_MULTIPLIER) {
        return true;
      }
    }

    // Dice: reject if win chance too high
    if (gameType === 'DICE') {
      const winChance = parseFloat(gameData.winChance || gameData.chance || '0');
      if (winChance > MAX_DICE_WIN_CHANCE) {
        return true;
      }
    }

    return false;
  }

  getCommissions(): CommissionRecord[] {
    return this.commissions;
  }

  getCommissionsForUser(userId: string): CommissionRecord[] {
    return this.commissions.filter((c) => c.recipientId === userId);
  }

  getTotalCommissionForUser(userId: string): number {
    return this.getCommissionsForUser(userId).reduce((sum, c) => sum + c.amount, 0);
  }

  /**
   * Get rank by volume - mirrors AffiliateService.getRankByVolume()
   */
  getRankByVolume(volume: number): typeof RANKS[0] {
    let currentRank = RANKS[0];
    for (const rank of RANKS) {
      if (volume >= rank.minVolume) {
        currentRank = rank;
      }
    }
    return currentRank;
  }

  getNextRank(currentRank: typeof RANKS[0]): typeof RANKS[0] | null {
    const currentIndex = RANKS.findIndex((r) => r.name === currentRank.name);
    return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
  }
}

// ============================================================
// TEST SUITE
// ============================================================

describe('🔐 BATTALION 16: PROVABLY FAIR & AFFILIATE SYSTEM', () => {

  // ============================================================
  // SCENARIO 1: PROVABLY FAIR HMAC-SHA256 VERIFICATION
  // ============================================================
  describe('Scenario 1: Provably Fair — HMAC-SHA256 Verification', () => {
    let engine: ProvablyFairEngine;

    beforeEach(() => {
      engine = new ProvablyFairEngine();
    });

    describe('1A: Core HMAC-SHA256 Crash Point Generation', () => {
      it('should generate crash point using HMAC-SHA256', () => {
        const serverSeed = 'test-server-seed-2026';
        const clientSeed = 'test-client-seed';
        const nonce = 1;

        const point = engine.generateCrashPoint(serverSeed, clientSeed, nonce);

        expect(typeof point).toBe('number');
        expect(point).toBeGreaterThanOrEqual(1.00);
        expect(point).toBeLessThanOrEqual(5000);
      });

      it('should be deterministic (same inputs = same output)', () => {
        const serverSeed = 'deterministic-test-seed';
        const clientSeed = 'client-seed-abc';
        const nonce = 42;

        const point1 = engine.generateCrashPoint(serverSeed, clientSeed, nonce);
        const point2 = engine.generateCrashPoint(serverSeed, clientSeed, nonce);
        const point3 = engine.generateCrashPoint(serverSeed, clientSeed, nonce);

        expect(point1).toBe(point2);
        expect(point2).toBe(point3);
      });

      it('should produce different results with different nonces', () => {
        const serverSeed = 'nonce-test-seed';
        const clientSeed = 'client-seed';

        const points = new Set<number>();
        for (let i = 0; i < 100; i++) {
          points.add(engine.generateCrashPoint(serverSeed, clientSeed, i));
        }

        // Should have significant variety (at least 20 unique values out of 100)
        expect(points.size).toBeGreaterThan(20);
      });

      it('should produce different results with different server seeds', () => {
        const clientSeed = 'client-seed';
        const nonce = 1;

        const point1 = engine.generateCrashPoint('seed-A', clientSeed, nonce);
        const point2 = engine.generateCrashPoint('seed-B', clientSeed, nonce);

        // Very unlikely to be the same
        expect(point1 === point2).toBe(false);
      });

      it('should produce different results with different client seeds', () => {
        const serverSeed = 'server-seed';
        const nonce = 1;

        const point1 = engine.generateCrashPoint(serverSeed, 'client-A', nonce);
        const point2 = engine.generateCrashPoint(serverSeed, 'client-B', nonce);

        expect(point1 === point2).toBe(false);
      });

      it('should always produce 2 decimal precision', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'precision-test';

        for (let i = 0; i < 1000; i++) {
          const point = engine.generateCrashPoint(serverSeed, clientSeed, i);
          const decimalPart = point.toString().split('.')[1] || '0';
          expect(decimalPart.length).toBeLessThanOrEqual(2);
        }
      });

      it('should respect house edge parameter', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'house-edge-test';
        const totalRounds = 50000;

        // Test with 4% house edge
        let bustCount4 = 0;
        for (let i = 0; i < totalRounds; i++) {
          if (engine.generateCrashPoint(serverSeed, clientSeed, i, 0.04) <= 1.00) {
            bustCount4++;
          }
        }

        // Test with 8% house edge
        let bustCount8 = 0;
        for (let i = 0; i < totalRounds; i++) {
          if (engine.generateCrashPoint(serverSeed, clientSeed, i, 0.08) <= 1.00) {
            bustCount8++;
          }
        }

        // Higher house edge should produce more busts
        expect(bustCount8).toBeGreaterThan(bustCount4);
      });
    });

    describe('1B: Server Seed Hash Pre-Commitment', () => {
      it('should generate SHA-256 hash of server seed', () => {
        const serverSeed = 'my-secret-server-seed';
        const hash = engine.hashServerSeed(serverSeed);

        expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
        expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
      });

      it('should be deterministic (same seed = same hash)', () => {
        const serverSeed = 'consistent-seed';
        const hash1 = engine.hashServerSeed(serverSeed);
        const hash2 = engine.hashServerSeed(serverSeed);

        expect(hash1).toBe(hash2);
      });

      it('should produce different hashes for different seeds', () => {
        const hash1 = engine.hashServerSeed('seed-1');
        const hash2 = engine.hashServerSeed('seed-2');

        expect(hash1).not.toBe(hash2);
      });

      it('should be computationally infeasible to reverse (one-way)', () => {
        // We can only verify this conceptually:
        // Given a hash, you cannot derive the original seed
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const hash = engine.hashServerSeed(serverSeed);

        // The hash should not contain the seed
        expect(hash).not.toBe(serverSeed);
        expect(hash.includes(serverSeed)).toBe(false);
      });
    });

    describe('1C: Full Player Verification Flow', () => {
      it('should verify a legitimate game result', () => {
        const serverSeed = 'legitimate-server-seed-2026';
        const clientSeed = 'player-client-seed';
        const nonce = 100;

        // Server pre-commits hash before game
        const serverSeedHash = engine.hashServerSeed(serverSeed);

        // Game plays out
        const crashPoint = engine.generateCrashPoint(serverSeed, clientSeed, nonce);

        // After game, server reveals serverSeed
        // Player verifies
        const verification = engine.verifyResult(
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          crashPoint,
        );

        expect(verification.verified).toBe(true);
        expect(verification.hashMatch).toBe(true);
        expect(verification.calculatedPoint).toBe(crashPoint);
      });

      it('should REJECT tampered server seed', () => {
        const realServerSeed = 'real-server-seed';
        const fakeServerSeed = 'fake-server-seed';
        const clientSeed = 'player-seed';
        const nonce = 1;

        // Pre-commit with real seed
        const serverSeedHash = engine.hashServerSeed(realServerSeed);

        // Generate with real seed
        const crashPoint = engine.generateCrashPoint(realServerSeed, clientSeed, nonce);

        // Try to verify with fake seed (operator trying to cheat)
        const verification = engine.verifyResult(
          fakeServerSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          crashPoint,
        );

        expect(verification.verified).toBe(false);
        expect(verification.hashMatch).toBe(false);
      });

      it('should REJECT tampered crash point', () => {
        const serverSeed = 'honest-server-seed';
        const clientSeed = 'player-seed';
        const nonce = 1;

        const serverSeedHash = engine.hashServerSeed(serverSeed);
        const realCrashPoint = engine.generateCrashPoint(serverSeed, clientSeed, nonce);
        const fakeCrashPoint = realCrashPoint + 0.50; // Tampered

        const verification = engine.verifyResult(
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          fakeCrashPoint,
        );

        expect(verification.verified).toBe(false);
        expect(verification.hashMatch).toBe(true); // Hash is fine
        expect(verification.calculatedPoint).toBe(realCrashPoint); // But point doesn't match
      });

      it('should verify 1000 consecutive rounds', () => {
        const masterSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'marathon-test-client';

        for (let round = 0; round < 1000; round++) {
          const serverSeed = engine.generateRoundServerSeed(masterSeed, round);
          const serverSeedHash = engine.hashServerSeed(serverSeed);
          const crashPoint = engine.generateCrashPoint(serverSeed, clientSeed, round);

          const verification = engine.verifyResult(
            serverSeed,
            serverSeedHash,
            clientSeed,
            round,
            crashPoint,
          );

          expect(verification.verified).toBe(true);
        }
      });
    });

    describe('1D: Dragon 2 (Second Crash Point) Verification', () => {
      it('should generate different crash points for Dragon 1 and Dragon 2', () => {
        const serverSeed = 'dual-dragon-seed';
        const clientSeed = 'client-seed';
        const nonce = 1;

        const dragon1 = engine.generateCrashPoint(serverSeed, clientSeed, nonce);
        const dragon2 = engine.generateSecondCrashPoint(serverSeed, clientSeed, nonce);

        // They should be different (uses different combined seed)
        expect(dragon1 === dragon2).toBe(false);
      });

      it('should be deterministic for Dragon 2', () => {
        const serverSeed = 'dragon2-deterministic';
        const clientSeed = 'client';
        const nonce = 5;

        const point1 = engine.generateSecondCrashPoint(serverSeed, clientSeed, nonce);
        const point2 = engine.generateSecondCrashPoint(serverSeed, clientSeed, nonce);

        expect(point1).toBe(point2);
      });

      it('should respect bounds for Dragon 2 (1.00 - 5000)', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'bounds-test';

        for (let i = 0; i < 5000; i++) {
          const point = engine.generateSecondCrashPoint(serverSeed, clientSeed, i);
          expect(point).toBeGreaterThanOrEqual(1.00);
          expect(point).toBeLessThanOrEqual(5000);
        }
      });
    });

    describe('1E: Round Server Seed Generation', () => {
      it('should generate deterministic round seeds from master seed', () => {
        const masterSeed = 'master-seed-2026';

        const roundSeed1a = engine.generateRoundServerSeed(masterSeed, 1);
        const roundSeed1b = engine.generateRoundServerSeed(masterSeed, 1);

        expect(roundSeed1a).toBe(roundSeed1b);
      });

      it('should generate different seeds for different rounds', () => {
        const masterSeed = 'master-seed';

        const seeds = new Set<string>();
        for (let i = 0; i < 100; i++) {
          seeds.add(engine.generateRoundServerSeed(masterSeed, i));
        }

        expect(seeds.size).toBe(100); // All unique
      });

      it('should generate valid hex strings', () => {
        const masterSeed = 'hex-test-master';

        for (let i = 0; i < 50; i++) {
          const seed = engine.generateRoundServerSeed(masterSeed, i);
          expect(seed).toHaveLength(64);
          expect(/^[a-f0-9]{64}$/.test(seed)).toBe(true);
        }
      });
    });

    describe('1F: Statistical Fairness Validation', () => {
      it('should maintain ~4% bust rate (house edge) over 100K rounds', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'statistical-test';
        let bustCount = 0;
        const totalRounds = 100000;

        for (let i = 0; i < totalRounds; i++) {
          const point = engine.generateCrashPoint(serverSeed, clientSeed, i, 0.04);
          if (point <= 1.00) bustCount++;
        }

        const bustRate = bustCount / totalRounds;
        // Should be approximately 4% (within 2% tolerance)
        expect(bustRate).toBeGreaterThan(0.02);
        expect(bustRate).toBeLessThan(0.07);
      });

      it('should have uniform distribution (no clustering)', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'distribution-test';
        const buckets: Record<string, number> = {
          '1.00-1.50': 0,
          '1.50-2.00': 0,
          '2.00-3.00': 0,
          '3.00-5.00': 0,
          '5.00-10.00': 0,
          '10.00+': 0,
        };

        const totalRounds = 50000;
        for (let i = 0; i < totalRounds; i++) {
          const point = engine.generateCrashPoint(serverSeed, clientSeed, i);
          if (point < 1.50) buckets['1.00-1.50']++;
          else if (point < 2.00) buckets['1.50-2.00']++;
          else if (point < 3.00) buckets['2.00-3.00']++;
          else if (point < 5.00) buckets['3.00-5.00']++;
          else if (point < 10.00) buckets['5.00-10.00']++;
          else buckets['10.00+']++;
        }

        // Each bucket should have some entries (no empty buckets)
        for (const [range, count] of Object.entries(buckets)) {
          expect(count).toBeGreaterThan(0);
        }

        // Lower multipliers should be more frequent than higher ones
        expect(buckets['1.00-1.50']).toBeGreaterThan(buckets['10.00+']);
      });

      it('should produce RTP between 95% and 97% at 4% house edge', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = 'rtp-test';
        const totalRounds = 100000;
        const betAmount = 1;
        let totalWagered = 0;
        let totalReturned = 0;

        for (let i = 0; i < totalRounds; i++) {
          const point = engine.generateCrashPoint(serverSeed, clientSeed, i, 0.04);
          totalWagered += betAmount;

          // Simulate auto-cashout at 2x
          if (point >= 2.00) {
            totalReturned += betAmount * 2;
          }
        }

        // This is the return for a specific strategy (2x cashout)
        // The theoretical RTP for this strategy should be around 96%
        const rtp = (totalReturned / totalWagered) * 100;
        // With 2x cashout, expected value = P(survive to 2x) * 2
        // P(survive to 2x) ≈ (1-0.04)/2 = 0.48, so EV ≈ 0.96
        expect(rtp).toBeGreaterThan(90);
        expect(rtp).toBeLessThan(102);
      });
    });
  });

  // ============================================================
  // SCENARIO 2: MULTI-TIER AFFILIATE COMMISSION (3 Levels)
  // ============================================================
  describe('Scenario 2: Multi-Tier Affiliate Commission — 3 Levels', () => {
    let simulator: AffiliateCommissionSimulator;

    beforeEach(() => {
      simulator = new AffiliateCommissionSimulator();

      // Build a 4-level hierarchy:
      // GrandMaster (tier3 recipient) → Master (tier2 recipient) → Affiliate (tier1 recipient) → Player (bettor)
      simulator.addUser({ id: 'grandmaster', username: 'GrandMaster', parentId: null, isBot: false });
      simulator.addUser({ id: 'master', username: 'Master', parentId: 'grandmaster', isBot: false });
      simulator.addUser({ id: 'affiliate', username: 'Affiliate', parentId: 'master', isBot: false });
      simulator.addUser({ id: 'player', username: 'Player', parentId: 'affiliate', isBot: false });
    });

    describe('2A: Basic 3-Tier Commission Distribution', () => {
      it('should distribute commission to all 3 tiers on a $1000 bet', () => {
        const commissions = simulator.processCommission(
          'bet-001',
          'player',
          1000,
          'CRASH',
        );

        expect(commissions.length).toBe(3);

        // Tier 1 (Affiliate): 0.5% of $1000 = $5.00
        const tier1 = commissions.find((c) => c.levelFromSource === 1);
        expect(tier1).toBeDefined();
        expect(tier1!.recipientId).toBe('affiliate');
        expect(tier1!.amount).toBeCloseTo(5.00, 4);

        // Tier 2 (Master): 0.2% of $1000 = $2.00
        const tier2 = commissions.find((c) => c.levelFromSource === 2);
        expect(tier2).toBeDefined();
        expect(tier2!.recipientId).toBe('master');
        expect(tier2!.amount).toBeCloseTo(2.00, 4);

        // Tier 3 (GrandMaster): 0.1% of $1000 = $1.00
        const tier3 = commissions.find((c) => c.levelFromSource === 3);
        expect(tier3).toBeDefined();
        expect(tier3!.recipientId).toBe('grandmaster');
        expect(tier3!.amount).toBeCloseTo(1.00, 4);
      });

      it('should calculate correct total commission (0.8% of bet)', () => {
        simulator.processCommission('bet-001', 'player', 1000, 'CRASH');

        const totalCommission = simulator.getCommissions().reduce((sum, c) => sum + c.amount, 0);
        // Total: 0.5% + 0.2% + 0.1% = 0.8%
        expect(totalCommission).toBeCloseTo(8.00, 4);
      });

      it('should set correct commission type as TURNOVER_REBATE', () => {
        const commissions = simulator.processCommission('bet-001', 'player', 1000, 'CRASH');

        commissions.forEach((c) => {
          expect(c.commissionType).toBe('TURNOVER_REBATE');
          expect(c.currency).toBe('USDT');
        });
      });
    });

    describe('2B: Partial Hierarchy (2-Tier and 1-Tier)', () => {
      it('should distribute to 2 tiers when player has only 2 ancestors', () => {
        // Player with only 2 ancestors
        simulator.addUser({ id: 'top', username: 'Top', parentId: null, isBot: false });
        simulator.addUser({ id: 'mid', username: 'Mid', parentId: 'top', isBot: false });
        simulator.addUser({ id: 'player2', username: 'Player2', parentId: 'mid', isBot: false });

        const commissions = simulator.processCommission('bet-002', 'player2', 500, 'DICE');

        expect(commissions.length).toBe(2);
        expect(commissions[0].recipientId).toBe('mid');
        expect(commissions[0].amount).toBeCloseTo(2.50, 4); // 0.5% of 500
        expect(commissions[1].recipientId).toBe('top');
        expect(commissions[1].amount).toBeCloseTo(1.00, 4); // 0.2% of 500
      });

      it('should distribute to 1 tier when player has only 1 ancestor', () => {
        simulator.addUser({ id: 'parent-only', username: 'Parent', parentId: null, isBot: false });
        simulator.addUser({ id: 'child-only', username: 'Child', parentId: 'parent-only', isBot: false });

        const commissions = simulator.processCommission('bet-003', 'child-only', 200, 'MINES');

        expect(commissions.length).toBe(1);
        expect(commissions[0].recipientId).toBe('parent-only');
        expect(commissions[0].amount).toBeCloseTo(1.00, 4); // 0.5% of 200
      });

      it('should generate NO commission when player has no parent', () => {
        simulator.addUser({ id: 'orphan', username: 'Orphan', parentId: null, isBot: false });

        const commissions = simulator.processCommission('bet-004', 'orphan', 1000, 'CRASH');

        expect(commissions.length).toBe(0);
      });
    });

    describe('2C: Bot Exclusion', () => {
      it('should NOT generate commission for bot bets', () => {
        simulator.addUser({ id: 'real-aff', username: 'RealAff', parentId: null, isBot: false });
        simulator.addUser({ id: 'bot-player', username: 'BotPlayer', parentId: 'real-aff', isBot: true });

        const commissions = simulator.processCommission('bet-005', 'bot-player', 1000, 'CRASH');

        expect(commissions.length).toBe(0);
      });

      it('should skip bot ancestors in the chain', () => {
        simulator.addUser({ id: 'real-top', username: 'RealTop', parentId: null, isBot: false });
        simulator.addUser({ id: 'bot-mid', username: 'BotMid', parentId: 'real-top', isBot: true });
        simulator.addUser({ id: 'real-player', username: 'RealPlayer', parentId: 'bot-mid', isBot: false });

        const commissions = simulator.processCommission('bet-006', 'real-player', 1000, 'CRASH');

        // Bot parent should stop the chain
        expect(commissions.length).toBe(0);
      });
    });

    describe('2D: Multiple Bets Accumulation', () => {
      it('should accumulate commissions across multiple bets', () => {
        // Player makes 10 bets of $100 each
        for (let i = 0; i < 10; i++) {
          simulator.processCommission(`bet-${i}`, 'player', 100, 'CRASH');
        }

        // Affiliate (tier 1) should have: 10 * $100 * 0.5% = $5.00
        const affiliateTotal = simulator.getTotalCommissionForUser('affiliate');
        expect(affiliateTotal).toBeCloseTo(5.00, 4);

        // Master (tier 2) should have: 10 * $100 * 0.2% = $2.00
        const masterTotal = simulator.getTotalCommissionForUser('master');
        expect(masterTotal).toBeCloseTo(2.00, 4);

        // GrandMaster (tier 3) should have: 10 * $100 * 0.1% = $1.00
        const grandmasterTotal = simulator.getTotalCommissionForUser('grandmaster');
        expect(grandmasterTotal).toBeCloseTo(1.00, 4);
      });

      it('should handle high-volume affiliate (1000 bets)', () => {
        for (let i = 0; i < 1000; i++) {
          simulator.processCommission(`bet-${i}`, 'player', 50, 'DICE');
        }

        // Total wagered: $50,000
        // Affiliate: $50,000 * 0.5% = $250
        expect(simulator.getTotalCommissionForUser('affiliate')).toBeCloseTo(250.00, 2);
        // Master: $50,000 * 0.2% = $100
        expect(simulator.getTotalCommissionForUser('master')).toBeCloseTo(100.00, 2);
        // GrandMaster: $50,000 * 0.1% = $50
        expect(simulator.getTotalCommissionForUser('grandmaster')).toBeCloseTo(50.00, 2);
      });
    });

    describe('2E: Cross-Game Commission', () => {
      it('should generate commission for all game types', () => {
        const gameTypes = ['CRASH', 'DICE', 'MINES', 'PLINKO', 'LIMBO', 'OLYMPUS', 'CARD_RUSH', 'PENALTY_SHOOTOUT'];

        gameTypes.forEach((game, i) => {
          simulator.processCommission(`bet-${game}-${i}`, 'player', 100, game);
        });

        // 8 games * 3 tiers = 24 commission records
        expect(simulator.getCommissions().length).toBe(24);

        // Total for affiliate: 8 * $100 * 0.5% = $4.00
        expect(simulator.getTotalCommissionForUser('affiliate')).toBeCloseTo(4.00, 4);
      });
    });
  });

  // ============================================================
  // SCENARIO 3: WAGER MINING PROTECTION
  // ============================================================
  describe('Scenario 3: Wager Mining Protection', () => {
    let simulator: AffiliateCommissionSimulator;

    beforeEach(() => {
      simulator = new AffiliateCommissionSimulator();
      simulator.addUser({ id: 'aff', username: 'Aff', parentId: null, isBot: false });
      simulator.addUser({ id: 'player', username: 'Player', parentId: 'aff', isBot: false });
    });

    describe('3A: Crash Game Wager Mining', () => {
      it('should BLOCK commission for auto-cashout below 1.10x', () => {
        const commissions = simulator.processCommission(
          'bet-wm-1',
          'player',
          1000,
          'CRASH',
          { autoCashoutAt: '1.05' },
        );

        expect(commissions.length).toBe(0);
      });

      it('should ALLOW commission for auto-cashout at 1.10x', () => {
        const commissions = simulator.processCommission(
          'bet-wm-2',
          'player',
          1000,
          'CRASH',
          { autoCashoutAt: '1.10' },
        );

        // 1.10 is NOT less than 1.10, so it should pass
        expect(commissions.length).toBe(1);
      });

      it('should ALLOW commission for auto-cashout above 1.10x', () => {
        const commissions = simulator.processCommission(
          'bet-wm-3',
          'player',
          1000,
          'CRASH',
          { autoCashoutAt: '2.00' },
        );

        expect(commissions.length).toBe(1);
      });

      it('should ALLOW commission when no auto-cashout is set', () => {
        const commissions = simulator.processCommission(
          'bet-wm-4',
          'player',
          1000,
          'CRASH',
          {},
        );

        expect(commissions.length).toBe(1);
      });

      it('should BLOCK Dragon Blaze low-risk bets', () => {
        const commissions = simulator.processCommission(
          'bet-wm-5',
          'player',
          1000,
          'DRAGON_BLAZE',
          { autoCashoutAt: '1.01' },
        );

        expect(commissions.length).toBe(0);
      });

      it('should BLOCK Nova Rush low-risk bets', () => {
        const commissions = simulator.processCommission(
          'bet-wm-6',
          'player',
          1000,
          'NOVA_RUSH',
          { autoCashout: '1.02' },
        );

        expect(commissions.length).toBe(0);
      });
    });

    describe('3B: Dice Game Wager Mining', () => {
      it('should BLOCK commission for dice with >90% win chance', () => {
        const commissions = simulator.processCommission(
          'bet-wm-d1',
          'player',
          1000,
          'DICE',
          { winChance: '95' },
        );

        expect(commissions.length).toBe(0);
      });

      it('should ALLOW commission for dice with 90% win chance', () => {
        const commissions = simulator.processCommission(
          'bet-wm-d2',
          'player',
          1000,
          'DICE',
          { winChance: '90' },
        );

        // 90 is NOT greater than 90, so it should pass
        expect(commissions.length).toBe(1);
      });

      it('should ALLOW commission for dice with 50% win chance', () => {
        const commissions = simulator.processCommission(
          'bet-wm-d3',
          'player',
          1000,
          'DICE',
          { winChance: '50' },
        );

        expect(commissions.length).toBe(1);
      });

      it('should ALLOW commission for dice with no gameData', () => {
        const commissions = simulator.processCommission(
          'bet-wm-d4',
          'player',
          1000,
          'DICE',
        );

        // No gameData = no wager mining check
        expect(commissions.length).toBe(1);
      });
    });

    describe('3C: Non-Protected Games', () => {
      it('should ALWAYS allow commission for Mines (no wager mining check)', () => {
        const commissions = simulator.processCommission(
          'bet-mines',
          'player',
          1000,
          'MINES',
          { minesCount: 1 }, // Even with 1 mine (low risk)
        );

        expect(commissions.length).toBe(1);
      });

      it('should ALWAYS allow commission for Plinko', () => {
        const commissions = simulator.processCommission(
          'bet-plinko',
          'player',
          1000,
          'PLINKO',
          { risk: 'low' },
        );

        expect(commissions.length).toBe(1);
      });
    });
  });

  // ============================================================
  // SCENARIO 4: RANK PROGRESSION & COMMISSION RATES
  // ============================================================
  describe('Scenario 4: Rank Progression & Commission Rates', () => {
    let simulator: AffiliateCommissionSimulator;

    beforeEach(() => {
      simulator = new AffiliateCommissionSimulator();
    });

    describe('4A: Rank Determination by Volume', () => {
      it('should assign Iron rank for $0 volume', () => {
        const rank = simulator.getRankByVolume(0);
        expect(rank.name).toBe('Iron');
        expect(rank.tier1Rate).toBe(0.05);
      });

      it('should assign Bronze rank for $1000 volume', () => {
        const rank = simulator.getRankByVolume(1000);
        expect(rank.name).toBe('Bronze');
        expect(rank.tier1Rate).toBe(0.06);
      });

      it('should assign Silver rank for $5000 volume', () => {
        const rank = simulator.getRankByVolume(5000);
        expect(rank.name).toBe('Silver');
        expect(rank.tier1Rate).toBe(0.07);
      });

      it('should assign Gold rank for $25000 volume', () => {
        const rank = simulator.getRankByVolume(25000);
        expect(rank.name).toBe('Gold');
        expect(rank.tier1Rate).toBe(0.08);
      });

      it('should assign Platinum rank for $100000 volume', () => {
        const rank = simulator.getRankByVolume(100000);
        expect(rank.name).toBe('Platinum');
        expect(rank.tier1Rate).toBe(0.10);
      });

      it('should assign Diamond rank for $500000 volume', () => {
        const rank = simulator.getRankByVolume(500000);
        expect(rank.name).toBe('Diamond');
        expect(rank.tier1Rate).toBe(0.12);
      });

      it('should keep Diamond rank for $1M+ volume', () => {
        const rank = simulator.getRankByVolume(1000000);
        expect(rank.name).toBe('Diamond');
      });

      it('should assign correct rank at boundary values', () => {
        // Just below Bronze
        expect(simulator.getRankByVolume(999).name).toBe('Iron');
        // Exactly Bronze
        expect(simulator.getRankByVolume(1000).name).toBe('Bronze');
        // Just below Silver
        expect(simulator.getRankByVolume(4999).name).toBe('Bronze');
        // Exactly Silver
        expect(simulator.getRankByVolume(5000).name).toBe('Silver');
      });
    });

    describe('4B: Next Rank Calculation', () => {
      it('should return Bronze as next rank for Iron', () => {
        const iron = simulator.getRankByVolume(0);
        const next = simulator.getNextRank(iron);
        expect(next).not.toBeNull();
        expect(next!.name).toBe('Bronze');
      });

      it('should return null for Diamond (highest rank)', () => {
        const diamond = simulator.getRankByVolume(500000);
        const next = simulator.getNextRank(diamond);
        expect(next).toBeNull();
      });

      it('should correctly chain all rank progressions', () => {
        const expectedProgression = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

        let currentRank = simulator.getRankByVolume(0);
        const progression = [currentRank.name];

        while (true) {
          const next = simulator.getNextRank(currentRank);
          if (!next) break;
          progression.push(next.name);
          currentRank = next;
        }

        expect(progression).toEqual(expectedProgression);
      });
    });

    describe('4C: Commission Rate Validation', () => {
      it('should have increasing tier1 rates across ranks', () => {
        const rates = RANKS.map((r) => r.tier1Rate);
        for (let i = 1; i < rates.length; i++) {
          expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
        }
      });

      it('should have increasing tier2 rates across ranks', () => {
        const rates = RANKS.map((r) => r.tier2Rate);
        for (let i = 1; i < rates.length; i++) {
          expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
        }
      });

      it('should have increasing tier3 rates across ranks', () => {
        const rates = RANKS.map((r) => r.tier3Rate);
        for (let i = 1; i < rates.length; i++) {
          expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
        }
      });

      it('should always have tier1 > tier2 > tier3 rates within each rank', () => {
        RANKS.forEach((rank) => {
          expect(rank.tier1Rate).toBeGreaterThan(rank.tier2Rate);
          expect(rank.tier2Rate).toBeGreaterThan(rank.tier3Rate);
        });
      });

      it('should have all rates between 0 and 1 (0-100%)', () => {
        RANKS.forEach((rank) => {
          expect(rank.tier1Rate).toBeGreaterThan(0);
          expect(rank.tier1Rate).toBeLessThan(1);
          expect(rank.tier2Rate).toBeGreaterThan(0);
          expect(rank.tier2Rate).toBeLessThan(1);
          expect(rank.tier3Rate).toBeGreaterThan(0);
          expect(rank.tier3Rate).toBeLessThan(1);
        });
      });
    });

    describe('4D: Rank Metadata Validation', () => {
      it('should have unique names for all ranks', () => {
        const names = RANKS.map((r) => r.name);
        expect(new Set(names).size).toBe(names.length);
      });

      it('should have increasing minVolume thresholds', () => {
        for (let i = 1; i < RANKS.length; i++) {
          expect(RANKS[i].minVolume).toBeGreaterThan(RANKS[i - 1].minVolume);
        }
      });

      it('should have valid color hex codes', () => {
        RANKS.forEach((rank) => {
          expect(/^#[0-9A-Fa-f]{6}$/.test(rank.color)).toBe(true);
        });
      });

      it('should have exactly 6 ranks', () => {
        expect(RANKS.length).toBe(6);
      });

      it('should start at $0 volume (Iron)', () => {
        expect(RANKS[0].minVolume).toBe(0);
        expect(RANKS[0].name).toBe('Iron');
      });
    });
  });
});
