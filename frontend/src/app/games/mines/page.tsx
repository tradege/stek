"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://146.190.21.113:3000";

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

export default function MinesPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  // Game state
  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [mineCount, setMineCount] = useState<number>(5);
  const [gameState, setGameState] = useState<MinesGameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedAnimation, setRevealedAnimation] = useState<Set<number>>(new Set());
  const [lastClickedTile, setLastClickedTile] = useState<number | null>(null);

  // Audio refs
  const gemSoundRef = useRef<HTMLAudioElement | null>(null);
  const bombSoundRef = useRef<HTMLAudioElement | null>(null);
  const cashoutSoundRef = useRef<HTMLAudioElement | null>(null);

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

  // Check for active game on mount
  useEffect(() => {
    if (user) checkActiveGame();
  }, [user]);

  const getToken = () => localStorage.getItem("token");

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

  // Start new game
  const startGame = async () => {
    if (!user || isLoading) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Invalid bet amount");
      return;
    }

    setIsLoading(true);
    setError(null);
    setRevealedAnimation(new Set());
    setLastClickedTile(null);

    try {
      const res = await fetch(`${API_URL}/mines/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
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

  // Reveal tile
  const revealTile = async (tileIndex: number) => {
    if (!gameState || gameState.status !== "ACTIVE" || isLoading) return;
    if (gameState.revealedTiles.includes(tileIndex)) return;

    setIsLoading(true);
    setLastClickedTile(tileIndex);

    try {
      const res = await fetch(`${API_URL}/mines/reveal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ gameId: gameState.gameId, tileIndex }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reveal tile");

      if (data.status === "LOST") {
        playSound(bombSoundRef.current);
        // Animate mine reveal
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

  // Cash out
  const cashout = async () => {
    if (!gameState || gameState.status !== "ACTIVE" || isLoading) return;
    if (gameState.revealedTiles.length === 0) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/mines/cashout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
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

  // Get tile display
  const getTileContent = (index: number) => {
    const isRevealed = gameState?.revealedTiles.includes(index);
    const isMine = gameState?.minePositions?.includes(index);
    const isGameOver = gameState?.status === "LOST" || gameState?.status === "WON";

    if (isRevealed && !isMine) {
      return { icon: "💎", bg: "bg-green-500/20 border-green-500/50", text: "text-green-400" };
    }
    if (isMine && isGameOver) {
      if (index === lastClickedTile) {
        return { icon: "💥", bg: "bg-red-600/40 border-red-500 animate-pulse", text: "text-red-400" };
      }
      return { icon: "💣", bg: "bg-red-500/20 border-red-500/50", text: "text-red-400" };
    }
    if (isGameOver && !isRevealed && !isMine) {
      return { icon: "💎", bg: "bg-gray-700/30 border-gray-600/30", text: "text-gray-500" };
    }
    return { icon: "", bg: "bg-[#2f4553] border-[#3d5a6e] hover:bg-[#3d5a6e] hover:border-[#4d6a7e] cursor-pointer", text: "" };
  };

  const isGameActive = gameState?.status === "ACTIVE";
  const isGameOver = gameState?.status === "LOST" || gameState?.status === "WON";
  const canStart = !gameState || isGameOver;

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
            <span className="text-2xl">💣</span>
            <h1 className="text-xl font-bold">Mines</h1>
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
        {/* Left Panel - Controls */}
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
                disabled={isGameActive}
              />
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))}
                className="px-3 py-2 bg-[#2f4553] rounded-lg text-sm hover:bg-[#3d5a6e] transition-colors"
                disabled={isGameActive}
              >
                ½
              </button>
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))}
                className="px-3 py-2 bg-[#2f4553] rounded-lg text-sm hover:bg-[#3d5a6e] transition-colors"
                disabled={isGameActive}
              >
                2×
              </button>
            </div>
          </div>

          {/* Mine Count */}
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4">
            <label className="text-sm text-gray-400 mb-2 block">Mines ({mineCount})</label>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 3, 5, 7, 10, 12, 15, 18, 20, 22, 23, 24].map((count) => (
                <button
                  key={count}
                  onClick={() => setMineCount(count)}
                  disabled={isGameActive}
                  className={`py-1.5 rounded text-xs font-bold transition-all ${
                    mineCount === count
                      ? "bg-[#00F0FF] text-black"
                      : "bg-[#0f1923] text-gray-400 hover:text-white hover:bg-[#2f4553]"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Game Info */}
          {isGameActive && gameState && (
            <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f1923] rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">Gems Found</div>
                  <div className="text-green-400 font-mono font-bold text-lg">
                    {gameState.revealedTiles.length}
                  </div>
                </div>
                <div className="bg-[#0f1923] rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">Current Multi</div>
                  <div className="text-[#00F0FF] font-mono font-bold text-lg">
                    {gameState.currentMultiplier.toFixed(2)}×
                  </div>
                </div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Current Payout</div>
                <div className="text-yellow-400 font-mono font-bold text-xl">
                  ${gameState.currentPayout.toFixed(2)}
                </div>
              </div>
              {gameState.nextMultiplier > 0 && (
                <div className="text-center text-xs text-gray-400">
                  Next reveal: <span className="text-[#00F0FF] font-mono">{gameState.nextMultiplier.toFixed(4)}×</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {canStart ? (
            <button
              onClick={startGame}
              disabled={isLoading || !user}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                isLoading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/20"
              }`}
            >
              {isLoading ? "Starting..." : user ? "Start Game" : "Login to Play"}
            </button>
          ) : (
            <button
              onClick={cashout}
              disabled={isLoading || gameState!.revealedTiles.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                isLoading || gameState!.revealedTiles.length === 0
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-yellow-500/20"
              }`}
            >
              {isLoading ? "Cashing out..." : `Cash Out $${(gameState?.currentPayout || 0).toFixed(2)}`}
            </button>
          )}

          {/* Result Banner */}
          {isGameOver && gameState && (
            <div
              className={`rounded-xl p-4 text-center font-bold ${
                gameState.status === "WON"
                  ? "bg-green-500/20 border border-green-500/50 text-green-400"
                  : "bg-red-500/20 border border-red-500/50 text-red-400"
              }`}
            >
              {gameState.status === "WON" ? (
                <>
                  <div className="text-2xl mb-1">You Won!</div>
                  <div className="text-lg">${gameState.currentPayout.toFixed(2)} ({gameState.currentMultiplier.toFixed(2)}×)</div>
                </>
              ) : (
                <>
                  <div className="text-2xl mb-1">Boom!</div>
                  <div className="text-lg">You hit a mine</div>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Right Panel - Mine Grid */}
        <div className="lg:col-span-2">
          <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4 md:p-6">
            <div className="grid grid-cols-5 gap-2 md:gap-3 max-w-lg mx-auto">
              {Array.from({ length: 25 }, (_, i) => {
                const tile = getTileContent(i);
                const isClickable = isGameActive && !gameState?.revealedTiles.includes(i);

                return (
                  <button
                    key={i}
                    onClick={() => isClickable && revealTile(i)}
                    disabled={!isClickable}
                    className={`aspect-square rounded-xl border-2 flex items-center justify-center text-2xl md:text-3xl transition-all duration-300 ${tile.bg} ${
                      isClickable ? "active:scale-95" : ""
                    }`}
                    style={{
                      animationDelay: revealedAnimation.has(i) ? `${(i % 5) * 50}ms` : "0ms",
                    }}
                  >
                    {tile.icon && (
                      <span className={`${tile.text} transition-all duration-300`}>
                        {tile.icon}
                      </span>
                    )}
                    {!tile.icon && isClickable && (
                      <span className="text-gray-600 text-lg">?</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provably Fair */}
          {gameState && gameState.serverSeedHash && (
            <div className="bg-[#1a2c38] rounded-xl border border-[#2f4553] p-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400">✓</span>
                <span className="text-sm font-bold text-white">Provably Fair</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Server Seed Hash:</span>
                  <div className="font-mono text-gray-300 truncate">{gameState.serverSeedHash}</div>
                </div>
                <div>
                  <span className="text-gray-400">Client Seed:</span>
                  <div className="font-mono text-gray-300 truncate">{gameState.clientSeed}</div>
                </div>
                <div>
                  <span className="text-gray-400">Nonce:</span>
                  <div className="font-mono text-gray-300">{gameState.nonce}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
