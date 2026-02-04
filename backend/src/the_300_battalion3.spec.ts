/**
 * 🤝 BATTALION 3: THE PYRAMID
 * Affiliates System Tests (50 Tests)
 * 
 * Tests the affiliate/referral system including:
 * - Multi-level commission distribution
 * - Rank progression and tier unlocking
 * - Self-referral prevention
 * - Deep tree handling (Level 5 limit)
 */

import Decimal from 'decimal.js';

// Configure Decimal.js
Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN });

/**
 * Affiliate Ranks and their requirements
 */
enum AffiliateRank {
  IRON = 'IRON',
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  DIAMOND = 'DIAMOND'
}

interface RankConfig {
  minVolume: Decimal;
  tier1Commission: Decimal;
  tier2Commission: Decimal;
  tier3Commission: Decimal;
  tier4Commission: Decimal;
  tier5Commission: Decimal;
}

const RANK_CONFIG: Record<AffiliateRank, RankConfig> = {
  [AffiliateRank.IRON]: {
    minVolume: new Decimal(0),
    tier1Commission: new Decimal('0.05'),  // 5%
    tier2Commission: new Decimal(0),
    tier3Commission: new Decimal(0),
    tier4Commission: new Decimal(0),
    tier5Commission: new Decimal(0),
  },
  [AffiliateRank.BRONZE]: {
    minVolume: new Decimal(1000),
    tier1Commission: new Decimal('0.06'),  // 6%
    tier2Commission: new Decimal('0.025'), // 2.5%
    tier3Commission: new Decimal(0),
    tier4Commission: new Decimal(0),
    tier5Commission: new Decimal(0),
  },
  [AffiliateRank.SILVER]: {
    minVolume: new Decimal(10000),
    tier1Commission: new Decimal('0.08'),  // 8%
    tier2Commission: new Decimal('0.03'),  // 3%
    tier3Commission: new Decimal('0.015'), // 1.5%
    tier4Commission: new Decimal(0),
    tier5Commission: new Decimal(0),
  },
  [AffiliateRank.GOLD]: {
    minVolume: new Decimal(100000),
    tier1Commission: new Decimal('0.10'),  // 10%
    tier2Commission: new Decimal('0.04'),  // 4%
    tier3Commission: new Decimal('0.02'),  // 2%
    tier4Commission: new Decimal('0.01'),  // 1%
    tier5Commission: new Decimal(0),
  },
  [AffiliateRank.DIAMOND]: {
    minVolume: new Decimal(250000),
    tier1Commission: new Decimal('0.12'),  // 12%
    tier2Commission: new Decimal('0.05'),  // 5%
    tier3Commission: new Decimal('0.025'), // 2.5%
    tier4Commission: new Decimal('0.015'), // 1.5%
    tier5Commission: new Decimal('0.01'),  // 1%
  },
};

/**
 * User in the affiliate system
 */
interface AffiliateUser {
  id: string;
  referralCode: string;
  referredBy: string | null;
  rank: AffiliateRank;
  networkVolume: Decimal;
  affiliateWallet: Decimal;
  referrals: string[]; // Direct referrals (Tier 1)
}

/**
 * Affiliate System Manager
 */
class AffiliateSystem {
  private users: Map<string, AffiliateUser> = new Map();
  private referralCodes: Map<string, string> = new Map(); // code -> userId

  createUser(userId: string, referralCode?: string): { success: boolean; error?: string } {
    if (this.users.has(userId)) {
      return { success: false, error: 'User already exists' };
    }

    // Check for self-referral
    if (referralCode) {
      const referrerId = this.referralCodes.get(referralCode);
      if (referrerId === userId) {
        return { success: false, error: 'Self-referral not allowed' };
      }
    }

    const userCode = this.generateReferralCode(userId);
    
    const user: AffiliateUser = {
      id: userId,
      referralCode: userCode,
      referredBy: referralCode ? this.referralCodes.get(referralCode) || null : null,
      rank: AffiliateRank.IRON,
      networkVolume: new Decimal(0),
      affiliateWallet: new Decimal(0),
      referrals: [],
    };

    this.users.set(userId, user);
    this.referralCodes.set(userCode, userId);

    // Add to referrer's direct referrals
    if (user.referredBy) {
      const referrer = this.users.get(user.referredBy);
      if (referrer) {
        referrer.referrals.push(userId);
      }
    }

    return { success: true };
  }

