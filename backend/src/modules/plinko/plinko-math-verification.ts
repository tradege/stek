/**
 * Plinko Mathematical Verification Script
 * 
 * This script verifies that the multiplier tables produce the correct house edge
 * using binomial distribution (Pascal's Triangle).
 * 
 * In Plinko, the ball has 50% chance to go left or right at each pin.
 * The probability of landing in bucket k (out of n buckets) follows:
 * P(k) = C(n,k) / 2^n
 * 
 * Where C(n,k) = n! / (k! * (n-k)!)
 */

// Multiplier tables from constants
const MULTIPLIERS: Record<string, Record<number, number[]>> = {
  LOW: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    9: [5.6, 2.0, 1.6, 1.0, 0.7, 0.7, 1.0, 1.6, 2.0, 5.6],
    10: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9],
    11: [8.4, 3.0, 1.9, 1.3, 1.0, 0.7, 0.7, 1.0, 1.3, 1.9, 3.0, 8.4],
    12: [10, 3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
    13: [8.1, 4.0, 3.0, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3.0, 4.0, 8.1],
    14: [7.1, 4.0, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4.0, 7.1],
    15: [15, 8.0, 3.0, 2.0, 1.5, 1.1, 1.0, 0.7, 0.7, 1.0, 1.1, 1.5, 2.0, 3.0, 8.0, 15],
    16: [16, 9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16],
  },
  MEDIUM: {
    8: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    9: [18, 4.0, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4.0, 18],
    10: [22, 5.0, 2.0, 1.4, 0.6, 0.4, 0.6, 1.4, 2.0, 5.0, 22],
    11: [24, 6.0, 3.0, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3.0, 6.0, 24],
    12: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
    13: [43, 13, 6.0, 3.0, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3.0, 6.0, 13, 43],
    14: [58, 15, 7.0, 4.0, 1.9, 1.0, 0.5, 0.2, 0.5, 1.0, 1.9, 4.0, 7.0, 15, 58],
    15: [88, 18, 11, 5.0, 3.0, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3.0, 5.0, 11, 18, 88],
    16: [110, 41, 10, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10, 41, 110],
  },
  HIGH: {
    8: [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
    9: [43, 7.0, 2.0, 0.6, 0.2, 0.2, 0.6, 2.0, 7.0, 43],
    10: [76, 10, 3.0, 0.9, 0.3, 0.2, 0.3, 0.9, 3.0, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
    13: [260, 37, 11, 4.0, 1.0, 0.2, 0.2, 0.2, 0.2, 1.0, 4.0, 11, 37, 260],
    14: [420, 56, 18, 5.0, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5.0, 18, 56, 420],
    15: [620, 83, 27, 8.0, 3.0, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3.0, 8.0, 27, 83, 620],
    16: [1000, 130, 26, 9.0, 4.0, 2.0, 0.2, 0.2, 0.2, 0.2, 0.2, 2.0, 4.0, 9.0, 26, 130, 1000],
  },
};

/**
 * Calculate binomial coefficient C(n, k)
 */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

/**
 * Calculate probability of landing in bucket k with n rows
 * P(k) = C(n,k) / 2^n
 */
function bucketProbability(rows: number, bucketIndex: number): number {
  return binomial(rows, bucketIndex) / Math.pow(2, rows);
}

/**
 * Calculate Expected Value (EV) for a given row count and risk level
 * EV = sum(probability[i] * multiplier[i]) for all buckets
 * 
 * If EV < 1.0, the house has an edge
 * House Edge = (1 - EV) * 100%
 */
function calculateExpectedValue(rows: number, risk: string): { ev: number; houseEdge: number; breakdown: string[] } {
  const multipliers = MULTIPLIERS[risk][rows];
  if (!multipliers) {
    return { ev: 0, houseEdge: 100, breakdown: [] };
  }
  
  let ev = 0;
  const breakdown: string[] = [];
  
  for (let i = 0; i < multipliers.length; i++) {
    const prob = bucketProbability(rows, i);
    const mult = multipliers[i];
    const contribution = prob * mult;
    ev += contribution;
    
    breakdown.push(`Bucket ${i}: P=${(prob * 100).toFixed(4)}% × ${mult}x = ${(contribution * 100).toFixed(4)}%`);
  }
  
  const houseEdge = (1 - ev) * 100;
  
  return { ev, houseEdge, breakdown };
}

/**
 * Run verification for all configurations
 */
function verifyAllConfigurations(): void {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       PLINKO MATHEMATICAL VERIFICATION - HOUSE EDGE CHECK      ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║ Formula: EV = Σ(P(bucket) × Multiplier)                        ║');
  console.log('║ House Edge = (1 - EV) × 100%                                   ║');
  console.log('║ Target: ~4% House Edge (like Stake.com)                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const risks = ['LOW', 'MEDIUM', 'HIGH'];
  const rows = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  
  const results: { rows: number; risk: string; ev: number; houseEdge: number; status: string }[] = [];
  
  for (const risk of risks) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`RISK LEVEL: ${risk}`);
    console.log(`${'═'.repeat(60)}`);
    
    for (const row of rows) {
      const { ev, houseEdge } = calculateExpectedValue(row, risk);
      
      // Status check: House edge should be between 1% and 8%
      let status = '✅ OK';
      if (houseEdge < 1) status = '⚠️ TOO LOW (player advantage!)';
      else if (houseEdge > 8) status = '⚠️ TOO HIGH';
      else if (houseEdge < 3 || houseEdge > 5) status = '⚡ ACCEPTABLE';
      
      results.push({ rows: row, risk, ev, houseEdge, status });
      
      console.log(`${row} Rows: EV = ${ev.toFixed(4)} | House Edge = ${houseEdge.toFixed(2)}% ${status}`);
    }
  }
  
  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                                ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  
  const avgHouseEdge = results.reduce((sum, r) => sum + r.houseEdge, 0) / results.length;
  const minHouseEdge = Math.min(...results.map(r => r.houseEdge));
  const maxHouseEdge = Math.max(...results.map(r => r.houseEdge));
  
  console.log(`║ Average House Edge: ${avgHouseEdge.toFixed(2)}%                                   ║`);
  console.log(`║ Min House Edge: ${minHouseEdge.toFixed(2)}%                                       ║`);
  console.log(`║ Max House Edge: ${maxHouseEdge.toFixed(2)}%                                       ║`);
  
  const problematic = results.filter(r => r.houseEdge < 1 || r.houseEdge > 8);
  if (problematic.length > 0) {
    console.log('║                                                                ║');
    console.log('║ ⚠️  PROBLEMATIC CONFIGURATIONS:                                ║');
    problematic.forEach(p => {
      console.log(`║   ${p.rows} rows ${p.risk}: ${p.houseEdge.toFixed(2)}%                                    ║`);
    });
  } else {
    console.log('║                                                                ║');
    console.log('║ ✅ All configurations have acceptable house edge!              ║');
  }
  
  console.log('╚════════════════════════════════════════════════════════════════╝');
}

// Run verification
verifyAllConfigurations();

// Export for testing
export { calculateExpectedValue, bucketProbability, binomial };
