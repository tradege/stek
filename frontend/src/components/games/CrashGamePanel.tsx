'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCrashGame, GameState, BetStatus } from '@/hooks/useCrashGame';
import { useSocket } from '@/contexts/SocketContext';

/**
 * CrashGamePanel - Premium Crash Game Display
 * Features:
 * - 60fps Canvas rendering with rocket animation
 * - Sound effects (tick, crash, win)
 * - Keyboard hotkeys (SPACEBAR for bet/cashout)
 * - Smooth interpolation and glow effects
 * - Electric Cyberpunk theme
 * - Enhanced animations and UX
 */

// Sound manager hook
const useSoundManager = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundsRef = useRef<{ [key: string]: AudioBuffer }>({});
  const isMutedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Initialize AudioContext on first user interaction
    const initAudio = () => { if (typeof window === 'undefined') return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  const playSound = useCallback((type: 'tick' | 'crash' | 'win' | 'bet') => {
    // SAFETY: Wrap all sound logic in try-catch to prevent app crashes
    try {
      if (isMutedRef.current || !audioContextRef.current) return;
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      switch (type) {
        case 'tick':
          oscillator.frequency.value = 800 + Math.random() * 200;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.05;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.05);
          break;
        case 'crash':
          oscillator.frequency.value = 150;
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.5);
          break;
        case 'win':
          oscillator.frequency.value = 523.25; // C5
          oscillator.type = 'sine';
          gainNode.gain.value = 0.2;
          oscillator.start();
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'bet':
          oscillator.frequency.value = 440;
          oscillator.type = 'square';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.1);
          break;
      }
    } catch (e) {
      console.warn('Sound playback failed:', e);
      // Don't crash the app, just log the warning
    }
  }, []);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
  }, []);

  return { playSound, toggleMute, isMuted };
};

// Confetti particle component
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

// Win celebration overlay
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

