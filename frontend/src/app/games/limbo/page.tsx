"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import config from "@/config/api";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = config.apiUrl;

interface LimboResult {
  resultMultiplier: number;
  targetMultiplier: number;
  isWin: boolean;
  winChance: number;
  multiplier: number;
  payout: number;
  profit: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface BetHistory {
  id: string;
  betAmount: string;
  multiplier: string;
  profit: string;
  isWin: boolean;
  gameData: any;
  createdAt: string;
}

const CHIP_VALUES = [0.5, 1, 5, 10, 25, 50, 100];
const CHIP_COLORS: Record<number, string> = {
  0.5: "from-gray-500 to-gray-600",
  1: "from-blue-500 to-blue-600",
  5: "from-red-500 to-red-600",
  10: "from-orange-500 to-orange-600",
  25: "from-green-500 to-green-600",
  50: "from-purple-500 to-purple-600",
  100: "from-yellow-500 to-yellow-600",
};

function ConfettiPiece({ delay }: { delay: number }) {
  const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FF69B4", "#00F0FF", "#A855F7"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const x = Math.random() * 100;
  const rotation = Math.random() * 720 - 360;
  const size = Math.random() * 8 + 4;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: "-5%", width: size, height: size * 1.5, backgroundColor: color, borderRadius: "2px" }}
      initial={{ y: 0, rotate: 0, opacity: 1 }}
      animate={{ y: "110vh", rotate: rotation, opacity: [1, 1, 0] }}
      transition={{ duration: 2.5 + Math.random() * 1.5, delay, ease: "easeIn" }}
    />
  );
}

