'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCrashGame, GameState, BetStatus } from '@/hooks/useCrashGame';
import { useSocket } from '@/contexts/SocketContext';
import { useSoundContextSafe } from '@/contexts/SoundContext';

/**
 * CrashGamePanel - Premium Crash Game Display V2
 * Features:
 * - 60fps Canvas rendering with rocket animation (RESPONSIVE)
 * - Sound effects with WORKING toggle button
 * - Keyboard hotkeys (SPACEBAR for bet/cashout)
 * - Smooth interpolation and glow effects
 * - Electric Cyberpunk theme
 * - AUTO-BET mode with configurable rounds
 * - PROVABLY FAIR panel with seed display
 * - Mobile responsive design
 * - Min/Max bet display
 */

// ==================== CONSTANTS ====================
const MIN_BET = 0.10;
const MAX_BET = 10000;

// Sound is now managed globally via SoundContext

// ==================== CONFETTI ====================
const Confetti: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  const colors = ['#FFD700', '#00F0FF', '#FF385C', '#00D46E', '#FF6B00'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// ==================== WIN CELEBRATION ====================
const WinCelebration: React.FC<{ amount: number; show: boolean }> = ({ amount, show }) => {
  if (!show) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className="animate-win-shake">
        <div className="text-5xl font-black text-green-400 animate-multiplier-pulse"
             style={{ textShadow: '0 0 40px #00D46E, 0 0 80px #00D46E' }}>
          +${amount.toFixed(2)}
        </div>
        <div className="text-center text-2xl text-yellow-400 mt-2 animate-coin-spin inline-block">
          🎉
        </div>
      </div>
    </div>
  );
};

