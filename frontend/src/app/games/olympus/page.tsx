"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";
import config from "@/config/api";

const API_URL = config.apiUrl;

// ============================================
// SYMBOL DEFINITIONS
// ============================================
enum OlympusSymbol {
  PURPLE_GEM = "purple_gem",
  RED_GEM = "red_gem",
  GREEN_GEM = "green_gem",
  BLUE_GEM = "blue_gem",
  CHALICE = "chalice",
  RING = "ring",
  HOURGLASS = "hourglass",
  CROWN = "crown",
  SCATTER = "scatter",
  MULTIPLIER = "multiplier",
}

const SYMBOL_CONFIG: Record<
  string,
  { emoji: string; label: string; color: string; tier: string }
> = {
  [OlympusSymbol.CROWN]: {
    emoji: "👑",
    label: "Crown",
    color: "#FFD700",
    tier: "premium",
  },
  [OlympusSymbol.HOURGLASS]: {
    emoji: "⏳",
    label: "Hourglass",
    color: "#C0A0FF",
    tier: "premium",
  },
  [OlympusSymbol.RING]: {
    emoji: "💍",
    label: "Ring",
    color: "#FF69B4",
    tier: "premium",
  },
  [OlympusSymbol.CHALICE]: {
    emoji: "🏆",
    label: "Chalice",
    color: "#FF8C00",
    tier: "premium",
  },
  [OlympusSymbol.BLUE_GEM]: {
    emoji: "💎",
    label: "Blue Gem",
    color: "#4FC3F7",
    tier: "low",
  },
  [OlympusSymbol.GREEN_GEM]: {
    emoji: "💚",
    label: "Green Gem",
    color: "#66BB6A",
    tier: "low",
  },
  [OlympusSymbol.RED_GEM]: {
    emoji: "❤️",
    label: "Red Gem",
    color: "#EF5350",
    tier: "low",
  },
  [OlympusSymbol.PURPLE_GEM]: {
    emoji: "💜",
    label: "Purple Gem",
    color: "#AB47BC",
    tier: "low",
  },
  [OlympusSymbol.SCATTER]: {
    emoji: "⚡",
    label: "Scatter",
    color: "#FFEB3B",
    tier: "special",
  },
  [OlympusSymbol.MULTIPLIER]: {
    emoji: "🔮",
    label: "Multiplier",
    color: "#E040FB",
    tier: "special",
  },
};

const GRID_COLS = 6;
const GRID_ROWS = 5;

// ============================================
// INTERFACES
// ============================================
interface GridCell {
  symbol: string;
  position: number;
  multiplierValue?: number;
}

interface ApiGridCell {
  symbol: string;
  multiplier?: number;
}

interface ClusterWin {
  symbol: string;
  count: number;
  positions: number[];
  payout: number;
}

interface TumbleResult {
  grid: ApiGridCell[][] | GridCell[];
  wins: ClusterWin[];
  multipliers: number[];
  removedPositions: number[];
}

// Convert 2D API grid to flat GridCell array
function parseGrid(apiGrid: ApiGridCell[][] | GridCell[]): GridCell[] {
  // If it's already a flat array with position property, return as-is
  if (Array.isArray(apiGrid) && apiGrid.length > 0 && !Array.isArray(apiGrid[0]) && 'position' in apiGrid[0]) {
    return apiGrid as GridCell[];
  }
  // It's a 2D array from the API
  const flat: GridCell[] = [];
  const grid2D = apiGrid as ApiGridCell[][];
  for (let row = 0; row < grid2D.length; row++) {
    for (let col = 0; col < grid2D[row].length; col++) {
      const cell = grid2D[row][col];
      flat.push({
        symbol: cell.symbol,
        position: row * GRID_COLS + col,
        multiplierValue: cell.multiplier,
      });
    }
  }
  return flat;
}

