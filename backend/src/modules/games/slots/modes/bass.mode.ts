/**
 * ============================================
 * BASS MODE - The Collection Engine (CALIBRATED)
 * ============================================
 * Grid: 5x3, 10 Paylines
 * Mechanic: Big Bass Bonanza style fishing collection
 * Innovation: Instant Hook (3% base game feature)
 * RTP: 96% (calibrated via Monte Carlo simulation)
 */
import {
  SlotSymbol,
  SlotGameMode,
  SpinResponse,
  GameFeature,
  WinEvaluator,
  VirtualReelMapper,
  VirtualReelEntry,
  ProvablyFairEngine,
  PAYLINES_10,
  VIRTUAL_STOPS,
  getPaytableScaleFactor,
} from '../slot-engine.core';

const GRID_COLS = 5;
const GRID_ROWS = 3;
const MAX_WIN_MULTIPLIER = 5000;
const SCATTERS_FOR_FREE_SPINS = 3;
const FREE_SPINS_COUNT = 10;
const FREE_SPINS_RETRIGGER = 5;
const INSTANT_HOOK_CHANCE = 300; // 3%

const SYMBOL_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: SlotSymbol.TEN, weight: 2000 },
  { symbol: SlotSymbol.JACK, weight: 1800 },
  { symbol: SlotSymbol.QUEEN, weight: 1600 },
  { symbol: SlotSymbol.KING, weight: 1400 },
  { symbol: SlotSymbol.ACE, weight: 1200 },
  { symbol: SlotSymbol.FISH_SMALL, weight: 900 },
  { symbol: SlotSymbol.FISH_MEDIUM, weight: 500 },
  { symbol: SlotSymbol.FISH_LARGE, weight: 200 },
  { symbol: SlotSymbol.FISH_MEGA, weight: 50 },
  { symbol: SlotSymbol.FISHERMAN, weight: 150 },
  { symbol: SlotSymbol.SCATTER, weight: 100 },
  { symbol: SlotSymbol.WILD, weight: 100 },
];

// Per-LINE payouts (CALIBRATED with scale=3.03)
const PAYTABLE: Record<string, Record<number, number>> = {
  [SlotSymbol.FISHERMAN]:  { 3: 15.14, 4: 75.68, 5: 756.8 },
  [SlotSymbol.FISH_MEGA]:  { 3: 9.08, 4: 45.41, 5: 454.1 },
  [SlotSymbol.FISH_LARGE]: { 3: 6.05, 4: 30.27, 5: 227.1 },
  [SlotSymbol.FISH_MEDIUM]:{ 3: 3.03, 4: 15.14, 5: 121.1 },
  [SlotSymbol.FISH_SMALL]: { 3: 1.51, 4: 6.05, 5: 60.6 },
  [SlotSymbol.ACE]:        { 3: 0.91, 4: 4.54, 5: 36.3 },
  [SlotSymbol.KING]:       { 3: 0.91, 4: 4.54, 5: 36.3 },
  [SlotSymbol.QUEEN]:      { 3: 0.61, 4: 3.03, 5: 24.2 },
  [SlotSymbol.JACK]:       { 3: 0.61, 4: 3.03, 5: 24.2 },
  [SlotSymbol.TEN]:        { 3: 0.45, 4: 2.42, 5: 18.2 },
};

const SCATTER_PAY: Record<number, number> = { 3: 2, 4: 20, 5: 200 };

// Fish values (CALIBRATED with scale=3.03)
const FISH_VALUES: Record<string, { weights: { value: number; weight: number }[] }> = {
  [SlotSymbol.FISH_SMALL]: {
    weights: [
      { value: 3, weight: 400 }, { value: 6, weight: 300 },
      { value: 9, weight: 200 }, { value: 15, weight: 100 },
    ],
  },
  [SlotSymbol.FISH_MEDIUM]: {
    weights: [
      { value: 15, weight: 350 }, { value: 24, weight: 300 },
      { value: 30, weight: 200 }, { value: 45, weight: 100 }, { value: 60, weight: 50 },
    ],
  },
  [SlotSymbol.FISH_LARGE]: {
    weights: [
      { value: 45, weight: 300 }, { value: 60, weight: 250 },
      { value: 90, weight: 200 }, { value: 120, weight: 150 }, { value: 150, weight: 100 },
    ],
  },
  [SlotSymbol.FISH_MEGA]: {
    weights: [
      { value: 150, weight: 400 }, { value: 300, weight: 250 },
      { value: 600, weight: 200 }, { value: 900, weight: 100 }, { value: 1500, weight: 50 },
    ],
  },
};

