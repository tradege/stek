"use client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";
import config from "@/config/api";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = config.apiUrl;

interface Card {
  rank: string;
  suit: string;
  value: number;
}

interface OddsEntry {
  handSize: number;
  winProbability: string;
  bustProbability: string;
  multiplier: number;
  blackjackMultiplier: number;
}

interface CardRushResult {
  playerCards: Card[];
  dealerCards: Card[];
  playerSum: number;
  dealerSum: number;
  isWin: boolean;
  isPush: boolean;
  isBust: boolean;
  isDealerBust: boolean;
  isBlackjack: boolean;
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

type GameState = "IDLE" | "DEALING" | "RESULT";

const SUIT_MAP: Record<string, { color: string; symbol: string }> = {
  "\u2660": { color: "text-gray-900", symbol: "\u2660" },
  "\u2665": { color: "text-red-600", symbol: "\u2665" },
  "\u2666": { color: "text-red-600", symbol: "\u2666" },
  "\u2663": { color: "text-gray-900", symbol: "\u2663" },
};

const CHIP_VALUES = [0.5, 1, 5, 10, 25, 50, 100];
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.5: { bg: "from-gray-400 to-gray-500", border: "border-gray-300", text: "text-gray-900" },
  1: { bg: "from-blue-400 to-blue-600", border: "border-blue-300", text: "text-white" },
  5: { bg: "from-red-500 to-red-700", border: "border-red-400", text: "text-white" },
  10: { bg: "from-green-500 to-green-700", border: "border-green-400", text: "text-white" },
  25: { bg: "from-purple-500 to-purple-700", border: "border-purple-400", text: "text-white" },
  50: { bg: "from-orange-500 to-orange-700", border: "border-orange-400", text: "text-white" },
  100: { bg: "from-yellow-400 to-yellow-600", border: "border-yellow-300", text: "text-gray-900" },
};

function PlayingCard({
  card,
  index,
  isRevealed,
  isDealer,
  total,
}: {
  card: Card;
  index: number;
  isRevealed: boolean;
  isDealer?: boolean;
  total: number;
}) {
  const suitInfo = SUIT_MAP[card.suit] || { color: "text-gray-900", symbol: card.suit };
  const spacing = total <= 3 ? 90 : total === 4 ? 75 : 65;
  const totalWidth = (total - 1) * spacing;
  const xOffset = index * spacing - totalWidth / 2;

  return (
    <motion.div
      className="absolute"
      style={{
        perspective: "1000px",
        left: "50%",
        top: "50%",
        marginLeft: "-44px",
        marginTop: "-62px",
      }}
      initial={{ opacity: 0, y: isDealer ? -120 : 120, x: 0, scale: 0.3, rotateZ: -20 }}
      animate={{ opacity: 1, y: 0, x: xOffset, scale: 1, rotateZ: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, delay: index * 0.25 }}
    >
      <motion.div
        className="relative w-[88px] h-[124px]"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: index * 0.25 + 0.1 }}
      >
        {/* Card Back */}
        <div
          className="absolute inset-0 rounded-lg shadow-xl border-2 border-blue-300/50 overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="w-full h-full bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900 flex items-center justify-center">
            <div
              className="w-[76%] h-[82%] rounded-md border-2 border-blue-400/30 bg-gradient-to-br from-blue-600/40 to-indigo-800/40 flex items-center justify-center"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 8px)" }}
            >
              <div className="text-blue-300/60 text-2xl font-bold tracking-wider">CR</div>
            </div>
          </div>
        </div>
        {/* Card Front */}
        <div
          className="absolute inset-0 rounded-lg shadow-xl border border-gray-200 bg-white overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className={`absolute top-1.5 left-2 ${suitInfo.color} leading-tight`}>
            <div className="text-sm font-bold">{card.rank}</div>
            <div className="text-xs -mt-0.5">{suitInfo.symbol}</div>
          </div>
          <div className={`absolute inset-0 flex items-center justify-center ${suitInfo.color}`}>
            <span className="text-4xl">{suitInfo.symbol}</span>
          </div>
          <div className={`absolute bottom-1.5 right-2 ${suitInfo.color} rotate-180 leading-tight`}>
            <div className="text-sm font-bold">{card.rank}</div>
            <div className="text-xs -mt-0.5">{suitInfo.symbol}</div>
          </div>
          <div className="absolute inset-1 rounded border border-gray-100 pointer-events-none" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function BettingChip({
  value,
  onClick,
  disabled,
}: {
  value: number;
  onClick: () => void;
  disabled: boolean;
}) {
  const colors = CHIP_COLORS[value] || CHIP_COLORS[1];
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.15, y: disabled ? 0 : -4 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-b ${colors.bg} border-[3px] ${colors.border} shadow-lg flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
    >
      <div className="absolute inset-[4px] rounded-full border-2 border-white/30 border-dashed" />
      <span className={`text-[10px] md:text-xs font-black ${colors.text} relative z-10`}>
        {value < 1 ? value.toFixed(1) : value}
      </span>
    </motion.button>
  );
}

