"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://146.190.21.113:3000";

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

export default function DicePage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  // Game state
  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [target, setTarget] = useState<number>(50);
  const [condition, setCondition] = useState<"OVER" | "UNDER">("UNDER");
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animatedRoll, setAnimatedRoll] = useState<number>(50);
  const [showResult, setShowResult] = useState(false);

  // Auto-bet state
  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState<string>("10");
  const [autoBetRemaining, setAutoBetRemaining] = useState(0);
  const autoBetRef = useRef(false);

  // Audio refs
  const rollSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const loseSoundRef = useRef<HTMLAudioElement | null>(null);

  // Calculate multiplier and win chance
  const winChance = condition === "UNDER" ? target : 100 - target;
  const multiplier = winChance > 0 && winChance < 100
    ? Math.floor(((100 * 0.96) / winChance) * 10000) / 10000
    : 0;

  // Initialize audio
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

  // Load history on mount
  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/dice/history?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {}
  };

  // Roll animation
  const animateRoll = (finalRoll: number) => {
    const duration = 800;
    const start = Date.now();
    const startVal = Math.random() * 100;

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

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

  // Place bet
  const placeBet = useCallback(async () => {
    if (!user) {
      setError("Please login to play");
      return;
    }
    if (isRolling) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Invalid bet amount");
      return;
    }

    setIsRolling(true);
    setError(null);
    setShowResult(false);
    playSound(rollSoundRef.current);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/dice/play`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          betAmount: amount,
          target,
          condition,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to place bet");
      }

      // Animate the roll
      animateRoll(data.roll);

      setTimeout(() => {
        setLastResult(data);
        if (data.isWin) {
          playSound(winSoundRef.current);
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

  // Auto-bet logic
  useEffect(() => {
    if (!autoBetActive) {
      autoBetRef.current = false;
      return;
    }

    autoBetRef.current = true;
    const remaining = parseInt(autoBetCount) || 10;
    setAutoBetRemaining(remaining);

    const runAutoBet = async (count: number) => {
      if (!autoBetRef.current || count <= 0) {
        setAutoBetActive(false);
        return;
      }
      setAutoBetRemaining(count);
      await placeBet();
      setTimeout(() => runAutoBet(count - 1), 1500);
    };

    runAutoBet(remaining);
  }, [autoBetActive]);

  // Keyboard shortcut
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

  // Slider position calculation
  const getSliderGradient = () => {
    if (condition === "UNDER") {
      return `linear-gradient(to right, #00E701 0%, #00E701 ${target}%, #FF4444 ${target}%, #FF4444 100%)`;
    }
    return `linear-gradient(to right, #FF4444 0%, #FF4444 ${target}%, #00E701 ${target}%, #00E701 100%)`;
  };

  const rollIndicatorPosition = lastResult ? `${lastResult.roll}%` : `${animatedRoll}%`;

  return (
    <div className="min-h-screen bg-[#0f1923] text-white">
      {/* Header */}
      <div className="bg-[#1a2c38] border-b border-[#2f4553] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <span className="text-2xl">🎲</span>
            <h1 className="text-xl font-bold">Dice</h1>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">4% Edge</span>
          </div>
          {user && (
            <div className="text-sm text-gray-400">
              Balance: <span className="text-white font-mono">${parseFloat(user?.balance?.find((b: any) => b.currency === 'USDT')?.available || '0').toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel - Betting Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Bet Amount */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
            <label className="text-sm text-gray-400 mb-2 block">Bet Amount</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#00F0FF] focus:outline-none"
                min="0.01"
                step="0.01"
                disabled={isRolling}
              />
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))}
                className="px-3 py-2 bg-[#2f4553] rounded-lg text-sm hover:bg-[#3d5a6e] transition-colors"
              >
                ½
              </button>
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))}
                className="px-3 py-2 bg-[#2f4553] rounded-lg text-sm hover:bg-[#3d5a6e] transition-colors"
              >
                2×
              </button>
            </div>
          </div>

          {/* Condition Toggle */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
            <label className="text-sm text-gray-400 mb-2 block">Roll</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCondition("UNDER")}
                className={`py-2 rounded-lg font-bold transition-all ${
                  condition === "UNDER"
                    ? "bg-green-500 text-white"
                    : "bg-[#0f1923] text-gray-400 hover:text-white"
                }`}
              >
                Under
              </button>
              <button
                onClick={() => setCondition("OVER")}
                className={`py-2 rounded-lg font-bold transition-all ${
                  condition === "OVER"
                    ? "bg-green-500 text-white"
                    : "bg-[#0f1923] text-gray-400 hover:text-white"
                }`}
              >
                Over
              </button>
            </div>
          </div>

          {/* Target / Win Chance / Multiplier */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4 space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Target</label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(Math.min(99.98, Math.max(0.01, parseFloat(e.target.value) || 50)))}
                className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#00F0FF] focus:outline-none"
                min="0.01"
                max="99.98"
                step="1"
                disabled={isRolling}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Win Chance</label>
                <div className="bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono">
                  {winChance.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Multiplier</label>
                <div className="bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-[#00F0FF] font-mono font-bold">
                  {multiplier.toFixed(4)}×
                </div>
              </div>
            </div>
          </div>

          {/* Roll Button */}
          <button
            onClick={placeBet}
            disabled={isRolling || !user}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              isRolling
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/20"
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
              `Roll Dice`
            ) : (
              "Login to Play"
            )}
          </button>

          {/* Auto-bet */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Auto Bet</label>
              {autoBetActive && (
                <span className="text-xs text-yellow-400">{autoBetRemaining} remaining</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={autoBetCount}
                onChange={(e) => setAutoBetCount(e.target.value)}
                className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-[#00F0FF] focus:outline-none"
                min="1"
                max="1000"
                disabled={autoBetActive}
              />
              <button
                onClick={() => setAutoBetActive(!autoBetActive)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  autoBetActive
                    ? "bg-red-500 hover:bg-red-400"
                    : "bg-[#2f4553] hover:bg-[#3d5a6e]"
                }`}
              >
                {autoBetActive ? "Stop" : "Start"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Right Panel - Game Display */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dice Roll Display */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-6">
            {/* Roll Number Display */}
            <div className="text-center mb-6">
              <div
                className={`text-7xl font-black font-mono transition-all duration-300 ${
                  showResult && lastResult
                    ? lastResult.isWin
                      ? "text-green-400"
                      : "text-red-400"
                    : "text-white"
                }`}
              >
                {animatedRoll.toFixed(2)}
              </div>
              {showResult && lastResult && (
                <div
                  className={`mt-2 text-lg font-bold ${
                    lastResult.isWin ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {lastResult.isWin
                    ? `+$${lastResult.profit.toFixed(2)} (${lastResult.multiplier}×)`
                    : `-$${Math.abs(lastResult.profit).toFixed(2)}`}
                </div>
              )}
            </div>

            {/* Slider */}
            <div className="relative mb-4">
              <div
                className="h-3 rounded-full relative overflow-hidden"
                style={{ background: getSliderGradient() }}
              >
                {/* Roll indicator */}
                {(showResult || isRolling) && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-gray-800 shadow-lg transition-all duration-300 z-10"
                    style={{ left: rollIndicatorPosition, transform: "translate(-50%, -50%)" }}
                  />
                )}
              </div>

              {/* Slider input */}
              <input
                type="range"
                min="1"
                max="99"
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                disabled={isRolling}
              />

              {/* Labels */}
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>

            {/* Potential Win */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-[#0f1923] rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Profit on Win</div>
                <div className="text-green-400 font-mono font-bold">
                  ${((parseFloat(betAmount) || 0) * multiplier - (parseFloat(betAmount) || 0)).toFixed(2)}
                </div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Win Chance</div>
                <div className="text-[#00F0FF] font-mono font-bold">{winChance.toFixed(2)}%</div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Multiplier</div>
                <div className="text-yellow-400 font-mono font-bold">{multiplier.toFixed(4)}×</div>
              </div>
            </div>
          </div>

          {/* Provably Fair */}
          {lastResult && (
            <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400">✓</span>
                <span className="text-sm font-bold text-white">Provably Fair</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Server Seed Hash:</span>
                  <div className="font-mono text-gray-300 truncate">{lastResult.serverSeedHash}</div>
                </div>
                <div>
                  <span className="text-gray-400">Client Seed:</span>
                  <div className="font-mono text-gray-300 truncate">{lastResult.clientSeed}</div>
                </div>
                <div>
                  <span className="text-gray-400">Nonce:</span>
                  <div className="font-mono text-gray-300">{lastResult.nonce}</div>
                </div>
              </div>
            </div>
          )}

          {/* Bet History */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
            <h3 className="text-sm font-bold text-white mb-3">Recent Bets</h3>
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No bets yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-[#2f4553]">
                      <th className="text-left py-2">Roll</th>
                      <th className="text-left py-2">Target</th>
                      <th className="text-right py-2">Bet</th>
                      <th className="text-right py-2">Multi</th>
                      <th className="text-right py-2">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 10).map((bet) => (
                      <tr key={bet.id} className="border-b border-[#2f4553]/50">
                        <td className={`py-2 font-mono ${bet.isWin ? "text-green-400" : "text-red-400"}`}>
                          {bet.gameData?.roll?.toFixed(2)}
                        </td>
                        <td className="py-2 text-gray-300 font-mono">
                          {bet.gameData?.condition === "UNDER" ? "<" : ">"} {bet.gameData?.target}
                        </td>
                        <td className="py-2 text-right text-gray-300 font-mono">
                          ${parseFloat(bet.betAmount).toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-[#00F0FF] font-mono">
                          {parseFloat(bet.multiplier).toFixed(2)}×
                        </td>
                        <td className={`py-2 text-right font-mono ${bet.isWin ? "text-green-400" : "text-red-400"}`}>
                          {bet.isWin ? "+" : ""}${parseFloat(bet.profit).toFixed(2)}
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
    </div>
  );
}
