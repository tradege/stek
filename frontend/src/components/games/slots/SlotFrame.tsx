"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";

// ============================================
// SLOT FRAME - Industrial/Cyberpunk Casino
// ============================================
interface SlotFrameProps {
  children: ReactNode;
  spinning: boolean;
  isWin: boolean;
  isBigWin: boolean;
  gameName: string;
  gameTheme: "candy" | "egypt" | "space" | "ocean";
}

const THEME_COLORS = {
  candy:  { primary: "#FF6B9D", secondary: "#C850C0", glow: "rgba(255,107,157,0.3)", border: "border-pink-500/30", gradient: "from-pink-900/40 to-purple-900/30" },
  egypt:  { primary: "#FFD700", secondary: "#CD853F", glow: "rgba(255,215,0,0.3)", border: "border-yellow-600/30", gradient: "from-yellow-900/30 to-amber-900/20" },
  space:  { primary: "#00F0FF", secondary: "#7B2FFF", glow: "rgba(0,240,255,0.3)", border: "border-cyan-500/30", gradient: "from-cyan-900/30 to-indigo-900/20" },
  ocean:  { primary: "#00BCD4", secondary: "#0077B6", glow: "rgba(0,188,212,0.3)", border: "border-teal-500/30", gradient: "from-teal-900/30 to-blue-900/20" },
};

export function SlotFrame({ children, spinning, isWin, isBigWin, gameName, gameTheme }: SlotFrameProps) {
  const theme = THEME_COLORS[gameTheme];
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (isBigWin) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 800);
      return () => clearTimeout(t);
    }
  }, [isBigWin]);

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden ${theme.border} border-2`}
      animate={shaking ? {
        x: [0, -8, 8, -6, 6, -4, 4, -2, 2, 0],
        y: [0, -4, 4, -3, 3, -2, 2, -1, 1, 0],
      } : {}}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      style={{ boxShadow: isWin ? `0 0 40px ${theme.glow}, 0 0 80px ${theme.glow}` : `0 0 20px rgba(0,0,0,0.5)` }}
    >
      {/* Metallic Frame Top */}
      <div className="relative h-2 bg-gradient-to-r from-gray-700 via-gray-500 to-gray-700">
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent h-[1px]" />
      </div>

      {/* Main Game Area */}
      <div className={`relative bg-gradient-to-b ${theme.gradient} p-3 sm:p-4`}>
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)" }} />

        {/* Corner Bolts */}
        {["-top-0 -left-0", "-top-0 -right-0", "-bottom-0 -left-0", "-bottom-0 -right-0"].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-6 h-6 z-10`}>
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 border border-gray-500/50 m-1.5"
              style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.5)" }} />
          </div>
        ))}

        {children}
      </div>

      {/* Metallic Frame Bottom */}
      <div className="relative h-2 bg-gradient-to-r from-gray-700 via-gray-500 to-gray-700">
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white/10 to-transparent h-[1px]" />
      </div>
    </motion.div>
  );
}

// ============================================
// ANIMATED REEL CELL
// ============================================
interface ReelCellProps {
  symbol: string;
  emoji: string;
  color: string;
  tier: string;
  isWinning: boolean;
  spinning: boolean;
  index: number;
  cols: number;
  gameTheme: "candy" | "egypt" | "space" | "ocean";
}

