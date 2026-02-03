import React, { useState, useEffect } from 'react';

type GameState = 'WAITING' | 'RUNNING' | 'CRASHED';

interface CrashGamePanelProps {
  // These would come from WebSocket in real implementation
  gameState?: GameState;
  currentMultiplier?: number;
  crashPoint?: number;
  countdown?: number;
}

/**
 * CrashGamePanel - Main Crash game display
 * Shows: Graph, Multiplier, Bet Controls
 * Electric Cyberpunk theme with glowing effects
 */
const CrashGamePanel: React.FC<CrashGamePanelProps> = ({
  gameState = 'RUNNING',
  currentMultiplier = 2.45,
  crashPoint = 0,
  countdown = 0,
}) => {
  const [betAmount, setBetAmount] = useState<string>('100');
  const [autoCashout, setAutoCashout] = useState<string>('2.00');
  const [hasBet, setHasBet] = useState(false);
  
  // Determine multiplier styling based on game state
  const getMultiplierClass = () => {
    switch (gameState) {
      case 'CRASHED':
        return 'multiplier-crashed';
      case 'RUNNING':
        return 'multiplier-rising';
      default:
        return 'multiplier text-text-secondary';
    }
  };
  
  const getMultiplierDisplay = () => {
    if (gameState === 'WAITING') {
      return `${countdown}s`;
    }
    if (gameState === 'CRASHED') {
      return `${crashPoint.toFixed(2)}x`;
    }
    return `${currentMultiplier.toFixed(2)}x`;
  };
  
  return (
    <div className="game-panel">
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
            <p className="text-xs text-text-secondary">Game #12,847</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Provably Fair Badge */}
          <button className="badge-cyan flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Provably Fair
          </button>
          
          {/* History */}
          <div className="flex gap-1">
            {[2.45, 1.23, 5.67, 1.00, 3.21].map((point, i) => (
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
      <div className="relative h-80 bg-gradient-game overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        
        {/* Crash Graph (Simplified) */}
        {gameState === 'RUNNING' && (
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="graphGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
                <stop offset="100%" stopColor="rgba(0, 240, 255, 0.2)" />
              </linearGradient>
            </defs>
            
            {/* Area under curve */}
            <path
              d="M 0 280 Q 200 250, 400 180 T 800 50 L 800 280 Z"
              fill="url(#graphGradient)"
            />
            
            {/* The line */}
            <path
              d="M 0 280 Q 200 250, 400 180 T 800 50"
              className="crash-line"
              fill="none"
            />
          </svg>
        )}
        
        {/* Crashed State */}
        {gameState === 'CRASHED' && (
          <div className="absolute inset-0 flex items-center justify-center bg-danger-primary/10">
            <div className="text-center">
              <p className="text-lg text-danger-primary mb-2">CRASHED</p>
              <p className={getMultiplierClass() + ' text-multiplier-xl'}>
                {crashPoint.toFixed(2)}x
              </p>
            </div>
          </div>
        )}
        
        {/* Waiting State */}
        {gameState === 'WAITING' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-text-secondary mb-2">Next round in</p>
              <p className="text-multiplier-xl text-text-primary tabular-nums">
                {countdown}s
              </p>
            </div>
          </div>
        )}
        
        {/* Running Multiplier Display */}
        {gameState === 'RUNNING' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className={getMultiplierClass() + ' text-multiplier-xl animate-multiplier-rise'}>
              {currentMultiplier.toFixed(2)}x
            </p>
          </div>
        )}
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
                className="input pr-16 font-mono tabular-nums"
                placeholder="0.00"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  onClick={() => setBetAmount((prev) => (parseFloat(prev) / 2).toFixed(2))}
                  className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors"
                >
                  ½
                </button>
                <button
                  onClick={() => setBetAmount((prev) => (parseFloat(prev) * 2).toFixed(2))}
                  className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors"
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
                  className="flex-1 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors"
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
                className="input pr-8 font-mono tabular-nums"
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
                  className="flex-1 py-1 text-xs bg-card-hover rounded hover:bg-card-border transition-colors"
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Action Button */}
        <div className="mt-4">
          {!hasBet ? (
            <button
              onClick={() => setHasBet(true)}
              disabled={gameState !== 'WAITING'}
              className="btn-bet w-full"
            >
              {gameState === 'WAITING' ? 'PLACE BET' : 'WAIT FOR NEXT ROUND'}
            </button>
          ) : (
            <button
              onClick={() => setHasBet(false)}
              disabled={gameState !== 'RUNNING'}
              className="btn-success w-full py-3 text-lg font-bold uppercase tracking-wider"
            >
              CASHOUT @ {currentMultiplier.toFixed(2)}x
              <span className="block text-sm font-normal opacity-80">
                Win: ${(parseFloat(betAmount) * currentMultiplier).toFixed(2)}
              </span>
            </button>
          )}
        </div>
        
        {/* Potential Win */}
        <div className="mt-4 p-3 bg-main rounded-lg flex justify-between items-center">
          <span className="text-sm text-text-secondary">Potential Win</span>
          <span className="font-mono font-semibold text-success-primary tabular-nums">
            ${(parseFloat(betAmount || '0') * parseFloat(autoCashout || '1')).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CrashGamePanel;
