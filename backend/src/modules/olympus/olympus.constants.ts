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
  { symbol: OlympusSymbol.MULTIPLIER, weight: 19 },
];

export const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 150

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
  { symbol: OlympusSymbol.MULTIPLIER, weight: 19 },
];

export const ANTE_TOTAL_WEIGHT = ANTE_SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 153

// ============================================
// CLUSTER PAY TABLE (multiplier of bet amount)
// Key: symbol, Value: { minCount: payout }
// ============================================
export const PAYTABLE: Record<string, Record<number, number>> = {
  // Premium symbols
  [OlympusSymbol.CROWN]:     { 8: 10, 9: 15, 10: 25, 11: 50, 12: 100 },
  [OlympusSymbol.HOURGLASS]: { 8: 5,  9: 8,  10: 15, 11: 25, 12: 50 },
  [OlympusSymbol.RING]:      { 8: 4,  9: 6,  10: 10, 11: 15, 12: 25 },
  [OlympusSymbol.CHALICE]:   { 8: 3,  9: 5,  10: 8,  11: 12, 12: 20 },
  // Low symbols
  [OlympusSymbol.BLUE_GEM]:  { 8: 1.5, 9: 2,   10: 3,   11: 5,   12: 8 },
  [OlympusSymbol.GREEN_GEM]: { 8: 1,   9: 1.5, 10: 2.5, 11: 4,   12: 6 },
  [OlympusSymbol.RED_GEM]:   { 8: 0.8, 9: 1.2, 10: 2,   11: 3,   12: 5 },
  [OlympusSymbol.PURPLE_GEM]:{ 8: 0.5, 9: 0.8, 10: 1.5, 11: 2.5, 12: 4 },
};

// Minimum cluster size for a win
export const MIN_CLUSTER_SIZE = 8;

// ============================================
// MULTIPLIER ORB VALUE DISTRIBUTION
// ============================================
export const MULTIPLIER_VALUES: { value: number; weight: number }[] = [
  { value: 2, weight: 400 },
  { value: 3, weight: 250 },
  { value: 5, weight: 150 },
  { value: 8, weight: 80 },
  { value: 10, weight: 50 },
  { value: 15, weight: 30 },
  { value: 25, weight: 20 },
  { value: 50, weight: 15 },
  { value: 100, weight: 5 },
];

export const MULTIPLIER_TOTAL_WEIGHT = MULTIPLIER_VALUES.reduce((sum, m) => sum + m.weight, 0); // 1000