export function ReelCell({ symbol, emoji, color, tier, isWinning, spinning, index, cols, gameTheme }: ReelCellProps) {
  const col = index % cols;
  const landDelay = col * 0.08;

  const tierStyles: Record<string, string> = {
    premium: "shadow-lg",
    mid: "shadow-md",
    low: "shadow-sm",
    special: "shadow-xl",
  };

  const themeGlow: Record<string, string> = {
    candy: "shadow-pink-500/40",
    egypt: "shadow-yellow-500/40",
    space: "shadow-cyan-500/40",
    ocean: "shadow-teal-500/40",
  };

  return (
    <motion.div
      className={`aspect-square rounded-lg flex items-center justify-center relative overflow-hidden
        ${isWinning ? `scale-110 z-10 ring-2 ${themeGlow[gameTheme]} ${tierStyles[tier] || ""}` : "bg-[#070a11]/80"}
        ${tier === "premium" && !spinning ? "bg-gradient-to-br from-white/5 to-transparent" : ""}
      `}
      initial={spinning ? { y: -20, opacity: 0.5, filter: "blur(4px)" } : false}
      animate={
        spinning
          ? { y: [0, -10, 10, -5, 5, 0], opacity: [0.3, 0.5, 0.3], filter: ["blur(8px)", "blur(4px)", "blur(8px)"] }
          : { y: 0, opacity: 1, filter: "blur(0px)", scale: isWinning ? [1, 1.15, 1.1] : 1 }
      }
      transition={
        spinning
          ? { duration: 0.3, repeat: Infinity, ease: "linear" }
          : { duration: 0.4, delay: landDelay, type: "spring", stiffness: 300, damping: 15 }
      }
      style={{
        boxShadow: isWinning ? `0 0 20px ${color}40, inset 0 0 15px ${color}20` : undefined,
        borderColor: isWinning ? color : undefined,
        borderWidth: isWinning ? "2px" : undefined,
      }}
    >
      {/* Symbol Glow Background */}
      {(isWinning || tier === "special") && (
        <div className="absolute inset-0 rounded-lg animate-pulse" style={{ background: `radial-gradient(circle, ${color}15 0%, transparent 70%)` }} />
      )}

      {/* 3D Symbol */}
      <motion.span
        className="relative z-10 select-none"
        style={{
          fontSize: "clamp(1.2rem, 3vw, 2rem)",
          textShadow: tier === "premium" || tier === "special"
            ? `0 0 10px ${color}80, 0 2px 4px rgba(0,0,0,0.5)`
            : `0 1px 3px rgba(0,0,0,0.5)`,
          filter: tier === "premium" ? "drop-shadow(0 0 6px " + color + "60)" : undefined,
        }}
        animate={isWinning ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
        transition={{ duration: 0.5, repeat: isWinning ? Infinity : 0, repeatDelay: 0.5 }}
      >
        {emoji}
      </motion.span>

      {/* Win Sparkle */}
      {isWinning && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white"
              style={{ left: `${20 + i * 30}%`, top: `${15 + i * 25}%` }}
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 1, delay: i * 0.3, repeat: Infinity }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================
// BIG WIN POPUP - Coin Explosion
// ============================================
interface BigWinPopupProps {
  show: boolean;
  amount: number;
  multiplier: number;
  onClose: () => void;
  gameTheme: "candy" | "egypt" | "space" | "ocean";
}

export function BigWinPopup({ show, amount, multiplier, onClose, gameTheme }: BigWinPopupProps) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const theme = THEME_COLORS[gameTheme];

  useEffect(() => {
    if (!show) { setDisplayAmount(0); return; }
    const duration = 2000;
    const steps = 60;
    const increment = amount / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= amount) {
        setDisplayAmount(amount);
        clearInterval(interval);
      } else {
        setDisplayAmount(current);
      }
    }, duration / steps);
    const autoClose = setTimeout(onClose, 4000);
    return () => { clearInterval(interval); clearTimeout(autoClose); };
  }, [show, amount, onClose]);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Coin Explosion Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => {
            const angle = (i / 30) * Math.PI * 2;
            const distance = 100 + Math.random() * 200;
            const size = 12 + Math.random() * 20;
            const coinEmojis = ["🪙", "💰", "✨", "⭐", "💎"];
            return (
              <motion.div
                key={i}
                className="absolute text-center"
                style={{
                  left: "50%",
                  top: "50%",
                  fontSize: `${size}px`,
                  zIndex: 51,
                }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance + 100,
                  scale: [0, 1.5, 0.8],
                  opacity: [1, 1, 0],
                  rotate: Math.random() * 720 - 360,
                }}
                transition={{
                  duration: 2 + Math.random(),
                  delay: Math.random() * 0.5,
                  ease: "easeOut",
                }}
              >
                {coinEmojis[i % coinEmojis.length]}
              </motion.div>
            );
          })}
        </div>

        {/* Win Display */}
        <motion.div
          className="relative z-52 text-center"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: [0, 1.3, 1], rotate: [-10, 5, 0] }}
          transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
        >
          {/* Glow Ring */}
          <motion.div
            className="absolute -inset-16 rounded-full opacity-30"
            style={{ background: `radial-gradient(circle, ${theme.primary}60 0%, transparent 70%)` }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Title */}
          <motion.div
            className="text-5xl sm:text-6xl font-black mb-2"
            style={{
              background: `linear-gradient(135deg, #FFD700, ${theme.primary}, #FFD700)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 40px rgba(255,215,0,0.5)",
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            {multiplier >= 50 ? "MEGA WIN!" : multiplier >= 20 ? "SUPER WIN!" : "BIG WIN!"}
          </motion.div>

          {/* Multiplier */}
          <motion.div
            className="text-2xl font-bold text-white/80 mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {multiplier.toFixed(1)}x
          </motion.div>

          {/* Amount Counter */}
          <motion.div
            className="text-6xl sm:text-7xl font-black text-white"
            style={{ textShadow: `0 0 30px ${theme.primary}80, 0 4px 12px rgba(0,0,0,0.8)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            ${displayAmount.toFixed(2)}
          </motion.div>

          {/* Tap to continue */}
          <motion.p
            className="text-sm text-gray-400 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1] }}
            transition={{ delay: 2, duration: 2, repeat: Infinity }}
          >
            Tap to continue
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// CONTROL BAR - Aggressive UX
// ============================================
interface ControlBarProps {
  betAmount: string;
  setBetAmount: (val: string) => void;
  onSpin: () => void;
  spinning: boolean;
  disabled: boolean;
  freeSpinSession?: boolean;
  freeSpinsRemaining?: number;
  gameTheme: "candy" | "egypt" | "space" | "ocean";
  spinLabel?: string;
}

export function ControlBar({
  betAmount, setBetAmount, onSpin, spinning, disabled, freeSpinSession, freeSpinsRemaining, gameTheme, spinLabel
}: ControlBarProps) {
  const theme = THEME_COLORS[gameTheme];

  return (
    <div className="space-y-3">
      {/* Bet Amount */}
      {!freeSpinSession && (
        <div className="bg-[#131B2C] rounded-xl border border-white/10 p-4">
          <label className="text-sm text-gray-400 mb-2 block font-medium tracking-wide uppercase">Bet Amount</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full bg-[#070a11] border-2 border-white/10 rounded-lg pl-7 pr-3 py-3 text-white font-mono text-lg font-bold focus:border-[color:var(--focus-color)] focus:outline-none focus:shadow-[0_0_15px_var(--focus-glow)] transition-all"
                style={{ "--focus-color": theme.primary, "--focus-glow": theme.glow } as any}
                min="0.10"
                step="0.10"
                disabled={spinning}
              />
            </div>
            {/* Tactical Switches */}
            {[
              { label: "½", action: () => setBetAmount(Math.max(0.1, parseFloat(betAmount) / 2).toFixed(2)) },
              { label: "2×", action: () => setBetAmount(Math.min(1000, parseFloat(betAmount) * 2).toFixed(2)) },
              { label: "MAX", action: () => setBetAmount("100.00") },
            ].map((btn) => (
              <motion.button
                key={btn.label}
                onClick={btn.action}
                disabled={spinning}
                className="px-3 py-3 bg-[#070a11] border-2 border-white/15 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:border-white/30 transition-all uppercase tracking-wider"
                whileTap={{ scale: 0.9, y: 2 }}
                whileHover={{ scale: 1.05, borderColor: theme.primary }}
                style={{ boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.3)" }}
              >
                {btn.label}
              </motion.button>
            ))}
          </div>
          {/* Quick Bet Presets */}
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {[0.5, 1, 5, 10].map((amt) => (
              <motion.button
                key={amt}
                onClick={() => setBetAmount(amt.toFixed(2))}
                disabled={spinning}
                className={`py-2 text-xs font-bold rounded-lg border-2 transition-all uppercase tracking-wider
                  ${parseFloat(betAmount) === amt
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/5 bg-[#070a11] text-gray-500 hover:text-gray-300 hover:border-white/15"
                  }`}
                whileTap={{ scale: 0.95 }}
              >
                ${amt}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* SPIN BUTTON - Massive, Neon */}
      <motion.button
        onClick={onSpin}
        disabled={spinning || disabled}
        className={`w-full py-5 rounded-xl font-black text-xl uppercase tracking-widest relative overflow-hidden transition-all
          ${spinning ? "bg-gray-800 cursor-not-allowed text-gray-500" : "text-white"}
        `}
        style={!spinning ? {
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
          boxShadow: `0 4px 15px ${theme.glow}, 0 0 30px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        } : undefined}
        whileHover={!spinning ? { scale: 1.02, boxShadow: `0 6px 25px ${theme.glow}, 0 0 50px ${theme.glow}` } : undefined}
        whileTap={!spinning ? { scale: 0.97, y: 3 } : undefined}
        animate={!spinning && !disabled ? { boxShadow: [
          `0 4px 15px ${theme.glow}, 0 0 30px ${theme.glow}`,
          `0 4px 25px ${theme.glow}, 0 0 50px ${theme.glow}`,
          `0 4px 15px ${theme.glow}, 0 0 30px ${theme.glow}`,
        ] } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Shine Effect */}
        {!spinning && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
            animate={{ x: ["-200%", "200%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
          />
        )}

        <span className="relative z-10">
          {spinning ? (
            <span className="flex items-center justify-center gap-2">
              <motion.div
                className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              SPINNING...
            </span>
          ) : freeSpinSession ? (
            `🎰 FREE SPIN (${freeSpinsRemaining} LEFT)`
          ) : (
            spinLabel || `SPIN - $${parseFloat(betAmount).toFixed(2)}`
          )}
        </span>
      </motion.button>
    </div>
  );
}