export class BassMode implements SlotGameMode {
  readonly name = 'bass';
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
    options?: { isFreeSpin?: boolean; houseEdge?: number; fishermanLevel?: number },
  ): SpinResponse {
    const isFreeSpin = options?.isFreeSpin || false;
    const fishermanLevel = options?.fishermanLevel || 1;
    const features: GameFeature[] = [];
    let totalWinMultiplier = 0;
    let freeSpinsAwarded = 0;

    const grid = this.generateGrid(serverSeed, clientSeed, nonce);

    // Count scatters
    const scatterCount = this.countSymbol(grid, SlotSymbol.SCATTER);
    if (scatterCount >= 3 && SCATTER_PAY[scatterCount]) {
      totalWinMultiplier += SCATTER_PAY[scatterCount];
      features.push({ type: 'bonus', data: { type: 'scatter_pay', count: scatterCount, payout: SCATTER_PAY[scatterCount] } });
    }

    if (scatterCount >= SCATTERS_FOR_FREE_SPINS && !isFreeSpin) {
      freeSpinsAwarded = FREE_SPINS_COUNT;
      features.push({ type: 'free_spins', data: { count: FREE_SPINS_COUNT } });
    }
    if (scatterCount >= SCATTERS_FOR_FREE_SPINS && isFreeSpin) {
      freeSpinsAwarded = FREE_SPINS_RETRIGGER;
      features.push({ type: 'free_spins', data: { type: 'retrigger', count: FREE_SPINS_RETRIGGER } });
    }

    // Line wins (fisherman = wild)
    const gridWithWilds = grid.map(row => row.map(s => s === SlotSymbol.FISHERMAN ? SlotSymbol.WILD : s));
    const lineWins = WinEvaluator.evaluateLines(gridWithWilds, PAYLINES_10, PAYTABLE, SlotSymbol.WILD);
    for (const win of lineWins) totalWinMultiplier += win.multiplier / 10;

    // Fish collection in free spins
    if (isFreeSpin) {
      const fishCollection = this.collectFish(grid, serverSeed, clientSeed, nonce, fishermanLevel);
      if (fishCollection.totalValue > 0) {
        totalWinMultiplier += fishCollection.totalValue;
        features.push({
          type: 'bonus',
          data: { type: 'fish_collection', fish: fishCollection.fish, totalValue: fishCollection.totalValue, fishermanLevel },
        });
      }
    }

    // Instant Hook (base game only)
    if (!isFreeSpin) {
      const hookCheck = ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, 'instant_hook', VIRTUAL_STOPS);
      if (hookCheck < INSTANT_HOOK_CHANCE) {
        const fishOnGrid = this.findFishOnGrid(grid);
        if (fishOnGrid.length > 0) {
          const fishIdx = ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, 'hook_fish', fishOnGrid.length);
          const hookedFish = fishOnGrid[fishIdx];
          const fishValue = this.getFishValue(hookedFish.symbol, serverSeed, clientSeed, nonce, 'instant');
          totalWinMultiplier += fishValue;
          features.push({ type: 'instant_hook', data: { triggered: true, fish: hookedFish, value: fishValue } });
        }
      }
    }

    // Apply dynamic house edge scaling
    const dynamicHE = options?.houseEdge ?? 0.04;
    const scaleFactor = getPaytableScaleFactor(dynamicHE);
    totalWinMultiplier = totalWinMultiplier * scaleFactor;
    totalWinMultiplier = Math.min(totalWinMultiplier, MAX_WIN_MULTIPLIER);

    return {
      grid,
      wins: lineWins,
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

  private generateGrid(serverSeed: string, clientSeed: string, nonce: number): SlotSymbol[][] {
    const grid: SlotSymbol[][] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowSymbols: SlotSymbol[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const index = row * GRID_COLS + col;
        const hash = ProvablyFairEngine.hmacSha256(serverSeed, clientSeed, nonce, index);
        const stop = ProvablyFairEngine.hashToVirtualStop(hash);
        rowSymbols.push(VirtualReelMapper.resolveSymbol(this.reelMap, stop));
      }
      grid.push(rowSymbols);
    }
    return grid;
  }

  private collectFish(grid: SlotSymbol[][], serverSeed: string, clientSeed: string, nonce: number, fishermanLevel: number) {
    const fishermanPositions: number[][] = [];
    const fishPositions: { symbol: SlotSymbol; position: number[] }[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (grid[row][col] === SlotSymbol.FISHERMAN) fishermanPositions.push([row, col]);
        else if (this.isFish(grid[row][col])) fishPositions.push({ symbol: grid[row][col], position: [row, col] });
      }
    }
    if (fishermanPositions.length === 0) return { fish: [], totalValue: 0 };

    const collectedFish: { symbol: SlotSymbol; position: number[]; value: number }[] = [];
    let totalValue = 0;
    for (let i = 0; i < fishPositions.length; i++) {
      const fp = fishPositions[i];
      let value = this.getFishValue(fp.symbol, serverSeed, clientSeed, nonce, `collect:${i}`);
      value *= fishermanLevel;
      collectedFish.push({ symbol: fp.symbol, position: fp.position, value });
      totalValue += value;
    }
    if (fishermanPositions.length > 1) totalValue *= fishermanPositions.length;
    return { fish: collectedFish, totalValue };
  }

  private findFishOnGrid(grid: SlotSymbol[][]): { symbol: SlotSymbol; position: number[] }[] {
    const fish: { symbol: SlotSymbol; position: number[] }[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.isFish(grid[row][col])) fish.push({ symbol: grid[row][col], position: [row, col] });
      }
    }
    return fish;
  }

  private isFish(symbol: SlotSymbol): boolean {
    return [SlotSymbol.FISH_SMALL, SlotSymbol.FISH_MEDIUM, SlotSymbol.FISH_LARGE, SlotSymbol.FISH_MEGA].includes(symbol);
  }

  private getFishValue(symbol: SlotSymbol, serverSeed: string, clientSeed: string, nonce: number, featureId: string): number {
    const fishConfig = FISH_VALUES[symbol];
    if (!fishConfig) return 0;
    const totalWeight = fishConfig.weights.reduce((sum, w) => sum + w.weight, 0);
    const value = ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, `fish:${featureId}`, totalWeight);
    let cumulative = 0;
    for (const w of fishConfig.weights) {
      cumulative += w.weight;
      if (value < cumulative) return w.value;
    }
    return fishConfig.weights[0].value;
  }

  private countSymbol(grid: SlotSymbol[][], symbol: SlotSymbol): number {
    let count = 0;
    for (const row of grid) for (const s of row) if (s === symbol) count++;
    return count;
  }
}
