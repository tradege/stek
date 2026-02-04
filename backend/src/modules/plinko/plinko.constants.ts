/**
 * Plinko Game Constants
 * Multiplier arrays for guaranteed ~4% House Edge (96% RTP)
 * Based on Stake.com standards - mathematically verified
 * 
 * Formula: EV = Σ(P(bucket) × Multiplier) = 0.96
 * Where P(bucket) follows binomial distribution: C(n,k) / 2^n
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Multiplier arrays for each row count and risk level
// Array index = bucket position (0 = leftmost, n = rightmost)
// Each array has (rows + 1) elements
// All values scaled to achieve exactly 96% RTP (4% House Edge)

export const PLINKO_MULTIPLIERS: Record<number, Record<RiskLevel, number[]>> = {
  // 8 Rows (9 buckets)
  8: {
    LOW: [5.43, 2.04, 1.07, 0.97, 0.48, 0.97, 1.07, 2.04, 5.43],
    MEDIUM: [12.62, 2.91, 1.26, 0.68, 0.39, 0.68, 1.26, 2.91, 12.62],
    HIGH: [28.1, 3.88, 1.45, 0.29, 0.19, 0.29, 1.45, 3.88, 28.1],
  },
  // 9 Rows (10 buckets)
  9: {
    LOW: [5.43, 1.94, 1.55, 0.97, 0.68, 0.68, 0.97, 1.55, 1.94, 5.43],
    MEDIUM: [17.43, 3.87, 1.65, 0.87, 0.48, 0.48, 0.87, 1.65, 3.87, 17.43],
    HIGH: [41.67, 6.78, 1.94, 0.58, 0.19, 0.19, 0.58, 1.94, 6.78, 41.67],
  },
  // 10 Rows (11 buckets)
  10: {
    LOW: [8.63, 2.91, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 2.91, 8.63],
    MEDIUM: [21.35, 4.85, 1.94, 1.36, 0.58, 0.39, 0.58, 1.36, 1.94, 4.85, 21.35],
    HIGH: [73.65, 9.69, 2.91, 0.87, 0.29, 0.19, 0.29, 0.87, 2.91, 9.69, 73.65],
  },
  // 11 Rows (12 buckets)
  11: {
    LOW: [8.15, 2.91, 1.84, 1.26, 0.97, 0.68, 0.68, 0.97, 1.26, 1.84, 2.91, 8.15],
    MEDIUM: [23.27, 5.82, 2.91, 1.75, 0.68, 0.48, 0.48, 0.68, 1.75, 2.91, 5.82, 23.27],
    HIGH: [116.18, 13.55, 5.03, 1.36, 0.39, 0.19, 0.19, 0.39, 1.36, 5.03, 13.55, 116.18],
  },
  // 12 Rows (13 buckets)
  12: {
    LOW: [9.7, 2.91, 1.55, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 1.55, 2.91, 9.7],
    MEDIUM: [32, 10.67, 3.88, 1.94, 1.07, 0.58, 0.29, 0.58, 1.07, 1.94, 3.88, 10.67, 32],
    HIGH: [164.66, 23.25, 7.85, 1.94, 0.68, 0.19, 0.19, 0.19, 0.68, 1.94, 7.85, 23.25, 164.66],
  },
  // 13 Rows (14 buckets)
  13: {
    LOW: [7.85, 3.88, 2.91, 1.84, 1.16, 0.87, 0.68, 0.68, 0.87, 1.16, 1.84, 2.91, 3.88, 7.85],
    MEDIUM: [41.7, 12.61, 5.82, 2.91, 1.26, 0.68, 0.39, 0.39, 0.68, 1.26, 2.91, 5.82, 12.61, 41.7],
    HIGH: [251.9, 35.85, 10.66, 3.88, 0.97, 0.19, 0.19, 0.19, 0.19, 0.97, 3.88, 10.66, 35.85, 251.9],
  },
  // 14 Rows (15 buckets)
  14: {
    LOW: [6.88, 3.88, 1.84, 1.36, 1.26, 1.07, 0.97, 0.48, 0.97, 1.07, 1.26, 1.36, 1.84, 3.88, 6.88],
    MEDIUM: [56.25, 14.55, 6.79, 3.88, 1.84, 0.97, 0.48, 0.19, 0.48, 0.97, 1.84, 3.88, 6.79, 14.55, 56.25],
    HIGH: [407.36, 54.31, 17.46, 4.85, 1.84, 0.29, 0.19, 0.19, 0.19, 0.29, 1.84, 4.85, 17.46, 54.31, 407.36],
  },
  // 15 Rows (16 buckets)
  15: {
    LOW: [14.55, 7.76, 2.91, 1.94, 1.45, 1.07, 0.97, 0.68, 0.68, 0.97, 1.07, 1.45, 1.94, 2.91, 7.76, 14.55],
    MEDIUM: [85.33, 17.45, 10.67, 4.85, 2.91, 1.26, 0.48, 0.29, 0.29, 0.48, 1.26, 2.91, 4.85, 10.67, 17.45, 85.33],
    HIGH: [601.05, 80.46, 26.17, 7.76, 2.91, 0.48, 0.19, 0.19, 0.19, 0.19, 0.48, 2.91, 7.76, 26.17, 80.46, 601.05],
  },
  // 16 Rows (17 buckets) - Main configuration
  16: {
    LOW: [15.52, 8.73, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.48, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.73, 15.52],
    MEDIUM: [106.68, 39.76, 9.7, 4.85, 2.91, 1.45, 0.97, 0.48, 0.29, 0.48, 0.97, 1.45, 2.91, 4.85, 9.7, 39.76, 106.68],
    HIGH: [969.93, 126.09, 25.22, 8.73, 3.88, 1.94, 0.19, 0.19, 0.19, 0.19, 0.19, 1.94, 3.88, 8.73, 25.22, 126.09, 969.93],
  },
};

// Physics constants for animation (visual only - does not affect game outcome)
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

// Visual constants for enhanced graphics
export const VISUALS = {
  TRAIL_LENGTH: 8,
  TRAIL_OPACITY_DECAY: 0.15,
  IMPACT_DURATION: 500, // ms
  IMPACT_SCALE: 1.2,
  // Bucket colors based on multiplier value (gradient from red to green)
  BUCKET_COLORS: {
    HIGH: ['#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00', '#00ff00', '#33ff00', '#66ff00', '#99ff00', '#ccff00', '#ffff00', '#ffcc00'],
    MEDIUM: ['#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00', '#00ff00', '#33ff00', '#66ff00', '#99ff00', '#ccff00', '#ffff00', '#ffcc00', '#ff9900', '#ff6600'],
    LOW: ['#00ff00', '#33ff00', '#66ff00', '#99ff00', '#ccff00', '#ffff00', '#ffcc00', '#ff9900', '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00', '#00ff00'],
  },
};

// Risk level colors for UI
export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-green-600', text: 'text-green-400', border: 'border-green-500' },
  MEDIUM: { bg: 'bg-yellow-600', text: 'text-yellow-400', border: 'border-yellow-500' },
  HIGH: { bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-500' },
};

/**
 * Get multiplier for specific bucket
 * @param rows Number of rows (8-16)
 * @param risk Risk level (LOW, MEDIUM, HIGH)
 * @param bucketIndex Bucket position (0 = leftmost)
 * @returns Multiplier value
 */