function ConfettiPiece({ delay }: { delay: number }) {
  const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FF69B4", "#00F0FF"];
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

export default function CardRushPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();
  const [betAmount, setBetAmount] = useState<number>(1);
  const [handSize, setHandSize] = useState<2 | 3 | 4 | 5>(2);
  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [result, setResult] = useState<CardRushResult | null>(null);
  const [revealedCards, setRevealedCards] = useState<number[]>([]);
  const [dealerRevealed, setDealerRevealed] = useState<number[]>([]);
  const [odds, setOdds] = useState<OddsEntry[]>([]);
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const cardSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const loseSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    cardSoundRef.current = new Audio("/sounds/gem.mp3");
    winSoundRef.current = new Audio("/sounds/win.mp3");
    loseSoundRef.current = new Audio("/sounds/bomb.mp3");
  }, []);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (isSoundActive && sound) { sound.currentTime = 0; sound.play().catch(() => {}); }
  };

  const getToken = () => localStorage.getItem("auth_token");

  useEffect(() => {
    const fetchOdds = async () => {
      try {
        const res = await fetch(`${API_URL}/card-rush/odds`, { headers: { Authorization: `Bearer ${getToken()}` } });
        if (res.ok) setOdds(await res.json());
      } catch {}
    };
    fetchOdds();
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/card-rush/history?limit=10`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDeal = async () => {
    if (isLoading || gameState !== "IDLE") return;
    setIsLoading(true); setError(null); setGameState("DEALING");
    setResult(null); setRevealedCards([]); setDealerRevealed([]); setShowConfetti(false);
    try {
      const res = await fetch(`${API_URL}/card-rush/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ betAmount, handSize }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to play"); }
      const data: CardRushResult = await res.json();
      setResult(data);
      for (let i = 0; i < data.playerCards.length; i++) {
        await new Promise((r) => setTimeout(r, 400));
        playSound(cardSoundRef.current);
        setRevealedCards((prev) => [...prev, i]);
      }
      if (!data.isBust && data.dealerCards.length > 0) {
        await new Promise((r) => setTimeout(r, 700));
        for (let i = 0; i < data.dealerCards.length; i++) {
          await new Promise((r) => setTimeout(r, 400));
          playSound(cardSoundRef.current);
          setDealerRevealed((prev) => [...prev, i]);
        }
      }
      await new Promise((r) => setTimeout(r, 600));
      setGameState("RESULT");
      if (data.isWin || data.isBlackjack) {
        playSound(winSoundRef.current); setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } else { playSound(loseSoundRef.current); }
      refreshUser(); fetchHistory();
    } catch (err: any) { setError(err.message); setGameState("IDLE"); }
    finally { setIsLoading(false); }
  };

  const resetGame = () => { setGameState("IDLE"); setResult(null); setRevealedCards([]); setDealerRevealed([]); setShowConfetti(false); };

  const currentOdds = odds.find((o) => o.handSize === handSize);
  const balance = parseFloat(user?.balance?.find((b: any) => b.currency === "USDT")?.available || "0");

  const getResultMessage = () => {
    if (!result) return null;
    if (result.isBust) return { text: "BUST!", sub: `Your hand: ${result.playerSum}`, color: "text-red-400", bg: "from-red-900/80 to-red-950/80", icon: "\uD83D\uDCA5" };
    if (result.isBlackjack) return { text: "BLACKJACK!", sub: `${result.multiplier}x Payout!`, color: "text-yellow-400", bg: "from-yellow-900/80 to-amber-950/80", icon: "\uD83C\uDCCF" };
    if (result.isDealerBust) return { text: "DEALER BUST!", sub: `Dealer had ${result.dealerSum}`, color: "text-green-400", bg: "from-green-900/80 to-emerald-950/80", icon: "\uD83C\uDF89" };
    if (result.isPush) return { text: "PUSH", sub: "Tie - bet returned", color: "text-yellow-300", bg: "from-yellow-900/80 to-amber-950/80", icon: "\uD83E\uDD1D" };
    if (result.isWin) return { text: "YOU WIN!", sub: `${result.playerSum} beats ${result.dealerSum}`, color: "text-green-400", bg: "from-green-900/80 to-emerald-950/80", icon: "\uD83C\uDFC6" };
    return { text: "DEALER WINS", sub: `${result.dealerSum} beats ${result.playerSum}`, color: "text-red-400", bg: "from-red-900/80 to-red-950/80", icon: "\uD83D\uDE14" };
  };

  const addChipAmount = (chipValue: number) => {
    setBetAmount((prev) => Math.min(parseFloat((prev + chipValue).toFixed(2)), balance));
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white relative overflow-hidden">
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            {Array.from({ length: 60 }).map((_, i) => (<ConfettiPiece key={i} delay={Math.random() * 0.5} />))}
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">&larr; Back</Link>
            <h1 className="text-xl md:text-2xl font-bold">
              <span className="text-2xl md:text-3xl">{"\uD83C\uDCCF"}</span>{" "}
              <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">Card Rush</span>
            </h1>
          </div>
          <div className="bg-[#1a1f2e] rounded-lg px-4 py-2 border border-white/10">
            <span className="text-gray-400 text-sm">Balance: </span>
            <span className="text-emerald-400 font-bold font-mono">${balance.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT PANEL */}
          <div className="lg:col-span-3 space-y-3">
            {/* Hand Size */}
            <div className="bg-[#141820] rounded-xl border border-white/10 p-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-3 block font-semibold">Cards to Deal</label>
              <div className="grid grid-cols-4 gap-2">
                {([2, 3, 4, 5] as const).map((size) => (
                  <motion.button key={size} onClick={() => gameState === "IDLE" && setHandSize(size)}
                    whileHover={{ scale: gameState === "IDLE" ? 1.05 : 1 }}
                    whileTap={{ scale: gameState === "IDLE" ? 0.95 : 1 }}
                    className={`py-3 rounded-lg font-bold text-lg transition-all ${
                      handSize === size
                        ? "bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-lg shadow-amber-500/30"
                        : "bg-[#1a1f2e] text-gray-400 hover:text-white hover:bg-[#222838] border border-white/5"
                    } ${gameState !== "IDLE" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >{size}</motion.button>
                ))}
              </div>
              {handSize === 2 && <div className="mt-2 text-xs text-amber-400/70 text-center">Classic Blackjack Hand</div>}
            </div>

            {/* Bet Amount with Chips */}
            <div className="bg-[#141820] rounded-xl border border-white/10 p-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block font-semibold">Bet Amount</label>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-[#0a0e14] border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-lg font-bold text-center">
                  ${betAmount.toFixed(2)}
                </div>
                <button onClick={() => setBetAmount(0)} disabled={gameState !== "IDLE"}
                  className="px-3 py-2.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-40">
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {CHIP_VALUES.map((v) => (
                  <BettingChip key={v} value={v} onClick={() => addChipAmount(v)} disabled={gameState !== "IDLE" || v > balance - betAmount} />
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setBetAmount((p) => Math.max(0.5, parseFloat((p / 2).toFixed(2))))} disabled={gameState !== "IDLE"}
                  className="flex-1 py-1.5 bg-[#1a1f2e] text-gray-400 rounded-lg text-xs font-bold hover:text-white transition-colors disabled:opacity-40 border border-white/5">&frac12;</button>
                <button onClick={() => setBetAmount((p) => Math.min(balance, parseFloat((p * 2).toFixed(2))))} disabled={gameState !== "IDLE"}
                  className="flex-1 py-1.5 bg-[#1a1f2e] text-gray-400 rounded-lg text-xs font-bold hover:text-white transition-colors disabled:opacity-40 border border-white/5">2&times;</button>
                <button onClick={() => setBetAmount(balance)} disabled={gameState !== "IDLE"}
                  className="flex-1 py-1.5 bg-[#1a1f2e] text-gray-400 rounded-lg text-xs font-bold hover:text-white transition-colors disabled:opacity-40 border border-white/5">MAX</button>
              </div>
            </div>

            {/* Odds */}
            {currentOdds && (
              <div className="bg-[#141820] rounded-xl border border-white/10 p-4">
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-3 block font-semibold">{handSize}-Card Odds</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0a0e14] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Win</div>
                    <div className="text-green-400 font-bold">{currentOdds.winProbability}</div>
                  </div>
                  <div className="bg-[#0a0e14] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Bust</div>
                    <div className="text-red-400 font-bold">{currentOdds.bustProbability}</div>
                  </div>
                  <div className="bg-[#0a0e14] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Payout</div>
                    <div className="text-accent-primary font-bold">{currentOdds.multiplier}x</div>
                  </div>
                  <div className="bg-[#0a0e14] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Blackjack</div>
                    <div className="text-yellow-400 font-bold">{currentOdds.blackjackMultiplier}x</div>
                  </div>
                </div>
              </div>
            )}

            {/* Deal Button */}
            {gameState === "IDLE" ? (
              <motion.button onClick={handleDeal} disabled={isLoading || betAmount <= 0 || betAmount > balance}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider">
                Deal {handSize} Cards
              </motion.button>
            ) : gameState === "RESULT" ? (
              <motion.button onClick={resetGame} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-primary to-blue-500 text-white shadow-lg shadow-primary/30 uppercase tracking-wider">
                New Hand
              </motion.button>
            ) : (
              <div className="w-full py-4 rounded-xl font-bold text-lg bg-[#1a1f2e] text-gray-500 text-center border border-white/5">
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>Dealing...</motion.span>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CENTER - Casino Table */}
          <div className="lg:col-span-9">
            <div className="rounded-2xl border-4 border-amber-900/60 p-6 md:p-8 min-h-[520px] relative overflow-hidden shadow-2xl"
              style={{ background: "radial-gradient(ellipse at center, #35654d 0%, #1e3c2f 70%, #152a22 100%)" }}>
              {/* Felt texture */}
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle, #fff 0.5px, transparent 0.5px)", backgroundSize: "12px 12px" }} />
              <div className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 60px rgba(0,0,0,0.4), inset 0 0 120px rgba(0,0,0,0.2)" }} />
              {/* Semi-circle */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] border-2 border-white/5 rounded-t-full pointer-events-none" />

              {/* DEALER AREA */}
              <div className="relative mb-4">
                <div className="text-center mb-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40 font-semibold">Dealer</span>
                  {result && !result.isBust && dealerRevealed.length > 0 && (
                    <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                      className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-black/30 text-white/80 text-xs font-mono">{result.dealerSum}</motion.span>
                  )}
                </div>
                <div className="relative h-[140px] flex items-center justify-center">
                  {result && !result.isBust && result.dealerCards.map((card, i) => (
                    <PlayingCard key={`d-${i}`} card={card} index={i} isRevealed={dealerRevealed.includes(i)} isDealer total={result.dealerCards.length} />
                  ))}
                  {gameState === "IDLE" && !result && <div className="text-white/20 text-sm">Dealer cards appear here</div>}
                </div>
              </div>

              {/* RESULT OVERLAY */}
              <AnimatePresence>
                {gameState === "RESULT" && result && (
                  <motion.div className="relative z-20 flex items-center justify-center py-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className={`bg-gradient-to-br ${getResultMessage()?.bg} backdrop-blur-md rounded-2xl px-8 py-5 text-center border border-white/10 shadow-2xl`}
                      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                      <div className="text-3xl mb-1">{getResultMessage()?.icon}</div>
                      <motion.div className={`text-3xl md:text-4xl font-black ${getResultMessage()?.color}`}
                        animate={result.isWin || result.isBlackjack ? { scale: [1, 1.05, 1] } : { x: [0, -4, 4, -4, 0] }}
                        transition={{ repeat: result.isWin ? Infinity : 0, duration: result.isWin ? 2 : 0.4 }}>
                        {getResultMessage()?.text}
                      </motion.div>
                      <div className="text-white/60 text-sm mt-1">{getResultMessage()?.sub}</div>
                      {(result.isWin || result.isBlackjack) && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                          className="text-emerald-400 font-bold text-xl mt-2 font-mono">+${result.profit.toFixed(2)}</motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              {gameState === "IDLE" && !result && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex-1 h-px bg-white/10" />
                  <div className="px-4 text-white/20 text-xs uppercase tracking-widest">{handSize === 2 ? "Classic Hand" : `${handSize} Card Rush`}</div>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              {/* PLAYER AREA */}
              <div className="relative mt-4">
                <div className="relative h-[140px] flex items-center justify-center">
                  {result && result.playerCards.map((card, i) => (
                    <PlayingCard key={`p-${i}`} card={card} index={i} isRevealed={revealedCards.includes(i)} total={result.playerCards.length} />
                  ))}
                  {gameState === "IDLE" && !result && <div className="text-white/20 text-sm">Your cards appear here</div>}
                </div>
                <div className="text-center mt-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40 font-semibold">Player</span>
                  {result && revealedCards.length > 0 && (
                    <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                      className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                        result.isBust ? "bg-red-500/30 text-red-400" : result.isBlackjack ? "bg-yellow-500/30 text-yellow-400" : "bg-black/30 text-white/80"
                      }`}>{result.playerSum}{result.isBust && " BUST"}{result.isBlackjack && " BJ!"}</motion.span>
                  )}
                </div>
              </div>
            </div>

            {/* History & Odds Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-[#141820] rounded-xl border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5"><h3 className="font-semibold text-sm text-gray-300">Recent Hands</h3></div>
                <div className="overflow-x-auto max-h-[240px]">
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs border-b border-white/5">
                      <th className="px-4 py-2 text-left">Cards</th><th className="px-4 py-2 text-left">Result</th>
                      <th className="px-4 py-2 text-right">Bet</th><th className="px-4 py-2 text-right">Profit</th>
                    </tr></thead>
                    <tbody>
                      {history.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">No hands played yet</td></tr>
                      ) : history.map((bet) => {
                        const profit = parseFloat(bet.profit);
                        return (
                          <ErrorBoundary gameName="Card Rush">
                          <tr key={bet.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-4 py-2 font-mono text-xs">{bet.gameData?.handSize || "?"} cards</td>
                            <td className="px-4 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${bet.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{bet.isWin ? "WIN" : "LOSS"}</span></td>
                            <td className="px-4 py-2 text-right font-mono text-xs">${parseFloat(bet.betAmount).toFixed(2)}</td>
                            <td className={`px-4 py-2 text-right font-mono font-bold text-xs ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{profit >= 0 ? "+" : ""}${profit.toFixed(2)}</td>
                          </tr>
                          </ErrorBoundary>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {odds.length > 0 && (
                <div className="bg-[#141820] rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5"><h3 className="font-semibold text-sm text-gray-300">Payout Table</h3></div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs border-b border-white/5">
                      <th className="px-3 py-2 text-left">Cards</th><th className="px-3 py-2 text-center">Win %</th>
                      <th className="px-3 py-2 text-center">Bust %</th><th className="px-3 py-2 text-center">Payout</th>
                      <th className="px-3 py-2 text-center">BJ</th>
                    </tr></thead>
                    <tbody>
                      {odds.map((o) => (
                        <tr key={o.handSize} className={`border-b border-white/5 ${o.handSize === handSize ? "bg-amber-500/10" : "hover:bg-white/5"}`}>
                          <td className="px-3 py-2 font-bold">{o.handSize} {"\uD83C\uDCCF"}</td>
                          <td className="px-3 py-2 text-center text-green-400 text-xs">{o.winProbability}</td>
                          <td className="px-3 py-2 text-center text-red-400 text-xs">{o.bustProbability}</td>
                          <td className="px-3 py-2 text-center text-accent-primary font-bold text-xs">{o.multiplier}x</td>
                          <td className="px-3 py-2 text-center text-yellow-400 font-bold text-xs">{o.blackjackMultiplier}x</td>
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
    </div>
  );
}
