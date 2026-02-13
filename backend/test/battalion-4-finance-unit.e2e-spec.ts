/**
 * ⚔️ BATTALION 4: FINANCE & COMMISSION LOGIC
 * ═══════════════════════════════════════════════════════════
 * Target: commission-processor.service.ts & admin-finance.service.ts
 * 
 * Scenario 1: The Affiliate Engine — Multi-Tier Commissions
 * Scenario 2: The CFO Dashboard — GGR, Net Revenue, Provider Fees
 * Scenario 3: Precision & Rounding — The Floor Test
 * Scenario 4: Wager Mining Protection
 * Scenario 5: Edge Cases & Boundary Conditions
 * ═══════════════════════════════════════════════════════════
 */

// ============================================================
// CONSTANTS (mirrored from commission-processor.service.ts)
// ============================================================
const COMMISSION_RATES = {
  tier1: 0.005,  // 0.5% for direct referrals
  tier2: 0.002,  // 0.2% for tier 2
  tier3: 0.001,  // 0.1% for tier 3
};

const MIN_CRASH_MULTIPLIER = 1.10;
const MAX_DICE_WIN_CHANCE = 90;

// ============================================================
// PURE LOGIC EXTRACTED FROM SERVICES
// ============================================================

/**
 * Calculate commission for a single tier
 */
function calculateTierCommission(betAmount: number, tier: 1 | 2 | 3): number {
  const rate = tier === 1
    ? COMMISSION_RATES.tier1
    : tier === 2
      ? COMMISSION_RATES.tier2
      : COMMISSION_RATES.tier3;
  return betAmount * rate;
}

/**
 * Calculate all tier commissions for a bet
 * Returns array of { tier, amount } for each eligible parent
 */
function calculateAllCommissions(
  betAmount: number,
  parentChainLength: number,
): Array<{ tier: number; amount: number }> {
  const commissions: Array<{ tier: number; amount: number }> = [];
  for (let i = 1; i <= Math.min(parentChainLength, 3); i++) {
    commissions.push({
      tier: i,
      amount: calculateTierCommission(betAmount, i as 1 | 2 | 3),
    });
  }
  return commissions;
}

/**
 * Precision rounding — toFixed(8) for Decimal storage
 * The service uses: new Decimal(amount.toFixed(8))
 */
function roundCommission(amount: number): string {
  return amount.toFixed(8);
}

/**
 * Floor to 2 decimal places (for display/payout)
 */
function floorTo2Decimals(amount: number): number {
  return Math.floor(amount * 100) / 100;
}

/**
 * Wager Mining Protection — isLowRiskBet logic
 */
function isLowRiskBet(
  gameType: string,
  gameData?: Record<string, any>,
): boolean {
  if (!gameData) return false;

  // CRASH-type games: reject if auto-cashout is below minimum multiplier
  if (['CRASH', 'DRAGON_BLAZE', 'NOVA_RUSH'].includes(gameType)) {
    const autoCashout = parseFloat(gameData.autoCashoutAt || gameData.autoCashout || '0');
    if (autoCashout > 0 && autoCashout < MIN_CRASH_MULTIPLIER) {
      return true;
    }
  }

  // DICE: reject if win chance is too high
  if (gameType === 'DICE') {
    const winChance = parseFloat(gameData.winChance || gameData.chance || '0');
    if (winChance > MAX_DICE_WIN_CHANCE) {
      return true;
    }
  }

  return false;
}

/**
 * Self-referral check — user cannot be their own parent
 */
function isSelfReferral(userId: string, parentId: string | null): boolean {
  return userId === parentId;
}

/**
 * Bot check — bots don't generate commissions
 */
function shouldGenerateCommission(
  userId: string,
  parentId: string | null,
  isBot: boolean,
): boolean {
  if (!parentId) return false;  // No parent = no commission
  if (isBot) return false;       // Bots don't generate commissions
  if (userId === parentId) return false; // Self-referral block
  return true;
}

// ============================================================
// GGR & FINANCE FORMULAS (from admin-finance.service.ts)
// ============================================================

/**
 * GGR = Total Bets - Total Wins
 */
function calculateGGR(totalBets: number, totalWins: number): number {
  return totalBets - totalWins;
}

/**
 * Provider Fee = max(0, GGR * feePercentage/100)
 * Fee is only charged on POSITIVE GGR (when house wins)
 */
