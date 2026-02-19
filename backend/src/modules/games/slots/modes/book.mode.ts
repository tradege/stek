/**
 * ============================================
 * BOOK MODE - The Expansion Engine (CALIBRATED)
 * ============================================
 * Grid: 5x3, 10 Paylines
 * Mechanic: Book of Dead style with expanding symbols
 * Innovation: Risk Selector
 *   - Normal: 10 Spins, 1 Expanding Symbol
 *   - Extreme: 5 Spins, 2 Expanding Symbols
 * RTP: 96% (calibrated via Monte Carlo simulation)
 */
import {
  SlotSymbol,
  SlotGameMode,
  SpinResponse,
  GameFeature,
  WinEvaluator,
  WinLine,
  VirtualReelMapper,
  VirtualReelEntry,
  ProvablyFairEngine,
  PAYLINES_10,
  getPaytableScaleFactor,
} from '../slot-engine.core';

const GRID_COLS = 5;
const GRID_ROWS = 3;
const MAX_WIN_MULTIPLIER = 5000;
const BOOKS_FOR_FREE_SPINS = 3;
const FREE_SPINS_NORMAL = 10;
const FREE_SPINS_EXTREME = 5;

const SYMBOL_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: SlotSymbol.TEN, weight: 2000 },
  { symbol: SlotSymbol.JACK, weight: 1800 },
  { symbol: SlotSymbol.QUEEN, weight: 1600 },
  { symbol: SlotSymbol.KING, weight: 1400 },
  { symbol: SlotSymbol.ACE, weight: 1200 },
  { symbol: SlotSymbol.SCARAB, weight: 800 },
  { symbol: SlotSymbol.ANUBIS, weight: 600 },
  { symbol: SlotSymbol.PHARAOH, weight: 350 },
  { symbol: SlotSymbol.EXPLORER, weight: 150 },
  { symbol: SlotSymbol.BOOK, weight: 100 },
];

// Per-LINE payouts (CALIBRATED with scale=45.6)
// These are multiplied by bet_per_line (= total_bet / 10)
const PAYTABLE: Record<string, Record<number, number>> = {
  [SlotSymbol.EXPLORER]: { 3: 136.8, 4: 1368.4, 5: 5000 },
  [SlotSymbol.PHARAOH]:  { 3: 91.2, 4: 912.3, 5: 5000 },
  [SlotSymbol.ANUBIS]:   { 3: 45.6, 4: 456.1, 5: 3421 },
  [SlotSymbol.SCARAB]:   { 3: 22.8, 4: 228.1, 5: 1824.5 },
  [SlotSymbol.ACE]:      { 3: 13.7, 4: 91.2, 5: 684.2 },
  [SlotSymbol.KING]:     { 3: 13.7, 4: 91.2, 5: 684.2 },
  [SlotSymbol.QUEEN]:    { 3: 9.1, 4: 68.4, 5: 456.1 },
  [SlotSymbol.JACK]:     { 3: 9.1, 4: 68.4, 5: 456.1 },
  [SlotSymbol.TEN]:      { 3: 9.1, 4: 45.6, 5: 342.1 },
};

const BOOK_SCATTER_PAY: Record<number, number> = { 3: 2, 4: 20, 5: 200 };

const EXPANDING_SYMBOL_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: SlotSymbol.TEN, weight: 250 },
  { symbol: SlotSymbol.JACK, weight: 220 },
  { symbol: SlotSymbol.QUEEN, weight: 190 },
  { symbol: SlotSymbol.KING, weight: 160 },
  { symbol: SlotSymbol.ACE, weight: 100 },
  { symbol: SlotSymbol.SCARAB, weight: 40 },
  { symbol: SlotSymbol.ANUBIS, weight: 25 },
  { symbol: SlotSymbol.PHARAOH, weight: 12 },
  { symbol: SlotSymbol.EXPLORER, weight: 3 },
];
const EXPANDING_TOTAL_WEIGHT = EXPANDING_SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);

export class BookMode implements SlotGameMode {
  readonly name = 'book';
  readonly gridRows = GRID_ROWS;
  readonly gridCols = GRID_COLS;
  readonly rtp = 0.96;

  private reelMaps: VirtualReelEntry[][];

  constructor() {
    this.reelMaps = [];
    for (let i = 0; i < GRID_COLS; i++) {
      this.reelMaps.push(VirtualReelMapper.buildReelMap(SYMBOL_WEIGHTS));
    }
  }

