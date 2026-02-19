"use client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SlotFrame, ReelCell, BigWinPopup, ControlBar } from "@/components/games/slots/SlotFrame";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";
import config from "@/config/api";
const API_URL = config.apiUrl;

const SYMBOL_CONFIG: Record<string, { emoji: string; label: string; color: string; tier: string }> = {
  crown:    { emoji: "💜", label: "Amethyst", color: "#9C27B0", tier: "premium" },
  diamond:  { emoji: "💎", label: "Diamond",  color: "#00E5FF", tier: "premium" },
  seven:    { emoji: "🔴", label: "Ruby",     color: "#FF1744", tier: "premium" },
  bell:     { emoji: "🟡", label: "Topaz",    color: "#FFD600", tier: "mid" },
  bar:      { emoji: "🟢", label: "Emerald",  color: "#00E676", tier: "mid" },
  cherry:   { emoji: "🔵", label: "Sapphire", color: "#2979FF", tier: "low" },
  orange:   { emoji: "🟠", label: "Amber",    color: "#FF9100", tier: "low" },
  lemon:    { emoji: "⚪", label: "Opal",     color: "#E0E0E0", tier: "low" },
  plum:     { emoji: "🟤", label: "Garnet",   color: "#795548", tier: "low" },
  scatter:  { emoji: "💣", label: "Scatter",  color: "#FF6D00", tier: "special" },
  wild:     { emoji: "⭐", label: "Star Wild",color: "#FFD700", tier: "special" },
};
const GRID_COLS = 5;
const GRID_ROWS = 3;