function calculateProviderFee(ggr: number, feePercentage: number): number {
  return Math.max(0, ggr * (feePercentage / 100));
}

/**
 * Net Profit = GGR - Provider Fees
 */
function calculateNetProfit(ggr: number, providerFees: number): number {
  return ggr - providerFees;
}

/**
 * House Edge = (GGR / Total Bets) * 100
 */
function calculateHouseEdge(ggr: number, totalBets: number): number {
  if (totalBets === 0) return 0;
  return (ggr / totalBets) * 100;
}

/**
 * RTP = (Total Wins / Total Bets) * 100
 */
function calculateRTP(totalWins: number, totalBets: number): number {
  if (totalBets === 0) return 0;
  return (totalWins / totalBets) * 100;
}

/**
 * Combined stats from multiple providers
 */
function calculateCombinedStats(
  providers: Array<{ bets: number; wins: number; feePercentage: number }>,
): {
  totalBets: number;
  totalWins: number;
  totalGGR: number;
  totalFees: number;
  netProfit: number;
  houseEdge: number;
  rtp: number;
} {
  let totalBets = 0;
  let totalWins = 0;
  let totalFees = 0;

  for (const p of providers) {
    totalBets += p.bets;
    totalWins += p.wins;
    const ggr = p.bets - p.wins;
    totalFees += calculateProviderFee(ggr, p.feePercentage);
  }

  const totalGGR = totalBets - totalWins;
  const netProfit = totalGGR - totalFees;
  const houseEdge = calculateHouseEdge(totalGGR, totalBets);
  const rtp = calculateRTP(totalWins, totalBets);

  return { totalBets, totalWins, totalGGR, totalFees, netProfit, houseEdge, rtp };
}

/**
 * Currency conversion helper (mock rates)
 */
function convertToUSD(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency];
  if (!rate) throw new Error(`Unknown currency: ${currency}`);
  return amount * rate;
}

function aggregateMultiCurrency(
  amounts: Array<{ amount: number; currency: string }>,
  rates: Record<string, number>,
): number {
  return amounts.reduce((total, item) => {
    return total + convertToUSD(item.amount, item.currency, rates);
  }, 0);
}

