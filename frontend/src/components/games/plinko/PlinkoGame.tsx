'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// ============ MULTIPLIER TABLES (Stake.com Standards - 4% House Edge) ============
const MULTIPLIERS: Record<string, Record<number, number[]>> = {
  LOW: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    9: [5.6, 2.0, 1.6, 1.0, 0.7, 0.7, 1.0, 1.6, 2.0, 5.6],
    10: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9],
    11: [8.4, 3.0, 1.9, 1.3, 1.0, 0.7, 0.7, 1.0, 1.3, 1.9, 3.0, 8.4],
    12: [10, 3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
    13: [8.1, 4.0, 3.0, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3.0, 4.0, 8.1],
    14: [7.1, 4.0, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4.0, 7.1],
    15: [15, 8.0, 3.0, 2.0, 1.5, 1.1, 1.0, 0.7, 0.7, 1.0, 1.1, 1.5, 2.0, 3.0, 8.0, 15],
    16: [16, 9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16],
  },
  MEDIUM: {
    8: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    9: [18, 4.0, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4.0, 18],
    10: [22, 5.0, 2.0, 1.4, 0.6, 0.4, 0.6, 1.4, 2.0, 5.0, 22],
    11: [24, 6.0, 3.0, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3.0, 6.0, 24],
    12: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
    13: [43, 13, 6.0, 3.0, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3.0, 6.0, 13, 43],
    14: [58, 15, 7.0, 4.0, 1.9, 1.0, 0.5, 0.2, 0.5, 1.0, 1.9, 4.0, 7.0, 15, 58],
    15: [88, 18, 11, 5.0, 3.0, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3.0, 5.0, 11, 18, 88],
    16: [110, 41, 10, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10, 41, 110],
  },
  HIGH: {
    8: [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
    9: [43, 7.0, 2.0, 0.6, 0.2, 0.2, 0.6, 2.0, 7.0, 43],
    10: [76, 10, 3.0, 0.9, 0.3, 0.2, 0.3, 0.9, 3.0, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
    13: [260, 37, 11, 4.0, 1.0, 0.2, 0.2, 0.2, 0.2, 1.0, 4.0, 11, 37, 260],
    14: [420, 56, 18, 5.0, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5.0, 18, 56, 420],
    15: [620, 83, 27, 8.0, 3.0, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3.0, 8.0, 27, 83, 620],
    16: [1000, 130, 26, 9.0, 4.0, 2.0, 0.2, 0.2, 0.2, 0.2, 0.2, 2.0, 4.0, 9.0, 26, 130, 1000],
  },
};

// ============ PHYSICS CONSTANTS ============
const PHYSICS = {
  GRAVITY: 0.3,
  BOUNCE_FACTOR: 0.65,
  FRICTION: 0.985,
  BALL_RADIUS: 10,
  PIN_RADIUS: 5,
  TRAIL_LENGTH: 15,
  JITTER: 2.5,
};

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  pathIndex: number;
  path: number[];
  landed: boolean;
  bucketIndex: number;
  multiplier: number;
  payout: number;
}

