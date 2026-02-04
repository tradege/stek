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
    }
  }, [gameState]);

  // Play crash sound
  useEffect(() => {
    if (gameState === 'CRASHED') {
      playSound('crash');
    }
  }, [gameState, playSound]);

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

  // Draw rocket/ship icon
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
    ctx.shadowBlur = 15;
    
    // Draw rocket shape
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    
    // Flame trail (only when running)
    if (!crashed) {
      const gradient = ctx.createLinearGradient(-30, 0, -5, 0);
      gradient.addColorStop(0, 'rgba(255, 165, 0, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 200, 0, 1)');
      
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.moveTo(-5, 0);
      ctx.lineTo(-25 - Math.random() * 10, -4);
      ctx.lineTo(-25 - Math.random() * 10, 4);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  };

  // Draw stars background
  const drawStars = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const starCount = 50;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    
    for (let i = 0; i < starCount; i++) {
      const x = (Math.sin(i * 123.456) * 0.5 + 0.5) * width;
      const y = (Math.cos(i * 789.012) * 0.5 + 0.5) * height;
      const size = (Math.sin(i * 345.678 + Date.now() * 0.001) * 0.5 + 0.5) * 2 + 0.5;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
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

      // Clear canvas with dark background
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      drawStars(ctx, width, height);

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
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
        ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.font = '10px monospace';
        ctx.fillText(`${mult}x`, 5, y - 5);
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
            gradient.addColorStop(0.5, 'rgba(255, 56, 92, 0.15)');
            gradient.addColorStop(1, 'rgba(255, 56, 92, 0.4)');
          } else {
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0)');
            gradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0.3)');
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

          // Draw line with glow
          ctx.beginPath();
          ctx.strokeStyle = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
          ctx.shadowBlur = 20;
          
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

  // Get multiplier display class
  const getMultiplierClass = () => {
    if (gameState === 'CRASHED') {
      return 'text-red-500 animate-pulse';
    }
    if (gameState === 'RUNNING') {
      if (currentMultiplier >= 5) return 'text-yellow-400';
      if (currentMultiplier >= 2) return 'text-green-400';
      return 'text-cyan-400';
    }
    return 'text-gray-400';
  };

  // Get multiplier display value
  const getMultiplierDisplay = () => {
    if (gameState === 'WAITING') {
      return countdown > 0 ? `${countdown.toFixed(1)}s` : 'Starting...';
    }
    if (gameState === 'CRASHED') {
      return `CRASHED @ ${crashPoint?.toFixed(2)}x`;
    }
    return `${currentMultiplier.toFixed(2)}x`;
  };

  // Get button state
  const getButtonConfig = () => {
    if (!isConnected) {
      return { text: 'CONNECTING...', disabled: true, className: 'bg-gray-600' };
    }
    
    if (gameState === 'WAITING') {
      if (betStatus === 'PLACED') {
        return { text: 'BET PLACED ✓', disabled: true, className: 'bg-green-600' };
      }
      return { text: 'PLACE BET [SPACE]', disabled: false, className: 'bg-cyan-500 hover:bg-cyan-400' };
    }
    
    if (gameState === 'RUNNING') {
      if (betStatus === 'PLACED') {
        return { 
          text: `CASHOUT ${potentialWin?.toFixed(2)} [SPACE]`, 
          disabled: false, 
          className: 'bg-yellow-500 hover:bg-yellow-400 animate-pulse' 
        };
      }
      return { text: 'WAITING...', disabled: true, className: 'bg-gray-600' };
    }
    
    if (gameState === 'CRASHED') {
      if (betStatus === 'CASHED_OUT') {
        return { text: `WON $${potentialWin?.toFixed(2)}! 🎉`, disabled: true, className: 'bg-green-500' };
      }
      if (betStatus === 'LOST') {
        return { text: 'BUSTED 💥', disabled: true, className: 'bg-red-500' };
      }
      return { text: 'NEXT ROUND...', disabled: true, className: 'bg-gray-600' };
    }
    
    return { text: 'PLACE BET', disabled: true, className: 'bg-gray-600' };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800">
      {/* Header with connection status and mute */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-xs text-gray-400">
            {isConnected ? 'LIVE' : 'CONNECTING'}
          </span>
          {gameId && (
            <span className="text-xs text-gray-500 ml-2">
              Game #{gameId.slice(-6)}
            </span>
          )}
        </div>
        
        {/* Mute button */}
        <button
          onClick={toggleMute}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
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
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm animate-pulse">
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
          className="w-full h-64 rounded-xl border border-gray-700"
          style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 100%)' }}
        />
        
        {/* Multiplier overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-6xl font-bold ${getMultiplierClass()} transition-all duration-200`}
               style={{ textShadow: '0 0 30px currentColor' }}>
            {getMultiplierDisplay()}
          </div>
        </div>
      </div>

      {/* Recent crashes */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {recentCrashes.slice(0, 10).map((crash, index) => (
          <div
            key={index}
            className={`px-3 py-1 rounded-full text-sm font-mono whitespace-nowrap ${
              crash >= 2 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {crash.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* Bet controls */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">BET AMOUNT</label>
          <div className="flex">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-l-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
              placeholder="100"
              disabled={betStatus !== 'NONE'}
            />
            <div className="flex flex-col">
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toString())}
                className="bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600 rounded-tr-lg"
                disabled={betStatus !== 'NONE'}
              >
                2x
              </button>
              <button
                onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toString())}
                className="bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600 rounded-br-lg"
                disabled={betStatus !== 'NONE'}
              >
                ½
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">AUTO CASHOUT</label>
          <input
            type="number"
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
            placeholder="2.00"
            step="0.1"
            min="1.01"
            disabled={betStatus !== 'NONE'}
          />
        </div>
      </div>

      {/* Main action button */}
      <button
        onClick={betStatus === 'PLACED' && gameState === 'RUNNING' ? handleCashOut : handlePlaceBet}
        disabled={buttonConfig.disabled}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 ${buttonConfig.className} disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
      >
        {buttonConfig.text}
      </button>

      {/* Current bet info */}
      {currentBet && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg flex justify-between items-center">
          <span className="text-gray-400">Your Bet:</span>
          <span className="text-cyan-400 font-bold">${currentBet?.betAmount?.toFixed(2) || "0.00"}</span>
        </div>
      )}

      {/* Hotkey hint */}
      <div className="mt-4 text-center text-xs text-gray-500">
        Press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400">SPACE</kbd> to {gameState === 'RUNNING' && betStatus === 'PLACED' ? 'Cashout' : 'Bet'}
      </div>
    </div>
  );
};

export default CrashGamePanel;
