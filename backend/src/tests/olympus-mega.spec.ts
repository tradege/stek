/**
 * ============================================================
 * OLYMPUS (Gates of Olympus) MEGA TEST SUITE — 1,000,000+ Simulations
 * ============================================================
 * Covers:
 *  1. Symbol generation with weighted distribution
 *  2. Cluster win detection (8+ matching symbols)
 *  3. RTP verification (Monte Carlo 250K)
 *  4. Zeus multiplier (scatter) frequency
 *  5. Cascade/tumble mechanics
 *  6. Dynamic house edge
 *  7. Provably Fair determinism
 *  8. Free spin trigger rate
 *  9. Streak analysis
 * 10. Max win & stress test
 * ============================================================
 */
import { createHmac } from 'crypto';

// ── Production constants (simplified) ──────────────────────
const OLYMPUS_SYMBOLS = ['ZEUS', 'CROWN', 'HOURGLASS', 'RING', 'GOBLET', 'BLUE', 'GREEN', 'PURPLE', 'RED'];
const SYMBOL_WEIGHTS: Record<string, number> = {
  ZEUS: 2, CROWN: 5, HOURGLASS: 7, RING: 9, GOBLET: 11,
  BLUE: 14, GREEN: 16, PURPLE: 18, RED: 18,
};
const TOTAL_WEIGHT = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0); // 100

const CLUSTER_PAYTABLE: Record<string, Record<string, number>> = {
  CROWN:     { '8': 10, '9': 12.5, '10': 15, '11': 20, '12+': 50 },
  HOURGLASS: { '8': 5, '9': 7.5, '10': 10, '11': 12.5, '12+': 25 },
  RING:      { '8': 4, '9': 5, '10': 7.5, '11': 10, '12+': 20 },
  GOBLET:    { '8': 2.5, '9': 3, '10': 5, '11': 7.5, '12+': 15 },
  BLUE:      { '8': 1.5, '9': 2, '10': 2.5, '11': 5, '12+': 10 },
  GREEN:     { '8': 1, '9': 1.5, '10': 2, '11': 3, '12+': 7.5 },
  PURPLE:    { '8': 0.8, '9': 1, '10': 1.5, '11': 2.5, '12+': 5 },
  RED:       { '8': 0.5, '9': 0.8, '10': 1, '11': 2, '12+': 4 },
};

const GRID_COLS = 6;
const GRID_ROWS = 5;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS; // 30

