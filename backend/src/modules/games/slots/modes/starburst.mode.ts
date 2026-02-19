/**
 * ============================================
 * STARBURST MODE - The Respin Engine (CALIBRATED)
 * ============================================
 * Grid: 5x3, 10 Paylines (Both Ways)
 * Mechanic: Wild respins - wilds expand and trigger respins
 * Innovation: Quantum Wilds (charge system)
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
  getPaytableScaleFactor,
} from '../slot-engine.core';

const GRID_COLS = 5;
const GRID_ROWS = 3;
const MAX_WIN_MULTIPLIER = 2500;
const MAX_RESPINS = 3;
const QUANTUM_CHARGE_THRESHOLD = 3;
const WILD_REELS = [1, 2, 3];

const SYMBOL_WEIGHTS_NORMAL: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: SlotSymbol.CHERRY, weight: 2200 },
  { symbol: SlotSymbol.LEMON, weight: 2000 },
  { symbol: SlotSymbol.ORANGE, weight: 1800 },
  { symbol: SlotSymbol.PLUM, weight: 1500 },
  { symbol: SlotSymbol.BELL, weight: 1200 },
  { symbol: SlotSymbol.BAR, weight: 700 },
  { symbol: SlotSymbol.SEVEN, weight: 400 },
  { symbol: SlotSymbol.DIAMOND, weight: 200 },
];

const SYMBOL_WEIGHTS_WILD_REEL: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: SlotSymbol.CHERRY, weight: 2100 },
  { symbol: SlotSymbol.LEMON, weight: 1900 },
  { symbol: SlotSymbol.ORANGE, weight: 1700 },
  { symbol: SlotSymbol.PLUM, weight: 1400 },
  { symbol: SlotSymbol.BELL, weight: 1100 },
  { symbol: SlotSymbol.BAR, weight: 650 },
  { symbol: SlotSymbol.SEVEN, weight: 370 },
  { symbol: SlotSymbol.DIAMOND, weight: 180 },
  { symbol: SlotSymbol.WILD, weight: 200 },
];

// Per-LINE payouts (CALIBRATED with scale=3.61)
const PAYTABLE: Record<string, Record<number, number>> = {
  [SlotSymbol.DIAMOND]: { 3: 18.06, 4: 90.29, 5: 902.9 },
  [SlotSymbol.SEVEN]:   { 3: 9.03, 4: 36.12, 5: 433.4 },
  [SlotSymbol.BAR]:     { 3: 5.42, 4: 18.06, 5: 216.7 },
  [SlotSymbol.BELL]:    { 3: 3.61, 4: 10.83, 5: 144.5 },
  [SlotSymbol.PLUM]:    { 3: 1.81, 4: 5.42, 5: 72.2 },
  [SlotSymbol.ORANGE]:  { 3: 1.44, 4: 3.61, 5: 54.2 },
  [SlotSymbol.LEMON]:   { 3: 1.08, 4: 2.89, 5: 36.1 },
  [SlotSymbol.CHERRY]:  { 3: 0.72, 4: 1.81, 5: 28.9 },
};

export class StarburstMode implements SlotGameMode {
  readonly name = 'starburst';
  readonly gridRows = GRID_ROWS;
  readonly gridCols = GRID_COLS;
  readonly rtp = 0.96;

  private normalReelMap: VirtualReelEntry[];
  private wildReelMap: VirtualReelEntry[];

  constructor() {
    this.normalReelMap = VirtualReelMapper.buildReelMap(SYMBOL_WEIGHTS_NORMAL);
    this.wildReelMap = VirtualReelMapper.buildReelMap(SYMBOL_WEIGHTS_WILD_REEL);
  }

  spin(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number,
    options?: { quantumCharges?: number; stickyWilds?: number[]; respinCount?: number; houseEdge?: number},
  ): SpinResponse {
    let quantumCharges = options?.quantumCharges || 0;
    const stickyWilds = options?.stickyWilds || [];
    const respinCount = options?.respinCount || 0;
    const features: GameFeature[] = [];
    let totalWinMultiplier = 0;

    const isQuantumSpin = quantumCharges >= QUANTUM_CHARGE_THRESHOLD;
    if (isQuantumSpin) {
      quantumCharges = 0;
      features.push({ type: 'quantum_wild', data: { triggered: true, message: 'Quantum Wild Activated!' } });
    }

    let grid = this.generateGrid(serverSeed, clientSeed, nonce, isQuantumSpin);

    // Apply sticky wilds
    for (const reelIdx of stickyWilds) {
      for (let row = 0; row < GRID_ROWS; row++) grid[row][reelIdx] = SlotSymbol.WILD;
    }

    // Find and expand new wilds
    const newWildReels: number[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      if (WILD_REELS.includes(col) && !stickyWilds.includes(col)) {
        for (let row = 0; row < GRID_ROWS; row++) {
          if (grid[row][col] === SlotSymbol.WILD) {
            newWildReels.push(col);
            for (let r = 0; r < GRID_ROWS; r++) grid[r][col] = SlotSymbol.WILD;
            break;
          }
        }
      }
    }

    // Both-ways evaluation
    const lineWins = WinEvaluator.evaluateLinesBothWays(grid, PAYLINES_10, PAYTABLE, SlotSymbol.WILD);
    for (const win of lineWins) totalWinMultiplier += win.multiplier / 10;

    // Quantum charging
    const hasWilds = newWildReels.length > 0 || stickyWilds.length > 0;
    const hasWins = totalWinMultiplier > 0;
    if (hasWilds && !hasWins && !isQuantumSpin) {
      quantumCharges++;
      features.push({
        type: 'quantum_wild',
        data: { charged: true, currentCharges: quantumCharges, threshold: QUANTUM_CHARGE_THRESHOLD },
      });
    }

    // Respin trigger
    const allWildReels = [...new Set([...stickyWilds, ...newWildReels])];
    let triggerRespin = false;
    if (newWildReels.length > 0 && respinCount < MAX_RESPINS) {
      triggerRespin = true;
      features.push({ type: 'respin', data: { respinNumber: respinCount + 1, stickyWilds: allWildReels, newWilds: newWildReels } });
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
      freeSpinsAwarded: 0,
      bonusData: {
        quantumCharges,
        stickyWilds: triggerRespin ? allWildReels : [],
        respinCount: triggerRespin ? respinCount + 1 : 0,
        triggerRespin,
      },
      serverSeedHash: ProvablyFairEngine.hashServerSeed(serverSeed),
      clientSeed,
      nonce,
    };
  }

  getPaytable(): Record<string, Record<number, number>> { return PAYTABLE; }
  getSymbolWeights(): { symbol: SlotSymbol; weight: number }[] { return SYMBOL_WEIGHTS_WILD_REEL; }

  private generateGrid(serverSeed: string, clientSeed: string, nonce: number, forceWild: boolean): SlotSymbol[][] {
    const grid: SlotSymbol[][] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowSymbols: SlotSymbol[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const index = row * GRID_COLS + col;
        const hash = ProvablyFairEngine.hmacSha256(serverSeed, clientSeed, nonce, index);
        const stop = ProvablyFairEngine.hashToVirtualStop(hash);
        const reelMap = WILD_REELS.includes(col) ? this.wildReelMap : this.normalReelMap;
        rowSymbols.push(VirtualReelMapper.resolveSymbol(reelMap, stop));
      }
      grid.push(rowSymbols);
    }

    if (forceWild) {
      const wildReelIdx = WILD_REELS[ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, 'quantum_reel', WILD_REELS.length)];
      const wildRow = ProvablyFairEngine.generateBonusValue(serverSeed, clientSeed, nonce, 'quantum_row', GRID_ROWS);
      grid[wildRow][wildReelIdx] = SlotSymbol.WILD;
      const matchSymbol = grid[wildRow][0] !== SlotSymbol.WILD ? grid[wildRow][0] : grid[wildRow][GRID_COLS - 1];
      if (wildReelIdx > 0) grid[wildRow][wildReelIdx - 1] = matchSymbol;
      if (wildReelIdx < GRID_COLS - 1) grid[wildRow][wildReelIdx + 1] = matchSymbol;
    }

    return grid;
  }
}
