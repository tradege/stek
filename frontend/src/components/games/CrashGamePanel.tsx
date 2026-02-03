'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCrashGame, GameState, BetStatus } from '@/hooks/useCrashGame';
import { useSocket } from '@/contexts/SocketContext';

/**
 * CrashGamePanel - Main Crash game display
 * Connected to real-time backend via Socket.io
 * Electric Cyberpunk theme with glowing effects
 */
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
  
  const [betAmount, setBetAmount] = useState<string>('100');
  const [autoCashout, setAutoCashout] = useState<string>('2.00');
  const [showError, setShowError] = useState(false);
  
  // Graph canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphPointsRef = useRef<{ x: number; y: number }[]>([]);

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
    }
  }, [gameState]);

  // Draw graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i < 8; i++) {
      const x = (width / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (gameState === 'RUNNING' || gameState === 'CRASHED') {
      // Add new point
      const maxMultiplier = Math.max(currentMultiplier, 2);
      const x = graphPointsRef.current.length * 2;
      const y = height - (Math.log(currentMultiplier) / Math.log(maxMultiplier)) * (height - 50);
      
      if (gameState === 'RUNNING') {
        graphPointsRef.current.push({ x, y });
      }

      // Draw gradient fill
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      if (gameState === 'CRASHED') {
        gradient.addColorStop(0, 'rgba(255, 56, 92, 0)');
        gradient.addColorStop(1, 'rgba(255, 56, 92, 0.3)');
      } else {
        gradient.addColorStop(0, 'rgba(0, 240, 255, 0)');
        gradient.addColorStop(1, 'rgba(0, 240, 255, 0.2)');
      }

      // Draw area
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      graphPointsRef.current.forEach((point, index) => {
        if (index === 0) {
          ctx.lineTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      
      if (graphPointsRef.current.length > 0) {
        const lastPoint = graphPointsRef.current[graphPointsRef.current.length - 1];
        ctx.lineTo(lastPoint.x, height);
      }
      
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Add glow effect
      ctx.shadowColor = gameState === 'CRASHED' ? '#FF385C' : '#00F0FF';
      ctx.shadowBlur = 10;
      
      graphPointsRef.current.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [currentMultiplier, gameState]);

  // Handle bet placement
  const handlePlaceBet = () => {
    const amount = parseFloat(betAmount);
    const autoCashoutValue = parseFloat(autoCashout);
    
    if (isNaN(amount) || amount <= 0) {
      return;
    }
    
    placeBet(amount, autoCashoutValue > 1 ? autoCashoutValue : undefined);
  };

  // Handle cashout
  const handleCashOut = () => {
    cashOut();
  };

  // Get multiplier display class
  const getMultiplierClass = () => {
    if (gameState === 'CRASHED') {
      return 'text-danger-primary animate-pulse';
    }
    if (gameState === 'RUNNING') {
      return 'text-accent-primary';
    }
    return 'text-text-secondary';
  };

  // Get multiplier display value
  const getMultiplierDisplay = () => {
    if (gameState === 'WAITING') {
      return countdown > 0 ? `${countdown.toFixed(1)}s` : 'Starting...';
    }
    return `${currentMultiplier.toFixed(2)}x`;
  };

  // Get button state
  const getButtonConfig = () => {
    if (!isConnected) {
      return { text: 'CONNECTING...', disabled: true, className: 'btn-disabled' };
    }
    
    if (gameState === 'WAITING') {
      if (betStatus === 'PLACED') {
        return { text: 'BET PLACED ✓', disabled: true, className: 'btn-success' };
      }
      return { text: 'PLACE BET', disabled: false, className: 'btn-bet' };
    }
    
    if (gameState === 'RUNNING') {
      if (betStatus === 'PLACED') {
        return { 
          text: `CASHOUT @ ${currentMultiplier.toFixed(2)}x`, 
          subtext: `Win: $${potentialWin.toFixed(2)}`,
          disabled: false, 
          className: 'btn-success animate-pulse' 
        };
      }
      return { text: 'WAIT FOR NEXT ROUND', disabled: true, className: 'btn-disabled' };
    }
    
    if (gameState === 'CRASHED') {
      if (betStatus === 'CASHED_OUT') {
        return { text: `WON $${currentBet?.profit?.toFixed(2) || '0.00'}!`, disabled: true, className: 'btn-success' };
      }
      if (betStatus === 'LOST') {
        return { text: 'BUSTED', disabled: true, className: 'btn-danger' };
      }
      return { text: 'CRASHED', disabled: true, className: 'btn-danger' };
    }
    
    return { text: 'PLACE BET', disabled: true, className: 'btn-disabled' };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="game-panel relative">
      {/* Error Toast */}
      {showError && error && (
        <div className="absolute top-4 right-4 z-50 bg-danger-primary/90 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-down">
          {error}
        </div>
      )}

      {/* Game Header */}
      <div className="game-panel-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">Crash</h2>
            <p className="text-xs text-text-secondary">
              {gameId ? `Game #${gameId.slice(-6)}` : 'Connecting...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 text-xs ${isConnected ? 'text-success-primary' : 'text-danger-primary'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-primary animate-pulse' : 'bg-danger-primary'}`} />
            {isConnected ? 'Live' : 'Offline'}
          </div>

          {/* Provably Fair Badge */}
          <button className="badge-cyan flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Provably Fair
          </button>
          
          {/* History */}
          <div className="flex gap-1">
            {recentCrashes.slice(0, 5).map((point, i) => (
              <span
                key={i}
                className={`text-xs font-mono px-2 py-1 rounded ${
                  point < 2 ? 'bg-danger-muted text-danger-primary' : 'bg-success-muted text-success-primary'
                }`}
              >
                {point.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Game Display Area */}
      <div className={`relative h-80 overflow-hidden transition-colors duration-300 ${
        gameState === 'CRASHED' ? 'bg-gradient-to-b from-danger-primary/20 to-main' : 'bg-gradient-game'
      }`}>
        {/* Canvas for graph */}
        <canvas 
          ref={canvasRef}
          width={800}
          height={320}
          className="absolute inset-0 w-full h-full"
        />

        {/* Multiplier Display */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            {gameState === 'CRASHED' && (
              <p className="text-lg text-danger-primary mb-2 font-semibold animate-bounce">
                CRASHED!
              </p>
            )}
            <p className={`text-7xl font-bold tabular-nums tracking-tight ${getMultiplierClass()}`}
               style={{ 
                 textShadow: gameState === 'RUNNING' 
                   ? '0 0 30px rgba(0, 240, 255, 0.5)' 
                   : gameState === 'CRASHED'
                   ? '0 0 30px rgba(255, 56, 92, 0.5)'
                   : 'none'
               }}>
              {getMultiplierDisplay()}
            </p>
            {betStatus === 'PLACED' && gameState === 'RUNNING' && (
              <p className="text-lg text-success-primary mt-2 animate-pulse">
                Potential: ${potentialWin.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Bet Controls */}
      <div className="game-panel-body border-t border-card-border">
        <div className="grid grid-cols-2 gap-4">
          {/* Bet Amount */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Bet Amount</label>
            <div className="relative">
              <input
                type="text"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={betStatus === 'PLACED'}
                className="input pr-16 font-mono tabular-nums disabled:opacity-50"
                placeholder="0.00"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))}
                  disabled={betStatus === 'PLACED'}
                  className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors disabled:opacity-50"
                >
                  ½
                </button>
                <button
                  onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))}
                  disabled={betStatus === 'PLACED'}
                  className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors disabled:opacity-50"
                >
                  2×
                </button>
              </div>
            </div>
            
            {/* Quick Amounts */}
            <div className="flex gap-2 mt-2">
              {[10, 50, 100, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount.toString())}
                  disabled={betStatus === 'PLACED'}
                  className="flex-1 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors disabled:opacity-50"
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>
          
          {/* Auto Cashout */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Auto Cashout</label>
            <div className="relative">
              <input
                type="text"
                value={autoCashout}
                onChange={(e) => setAutoCashout(e.target.value)}
                disabled={betStatus === 'PLACED'}
                className="input pr-8 font-mono tabular-nums disabled:opacity-50"
                placeholder="2.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                x
              </span>
            </div>
            
            {/* Quick Multipliers */}
            <div className="flex gap-2 mt-2">
              {[1.5, 2, 3, 5].map((mult) => (
                <button
                  key={mult}
                  onClick={() => setAutoCashout(mult.toFixed(2))}
                  disabled={betStatus === 'PLACED'}
                  className="flex-1 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors disabled:opacity-50"
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Action Button */}
        <div className="mt-4">
          <button
            onClick={betStatus === 'PLACED' && gameState === 'RUNNING' ? handleCashOut : handlePlaceBet}
            disabled={buttonConfig.disabled}
            className={`w-full py-3 text-lg font-bold uppercase tracking-wider rounded-lg transition-all ${buttonConfig.className}`}
            style={{
              boxShadow: !buttonConfig.disabled && betStatus === 'PLACED' && gameState === 'RUNNING'
                ? '0 0 20px rgba(34, 197, 94, 0.4)'
                : !buttonConfig.disabled
                ? '0 0 20px rgba(0, 240, 255, 0.3)'
                : 'none'
            }}
          >
            {buttonConfig.text}
            {buttonConfig.subtext && (
              <span className="block text-sm font-normal opacity-80">
                {buttonConfig.subtext}
              </span>
            )}
          </button>
        </div>
        
        {/* Potential Win */}
        <div className="mt-4 p-3 bg-main rounded-lg flex justify-between items-center">
          <span className="text-sm text-text-secondary">
            {betStatus === 'PLACED' ? 'Current Bet' : 'Potential Win'}
          </span>
          <span className="font-mono font-semibold text-success-primary tabular-nums">
            {betStatus === 'PLACED' 
              ? `$${currentBet?.betAmount.toFixed(2) || '0.00'}`
              : `$${(parseFloat(betAmount || '0') * parseFloat(autoCashout || '1')).toFixed(2)}`
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default CrashGamePanel;