  spin(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number,
    options?: { isFreeSpin?: boolean; houseEdge?: number; riskLevel?: 'normal' | 'extreme'; expandingSymbols?: SlotSymbol[] },
  ): SpinResponse {
    const isFreeSpin = options?.isFreeSpin || false;
    const riskLevel = options?.riskLevel || 'normal';
    const features: GameFeature[] = [];
    let freeSpinsAwarded = 0;

    // Generate grid
    const gridStops = ProvablyFairEngine.generateGridStops(serverSeed, clientSeed, nonce, GRID_COLS, GRID_ROWS);
    let grid = VirtualReelMapper.resolveGrid(this.reelMaps, gridStops);

    // In free spins, expand the selected symbol(s)
    if (isFreeSpin && options?.expandingSymbols) {
      grid = this.expandSymbols(grid, options.expandingSymbols);
      features.push({ type: 'expanding_symbol', data: { symbols: options.expandingSymbols } });
    }

    // Count books
    const bookCount = this.countSymbol(grid, SlotSymbol.BOOK);

    // Book acts as wild
    const gridWithWilds = grid.map(row => row.map(s => s === SlotSymbol.BOOK ? SlotSymbol.WILD : s));

    // Evaluate line wins
    const lineWins = WinEvaluator.evaluateLines(gridWithWilds, PAYLINES_10, PAYTABLE, SlotSymbol.WILD);

    // Total win: sum of per-line payouts / 10 = per-bet multiplier
    let totalWinMultiplier = 0;
    for (const win of lineWins) totalWinMultiplier += win.multiplier;
    totalWinMultiplier = totalWinMultiplier / 10;

    // Scatter pay
    if (bookCount >= 3 && BOOK_SCATTER_PAY[bookCount]) {
      totalWinMultiplier += BOOK_SCATTER_PAY[bookCount];
      features.push({ type: 'bonus', data: { type: 'scatter_pay', bookCount, payout: BOOK_SCATTER_PAY[bookCount] } });
    }

    // Free spins trigger
    if (bookCount >= BOOKS_FOR_FREE_SPINS && !isFreeSpin) {
      const expandingSymbols = this.selectExpandingSymbols(serverSeed, clientSeed, nonce, riskLevel);
      const spinsCount = riskLevel === 'extreme' ? FREE_SPINS_EXTREME : FREE_SPINS_NORMAL;
      freeSpinsAwarded = spinsCount;
      features.push({ type: 'free_spins', data: { count: spinsCount, riskLevel, expandingSymbols } });
    }

    if (bookCount >= BOOKS_FOR_FREE_SPINS && isFreeSpin) {
      const extraSpins = riskLevel === 'extreme' ? FREE_SPINS_EXTREME : FREE_SPINS_NORMAL;
      freeSpinsAwarded = extraSpins;
      features.push({ type: 'free_spins', data: { type: 'retrigger', count: extraSpins } });
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

  private expandSymbols(grid: SlotSymbol[][], expandingSymbols: SlotSymbol[]): SlotSymbol[][] {
    const newGrid = grid.map(row => [...row]);
    for (let col = 0; col < GRID_COLS; col++) {
      let shouldExpand = false;
      for (let row = 0; row < GRID_ROWS; row++) {
        if (expandingSymbols.includes(newGrid[row][col])) { shouldExpand = true; break; }
      }
      if (shouldExpand) {
        const expandSym = expandingSymbols.find(s => newGrid.some(row => row[col] === s))!;
        for (let row = 0; row < GRID_ROWS; row++) {
          if (newGrid[row][col] !== SlotSymbol.BOOK) newGrid[row][col] = expandSym;
        }
      }
    }
    return newGrid;
  }

  private selectExpandingSymbols(serverSeed: string, clientSeed: string, nonce: number, riskLevel: 'normal' | 'extreme'): SlotSymbol[] {
    const count = riskLevel === 'extreme' ? 2 : 1;
    const symbols: SlotSymbol[] = [];
    for (let i = 0; i < count; i++) {
      const value = ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, `expanding:${i}`, EXPANDING_TOTAL_WEIGHT);
      let cumulative = 0;
      for (const sw of EXPANDING_SYMBOL_WEIGHTS) {
        cumulative += sw.weight;
        if (value < cumulative) {
          if (!symbols.includes(sw.symbol)) symbols.push(sw.symbol);
          else {
            for (const sw2 of EXPANDING_SYMBOL_WEIGHTS) {
              if (!symbols.includes(sw2.symbol)) { symbols.push(sw2.symbol); break; }
            }
          }
          break;
        }
      }
    }
    return symbols;
  }

  private countSymbol(grid: SlotSymbol[][], symbol: SlotSymbol): number {
    let count = 0;
    for (const row of grid) for (const s of row) if (s === symbol) count++;
    return count;
  }
}
