/**
 * ============================================
 * BONANZA MODE - The Tumble Engine (CALIBRATED)
 * ============================================
 * Grid: 6 columns x 5 rows
 * Mechanic: Weighted Drop (no traditional reels)
 * Feature: Combo Multiplier - each consecutive tumble adds +1x
 * Free Spins: 4+ Scatters = 12 free spins (multiplier persists)
 * RTP: 96% (calibrated via Monte Carlo simulation)
 */
import {
  SlotSymbol,
  SlotGameMode,
  SpinResponse,
  GameFeature,
  WinEvaluator,
  ClusterWin,
  VirtualReelMapper,
  VirtualReelEntry,
  ProvablyFairEngine,
  VIRTUAL_STOPS,
  getPaytableScaleFactor,
} from '../slot-engine.core';

// ============================================
// BONANZA CONSTANTS
// ============================================
const GRID_COLS = 6;
const GRID_ROWS = 5;
const MIN_CLUSTER = 5; // Calibrated: 5 minimum (not 8)
const MAX_WIN_MULTIPLIER = 5000;
const SCATTERS_FOR_FREE_SPINS = 4;
const FREE_SPINS_COUNT = 12;
const FREE_SPINS_RETRIGGER = 5;

// Symbol weights calibrated for 96% RTP
const SYMBOL_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: SlotSymbol.CHERRY, weight: 2000 },
  { symbol: SlotSymbol.LEMON, weight: 1800 },
  { symbol: SlotSymbol.ORANGE, weight: 1600 },
  { symbol: SlotSymbol.PLUM, weight: 1400 },
  { symbol: SlotSymbol.BELL, weight: 1200 },
  { symbol: SlotSymbol.BAR, weight: 800 },
  { symbol: SlotSymbol.SEVEN, weight: 500 },
  { symbol: SlotSymbol.DIAMOND, weight: 300 },
  { symbol: SlotSymbol.CROWN, weight: 150 },
  { symbol: SlotSymbol.SCATTER, weight: 30 },
  { symbol: SlotSymbol.BOMB, weight: 20 },
];

// Paytable: cluster size -> multiplier of bet (CALIBRATED with scale=2.53)
const PAYTABLE: Record<string, Record<number, number>> = {
  [SlotSymbol.CROWN]:   { 5: 63.2, 6: 126.4, 7: 252.7, 8: 505.5, 10: 1263.7, 12: 2527.4, 15: 5000 },
  [SlotSymbol.DIAMOND]: { 5: 37.9, 6: 75.8, 7: 151.6, 8: 303.3, 10: 758.2, 12: 1516.5, 15: 3791.1 },
  [SlotSymbol.SEVEN]:   { 5: 20.2, 6: 40.4, 7: 80.9, 8: 161.8, 10: 379.1, 12: 758.2, 15: 1895.6 },
  [SlotSymbol.BAR]:     { 5: 10.1, 6: 20.2, 7: 40.4, 8: 80.9, 10: 202.2, 12: 404.4, 15: 1011 },
  [SlotSymbol.BELL]:    { 5: 5.05, 6: 10.1, 7: 20.2, 8: 40.4, 10: 101.1, 12: 202.2, 15: 505.5 },
  [SlotSymbol.PLUM]:    { 5: 2.53, 6: 5.05, 7: 10.1, 8: 20.2, 10: 50.6, 12: 101.1, 15: 252.7 },
  [SlotSymbol.ORANGE]:  { 5: 1.52, 6: 3.03, 7: 6.07, 8: 12.6, 10: 30.3, 12: 60.7, 15: 151.6 },
  [SlotSymbol.LEMON]:   { 5: 1.01, 6: 2.02, 7: 4.04, 8: 7.58, 10: 20.2, 12: 40.4, 15: 101.1 },
  [SlotSymbol.CHERRY]:  { 5: 0.76, 6: 1.52, 7: 3.03, 8: 6.32, 10: 15.2, 12: 30.3, 15: 75.8 },
};

// Bomb multiplier values
const BOMB_MULTIPLIERS = [2, 3, 5, 8, 10, 15, 25, 50];
const BOMB_WEIGHTS = [400, 250, 150, 100, 50, 30, 15, 5];
const BOMB_TOTAL_WEIGHT = BOMB_WEIGHTS.reduce((sum, w) => sum + w, 0);

export class BonanzaMode implements SlotGameMode {
  readonly name = 'bonanza';
  readonly gridRows = GRID_ROWS;
  readonly gridCols = GRID_COLS;
  readonly rtp = 0.96;

  private reelMap: VirtualReelEntry[];

  constructor() {
    this.reelMap = VirtualReelMapper.buildReelMap(SYMBOL_WEIGHTS);
  }

