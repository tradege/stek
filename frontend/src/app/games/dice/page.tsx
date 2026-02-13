"use client";
import ErrorBoundary from "@/components/ErrorBoundary";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import { motion, AnimatePresence } from "framer-motion";
import config from '@/config/api';

const API_URL = config.apiUrl;

interface DiceResult {
  roll: number;
  target: number;
  condition: "OVER" | "UNDER";
  isWin: boolean;
  multiplier: number;
  winChance: number;
  payout: number;
  profit: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface BetHistoryItem {
  id: string;
  betAmount: string;
  multiplier: string;
  payout: string;
  profit: string;
  isWin: boolean;
  gameData: { roll: number; target: number; condition: string };
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

export default function DicePage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  const [loading, setLoading] = useState(false);
  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [target, setTarget] = useState<number>(50);
  const [condition, setCondition] = useState<"OVER" | "UNDER">("UNDER");
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animatedRoll, setAnimatedRoll] = useState<number>(50);
  const [showResult, setShowResult] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState<string>("10");
  const [autoBetRemaining, setAutoBetRemaining] = useState(0);
  const autoBetRef = useRef(false);

  const rollSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const loseSoundRef = useRef<HTMLAudioElement | null>(null);

  const winChance = condition === "UNDER" ? target : 100 - target;
  const multiplier = winChance > 0 && winChance < 100
    ? Math.floor(((100 * 0.96) / winChance) * 10000) / 10000
    : 0;

  useEffect(() => {
    rollSoundRef.current = new Audio("/sounds/dice-roll.mp3");
    winSoundRef.current = new Audio("/sounds/win.mp3");
    loseSoundRef.current = new Audio("/sounds/lose.mp3");
  }, []);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (isSoundActive && sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/dice/history?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {}
  };