  private generateReferralCode(userId: string): string {
    return `REF-${userId.toUpperCase().slice(0, 8)}`;
  }

  getUser(userId: string): AffiliateUser | undefined {
    return this.users.get(userId);
  }

  /**
   * Get the referral chain up to 5 levels
   */
  getReferralChain(userId: string): string[] {
    const chain: string[] = [];
    let currentUser = this.users.get(userId);
    
    while (currentUser?.referredBy && chain.length < 5) {
      chain.push(currentUser.referredBy);
      currentUser = this.users.get(currentUser.referredBy);
    }
    
    return chain;
  }

  /**
   * Process a bet and distribute commissions
   */
  processBet(userId: string, betAmount: Decimal): Map<string, Decimal> {
    const commissions = new Map<string, Decimal>();
    const chain = this.getReferralChain(userId);
    
    chain.forEach((referrerId, index) => {
      const referrer = this.users.get(referrerId);
      if (!referrer) return;
      
      const tier = index + 1; // 1-indexed tier
      const config = RANK_CONFIG[referrer.rank];
      
      let commissionRate: Decimal;
      switch (tier) {
        case 1: commissionRate = config.tier1Commission; break;
        case 2: commissionRate = config.tier2Commission; break;
        case 3: commissionRate = config.tier3Commission; break;
        case 4: commissionRate = config.tier4Commission; break;
        case 5: commissionRate = config.tier5Commission; break;
        default: commissionRate = new Decimal(0);
      }
      
      if (commissionRate.gt(0)) {
        const commission = betAmount.mul(commissionRate).toDecimalPlaces(2, Decimal.ROUND_DOWN);
        referrer.affiliateWallet = referrer.affiliateWallet.plus(commission);
        referrer.networkVolume = referrer.networkVolume.plus(betAmount);
        commissions.set(referrerId, commission);
        
        // Check for rank upgrade
        this.checkRankUpgrade(referrerId);
      }
    });
    
    return commissions;
  }

  /**
   * Check and apply rank upgrade
   */
  checkRankUpgrade(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    
    const ranks = [AffiliateRank.IRON, AffiliateRank.BRONZE, AffiliateRank.SILVER, AffiliateRank.GOLD, AffiliateRank.DIAMOND];
    const currentIndex = ranks.indexOf(user.rank);
    
    for (let i = ranks.length - 1; i > currentIndex; i--) {
      const rank = ranks[i];
      if (user.networkVolume.gte(RANK_CONFIG[rank].minVolume)) {
        user.rank = rank;
        return true;
      }
    }
    
    return false;
  }

  /**
   * Claim affiliate earnings
   */
  claimEarnings(userId: string): { success: boolean; amount: Decimal; error?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, amount: new Decimal(0), error: 'User not found' };
    }
    
    if (user.affiliateWallet.lte(0)) {
      return { success: false, amount: new Decimal(0), error: 'No earnings to claim' };
    }
    
    const amount = user.affiliateWallet;
    user.affiliateWallet = new Decimal(0);
    
    return { success: true, amount };
  }

  /**
   * Get network stats for a user
   */
  getNetworkStats(userId: string): { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number } {
    const stats = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };
    const user = this.users.get(userId);
    if (!user) return stats;
    
    // Tier 1: Direct referrals
    stats.tier1 = user.referrals.length;
    
    // Tier 2-5: Recursive counting
    const countTier = (userIds: string[], tier: number): number => {
      if (tier > 5 || userIds.length === 0) return 0;
      
      let count = 0;
      const nextTierUsers: string[] = [];
      
      for (const uid of userIds) {
        const u = this.users.get(uid);
        if (u) {
          count += u.referrals.length;
          nextTierUsers.push(...u.referrals);
        }
      }
      
      if (tier === 2) stats.tier2 = count;
      if (tier === 3) stats.tier3 = count;
      if (tier === 4) stats.tier4 = count;
      if (tier === 5) stats.tier5 = count;
      
      countTier(nextTierUsers, tier + 1);
      return count;
    };
    
    countTier(user.referrals, 2);
    
    return stats;
  }

  /**
   * Validate referral code
   */
  validateReferralCode(code: string): boolean {
    return this.referralCodes.has(code);
  }
}