const PlinkoGame: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const ballsRef = useRef<Ball[]>([]);
  
  const [betAmount, setBetAmount] = useState<number>(10);
  const [rows, setRows] = useState<number>(16);
  const [risk, setRisk] = useState<RiskLevel>('MEDIUM');
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<{ multiplier: number; payout: number } | null>(null);
  const [history, setHistory] = useState<{ multiplier: number; payout: number; isWin: boolean }[]>([]);
  const [highlightedBucket, setHighlightedBucket] = useState<number | null>(null);
  const [impactTime, setImpactTime] = useState<number>(0);
  
  // Canvas dimensions
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 720;
  const PIN_GAP = 35;
  
  // Get multipliers for current settings
  const multipliers = MULTIPLIERS[risk][rows] || [];
  const numBuckets = rows + 1;
  
  // Get bucket color based on multiplier
  const getBucketColor = (mult: number): string => {
    if (mult >= 100) return '#ff0055';
    if (mult >= 10) return '#ff3366';
    if (mult >= 5) return '#ff6633';
    if (mult >= 2) return '#ffaa00';
    if (mult >= 1) return '#22cc66';
    if (mult >= 0.5) return '#556688';
    return '#334455';
  };
  
  // Calculate pin positions
  const getPinPositions = useCallback(() => {
    const pins: { x: number; y: number; row: number }[] = [];
    const startY = 60;
    const centerX = CANVAS_WIDTH / 2;
    
    for (let row = 0; row < rows; row++) {
      const pinsInRow = row + 3;
      const rowWidth = (pinsInRow - 1) * PIN_GAP;
      const startX = centerX - rowWidth / 2;
      
      for (let pin = 0; pin < pinsInRow; pin++) {
        pins.push({
          x: startX + pin * PIN_GAP,
          y: startY + row * PIN_GAP,
          row,
        });
      }
    }
    return pins;
  }, [rows]);
  
  // Draw the game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with dark background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    const pins = getPinPositions();
    const bucketY = 60 + rows * PIN_GAP + 20;
    const bucketHeight = 55;
    const totalWidth = rows * PIN_GAP;
    const bucketWidth = totalWidth / numBuckets;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    
    // Draw buckets with glow
    multipliers.forEach((mult, index) => {
      const x = startX + index * bucketWidth;
      const color = getBucketColor(mult);
      const isHighlighted = highlightedBucket === index;
      
      // Bucket glow effect
      if (isHighlighted) {
        const glowIntensity = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        ctx.shadowColor = color;
        ctx.shadowBlur = 30 * glowIntensity;
      }
      
      // Bucket gradient
      const gradient = ctx.createLinearGradient(x, bucketY, x, bucketY + bucketHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, '#0a0a0a');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + 2, bucketY, bucketWidth - 4, bucketHeight, 4);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Bucket border
      ctx.strokeStyle = isHighlighted ? '#ffffff' : '#333344';
      ctx.lineWidth = isHighlighted ? 3 : 1;
      ctx.stroke();
      
      // Multiplier text
      ctx.fillStyle = isHighlighted ? '#ffffff' : '#dddddd';
      ctx.font = mult >= 100 ? 'bold 10px Arial' : 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mult}x`, x + bucketWidth / 2, bucketY + bucketHeight / 2);
    });
    
    // Draw pins with glow
    pins.forEach(pin => {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, PHYSICS.PIN_RADIUS, 0, Math.PI * 2);
      
      // Pin glow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    
    // Draw balls with trail
    ballsRef.current.forEach(ball => {
      // Draw trail
      ball.trail.forEach((pos, i) => {
        const alpha = ((i + 1) / ball.trail.length) * 0.6;
        const radius = PHYSICS.BALL_RADIUS * (0.3 + (i / ball.trail.length) * 0.7);
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
        ctx.fill();
      });
      
      // Draw ball with gradient and glow
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, PHYSICS.BALL_RADIUS, 0, Math.PI * 2);
      
      const ballGradient = ctx.createRadialGradient(
        ball.x - 3, ball.y - 3, 0,
        ball.x, ball.y, PHYSICS.BALL_RADIUS
      );
      ballGradient.addColorStop(0, '#ffee00');
      ballGradient.addColorStop(0.4, '#ffaa00');
      ballGradient.addColorStop(1, '#ff6600');
      
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 20;
      ctx.fillStyle = ballGradient;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Ball border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Draw last result notification
    if (lastResult) {
      const resultColor = lastResult.payout > betAmount ? '#00ff66' : '#ff4444';
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 90, 15, 180, 50, 10);
      ctx.fill();
      
      ctx.strokeStyle = resultColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = resultColor;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${lastResult.multiplier}x`, CANVAS_WIDTH / 2, 35);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.fillText(`$${lastResult.payout.toFixed(2)}`, CANVAS_WIDTH / 2, 55);
    }
  }, [getPinPositions, multipliers, numBuckets, rows, highlightedBucket, lastResult, betAmount]);
  
  // Physics update
  const updatePhysics = useCallback(() => {
    const pins = getPinPositions();
    const bucketY = 60 + rows * PIN_GAP + 20;
    const totalWidth = rows * PIN_GAP;
    const bucketWidth = totalWidth / numBuckets;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    
    ballsRef.current = ballsRef.current.filter(ball => {
      if (ball.landed) return false;
      
      // Add current position to trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > PHYSICS.TRAIL_LENGTH) {
        ball.trail.shift();
      }
      
      // Apply gravity
      ball.vy += PHYSICS.GRAVITY;
      
      // Apply friction
      ball.vx *= PHYSICS.FRICTION;
      
      // Check collision with pins
      pins.forEach(pin => {
        const dx = ball.x - pin.x;
        const dy = ball.y - pin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = PHYSICS.BALL_RADIUS + PHYSICS.PIN_RADIUS;
        
        if (dist < minDist && dist > 0) {
          // Collision detected!
          const angle = Math.atan2(dy, dx);
          const overlap = minDist - dist;
          
          // Push ball out of pin
          ball.x += Math.cos(angle) * overlap * 1.1;
          ball.y += Math.sin(angle) * overlap * 1.1;
          
          // Reflect velocity
          const normalX = Math.cos(angle);
          const normalY = Math.sin(angle);
          const dotProduct = ball.vx * normalX + ball.vy * normalY;
          
          ball.vx -= 2 * dotProduct * normalX * PHYSICS.BOUNCE_FACTOR;
          ball.vy -= 2 * dotProduct * normalY * PHYSICS.BOUNCE_FACTOR;
          
          // Add jitter for realistic bouncing
          ball.vx += (Math.random() - 0.5) * PHYSICS.JITTER;
          
          // Use predetermined path for direction bias
          if (ball.pathIndex < ball.path.length && pin.row === ball.pathIndex) {
            const direction = ball.path[ball.pathIndex];
            ball.vx += direction === 1 ? 2 : -2;
            ball.pathIndex++;
          }
        }
      });
      
      // Update position
      ball.x += ball.vx;
      ball.y += ball.vy;
      
      // Keep ball in bounds
      const margin = 50;
      if (ball.x < margin) {
        ball.x = margin;
        ball.vx = Math.abs(ball.vx) * 0.5;
      }
      if (ball.x > CANVAS_WIDTH - margin) {
        ball.x = CANVAS_WIDTH - margin;
        ball.vx = -Math.abs(ball.vx) * 0.5;
      }
      
      // Check if ball landed in bucket
      if (ball.y >= bucketY - PHYSICS.BALL_RADIUS) {
        ball.landed = true;
        const relativeX = ball.x - startX;
        ball.bucketIndex = Math.floor(relativeX / bucketWidth);
        ball.bucketIndex = Math.max(0, Math.min(numBuckets - 1, ball.bucketIndex));
        
        // Trigger bucket highlight
        setHighlightedBucket(ball.bucketIndex);
        setImpactTime(Date.now());
        
        setTimeout(() => {
          setHighlightedBucket(null);
        }, 1500);
        
        return false;
      }
      
      return true;
    });
  }, [getPinPositions, rows, numBuckets]);
  
  // Animation loop
  useEffect(() => {
    const animate = () => {
      updatePhysics();
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [updatePhysics, draw]);
  
  // Place bet
  const placeBet = async () => {
    if (!user || !token) {
      alert('Please login to play');
      return;
    }
    
    if (isPlaying) return;
    if (betAmount <= 0 || betAmount > (parseFloat(user.balance?.find(b => b.currency === 'USDT')?.available || '0'))) {
      alert('Invalid bet amount');
      return;
    }
    
    setIsPlaying(true);
    setLastResult(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000'}/games/plinko/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          betAmount,
          rows,
          risk,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to place bet');
      }
      
      const result = await response.json();
      
      // Create ball with physics
      const newBall: Ball = {
        x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 10,
        y: 30,
        vx: (Math.random() - 0.5) * 2,
        vy: 0,
        trail: [],
        pathIndex: 0,
        path: result.path,
        landed: false,
        bucketIndex: -1,
        multiplier: result.multiplier,
        payout: result.payout,
      };
      
      ballsRef.current.push(newBall);
      
      // Wait for ball to land
      const animationTime = rows * 180 + 500;
      setTimeout(() => {
        setLastResult({ multiplier: result.multiplier, payout: result.payout });
        setHistory(prev => [
          { multiplier: result.multiplier, payout: result.payout, isWin: result.payout > betAmount },
          ...prev.slice(0, 9),
        ]);
        refreshUser();
        setIsPlaying(false);
      }, animationTime);
      
    } catch (error: any) {
      console.error('Bet error:', error);
      alert(error.message || 'Failed to place bet');
      setIsPlaying(false);
    }
  };
  
  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isPlaying) {
        e.preventDefault();
        placeBet();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, betAmount, rows, risk, user, token]);
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 bg-gray-900 min-h-screen">
      {/* Game Canvas */}
      <div className="flex-1">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Plinko</h2>
            <span className="px-3 py-1 bg-green-500 text-white text-sm font-bold rounded-full animate-pulse">
              LIVE
            </span>
          </div>
          
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full max-w-[800px] mx-auto rounded-lg" 
            style={{ background: '#0d1117', aspectRatio: '800 / 720' }}
          />
        </div>
      </div>
      
      {/* Controls */}
      <div className="w-full lg:w-80">
        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          {/* Bet Amount */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">BET AMOUNT</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0.1, Number(e.target.value)))}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                min="0.1"
                step="0.1"
              />
              <button
                onClick={() => setBetAmount(prev => prev * 2)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 transition-colors"
              >
                2x
              </button>
              <button
                onClick={() => setBetAmount(prev => Math.max(0.1, prev / 2))}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 transition-colors"
              >
                ½
              </button>
            </div>
          </div>
          
          {/* Risk Level - Segmented Control */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">RISK</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={`flex-1 py-3 font-bold transition-all ${
                    risk === r
                      ? r === 'LOW'
                        ? 'bg-green-600 text-white'
                        : r === 'MEDIUM'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          
          {/* Rows Slider */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">ROWS: {rows}</label>
            <div className="relative">
              <input
                type="range"
                min="8"
                max="16"
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>8</span>
                <span>10</span>
                <span>12</span>
                <span>14</span>
                <span>16</span>
              </div>
            </div>
          </div>
          
          {/* Bet Button */}
          <button
            onClick={placeBet}
            disabled={isPlaying || !user || betAmount > (parseFloat(user?.balance?.find(b => b.currency === 'USDT')?.available || '0'))}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              isPlaying
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/30'
            }`}
          >
            {isPlaying ? 'DROPPING...' : 'DROP BALL [SPACE]'}
          </button>
          
          {/* Balance */}
          {user && (
            <div className="text-center text-gray-400 py-2">
              Balance: <span className="text-white font-bold">${(parseFloat(user.balance?.find(b => b.currency === 'USDT')?.available || '0')).toFixed(2)}</span>
            </div>
          )}
          
          {/* History */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">HISTORY</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4">No games yet</div>
              ) : (
                history.map((h, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                      h.isWin ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                    }`}
                  >
                    <span className={`font-bold ${h.isWin ? 'text-green-400' : 'text-red-400'}`}>
                      {h.multiplier}x
                    </span>
                    <span className={h.isWin ? 'text-green-400' : 'text-red-400'}>
                      {h.isWin ? '+' : ''}{(h.payout - betAmount).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlinkoGame;
