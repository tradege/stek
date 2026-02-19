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
  explorer: { emoji: "🧔", label: "Explorer", color: "#FFD700", tier: "premium" },
  pharaoh:  { emoji: "👑", label: "Pharaoh",  color: "#FFD700", tier: "premium" },
  anubis:   { emoji: "🐺", label: "Anubis",   color: "#8B4513", tier: "premium" },
  scarab:   { emoji: "🪲", label: "Scarab",   color: "#00E5FF", tier: "mid" },
  ace:      { emoji: "🅰️", label: "Ace",      color: "#FF6D00", tier: "mid" },
  king:     { emoji: "🔷", label: "King",     color: "#4169E1", tier: "low" },
  queen:    { emoji: "🔶", label: "Queen",    color: "#FF8C00", tier: "low" },
  jack:     { emoji: "🟢", label: "Jack",     color: "#32CD32", tier: "low" },
  ten:      { emoji: "🔟", label: "Ten",      color: "#8B7355", tier: "low" },
  book:     { emoji: "📖", label: "Book",     color: "#FFD700", tier: "special" },
  scatter:  { emoji: "📖", label: "Book",     color: "#FFD700", tier: "special" },
  wild:     { emoji: "⭐", label: "Wild",     color: "#FFD700", tier: "special" },
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