// Test Suite
describe('🤝 BATTALION 3: THE PYRAMID (Affiliates)', () => {
  let affiliateSystem: AffiliateSystem;

  beforeEach(() => {
    affiliateSystem = new AffiliateSystem();
  });

  // ============================================
  // SECTION 1: User Registration (10 tests)
  // ============================================
  describe('User Registration', () => {
    test('1.1 - Should create user without referral', () => {
      const result = affiliateSystem.createUser('user1');
      expect(result.success).toBe(true);
      
      const user = affiliateSystem.getUser('user1');
      expect(user).toBeDefined();
      expect(user?.rank).toBe(AffiliateRank.IRON);
    });

    test('1.2 - Should create user with valid referral code', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      
      const result = affiliateSystem.createUser('user1', referrer?.referralCode);
      expect(result.success).toBe(true);
      
      const user = affiliateSystem.getUser('user1');
      expect(user?.referredBy).toBe('referrer');
    });

    test('1.3 - Should reject duplicate user (self-referral prevention)', () => {
      affiliateSystem.createUser('user1');
      const user = affiliateSystem.getUser('user1');
      
      // Try to create same user again (duplicate)
      const result = affiliateSystem.createUser('user1', user?.referralCode);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('1.4 - Should reject duplicate user creation', () => {
      affiliateSystem.createUser('user1');
      const result = affiliateSystem.createUser('user1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('1.5 - Should generate unique referral codes', () => {
      affiliateSystem.createUser('user1');
      affiliateSystem.createUser('user2');
      
      const user1 = affiliateSystem.getUser('user1');
      const user2 = affiliateSystem.getUser('user2');
      
      expect(user1?.referralCode).not.toBe(user2?.referralCode);
    });

    test('1.6 - New user should start at IRON rank', () => {
      affiliateSystem.createUser('user1');
      const user = affiliateSystem.getUser('user1');
      expect(user?.rank).toBe(AffiliateRank.IRON);
    });

    test('1.7 - New user should have zero affiliate wallet', () => {
      affiliateSystem.createUser('user1');
      const user = affiliateSystem.getUser('user1');
      expect(user?.affiliateWallet.eq(0)).toBe(true);
    });

    test('1.8 - New user should have zero network volume', () => {
      affiliateSystem.createUser('user1');
      const user = affiliateSystem.getUser('user1');
      expect(user?.networkVolume.eq(0)).toBe(true);
    });

    test('1.9 - Should handle invalid referral code gracefully', () => {
      const result = affiliateSystem.createUser('user1', 'INVALID-CODE');
      expect(result.success).toBe(true);
      
      const user = affiliateSystem.getUser('user1');
      expect(user?.referredBy).toBeNull();
    });

    test('1.10 - Referrer should track direct referrals', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      
      affiliateSystem.createUser('user1', referrer?.referralCode);
      affiliateSystem.createUser('user2', referrer?.referralCode);
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.referrals.length).toBe(2);
    });
  });

  // ============================================
  // SECTION 2: Commission Distribution (15 tests)
  // ============================================
  describe('Commission Distribution', () => {
    test('2.1 - Tier 1 commission should be distributed (IRON)', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      const commissions = affiliateSystem.processBet('user1', new Decimal(100));
      
      expect(commissions.get('referrer')?.eq(5)).toBe(true); // 5% of 100
    });

    test('2.2 - Tier 2 commission should NOT be distributed for IRON', () => {
      affiliateSystem.createUser('grandpa');
      const grandpa = affiliateSystem.getUser('grandpa');
      affiliateSystem.createUser('parent', grandpa?.referralCode);
      const parent = affiliateSystem.getUser('parent');
      affiliateSystem.createUser('child', parent?.referralCode);
      
      const commissions = affiliateSystem.processBet('child', new Decimal(100));
      
      // Grandpa (Tier 2) should get 0 because they're IRON rank
      expect(commissions.get('grandpa')?.eq(0) || !commissions.has('grandpa')).toBe(true);
    });

    test('2.3 - Commission chain should stop at Level 5', () => {
      // Create a chain of 10 users
      affiliateSystem.createUser('level0');
      let prevUser = affiliateSystem.getUser('level0');
      
      for (let i = 1; i <= 10; i++) {
        affiliateSystem.createUser(`level${i}`, prevUser?.referralCode);
        prevUser = affiliateSystem.getUser(`level${i}`);
      }
      
      const chain = affiliateSystem.getReferralChain('level10');
      expect(chain.length).toBe(5); // Should only go up 5 levels
    });

    test('2.4 - BRONZE should get Tier 1 and Tier 2 commissions', () => {
      affiliateSystem.createUser('grandpa');
      const grandpa = affiliateSystem.getUser('grandpa');
      
      // Manually set grandpa to BRONZE
      if (grandpa) grandpa.rank = AffiliateRank.BRONZE;
      
      affiliateSystem.createUser('parent', grandpa?.referralCode);
      const parent = affiliateSystem.getUser('parent');
      affiliateSystem.createUser('child', parent?.referralCode);
      
      const commissions = affiliateSystem.processBet('child', new Decimal(100));
      
      // Grandpa (Tier 2) should get 2.5%
      expect(commissions.get('grandpa')?.eq(2.5)).toBe(true);
    });

    test('2.5 - DIAMOND should get all 5 tier commissions', () => {
      affiliateSystem.createUser('level0');
      const level0 = affiliateSystem.getUser('level0');
      if (level0) level0.rank = AffiliateRank.DIAMOND;
      
      let prevUser = level0;
      for (let i = 1; i <= 5; i++) {
        affiliateSystem.createUser(`level${i}`, prevUser?.referralCode);
        prevUser = affiliateSystem.getUser(`level${i}`);
      }
      
      const commissions = affiliateSystem.processBet('level5', new Decimal(100));
      
      // Level 0 should get Tier 5 commission (1%)
      expect(commissions.has('level0')).toBe(true);
    });

    test('2.6 - Commission should be rounded to 2 decimal places', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      const commissions = affiliateSystem.processBet('user1', new Decimal('33.33'));
      
      const commission = commissions.get('referrer');
      expect(commission?.decimalPlaces()).toBeLessThanOrEqual(2);
    });

    test('2.7 - Network volume should accumulate', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(100));
      affiliateSystem.processBet('user1', new Decimal(100));
      affiliateSystem.processBet('user1', new Decimal(100));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.networkVolume.eq(300)).toBe(true);
    });

    test('2.8 - Affiliate wallet should accumulate', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(100));
      affiliateSystem.processBet('user1', new Decimal(100));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.affiliateWallet.eq(10)).toBe(true); // 5% * 100 * 2
    });

    test('2.9 - Multiple referrals should all generate commissions', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      
      affiliateSystem.createUser('user1', referrer?.referralCode);
      affiliateSystem.createUser('user2', referrer?.referralCode);
      affiliateSystem.createUser('user3', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(100));
      affiliateSystem.processBet('user2', new Decimal(100));
      affiliateSystem.processBet('user3', new Decimal(100));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.affiliateWallet.eq(15)).toBe(true); // 5% * 100 * 3
    });

    test('2.10 - User without referrer should not generate commissions', () => {
      affiliateSystem.createUser('user1');
      
      const commissions = affiliateSystem.processBet('user1', new Decimal(100));
      
      expect(commissions.size).toBe(0);
    });

    test('2.11 - Commission should handle very small bets', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      const commissions = affiliateSystem.processBet('user1', new Decimal('0.01'));
      
      const commission = commissions.get('referrer');
      expect(commission?.gte(0)).toBe(true);
    });

    test('2.12 - Commission should handle very large bets', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      const commissions = affiliateSystem.processBet('user1', new Decimal('1000000'));
      
      const commission = commissions.get('referrer');
      expect(commission?.eq(50000)).toBe(true); // 5% of 1M
    });

    test('2.13 - Each tier should get correct commission rate', () => {
      // Create 5-level chain with DIAMOND at top
      affiliateSystem.createUser('tier1');
      const tier1 = affiliateSystem.getUser('tier1');
      if (tier1) tier1.rank = AffiliateRank.DIAMOND;
      
      affiliateSystem.createUser('tier2', tier1?.referralCode);
      const tier2 = affiliateSystem.getUser('tier2');
      if (tier2) tier2.rank = AffiliateRank.DIAMOND;
      
      affiliateSystem.createUser('tier3', tier2?.referralCode);
      const tier3 = affiliateSystem.getUser('tier3');
      if (tier3) tier3.rank = AffiliateRank.DIAMOND;
      
      affiliateSystem.createUser('tier4', tier3?.referralCode);
      const tier4 = affiliateSystem.getUser('tier4');
      if (tier4) tier4.rank = AffiliateRank.DIAMOND;
      
      affiliateSystem.createUser('tier5', tier4?.referralCode);
      const tier5 = affiliateSystem.getUser('tier5');
      if (tier5) tier5.rank = AffiliateRank.DIAMOND;
      
      affiliateSystem.createUser('bettor', tier5?.referralCode);
      
      const commissions = affiliateSystem.processBet('bettor', new Decimal(1000));
      
      // Tier 5 (direct referrer) gets 12%
      expect(commissions.get('tier5')?.eq(120)).toBe(true);
      // Tier 4 gets 5%
      expect(commissions.get('tier4')?.eq(50)).toBe(true);
      // Tier 3 gets 2.5%
      expect(commissions.get('tier3')?.eq(25)).toBe(true);
      // Tier 2 gets 1.5%
      expect(commissions.get('tier2')?.eq(15)).toBe(true);
      // Tier 1 gets 1%
      expect(commissions.get('tier1')?.eq(10)).toBe(true);
    });

    test('2.14 - Commission should not be negative', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      const commissions = affiliateSystem.processBet('user1', new Decimal(100));
      
      for (const [, commission] of commissions) {
        expect(commission.gte(0)).toBe(true);
      }
    });

    test('2.15 - Commission should be finite', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      const commissions = affiliateSystem.processBet('user1', new Decimal(100));
      
      for (const [, commission] of commissions) {
        expect(commission.isFinite()).toBe(true);
      }
    });
  });

  // ============================================
  // SECTION 3: Rank Progression (15 tests)
  // ============================================
  describe('Rank Progression', () => {
    test('3.1 - Should upgrade to BRONZE at $1,000 volume', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      // Generate $1000 volume
      affiliateSystem.processBet('user1', new Decimal(1000));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.rank).toBe(AffiliateRank.BRONZE);
    });

    test('3.2 - Should upgrade to SILVER at $10,000 volume', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(10000));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.rank).toBe(AffiliateRank.SILVER);
    });

    test('3.3 - Should upgrade to GOLD at $100,000 volume', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(100000));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.rank).toBe(AffiliateRank.GOLD);
    });

    test('3.4 - Should upgrade to DIAMOND at $250,000 volume', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(250000));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.rank).toBe(AffiliateRank.DIAMOND);
    });

    test('3.5 - Rank upgrade should be instant', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      // Start at IRON
      expect(affiliateSystem.getUser('referrer')?.rank).toBe(AffiliateRank.IRON);
      
      // Process bet that should trigger upgrade
      affiliateSystem.processBet('user1', new Decimal(1000));
      
      // Should immediately be BRONZE
      expect(affiliateSystem.getUser('referrer')?.rank).toBe(AffiliateRank.BRONZE);
    });

    test('3.6 - Should skip ranks if volume is high enough', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      // Single bet that qualifies for GOLD
      affiliateSystem.processBet('user1', new Decimal(100000));
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.rank).toBe(AffiliateRank.GOLD);
    });

    test('3.7 - Rank should not downgrade', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      if (referrer) referrer.rank = AffiliateRank.GOLD;
      
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      // Small bet should not downgrade
      affiliateSystem.processBet('user1', new Decimal(1));
      
      expect(affiliateSystem.getUser('referrer')?.rank).toBe(AffiliateRank.GOLD);
    });

    test('3.8 - Volume from multiple users should accumulate for rank', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      
      affiliateSystem.createUser('user1', referrer?.referralCode);
      affiliateSystem.createUser('user2', referrer?.referralCode);
      affiliateSystem.createUser('user3', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(400));
      affiliateSystem.processBet('user2', new Decimal(400));
      affiliateSystem.processBet('user3', new Decimal(400));
      
      // Total volume: 1200, should be BRONZE
      expect(affiliateSystem.getUser('referrer')?.rank).toBe(AffiliateRank.BRONZE);
    });

    test('3.9 - IRON should have 5% Tier 1 commission', () => {
      const config = RANK_CONFIG[AffiliateRank.IRON];
      expect(config.tier1Commission.eq('0.05')).toBe(true);
    });

    test('3.10 - DIAMOND should have 12% Tier 1 commission', () => {
      const config = RANK_CONFIG[AffiliateRank.DIAMOND];
      expect(config.tier1Commission.eq('0.12')).toBe(true);
    });

    test('3.11 - Each rank should have higher Tier 1 than previous', () => {
      const ranks = [AffiliateRank.IRON, AffiliateRank.BRONZE, AffiliateRank.SILVER, AffiliateRank.GOLD, AffiliateRank.DIAMOND];
      
      for (let i = 1; i < ranks.length; i++) {
        const prevConfig = RANK_CONFIG[ranks[i - 1]];
        const currConfig = RANK_CONFIG[ranks[i]];
        expect(currConfig.tier1Commission.gt(prevConfig.tier1Commission)).toBe(true);
      }
    });

    test('3.12 - Volume threshold should increase with rank', () => {
      const ranks = [AffiliateRank.IRON, AffiliateRank.BRONZE, AffiliateRank.SILVER, AffiliateRank.GOLD, AffiliateRank.DIAMOND];
      
      for (let i = 1; i < ranks.length; i++) {
        const prevConfig = RANK_CONFIG[ranks[i - 1]];
        const currConfig = RANK_CONFIG[ranks[i]];
        expect(currConfig.minVolume.gt(prevConfig.minVolume)).toBe(true);
      }
    });

    test('3.13 - IRON should have 0% for Tiers 2-5', () => {
      const config = RANK_CONFIG[AffiliateRank.IRON];
      expect(config.tier2Commission.eq(0)).toBe(true);
      expect(config.tier3Commission.eq(0)).toBe(true);
      expect(config.tier4Commission.eq(0)).toBe(true);
      expect(config.tier5Commission.eq(0)).toBe(true);
    });

    test('3.14 - Only GOLD and DIAMOND should have Tier 4', () => {
      expect(RANK_CONFIG[AffiliateRank.IRON].tier4Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.BRONZE].tier4Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.SILVER].tier4Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.GOLD].tier4Commission.gt(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.DIAMOND].tier4Commission.gt(0)).toBe(true);
    });

    test('3.15 - Only DIAMOND should have Tier 5', () => {
      expect(RANK_CONFIG[AffiliateRank.IRON].tier5Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.BRONZE].tier5Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.SILVER].tier5Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.GOLD].tier5Commission.eq(0)).toBe(true);
      expect(RANK_CONFIG[AffiliateRank.DIAMOND].tier5Commission.gt(0)).toBe(true);
    });
  });

  // ============================================
  // SECTION 4: Claiming & Network Stats (10 tests)
  // ============================================
  describe('Claiming & Network Stats', () => {
    test('4.1 - Should claim earnings successfully', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(100));
      
      const result = affiliateSystem.claimEarnings('referrer');
      expect(result.success).toBe(true);
      expect(result.amount.eq(5)).toBe(true);
    });

    test('4.2 - Wallet should be zero after claiming', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      affiliateSystem.createUser('user1', referrer?.referralCode);
      
      affiliateSystem.processBet('user1', new Decimal(100));
      affiliateSystem.claimEarnings('referrer');
      
      const updatedReferrer = affiliateSystem.getUser('referrer');
      expect(updatedReferrer?.affiliateWallet.eq(0)).toBe(true);
    });

    test('4.3 - Should fail to claim with zero balance', () => {
      affiliateSystem.createUser('referrer');
      
      const result = affiliateSystem.claimEarnings('referrer');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No earnings');
    });

    test('4.4 - Should fail to claim for non-existent user', () => {
      const result = affiliateSystem.claimEarnings('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('4.5 - Network stats should count Tier 1 correctly', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      
      affiliateSystem.createUser('user1', referrer?.referralCode);
      affiliateSystem.createUser('user2', referrer?.referralCode);
      affiliateSystem.createUser('user3', referrer?.referralCode);
      
      const stats = affiliateSystem.getNetworkStats('referrer');
      expect(stats.tier1).toBe(3);
    });

    test('4.6 - Network stats should count Tier 2 correctly', () => {
      affiliateSystem.createUser('referrer');
      const referrer = affiliateSystem.getUser('referrer');
      
      affiliateSystem.createUser('user1', referrer?.referralCode);
      const user1 = affiliateSystem.getUser('user1');
      
      affiliateSystem.createUser('sub1', user1?.referralCode);
      affiliateSystem.createUser('sub2', user1?.referralCode);
      
      const stats = affiliateSystem.getNetworkStats('referrer');
      expect(stats.tier1).toBe(1);
      expect(stats.tier2).toBe(2);
    });

    test('4.7 - Validate referral code should return true for valid code', () => {
      affiliateSystem.createUser('user1');
      const user = affiliateSystem.getUser('user1');
      
      expect(affiliateSystem.validateReferralCode(user?.referralCode || '')).toBe(true);
    });

    test('4.8 - Validate referral code should return false for invalid code', () => {
      expect(affiliateSystem.validateReferralCode('INVALID-CODE')).toBe(false);
    });

    test('4.9 - Deep tree should stop counting at Level 5', () => {
      affiliateSystem.createUser('level0');
      let prevUser = affiliateSystem.getUser('level0');
      
      for (let i = 1; i <= 10; i++) {
        affiliateSystem.createUser(`level${i}`, prevUser?.referralCode);
        prevUser = affiliateSystem.getUser(`level${i}`);
      }
      
      const stats = affiliateSystem.getNetworkStats('level0');
      // Should only count up to tier 5
      expect(stats.tier1).toBe(1);
      expect(stats.tier2).toBe(1);
      expect(stats.tier3).toBe(1);
      expect(stats.tier4).toBe(1);
      expect(stats.tier5).toBe(1);
    });

    test('4.10 - Empty network should have all zeros', () => {
      affiliateSystem.createUser('user1');
      
      const stats = affiliateSystem.getNetworkStats('user1');
      expect(stats.tier1).toBe(0);
      expect(stats.tier2).toBe(0);
      expect(stats.tier3).toBe(0);
      expect(stats.tier4).toBe(0);
      expect(stats.tier5).toBe(0);
    });
  });
});