// ==================== CRASH EXPLOSION ====================
const CrashExplosion: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="animate-crash-explosion">
        <div className="w-32 h-32 rounded-full bg-red-500/50"
             style={{ boxShadow: '0 0 60px #FF385C, 0 0 120px #FF385C' }} />
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const CrashGamePanel: React.FC = () => {
  const {
    gameState,
    currentMultiplier,
    crashPoint,
    countdown,
    gameId,
    betStatus,
    currentBet,
    potentialWin,
    recentCrashes,
    placeBet,
    cashOut,
    isConnected,
    error,
  } = useCrashGame();

  const { socket } = useSocket();
  const { playSound, toggleGameSound, gameSoundEnabled, isSoundActive, clientSeed: globalClientSeed, setClientSeed: setGlobalClientSeed } = useSoundContextSafe();

  // ==================== STATE ====================
  const [betAmount, setBetAmount] = useState<string>('100');
  const [autoCashout, setAutoCashout] = useState<string>('2.00');
  const [showError, setShowError] = useState(false);
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [showCrashExplosion, setShowCrashExplosion] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);

  // Tab state: MANUAL or AUTO
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AUTO'>('MANUAL');

  // Auto-bet state
  const [autoBetCount, setAutoBetCount] = useState<string>('10');
  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetRemaining, setAutoBetRemaining] = useState(0);
  const [stopOnWin, setStopOnWin] = useState<string>('');
  const [stopOnLoss, setStopOnLoss] = useState<string>('');
  const autoBetRef = useRef(false);

  // Provably Fair state
  const [showFairPanel, setShowFairPanel] = useState(false);
  const [lastServerSeedHash, setLastServerSeedHash] = useState<string>('');
  const [lastNonce, setLastNonce] = useState<number>(0);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphPointsRef = useRef<{ x: number; y: number; multiplier: number }[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const rocketAngleRef = useRef<number>(0);

  // ==================== RESPONSIVE CANVAS ====================
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // ==================== ERROR NOTIFICATION ====================
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ==================== RESET ON NEW GAME ====================
  useEffect(() => {
    if (gameState === 'WAITING') {
      graphPointsRef.current = [];
      rocketAngleRef.current = 0;
      setShowWinCelebration(false);
      setShowCrashExplosion(false);
      setShowConfetti(false);
    }
  }, [gameState]);

  // ==================== CRASH EFFECTS ====================
  useEffect(() => {
    if (gameState === 'CRASHED') {
      playSound('crash');
      setShowCrashExplosion(true);
      setTimeout(() => setShowCrashExplosion(false), 600);

      if (betStatus === 'CASHED_OUT' && potentialWin) {
        setLastWinAmount(potentialWin);
        setShowWinCelebration(true);
        setShowConfetti(true);
        setTimeout(() => {
          setShowWinCelebration(false);
          setShowConfetti(false);
        }, 3000);

        // Auto-bet: stop on win
        if (autoBetRef.current && stopOnWin) {
          const winThreshold = parseFloat(stopOnWin);
          if (!isNaN(winThreshold) && potentialWin >= winThreshold) {
            autoBetRef.current = false;
            setAutoBetActive(false);
            setAutoBetRemaining(0);
          }
        }
      }

      if (betStatus === 'LOST') {
        // Auto-bet: stop on loss
        if (autoBetRef.current && stopOnLoss) {
          const lossThreshold = parseFloat(stopOnLoss);
          const betAmt = parseFloat(betAmount);
          if (!isNaN(lossThreshold) && !isNaN(betAmt) && betAmt >= lossThreshold) {
            autoBetRef.current = false;
            setAutoBetActive(false);
            setAutoBetRemaining(0);
          }
        }
      }
    }
  }, [gameState, betStatus, potentialWin, playSound, stopOnWin, stopOnLoss, betAmount]);

  // ==================== AUTO-BET LOGIC ====================
  useEffect(() => {
    if (!autoBetRef.current) return;
    if (gameState !== 'WAITING') return;
    if (betStatus !== 'NONE') return;
    if (autoBetRemaining <= 0) {
      autoBetRef.current = false;
      setAutoBetActive(false);
      return;
    }

    // Place bet automatically after a short delay
    const timer = setTimeout(() => {
      if (!autoBetRef.current) return;
      const amount = parseFloat(betAmount);
      const autoCashoutValue = parseFloat(autoCashout);
      if (isNaN(amount) || amount <= 0) return;

      playSound('bet');
      placeBet(amount, autoCashoutValue > 1 ? autoCashoutValue : undefined);
      setAutoBetRemaining(prev => prev - 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, betStatus, autoBetRemaining, betAmount, autoCashout, placeBet, playSound]);

  // ==================== TICK SOUND ====================
  useEffect(() => {
    if (gameState === 'RUNNING') {
      const now = Date.now();
      if (now - lastTickRef.current > 500) {
        playSound('tick');
        lastTickRef.current = now;
      }
    }
  }, [currentMultiplier, gameState, playSound]);

  // ==================== LISTEN FOR FAIRNESS DATA ====================
  useEffect(() => {
    if (!socket) return;
    const handleFairnessData = (data: { serverSeedHash?: string; nonce?: number; previousServerSeed?: string }) => {
      if (data.serverSeedHash) setLastServerSeedHash(data.serverSeedHash);
      if (data.nonce !== undefined) setLastNonce(data.nonce);
    };
    socket.on('crash:fairness', handleFairnessData);
    // Also listen from bet_placed confirmation
    socket.on('crash:bet_placed', (data: any) => {
      if (data.serverSeedHash) setLastServerSeedHash(data.serverSeedHash);
      if (data.nonce !== undefined) setLastNonce(data.nonce);
    });
    return () => {
      socket.off('crash:fairness', handleFairnessData);
    };
  }, [socket]);

  // ==================== DRAW ROCKET ====================
  const drawRocket = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, crashed: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    if (crashed) {
      ctx.fillStyle = '#FF385C';
      ctx.shadowColor = '#FF385C';
    } else {
      ctx.fillStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
    }
    ctx.shadowBlur = 20;

    // Rocket shape
    ctx.moveTo(25, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

    // Flame trail (only when running)
    if (!crashed) {
      const gradient1 = ctx.createLinearGradient(-40, 0, -6, 0);
      gradient1.addColorStop(0, 'rgba(255, 100, 0, 0)');
      gradient1.addColorStop(0.3, 'rgba(255, 50, 0, 0.5)');
      gradient1.addColorStop(1, 'rgba(255, 200, 0, 0.8)');

      ctx.beginPath();
      ctx.fillStyle = gradient1;
      ctx.moveTo(-6, 0);
      ctx.lineTo(-35 - Math.random() * 15, -6);
      ctx.lineTo(-35 - Math.random() * 15, 6);
      ctx.closePath();
      ctx.fill();

      // Inner flame
      const gradient2 = ctx.createLinearGradient(-25, 0, -6, 0);
      gradient2.addColorStop(0, 'rgba(255, 255, 200, 0)');
      gradient2.addColorStop(1, 'rgba(255, 255, 255, 1)');

      ctx.beginPath();
      ctx.fillStyle = gradient2;
      ctx.moveTo(-6, 0);
      ctx.lineTo(-20 - Math.random() * 8, -3);
      ctx.lineTo(-20 - Math.random() * 8, 3);
      ctx.closePath();
      ctx.fill();

      // Particle sparks
      for (let i = 0; i < 5; i++) {
        const sparkX = -15 - Math.random() * 25;
        const sparkY = (Math.random() - 0.5) * 12;
        const sparkSize = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 105}, 0, ${Math.random()})`;
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Explosion particles when crashed
      for (let i = 0; i < 10; i++) {
        const angle2 = (Math.PI * 2 * i) / 10;
        const dist = 10 + Math.random() * 20;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, ${50 + Math.random() * 100}, 0, ${0.5 + Math.random() * 0.5})`;
        ctx.arc(Math.cos(angle2) * dist, Math.sin(angle2) * dist, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  // ==================== CANVAS ANIMATION ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    const draw = () => {
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, logicalHeight);
      bgGrad.addColorStop(0, '#050510');
      bgGrad.addColorStop(0.5, '#0a0a1a');
      bgGrad.addColorStop(1, '#0f0f25');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      const padding = { left: 60, right: 30, top: 30, bottom: 40 };
      const graphWidth = logicalWidth - padding.left - padding.right;
      const graphHeight = logicalHeight - padding.top - padding.bottom;

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (graphHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(logicalWidth - padding.right, y);
        ctx.stroke();
      }

      // Y-axis labels
      const maxMult = Math.max(currentMultiplier * 1.3, 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const val = 1 + ((maxMult - 1) * (4 - i)) / 4;
        const y = padding.top + (graphHeight * i) / 4;
        ctx.fillText(`${val.toFixed(1)}x`, padding.left - 8, y + 4);
      }

      // Draw graph line
      if (gameState === 'RUNNING' || gameState === 'CRASHED') {
        // Add current point
        if (gameState === 'RUNNING') {
          const progress = Math.min(graphPointsRef.current.length / 200, 1);
          const x = padding.left + progress * graphWidth;
          const yNorm = (currentMultiplier - 1) / (maxMult - 1);
          const y = padding.top + graphHeight - yNorm * graphHeight;
          graphPointsRef.current.push({ x, y, multiplier: currentMultiplier });
        }

        const points = graphPointsRef.current;
        if (points.length > 1) {
          // Recalculate positions based on current scale
          const recalcPoints = points.map((p, idx) => {
            const progress = idx / 200;
            const x = padding.left + Math.min(progress, 1) * graphWidth;
            const yNorm = (p.multiplier - 1) / (maxMult - 1);
            const y = padding.top + graphHeight - Math.min(yNorm, 1) * graphHeight;
            return { x, y };
          });

          // Gradient fill under curve
          const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + graphHeight);
          if (gameState === 'CRASHED') {
            gradient.addColorStop(0, 'rgba(255, 56, 92, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 56, 92, 0)');
          } else {
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
          }

          ctx.beginPath();
          ctx.moveTo(recalcPoints[0].x, padding.top + graphHeight);
          recalcPoints.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.lineTo(recalcPoints[recalcPoints.length - 1].x, padding.top + graphHeight);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw line
          ctx.beginPath();
          ctx.moveTo(recalcPoints[0].x, recalcPoints[0].y);
          recalcPoints.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.strokeStyle = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
          ctx.lineWidth = 3;
          ctx.shadowColor = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
          ctx.shadowBlur = 15;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Draw rocket at the end
          const lastPoint = recalcPoints[recalcPoints.length - 1];
          if (recalcPoints.length > 1) {
            const prevPoint = recalcPoints[recalcPoints.length - 2];
            rocketAngleRef.current = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);
          }
          drawRocket(ctx, lastPoint.x, lastPoint.y, rocketAngleRef.current, gameState === 'CRASHED');
        }
      }

      // Waiting state - draw pulsing circle
      if (gameState === 'WAITING') {
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2;
        const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;

        ctx.beginPath();
        ctx.arc(centerX, centerY, 40 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 240, 255, ${pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, currentMultiplier]);

  // ==================== KEYBOARD HOTKEYS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'WAITING' && betStatus === 'NONE') {
          handlePlaceBet();
        } else if (gameState === 'RUNNING' && betStatus === 'PLACED') {
          handleCashOut();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, betStatus]);

  // ==================== BET HANDLERS ====================
  const handlePlaceBet = () => {
    try {
      const amount = parseFloat(betAmount);
      const autoCashoutValue = parseFloat(autoCashout);
      if (isNaN(amount) || amount < MIN_BET) return;
      if (amount > MAX_BET) return;
      playSound('bet');
      placeBet(amount, autoCashoutValue > 1 ? autoCashoutValue : undefined);
    } catch (e) {
      console.error('Error placing bet:', e);
    }
  };

  const handleCashOut = () => {
    try {
      playSound('win');
      cashOut();
    } catch (e) {
      console.error('Error cashing out:', e);
    }
  };

  const handleStartAutoBet = () => {
    const count = parseInt(autoBetCount);
    if (isNaN(count) || count <= 0) return;
    autoBetRef.current = true;
    setAutoBetActive(true);
    setAutoBetRemaining(count);
  };

  const handleStopAutoBet = () => {
    autoBetRef.current = false;
    setAutoBetActive(false);
    setAutoBetRemaining(0);
  };

  // ==================== CLIENT SEED ====================
  const handleSetClientSeed = () => {
    if (!socket || !globalClientSeed.trim()) return;
    socket.emit('crash:set_client_seed', { clientSeed: globalClientSeed.trim() });
  };

  // ==================== DISPLAY HELPERS ====================
  const getMultiplierClass = () => {
    if (gameState === 'CRASHED') return 'text-red-500 animate-crash-shake';
    if (gameState === 'RUNNING') {
      if (currentMultiplier >= 10) return 'text-yellow-300 animate-multiplier-pulse';
      if (currentMultiplier >= 5) return 'text-yellow-400 animate-multiplier-glow';
      if (currentMultiplier >= 2) return 'text-green-400';
      return 'text-cyan-400';
    }
    if (gameState === 'WAITING') return 'text-gray-400 animate-waiting-pulse';
    return 'text-gray-400';
  };

  const getMultiplierDisplay = () => {
    if (gameState === 'WAITING') {
      return countdown > 0 ? `${Math.ceil(countdown)}s` : 'Starting...';
    }
    if (gameState === 'CRASHED') {
      return `CRASHED @ ${crashPoint?.toFixed(2)}x`;
    }
    return `${currentMultiplier.toFixed(2)}x`;
  };

  const getButtonConfig = () => {
    if (!isConnected) {
      return { text: 'CONNECTING...', disabled: true, className: 'bg-gray-600' };
    }
    if (gameState === 'WAITING') {
      if (betStatus === 'PLACED') {
        return { text: 'BET PLACED ✓', disabled: true, className: 'bg-green-600 btn-pulse-glow' };
      }
      return { text: 'PLACE BET [SPACE]', disabled: false, className: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 btn-shine' };
    }
    if (gameState === 'RUNNING') {
      if (betStatus === 'PLACED') {
        return {
          text: `CASHOUT $${potentialWin?.toFixed(2)} [SPACE]`,
          disabled: false,
          className: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 animate-multiplier-pulse btn-shine'
        };
      }
      return { text: 'WAITING...', disabled: true, className: 'bg-gray-600' };
    }
    if (gameState === 'CRASHED') {
      if (betStatus === 'CASHED_OUT') {
        return { text: `WON $${potentialWin?.toFixed(2)}!`, disabled: true, className: 'bg-gradient-to-r from-green-500 to-emerald-500 animate-win-shake' };
      }
      if (betStatus === 'LOST') {
        return { text: 'BUSTED', disabled: true, className: 'bg-gradient-to-r from-red-600 to-red-500' };
      }
      return { text: 'NEXT ROUND...', disabled: true, className: 'bg-gray-600' };
    }
    return { text: 'PLACE BET', disabled: true, className: 'bg-gray-600' };
  };

  const buttonConfig = getButtonConfig();

  // ==================== RENDER ====================
  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl p-4 md:p-6 shadow-2xl border border-gray-700/50 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="particle" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </div>

      {/* Confetti effect */}
      <Confetti show={showConfetti} />

      {/* Header with connection status, sound toggle, and fairness */}
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">
            {isConnected ? 'LIVE' : 'CONNECTING'}
          </span>
          {gameId && (
            <span className="text-xs text-gray-500 ml-2 font-mono">
              Game #{gameId.slice(-6)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Provably Fair Button */}
          <button
            onClick={() => setShowFairPanel(!showFairPanel)}
            className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 transition-colors text-xs text-gray-400 hover:text-green-400 border border-gray-700/50"
            title="Provably Fair"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </button>

          {/* Sound Toggle Button - synced with global Settings */}
          <button
            onClick={toggleGameSound}
            className={`p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 transition-colors border border-gray-700/50 ${
              !isSoundActive ? 'text-red-400' : 'text-gray-400 hover:text-white'
            }`}
            title={!isSoundActive ? 'Sound Off (enable in Settings)' : gameSoundEnabled ? 'Mute Game' : 'Unmute Game'}
          >
            {!isSoundActive ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Provably Fair Panel */}
      {showFairPanel && (
        <div className="mb-4 p-4 bg-gray-800/80 rounded-xl border border-gray-700/50 backdrop-blur-sm relative z-10">
          <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Provably Fair
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Server Seed Hash</label>
              <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 break-all border border-gray-700/30">
                {lastServerSeedHash || 'Play a round to see the hash'}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Nonce</label>
              <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 border border-gray-700/30">
                {lastNonce || 0}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Client Seed</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={globalClientSeed}
                  onChange={(e) => setGlobalClientSeed(e.target.value)}
                  placeholder="Enter your custom seed"
                  className="flex-1 bg-gray-900/60 border border-gray-700/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500 transition-colors"
                />
                <button
                  onClick={handleSetClientSeed}
                  className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition-colors"
                >
                  Set
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Each game result is determined by combining the server seed, client seed, and nonce.
              The server seed hash is shown before the game starts, and the actual seed is revealed
              after the round ends so you can verify fairness.
            </p>
          </div>
        </div>
      )}

      {/* Error notification */}
      {showError && error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm animate-notification-in backdrop-blur-sm relative z-10">
          {error}
        </div>
      )}

      {/* Main game display - RESPONSIVE */}
      <div className="relative mb-4 md:mb-6" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-gray-700/50"
          style={{
            height: 'clamp(200px, 40vw, 300px)',
            background: 'linear-gradient(180deg, #050510 0%, #0a0a1a 50%, #0f0f25 100%)'
          }}
        />

        {/* Crash explosion effect */}
        <CrashExplosion show={showCrashExplosion} />

        {/* Win celebration */}
        <WinCelebration amount={lastWinAmount} show={showWinCelebration} />

        {/* Multiplier overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black ${getMultiplierClass()} transition-all duration-200`}
               style={{ textShadow: '0 0 40px currentColor, 0 0 80px currentColor' }}>
            {getMultiplierDisplay()}
          </div>
        </div>
      </div>

      {/* Recent crashes */}
      <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {recentCrashes.slice(0, 10).map((crash, index) => (
          <div
            key={index}
            className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-mono whitespace-nowrap transition-all hover-scale ${
              crash >= 10 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-400 border border-yellow-500/30' :
              crash >= 2 ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
              'bg-red-500/20 text-red-400 border border-red-500/20'
            }`}
          >
            {crash.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* Tab Selector: MANUAL / AUTO */}
      <div className="flex mb-4 bg-gray-800/60 rounded-xl p-1 border border-gray-700/30">
        <button
          onClick={() => { setActiveTab('MANUAL'); handleStopAutoBet(); }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'MANUAL'
              ? 'bg-gray-700 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          MANUAL
        </button>
        <button
          onClick={() => setActiveTab('AUTO')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'AUTO'
              ? 'bg-gray-700 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          AUTO
        </button>
      </div>

      {/* Bet controls */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-medium">
            BET AMOUNT
            <span className="text-gray-600 ml-1">(${MIN_BET} - ${MAX_BET.toLocaleString()})</span>
          </label>
          <div className="flex">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-l-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              placeholder="100"
              min={MIN_BET}
              max={MAX_BET}
              disabled={betStatus !== 'NONE' || autoBetActive}
            />
            <div className="flex flex-col">
              <button
                onClick={() => setBetAmount((prev) => Math.min(parseFloat(prev) * 2, MAX_BET).toString())}
                className="bg-gray-700/80 px-2 md:px-3 py-1 text-xs hover:bg-gray-600 rounded-tr-lg transition-colors border-l border-gray-600/50"
                disabled={betStatus !== 'NONE' || autoBetActive}
              >
                2x
              </button>
              <button
                onClick={() => setBetAmount((prev) => Math.max(parseFloat(prev) / 2, MIN_BET).toString())}
                className="bg-gray-700/80 px-2 md:px-3 py-1 text-xs hover:bg-gray-600 rounded-br-lg transition-colors border-l border-t border-gray-600/50"
                disabled={betStatus !== 'NONE' || autoBetActive}
              >
                ½
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1 font-medium">AUTO CASHOUT</label>
          <input
            type="number"
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            placeholder="2.00"
            step="0.1"
            min="1.01"
            disabled={betStatus !== 'NONE' || autoBetActive}
          />
        </div>
      </div>

      {/* Auto-Bet Panel */}
      {activeTab === 'AUTO' && (
        <div className="mb-4 p-3 md:p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Number of Bets</label>
              <input
                type="number"
                value={autoBetCount}
                onChange={(e) => setAutoBetCount(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                min="1"
                max="1000"
                disabled={autoBetActive}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stop on Win ($)</label>
              <input
                type="number"
                value={stopOnWin}
                onChange={(e) => setStopOnWin(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Optional"
                disabled={autoBetActive}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stop on Loss ($)</label>
              <input
                type="number"
                value={stopOnLoss}
                onChange={(e) => setStopOnLoss(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Optional"
                disabled={autoBetActive}
              />
            </div>
          </div>

          {autoBetActive && (
            <div className="flex items-center justify-between bg-cyan-500/10 rounded-lg px-3 py-2 border border-cyan-500/20">
              <span className="text-xs text-cyan-400 font-medium">
                Auto-betting: {autoBetRemaining} rounds remaining
              </span>
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Main action button */}
      {activeTab === 'MANUAL' ? (
        <button
          onClick={betStatus === 'PLACED' && gameState === 'RUNNING' ? handleCashOut : handlePlaceBet}
          disabled={buttonConfig.disabled}
          className={`w-full py-3 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all duration-300 ${buttonConfig.className} disabled:opacity-50 disabled:cursor-not-allowed hover-lift relative overflow-hidden`}
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
        >
          <span className="relative z-10">{buttonConfig.text}</span>
        </button>
      ) : (
        <button
          onClick={autoBetActive ? handleStopAutoBet : handleStartAutoBet}
          className={`w-full py-3 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all duration-300 ${
            autoBetActive
              ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400'
          } hover-lift relative overflow-hidden`}
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
        >
          <span className="relative z-10">
            {autoBetActive ? `STOP AUTO-BET (${autoBetRemaining} left)` : 'START AUTO-BET'}
          </span>
        </button>
      )}

      {/* Current bet info */}
      {currentBet && (
        <div className="mt-3 md:mt-4 p-3 bg-gray-800/60 rounded-lg flex justify-between items-center backdrop-blur-sm border border-gray-700/30 animate-slide-in">
          <span className="text-gray-400 text-sm">Your Bet:</span>
          <span className="text-cyan-400 font-bold font-mono">${currentBet?.betAmount?.toFixed(2) || "0.00"}</span>
        </div>
      )}

      {/* Hotkey hint */}
      <div className="mt-3 md:mt-4 text-center text-xs text-gray-500">
        Press <kbd className="px-2 py-1 bg-gray-800/80 rounded text-gray-400 border border-gray-700/50 font-mono">SPACE</kbd> to {gameState === 'RUNNING' && betStatus === 'PLACED' ? 'Cashout' : 'Bet'}
      </div>
    </div>
  );
};

export default CrashGamePanel;
