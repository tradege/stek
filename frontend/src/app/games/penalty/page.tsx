"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundContext } from "@/contexts/SoundContext";
import Link from "next/link";
import config from "@/config/api";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = config.apiUrl;

interface MultiplierEntry {
  round: number;
  multiplier: number;
  goalProbability: string;
}

interface KickResult {
  sessionId: string;
  round: number;
  position: string;
  goalkeeperDive: string;
  isGoal: boolean;
  isSaved: boolean;
  currentMultiplier: number;
  nextMultiplier: number;
  canContinue: boolean;
  totalGoals: number;
  maxRounds: number;
}

interface PenaltySession {
  sessionId: string;
  betAmount: number;
  currentRound: number;
  currentMultiplier: number;
  goals: number;
  maxRounds: number;
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

type GamePhase = "idle" | "active" | "kicking" | "result" | "gameover";
type Position = "LEFT" | "CENTER" | "RIGHT";
type League = "UK" | "SPAIN" | "ITALY" | "BRAZIL";

const POSITION_MAP: Record<Position, { ballX: number; ballY: number; keeperX: number }> = {
  LEFT:   { ballX: 15, ballY: 55, keeperX: 15 },
  CENTER: { ballX: 50, ballY: 45, keeperX: 50 },
  RIGHT:  { ballX: 85, ballY: 55, keeperX: 85 },
};

const LEAGUE_CONFIG: Record<League, { name: string; flag: string; jerseyColor: string; jerseyAccent: string; shortsColor: string }> = {
  UK:     { name: "Premier League", flag: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F", jerseyColor: "#DC2626", jerseyAccent: "#FEF08A", shortsColor: "#FFFFFF" },
  SPAIN:  { name: "La Liga",       flag: "\uD83C\uDDEA\uD83C\uDDF8", jerseyColor: "#2563EB", jerseyAccent: "#FDE047", shortsColor: "#1E3A5F" },
  ITALY:  { name: "Serie A",       flag: "\uD83C\uDDEE\uD83C\uDDF9", jerseyColor: "#000000", jerseyAccent: "#3B82F6", shortsColor: "#FFFFFF" },
  BRAZIL: { name: "Brasileir\u00E3o",   flag: "\uD83C\uDDE7\uD83C\uDDF7", jerseyColor: "#EAB308", jerseyAccent: "#16A34A", shortsColor: "#1E3A5F" },
};

/* ===================== STADIUM BACKGROUND ===================== */
function StadiumBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Night sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a] via-[#111827] to-[#0f1923]" />

      {/* Stars */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute w-[2px] h-[2px] bg-white rounded-full"
          style={{
            top: `${5 + (i * 7) % 30}%`,
            left: `${(i * 13 + 3) % 100}%`,
            opacity: 0.3 + (i % 5) * 0.1,
          }}
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: (i % 4) * 0.5 }}
        />
      ))}

      {/* Stadium silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-[70%]">
        <svg viewBox="0 0 1200 400" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
          <path d="M0 400 L0 200 Q100 120 300 100 Q600 60 900 100 Q1100 120 1200 200 L1200 400 Z" fill="#1a1f2e" />
          <path d="M0 400 L0 220 Q100 140 300 120 Q600 80 900 120 Q1100 140 1200 220 L1200 400 Z" fill="#151a28" />
          {/* Crowd dots */}
          {Array.from({ length: 60 }).map((_, i) => (
            <circle
              key={`crowd-${i}`}
              cx={50 + (i * 19) % 1100}
              cy={100 + (i * 7) % 120}
              r={2 + (i % 3)}
              fill={["#666", "#888", "#555", "#777"][i % 4]}
              opacity={0.3 + (i % 4) * 0.08}
            />
          ))}
        </svg>
      </div>

      {/* Floodlights */}
      {[10, 90].map((x, idx) => (
        <div key={`light-${x}`} className="absolute" style={{ left: `${x}%`, top: "5%" }}>
          <div className="w-[3px] h-[80px] bg-gray-600 mx-auto" />
          <div className="w-[20px] h-[8px] bg-gray-400 rounded-sm mx-auto -mt-1" />
          <motion.div
            className="absolute top-[88px] left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "60px solid transparent",
              borderRight: "60px solid transparent",
              borderTop: "200px solid rgba(255,255,200,0.03)",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, delay: idx * 0.5 }}
          />
        </div>
      ))}

      {/* Center floodlights */}
      {[35, 65].map((x, idx) => (
        <div key={`clight-${x}`} className="absolute" style={{ left: `${x}%`, top: "2%" }}>
          <div className="w-[2px] h-[60px] bg-gray-600 mx-auto" />
          <div className="w-[16px] h-[6px] bg-gray-400 rounded-sm mx-auto -mt-1" />
          <motion.div
            className="absolute top-[66px] left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "40px solid transparent",
              borderRight: "40px solid transparent",
              borderTop: "150px solid rgba(255,255,200,0.02)",
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, delay: 1 + idx * 0.3 }}
          />
        </div>
      ))}
    </div>
  );
}

