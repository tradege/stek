/**
 * VIP Configuration — Synced with Frontend VIP Page
 * Bronze → Silver → Gold → Platinum → Diamond → Iron (TOP)
 */
export const VIP_TIERS = [
  {
    level: 0,
    name: 'Bronze',
    icon: '🥉',
    minWager: 0,
    rakebackRate: 0.05,       // 5%
    withdrawalLimitDaily: 5000,
  },
  {
    level: 1,
    name: 'Silver',
    icon: '🥈',
    minWager: 1000,
    rakebackRate: 0.07,       // 7%
    withdrawalLimitDaily: 10000,
  },
  {
    level: 2,
    name: 'Gold',
    icon: '🥇',
    minWager: 10000,
    rakebackRate: 0.10,       // 10%
    withdrawalLimitDaily: 25000,
  },
  {
    level: 3,
    name: 'Platinum',
    icon: '💎',
    minWager: 50000,
    rakebackRate: 0.12,       // 12%
    withdrawalLimitDaily: 50000,
  },
  {
    level: 4,
    name: 'Diamond',
    icon: '👑',
    minWager: 250000,
    rakebackRate: 0.15,       // 15%
    withdrawalLimitDaily: 100000,
  },
  {
    level: 5,
    name: 'Iron',
    icon: '🏆',
    minWager: 1000000,
    rakebackRate: 0.20,       // 20%
    withdrawalLimitDaily: Infinity, // Unlimited
  },
];

/**
 * Get VIP tier by level number
 */
export function getVipTier(level: number) {
  return VIP_TIERS[Math.min(level, VIP_TIERS.length - 1)] || VIP_TIERS[0];
}

/**
 * Calculate VIP level based on total wagered amount
 */
export function calculateVipLevel(totalWagered: number): number {
  let level = 0;
  for (const tier of VIP_TIERS) {
    if (totalWagered >= tier.minWager) {
      level = tier.level;
    }
  }
  return level;
}

/**
 * Get rakeback rate for a VIP level
 */
export function getRakebackRate(vipLevel: number): number {
  const tier = getVipTier(vipLevel);
  return tier.rakebackRate;
}

/**
 * Get daily withdrawal limit for a VIP level (in USD)
 */
export function getWithdrawalLimit(vipLevel: number): number {
  const tier = getVipTier(vipLevel);
  return tier.withdrawalLimitDaily;
}
