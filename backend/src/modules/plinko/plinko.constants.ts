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
    LOW: [5.3, 2.03, 1.2, 0.92, 0.46, 0.92, 1.2, 2.03, 5.3],
    MEDIUM: [10.82, 4.75, 1.17, 0.58, 0.25, 0.58, 1.17, 4.75, 10.82],
    HIGH: [16.23, 7.26, 1.12, 0.19, 0.19, 0.19, 1.12, 7.26, 16.23],
  },
  // 9 Rows (10 buckets)
  9: {
    LOW: [5.6, 2.07, 1.41, 1.04, 0.66, 0.66, 1.04, 1.41, 2.07, 5.6],
    MEDIUM: [16.15, 4.48, 1.8, 1.08, 0.27, 0.27, 1.08, 1.8, 4.48, 16.15],
    HIGH: [35.55, 7.28, 2.42, 0.4, 0.19, 0.19, 0.4, 2.42, 7.28, 35.55],
  },
  // 10 Rows (11 buckets)
  10: {
    LOW: [8.16, 2.82, 1.41, 1.13, 0.94, 0.47, 0.94, 1.13, 1.41, 2.82, 8.16],
    MEDIUM: [19.44, 8.84, 2.66, 1.15, 0.44, 0.27, 0.44, 1.15, 2.66, 8.84, 19.44],
    HIGH: [58.19, 11.17, 3.73, 0.75, 0.19, 0.19, 0.19, 0.75, 3.73, 11.17, 58.19],
  },
  // 11 Rows (12 buckets)
  11: {
    LOW: [9.51, 2.98, 1.48, 1.29, 0.99, 0.69, 0.69, 0.99, 1.29, 1.48, 2.98, 9.51],
    MEDIUM: [23.93, 7.65, 3.82, 1.9, 0.67, 0.28, 0.28, 0.67, 1.9, 3.82, 7.65, 23.93],
    HIGH: [81.02, 16.86, 5.39, 1.36, 0.33, 0.19, 0.19, 0.33, 1.36, 5.39, 16.86, 81.02],
  },
  // 12 Rows (13 buckets)
  12: {
    LOW: [9.79, 3.73, 1.86, 1.31, 1.11, 0.93, 0.46, 0.93, 1.11, 1.31, 1.86, 3.73, 9.79],
    MEDIUM: [30.04, 11.82, 4.55, 2.73, 0.91, 0.45, 0.19, 0.45, 0.91, 2.73, 4.55, 11.82, 30.04],
    HIGH: [164.88, 23.28, 7.86, 1.94, 0.68, 0.19, 0.19, 0.19, 0.68, 1.94, 7.86, 23.28, 164.88],
  },
  // 13 Rows (14 buckets)
  13: {
    LOW: [8.44, 3.88, 2.91, 1.84, 1.16, 0.87, 0.68, 0.68, 0.87, 1.16, 1.84, 2.91, 3.88, 8.44],
    MEDIUM: [41.65, 12.59, 5.81, 2.91, 1.26, 0.68, 0.39, 0.39, 0.68, 1.26, 2.91, 5.81, 12.59, 41.65],
    HIGH: [252.47, 35.93, 10.68, 3.89, 0.97, 0.19, 0.19, 0.19, 0.19, 0.97, 3.89, 10.68, 35.93, 252.47],
  },
  // 14 Rows (15 buckets)
  14: {
    LOW: [6.88, 3.88, 1.84, 1.36, 1.26, 1.07, 0.97, 0.48, 0.97, 1.07, 1.26, 1.36, 1.84, 3.88, 6.88],
    MEDIUM: [56.41, 14.59, 6.81, 3.89, 1.85, 0.97, 0.48, 0.19, 0.48, 0.97, 1.85, 3.89, 6.81, 14.59, 56.41],
    HIGH: [408.57, 54.47, 17.51, 4.86, 1.85, 0.29, 0.19, 0.19, 0.19, 0.29, 1.85, 4.86, 17.51, 54.47, 408.57],
  },
  // 15 Rows (16 buckets)
  15: {
    LOW: [14.54, 7.75, 2.91, 1.94, 1.45, 1.07, 0.97, 0.68, 0.68, 0.97, 1.07, 1.45, 1.94, 2.91, 7.75, 14.54],
    MEDIUM: [85.49, 17.48, 10.69, 4.86, 2.92, 1.26, 0.48, 0.29, 0.29, 0.48, 1.26, 2.92, 4.86, 10.69, 17.48, 85.49],
    HIGH: [603.15, 80.74, 26.26, 7.79, 2.92, 0.48, 0.19, 0.19, 0.19, 0.19, 0.48, 2.92, 7.79, 26.26, 80.74, 603.15],
  },
  // 16 Rows (17 buckets)
  16: {
    LOW: [15.53, 8.73, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.48, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.73, 15.53],
    MEDIUM: [107.39, 40.02, 9.76, 4.89, 2.92, 1.45, 0.97, 0.48, 0.29, 0.48, 0.97, 1.45, 2.92, 4.89, 9.76, 40.02, 107.39],
    HIGH: [973.07, 126.5, 25.3, 8.76, 3.89, 1.95, 0.19, 0.19, 0.19, 0.19, 0.19, 1.95, 3.89, 8.76, 25.3, 126.5, 973.07],
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

/**
 * Get dynamically scaled multiplier based on configured house edge.
 * The base tables are calibrated for 4% HE (96% RTP).
 * Scaling factor = (1 - houseEdge) / 0.96
 * This preserves multiplier distribution while adjusting overall RTP.
 */
export function getDynamicMultiplier(rows: number, risk: RiskLevel, bucketIndex: number, houseEdge: number = 0.04): number {
  const baseMultiplier = getMultiplier(rows, risk, bucketIndex);
  if (baseMultiplier === 0) return 0;
  
  const BASE_RTP = 0.96; // Tables are calibrated for this
  const targetRTP = 1 - houseEdge;
  const scaleFactor = targetRTP / BASE_RTP;
  
  return parseFloat((baseMultiplier * scaleFactor).toFixed(4));
}

/**
 * Get all dynamically scaled multipliers for display
 */
export function getDynamicMultiplierArray(rows: number, risk: RiskLevel, houseEdge: number = 0.04): number[] {
  const baseMultipliers = getMultiplierArray(rows, risk);
  if (!baseMultipliers.length) return [];
  
  const BASE_RTP = 0.96;
  const targetRTP = 1 - houseEdge;
  const scaleFactor = targetRTP / BASE_RTP;
  
  return baseMultipliers.map(m => parseFloat((m * scaleFactor).toFixed(4)));
}
