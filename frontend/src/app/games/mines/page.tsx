"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import { motion, AnimatePresence } from "framer-motion";
import config from '@/config/api';

const API_URL = config.apiUrl;
const GRID_SIZE = 25;
const HOUSE_EDGE = 0.04;
const COEFFICIENT = 0.99;

interface MinesGameState {
  gameId: string;
  betAmount: number;
  mineCount: number;
  revealedTiles: number[];
  currentMultiplier: number;
  nextMultiplier: number;
  currentPayout: number;
  status: "ACTIVE" | "WON" | "LOST" | "NONE";
  minePositions?: number[];
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
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

/** Calculate the multiplier for a given mine count and revealed count (mirrors backend) */
function calcMultiplier(mineCount: number, revealedCount: number): number {
  if (revealedCount === 0) return 1;
  const safeTiles = GRID_SIZE - mineCount;
  if (revealedCount > safeTiles) return 0;
  let probability = 1;
  for (let i = 0; i < revealedCount; i++) {
    probability *= (safeTiles - i) / (GRID_SIZE - i);
  }
  if (probability <= 0) return 0;
  const multiplier = ((1 - HOUSE_EDGE) / probability) * COEFFICIENT;
  return Math.floor(multiplier * 10000) / 10000;
}

/** Build the full step-by-step stats table for a given mine count and bet */
function buildStatsTable(mineCount: number, bet: number) {
  const safeTiles = GRID_SIZE - mineCount;
  const rows: { step: number; multiplier: number; payout: number; profit: number; survivalChance: number }[] = [];
  let cumulativeProb = 1;
  for (let step = 1; step <= safeTiles; step++) {
    cumulativeProb *= (safeTiles - step + 1) / (GRID_SIZE - step + 1);
    const mult = calcMultiplier(mineCount, step);
    if (mult <= 0) break;
    const payout = Math.floor(bet * mult * 100) / 100;
    const profit = Math.floor((payout - bet) * 100) / 100;
    rows.push({
      step,
      multiplier: mult,
      payout,
      profit,
      survivalChance: cumulativeProb * 100,
    });
  }
  return rows;
}

export default function MinesPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [mineCount, setMineCount] = useState<number>(5);
  const [gameState, setGameState] = useState<MinesGameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedAnimation, setRevealedAnimation] = useState<Set<number>>(new Set());
  const [lastClickedTile, setLastClickedTile] = useState<number | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [showStatsTable, setShowStatsTable] = useState(false);

  const gemSoundRef = useRef<HTMLAudioElement | null>(null);
  const bombSoundRef = useRef<HTMLAudioElement | null>(null);
  const cashoutSoundRef = useRef<HTMLAudioElement | null>(null);

  // Compute stats table reactively based on mineCount and betAmount
  const statsTable = useMemo(() => {
    const bet = parseFloat(betAmount) || 1;
    return buildStatsTable(mineCount, bet);
  }, [mineCount, betAmount]);

  // Current step highlight (how many gems revealed so far)
  const currentStep = gameState?.status === "ACTIVE" ? gameState.revealedTiles.length : 0;

  useEffect(() => {
    gemSoundRef.current = new Audio("/sounds/gem.mp3");
    bombSoundRef.current = new Audio("/sounds/bomb.mp3");
    cashoutSoundRef.current = new Audio("/sounds/win.mp3");
  }, []);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (isSoundActive && sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (user) checkActiveGame();
  }, [user]);

  const getToken = () => localStorage.getItem('auth_token');

  const checkActiveGame = async () => {
    try {
      const res = await fetch(`${API_URL}/mines/active`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ACTIVE") {
          setGameState(data);
          setRevealedAnimation(new Set(data.revealedTiles));
        }
      }
    } catch {}
  };

  const startGame = async () => {
    if (!user || isLoading) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { setError("Invalid bet amount"); return; }
    setIsLoading(true);
    setError(null);
    setRevealedAnimation(new Set());
    setLastClickedTile(null);
    try {
      const res = await fetch(`${API_URL}/mines/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ betAmount: amount, mineCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start game");
      setGameState(data);
      refreshUser();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const revealTile = async (tileIndex: number) => {
    if (!gameState || gameState.status !== "ACTIVE" || isLoading) return;
    if (gameState.revealedTiles.includes(tileIndex)) return;
    setIsLoading(true);
    setLastClickedTile(tileIndex);
    try {
      const res = await fetch(`${API_URL}/mines/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ gameId: gameState.gameId, tileIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reveal tile");
      if (data.status === "LOST") {
        playSound(bombSoundRef.current);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 500);
        setRevealedAnimation(new Set([...gameState.revealedTiles, tileIndex]));
      } else {
        playSound(gemSoundRef.current);
        setRevealedAnimation(new Set(data.revealedTiles));
      }
      setGameState(data);
      if (data.status !== "ACTIVE") refreshUser();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const cashout = async () => {
    if (!gameState || gameState.status !== "ACTIVE" || isLoading) return;
    if (gameState.revealedTiles.length === 0) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/mines/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ gameId: gameState.gameId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cash out");
      playSound(cashoutSoundRef.current);
      setGameState(data);
      refreshUser();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getTileContent = (index: number) => {
    const isRevealed = gameState?.revealedTiles.includes(index);
    const isMine = gameState?.minePositions?.includes(index);
    const isGameOver = gameState?.status === "LOST" || gameState?.status === "WON";

    if (isRevealed && !isMine) {
      return { icon: "💎", bg: "bg-gradient-to-br from-emerald-600/40 to-green-700/40 border-emerald-400/60 shadow-[0_0_15px_rgba(52,211,153,0.3)]", text: "text-green-300", revealed: true };
    }
    if (isMine && isGameOver) {
      if (index === lastClickedTile) {
        return { icon: "💥", bg: "bg-gradient-to-br from-red-600/60 to-red-800/60 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]", text: "text-red-300", revealed: true };
      }
      return { icon: "💣", bg: "bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-500/40", text: "text-red-400", revealed: true };
    }
    if (isGameOver && !isRevealed && !isMine) {
      return { icon: "💎", bg: "bg-gray-800/30 border-gray-600/20", text: "text-gray-600", revealed: false };
    }
    return { icon: "", bg: "bg-gradient-to-br from-[#2a4a5e] to-[#1e3a4e] border-[#3d6a7e]/50 hover:from-[#3a5a6e] hover:to-[#2e4a5e] hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(0,240,255,0.15)] cursor-pointer", text: "", revealed: false };
  };

  const isGameActive = gameState?.status === "ACTIVE";
  const isGameOver = gameState?.status === "LOST" || gameState?.status === "WON";
  const canStart = !gameState || isGameOver;

  // Stats table scroll ref
  const statsScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (statsScrollRef.current && currentStep > 0) {
      const row = statsScrollRef.current.querySelector(`[data-step="${currentStep}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentStep]);

  return (
    <motion.div
      className="min-h-screen text-white relative overflow-hidden"
      animate={screenShake ? { x: [0, -8, 8, -5, 5, 0], y: [0, 5, -5, 3, -3, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {/* Premium Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#070d14] via-[#0c1620] to-[#0a1018] -z-10" />
      <div className="fixed inset-0 -z-10 opacity-20">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 -z-5 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-emerald-400/15 rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -40, 0], opacity: [0.1, 0.4, 0.1], scale: [1, 1.5, 1] }}
            transition={{ duration: 4 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 4 }}
          />
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Game Title */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
                💣
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">Mines</h1>
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
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg pl-7 pr-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 focus:outline-none transition-all"
                  min="0.01"
                  step="0.01"
                  disabled={isGameActive}
                />
              </div>
              <button onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))} className="px-3 py-2.5 bg-[#2f4553]/80 rounded-lg text-sm hover:bg-[#3d5a6e] transition-all border border-[#2f4553]" disabled={isGameActive}>½</button>
              <button onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))} className="px-3 py-2.5 bg-[#2f4553]/80 rounded-lg text-sm hover:bg-[#3d5a6e] transition-all border border-[#2f4553]" disabled={isGameActive}>2×</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHIP_VALUES.map((val) => (
                <motion.button
                  key={val}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => !isGameActive && setBetAmount(val.toFixed(2))}
                  disabled={isGameActive}
                  className={`w-11 h-11 rounded-full bg-gradient-to-b ${CHIP_COLORS[val]} text-white text-xs font-bold shadow-lg border-2 border-white/20 flex items-center justify-center hover:shadow-xl transition-shadow ${isGameActive ? 'opacity-50' : ''}`}
                >
                  {val}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Mine Count */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4">
            <label className="text-sm text-gray-400 mb-2 block font-medium">Mines: <span className="text-emerald-400 font-bold">{mineCount}</span></label>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 3, 5, 7, 10, 12, 15, 18, 20, 22, 23, 24].map((count) => (
                <motion.button
                  key={count}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setMineCount(count)}
                  disabled={isGameActive}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    mineCount === count
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-[#0f1923] text-gray-400 hover:text-white hover:bg-[#2f4553] border border-[#2f4553]/50"
                  }`}
                >
                  {count}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Game Info */}
          <AnimatePresence>
            {isGameActive && gameState && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-emerald-500/30 p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center border border-[#2f4553]/30">
                    <div className="text-xs text-gray-500 mb-1">Gems Found</div>
                    <div className="text-emerald-400 font-mono font-bold text-xl">{gameState.revealedTiles.length}</div>
                  </div>
                  <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center border border-[#2f4553]/30">
                    <div className="text-xs text-gray-500 mb-1">Multiplier</div>
                    <div className="text-cyan-400 font-mono font-bold text-xl">{Number(gameState.currentMultiplier).toFixed(2)}×</div>
                  </div>
                </div>
                <div className="bg-[#0f1923]/80 rounded-lg p-4 text-center border border-yellow-500/20">
                  <div className="text-xs text-gray-500 mb-1">Current Payout</div>
                  <div className="text-yellow-400 font-mono font-bold text-2xl">${Number(gameState.currentPayout).toFixed(2)}</div>
                </div>
                {gameState.nextMultiplier > 0 && (
                  <div className="text-center text-xs text-gray-400">
                    Next reveal: <span className="text-cyan-400 font-mono font-bold">{gameState.nextMultiplier.toFixed(4)}×</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {canStart ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startGame}
              disabled={isLoading || !user}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                isLoading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-lg shadow-emerald-500/30"
              }`}
            >
              {isLoading ? "Starting..." : user ? "💣 Start Game" : "Login to Play"}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={cashout}
              disabled={isLoading || gameState!.revealedTiles.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all relative overflow-hidden ${
                isLoading || gameState!.revealedTiles.length === 0
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-yellow-500/30"
              }`}
            >
              <span className="relative z-10">
                {isLoading ? "Cashing out..." : `💰 Cash Out $${(gameState?.currentPayout || 0).toFixed(2)}`}
              </span>
            </motion.button>
          )}

          {/* Result Banner */}
          <AnimatePresence>
            {isGameOver && gameState && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`rounded-xl p-5 text-center font-bold relative overflow-hidden ${
                  gameState.status === "WON"
                    ? "bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-400/50"
                    : "bg-gradient-to-br from-red-500/20 to-red-700/20 border border-red-400/50"
                }`}
              >
                {gameState.status === "WON" ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.3, 1] }}
                      transition={{ duration: 0.5 }}
                      className="text-3xl mb-2 text-green-400"
                    >
                      🎉 You Won!
                    </motion.div>
                    <div className="text-xl text-green-300 font-mono">${Number(gameState.currentPayout).toFixed(2)} ({Number(gameState.currentMultiplier).toFixed(2)}×)</div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: [0, 1.4, 1], rotate: [0, 5, 0] }}
                      transition={{ duration: 0.4 }}
                      className="text-3xl mb-2 text-red-400"
                    >
                      💥 BOOM!
                    </motion.div>
                    <div className="text-lg text-red-300">You hit a mine</div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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

        {/* Right Panel - Mine Grid + Stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 p-4 md:p-6">
            <div className="grid grid-cols-5 gap-2 md:gap-3 max-w-lg mx-auto">
              {Array.from({ length: 25 }, (_, i) => {
                const tile = getTileContent(i);
                const isClickable = isGameActive && !gameState?.revealedTiles.includes(i);

                return (
                  <motion.button
                    key={i}
                    whileHover={isClickable ? { scale: 1.05, y: -2 } : {}}
                    whileTap={isClickable ? { scale: 0.95 } : {}}
                    onClick={() => isClickable && revealTile(i)}
                    disabled={!isClickable}
                    className={`aspect-square rounded-xl border-2 flex items-center justify-center text-2xl md:text-3xl transition-all duration-300 ${tile.bg}`}
                  >
                    <AnimatePresence mode="wait">
                      {tile.icon ? (
                        <motion.span
                          key={`icon-${i}`}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className={tile.text}
                        >
                          {tile.icon}
                        </motion.span>
                      ) : isClickable ? (
                        <motion.span
                          key={`q-${i}`}
                          className="text-gray-600/50 text-lg font-bold"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          ?
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ============ STEP-BY-STEP STATISTICS TABLE ============ */}
          <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553]/50 overflow-hidden">
            <button
              onClick={() => setShowStatsTable(!showStatsTable)}
              className="w-full px-4 py-3 flex items-center justify-between border-b border-[#2f4553]/50 hover:bg-[#2f4553]/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span className="font-semibold text-sm text-gray-200">
                  Payout Table — {mineCount} Mines
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  (${parseFloat(betAmount || "1").toFixed(2)} bet)
                </span>
              </div>
              <motion.span
                animate={{ rotate: showStatsTable ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-gray-400 text-sm"
              >
                ▼
              </motion.span>
            </button>

            <AnimatePresence>
              {showStatsTable && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div
                    ref={statsScrollRef}
                    className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f4553] scrollbar-track-transparent"
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-[#0f1923] text-gray-400 text-xs uppercase tracking-wider">
                          <th className="px-3 py-2.5 text-left">Step</th>
                          <th className="px-3 py-2.5 text-right">Multiplier</th>
                          <th className="px-3 py-2.5 text-right">Payout</th>
                          <th className="px-3 py-2.5 text-right">Profit</th>
                          <th className="px-3 py-2.5 text-right">Chance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsTable.map((row) => {
                          const isCurrentStep = isGameActive && currentStep === row.step;
                          const isCompleted = isGameActive && currentStep > row.step;
                          const isNext = isGameActive && currentStep + 1 === row.step;
                          return (
                            <tr
                              key={row.step}
                              data-step={row.step}
                              className={`border-b border-[#2f4553]/30 transition-all ${
                                isCurrentStep
                                  ? "bg-emerald-500/15 border-emerald-500/40"
                                  : isCompleted
                                  ? "bg-emerald-500/5"
                                  : isNext
                                  ? "bg-cyan-500/5"
                                  : "hover:bg-white/5"
                              }`}
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {isCompleted ? (
                                    <span className="text-emerald-400 text-xs">✓</span>
                                  ) : isCurrentStep ? (
                                    <motion.span
                                      animate={{ scale: [1, 1.3, 1] }}
                                      transition={{ repeat: Infinity, duration: 1.5 }}
                                      className="text-emerald-400 text-xs"
                                    >
                                      ●
                                    </motion.span>
                                  ) : isNext ? (
                                    <span className="text-cyan-400 text-xs">→</span>
                                  ) : (
                                    <span className="text-gray-600 text-xs">{row.step}</span>
                                  )}
                                  <span className={`font-mono text-xs ${
                                    isCurrentStep ? "text-emerald-300 font-bold" : isCompleted ? "text-emerald-400/70" : "text-gray-300"
                                  }`}>
                                    💎 {row.step}
                                  </span>
                                </div>
                              </td>
                              <td className={`px-3 py-2 text-right font-mono text-xs ${
                                isCurrentStep ? "text-cyan-300 font-bold" : "text-gray-300"
                              }`}>
                                {row.multiplier.toFixed(4)}×
                              </td>
                              <td className={`px-3 py-2 text-right font-mono text-xs ${
                                isCurrentStep ? "text-yellow-300 font-bold" : "text-gray-300"
                              }`}>
                                ${row.payout.toFixed(2)}
                              </td>
                              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                                row.profit > 0
                                  ? isCurrentStep ? "text-green-300" : "text-green-400/80"
                                  : "text-red-400/80"
                              }`}>
                                {row.profit >= 0 ? "+" : ""}{row.profit.toFixed(2)}
                              </td>
                              <td className={`px-3 py-2 text-right font-mono text-xs ${
                                row.survivalChance < 5 ? "text-red-400" :
                                row.survivalChance < 20 ? "text-orange-400" :
                                row.survivalChance < 50 ? "text-yellow-400" :
                                "text-gray-400"
                              }`}>
                                {row.survivalChance.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Summary footer */}
                  <div className="px-4 py-2.5 bg-[#0f1923]/80 border-t border-[#2f4553]/50 flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {GRID_SIZE - mineCount} safe tiles | {mineCount} mines
                    </span>
                    <span className="text-gray-500">
                      Max win: <span className="text-yellow-400 font-mono font-bold">
                        ${statsTable.length > 0 ? statsTable[statsTable.length - 1].payout.toFixed(2) : "0.00"}
                      </span>
                      {" "}({statsTable.length > 0 ? statsTable[statsTable.length - 1].multiplier.toFixed(2) : "0"}×)
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Provably Fair */}
          <AnimatePresence>
            {gameState && gameState.serverSeedHash && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
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
                    <div className="font-mono text-gray-300 truncate mt-1">{gameState.serverSeedHash}</div>
                  </div>
                  <div className="bg-[#0f1923]/60 rounded-lg p-2">
                    <span className="text-gray-500">Client Seed</span>
                    <div className="font-mono text-gray-300 truncate mt-1">{gameState.clientSeed}</div>
                  </div>
                  <div className="bg-[#0f1923]/60 rounded-lg p-2">
                    <span className="text-gray-500">Nonce</span>
                    <div className="font-mono text-gray-300 mt-1">{gameState.nonce}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