interface SpinResponse {
  initialGrid: ApiGridCell[][] | GridCell[];
  tumbles: TumbleResult[];
  totalWin: number;
  totalMultiplier: number;
  multiplierSum: number;
  scatterCount: number;
  freeSpinsAwarded: number;
  freeSpinSessionId: string | null;
  isWin: boolean;
  profit: number;
  betAmount: number;
  anteBet: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface FreeSpinResponse {
  initialGrid: ApiGridCell[][] | GridCell[];
  tumbles: TumbleResult[];
  spinWin: number;
  cumulativeMultiplier: number;
  spinsRemaining: number;
  totalSpins: number;
  totalWin: number;
  scatterCount: number;
  retriggered: boolean;
  isComplete: boolean;
}

interface GameState {
  hasActiveSession: boolean;
  sessionId?: string;
  spinsRemaining?: number;
  totalSpins?: number;
  cumulativeMultiplier?: number;
  totalWin?: number;
  betAmount?: number;
}

interface BetHistoryItem {
  id: string;
  betAmount: string;
  multiplier: string;
  payout: string;
  profit: string;
  isWin: boolean;
  gameData: any;
  createdAt: string;
}

// ============================================
// COMPONENT
// ============================================
export default function OlympusPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  // Game state
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [anteBet, setAnteBet] = useState(false);
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [displayGrid, setDisplayGrid] = useState<GridCell[]>([]);
  const [winPositions, setWinPositions] = useState<Set<number>>(new Set());
  const [removedPositions, setRemovedPositions] = useState<Set<number>>(
    new Set()
  );
  const [lastResult, setLastResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalWinDisplay, setTotalWinDisplay] = useState<number>(0);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(0);
  const [showBigWin, setShowBigWin] = useState(false);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [tumbleIndex, setTumbleIndex] = useState(-1);

  // Free spins state
  const [freeSpinSession, setFreeSpinSession] = useState<string | null>(null);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const [cumulativeMultiplier, setCumulativeMultiplier] = useState(0);
  const [showFreeSpinsBanner, setShowFreeSpinsBanner] = useState(false);

  // History
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [showPaytable, setShowPaytable] = useState(false);