export default function LimboPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [targetMultiplier, setTargetMultiplier] = useState<string>("2.00");
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<LimboResult | null>(null);
  const [displayMultiplier, setDisplayMultiplier] = useState<number>(1.0);
  const [animPhase, setAnimPhase] = useState<"idle" | "counting" | "result">("idle");
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const animRef = useRef<number | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const loseSoundRef = useRef<HTMLAudioElement | null>(null);
  const tickSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    winSoundRef.current = new Audio("/sounds/win.mp3");
    loseSoundRef.current = new Audio("/sounds/bomb.mp3");
    tickSoundRef.current = new Audio("/sounds/gem.mp3");
  }, []);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (isSoundActive && sound) { sound.currentTime = 0; sound.play().catch(() => {}); }
  };

  const getToken = () => localStorage.getItem("auth_token");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/limbo/history?limit=15`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, []);

  useEffect(() => { if (user) fetchHistory(); }, [user, fetchHistory]);

  const animateCounter = (finalValue: number, target: number) => {
    const startTime = Date.now();
    const duration = 1500;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = 1 + (finalValue - 1) * eased;
      setDisplayMultiplier(parseFloat(current.toFixed(2)));
      if (progress < 1) { animRef.current = requestAnimationFrame(tick); }
      else { setDisplayMultiplier(finalValue); setAnimPhase("result"); }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const handleBet = async () => {
    if (isPlaying) return;
    setError(null); setIsPlaying(true); setResult(null); setShowConfetti(false);
    setAnimPhase("counting"); setDisplayMultiplier(1.0);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    try {
      const res = await fetch(`${API_URL}/limbo/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ betAmount: parseFloat(betAmount), targetMultiplier: parseFloat(targetMultiplier) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to play"); }
      const data: LimboResult = await res.json();
      setResult(data);
      animateCounter(data.resultMultiplier, data.targetMultiplier);
      setTimeout(() => {
        if (data.isWin) { playSound(winSoundRef.current); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 4000); }
        else { playSound(loseSoundRef.current); }
        refreshUser(); fetchHistory(); setIsPlaying(false);
      }, 1700);
    } catch (err: any) { setError(err.message); setAnimPhase("idle"); setIsPlaying(false); }
  };

  const balance = parseFloat(user?.balance?.find((b: any) => b.currency === "USDT")?.available || "0");
  const target = parseFloat(targetMultiplier) || 2;
  const winChance = Math.min(99, (1 / target) * 100);
  const potentialProfit = parseFloat(betAmount) * target - parseFloat(betAmount);
  const quickTargets = [1.5, 2, 3, 5, 10, 50, 100, 1000];

  const getCounterColor = () => {
    if (animPhase === "idle") return "text-white";
    if (animPhase === "counting") return "text-cyan-400";
    if (result?.isWin) return "text-green-400";
    return "text-red-500";
  };

  const getGlowColor = () => {
    if (animPhase === "result" && result?.isWin) return "shadow-[0_0_80px_rgba(34,197,94,0.3)]";
    if (animPhase === "result" && !result?.isWin) return "shadow-[0_0_80px_rgba(239,68,68,0.2)]";
    if (animPhase === "counting") return "shadow-[0_0_60px_rgba(0,240,255,0.2)]";
    return "";
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Premium Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#08061a] via-[#0d0a25] to-[#120e2e] -z-10" />
      <div className="fixed inset-0 -z-10 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[180px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 -z-5 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -40, 0], opacity: [0.1, 0.5, 0.1] }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            {Array.from({ length: 80 }).map((_, i) => (
              <ConfettiPiece key={i} delay={Math.random() * 0.5} />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-4">
            {/* Game Title */}
            <div className="bg-[#1a1040]/80 backdrop-blur-sm rounded-xl border border-purple-900/40 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xl shadow-lg shadow-purple-500/20">
                  🚀
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">Limbo</h1>
                  <p className="text-xs text-gray-400">Provably Fair | 4% House Edge</p>
                </div>
              </div>
            </div>

            {/* Bet Amount with Chips */}
            <div className="bg-[#1a1040]/80 backdrop-blur-sm rounded-xl border border-purple-900/40 p-4">
              <label className="text-xs text-gray-400 mb-2 block font-medium">Bet Amount</label>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full bg-[#0f0a2a] border border-purple-900/40 rounded-lg pl-7 pr-3 py-2.5 text-white font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                    min="0.10" step="0.10" disabled={isPlaying}
                  />
                </div>
                <button onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))} className="px-3 py-2.5 bg-purple-900/40 rounded-lg text-sm hover:bg-purple-800/50 transition-all border border-purple-800/30" disabled={isPlaying}>½</button>
                <button onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))} className="px-3 py-2.5 bg-purple-900/40 rounded-lg text-sm hover:bg-purple-800/50 transition-all border border-purple-800/30" disabled={isPlaying}>2×</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHIP_VALUES.map((val) => (
                  <motion.button
                    key={val}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => !isPlaying && setBetAmount(val.toFixed(2))}
                    disabled={isPlaying}
                    className={`w-11 h-11 rounded-full bg-gradient-to-b ${CHIP_COLORS[val]} text-white text-xs font-bold shadow-lg border-2 border-white/20 flex items-center justify-center hover:shadow-xl transition-shadow ${isPlaying ? 'opacity-50' : ''}`}
                  >
                    {val}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Target Multiplier */}
            <div className="bg-[#1a1040]/80 backdrop-blur-sm rounded-xl border border-purple-900/40 p-4">
              <label className="text-xs text-gray-400 mb-2 block font-medium">Target Multiplier</label>
              <div className="relative">
                <input
                  type="number"
                  value={targetMultiplier}
                  onChange={(e) => setTargetMultiplier(e.target.value)}
                  className="w-full bg-[#0f0a2a] border border-purple-900/40 rounded-lg px-3 py-2.5 pr-8 text-white font-mono text-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  min="1.01" max="10000" step="0.01" disabled={isPlaying}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 font-bold">×</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {quickTargets.map((t) => (
                  <motion.button
                    key={t}
                    onClick={() => setTargetMultiplier(t.toFixed(2))}
                    disabled={isPlaying}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      parseFloat(targetMultiplier) === t
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                        : "bg-[#0f0a2a] text-gray-400 hover:text-white border border-purple-900/30 hover:border-purple-600/50"
                    }`}
                  >
                    {t}×
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[#1a1040]/80 backdrop-blur-sm rounded-xl border border-purple-900/40 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f0a2a]/80 rounded-lg p-3 text-center border border-purple-900/20">
                  <div className="text-xs text-gray-500">Win Chance</div>
                  <div className="text-green-400 font-bold text-lg">{winChance.toFixed(2)}%</div>
                </div>
                <div className="bg-[#0f0a2a]/80 rounded-lg p-3 text-center border border-purple-900/20">
                  <div className="text-xs text-gray-500">Profit on Win</div>
                  <div className="text-cyan-400 font-bold text-lg">${potentialProfit.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Bet Button */}
            <motion.button
              onClick={handleBet}
              disabled={isPlaying || !betAmount || parseFloat(betAmount) <= 0}
              whileHover={{ scale: isPlaying ? 1 : 1.02 }}
              whileTap={{ scale: isPlaying ? 1 : 0.98 }}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                isPlaying
                  ? "bg-purple-900/40 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
              }`}
            >
              {isPlaying ? (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  🚀 Flying...
                </motion.span>
              ) : (
                "🚀 BET"
              )}
            </motion.button>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
                >{error}</motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center - Main Display */}
          <div className="lg:col-span-2">
            <div className={`bg-gradient-to-b from-[#1a1040]/90 via-[#0f0a2a]/90 to-[#1a1040]/90 backdrop-blur-sm rounded-2xl border-2 border-purple-900/50 p-8 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden transition-shadow duration-500 ${getGlowColor()}`}>
              {/* Background particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 25 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
                    style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                    animate={{ y: [0, -30, 0], opacity: [0.1, 0.5, 0.1], scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 3 + Math.random() * 3, delay: Math.random() * 2 }}
                  />
                ))}
              </div>

              {/* Target line */}
              <div className="absolute top-6 right-6 text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Target</div>
                <div className="text-purple-400 font-mono font-bold text-xl">{target.toFixed(2)}×</div>
              </div>

              {/* Main Counter */}
              <motion.div
                className={`font-mono font-black text-center relative z-10 ${getCounterColor()}`}
                style={{ fontSize: "clamp(4rem, 12vw, 8rem)", textShadow: animPhase === "result" && result?.isWin ? "0 0 40px rgba(34,197,94,0.4)" : animPhase === "result" ? "0 0 40px rgba(239,68,68,0.3)" : "none" }}
                animate={
                  animPhase === "result" && result
                    ? result.isWin ? { scale: [1, 1.15, 1] } : { x: [0, -10, 10, -10, 10, 0] }
                    : {}
                }
                transition={result?.isWin ? { repeat: 2, duration: 0.5 } : { duration: 0.4 }}
              >
                {displayMultiplier.toFixed(2)}×
              </motion.div>

              {/* Result Label */}
              <AnimatePresence>
                {animPhase === "result" && result && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-center">
                    {result.isWin ? (
                      <div>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.5 }} className="text-green-400 font-bold text-2xl">YOU WIN!</motion.div>
                        <motion.div className="text-green-300 font-mono text-xl mt-1" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                          +${result.profit.toFixed(2)}
                        </motion.div>
                      </div>
                    ) : (
                      <div>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} className="text-red-400 font-bold text-2xl">CRASHED</motion.div>
                        <div className="text-gray-400 text-sm mt-1">
                          Needed {result.targetMultiplier.toFixed(2)}× | Got {result.resultMultiplier.toFixed(2)}×
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {animPhase === "idle" && !result && (
                <motion.div className="mt-4 text-gray-500 text-sm" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 3 }}>
                  Set your target and bet to launch
                </motion.div>
              )}
            </div>

            {/* Recent Results Strip */}
            {history.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {history.slice(0, 15).map((bet) => {
                  const mult = bet.gameData?.resultMultiplier || parseFloat(bet.multiplier);
                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold font-mono ${
                        bet.isWin ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400/70 border border-red-500/20"
                      }`}
                    >
                      {typeof mult === "number" ? mult.toFixed(2) : parseFloat(String(mult)).toFixed(2)}×
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* History Table */}
            <div className="mt-4 bg-[#1a1040]/80 backdrop-blur-sm rounded-xl border border-purple-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-purple-900/30">
                <h3 className="font-semibold text-sm text-gray-300">Recent Bets</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-purple-900/30">
                      <th className="px-4 py-2 text-left">Target</th>
                      <th className="px-4 py-2 text-left">Result</th>
                      <th className="px-4 py-2 text-right">Bet</th>
                      <th className="px-4 py-2 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No bets yet</td></tr>
                    ) : (
                      history.map((bet) => {
                        const profit = parseFloat(bet.profit);
                        const t = bet.gameData?.targetMultiplier;
                        const r = bet.gameData?.resultMultiplier;
                        return (
                          <tr key={bet.id} className="border-b border-purple-900/20 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2 font-mono text-purple-400">{t ? `${parseFloat(t).toFixed(2)}×` : "-"}</td>
                            <td className="px-4 py-2"><span className={`font-mono font-bold ${bet.isWin ? "text-green-400" : "text-red-400"}`}>{r ? `${parseFloat(r).toFixed(2)}×` : "-"}</span></td>
                            <td className="px-4 py-2 text-right font-mono">${parseFloat(bet.betAmount).toFixed(2)}</td>
                            <td className={`px-4 py-2 text-right font-mono font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{profit >= 0 ? "+" : ""}${profit.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