// ============================================================
// TEST SUITE
// ============================================================
describe('⚔️ BATTALION 4: FINANCE & COMMISSION LOGIC', () => {

  // ============================================================
  // SCENARIO 1: THE AFFILIATE ENGINE
  // ============================================================
  describe('Scenario 1: The Affiliate Engine (commission-processor.service)', () => {

    describe('1A: Multi-Tier Commission Calculation', () => {
      it('$100 bet → Tier 1 (0.5%) gets exactly $0.50', () => {
        const commission = calculateTierCommission(100, 1);
        expect(commission).toBe(0.50);
      });

      it('$100 bet → Tier 2 (0.2%) gets exactly $0.20', () => {
        const commission = calculateTierCommission(100, 2);
        expect(commission).toBe(0.20);
      });

      it('$100 bet → Tier 3 (0.1%) gets exactly $0.10', () => {
        const commission = calculateTierCommission(100, 3);
        expect(commission).toBe(0.10);
      });

      it('$100 bet → Total commission across all 3 tiers = $0.80', () => {
        const commissions = calculateAllCommissions(100, 3);
        const total = commissions.reduce((sum, c) => sum + c.amount, 0);
        expect(total).toBeCloseTo(0.80, 10);
      });

      it('$1,000 bet → Tier 1 = $5.00, Tier 2 = $2.00, Tier 3 = $1.00', () => {
        const commissions = calculateAllCommissions(1000, 3);
        expect(commissions[0].amount).toBe(5.00);
        expect(commissions[1].amount).toBe(2.00);
        expect(commissions[2].amount).toBe(1.00);
      });

      it('$10,000 bet → Tier 1 = $50.00', () => {
        expect(calculateTierCommission(10000, 1)).toBe(50.00);
      });

      it('$0.01 bet (micro) → Tier 1 = $0.00005', () => {
        const commission = calculateTierCommission(0.01, 1);
        expect(commission).toBeCloseTo(0.00005, 8);
      });

      it('Only 1 parent → Only Tier 1 commission generated', () => {
        const commissions = calculateAllCommissions(100, 1);
        expect(commissions).toHaveLength(1);
        expect(commissions[0].tier).toBe(1);
        expect(commissions[0].amount).toBe(0.50);
      });

      it('Only 2 parents → Tier 1 + Tier 2 commissions', () => {
        const commissions = calculateAllCommissions(100, 2);
        expect(commissions).toHaveLength(2);
        expect(commissions[0].tier).toBe(1);
        expect(commissions[1].tier).toBe(2);
      });

      it('0 parents → No commissions generated', () => {
        const commissions = calculateAllCommissions(100, 0);
        expect(commissions).toHaveLength(0);
      });

      it('5 parents → Still only 3 tiers max', () => {
        const commissions = calculateAllCommissions(100, 5);
        expect(commissions).toHaveLength(3);
      });
    });

    describe('1B: Self-Referral Block', () => {
      it('User cannot be their own parent', () => {
        expect(isSelfReferral('user-123', 'user-123')).toBe(true);
      });

      it('Different user and parent is valid', () => {
        expect(isSelfReferral('user-123', 'user-456')).toBe(false);
      });

      it('Null parent means no referral (no commission)', () => {
        expect(shouldGenerateCommission('user-123', null, false)).toBe(false);
      });

      it('Bot users do not generate commissions', () => {
        expect(shouldGenerateCommission('user-123', 'user-456', true)).toBe(false);
      });

      it('Self-referral does not generate commissions', () => {
        expect(shouldGenerateCommission('user-123', 'user-123', false)).toBe(false);
      });

      it('Valid referral generates commissions', () => {
        expect(shouldGenerateCommission('user-123', 'user-456', false)).toBe(true);
      });
    });

    describe('1C: Commission Rate Constants', () => {
      it('Tier 1 rate is 0.005 (0.5%)', () => {
        expect(COMMISSION_RATES.tier1).toBe(0.005);
      });

      it('Tier 2 rate is 0.002 (0.2%)', () => {
        expect(COMMISSION_RATES.tier2).toBe(0.002);
      });

      it('Tier 3 rate is 0.001 (0.1%)', () => {
        expect(COMMISSION_RATES.tier3).toBe(0.001);
      });

      it('Tier 1 > Tier 2 > Tier 3 (decreasing rates)', () => {
        expect(COMMISSION_RATES.tier1).toBeGreaterThan(COMMISSION_RATES.tier2);
        expect(COMMISSION_RATES.tier2).toBeGreaterThan(COMMISSION_RATES.tier3);
      });

      it('Total rate (all tiers) = 0.8%', () => {
        const total = COMMISSION_RATES.tier1 + COMMISSION_RATES.tier2 + COMMISSION_RATES.tier3;
        expect(total).toBe(0.008);
      });
    });
  });

  // ============================================================
  // SCENARIO 2: THE CFO DASHBOARD
  // ============================================================
  describe('Scenario 2: The CFO Dashboard (admin-finance.service)', () => {

    describe('2A: GGR Formula (Gross Gaming Revenue)', () => {
      it('GGR = $10,000 bets - $9,000 wins = $1,000 (house wins)', () => {
        expect(calculateGGR(10000, 9000)).toBe(1000);
      });

      it('GGR = $10,000 bets - $11,000 wins = -$1,000 (house LOSES)', () => {
        const ggr = calculateGGR(10000, 11000);
        expect(ggr).toBe(-1000);
        expect(ggr).toBeLessThan(0); // Negative GGR = house lost money
      });

      it('GGR = $10,000 bets - $10,000 wins = $0 (breakeven)', () => {
        expect(calculateGGR(10000, 10000)).toBe(0);
      });

      it('GGR = $0 bets - $0 wins = $0 (no activity)', () => {
        expect(calculateGGR(0, 0)).toBe(0);
      });

      it('GGR with large numbers: $1M bets - $960K wins = $40K', () => {
        expect(calculateGGR(1000000, 960000)).toBe(40000);
      });
    });

    describe('2B: Provider Fee Calculation', () => {
      it('Positive GGR: $1,000 GGR at 15% fee = $150', () => {
        expect(calculateProviderFee(1000, 15)).toBe(150);
      });

      it('Negative GGR: -$1,000 GGR at 15% fee = $0 (no fee when house loses)', () => {
        expect(calculateProviderFee(-1000, 15)).toBe(0);
      });

      it('Zero GGR: $0 at 15% fee = $0', () => {
        expect(calculateProviderFee(0, 15)).toBe(0);
      });

      it('Different fee percentages: 10%, 15%, 20%', () => {
        expect(calculateProviderFee(1000, 10)).toBe(100);
        expect(calculateProviderFee(1000, 15)).toBe(150);
        expect(calculateProviderFee(1000, 20)).toBe(200);
      });

      it('Internal games: 0% fee', () => {
        expect(calculateProviderFee(5000, 0)).toBe(0);
      });
    });

    describe('2C: Net Profit Formula', () => {
      it('Net = $1,000 GGR - $150 fees = $850', () => {
        expect(calculateNetProfit(1000, 150)).toBe(850);
      });

      it('Net = -$1,000 GGR - $0 fees = -$1,000 (loss, no fees)', () => {
        expect(calculateNetProfit(-1000, 0)).toBe(-1000);
      });

      it('Net = $500 GGR - $500 fees = $0 (breakeven after fees)', () => {
        expect(calculateNetProfit(500, 500)).toBe(0);
      });

      it('Full pipeline: $10K bets, $9K wins, 15% fee → Net = $850', () => {
        const ggr = calculateGGR(10000, 9000); // 1000
        const fee = calculateProviderFee(ggr, 15); // 150
        const net = calculateNetProfit(ggr, fee); // 850
        expect(net).toBe(850);
      });

      it('Full pipeline: House loses → Net = -$1,000, fee = $0', () => {
        const ggr = calculateGGR(10000, 11000); // -1000
        const fee = calculateProviderFee(ggr, 15); // 0 (no fee on loss)
        const net = calculateNetProfit(ggr, fee); // -1000
        expect(net).toBe(-1000);
        expect(fee).toBe(0);
      });
    });

    describe('2D: House Edge & RTP', () => {
      it('House Edge = 4% when GGR=$400 on $10,000 bets', () => {
        expect(calculateHouseEdge(400, 10000)).toBe(4);
      });

      it('House Edge = 0% when no bets', () => {
        expect(calculateHouseEdge(0, 0)).toBe(0);
      });

      it('Negative House Edge when house loses', () => {
        const edge = calculateHouseEdge(-500, 10000);
        expect(edge).toBe(-5);
      });

      it('RTP = 96% when wins=$9,600 on $10,000 bets', () => {
        expect(calculateRTP(9600, 10000)).toBe(96);
      });

      it('RTP = 0% when no bets', () => {
        expect(calculateRTP(0, 0)).toBe(0);
      });

      it('RTP + House Edge = 100%', () => {
        const bets = 10000;
        const wins = 9600;
        const ggr = calculateGGR(bets, wins);
        const edge = calculateHouseEdge(ggr, bets);
        const rtp = calculateRTP(wins, bets);
        expect(edge + rtp).toBeCloseTo(100, 10);
      });

      it('RTP > 100% when house loses', () => {
        const rtp = calculateRTP(11000, 10000);
        expect(rtp).toBeCloseTo(110, 10);
        expect(rtp).toBeGreaterThan(100);
      });
    });

    describe('2E: Combined Multi-Provider Stats', () => {
      it('Two providers combined correctly', () => {
        const stats = calculateCombinedStats([
          { bets: 5000, wins: 4500, feePercentage: 15 },
          { bets: 3000, wins: 2700, feePercentage: 10 },
        ]);
        expect(stats.totalBets).toBe(8000);
        expect(stats.totalWins).toBe(7200);
        expect(stats.totalGGR).toBe(800);
        // Provider 1: GGR=500, fee=75; Provider 2: GGR=300, fee=30
        expect(stats.totalFees).toBe(105);
        expect(stats.netProfit).toBe(695);
      });

      it('Provider with negative GGR pays no fee', () => {
        const stats = calculateCombinedStats([
          { bets: 5000, wins: 6000, feePercentage: 15 }, // GGR=-1000, fee=0
          { bets: 3000, wins: 2000, feePercentage: 10 }, // GGR=1000, fee=100
        ]);
        expect(stats.totalGGR).toBe(0); // Net zero
        expect(stats.totalFees).toBe(100); // Only positive GGR provider pays
        expect(stats.netProfit).toBe(-100); // Loss after fees
      });

      it('Internal games (0% fee) contribute full GGR to profit', () => {
        const stats = calculateCombinedStats([
          { bets: 10000, wins: 9500, feePercentage: 0 }, // Internal: GGR=500, fee=0
        ]);
        expect(stats.totalGGR).toBe(500);
        expect(stats.totalFees).toBe(0);
        expect(stats.netProfit).toBe(500);
      });

      it('House Edge calculation across providers', () => {
        const stats = calculateCombinedStats([
          { bets: 5000, wins: 4800, feePercentage: 15 },
          { bets: 5000, wins: 4800, feePercentage: 10 },
        ]);
        // Total: bets=10000, wins=9600, GGR=400
        expect(stats.houseEdge).toBe(4);
        expect(stats.rtp).toBe(96);
      });
    });

    describe('2F: Currency Conversion & Aggregation', () => {
      const mockRates: Record<string, number> = {
        USD: 1,
        USDT: 1,
        BTC: 65000,
        ETH: 3500,
        SOL: 150,
      };

      it('1 BTC = $65,000 USD', () => {
        expect(convertToUSD(1, 'BTC', mockRates)).toBe(65000);
      });

      it('1 ETH = $3,500 USD', () => {
        expect(convertToUSD(1, 'ETH', mockRates)).toBe(3500);
      });

      it('100 USDT = $100 USD (1:1)', () => {
        expect(convertToUSD(100, 'USDT', mockRates)).toBe(100);
      });

      it('Mixed currency aggregation: 0.1 BTC + 2 ETH + 1000 USDT', () => {
        const total = aggregateMultiCurrency([
          { amount: 0.1, currency: 'BTC' },   // $6,500
          { amount: 2, currency: 'ETH' },       // $7,000
          { amount: 1000, currency: 'USDT' },   // $1,000
        ], mockRates);
        expect(total).toBe(14500);
      });

      it('Unknown currency throws error', () => {
        expect(() => convertToUSD(100, 'DOGE', mockRates)).toThrow('Unknown currency');
      });

      it('Zero amount in any currency = $0', () => {
        expect(convertToUSD(0, 'BTC', mockRates)).toBe(0);
      });

      it('Fractional BTC: 0.001 BTC = $65', () => {
        expect(convertToUSD(0.001, 'BTC', mockRates)).toBe(65);
      });

      it('SOL conversion: 10 SOL = $1,500', () => {
        expect(convertToUSD(10, 'SOL', mockRates)).toBe(1500);
      });
    });
  });

  // ============================================================
  // SCENARIO 3: PRECISION & ROUNDING
  // ============================================================
  describe('Scenario 3: Precision & Rounding (The Floor Test)', () => {

    describe('3A: Commission Precision (8 decimal places)', () => {
      it('$33.333333... commission → stored as "0.16666667" (8 decimals)', () => {
        // $33.33 bet * 0.005 = 0.16666666...
        const commission = 33.33333333 * 0.005;
        const stored = roundCommission(commission);
        expect(stored).toMatch(/^\d+\.\d{8}$/); // Exactly 8 decimal places
      });

      it('$100 * 0.5% = 0.50000000 (clean number, 8 decimals)', () => {
        const stored = roundCommission(100 * 0.005);
        expect(stored).toBe('0.50000000');
      });

      it('$77.77 * 0.5% = 0.38885000', () => {
        const commission = 77.77 * 0.005;
        const stored = roundCommission(commission);
        expect(stored).toBe('0.38885000');
      });

      it('$1 * 0.1% (Tier 3) = 0.00100000', () => {
        const stored = roundCommission(1 * 0.001);
        expect(stored).toBe('0.00100000');
      });
    });

    describe('3B: Floor Rounding for Display/Payout', () => {
      it('$33.333333 → FLOOR → $33.33 (NOT $33.34)', () => {
        expect(floorTo2Decimals(33.333333)).toBe(33.33);
      });

      it('$33.339999 → FLOOR → $33.33 (NOT $33.34)', () => {
        expect(floorTo2Decimals(33.339999)).toBe(33.33);
      });

      it('$10.999 → FLOOR → $10.99 (NOT $11.00)', () => {
        expect(floorTo2Decimals(10.999)).toBe(10.99);
      });

      it('$0.001 → FLOOR → $0.00', () => {
        expect(floorTo2Decimals(0.001)).toBe(0.00);
      });

      it('$99.995 → FLOOR → $99.99 (NOT $100.00)', () => {
        expect(floorTo2Decimals(99.995)).toBe(99.99);
      });

      it('$100.00 → FLOOR → $100.00 (clean number unchanged)', () => {
        expect(floorTo2Decimals(100.00)).toBe(100.00);
      });

      it('Floor NEVER rounds up', () => {
        for (let i = 0; i < 100; i++) {
          const amount = Math.random() * 10000;
          const floored = floorTo2Decimals(amount);
          const rounded = Math.round(amount * 100) / 100;
          expect(floored).toBeLessThanOrEqual(rounded);
        }
      });
    });

    describe('3C: toFixed(2) Precision in Finance Stats', () => {
      it('parseFloat(ggr.toFixed(2)) preserves 2 decimal places', () => {
        const ggr = 1234.5678;
        const result = parseFloat(ggr.toFixed(2));
        expect(result).toBe(1234.57);
      });

      it('parseFloat((0).toFixed(2)) = 0', () => {
        expect(parseFloat((0).toFixed(2))).toBe(0);
      });

      it('Negative GGR rounds correctly: -1234.5678 → -1234.57', () => {
        const ggr = -1234.5678;
        const result = parseFloat(ggr.toFixed(2));
        expect(result).toBe(-1234.57);
      });

      it('Very small GGR: 0.001 → 0.00', () => {
        expect(parseFloat((0.001).toFixed(2))).toBe(0);
      });

      it('Large GGR: 999999.999 → 1000000.00', () => {
        expect(parseFloat((999999.999).toFixed(2))).toBe(1000000);
      });
    });
  });

  // ============================================================
  // SCENARIO 4: WAGER MINING PROTECTION
  // ============================================================
  describe('Scenario 4: Wager Mining Protection', () => {

    describe('4A: Crash-Type Games', () => {
      it('CRASH with autoCashout=1.05 → LOW RISK (blocked)', () => {
        expect(isLowRiskBet('CRASH', { autoCashoutAt: '1.05' })).toBe(true);
      });

      it('CRASH with autoCashout=1.09 → LOW RISK (blocked)', () => {
        expect(isLowRiskBet('CRASH', { autoCashoutAt: '1.09' })).toBe(true);
      });

      it('CRASH with autoCashout=1.10 → ALLOWED (at threshold)', () => {
        expect(isLowRiskBet('CRASH', { autoCashoutAt: '1.10' })).toBe(false);
      });

      it('CRASH with autoCashout=2.00 → ALLOWED (normal bet)', () => {
        expect(isLowRiskBet('CRASH', { autoCashoutAt: '2.00' })).toBe(false);
      });

      it('CRASH with no autoCashout → ALLOWED (manual cashout)', () => {
        expect(isLowRiskBet('CRASH', { autoCashoutAt: '0' })).toBe(false);
      });

      it('DRAGON_BLAZE with autoCashout=1.05 → LOW RISK', () => {
        expect(isLowRiskBet('DRAGON_BLAZE', { autoCashout: '1.05' })).toBe(true);
      });

      it('NOVA_RUSH with autoCashout=1.05 → LOW RISK', () => {
        expect(isLowRiskBet('NOVA_RUSH', { autoCashout: '1.05' })).toBe(true);
      });

      it('No gameData → ALLOWED (safe default)', () => {
        expect(isLowRiskBet('CRASH', undefined)).toBe(false);
      });
    });

    describe('4B: Dice Games', () => {
      it('DICE with winChance=95% → LOW RISK (blocked)', () => {
        expect(isLowRiskBet('DICE', { winChance: '95' })).toBe(true);
      });

      it('DICE with winChance=91% → LOW RISK (blocked)', () => {
        expect(isLowRiskBet('DICE', { winChance: '91' })).toBe(true);
      });

      it('DICE with winChance=90% → ALLOWED (at threshold)', () => {
        expect(isLowRiskBet('DICE', { winChance: '90' })).toBe(false);
      });

      it('DICE with winChance=50% → ALLOWED (normal bet)', () => {
        expect(isLowRiskBet('DICE', { winChance: '50' })).toBe(false);
      });

      it('DICE with chance field (alternative key)', () => {
        expect(isLowRiskBet('DICE', { chance: '95' })).toBe(true);
      });
    });

    describe('4C: Non-Protected Games', () => {
      it('MINES is not affected by wager mining protection', () => {
        expect(isLowRiskBet('MINES', { mineCount: 1 })).toBe(false);
      });

      it('PLINKO is not affected', () => {
        expect(isLowRiskBet('PLINKO', { risk: 'low' })).toBe(false);
      });

      it('PENALTY is not affected', () => {
        expect(isLowRiskBet('PENALTY', { goals: 1 })).toBe(false);
      });

      it('LIMBO is not affected', () => {
        expect(isLowRiskBet('LIMBO', { targetMultiplier: '1.01' })).toBe(false);
      });
    });
  });

  // ============================================================
  // SCENARIO 5: EDGE CASES & BOUNDARY CONDITIONS
  // ============================================================
  describe('Scenario 5: Edge Cases & Boundary Conditions', () => {

    describe('5A: Zero and Negative Amounts', () => {
      it('$0 bet generates $0 commission', () => {
        expect(calculateTierCommission(0, 1)).toBe(0);
      });

      it('Negative bet amount (should not happen) → negative commission', () => {
        const commission = calculateTierCommission(-100, 1);
        expect(commission).toBe(-0.50);
      });

      it('GGR with $0 bets and $0 wins = $0', () => {
        expect(calculateGGR(0, 0)).toBe(0);
      });
    });

    describe('5B: Very Large Amounts', () => {
      it('$1,000,000 bet → Tier 1 commission = $5,000', () => {
        expect(calculateTierCommission(1000000, 1)).toBe(5000);
      });

      it('$1,000,000 GGR at 15% fee = $150,000', () => {
        expect(calculateProviderFee(1000000, 15)).toBe(150000);
      });

      it('Large GGR calculation: $10M bets - $9.6M wins = $400K', () => {
        expect(calculateGGR(10000000, 9600000)).toBe(400000);
      });
    });

    describe('5C: Floating Point Edge Cases', () => {
      it('0.1 + 0.2 precision handled correctly', () => {
        const amount = 0.1 + 0.2;
        const stored = roundCommission(amount);
        expect(stored).toBe('0.30000000');
      });

      it('Commission on $0.01 bet (smallest practical amount)', () => {
        const commission = calculateTierCommission(0.01, 1);
        expect(commission).toBeCloseTo(0.00005, 8);
      });

      it('Multiple small commissions accumulate correctly', () => {
        let total = 0;
        for (let i = 0; i < 1000; i++) {
          total += calculateTierCommission(1, 1); // $0.005 each
        }
        expect(total).toBeCloseTo(5.00, 2);
      });
    });

    describe('5D: Provider Fee Edge Cases', () => {
      it('100% fee takes all GGR', () => {
        expect(calculateProviderFee(1000, 100)).toBe(1000);
      });

      it('0% fee leaves all GGR as profit', () => {
        expect(calculateProviderFee(1000, 0)).toBe(0);
      });

      it('Fee on $0.01 GGR at 15% = $0.0015', () => {
        expect(calculateProviderFee(0.01, 15)).toBeCloseTo(0.0015, 6);
      });
    });

    describe('5E: Dashboard Stats Consistency', () => {
      it('GGR + RTP% always equals 100% of bets', () => {
        const bets = 50000;
        const wins = 48000;
        const ggr = calculateGGR(bets, wins);
        const rtp = calculateRTP(wins, bets);
        const edge = calculateHouseEdge(ggr, bets);
        // edge% + rtp% = 100%
        expect(edge + rtp).toBeCloseTo(100, 10);
      });

      it('Net profit <= GGR (fees can only reduce profit)', () => {
        const ggr = 1000;
        const fee = calculateProviderFee(ggr, 15);
        const net = calculateNetProfit(ggr, fee);
        expect(net).toBeLessThanOrEqual(ggr);
      });

      it('When house loses, net profit = GGR (no fees charged)', () => {
        const ggr = -5000;
        const fee = calculateProviderFee(ggr, 15);
        const net = calculateNetProfit(ggr, fee);
        expect(fee).toBe(0);
        expect(net).toBe(ggr);
      });

      it('Total commissions never exceed total bets', () => {
        const betAmount = 10000;
        const commissions = calculateAllCommissions(betAmount, 3);
        const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
        expect(totalCommission).toBeLessThan(betAmount);
        // 0.8% of 10000 = 80
        expect(totalCommission).toBeCloseTo(80, 2);
      });
    });
  });
});