  // Audio refs
  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const bigWinSoundRef = useRef<HTMLAudioElement | null>(null);
  const tumbleSoundRef = useRef<HTMLAudioElement | null>(null);
  const scatterSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize
  useEffect(() => {
    spinSoundRef.current = new Audio("/sounds/dice-roll.mp3");
    winSoundRef.current = new Audio("/sounds/win.mp3");
    bigWinSoundRef.current = new Audio("/sounds/win.mp3");
    tumbleSoundRef.current = new Audio("/sounds/dice-roll.mp3");
    scatterSoundRef.current = new Audio("/sounds/win.mp3");

    // Generate initial display grid
    const initialGrid: GridCell[] = [];
    const symbols = Object.values(OlympusSymbol);
    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
      initialGrid.push({
        symbol: symbols[Math.floor(Math.random() * (symbols.length - 2))],
        position: i,
      });
    }
    setDisplayGrid(initialGrid);
    setLoading(false);
  }, []);

  // Check for active free spin session
  useEffect(() => {
    if (user) {
      checkGameState();
      loadHistory();
    }
  }, [user]);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (isSoundActive && sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  };

  const checkGameState = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/games/olympus/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const state: GameState = await res.json();
        if (state.hasActiveSession && state.sessionId) {
          setFreeSpinSession(state.sessionId);
          setFreeSpinsRemaining(state.spinsRemaining || 0);
          setFreeSpinsTotalWin(state.totalWin || 0);
          setCumulativeMultiplier(state.cumulativeMultiplier || 0);
        }
      }
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/games/olympus/history?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {}
  };

  // ============================================
  // TUMBLE ANIMATION SEQUENCE
  // ============================================
  const animateTumbles = useCallback(
    async (
      initialGrid: GridCell[],
      tumbles: TumbleResult[],
      totalWin: number
    ) => {
      // Show initial grid with spin animation
      setDisplayGrid(initialGrid);
      setTumbleIndex(-1);
      setWinPositions(new Set());
      setRemovedPositions(new Set());

      // Wait for initial grid to display
      await delay(600);

      let runningWin = 0;

      for (let i = 0; i < tumbles.length; i++) {
        const tumble = tumbles[i];
        setTumbleIndex(i);

        // Highlight winning positions
        if (tumble.wins.length > 0) {
          const allWinPos = new Set<number>();
          tumble.wins.forEach((w) => w.positions.forEach((p) => allWinPos.add(p)));
          setWinPositions(allWinPos);
          playSound(winSoundRef.current);

          // Show win amount accumulation
          tumble.wins.forEach((w) => {
            runningWin += w.payout * parseFloat(betAmount);
          });
          setTotalWinDisplay(runningWin);

          await delay(800);

          // Show multiplier orbs
          if (tumble.multipliers.length > 0) {
            tumble.multipliers.forEach((m) => {
              setCurrentMultiplier((prev) => prev + m);
            });
            await delay(400);
          }

          // Show removed positions (tumble effect)
          setRemovedPositions(new Set(tumble.removedPositions));
          playSound(tumbleSoundRef.current);
          await delay(500);

          // Show new grid after tumble
          setWinPositions(new Set());
          setRemovedPositions(new Set());
          if (i < tumbles.length - 1) {
            setDisplayGrid(parseGrid(tumbles[i].grid));
          }
          await delay(300);
        }
      }

      // Final display
      if (tumbles.length > 0) {
        setDisplayGrid(parseGrid(tumbles[tumbles.length - 1].grid));
      }
      setTotalWinDisplay(totalWin);

      // Big win animation
      if (totalWin > parseFloat(betAmount) * 10) {
        setBigWinAmount(totalWin);
        setShowBigWin(true);
        playSound(bigWinSoundRef.current);
        setTimeout(() => setShowBigWin(false), 3000);
      }
    },
    [betAmount, isSoundActive]
  );

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // ============================================
  // SPIN
  // ============================================
  const handleSpin = useCallback(async () => {
    if (!user) {
      setError("Please login to play");
      return;
    }
    if (spinning) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Invalid bet amount");
      return;
    }

    setSpinning(true);
    setError(null);
    setTotalWinDisplay(0);
    setCurrentMultiplier(0);
    setShowBigWin(false);
    playSound(spinSoundRef.current);

    // Spin animation on grid
    const symbols = Object.values(OlympusSymbol).filter(
      (s) => s !== OlympusSymbol.SCATTER && s !== OlympusSymbol.MULTIPLIER
    );
    const spinInterval = setInterval(() => {
      const randomGrid: GridCell[] = [];
      for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
        randomGrid.push({
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
          position: i,
        });
      }
      setDisplayGrid(randomGrid);
    }, 80);

    try {
      const token = localStorage.getItem("auth_token");

      if (freeSpinSession) {
        // Free spin
        const res = await fetch(`${API_URL}/games/olympus/free-spin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId: freeSpinSession }),
        });

        const data: FreeSpinResponse = await res.json();
        if (!res.ok) throw new Error((data as any).message || "Free spin failed");

        clearInterval(spinInterval);

        // Update free spin state
        setFreeSpinsRemaining(data.spinsRemaining);
        setFreeSpinsTotalWin(data.totalWin);
        setCumulativeMultiplier(data.cumulativeMultiplier);

        if (data.retriggered) {
          playSound(scatterSoundRef.current);
        }

        // Animate tumbles
        await animateTumbles(
          parseGrid(data.initialGrid),
          data.tumbles,
          data.spinWin
        );

        if (data.isComplete) {
          setFreeSpinSession(null);
          setFreeSpinsRemaining(0);
          if (data.totalWin > 0) {
            setBigWinAmount(data.totalWin);
            setShowBigWin(true);
            setTimeout(() => setShowBigWin(false), 4000);
          }
        }

        refreshUser();
      } else {
        // Regular spin
        const res = await fetch(`${API_URL}/games/olympus/spin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ betAmount: amount, anteBet }),
        });

        const data: SpinResponse = await res.json();
        if (!res.ok) throw new Error((data as any).message || "Spin failed");

        clearInterval(spinInterval);
        setLastResult(data);

        // Check for free spins trigger
        if (data.freeSpinsAwarded > 0 && data.freeSpinSessionId) {
          setShowFreeSpinsBanner(true);
          playSound(scatterSoundRef.current);
          setFreeSpinSession(data.freeSpinSessionId);
          setFreeSpinsRemaining(data.freeSpinsAwarded);
          setFreeSpinsTotalWin(0);
          setCumulativeMultiplier(0);
          setTimeout(() => setShowFreeSpinsBanner(false), 3000);
        }

        // Animate tumbles
        await animateTumbles(
          parseGrid(data.initialGrid),
          data.tumbles,
          data.totalWin
        );

        refreshUser();
        loadHistory();
      }
    } catch (err: any) {
      clearInterval(spinInterval);
      setError(err.message);
    } finally {
      setSpinning(false);
    }
  }, [user, betAmount, anteBet, spinning, freeSpinSession, isSoundActive, animateTumbles]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !spinning &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        handleSpin();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSpin]);

  // Get balance
  const balance = parseFloat(
    user?.balance?.find((b: any) => b.currency === "USDT")?.available || "0"
  );

  // Actual bet with ante
  const actualBet = anteBet
    ? parseFloat(betAmount) * 1.25
    : parseFloat(betAmount);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00F0FF] mx-auto mb-4" />
          <p className="text-gray-400">Loading Gates of Olympus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1923] text-white relative overflow-hidden">
      {/* Olympus Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2c38] via-[#0f1923] to-[#0f1923]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00F0FF]/5 rounded-full blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-[#00F0FF]/3 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[300px] bg-[#00F0FF]/2 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-[#1a2c38] border-b border-[#2f4553] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <span className="text-2xl">⚡</span>
            <h1 className="text-xl font-bold">
              Gates of Olympus
            </h1>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              Provably Fair
            </span>
            <span className="px-2 py-0.5 bg-green-500/20 text-[#00F0FF] text-xs rounded-full">
              96% RTP
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPaytable(!showPaytable)}
              className="text-sm text-gray-400 hover:text-[#00F0FF] transition-colors"
            >
              Paytable
            </button>
            {user && (
              <div className="text-sm text-gray-400">
                Balance:{" "}
                <span className="text-white font-mono">
                  ${balance.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Free Spins Banner */}
      {showFreeSpinsBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">⚡</div>
            <div className="text-4xl font-black text-[#00F0FF] mb-2">
              FREE SPINS!
            </div>
            <div className="text-xl text-[#00F0FF]/80">
              You won {freeSpinsRemaining} Free Spins!
            </div>
          </div>
        </div>
      )}

      {/* Big Win Overlay */}
      {showBigWin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-2xl text-[#00F0FF] mb-2 animate-pulse">
              {bigWinAmount > actualBet * 50
                ? "MEGA WIN"
                : bigWinAmount > actualBet * 20
                ? "SUPER WIN"
                : "BIG WIN"}
            </div>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 animate-pulse">
              ${bigWinAmount.toFixed(2)}
            </div>
            <div className="text-lg text-[#00F0FF]/80 mt-2">
              {(bigWinAmount / actualBet).toFixed(1)}x multiplier
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1 space-y-3 order-2 lg:order-1">
          {/* Free Spins Status */}
          {freeSpinSession && (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-[#2f4553] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚡</span>
                <span className="font-bold text-[#00F0FF]">
                  Free Spins Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-400 text-xs">Remaining</div>
                  <div className="text-[#00F0FF] font-bold text-lg">
                    {freeSpinsRemaining}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Multiplier</div>
                  <div className="text-[#00F0FF] font-bold text-lg">
                    {cumulativeMultiplier}x
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-400 text-xs">Total Win</div>
                  <div className="text-green-400 font-bold text-lg">
                    ${freeSpinsTotalWin.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bet Amount */}
          {!freeSpinSession && (
            <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
              <label className="text-sm text-gray-400 mb-2 block">
                Bet Amount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#00F0FF] focus:outline-none"
                  min="0.10"
                  step="0.10"
                  disabled={spinning}
                />
                <button
                  onClick={() =>
                    setBetAmount((prev) =>
                      Math.max(0.1, parseFloat(prev) / 2).toFixed(2)
                    )
                  }
                  className="px-3 py-2 bg-[#0f1923] border border-[#2f4553] rounded-lg text-sm hover:bg-[#2f4553] transition-colors"
                >
                  &frac12;
                </button>
                <button
                  onClick={() =>
                    setBetAmount((prev) =>
                      Math.min(1000, parseFloat(prev) * 2).toFixed(2)
                    )
                  }
                  className="px-3 py-2 bg-[#0f1923] border border-[#2f4553] rounded-lg text-sm hover:bg-[#2f4553] transition-colors"
                >
                  2&times;
                </button>
              </div>
              {/* Quick bet buttons */}
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[0.5, 1, 5, 10].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt.toFixed(2))}
                    className="py-1 text-xs bg-[#0f1923] border border-[#2f4553] rounded hover:bg-[#2f4553] transition-colors text-gray-300"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ante Bet Toggle */}
          {!freeSpinSession && (
            <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Ante Bet</div>
                  <div className="text-xs text-gray-400">
                    +25% bet for 2x scatter chance
                  </div>
                </div>
                <button
                  onClick={() => setAnteBet(!anteBet)}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    anteBet ? "bg-green-500" : "bg-[#2f4553]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
                      anteBet ? "left-6" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              {anteBet && (
                <div className="mt-2 text-xs text-[#00F0FF]/80">
                  Actual bet: ${actualBet.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Spin Button */}
          <button
            onClick={handleSpin}
            disabled={spinning || !user}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all relative overflow-hidden ${
              spinning
                ? "bg-gray-700 cursor-not-allowed"
                : freeSpinSession
                ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/20"
                : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/20"
            }`}
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Spinning...
              </span>
            ) : !user ? (
              "Login to Play"
            ) : freeSpinSession ? (
              `Free Spin (${freeSpinsRemaining} left)`
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="text-2xl">⚡</span>
                SPIN
              </span>
            )}
          </button>

          {/* Win Display */}
          {totalWinDisplay > 0 && !spinning && (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <div className="text-xs text-green-400/80 mb-1">Total Win</div>
              <div className="text-2xl font-black text-green-400">
                ${totalWinDisplay.toFixed(2)}
              </div>
              {currentMultiplier > 0 && (
                <div className="text-xs text-[#00F0FF] mt-1">
                  Multiplier: {currentMultiplier}x
                </div>
              )}
            </div>
          )}

          {/* Game Info */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">RTP</span>
              <span className="text-green-400 font-mono">96.00%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Max Win</span>
              <span className="text-[#00F0FF] font-mono">5,000x</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Min Cluster</span>
              <span className="text-white font-mono">8 symbols</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Grid</span>
              <span className="text-white font-mono">6x5</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Center - Game Grid */}
        <div className="lg:col-span-3 space-y-4 order-1 lg:order-2">
          {/* Slot Grid */}
          <div className="bg-[#1a2c38]/80 backdrop-blur rounded-2xl border border-[#2f4553] p-3 sm:p-4 relative overflow-hidden">
            {/* Zeus decoration */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-4xl opacity-30 pointer-events-none">
              ⚡
            </div>

            {/* Grid */}
            <div
              className="grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
              }}
            >
              {displayGrid.map((cell, index) => {
                const isWinning = winPositions.has(cell.position);
                const isRemoved = removedPositions.has(cell.position);
                const symbolCfg = SYMBOL_CONFIG[cell.symbol] || {
                  emoji: "?",
                  label: "Unknown",
                  color: "#888",
                  tier: "low",
                };

                return (
                  <div
                    key={index}
                    className={`
                      aspect-square rounded-lg sm:rounded-xl flex items-center justify-center relative
                      transition-all duration-300
                      ${
                        isRemoved
                          ? "opacity-0 scale-50"
                          : isWinning
                          ? "scale-110 z-10"
                          : spinning
                          ? "animate-pulse"
                          : ""
                      }
                      ${
                        isWinning
                          ? "ring-2 ring-[#00F0FF] shadow-lg shadow-[#00F0FF]/40 bg-[#00F0FF]/10"
                          : "bg-[#0f1923] hover:bg-[#2f4553]/60"
                      }
                    `}
                    style={{
                      borderColor: isWinning ? symbolCfg.color : "transparent",
                    }}
                  >
                    <span
                      className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl select-none ${
                        spinning ? "" : "transition-transform hover:scale-110"
                      }`}
                    >
                      {symbolCfg.emoji}
                    </span>
                    {/* Multiplier value badge */}
                    {cell.symbol === OlympusSymbol.MULTIPLIER &&
                      cell.multiplierValue && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-[#00F0FF] text-white text-[8px] sm:text-[10px] font-bold px-1 rounded-full">
                          {cell.multiplierValue}x
                        </div>
                      )}
                    {/* Win glow effect */}
                    {isWinning && (
                      <div
                        className="absolute inset-0 rounded-lg sm:rounded-xl animate-ping opacity-20"
                        style={{ backgroundColor: symbolCfg.color }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tumble counter */}
            {tumbleIndex >= 0 && spinning && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-[#00F0FF]">
                Tumble #{tumbleIndex + 1}
              </div>
            )}
          </div>

          {/* Provably Fair */}
          {lastResult && !freeSpinSession && (
            <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400">&#10003;</span>
                <span className="text-sm font-bold text-white">
                  Provably Fair
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Server Seed Hash:</span>
                  <div className="font-mono text-gray-300 truncate">
                    {lastResult.serverSeedHash}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Client Seed:</span>
                  <div className="font-mono text-gray-300 truncate">
                    {lastResult.clientSeed}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Nonce:</span>
                  <div className="font-mono text-gray-300">
                    {lastResult.nonce}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bet History */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
            <h3 className="text-sm font-bold text-white mb-3">Recent Spins</h3>
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                No spins yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-[#2f4553]">
                      <th className="text-left py-2">Type</th>
                      <th className="text-right py-2">Bet</th>
                      <th className="text-right py-2">Multi</th>
                      <th className="text-right py-2">Payout</th>
                      <th className="text-right py-2">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 10).map((bet) => (
                      <tr
                        key={bet.id}
                        className="border-b border-[#2f4553]/50"
                      >
                        <td className="py-2 text-gray-300">
                          {bet.gameData?.type === "free_spins_complete"
                            ? "Free Spins"
                            : bet.gameData?.anteBet
                            ? "Ante Spin"
                            : "Spin"}
                        </td>
                        <td className="py-2 text-right text-gray-300 font-mono">
                          ${parseFloat(bet.betAmount).toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-[#00F0FF] font-mono">
                          {parseFloat(bet.multiplier).toFixed(2)}x
                        </td>
                        <td className="py-2 text-right text-gray-300 font-mono">
                          ${parseFloat(bet.payout).toFixed(2)}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${
                            bet.isWin ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {bet.isWin ? "+" : ""}$
                          {parseFloat(bet.profit).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paytable Modal */}
      {showPaytable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#00F0FF]">
                Paytable
              </h2>
              <button
                onClick={() => setShowPaytable(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Premium Symbols */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#00F0FF] mb-3">
                Premium Symbols
              </h3>
              <div className="space-y-2">
                {[
                  {
                    s: OlympusSymbol.CROWN,
                    pays: "8:10x | 9:15x | 10:25x | 11:50x | 12:100x",
                  },
                  {
                    s: OlympusSymbol.HOURGLASS,
                    pays: "8:5x | 9:8x | 10:15x | 11:25x | 12:50x",
                  },
                  {
                    s: OlympusSymbol.RING,
                    pays: "8:4x | 9:6x | 10:10x | 11:15x | 12:25x",
                  },
                  {
                    s: OlympusSymbol.CHALICE,
                    pays: "8:3x | 9:5x | 10:8x | 11:12x | 12:20x",
                  },
                ].map(({ s, pays }) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 bg-[#0f1923] rounded-lg p-2"
                  >
                    <span className="text-2xl">{SYMBOL_CONFIG[s].emoji}</span>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {SYMBOL_CONFIG[s].label}
                      </div>
                      <div className="text-xs text-gray-400">{pays}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Symbols */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-blue-400 mb-3">
                Gem Symbols
              </h3>
              <div className="space-y-2">
                {[
                  {
                    s: OlympusSymbol.BLUE_GEM,
                    pays: "8:1.5x | 9:2x | 10:3x | 11:5x | 12:8x",
                  },
                  {
                    s: OlympusSymbol.GREEN_GEM,
                    pays: "8:1x | 9:1.5x | 10:2.5x | 11:4x | 12:6x",
                  },
                  {
                    s: OlympusSymbol.RED_GEM,
                    pays: "8:0.8x | 9:1.2x | 10:2x | 11:3x | 12:5x",
                  },
                  {
                    s: OlympusSymbol.PURPLE_GEM,
                    pays: "8:0.5x | 9:0.8x | 10:1.5x | 11:2.5x | 12:4x",
                  },
                ].map(({ s, pays }) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 bg-[#0f1923] rounded-lg p-2"
                  >
                    <span className="text-2xl">{SYMBOL_CONFIG[s].emoji}</span>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {SYMBOL_CONFIG[s].label}
                      </div>
                      <div className="text-xs text-gray-400">{pays}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Symbols */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#00F0FF] mb-3">
                Special Symbols
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <div className="text-sm font-bold text-[#00F0FF]">
                      Scatter (Zeus Lightning)
                    </div>
                    <div className="text-xs text-gray-400">
                      4+ Scatters trigger 15 Free Spins. Can retrigger for +5
                      spins.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#00F0FF]/10 rounded-lg p-3">
                  <span className="text-2xl">🔮</span>
                  <div>
                    <div className="text-sm font-bold text-[#00F0FF]">
                      Multiplier Orb
                    </div>
                    <div className="text-xs text-gray-400">
                      Appears with random multiplier (2x-100x). Applied to total
                      win. Cumulative during Free Spins!
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Rules */}
            <div>
              <h3 className="text-sm font-bold text-gray-300 mb-3">
                Game Rules
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>
                  &#8226; Wins are paid for clusters of 8+ matching symbols
                  anywhere on the grid
                </li>
                <li>
                  &#8226; Winning symbols are removed and new symbols tumble
                  down (Tumble Feature)
                </li>
                <li>
                  &#8226; Tumbles continue until no new wins are formed
                </li>
                <li>
                  &#8226; Multiplier orbs apply their value to the total win of
                  the spin
                </li>
                <li>
                  &#8226; During Free Spins, multipliers are cumulative across
                  all spins
                </li>
                <li>
                  &#8226; Ante Bet costs 25% more but doubles scatter
                  probability
                </li>
                <li>
                  &#8226; Maximum win is capped at 5,000x your bet
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