/* ===================== SOCCER GOAL WITH KEEPER ===================== */
function SoccerGoal({
  phase,
  kickResult,
  kickPosition,
  onKick,
  league,
  screenShake,
}: {
  phase: GamePhase;
  kickResult: KickResult | null;
  kickPosition: Position | null;
  onKick: (pos: Position) => void;
  league: League;
  screenShake: boolean;
}) {
  const showKickZones = phase === "active";
  const isAnimating = phase === "kicking" || phase === "result";
  const ballTarget = kickPosition ? POSITION_MAP[kickPosition] : null;
  const keeperTarget = kickResult?.goalkeeperDive
    ? POSITION_MAP[kickResult.goalkeeperDive as Position]
    : null;
  const lc = LEAGUE_CONFIG[league];

  return (
    <motion.div
      className="relative w-full max-w-[650px] mx-auto"
      style={{ aspectRatio: "16/10" }}
      animate={screenShake ? { x: [0, -8, 8, -6, 6, -3, 3, 0], y: [0, -4, 4, -3, 3, -1, 1, 0] } : {}}
      transition={{ duration: 0.5 }}
    >
      {/* Field Background with enhanced grass */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-900 via-green-800 to-green-700 rounded-2xl overflow-hidden shadow-2xl shadow-green-900/50">
        {/* Grass texture stripes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`grass-${i}`}
            className="absolute w-full"
            style={{
              top: `${i * 12.5}%`,
              height: "12.5%",
              backgroundColor: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.02)",
            }}
          />
        ))}
        {/* Field lines */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[60%] border-2 border-white/20 rounded-t-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[30%] border-2 border-white/20 rounded-t-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[4px] h-[8%] bg-white/30" />
        {/* Penalty spot */}
        <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[6px] h-[6px] bg-white/40 rounded-full" />
      </div>

      {/* Goal Frame - SVG */}
      <svg viewBox="0 0 100 65" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="postGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e0e0e0" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c0c0c0" />
          </linearGradient>
        </defs>
        <rect x="10" y="5" width="80" height="3" rx="1.5" fill="url(#postGrad)" />
        <rect x="10" y="5" width="3" height="45" rx="1.5" fill="url(#postGrad)" />
        <rect x="87" y="5" width="3" height="45" rx="1.5" fill="url(#postGrad)" />
        <rect x="13" y="8" width="74" height="39" rx="1" fill="white" opacity="0.06" />
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={13 + i * 10.5} y1="8" x2={13 + i * 10.5} y2="47" stroke="white" strokeWidth="0.3" opacity="0.12" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="13" y1={8 + i * 10} x2="87" y2={8 + i * 10} stroke="white" strokeWidth="0.3" opacity="0.12" />
        ))}
      </svg>

      {/* Goalkeeper with idle animation */}
      <motion.div
        className="absolute w-[40px] h-[60px] md:w-[50px] md:h-[70px]"
        style={{ bottom: "22%", left: "50%", marginLeft: "-20px" }}
        animate={
          keeperTarget
            ? {
                x: `${(keeperTarget.keeperX - 50) * 2.5}%`,
                scaleX: keeperTarget.keeperX < 50 ? -1 : 1,
                rotate: keeperTarget.keeperX === 50 ? 0 : keeperTarget.keeperX < 50 ? -25 : 25,
                y: keeperTarget.keeperX === 50 ? -10 : -5,
              }
            : phase === "active"
            ? { x: [0, -8, 0, 8, 0], y: [0, -3, 0, -2, 0] }
            : { x: 0, y: 0 }
        }
        transition={
          keeperTarget
            ? { type: "spring", stiffness: 300, damping: 12, delay: 0.15 }
            : phase === "active"
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        <svg viewBox="0 0 40 60" className="w-full h-full drop-shadow-lg">
          <ellipse cx="20" cy="59" rx="12" ry="2" fill="black" opacity="0.3" />
          <rect x="12" y="15" width="16" height="25" rx="3" fill={lc.jerseyColor} />
          <text x="20" y="30" textAnchor="middle" fill={lc.jerseyAccent} fontSize="8" fontWeight="bold">1</text>
          <rect x="15" y="14" width="10" height="3" rx="1" fill={lc.jerseyAccent} opacity="0.6" />
          <circle cx="20" cy="10" r="8" fill="#FDBCB4" />
          <ellipse cx="20" cy="5" rx="7" ry="4" fill="#333" />
          <motion.rect
            x="0" y="18" width="11" height="8" rx="4" fill="#FF4444"
            animate={
              keeperTarget
                ? { y: [18, 8, 18], x: [0, -3, 0] }
                : phase === "active"
                ? { y: [18, 16, 18] }
                : {}
            }
            transition={
              keeperTarget
                ? { duration: 0.3, delay: 0.2 }
                : { duration: 1.5, repeat: Infinity }
            }
          />
          <motion.rect
            x="29" y="18" width="11" height="8" rx="4" fill="#FF4444"
            animate={
              keeperTarget
                ? { y: [18, 8, 18], x: [29, 32, 29] }
                : phase === "active"
                ? { y: [18, 16, 18] }
                : {}
            }
            transition={
              keeperTarget
                ? { duration: 0.3, delay: 0.2 }
                : { duration: 1.5, repeat: Infinity, delay: 0.3 }
            }
          />
          <rect x="13" y="38" width="14" height="8" rx="2" fill={lc.shortsColor} />
          <rect x="14" y="44" width="5" height="14" rx="2" fill="#FDBCB4" />
          <rect x="21" y="44" width="5" height="14" rx="2" fill="#FDBCB4" />
          <rect x="14" y="50" width="5" height="8" rx="1" fill={lc.jerseyColor} opacity="0.8" />
          <rect x="21" y="50" width="5" height="8" rx="1" fill={lc.jerseyColor} opacity="0.8" />
          <rect x="13" y="56" width="7" height="4" rx="2" fill="#111" />
          <rect x="20" y="56" width="7" height="4" rx="2" fill="#111" />
        </svg>
      </motion.div>

      {/* Ball */}
      <AnimatePresence>
        {isAnimating && ballTarget && (
          <motion.div
            className="absolute w-[22px] h-[22px] md:w-[30px] md:h-[30px] z-20"
            style={{ bottom: "5%", left: "50%", marginLeft: "-11px" }}
            initial={{ bottom: "5%", left: "50%", scale: 1, rotate: 0 }}
            animate={{
              left: `${ballTarget.ballX}%`,
              bottom: `${ballTarget.ballY}%`,
              scale: 0.65,
              rotate: 720,
            }}
            transition={{ type: "spring", stiffness: 150, damping: 12, duration: 0.6 }}
          >
            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-xl">
              <circle cx="12" cy="12" r="11" fill="white" stroke="#333" strokeWidth="0.8" />
              <path d="M12 1 L14 5 L12 8 L10 5 Z" fill="#333" opacity="0.3" />
              <path d="M23 12 L19 14 L16 12 L19 10 Z" fill="#333" opacity="0.3" />
              <path d="M12 23 L10 19 L12 16 L14 19 Z" fill="#333" opacity="0.3" />
              <path d="M1 12 L5 10 L8 12 L5 14 Z" fill="#333" opacity="0.3" />
              <circle cx="12" cy="12" r="3" fill="#333" opacity="0.2" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kick Zones */}
      {showKickZones && (
        <div className="absolute inset-0 z-30">
          {(["LEFT", "CENTER", "RIGHT"] as Position[]).map((pos) => {
            const zones = {
              LEFT: "left-[10%] w-[27%] top-[8%] h-[60%]",
              CENTER: "left-[37%] w-[26%] top-[8%] h-[60%]",
              RIGHT: "right-[10%] w-[27%] top-[8%] h-[60%]",
            };
            return (
              <motion.button
                key={pos}
                onClick={() => onKick(pos)}
                className={`absolute ${zones[pos]} rounded-lg cursor-crosshair group`}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 border-2 border-dashed border-white/0 group-hover:border-white/40 rounded-lg transition-all flex items-center justify-center">
                  <motion.span
                    className="text-white/0 group-hover:text-white/90 font-bold text-sm md:text-base bg-black/50 px-4 py-1.5 rounded-full transition-all backdrop-blur-sm"
                    whileHover={{ scale: 1.1 }}
                  >
                    {pos}
                  </motion.span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* GOAL!!! Explosion Effect */}
      <AnimatePresence>
        {phase === "result" && kickResult && kickResult.isGoal && (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-green-500/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ duration: 0.5 }}
            />
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={`burst-${i}`}
                className="absolute w-[3px] bg-gradient-to-t from-yellow-400 to-transparent"
                style={{
                  height: "60px",
                  left: "50%",
                  top: "50%",
                  transformOrigin: "bottom center",
                  rotate: `${i * 30}deg`,
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, delay: 0.1 }}
              />
            ))}
            <motion.div
              className="relative"
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: [0, 1.4, 1], rotate: [-15, 5, 0] }}
              transition={{ type: "spring", stiffness: 500, damping: 12 }}
            >
              <div className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-500 drop-shadow-2xl"
                style={{ textShadow: "0 0 40px rgba(234,179,8,0.5), 0 0 80px rgba(234,179,8,0.3)" }}
              >
                GOAL!!!
              </div>
              <motion.div
                className="text-lg md:text-xl text-center text-yellow-300/80 font-bold mt-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                What a strike!
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BLOCKED Stamp Effect */}
      <AnimatePresence>
        {phase === "result" && kickResult && !kickResult.isGoal && (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-red-900/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.2] }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className="relative"
              initial={{ scale: 3, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: -8, opacity: 1 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
            >
              <div
                className="text-5xl md:text-7xl font-black text-red-500 border-[4px] border-red-500 px-6 py-2 rounded-lg"
                style={{
                  textShadow: "0 0 20px rgba(239,68,68,0.5)",
                  boxShadow: "0 0 30px rgba(239,68,68,0.3), inset 0 0 30px rgba(239,68,68,0.1)",
                }}
              >
                BLOCKED
              </div>
              <motion.div
                className="text-lg md:text-xl text-center text-red-400/80 font-bold mt-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Great save!
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ===================== MAIN PAGE ===================== */
export default function PenaltyPage() {
  const { user, refreshUser } = useAuth();
  const { isSoundActive } = useSoundContext();

  const [betAmount, setBetAmount] = useState<string>("1.00");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [session, setSession] = useState<PenaltySession | null>(null);
  const [kickResult, setKickResult] = useState<KickResult | null>(null);
  const [kickPosition, setKickPosition] = useState<Position | null>(null);
  const [multipliers, setMultipliers] = useState<MultiplierEntry[]>([]);
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [goalHistory, setGoalHistory] = useState<Array<{ round: number; isGoal: boolean; position: string }>>([]);
  const [league, setLeague] = useState<League>("UK");
  const [screenShake, setScreenShake] = useState(false);
  const [crowdNoise, setCrowdNoise] = useState(false);

  const goalSoundRef = useRef<HTMLAudioElement | null>(null);
  const saveSoundRef = useRef<HTMLAudioElement | null>(null);
  const whistleSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    goalSoundRef.current = new Audio("/sounds/win.mp3");
    saveSoundRef.current = new Audio("/sounds/bomb.mp3");
    whistleSoundRef.current = new Audio("/sounds/gem.mp3");
  }, []);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (isSoundActive && sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  };

  const getToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token") || "";
    }
    return "";
  };

  useEffect(() => {
    const fetchMultipliers = async () => {
      try {
        const res = await fetch(`${API_URL}/penalty/multipliers`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) setMultipliers(await res.json());
      } catch {}
    };
    if (user) fetchMultipliers();
  }, [user]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/penalty/history?limit=10`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  const triggerScreenShake = () => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 500);
  };

  const handleStartGame = async () => {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);
    setGoalHistory([]);
    setKickResult(null);
    setKickPosition(null);

    try {
      const res = await fetch(`${API_URL}/penalty/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ betAmount: parseFloat(betAmount) }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to start");
      }

      const data = await res.json();
      setSession(data);
      setPhase("active");
      playSound(whistleSoundRef.current);
      refreshUser();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKick = async (position: Position) => {
    if (!session || isLoading || phase !== "active") return;
    setError(null);
    setIsLoading(true);
    setKickPosition(position);
    setPhase("kicking");

    try {
      const res = await fetch(`${API_URL}/penalty/kick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          position,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to kick");
      }

      const data: KickResult = await res.json();
      setKickResult(data);

      await new Promise((r) => setTimeout(r, 800));
      setPhase("result");

      setGoalHistory((prev) => [...prev, { round: data.round, isGoal: data.isGoal, position }]);

      if (data.isGoal) {
        triggerScreenShake();
        playSound(goalSoundRef.current);
        setSession((prev) =>
          prev
            ? {
                ...prev,
                currentRound: data.round + 1,
                currentMultiplier: data.currentMultiplier,
                goals: data.totalGoals,
              }
            : null
        );

        setTimeout(() => {
          if (data.canContinue) {
            setPhase("active");
            setKickResult(null);
            setKickPosition(null);
          } else {
            handleCashout();
          }
        }, 1800);
      } else {
        playSound(saveSoundRef.current);
        setTimeout(() => {
          setPhase("gameover");
          setSession(null);
          refreshUser();
          fetchHistory();
        }, 2200);
      }
    } catch (err: any) {
      setError(err.message);
      setPhase("active");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCashout = async () => {
    if (!session || isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/penalty/cashout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to cashout");
      }

      const data = await res.json();
      playSound(goalSoundRef.current);
      setPhase("gameover");
      setSession(null);
      refreshUser();
      fetchHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = () => {
    setPhase("idle");
    setSession(null);
    setKickResult(null);
    setKickPosition(null);
    setGoalHistory([]);
  };

  const balance = parseFloat(user?.balance?.find((b: any) => b.currency === "USDT")?.available || "0");
  const cashoutAmount = session ? (parseFloat(betAmount) * session.currentMultiplier).toFixed(2) : "0.00";
  const lc = LEAGUE_CONFIG[league];

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <StadiumBackground />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Header with League Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <Link href="/games" className="text-gray-400 hover:text-white transition-colors">
              &larr; Back
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Penalty Shootout
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* League Selector */}
            <div className="relative">
              <select
                value={league}
                onChange={(e) => setLeague(e.target.value as League)}
                disabled={phase === "active" || phase === "kicking"}
                className="bg-[#1a2c38]/80 backdrop-blur-sm border border-[#2f4553] rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer pr-8 focus:outline-none focus:border-green-500 transition-colors disabled:opacity-50"
              >
                {(Object.keys(LEAGUE_CONFIG) as League[]).map((l) => (
                  <option key={l} value={l}>
                    {LEAGUE_CONFIG[l].flag} {LEAGUE_CONFIG[l].name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">&#x25BC;</div>
            </div>
            {/* Crowd Noise Toggle */}
            <button
              onClick={() => setCrowdNoise(!crowdNoise)}
              className={`p-2 rounded-lg border transition-all ${
                crowdNoise
                  ? "bg-green-500/20 border-green-500/50 text-green-400"
                  : "bg-[#1a2c38]/80 border-[#2f4553] text-gray-400"
              }`}
              title={crowdNoise ? "Crowd: ON" : "Crowd: OFF"}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </button>
            {/* Balance */}
            <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#2f4553]">
              <span className="text-gray-400 text-sm">Balance: </span>
              <span className="text-[#00F0FF] font-bold font-mono">${balance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* League Banner */}
        <motion.div
          className="mb-4 flex items-center gap-2 justify-center"
          key={league}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className="h-1 flex-1 max-w-[100px] rounded-full"
            style={{ backgroundColor: lc.jerseyColor, opacity: 0.5 }}
          />
          <span className="text-sm font-semibold text-gray-300">
            {lc.flag} {lc.name}
          </span>
          <div
            className="h-1 flex-1 max-w-[100px] rounded-full"
            style={{ backgroundColor: lc.jerseyColor, opacity: 0.5 }}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="space-y-4">
            {/* Bet Amount */}
            <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553] p-4">
              <label className="text-xs text-gray-400 mb-2 block font-semibold uppercase tracking-wider">Bet Amount</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-green-500 transition-colors"
                  min="0.10"
                  step="0.10"
                  disabled={phase !== "idle" && phase !== "gameover"}
                />
                <button
                  onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))}
                  className="px-3 py-2 bg-[#2f4553] rounded-lg text-sm hover:bg-[#3d5a6e] transition-colors"
                  disabled={phase !== "idle" && phase !== "gameover"}
                >
                  &frac12;
                </button>
                <button
                  onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))}
                  className="px-3 py-2 bg-[#2f4553] rounded-lg text-sm hover:bg-[#3d5a6e] transition-colors"
                  disabled={phase !== "idle" && phase !== "gameover"}
                >
                  2&times;
                </button>
              </div>
            </div>

            {/* Game Status */}
            {session && (
              <motion.div
                className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553] p-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className="text-xs text-gray-400 mb-3 block font-semibold uppercase tracking-wider">Current Session</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400">Round</div>
                    <div className="text-white font-bold text-xl">
                      {session.currentRound}/{session.maxRounds}
                    </div>
                  </div>
                  <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400">Goals</div>
                    <div className="text-green-400 font-bold text-xl">{session.goals}</div>
                  </div>
                  <div className="bg-[#0f1923]/80 rounded-lg p-3 text-center col-span-2">
                    <div className="text-xs text-gray-400">Current Multiplier</div>
                    <motion.div
                      className="text-cyan-400 font-bold text-2xl"
                      key={session.currentMultiplier}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                    >
                      {session.currentMultiplier.toFixed(2)}&times;
                    </motion.div>
                  </div>
                </div>

                {goalHistory.length > 0 && (
                  <div className="flex gap-2 mt-3 justify-center">
                    {goalHistory.map((g, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          g.isGoal
                            ? "bg-green-500/20 text-green-400 border border-green-500/40"
                            : "bg-red-500/20 text-red-400 border border-red-500/40"
                        }`}
                      >
                        {g.isGoal ? "\u26BD" : "\u270B"}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Action Buttons */}
            {(phase === "idle" || phase === "gameover") && (
              <motion.button
                onClick={phase === "gameover" ? resetGame : handleStartGame}
                disabled={isLoading || !betAmount || parseFloat(betAmount) <= 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === "gameover" ? "New Game" : "Start Game \u26BD"}
              </motion.button>
            )}

            {/* Cashout Button */}
            {(phase === "active" || phase === "result") && session && session.goals > 0 && (
              <motion.button
                onClick={handleCashout}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/30"
              >
                <motion.span
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  Cashout ${cashoutAmount}
                </motion.span>
              </motion.button>
            )}

            {phase === "active" && (
              <motion.div
                className="text-center text-sm text-gray-300 bg-[#1a2c38]/60 backdrop-blur-sm rounded-lg py-2 border border-[#2f4553]/50"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Click on the goal to shoot!
              </motion.div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center - Goal Area */}
          <div className="lg:col-span-2">
            {/* TV Broadcast Frame */}
            <div className="relative">
              {session && (
                <motion.div
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0 text-xs font-bold"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="bg-[#1a1a2e]/90 backdrop-blur-sm px-3 py-1.5 rounded-l-lg border border-[#2f4553]/50">
                    <span className="text-gray-300">ROUND</span>
                    <span className="text-white ml-1">{session.currentRound}</span>
                  </div>
                  <div className="bg-green-600/90 backdrop-blur-sm px-3 py-1.5 border-y border-green-500/50">
                    <span className="text-white">{session.goals} \u26BD</span>
                  </div>
                  <div className="bg-[#1a1a2e]/90 backdrop-blur-sm px-3 py-1.5 rounded-r-lg border border-[#2f4553]/50">
                    <span className="text-cyan-400">{session.currentMultiplier.toFixed(2)}&times;</span>
                  </div>
                </motion.div>
              )}

              <SoccerGoal
                phase={phase}
                kickResult={kickResult}
                kickPosition={kickPosition}
                onKick={handleKick}
                league={league}
                screenShake={screenShake}
              />
            </div>

            {/* Game Over Overlay */}
            <AnimatePresence>
              {phase === "gameover" && (
                <motion.div
                  className="mt-4 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553] p-6 inline-block">
                    <div className="text-xl font-bold text-gray-300 mb-2">Full Time</div>
                    <div className="text-3xl font-bold mb-1">
                      {goalHistory.filter((g) => g.isGoal).length} Goals
                    </div>
                    <div className="text-gray-400 text-sm">
                      {goalHistory.length} kicks total
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Payout Statistics Table */}
            {multipliers.length > 0 && (
              <div className="mt-6 bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#2f4553] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <h3 className="font-semibold text-sm text-gray-200">Payout Table</h3>
                    <span className="text-xs text-gray-500 font-mono">(${parseFloat(betAmount || "1").toFixed(2)} bet)</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#0f1923] text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-3 py-2.5 text-left">Goal</th>
                        <th className="px-3 py-2.5 text-right">Multiplier</th>
                        <th className="px-3 py-2.5 text-right">Payout</th>
                        <th className="px-3 py-2.5 text-right">Profit</th>
                        <th className="px-3 py-2.5 text-right">Goal %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multipliers.map((m) => {
                        const bet = parseFloat(betAmount || "1");
                        const payout = Math.floor(bet * m.multiplier * 100) / 100;
                        const profit = Math.floor((payout - bet) * 100) / 100;
                        const isActive = session && session.currentRound === m.round;
                        const isPast = session && m.round < session.currentRound;
                        const goalAtRound = goalHistory.find((g) => g.round === m.round);
                        const isScored = isPast && goalAtRound?.isGoal;
                        const isMissed = isPast && goalAtRound && !goalAtRound.isGoal;
                        return (
                          <tr
                            key={m.round}
                            className={`border-b border-[#2f4553]/30 transition-all ${
                              isActive
                                ? "bg-green-500/15 border-green-500/40"
                                : isScored
                                ? "bg-green-500/5"
                                : isMissed
                                ? "bg-red-500/5"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {isScored ? (
                                  <span className="text-green-400 text-xs">\u26BD</span>
                                ) : isMissed ? (
                                  <span className="text-red-400 text-xs">\u270B</span>
                                ) : isActive ? (
                                  <motion.span
                                    animate={{ scale: [1, 1.3, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="text-green-400 text-xs"
                                  >
                                    \u25CF
                                  </motion.span>
                                ) : (
                                  <span className="text-gray-600 text-xs">{m.round}</span>
                                )}
                                <span className={`font-mono text-xs ${
                                  isActive ? "text-green-300 font-bold" : isScored ? "text-green-400/70" : "text-gray-300"
                                }`}>
                                  Goal {m.round}
                                </span>
                              </div>
                            </td>
                            <td className={`px-3 py-2 text-right font-mono text-xs ${
                              isActive ? "text-cyan-300 font-bold" : "text-gray-300"
                            }`}>
                              {m.multiplier.toFixed(2)}&times;
                            </td>
                            <td className={`px-3 py-2 text-right font-mono text-xs ${
                              isActive ? "text-yellow-300 font-bold" : "text-gray-300"
                            }`}>
                              ${payout.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                              profit > 0
                                ? isActive ? "text-green-300" : "text-green-400/80"
                                : "text-red-400/80"
                            }`}>
                              {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                              {m.goalProbability}
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
                    {multipliers.length} rounds | 66.7% goal chance per kick
                  </span>
                  <span className="text-gray-500">
                    Max win: <span className="text-yellow-400 font-mono font-bold">
                      ${multipliers.length > 0 ? (parseFloat(betAmount || "1") * multipliers[multipliers.length - 1].multiplier).toFixed(2) : "0.00"}
                    </span>
                    {" "}({multipliers.length > 0 ? multipliers[multipliers.length - 1].multiplier.toFixed(2) : "0"}&times;)
                  </span>
                </div>
              </div>
            )}

            {/* History Table */}
            <div className="mt-4 bg-[#1a2c38]/80 backdrop-blur-sm rounded-xl border border-[#2f4553] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2f4553]">
                <h3 className="font-semibold text-sm text-gray-300">Recent Games</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-[#2f4553]">
                      <th className="px-4 py-2 text-left">Goals</th>
                      <th className="px-4 py-2 text-left">Result</th>
                      <th className="px-4 py-2 text-right">Bet</th>
                      <th className="px-4 py-2 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No games yet
                        </td>
                      </tr>
                    ) : (
                      history.map((bet) => {
                        const profit = parseFloat(bet.profit);
                        return (
                          <tr key={bet.id} className="border-b border-[#2f4553]/50 hover:bg-white/5">
                            <td className="px-4 py-2">
                              <span className="text-green-400 font-mono">
                                {bet.gameData?.goals || "?"} \u26BD
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                bet.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              }`}>
                                {bet.isWin ? "CASHED OUT" : "SAVED"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-mono">${parseFloat(bet.betAmount).toFixed(2)}</td>
                            <td className={`px-4 py-2 text-right font-mono font-bold ${
                              profit >= 0 ? "text-green-400" : "text-red-400"
                            }`}>
                              {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                            </td>
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
