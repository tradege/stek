// ============================================
// GATES OF OLYMPUS - GAME CONSTANTS
// ============================================
// RTP CALIBRATED via Monte Carlo simulation (1M+ spins):
//   Target: 96.0% RTP (4.0% house edge)
//   Method: Binary search calibration with 200K quick rounds + 1M verification
//   Result: 1.0442x scale factor -> 95.82% RTP ✅
//   Symbol weights: ORIGINAL (unchanged from base game)
//   Free spins: ORIGINAL settings (10 spins, 4 scatters trigger, 2 retrigger)
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

// Free spins - ORIGINAL settings (unchanged)
export const FREE_SPINS_COUNT = 10;
export const FREE_SPINS_RETRIGGER = 2;
export const SCATTERS_FOR_FREE_SPINS = 4;

// Ante bet multiplier (25% extra for higher scatter chance)
export const ANTE_BET_MULTIPLIER = 1.25;
export const ANTE_SCATTER_BOOST = 2;

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
// SYMBOL WEIGHTS - ORIGINAL (unchanged)
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
  { symbol: OlympusSymbol.SCATTER, weight: 2 },
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
  { symbol: OlympusSymbol.SCATTER, weight: 3 },
  { symbol: OlympusSymbol.MULTIPLIER, weight: 2 },
];

export const ANTE_TOTAL_WEIGHT = ANTE_SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0); // 133

// ============================================
// BASE GAME PAY TABLE (scale factor: 1.0442x)
// Calibrated for 96% RTP via Monte Carlo binary search
// ============================================
export const PAYTABLE: Record<string, Record<number, number>> = {
  // Premium symbols
  [OlympusSymbol.CROWN]:     { 8: 8.77, 9: 13.16, 10: 21.93, 11: 43.86, 12: 87.72 },
  [OlympusSymbol.HOURGLASS]: { 8: 4.39, 9: 7.02,  10: 13.16, 11: 21.93, 12: 43.86 },
  [OlympusSymbol.RING]:      { 8: 3.51, 9: 5.26,  10: 8.77,  11: 13.16, 12: 21.93 },
  [OlympusSymbol.CHALICE]:   { 8: 2.63, 9: 4.39,  10: 7.02,  11: 10.53, 12: 17.54 },
  // Low symbols
  [OlympusSymbol.BLUE_GEM]:  { 8: 1.32, 9: 1.75, 10: 2.63, 11: 4.39, 12: 7.02 },
  [OlympusSymbol.GREEN_GEM]: { 8: 0.88, 9: 1.32, 10: 2.19, 11: 3.51, 12: 5.26 },
  [OlympusSymbol.RED_GEM]:   { 8: 0.70, 9: 1.05, 10: 1.75, 11: 2.63, 12: 4.39 },
  [OlympusSymbol.PURPLE_GEM]:{ 8: 0.44, 9: 0.70, 10: 1.32, 11: 2.19, 12: 3.51 },
};

// ============================================
// FREE SPIN PAY TABLE (scale factor: 1.0442x applied to original FS values)
// ============================================
export const FREE_SPIN_PAYTABLE: Record<string, Record<number, number>> = {
  [OlympusSymbol.CROWN]:     { 8: 5.01, 9: 7.52,  10: 12.53, 11: 25.06, 12: 50.12 },
  [OlympusSymbol.HOURGLASS]: { 8: 2.51, 9: 4.01,  10: 7.52,  11: 12.53, 12: 25.06 },
  [OlympusSymbol.RING]:      { 8: 2.00, 9: 3.01,  10: 5.01,  11: 7.52,  12: 12.53 },
  [OlympusSymbol.CHALICE]:   { 8: 1.50, 9: 2.51,  10: 4.01,  11: 6.01,  12: 10.02 },
  [OlympusSymbol.BLUE_GEM]:  { 8: 0.75, 9: 1.00,  10: 1.50,  11: 2.51,  12: 4.01 },
  [OlympusSymbol.GREEN_GEM]: { 8: 0.50, 9: 0.75,  10: 1.25,  11: 2.00,  12: 3.01 },
  [OlympusSymbol.RED_GEM]:   { 8: 0.40, 9: 0.61,  10: 1.00,  11: 1.50,  12: 2.51 },
  [OlympusSymbol.PURPLE_GEM]:{ 8: 0.25, 9: 0.40,  10: 0.75,  11: 1.25,  12: 2.00 },
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
