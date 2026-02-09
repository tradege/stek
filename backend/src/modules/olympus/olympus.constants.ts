// ============================================
// GATES OF OLYMPUS - GAME CONSTANTS
// ============================================

// Grid dimensions
export const GRID_COLS = 6;
export const GRID_ROWS = 5;
export const GRID_SIZE = GRID_COLS * GRID_ROWS; // 30

// Bet limits
export const MIN_BET = 0.1;
export const MAX_BET = 1000;

// House edge
export const HOUSE_EDGE = 0.04; // 4%
export const RTP = 0.96; // 96%

// Max win cap
export const MAX_WIN_MULTIPLIER = 5000; // 5000x

// Free spins
export const FREE_SPINS_COUNT = 15;
export const FREE_SPINS_RETRIGGER = 5;
export const SCATTERS_FOR_FREE_SPINS = 4;

// Ante bet multiplier (25% extra for 2x scatter chance)
export const ANTE_BET_MULTIPLIER = 1.25;
export const ANTE_SCATTER_BOOST = 2; // Double scatter weight

// ============================================
// SYMBOL DEFINITIONS
// ============================================
export enum OlympusSymbol {
  PURPLE_GEM = 'purple_gem',
  RED_GEM = 'red_gem',
  GREEN_GEM = 'green_gem',
  BLUE_GEM = 'blue_gem',
  CHALICE = 'chalice',
  RING = 'ring',
  HOURGLASS = 'hourglass',
  CROWN = 'crown',
  SCATTER = 'scatter',
  MULTIPLIER = 'multiplier',
}

// ============================================
// SYMBOL WEIGHTS (probability distribution)
// Multiplier orbs are COSMETIC in base game - do NOT affect payouts
// They only affect payouts during FREE SPINS
// ============================================
export const SYMBOL_WEIGHTS: { symbol: OlympusSymbol; weight: number }[] = [
  { symbol: OlympusSymbol.PURPLE_GEM, weight: 25 },
  { symbol: OlympusSymbol.RED_GEM, weight: 22 },
  { symbol: OlympusSymbol.GREEN_GEM, weight: 20 },
  { symbol: OlympusSymbol.BLUE_GEM, weight: 18 },
  { symbol: OlympusSymbol.CHALICE, weight: 14 },
  { symbol: OlympusSymbol.RING, weight: 12 },
  { symbol: OlympusSymbol.HOURGLASS, weight: 10 },
  { symbol: OlympusSymbol.CROWN, weight: 7 },
  { symbol: OlympusSymbol.SCATTER, weight: 3 },
  { symbol: OlympusSymbol.MULTIPLIER, weight: 2 },
];

export const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 133

// Ante bet weights (double scatter chance)
export const ANTE_SYMBOL_WEIGHTS: { symbol: OlympusSymbol; weight: number }[] = [
  { symbol: OlympusSymbol.PURPLE_GEM, weight: 25 },
  { symbol: OlympusSymbol.RED_GEM, weight: 22 },
  { symbol: OlympusSymbol.GREEN_GEM, weight: 20 },
  { symbol: OlympusSymbol.BLUE_GEM, weight: 18 },
  { symbol: OlympusSymbol.CHALICE, weight: 14 },
  { symbol: OlympusSymbol.RING, weight: 12 },
  { symbol: OlympusSymbol.HOURGLASS, weight: 10 },
  { symbol: OlympusSymbol.CROWN, weight: 7 },
  { symbol: OlympusSymbol.SCATTER, weight: 6 }, // Doubled
  { symbol: OlympusSymbol.MULTIPLIER, weight: 2 },
];

export const ANTE_TOTAL_WEIGHT = ANTE_SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 136

// ============================================
// CLUSTER PAY TABLE (multiplier of bet amount)
// Calibrated via Monte Carlo simulation (100k+ spins)
// Scale factor: 0.9555x -> verified RTP: 95.94% (house edge: 4.06%)
// Key: symbol, Value: { minCount: payout }
// ============================================
export const PAYTABLE: Record<string, Record<number, number>> = {
  // Premium symbols
  [OlympusSymbol.CROWN]:     { 8: 9.55, 9: 14.33, 10: 23.89, 11: 47.77, 12: 95.55 },
  [OlympusSymbol.HOURGLASS]: { 8: 4.78, 9: 7.64,  10: 14.33, 11: 23.89, 12: 47.77 },
  [OlympusSymbol.RING]:      { 8: 3.82, 9: 5.73,  10: 9.55,  11: 14.33, 12: 23.89 },
  [OlympusSymbol.CHALICE]:   { 8: 2.87, 9: 4.78,  10: 7.64,  11: 11.47, 12: 19.11 },
  // Low symbols
  [OlympusSymbol.BLUE_GEM]:  { 8: 1.43, 9: 1.91, 10: 2.87, 11: 4.78, 12: 7.64 },
  [OlympusSymbol.GREEN_GEM]: { 8: 0.96, 9: 1.43, 10: 2.39, 11: 3.82, 12: 5.73 },
  [OlympusSymbol.RED_GEM]:   { 8: 0.76, 9: 1.15, 10: 1.91, 11: 2.87, 12: 4.78 },
  [OlympusSymbol.PURPLE_GEM]:{ 8: 0.48, 9: 0.76, 10: 1.43, 11: 2.39, 12: 3.82 },
};

// Minimum cluster size for a win
export const MIN_CLUSTER_SIZE = 8;

// ============================================
// MULTIPLIER ORB VALUE DISTRIBUTION
// NOTE: Multiplier orbs are COSMETIC in base game
// They only affect payouts during FREE SPINS (dampened: each point = +10%)
// ============================================
export const MULTIPLIER_VALUES: { value: number; weight: number }[] = [
  { value: 2, weight: 500 },
  { value: 3, weight: 300 },
  { value: 5, weight: 120 },
  { value: 8, weight: 50 },
  { value: 10, weight: 20 },
  { value: 15, weight: 7 },
  { value: 25, weight: 2 },
  { value: 50, weight: 1 },
];

export const MULTIPLIER_TOTAL_WEIGHT = MULTIPLIER_VALUES.reduce((sum, m) => sum + m.weight, 0); // 1000