  const animateRoll = (finalRoll: number) => {
    const duration = 800;
    const start = Date.now();
    const startVal = Math.random() * 100;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        const jitter = (1 - progress) * (Math.random() * 100);
        setAnimatedRoll(Math.round((startVal + (finalRoll - startVal) * eased + jitter * (1 - eased)) % 100 * 100) / 100);
        requestAnimationFrame(animate);
      } else {
        setAnimatedRoll(finalRoll);
        setShowResult(true);
      }
    };
    requestAnimationFrame(animate);
  };

  const placeBet = useCallback(async () => {
    if (!user) { setError("Please login to play"); return; }
    if (isRolling) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { setError("Invalid bet amount"); return; }
    setIsRolling(true);
    setError(null);
    setShowResult(false);
    playSound(rollSoundRef.current);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/dice/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: amount, target, condition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to place bet");
      animateRoll(data.roll);
      setTimeout(() => {
        setLastResult(data);
        if (data.isWin) {
          playSound(winSoundRef.current);
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 500);
        } else {
          playSound(loseSoundRef.current);
        }
        refreshUser();
        loadHistory();
      }, 850);
    } catch (err: any) {
      setError(err.message);
      setShowResult(false);
    } finally {
      setTimeout(() => setIsRolling(false), 900);
    }
  }, [user, betAmount, target, condition, isRolling, isSoundActive]);

  useEffect(() => {
    if (!autoBetActive) { autoBetRef.current = false; return; }
    autoBetRef.current = true;
    const remaining = parseInt(autoBetCount) || 10;
    setAutoBetRemaining(remaining);
    const runAutoBet = async (count: number) => {
      if (!autoBetRef.current || count <= 0) { setAutoBetActive(false); return; }
      setAutoBetRemaining(count);
      await placeBet();
      setTimeout(() => runAutoBet(count - 1), 1500);
    };
    runAutoBet(remaining);
  }, [autoBetActive]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isRolling && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        placeBet();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [placeBet]);

  const getSliderGradient = () => {
    if (condition === "UNDER") {
      return `linear-gradient(to right, #00E701 0%, #00E701 ${target}%, #FF4444 ${target}%, #FF4444 100%)`;
    }
    return `linear-gradient(to right, #FF4444 0%, #FF4444 ${target}%, #00E701 ${target}%, #00E701 100%)`;
  };

  const rollIndicatorPosition = lastResult ? `${lastResult.roll}%` : `${animatedRoll}%`;

  return (
    <ErrorBoundary gameName="Dice">
    <motion.div
      className="min-h-screen text-white relative overflow-hidden"
      animate={screenShake ? { x: [0, -5, 5, -3, 3, 0], y: [0, 3, -3, 2, -2, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {/* Premium Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0e17] via-[#0f1923] to-[#0d1520] -z-10" />
      <div className="fixed inset-0 -z-10 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-primary/10 rounded-full blur-[120px]" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 -z-5 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-accent-primary/20 rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        {/* Left Panel - Betting Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Game Title */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-primary/20">
                🎲
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Dice</h1>
                <p className="text-xs text-gray-400">Provably Fair | 4% House Edge</p>
              </div>
            </div>
          </div>

          {/* Betting Chips */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <label className="text-sm text-gray-400 mb-3 block font-medium">Bet Amount</label>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg pl-7 pr-3 py-2.5 text-white font-mono focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 focus:outline-none transition-all"
                  min="0.01"
                  step="0.01"
                  disabled={isRolling}
                />
              </div>
              <button onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))} className="px-3 py-2.5 bg-[#2f4553]/80 rounded-lg text-sm hover:bg-[#3d5a6e] transition-all border border-[#2f4553]">½</button>
              <button onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))} className="px-3 py-2.5 bg-[#2f4553]/80 rounded-lg text-sm hover:bg-[#3d5a6e] transition-all border border-[#2f4553]">2×</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHIP_VALUES.map((val) => (
                <motion.button
                  key={val}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setBetAmount(val.toFixed(2))}
                  className={`w-11 h-11 rounded-full bg-gradient-to-b ${CHIP_COLORS[val]} text-white text-xs font-bold shadow-lg border-2 border-white/20 flex items-center justify-center hover:shadow-xl transition-shadow`}
                >
                  {val}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Condition Toggle */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <label className="text-sm text-gray-400 mb-2 block font-medium">Roll Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setCondition("UNDER")}
                className={`py-2.5 rounded-lg font-bold transition-all ${
                  condition === "UNDER"
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
                    : "bg-[#0f1923] text-gray-400 hover:text-white border border-[#2f4553]"
                }`}
              >
                ⬇ Under
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setCondition("OVER")}
                className={`py-2.5 rounded-lg font-bold transition-all ${
                  condition === "OVER"
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
                    : "bg-[#0f1923] text-gray-400 hover:text-white border border-[#2f4553]"
                }`}
              >
                ⬆ Over
              </motion.button>
            </div>
          </div>

          {/* Target / Win Chance / Multiplier */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4 space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block font-medium">Target</label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(Math.min(99.98, Math.max(0.01, parseFloat(e.target.value) || 50)))}
                className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2.5 text-white font-mono focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 focus:outline-none transition-all"
                min="0.01"
                max="99.98"
                step="1"
                disabled={isRolling}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f1923]/80 rounded-lg p-3 border border-[#2f4553]/50">
                <label className="text-xs text-gray-500 mb-1 block">Win Chance</label>
                <div className="text-accent-primary font-mono font-bold text-lg">{winChance.toFixed(2)}%</div>
              </div>
              <div className="bg-[#0f1923]/80 rounded-lg p-3 border border-[#2f4553]/50">
                <label className="text-xs text-gray-500 mb-1 block">Multiplier</label>
                <div className="text-yellow-400 font-mono font-bold text-lg">{multiplier.toFixed(4)}×</div>
              </div>
            </div>
          </div>

          {/* Roll Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={placeBet}
            disabled={isRolling || !user}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all relative overflow-hidden ${
              isRolling
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-primary to-blue-600 hover:from-primary hover:to-blue-500 shadow-lg shadow-primary/30"
            }`}
          >
            {isRolling ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Rolling...
              </span>
            ) : user ? (
              "🎲 Roll Dice"
            ) : (
              "Login to Play"
            )}
          </motion.button>

          {/* Auto-bet */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400 font-medium">Auto Bet</label>
              {autoBetActive && (
                <span className="text-xs text-yellow-400 animate-pulse">{autoBetRemaining} remaining</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={autoBetCount}
                onChange={(e) => setAutoBetCount(e.target.value)}
                className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-accent-primary focus:outline-none"
                min="1"
                max="1000"
                disabled={autoBetActive}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setAutoBetActive(!autoBetActive)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  autoBetActive
                    ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20"
                    : "bg-[#2f4553] hover:bg-[#3d5a6e] border border-[#2f4553]"
                }`}
              >
                {autoBetActive ? "Stop" : "Start"}
              </motion.button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </div>

        {/* Right Panel - Game Display */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dice Roll Display */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-6 relative overflow-hidden">
            {/* Ambient glow behind number */}
            <AnimatePresence>
              {showResult && lastResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 0.3, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[60px] ${
                    lastResult.isWin ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              )}
            </AnimatePresence>

            {/* Roll Number Display */}
            <div className="text-center mb-6 relative z-10">
              <motion.div
                key={animatedRoll}
                animate={isRolling ? { scale: [1, 1.05, 1], rotateZ: [0, 2, -2, 0] } : {}}
                transition={{ duration: 0.15, repeat: isRolling ? Infinity : 0 }}
                className={`text-8xl font-black font-mono transition-colors duration-300 ${
                  showResult && lastResult
                    ? lastResult.isWin
                      ? "text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.5)]"
                      : "text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.5)]"
                    : "text-white"
                }`}
              >
                {animatedRoll.toFixed(2)}
              </motion.div>

              <AnimatePresence>
                {showResult && lastResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`mt-3 text-xl font-bold ${lastResult.isWin ? "text-green-400" : "text-red-400"}`}
                  >
                    {lastResult.isWin ? (
                      <span className="flex items-center justify-center gap-2">
                        🎉 +${lastResult.profit.toFixed(2)} ({lastResult.multiplier}×)
                      </span>
                    ) : (
                      <span>-${Math.abs(lastResult.profit).toFixed(2)}</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Slider */}
            <div className="relative mb-4">
              <div className="h-4 rounded-full relative overflow-hidden shadow-inner" style={{ background: getSliderGradient() }}>
                {(showResult || isRolling) && (
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-gray-800 shadow-lg z-10"
                    style={{ left: rollIndicatorPosition, transform: "translate(-50%, -50%)" }}
                    animate={showResult && lastResult ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </div>
              <input
                type="range"
                min="1"
                max="99"
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                disabled={isRolling}
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center border border-[#2f4553]/30">
                <div className="text-xs text-gray-500 mb-1">Profit on Win</div>
                <div className="text-green-400 font-mono font-bold text-lg">
                  ${((parseFloat(betAmount) || 0) * multiplier - (parseFloat(betAmount) || 0)).toFixed(2)}
                </div>
              </div>
              <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center border border-[#2f4553]/30">
                <div className="text-xs text-gray-500 mb-1">Win Chance</div>
                <div className="text-accent-primary font-mono font-bold text-lg">{winChance.toFixed(2)}%</div>
              </div>
              <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center border border-[#2f4553]/30">
                <div className="text-xs text-gray-500 mb-1">Multiplier</div>
                <div className="text-yellow-400 font-mono font-bold text-lg">{multiplier.toFixed(4)}×</div>
              </div>
            </div>
          </div>

          {/* Provably Fair */}
          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-sm font-bold text-white">Provably Fair</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#0f1923]/60 rounded-lg p-2">
                    <span className="text-gray-500">Server Seed Hash</span>
                    <div className="font-mono text-gray-300 truncate mt-1">{lastResult.serverSeedHash}</div>
                  </div>
                  <div className="bg-[#0f1923]/60 rounded-lg p-2">
                    <span className="text-gray-500">Client Seed</span>
                    <div className="font-mono text-gray-300 truncate mt-1">{lastResult.clientSeed}</div>
                  </div>
                  <div className="bg-[#0f1923]/60 rounded-lg p-2">
                    <span className="text-gray-500">Nonce</span>
                    <div className="font-mono text-gray-300 mt-1">{lastResult.nonce}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet History */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
              Recent Bets
            </h3>
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-3xl mb-2">🎲</div>
                <p>No bets yet. Roll the dice!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-[#2f4553]/50">
                      <th className="text-left py-2 font-medium">Roll</th>
                      <th className="text-left py-2 font-medium">Target</th>
                      <th className="text-right py-2 font-medium">Bet</th>
                      <th className="text-right py-2 font-medium">Multi</th>
                      <th className="text-right py-2 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 10).map((bet, idx) => (
                      <motion.tr
                        key={bet.id}
                        initial={idx === 0 ? { opacity: 0, x: -20 } : {}}
                        animate={{ opacity: 1, x: 0 }}
                        className="border-b border-[#2f4553]/30 hover:bg-[#2f4553]/10 transition-colors"
                      >
                        <td className={`py-2.5 font-mono font-bold ${bet.isWin ? "text-green-400" : "text-red-400"}`}>
                          {bet.gameData?.roll?.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-gray-400 font-mono">
                          {bet.gameData?.condition === "UNDER" ? "< " : "> "}{bet.gameData?.target}
                        </td>
                        <td className="py-2.5 text-right text-gray-300 font-mono">${parseFloat(bet.betAmount).toFixed(2)}</td>
                        <td className="py-2.5 text-right text-accent-primary font-mono">{parseFloat(bet.multiplier).toFixed(2)}×</td>
                        <td className={`py-2.5 text-right font-mono font-bold ${bet.isWin ? "text-green-400" : "text-red-400"}`}>
                          {bet.isWin ? "+" : ""}${parseFloat(bet.profit).toFixed(2)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
    </ErrorBoundary>
  );
}
