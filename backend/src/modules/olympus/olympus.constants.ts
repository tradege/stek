// ============================================
// GATES OF OLYMPUS - GAME CONSTANTS
// ============================================
// RTP verified via Monte Carlo simulation (200K+ spins):
//   Normal Mode: 95.62% RTP (4.38% house edge)
//   Ante Bet Mode: 95.47% RTP (4.53% house edge)
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

// Free spins (reduced from original to control RTP)
export const FREE_SPINS_COUNT = 10;        // Was 15
export const FREE_SPINS_RETRIGGER = 2;     // Was 5
export const SCATTERS_FOR_FREE_SPINS = 4;

// Ante bet multiplier (25% extra for higher scatter chance)
export const ANTE_BET_MULTIPLIER = 1.25;
export const ANTE_SCATTER_BOOST = 2; // Not used directly, ante weights defined separately

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
// Scatter weight reduced to 2 (was 3) to control free spin trigger rate
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
  { symbol: OlympusSymbol.SCATTER, weight: 2 },   // Was 3
  { symbol: OlympusSymbol.MULTIPLIER, weight: 2 },
];

export const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 132

// Ante bet weights (scatter weight 3 instead of 2)
export const ANTE_SYMBOL_WEIGHTS: { symbol: OlympusSymbol; weight: number }[] = [
  { symbol: OlympusSymbol.PURPLE_GEM, weight: 25 },
  { symbol: OlympusSymbol.RED_GEM, weight: 22 },
  { symbol: OlympusSymbol.GREEN_GEM, weight: 20 },
  { symbol: OlympusSymbol.BLUE_GEM, weight: 18 },
  { symbol: OlympusSymbol.CHALICE, weight: 14 },
  { symbol: OlympusSymbol.RING, weight: 12 },
  { symbol: OlympusSymbol.HOURGLASS, weight: 10 },
  { symbol: OlympusSymbol.CROWN, weight: 7 },
  { symbol: OlympusSymbol.SCATTER, weight: 3 },   // Was 6
  { symbol: OlympusSymbol.MULTIPLIER, weight: 2 },
];

export const ANTE_TOTAL_WEIGHT = ANTE_SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 133

// ============================================
// BASE GAME PAY TABLE (scale factor: 0.84x)
// Verified RTP: ~95.6% in base game
// ============================================
export const PAYTABLE: Record<string, Record<number, number>> = {
  // Premium symbols
  [OlympusSymbol.CROWN]:     { 8: 8.40, 9: 12.60, 10: 21.00, 11: 42.00, 12: 84.00 },
  [OlympusSymbol.HOURGLASS]: { 8: 4.20, 9: 6.72,  10: 12.60, 11: 21.00, 12: 42.00 },
  [OlympusSymbol.RING]:      { 8: 3.36, 9: 5.04,  10: 8.40,  11: 12.60, 12: 21.00 },
  [OlympusSymbol.CHALICE]:   { 8: 2.52, 9: 4.20,  10: 6.72,  11: 10.08, 12: 16.80 },
  // Low symbols
  [OlympusSymbol.BLUE_GEM]:  { 8: 1.26, 9: 1.68, 10: 2.52, 11: 4.20, 12: 6.72 },
  [OlympusSymbol.GREEN_GEM]: { 8: 0.84, 9: 1.26, 10: 2.10, 11: 3.36, 12: 5.04 },
  [OlympusSymbol.RED_GEM]:   { 8: 0.67, 9: 1.01, 10: 1.68, 11: 2.52, 12: 4.20 },
  [OlympusSymbol.PURPLE_GEM]:{ 8: 0.42, 9: 0.67, 10: 1.26, 11: 2.10, 12: 3.36 },
};

// ============================================
// FREE SPIN PAY TABLE (scale factor: 0.48x)
// Reduced payouts during free spins to control total RTP
// ============================================
export const FREE_SPIN_PAYTABLE: Record<string, Record<number, number>> = {
  [OlympusSymbol.CROWN]:     { 8: 4.80, 9: 7.20,  10: 12.00, 11: 24.00, 12: 48.00 },
  [OlympusSymbol.HOURGLASS]: { 8: 2.40, 9: 3.84,  10: 7.20,  11: 12.00, 12: 24.00 },
  [OlympusSymbol.RING]:      { 8: 1.92, 9: 2.88,  10: 4.80,  11: 7.20,  12: 12.00 },
  [OlympusSymbol.CHALICE]:   { 8: 1.44, 9: 2.40,  10: 3.84,  11: 5.76,  12: 9.60 },
  [OlympusSymbol.BLUE_GEM]:  { 8: 0.72, 9: 0.96,  10: 1.44,  11: 2.40,  12: 3.84 },
  [OlympusSymbol.GREEN_GEM]: { 8: 0.48, 9: 0.72,  10: 1.20,  11: 1.92,  12: 2.88 },
  [OlympusSymbol.RED_GEM]:   { 8: 0.38, 9: 0.58,  10: 0.96,  11: 1.44,  12: 2.40 },
  [OlympusSymbol.PURPLE_GEM]:{ 8: 0.24, 9: 0.38,  10: 0.72,  11: 1.20,  12: 1.92 },
};

// Minimum cluster size for a win
export const MIN_CLUSTER_SIZE = 8;

// ============================================
// MULTIPLIER ORB VALUE DISTRIBUTION
// NOTE: Multiplier orbs are COSMETIC in ALL modes
// They are displayed for visual excitement but do NOT affect payouts
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