export function getMultiplier(rows: number, risk: RiskLevel, bucketIndex: number): number {
  const multipliers = PLINKO_MULTIPLIERS[rows]?.[risk];
  if (!multipliers || bucketIndex < 0 || bucketIndex >= multipliers.length) {
    return 0;
  }
  return multipliers[bucketIndex];
}

/**
 * Get all multipliers for display
 * @param rows Number of rows (8-16)
 * @param risk Risk level (LOW, MEDIUM, HIGH)
 * @returns Array of multipliers for all buckets
 */
export function getMultiplierArray(rows: number, risk: RiskLevel): number[] {
  return PLINKO_MULTIPLIERS[rows]?.[risk] || [];
}

/**
 * Calculate bucket index from ball path
 * Each direction (0=left, 1=right) is summed to determine final bucket
 * @param path Array of directions (0 or 1) for each row
 * @returns Final bucket index
 */
export function calculateBucketFromPath(path: number[]): number {
  return path.reduce((sum, direction) => sum + direction, 0);
}

/**
 * House Edge Verification (for testing)
 * Expected Value should be ~0.96 (96% RTP = 4% House Edge)
 */
export function verifyHouseEdge(rows: number, risk: RiskLevel): { ev: number; houseEdge: number } {
  const multipliers = PLINKO_MULTIPLIERS[rows]?.[risk];
  if (!multipliers) return { ev: 0, houseEdge: 100 };
  
  // Binomial coefficient C(n,k)
  const binomial = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1);
    }
    return result;
  };
  
  let ev = 0;
  for (let i = 0; i < multipliers.length; i++) {
    const prob = binomial(rows, i) / Math.pow(2, rows);
    ev += prob * multipliers[i];
  }
  
  return { ev, houseEdge: (1 - ev) * 100 };
}