// Crash explosion effect
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
  const { playSound, toggleMute, isMuted } = useSoundManager();
  
  const [betAmount, setBetAmount] = useState<string>('100');
  const [autoCashout, setAutoCashout] = useState<string>('2.00');
  const [showError, setShowError] = useState(false);
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [showCrashExplosion, setShowCrashExplosion] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphPointsRef = useRef<{ x: number; y: number; multiplier: number }[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const rocketAngleRef = useRef<number>(0);

  // Show error notification
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Reset graph on new game
  useEffect(() => {
    if (gameState === 'WAITING') {
      graphPointsRef.current = [];
      rocketAngleRef.current = 0;
      setShowWinCelebration(false);
      setShowCrashExplosion(false);
      setShowConfetti(false);
    }
  }, [gameState]);

  // Play crash sound and show explosion
  useEffect(() => {
    if (gameState === 'CRASHED') {
      playSound('crash');
      setShowCrashExplosion(true);
      setTimeout(() => setShowCrashExplosion(false), 600);
      
      // Check if player won
      if (betStatus === 'CASHED_OUT' && potentialWin) {
        setLastWinAmount(potentialWin);
        setShowWinCelebration(true);
        setShowConfetti(true);
        setTimeout(() => {
          setShowWinCelebration(false);
          setShowConfetti(false);
        }, 3000);
      }
    }
  }, [gameState, betStatus, potentialWin, playSound]);

  // Play tick sound while running
  useEffect(() => {
    if (gameState === 'RUNNING') {
      const now = Date.now();
      if (now - lastTickRef.current > 500) { // Tick every 500ms
        playSound('tick');
        lastTickRef.current = now;
      }
    }
  }, [currentMultiplier, gameState, playSound]);

  // Draw rocket/ship icon with enhanced effects
  const drawRocket = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, crashed: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Rocket body
    ctx.beginPath();
    if (crashed) {
      ctx.fillStyle = '#FF385C';
      ctx.shadowColor = '#FF385C';
    } else {
      ctx.fillStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
    }
    ctx.shadowBlur = 20;
    
    // Draw rocket shape
    ctx.moveTo(25, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    
    // Flame trail (only when running) - Enhanced with multiple layers
    if (!crashed) {
      // Outer flame
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
      
      // Inner flame (brighter)
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
        const angle = (Math.PI * 2 / 10) * i;
        const dist = 10 + Math.random() * 20;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, ${50 + Math.random() * 100}, 0, ${0.5 + Math.random() * 0.5})`;
        ctx.arc(px, py, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  };

  // Draw stars background with twinkling effect
  const drawStars = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const starCount = 60;
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < starCount; i++) {
      const x = (Math.sin(i * 123.456) * 0.5 + 0.5) * width;
      const y = (Math.cos(i * 789.012) * 0.5 + 0.5) * height;
      const twinkle = Math.sin(time * 2 + i * 0.5) * 0.5 + 0.5;
      const size = (twinkle * 1.5 + 0.5);
      
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.5})`;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Add glow to some stars
      if (i % 5 === 0) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 240, 255, ${0.1 * twinkle})`;
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // Main canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas with dark gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#050510');
      bgGradient.addColorStop(0.5, '#0a0a1a');
      bgGradient.addColorStop(1, '#0f0f25');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      drawStars(ctx, width, height);

      // Draw grid with subtle glow
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines with labels
      for (let i = 1; i < 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Multiplier labels
        const mult = (5 - i) * 2;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.font = '11px monospace';
        ctx.fillText(`${mult}x`, 8, y - 5);
      }
      
      // Vertical grid lines
      for (let i = 1; i < 8; i++) {
        const x = (width / 8) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (gameState === 'RUNNING' || gameState === 'CRASHED') {
        // Add new point with smooth interpolation
        const maxMultiplier = Math.max(currentMultiplier, 2);
        const logMax = Math.log(maxMultiplier + 1);
        const logCurrent = Math.log(currentMultiplier + 1);
        
        const x = Math.min(graphPointsRef.current.length * 3, width - 50);
        const y = height - (logCurrent / logMax) * (height - 80);
        
        if (gameState === 'RUNNING' && graphPointsRef.current.length < width / 3) {
          graphPointsRef.current.push({ x, y, multiplier: currentMultiplier });
          
          // Calculate rocket angle based on trajectory
          if (graphPointsRef.current.length > 1) {
            const prev = graphPointsRef.current[graphPointsRef.current.length - 2];
            rocketAngleRef.current = Math.atan2(prev.y - y, x - prev.x);
          }
        }

        // Draw gradient fill
        if (graphPointsRef.current.length > 1) {
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          if (gameState === 'CRASHED') {
            gradient.addColorStop(0, 'rgba(255, 56, 92, 0)');
            gradient.addColorStop(0.5, 'rgba(255, 56, 92, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 56, 92, 0.5)');
          } else {
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0)');
            gradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0.4)');
          }

          // Draw filled area
          ctx.beginPath();
          ctx.moveTo(0, height);
          
          graphPointsRef.current.forEach((point, index) => {
            ctx.lineTo(point.x, point.y);
          });
          
          const lastPoint = graphPointsRef.current[graphPointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, height);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw line with enhanced glow
          ctx.beginPath();
          ctx.strokeStyle = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
          ctx.shadowBlur = 25;
          
          graphPointsRef.current.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              // Smooth curve using quadratic bezier
              const prev = graphPointsRef.current[index - 1];
              const cpX = (prev.x + point.x) / 2;
              const cpY = (prev.y + point.y) / 2;
              ctx.quadraticCurveTo(prev.x, prev.y, cpX, cpY);
            }
          });
          
          ctx.stroke();
          
          // Draw second glow layer
          ctx.shadowBlur = 40;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;

          // Draw rocket at the tip
          drawRocket(ctx, lastPoint.x, lastPoint.y, rocketAngleRef.current, gameState === 'CRASHED');
        }
      }

      // Continue animation
      if (gameState === 'RUNNING') {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentMultiplier, gameState]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

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

  // Handle bet placement - wrapped in try-catch to prevent black screen crashes
  const handlePlaceBet = () => {
    try {
      const amount = parseFloat(betAmount);
      const autoCashoutValue = parseFloat(autoCashout);
      
      if (isNaN(amount) || amount <= 0) {
        return;
      }
      
      playSound('bet');
      placeBet(amount, autoCashoutValue > 1 ? autoCashoutValue : undefined);
    } catch (e) {
      console.error('Error placing bet:', e);
      // Don't crash the app
    }
  };

  // Handle cashout - wrapped in try-catch to prevent crashes
  const handleCashOut = () => {
    try {
      playSound('win');
      cashOut();
    } catch (e) {
      console.error('Error cashing out:', e);
      // Don't crash the app
    }
  };

  // Get multiplier display class with enhanced animations
  const getMultiplierClass = () => {
    if (gameState === 'CRASHED') {
      return 'text-red-500 animate-crash-shake';
    }
    if (gameState === 'RUNNING') {
      if (currentMultiplier >= 10) return 'text-yellow-300 animate-multiplier-pulse';
      if (currentMultiplier >= 5) return 'text-yellow-400 animate-multiplier-glow';
      if (currentMultiplier >= 2) return 'text-green-400';
      return 'text-cyan-400';
    }
    if (gameState === 'WAITING') {
      return 'text-gray-400 animate-waiting-pulse';
    }
    return 'text-gray-400';
  };

  // Get multiplier display value - FIXED: Show countdown as integer
  const getMultiplierDisplay = () => {
    if (gameState === 'WAITING') {
      return countdown > 0 ? `${Math.ceil(countdown)}s` : 'Starting...';
    }
    if (gameState === 'CRASHED') {
      return `CRASHED @ ${crashPoint?.toFixed(2)}x`;
    }
    return `${currentMultiplier.toFixed(2)}x`;
  };

  // Get button state with enhanced styling
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
        return { text: `WON $${potentialWin?.toFixed(2)}! 🎉`, disabled: true, className: 'bg-gradient-to-r from-green-500 to-emerald-500 animate-win-shake' };
      }
      if (betStatus === 'LOST') {
        return { text: 'BUSTED 💥', disabled: true, className: 'bg-gradient-to-r from-red-600 to-red-500' };
      }
      return { text: 'NEXT ROUND...', disabled: true, className: 'bg-gray-600' };
    }
    
    return { text: 'PLACE BET', disabled: true, className: 'bg-gray-600' };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700/50 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="particle" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </div>
      
      {/* Confetti effect */}
      <Confetti show={showConfetti} />
      
      {/* Header with connection status and mute */}
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
        
        {/* Mute button */}
        <button
          onClick={toggleMute}
          className="p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 transition-all hover-scale"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>

      {/* Error notification */}
      {showError && error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm animate-notification-in backdrop-blur-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Main game display */}
      <div className="relative mb-6">
        {/* Canvas graph */}
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          className="w-full h-64 rounded-xl border border-gray-700/50"
          style={{ background: 'linear-gradient(180deg, #050510 0%, #0a0a1a 50%, #0f0f25 100%)' }}
        />
        
        {/* Crash explosion effect */}
        <CrashExplosion show={showCrashExplosion} />
        
        {/* Win celebration */}
        <WinCelebration amount={lastWinAmount} show={showWinCelebration} />
        
        {/* Multiplier overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-6xl md:text-7xl font-black ${getMultiplierClass()} transition-all duration-200`}
               style={{ textShadow: '0 0 40px currentColor, 0 0 80px currentColor' }}>
            {getMultiplierDisplay()}
          </div>
        </div>
      </div>

      {/* Recent crashes with enhanced styling */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {recentCrashes.slice(0, 10).map((crash, index) => (
          <div
            key={index}
            className={`px-3 py-1.5 rounded-full text-sm font-mono whitespace-nowrap transition-all hover-scale ${
              crash >= 10 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-400 border border-yellow-500/30' :
              crash >= 2 ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 
              'bg-red-500/20 text-red-400 border border-red-500/20'
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {crash.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* Bet controls with enhanced styling */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-medium">BET AMOUNT</label>
          <div className="flex">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-l-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              placeholder="100"
              disabled={betStatus !== 'NONE'}
            />
            <div className="flex flex-col">
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toString())}
                className="bg-gray-700/80 px-3 py-1 text-xs hover:bg-gray-600 rounded-tr-lg transition-colors border-l border-gray-600/50"
                disabled={betStatus !== 'NONE'}
              >
                2x
              </button>
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toString())}
                className="bg-gray-700/80 px-3 py-1 text-xs hover:bg-gray-600 rounded-br-lg transition-colors border-l border-t border-gray-600/50"
                disabled={betStatus !== 'NONE'}
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
            className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            placeholder="2.00"
            step="0.1"
            min="1.01"
            disabled={betStatus !== 'NONE'}
          />
        </div>
      </div>

      {/* Main action button with enhanced animations */}
      <button
        onClick={betStatus === 'PLACED' && gameState === 'RUNNING' ? handleCashOut : handlePlaceBet}
        disabled={buttonConfig.disabled}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${buttonConfig.className} disabled:opacity-50 disabled:cursor-not-allowed hover-lift relative overflow-hidden`}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
      >
        <span className="relative z-10">{buttonConfig.text}</span>
      </button>

      {/* Current bet info with animation */}
      {currentBet && (
        <div className="mt-4 p-3 bg-gray-800/60 rounded-lg flex justify-between items-center backdrop-blur-sm border border-gray-700/30 animate-slide-in">
          <span className="text-gray-400">Your Bet:</span>
          <span className="text-cyan-400 font-bold font-mono">${currentBet?.betAmount?.toFixed(2) || "0.00"}</span>
        </div>
      )}

      {/* Hotkey hint */}
      <div className="mt-4 text-center text-xs text-gray-500">
        Press <kbd className="px-2 py-1 bg-gray-800/80 rounded text-gray-400 border border-gray-700/50 font-mono">SPACE</kbd> to {gameState === 'RUNNING' && betStatus === 'PLACED' ? 'Cashout' : 'Bet'}
      </div>
    </div>
  );
};

export default CrashGamePanel;