interface GridCell { symbol: string; position: number; }
interface SpinResponse {
  success: boolean; game: string; grid: string[][]; wins: any[];
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

export default function StarburstPage() {
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
  const [showBigWin, setShowBigWin] = useState(false);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [bigWinMultiplier, setBigWinMultiplier] = useState(0);
  const [quantumCharges, setQuantumCharges] = useState(0);
  const [wildPositions, setWildPositions] = useState<Set<number>>(new Set());
  const [isRespin, setIsRespin] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [showProvably, setShowProvably] = useState(false);
  const spinRef = useRef(false);

  const getBalance = useCallback(() => {
    if (!user) return 0;
    const b = (user as any).balance?.find?.((b: any) => b.currency === "USDT");
    return b ? parseFloat(b.available) : 0;
  }, [user]);

  useEffect(() => {
    const initGrid: GridCell[] = [];
    const syms = Object.keys(SYMBOL_CONFIG);
    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
      initGrid.push({ symbol: syms[Math.floor(Math.random() * (syms.length - 2))], position: i });
    }
    setDisplayGrid(initGrid);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetch(`${API_URL}/api/slots/history?gameMode=STARBURST&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.history) setHistory(d.history); }).catch(() => {});
  }, [user, lastResult]);

  const handleSpin = useCallback(async () => {
    if (spinRef.current || !user) return;
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.1) { setError("Minimum bet is $0.10"); return; }
    if (bet > getBalance()) { setError("Insufficient balance"); return; }
    spinRef.current = true;
    setSpinning(true);
    setError(null);
    setWinPositions(new Set());
    setTotalWinDisplay(0);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/slots/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameMode: "STARBURST", betAmount: bet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Spin failed");

      setTimeout(() => {
        setDisplayGrid(parseGrid(data.grid));
        setSpinning(false);

        if (data.isWin && data.wins?.length > 0) {
          const allWinPos = new Set<number>();
          data.wins.forEach((w: any) => {
            if (w.positions) w.positions.forEach((p: number[]) => allWinPos.add(p[0] * GRID_COLS + p[1]));
            if (w.line !== undefined) {
              for (let c = 0; c < GRID_COLS; c++) allWinPos.add(w.line * GRID_COLS + c);
            }
          });
          setWinPositions(allWinPos);
          setTotalWinDisplay(data.totalPayout);

          if (data.multiplier >= 10) {
            setBigWinAmount(data.totalPayout);
            setBigWinMultiplier(data.multiplier);
            setShowBigWin(true);
          }
        }

        // Quantum Wilds tracking
        const quantumFeature = data.features?.find((f: any) => f.type === "quantum_wild");
        if (quantumFeature) {
          setQuantumCharges(quantumFeature.charges || 0);
        }
        const respinFeature = data.features?.find((f: any) => f.type === "respin");
        setIsRespin(!!respinFeature);

        // Track wild positions
        const wilds = new Set<number>();
        data.grid?.forEach((row: string[], r: number) => {
          row.forEach((sym: string, c: number) => {
            if (sym === "wild") wilds.add(r * GRID_COLS + c);
          });
        });
        setWildPositions(wilds);

        setLastResult(data);
        refreshUser();
      }, 800);
    } catch (err: any) {
      setError(err.message);
      setSpinning(false);
    } finally {
      spinRef.current = false;
    }
  }, [user, betAmount, getBalance, refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
        <div className="text-center"><div className="text-6xl mb-4 animate-bounce">⭐</div><div className="text-white font-bold">Loading Starburst...</div></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white">
      {/* Cosmic Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(0,240,255,0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(123,47,255,0.1) 0%, transparent 50%)" }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">&larr; Back</Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                ⭐ Starburst
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold">RESPIN</span>
              </h1>
              <p className="text-sm text-gray-400">5x3 • Both Ways Pay • Quantum Wilds • 96% RTP</p>
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

        {showPaytable && (
          <div className="bg-[#131B2C] rounded-xl border border-cyan-500/20 p-6 mb-6">
            <h3 className="text-lg font-bold text-cyan-400 mb-4">Paytable - Both Ways Pay</h3>
            <p className="text-sm text-gray-400 mb-4">Wins pay left-to-right AND right-to-left! Quantum Wilds store charges for guaranteed wins.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(SYMBOL_CONFIG).filter(([k]) => k !== "scatter" && k !== "wild").map(([key, cfg]) => (
                <div key={key} className="bg-[#0A0E17] rounded-lg p-3 border border-cyan-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl" style={{ filter: `drop-shadow(0 0 8px ${cfg.color}80)` }}>{cfg.emoji}</span>
                    <span className="text-sm text-white font-bold">{cfg.label}</span>
                  </div>
                  <div className="text-xs text-gray-400">3+ on line</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-[#0A0E17] rounded-lg border border-yellow-500/30">
              <span className="text-2xl">⭐</span>
              <span className="text-sm text-yellow-400 font-bold ml-2">Star Wild (Quantum)</span>
              <div className="text-xs text-gray-400 mt-1">Expands on reel. Stores charges - 3 charges = guaranteed win!</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}<button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <SlotFrame spinning={spinning} isWin={totalWinDisplay > 0} isBigWin={showBigWin} gameName="Starburst" gameTheme="space">
              <BigWinPopup show={showBigWin} amount={bigWinAmount} multiplier={bigWinMultiplier} onClose={() => setShowBigWin(false)} gameTheme="space" />

              {/* Quantum Charges Display */}
              {quantumCharges > 0 && (
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
                  <div className="bg-gradient-to-r from-cyan-600 to-purple-600 rounded-full px-3 py-1 text-white font-bold text-xs flex items-center gap-1">
                    <span>⚡</span>
                    {[...Array(3)].map((_, i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${i < quantumCharges ? "bg-cyan-300 shadow-[0_0_6px_rgba(0,240,255,0.8)]" : "bg-gray-600"}`} />
                    ))}
                    <span className="ml-1">{quantumCharges}/3</span>
                  </div>
                </div>
              )}

              {isRespin && (
                <div className="absolute top-2 right-2 z-20 bg-purple-600/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white font-bold animate-pulse">
                  RESPIN!
                </div>
              )}

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {displayGrid.map((cell, index) => {
                  const isWinning = winPositions.has(cell.position);
                  const isWild = wildPositions.has(cell.position);
                  const symbolCfg = SYMBOL_CONFIG[cell.symbol] || { emoji: "?", label: "?", color: "#888", tier: "low" };
                  return (
                    <ErrorBoundary key={index} gameName="Starburst">
                      <ReelCell
                        symbol={cell.symbol}
                        emoji={symbolCfg.emoji}
                        color={symbolCfg.color}
                        tier={isWild ? "special" : symbolCfg.tier}
                        isWinning={isWinning}
                        spinning={spinning}
                        index={index}
                        cols={GRID_COLS}
                        gameTheme="space"
                      />
                    </ErrorBoundary>
                  );
                })}
              </div>

              {totalWinDisplay > 0 && !showBigWin && (
                <div className="mt-3 text-center py-2 bg-gradient-to-r from-cyan-500/20 via-purple-500/30 to-cyan-500/20 rounded-lg border border-cyan-500/30">
                  <span className="text-cyan-400 font-bold text-lg">WIN: ${totalWinDisplay.toFixed(2)}</span>
                </div>
              )}
            </SlotFrame>

            {lastResult?.provablyFair && (
              <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
                <button onClick={() => setShowProvably(!showProvably)} className="flex items-center justify-between w-full">
                  <span className="text-sm font-bold text-white flex items-center gap-2"><span className="text-green-400">✓</span> Provably Fair</span>
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

          <div className="space-y-4">
            <ControlBar betAmount={betAmount} setBetAmount={setBetAmount} onSpin={handleSpin} spinning={spinning} disabled={!user}
              gameTheme="space" spinLabel={`⭐ SPIN - $${parseFloat(betAmount).toFixed(2)}`} />

            <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-white mb-3">Game Features</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between"><span>Grid</span><span className="text-white">5×3</span></div>
                <div className="flex justify-between"><span>Pay Direction</span><span className="text-cyan-400">Both Ways</span></div>
                <div className="flex justify-between"><span>Mechanic</span><span className="text-cyan-400">Quantum Wilds</span></div>
                <div className="flex justify-between"><span>RTP</span><span className="text-white">96.00%</span></div>
                <div className="flex justify-between"><span>Wild Feature</span><span className="text-cyan-400">3 charges = guaranteed win</span></div>
                <div className="flex justify-between"><span>Max Win</span><span className="text-yellow-400">5,000x</span></div>
              </div>
            </div>

            {/* Quantum Wild Meter */}
            <div className="bg-[#131B2C] rounded-xl border border-cyan-500/20 p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">⚡ Quantum Wild Meter</h3>
              <div className="flex items-center gap-3 justify-center">
                {[1, 2, 3].map((level) => (
                  <div key={level} className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500
                    ${quantumCharges >= level
                      ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.5)]"
                      : "border-gray-700 bg-gray-800/50"
                    }`}>
                    <span className={`text-lg ${quantumCharges >= level ? "text-cyan-300" : "text-gray-600"}`}>⚡</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                {quantumCharges === 0 ? "Land wilds to charge" : quantumCharges < 3 ? `${3 - quantumCharges} more to guaranteed win` : "GUARANTEED WIN NEXT!"}
              </p>
            </div>

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