  spin(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number,
    options?: { isFreeSpin?: boolean; houseEdge?: number; cumulativeMultiplier?: number },
  ): SpinResponse {
    const isFreeSpin = options?.isFreeSpin || false;
    let comboMultiplier = options?.cumulativeMultiplier || 1;
    const features: GameFeature[] = [];
    let totalWinMultiplier = 0;
    let tumbleIndex = 0;
    let freeSpinsAwarded = 0;

    // Generate initial grid
    let grid = this.generateGrid(serverSeed, clientSeed, nonce, 0);
    const initialGrid = grid.map(row => [...row]);

    // Count scatters on initial grid
    const scatterCount = this.countSymbol(grid, SlotSymbol.SCATTER);
    if (scatterCount >= SCATTERS_FOR_FREE_SPINS && !isFreeSpin) {
      freeSpinsAwarded = FREE_SPINS_COUNT + (scatterCount - SCATTERS_FOR_FREE_SPINS) * FREE_SPINS_RETRIGGER;
    }

    // Tumble loop
    let maxTumbles = 20;
    while (maxTumbles-- > 0) {
      const wins = WinEvaluator.evaluateClusters(grid, PAYTABLE, MIN_CLUSTER);
      if (wins.length === 0) break;

      // Collect bomb multipliers
      const bombPositions = this.findBombs(grid, wins);
      let bombMultiplierSum = 0;
      for (const bp of bombPositions) {
        bombMultiplierSum += this.selectBombMultiplier(serverSeed, clientSeed, nonce, tumbleIndex, bp);
      }

      let tumbleWin = 0;
      for (const win of wins) tumbleWin += win.multiplier;
      tumbleWin *= comboMultiplier;
      if (bombMultiplierSum > 0) tumbleWin *= bombMultiplierSum;

      totalWinMultiplier += tumbleWin;

      features.push({
        type: 'tumble',
        data: {
          tumbleIndex,
          wins: wins.map(w => ({ symbol: w.symbol, count: w.count, positions: w.positions, multiplier: w.multiplier })),
          comboMultiplier,
        },
      });

      // Remove winning symbols and drop new ones
      const removedPositions = new Set<string>();
      for (const win of wins) for (const [r, c] of win.positions) removedPositions.add(`${r},${c}`);
      for (const bp of bombPositions) removedPositions.add(`${bp[0]},${bp[1]}`);

      grid = this.tumbleGrid(grid, removedPositions, serverSeed, clientSeed, nonce, tumbleIndex + 1);
      comboMultiplier += 1;
      tumbleIndex++;
    }

    // Apply dynamic house edge scaling
    const dynamicHE = options?.houseEdge ?? 0.04;
    const scaleFactor = getPaytableScaleFactor(dynamicHE);
    totalWinMultiplier = totalWinMultiplier * scaleFactor;
    totalWinMultiplier = Math.min(totalWinMultiplier, MAX_WIN_MULTIPLIER);

    return {
      grid: initialGrid,
      wins: [],
      totalWinMultiplier,
      totalPayout: totalWinMultiplier * betAmount,
      features,
      freeSpinsAwarded,
      serverSeedHash: ProvablyFairEngine.hashServerSeed(serverSeed),
      clientSeed,
      nonce,
    };
  }

  getPaytable(): Record<string, Record<number, number>> { return PAYTABLE; }
  getSymbolWeights(): { symbol: SlotSymbol; weight: number }[] { return SYMBOL_WEIGHTS; }

  private generateGrid(serverSeed: string, clientSeed: string, nonce: number, startIndex: number): SlotSymbol[][] {
    const grid: SlotSymbol[][] = [];
    let idx = startIndex;
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowSymbols: SlotSymbol[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const hash = ProvablyFairEngine.hmacSha256(serverSeed, clientSeed, nonce, idx);
        const stop = ProvablyFairEngine.hashToVirtualStop(hash);
        rowSymbols.push(VirtualReelMapper.resolveSymbol(this.reelMap, stop));
        idx++;
      }
      grid.push(rowSymbols);
    }
    return grid;
  }

  private tumbleGrid(grid: SlotSymbol[][], removedPositions: Set<string>, serverSeed: string, clientSeed: string, nonce: number, tumbleIndex: number): SlotSymbol[][] {
    const newGrid: SlotSymbol[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    let fillIndex = tumbleIndex * 100;
    for (let col = 0; col < GRID_COLS; col++) {
      const surviving: SlotSymbol[] = [];
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (!removedPositions.has(`${row},${col}`)) surviving.push(grid[row][col]);
      }
      let writeRow = GRID_ROWS - 1;
      for (const sym of surviving) { newGrid[writeRow][col] = sym; writeRow--; }
      while (writeRow >= 0) {
        const hash = ProvablyFairEngine.hmacSha256(serverSeed, clientSeed, nonce, fillIndex);
        const stop = ProvablyFairEngine.hashToVirtualStop(hash);
        newGrid[writeRow][col] = VirtualReelMapper.resolveSymbol(this.reelMap, stop);
        fillIndex++;
        writeRow--;
      }
    }
    return newGrid;
  }

  private findBombs(grid: SlotSymbol[][], wins: ClusterWin[]): number[][] {
    const bombPositions: number[][] = [];
    const winPositions = new Set<string>();
    for (const win of wins) for (const [r, c] of win.positions) winPositions.add(`${r},${c}`);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (grid[row][col] === SlotSymbol.BOMB) {
          for (const [nr, nc] of [[row-1,col],[row+1,col],[row,col-1],[row,col+1]]) {
            if (winPositions.has(`${nr},${nc}`)) { bombPositions.push([row, col]); break; }
          }
        }
      }
    }
    return bombPositions;
  }

  private selectBombMultiplier(serverSeed: string, clientSeed: string, nonce: number, tumbleIndex: number, position: number[]): number {
    const value = ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, `bomb:${tumbleIndex}:${position[0]}:${position[1]}`, BOMB_TOTAL_WEIGHT);
    let cumulative = 0;
    for (let i = 0; i < BOMB_MULTIPLIERS.length; i++) {
      cumulative += BOMB_WEIGHTS[i];
      if (value < cumulative) return BOMB_MULTIPLIERS[i];
    }
    return BOMB_MULTIPLIERS[0];
  }

  private countSymbol(grid: SlotSymbol[][], symbol: SlotSymbol): number {
    let count = 0;
    for (const row of grid) for (const s of row) if (s === symbol) count++;
    return count;
  }
}
