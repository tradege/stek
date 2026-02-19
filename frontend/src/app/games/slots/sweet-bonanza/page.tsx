"use client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SlotFrame, ReelCell, BigWinPopup, ControlBar } from "@/components/games/slots/SlotFrame";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";
import config from "@/config/api";
const API_URL = config.apiUrl;

// ============================================
// SYMBOL DEFINITIONS - CANDY THEME
// ============================================
const SYMBOL_CONFIG: Record<string, { emoji: string; label: string; color: string; tier: string }> = {
  crown:    { emoji: "👑", label: "Crown",    color: "#FFD700", tier: "premium" },
  diamond:  { emoji: "💎", label: "Diamond",  color: "#B9F2FF", tier: "premium" },
  seven:    { emoji: "7️⃣",  label: "Seven",    color: "#FF4444", tier: "premium" },
  bell:     { emoji: "🔔", label: "Bell",     color: "#FFB300", tier: "mid" },
  bar:      { emoji: "🍫", label: "Bar",      color: "#8B4513", tier: "mid" },
  cherry:   { emoji: "🍒", label: "Cherry",   color: "#FF1744", tier: "low" },
  orange:   { emoji: "🍊", label: "Orange",   color: "#FF9100", tier: "low" },
  lemon:    { emoji: "🍋", label: "Lemon",    color: "#FFEA00", tier: "low" },
  plum:     { emoji: "🍇", label: "Plum",     color: "#9C27B0", tier: "low" },
  scatter:  { emoji: "💣", label: "Scatter",  color: "#FF6D00", tier: "special" },
  bomb:     { emoji: "💣", label: "Bomb",     color: "#FF6D00", tier: "special" },
  wild:     { emoji: "⭐", label: "Wild",     color: "#00E5FF", tier: "special" },
};
const GRID_COLS = 6;
const GRID_ROWS = 5;

interface GridCell { symbol: string; position: number; }
interface ClusterWin { symbol: string; count: number; positions: number[][]; payout: number; }
interface SpinResponse {
  success: boolean; game: string; grid: string[][]; wins: ClusterWin[];
  features: any[]; totalWinMultiplier: number; totalPayout: number; profit: number;
  isWin: boolean; multiplier: number; freeSpins: any;
  provablyFair: { serverSeedHash: string; clientSeed: string; nonce: number };
}
interface BetHistoryItem { id: string; betAmount: string; multiplier: string; payout: string; profit: string; isWin: boolean; createdAt: string; }

function parseGrid(apiGrid: string[][]): GridCell[] {
  const flat: GridCell[] = [];
  for (let row = 0; row < apiGrid.length; row++) {
    for (let col = 0; col < apiGrid[row].length; col++) {
      flat.push({ symbol: apiGrid[row][col], position: row * GRID_COLS + col });
    }
  }
  return flat;
}