export default function BookOfDeadPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [riskLevel, setRiskLevel] = useState<"NORMAL" | "EXTREME">("NORMAL");
  const [displayGrid, setDisplayGrid] = useState<GridCell[]>([]);
  const [winPositions, setWinPositions] = useState<Set<number>>(new Set());
  const [lastResult, setLastResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalWinDisplay, setTotalWinDisplay] = useState<number>(0);
  const [showBigWin, setShowBigWin] = useState(false);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [bigWinMultiplier, setBigWinMultiplier] = useState(0);
  const [expandingSymbol, setExpandingSymbol] = useState<string | null>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [showProvably, setShowProvably] = useState(false);
  const [freeSpinSession, setFreeSpinSession] = useState(false);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const [showGoldFlash, setShowGoldFlash] = useState(false);
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
    fetch(`${API_URL}/api/slots/history?gameMode=BOOK_OF_DEAD&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
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
    setExpandingSymbol(null);
    setShowGoldFlash(false);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/slots/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameMode: "BOOK_OF_DEAD", betAmount: freeSpinSession ? 0 : bet, riskLevel }),
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

          // Gold Flash for expanding symbol
          const expandFeature = data.features?.find((f: any) => f.type === "expanding_symbol");
          if (expandFeature) {
            setExpandingSymbol(expandFeature.symbol);
            setShowGoldFlash(true);
            setTimeout(() => setShowGoldFlash(false), 1500);
          }

          if (data.multiplier >= 10) {
            setBigWinAmount(data.totalPayout);
            setBigWinMultiplier(data.multiplier);
            setShowBigWin(true);
          }
        }

        if (data.freeSpins?.triggered) {
          setFreeSpinSession(true);
          setFreeSpinsRemaining(riskLevel === "EXTREME" ? 5 : 10);
          setFreeSpinsTotalWin(0);
        } else if (freeSpinSession) {
          setFreeSpinsRemaining(prev => prev - 1);
          setFreeSpinsTotalWin(prev => prev + (data.totalPayout || 0));
          if (freeSpinsRemaining <= 1) setFreeSpinSession(false);
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
  }, [user, betAmount, riskLevel, freeSpinSession, freeSpinsRemaining, getBalance, refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
        <div className="text-center"><div className="text-6xl mb-4 animate-bounce">📖</div><div className="text-white font-bold">Loading Book of Dead...</div></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">&larr; Back</Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                📖 Book of Dead
                <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold">EXPANDING</span>
              </h1>
              <p className="text-sm text-gray-400">5x3 • 10 Paylines • Expanding Symbols • 96% RTP</p>
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
          <div className="bg-[#131B2C] rounded-xl border border-yellow-600/20 p-6 mb-6">
            <h3 className="text-lg font-bold text-yellow-400 mb-4">Paytable - 10 Paylines</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(SYMBOL_CONFIG).filter(([k]) => k !== "scatter" && k !== "wild").map(([key, cfg]) => (
                <div key={key} className="bg-[#0A0E17] rounded-lg p-3 border border-yellow-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${cfg.color}60)` }}>{cfg.emoji}</span>
                    <span className="text-sm text-white font-bold">{cfg.label}</span>
                  </div>
                  <div className="text-xs text-gray-400">3+ on payline</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-[#0A0E17] rounded-lg border border-yellow-500/30">
              <span className="text-2xl">📖</span>
              <span className="text-sm text-yellow-400 font-bold ml-2">Book of Dead (Scatter + Wild)</span>
              <div className="text-xs text-gray-400 mt-1">3+ triggers Free Spins with Expanding Symbol</div>
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
            <SlotFrame spinning={spinning} isWin={totalWinDisplay > 0} isBigWin={showBigWin} gameName="Book of Dead" gameTheme="egypt">
              <BigWinPopup show={showBigWin} amount={bigWinAmount} multiplier={bigWinMultiplier} onClose={() => setShowBigWin(false)} gameTheme="egypt" />

              {/* Gold Flash Overlay */}
              {showGoldFlash && (
                <div className="absolute inset-0 z-30 pointer-events-none rounded-2xl animate-pulse" style={{ background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)" }} />
              )}

              {expandingSymbol && (
                <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-yellow-600 to-amber-500 rounded-full px-4 py-1 text-white font-bold text-sm">
                  {SYMBOL_CONFIG[expandingSymbol]?.emoji} EXPANDING
                </div>
              )}

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {displayGrid.map((cell, index) => {
                  const isWinning = winPositions.has(cell.position);
                  const symbolCfg = SYMBOL_CONFIG[cell.symbol] || { emoji: "?", label: "?", color: "#888", tier: "low" };
                  const isExpanding = expandingSymbol === cell.symbol;
                  return (
                    <ErrorBoundary key={index} gameName="BookOfDead">
                      <ReelCell
                        symbol={cell.symbol}
                        emoji={symbolCfg.emoji}
                        color={symbolCfg.color}
                        tier={isExpanding ? "special" : symbolCfg.tier}
                        isWinning={isWinning || isExpanding}
                        spinning={spinning}
                        index={index}
                        cols={GRID_COLS}
                        gameTheme="egypt"
                      />
                    </ErrorBoundary>
                  );
                })}
              </div>

              {totalWinDisplay > 0 && !showBigWin && (
                <div className="mt-3 text-center py-2 bg-gradient-to-r from-yellow-600/20 via-yellow-500/30 to-yellow-600/20 rounded-lg border border-yellow-500/30">
                  <span className="text-yellow-400 font-bold text-lg">WIN: ${totalWinDisplay.toFixed(2)}</span>
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
            {freeSpinSession && (
              <div className="bg-[#131B2C] rounded-xl border border-yellow-500/40 p-4">
                <div className="text-center">
                  <div className="text-2xl mb-1">📖</div>
                  <div className="text-lg font-bold text-yellow-400">FREE SPINS!</div>
                  <div className="text-sm text-gray-400 mt-1">Mode: {riskLevel}</div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><div className="text-gray-400 text-xs">Remaining</div><div className="text-yellow-400 font-bold text-lg">{freeSpinsRemaining}</div></div>
                    <div><div className="text-gray-400 text-xs">Total Win</div><div className="text-green-400 font-bold text-lg">${freeSpinsTotalWin.toFixed(2)}</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Selector */}
            {!freeSpinSession && (
              <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
                <label className="text-sm text-gray-400 mb-2 block font-medium tracking-wide uppercase">Risk Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRiskLevel("NORMAL")}
                    className={`py-3 rounded-lg text-sm font-bold border-2 transition-all ${riskLevel === "NORMAL" ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-white/10 text-gray-400 hover:border-white/20"}`}>
                    <div>Normal</div>
                    <div className="text-xs text-gray-500 mt-1">10 Spins • 1 Symbol</div>
                  </button>
                  <button onClick={() => setRiskLevel("EXTREME")}
                    className={`py-3 rounded-lg text-sm font-bold border-2 transition-all ${riskLevel === "EXTREME" ? "border-red-500 bg-red-500/10 text-red-400" : "border-white/10 text-gray-400 hover:border-white/20"}`}>
                    <div>Extreme</div>
                    <div className="text-xs text-gray-500 mt-1">5 Spins • 2 Symbols</div>
                  </button>
                </div>
              </div>
            )}

            <ControlBar betAmount={betAmount} setBetAmount={setBetAmount} onSpin={handleSpin} spinning={spinning} disabled={!user}
              freeSpinSession={freeSpinSession} freeSpinsRemaining={freeSpinsRemaining} gameTheme="egypt" spinLabel={`📖 SPIN - $${parseFloat(betAmount).toFixed(2)}`} />

            <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-white mb-3">Game Features</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between"><span>Grid</span><span className="text-white">5×3</span></div>
                <div className="flex justify-between"><span>Paylines</span><span className="text-white">10</span></div>
                <div className="flex justify-between"><span>Mechanic</span><span className="text-yellow-400">Expanding Symbols</span></div>
                <div className="flex justify-between"><span>RTP</span><span className="text-white">96.00%</span></div>
                <div className="flex justify-between"><span>Risk Modes</span><span className="text-yellow-400">Normal / Extreme</span></div>
                <div className="flex justify-between"><span>Max Win</span><span className="text-yellow-400">5,000x</span></div>
              </div>
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
