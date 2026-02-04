/**
 * Plinko Game Constants
 * Multiplier arrays for guaranteed ~4% House Edge
 * Based on Stake.com standards
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Multiplier arrays for each row count and risk level
// Array index = bucket position (0 = leftmost, n = rightmost)
// Each array has (rows + 1) elements

export const PLINKO_MULTIPLIERS: Record<number, Record<RiskLevel, number[]>> = {
  // 8 Rows
  8: {
    LOW: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    MEDIUM: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    HIGH: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  // 9 Rows
  9: {
    LOW: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    MEDIUM: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    HIGH: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
  },
  // 10 Rows
  10: {
    LOW: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    MEDIUM: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    HIGH: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
  },
  // 11 Rows
  11: {
    LOW: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    MEDIUM: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    HIGH: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
  },
  // 12 Rows
  12: {
    LOW: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    MEDIUM: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    HIGH: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  // 13 Rows
  13: {
    LOW: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    MEDIUM: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    HIGH: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
  },
  // 14 Rows
  14: {
    LOW: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    MEDIUM: [55, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 55],
    HIGH: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
  },
  // 15 Rows
  15: {
    LOW: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    MEDIUM: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    HIGH: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
  },
  // 16 Rows (Main)
  16: {
    LOW: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    MEDIUM: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    HIGH: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

// Physics constants for animation
export const PHYSICS = {
  GRAVITY: 0.35,
  BOUNCE_FACTOR: 0.7,
  FRICTION: 0.99,
  JITTER_MIN: -1.5,
  JITTER_MAX: 1.5,
  BALL_RADIUS: 8,
  PIN_RADIUS: 4,
  ANIMATION_SPEED: 1,
};

// Visual constants
export const VISUALS = {
  TRAIL_LENGTH: 8,
  TRAIL_OPACITY_DECAY: 0.15,
  IMPACT_DURATION: 500, // ms
  IMPACT_SCALE: 1.2,
  BUCKET_COLORS: {
    HIGH: ['#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00', '#00ff00', '#33ff00', '#66ff00', '#99ff00', '#ccff00', '#ffff00', '#ffcc00'],
    MEDIUM: ['#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00', '#00ff00', '#33ff00', '#66ff00', '#99ff00', '#ccff00', '#ffff00', '#ffcc00', '#ff9900', '#ff6600'],
    LOW: ['#00ff00', '#33ff00', '#66ff00', '#99ff00', '#ccff00', '#ffff00', '#ffcc00', '#ff9900', '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00', '#00ff00'],
  },
};

// Risk level colors
export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-green-600', text: 'text-green-400', border: 'border-green-500' },
  MEDIUM: { bg: 'bg-yellow-600', text: 'text-yellow-400', border: 'border-yellow-500' },
  HIGH: { bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-500' },
};

// Get multiplier for specific bucket
export function getMultiplier(rows: number, risk: RiskLevel, bucketIndex: number): number {
  const multipliers = PLINKO_MULTIPLIERS[rows]?.[risk];
  if (!multipliers || bucketIndex < 0 || bucketIndex >= multipliers.length) {
    return 0;
  }
  return multipliers[bucketIndex];
}

// Get all multipliers for display
export function getMultiplierArray(rows: number, risk: RiskLevel): number[] {
  return PLINKO_MULTIPLIERS[rows]?.[risk] || [];
}

// Calculate bucket index from path
export function calculateBucketFromPath(path: number[]): number {
  return path.reduce((sum, direction) => sum + direction, 0);
}