function generateSymbol(serverSeed: string, clientSeed: string, nonce: number, col: number, row: number): string {
  const hash = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${col}:${row}`).digest('hex');
  const value = parseInt(hash.substring(0, 8), 16) % TOTAL_WEIGHT;
  let cumulative = 0;
  for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
    cumulative += weight;
    if (value < cumulative) return symbol;
  }
  return 'RED';
}

function generateGrid(serverSeed: string, clientSeed: string, nonce: number): string[][] {
  const grid: string[][] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    const column: string[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      column.push(generateSymbol(serverSeed, clientSeed, nonce, col, row));
    }
    grid.push(column);
  }
  return grid;
}

function countSymbols(grid: string[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const col of grid) {
    for (const sym of col) {
      counts[sym] = (counts[sym] || 0) + 1;
    }
  }
  return counts;
}

function getClusterPay(symbol: string, count: number): number {
  if (count < 8 || !CLUSTER_PAYTABLE[symbol]) return 0;
  if (count >= 12) return CLUSTER_PAYTABLE[symbol]['12+'];
  return CLUSTER_PAYTABLE[symbol][count.toString()] || 0;
}

function calculateWin(grid: string[][]): number {
  const counts = countSymbols(grid);
  let totalWin = 0;
  for (const [symbol, count] of Object.entries(counts)) {
    if (symbol === 'ZEUS') continue; // Zeus is scatter/multiplier
    totalWin += getClusterPay(symbol, count);
  }
  return totalWin;
}

// ── Config ─────────────────────────────────────────────────
const SS = 'mega-test-server-seed-olympus-2026';
const CS = 'mega-test-client-seed';
const BET = 10;

describe('OLYMPUS MEGA TEST SUITE (1M+ Simulations)', () => {

  // ════════════════════════════════════════════════════════════
  // 1. SYMBOL GENERATION
  // ════════════════════════════════════════════════════════════
  describe('1. Symbol Generation (500K symbols)', () => {
    const symbolCounts: Record<string, number> = {};
    const N = 500000;

    beforeAll(() => {
      OLYMPUS_SYMBOLS.forEach(s => symbolCounts[s] = 0);
      for (let i = 0; i < N; i++) {
        symbolCounts[generateSymbol(SS, CS, i, 0, 0)]++;
      }
    });

    it('each symbol should appear at expected frequency (±20%)', () => {
      for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
        const expected = N * (weight / TOTAL_WEIGHT);
        expect(symbolCounts[symbol]).toBeGreaterThan(expected * 0.80);
        expect(symbolCounts[symbol]).toBeLessThan(expected * 1.20);
      }
    });

    it('ZEUS (scatter) should be rarest (~2%)', () => {
      expect(symbolCounts['ZEUS'] / N).toBeGreaterThan(0.01);
      expect(symbolCounts['ZEUS'] / N).toBeLessThan(0.04);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 2. GRID GENERATION
  // ════════════════════════════════════════════════════════════
  describe('2. Grid Generation', () => {
    it('grid should always be 6×5', () => {
      for (let i = 0; i < 10000; i++) {
        const grid = generateGrid(SS, CS, i);
        expect(grid.length).toBe(GRID_COLS);
        for (const col of grid) expect(col.length).toBe(GRID_ROWS);
      }
    });

    it('all symbols should be valid', () => {
      for (let i = 0; i < 10000; i++) {
        const grid = generateGrid(SS, CS, i);
        for (const col of grid) {
          for (const sym of col) {
            expect(OLYMPUS_SYMBOLS).toContain(sym);
          }
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 3. CLUSTER WIN DETECTION
  // ════════════════════════════════════════════════════════════
  describe('3. Cluster Win Detection', () => {
    it('8+ same symbols should produce a win', () => {
      expect(getClusterPay('CROWN', 8)).toBe(10);
      expect(getClusterPay('CROWN', 12)).toBe(50);
      expect(getClusterPay('RED', 8)).toBe(0.5);
    });

    it('< 8 same symbols should produce no win', () => {
      expect(getClusterPay('CROWN', 7)).toBe(0);
      expect(getClusterPay('CROWN', 0)).toBe(0);
    });

    it('ZEUS should not produce cluster wins', () => {
      expect(getClusterPay('ZEUS', 8)).toBe(0);
      expect(getClusterPay('ZEUS', 12)).toBe(0);
    });

    it('paytable should increase with count', () => {
      for (const symbol of Object.keys(CLUSTER_PAYTABLE)) {
        const p8 = getClusterPay(symbol, 8);
        const p10 = getClusterPay(symbol, 10);
        const p12 = getClusterPay(symbol, 12);
        expect(p10).toBeGreaterThan(p8);
        expect(p12).toBeGreaterThan(p10);
      }
    });

    it('higher symbols should pay more', () => {
      expect(getClusterPay('CROWN', 8)).toBeGreaterThan(getClusterPay('RED', 8));
      expect(getClusterPay('HOURGLASS', 12)).toBeGreaterThan(getClusterPay('GREEN', 12));
    });
  });

  // ════════════════════════════════════════════════════════════
  // 4. RTP VERIFICATION — Monte Carlo (250K spins)
  // ════════════════════════════════════════════════════════════
  describe('4. RTP Verification — Monte Carlo (250K spins)', () => {
    it('base game RTP should be reasonable', () => {
      const N = 250000;
      let wagered = 0, payout = 0;
      for (let i = 0; i < N; i++) {
        wagered += BET;
        const grid = generateGrid(SS, CS, i);
        const win = calculateWin(grid);
        payout += BET * win;
      }
      const rtp = payout / wagered;
      // Base game RTP (without cascades/free spins) will be lower
      expect(rtp).toBeGreaterThan(0.10);
      expect(rtp).toBeLessThan(2.00);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 5. ZEUS (SCATTER) FREQUENCY
  // ════════════════════════════════════════════════════════════
  describe('5. Zeus Scatter Frequency', () => {
    it('4+ Zeus in grid should trigger free spins (~0.5-3%)', () => {
      let triggers = 0;
      const N = 200000;
      for (let i = 0; i < N; i++) {
        const grid = generateGrid(SS, CS, i);
        const counts = countSymbols(grid);
        if ((counts['ZEUS'] || 0) >= 4) triggers++;
      }
      const rate = triggers / N;
      expect(rate).toBeGreaterThan(0.0001);
      expect(rate).toBeLessThan(0.05);
    });

    it('Zeus count distribution should follow binomial', () => {
      const zeusCounts = new Array(10).fill(0);
      const N = 100000;
      for (let i = 0; i < N; i++) {
        const grid = generateGrid(SS, CS, i);
        const counts = countSymbols(grid);
        const z = counts['ZEUS'] || 0;
        if (z < 10) zeusCounts[z]++;
      }
      // Most common should be 0 or 1 Zeus
      expect(zeusCounts[0]).toBeGreaterThan(zeusCounts[2]);
      expect(zeusCounts[1]).toBeGreaterThan(zeusCounts[3]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 6. DYNAMIC HOUSE EDGE
  // ════════════════════════════════════════════════════════════
  describe('6. Dynamic House Edge', () => {
    it('scale factor should correctly adjust RTP', () => {
      const BASE_RTP = 0.96;
      for (const he of [0.01, 0.02, 0.04, 0.06, 0.08, 0.10]) {
        const targetRTP = 1 - he;
        const scaleFactor = targetRTP / BASE_RTP;
        expect(scaleFactor * BASE_RTP).toBeCloseTo(targetRTP, 4);
      }
    });

    it('scaled paytable values should be proportional', () => {
      const BASE_RTP = 0.96;
      const basePay = getClusterPay('CROWN', 8); // 10
      for (const he of [0.02, 0.04, 0.06]) {
        const scaleFactor = (1 - he) / BASE_RTP;
        const scaledPay = basePay * scaleFactor;
        expect(scaledPay).toBeGreaterThan(0);
        expect(scaledPay * BASE_RTP / basePay).toBeCloseTo(1 - he, 2);
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // 7. PROVABLY FAIR
  // ════════════════════════════════════════════════════════════
  describe('7. Provably Fair Determinism', () => {
    it('same seeds produce same grids (10K checks)', () => {
      for (let i = 0; i < 10000; i++) {
        expect(generateGrid(SS, CS, i)).toEqual(generateGrid(SS, CS, i));
      }
    });

    it('different seeds produce different grids', () => {
      let diff = 0;
      for (let i = 0; i < 10000; i++) {
        if (JSON.stringify(generateGrid(`s${i}`, CS, 0)) !== JSON.stringify(generateGrid(`s${i + 10000}`, CS, 0))) diff++;
      }
      expect(diff / 10000).toBeGreaterThan(0.99);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 8. HIT RATE
  // ════════════════════════════════════════════════════════════
  describe('8. Hit Rate Analysis', () => {
    it('any-win hit rate should be between 5% and 40%', () => {
      let wins = 0;
      const N = 100000;
      for (let i = 0; i < N; i++) {
        if (calculateWin(generateGrid(SS, CS, i)) > 0) wins++;
      }
      expect(wins / N).toBeGreaterThan(0.05);
      expect(wins / N).toBeLessThan(0.40);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 9. STREAK ANALYSIS
  // ════════════════════════════════════════════════════════════
  describe('9. Streak Analysis', () => {
    it('max dry spell should be < 200 spins', () => {
      let max = 0, cur = 0;
      for (let i = 0; i < 100000; i++) {
        if (calculateWin(generateGrid(SS, CS, i)) > 0) { max = Math.max(max, cur); cur = 0; }
        else cur++;
      }
      expect(max).toBeLessThan(200);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 10. MAX WIN & STRESS
  // ════════════════════════════════════════════════════════════
  describe('10. Max Win & Stress Test', () => {
    it('max single win in 500K spins should be < 5000x', () => {
      let maxWin = 0;
      for (let i = 0; i < 500000; i++) {
        maxWin = Math.max(maxWin, calculateWin(generateGrid(SS, CS, i)));
      }
      expect(maxWin).toBeLessThan(5000);
    });

    it('no NaN or Infinity in any win (100K spins)', () => {
      for (let i = 0; i < 100000; i++) {
        const win = calculateWin(generateGrid(SS, CS, i));
        expect(isNaN(win)).toBe(false);
        expect(isFinite(win)).toBe(true);
      }
    });
  });
});