export default function SweetBonanzaPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [displayGrid, setDisplayGrid] = useState<GridCell[]>([]);
  const [winPositions, setWinPositions] = useState<Set<number>>(new Set());
  const [lastResult, setLastResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalWinDisplay, setTotalWinDisplay] = useState<number>(0);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);
  const [showBigWin, setShowBigWin] = useState(false);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [bigWinMultiplier, setBigWinMultiplier] = useState(0);
  const [tumbleCount, setTumbleCount] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [showProvably, setShowProvably] = useState(false);
  const [freeSpinSession, setFreeSpinSession] = useState(false);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const spinRef = useRef(false);

  const getBalance = useCallback(() => {
    if (!user) return 0;
    const b = (user as any).balance?.find?.((b: any) => b.currency === "USDT");
    return b ? parseFloat(b.available) : 0;
  }, [user]);

  // Initialize grid
  useEffect(() => {
    const initGrid: GridCell[] = [];
    const syms = Object.keys(SYMBOL_CONFIG);
    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
      initGrid.push({ symbol: syms[Math.floor(Math.random() * (syms.length - 2))], position: i });
    }
    setDisplayGrid(initGrid);
    setLoading(false);
  }, []);

  // Fetch history
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetch(`${API_URL}/api/slots/history?gameMode=BONANZA&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.history) setHistory(d.history); }).catch(() => {});
  }, [user, lastResult]);

  const handleSpin = useCallback(async () => {
    if (spinRef.current || !user) return;
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.1) { setError("Minimum bet is $0.10"); return; }
    if (!freeSpinSession && bet > getBalance()) { setError("Insufficient balance"); return; }
    spinRef.current = true;
    setSpinning(true);
    setError(null);
    setWinPositions(new Set());
    setTotalWinDisplay(0);
    setCurrentMultiplier(1);
    setTumbleCount(0);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/slots/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameMode: "BONANZA", betAmount: freeSpinSession ? 0 : bet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Spin failed");

      // Animate grid landing
      setTimeout(() => {
        setDisplayGrid(parseGrid(data.grid));
        setSpinning(false);

        // Show wins
        if (data.isWin && data.wins?.length > 0) {
          const allWinPos = new Set<number>();
          data.wins.forEach((w: ClusterWin) => {
            w.positions?.forEach((p: number[]) => allWinPos.add(p[0] * GRID_COLS + p[1]));
          });
          setWinPositions(allWinPos);
          setTotalWinDisplay(data.totalPayout);
          setCurrentMultiplier(data.totalWinMultiplier || 1);
          setTumbleCount(data.features?.filter((f: any) => f.type === "tumble")?.length || 0);

          // Big Win check
          if (data.multiplier >= 10) {
            setBigWinAmount(data.totalPayout);
            setBigWinMultiplier(data.multiplier);
            setShowBigWin(true);
          }
        }

        // Free spins
        if (data.freeSpins?.triggered) {
          setFreeSpinSession(true);
          setFreeSpinsRemaining(data.freeSpins.remaining || 10);
          setFreeSpinsTotalWin(0);
        } else if (freeSpinSession) {
          setFreeSpinsRemaining(prev => prev - 1);
          setFreeSpinsTotalWin(prev => prev + (data.totalPayout || 0));
          if (freeSpinsRemaining <= 1) {
            setFreeSpinSession(false);
          }
        }

        setLastResult(data);
        refreshUser();
      }, 800);
    } catch (err: any) {
      setError(err.message);
      setSpinning(false);
    } finally {
      spinRef.current = false;
    }
  }, [user, betAmount, freeSpinSession, freeSpinsRemaining, getBalance, refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍬</div>
          <div className="text-white font-bold">Loading Sweet Bonanza...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">&larr; Back</Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                🍬 Sweet Bonanza
                <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full font-bold">TUMBLE</span>
              </h1>
              <p className="text-sm text-gray-400">6x5 Cluster Pays &bull; Combo Multiplier &bull; 96% RTP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400">Balance</div>
              <div className="text-lg font-bold text-green-400">${getBalance().toFixed(2)}</div>
            </div>
            <button onClick={() => setShowPaytable(!showPaytable)} className="px-4 py-2 bg-[#131B2C] border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">
              {showPaytable ? "Hide" : "Paytable"}
            </button>
          </div>
        </div>

        {/* Paytable */}
        {showPaytable && (
          <div className="bg-[#131B2C] rounded-xl border border-white/10 p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Paytable - Cluster Pays</h3>
            <p className="text-sm text-gray-400 mb-4">Match 5+ adjacent symbols to win. Consecutive tumbles increase the combo multiplier!</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(SYMBOL_CONFIG).filter(([k]) => k !== "scatter" && k !== "wild").map(([key, cfg]) => (
                <div key={key} className="bg-[#0A0E17] rounded-lg p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${cfg.color}60)` }}>{cfg.emoji}</span>
                    <span className="text-sm text-white font-bold">{cfg.label}</span>
                  </div>
                  <div className="text-xs text-gray-400">5+ cluster = win</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-[#0A0E17] rounded-lg p-3 border border-orange-500/30">
                <span className="text-2xl">💣</span>
                <span className="text-sm text-orange-400 font-bold ml-2">Scatter</span>
                <div className="text-xs text-gray-400 mt-1">4+ triggers Free Spins</div>
              </div>
              <div className="bg-[#0A0E17] rounded-lg p-3 border border-cyan-500/30">
                <span className="text-2xl">⭐</span>
                <span className="text-sm text-cyan-400 font-bold ml-2">Wild</span>
                <div className="text-xs text-gray-400 mt-1">Substitutes any symbol</div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main Game Area */}
          <div className="space-y-4">
            <SlotFrame spinning={spinning} isWin={totalWinDisplay > 0} isBigWin={showBigWin} gameName="Sweet Bonanza" gameTheme="candy">
              {/* Big Win Popup */}
              <BigWinPopup show={showBigWin} amount={bigWinAmount} multiplier={bigWinMultiplier} onClose={() => setShowBigWin(false)} gameTheme="candy" />

              {/* Multiplier Display */}
              {currentMultiplier > 1 && (
                <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-pink-500 to-red-500 rounded-full px-4 py-1 text-white font-bold text-sm animate-pulse">
                  {currentMultiplier}x COMBO
                </div>
              )}

              {/* Tumble Counter */}
              {tumbleCount > 0 && (
                <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-pink-400">
                  Tumble #{tumbleCount}
                </div>
              )}

              {/* Grid 6x5 */}
              <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                {displayGrid.map((cell, index) => {
                  const isWinning = winPositions.has(cell.position);
                  const symbolCfg = SYMBOL_CONFIG[cell.symbol] || { emoji: "?", label: "?", color: "#888", tier: "low" };
                  return (
                    <ErrorBoundary key={index} gameName="Bonanza">
                      <ReelCell
                        symbol={cell.symbol}
                        emoji={symbolCfg.emoji}
                        color={symbolCfg.color}
                        tier={symbolCfg.tier}
                        isWinning={isWinning}
                        spinning={spinning}
                        index={index}
                        cols={GRID_COLS}
                        gameTheme="candy"
                      />
                    </ErrorBoundary>
                  );
                })}
              </div>

              {/* Win Display Bar */}
              {totalWinDisplay > 0 && !showBigWin && (
                <div className="mt-3 text-center py-2 bg-gradient-to-r from-pink-500/20 via-pink-500/30 to-pink-500/20 rounded-lg border border-pink-500/30">
                  <span className="text-pink-400 font-bold text-lg">WIN: ${totalWinDisplay.toFixed(2)}</span>
                  {currentMultiplier > 1 && <span className="text-white/60 text-sm ml-2">({currentMultiplier}x combo)</span>}
                </div>
              )}
            </SlotFrame>

            {/* Provably Fair */}
            {lastResult?.provablyFair && (
              <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
                <button onClick={() => setShowProvably(!showProvably)} className="flex items-center justify-between w-full">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-green-400">✓</span> Provably Fair
                  </span>
                  <span className="text-gray-400 text-xs">{showProvably ? "Hide" : "Show"}</span>
                </button>
                {showProvably && (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Server Seed Hash</span><span className="text-white font-mono truncate max-w-[200px]">{lastResult.provablyFair.serverSeedHash}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Client Seed</span><span className="text-white font-mono">{lastResult.provablyFair.clientSeed}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Nonce</span><span className="text-white font-mono">{lastResult.provablyFair.nonce}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Free Spins Panel */}
            {freeSpinSession && (
              <div className="bg-[#131B2C] rounded-xl border border-pink-500/40 p-4">
                <div className="text-center">
                  <div className="text-2xl mb-1">🎰</div>
                  <div className="text-lg font-bold text-pink-400">FREE SPINS!</div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><div className="text-gray-400 text-xs">Remaining</div><div className="text-pink-400 font-bold text-lg">{freeSpinsRemaining}</div></div>
                    <div><div className="text-gray-400 text-xs">Total Win</div><div className="text-green-400 font-bold text-lg">${freeSpinsTotalWin.toFixed(2)}</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* Control Bar */}
            <ControlBar
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              onSpin={handleSpin}
              spinning={spinning}
              disabled={!user}
              freeSpinSession={freeSpinSession}
              freeSpinsRemaining={freeSpinsRemaining}
              gameTheme="candy"
              spinLabel={`🍬 SPIN - $${parseFloat(betAmount).toFixed(2)}`}
            />

            {/* Game Info */}
            <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-white mb-3">Game Features</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between"><span>Grid</span><span className="text-white">6×5</span></div>
                <div className="flex justify-between"><span>Mechanic</span><span className="text-pink-400">Cluster Tumble</span></div>
                <div className="flex justify-between"><span>RTP</span><span className="text-white">96.00%</span></div>
                <div className="flex justify-between"><span>Min Cluster</span><span className="text-white">5 symbols</span></div>
                <div className="flex justify-between"><span>Combo Multiplier</span><span className="text-pink-400">+1x per tumble</span></div>
                <div className="flex justify-between"><span>Max Win</span><span className="text-yellow-400">5,000x</span></div>
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
                <h3 className="text-sm font-bold text-white mb-3">Recent Spins</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {history.slice(0, 8).map((h) => (
                    <div key={h.id} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${h.isWin ? "bg-green-500/5" : "bg-red-500/5"}`}>
                      <span className="text-gray-400">${parseFloat(h.betAmount).toFixed(2)}</span>
                      <span className={`font-bold ${h.isWin ? "text-green-400" : "text-red-400"}`}>
                        {h.isWin ? `+$${parseFloat(h.payout).toFixed(2)}` : `-$${parseFloat(h.betAmount).toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
