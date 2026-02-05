'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// ============ MULTIPLIER TABLES (4% House Edge - 96% RTP) ============
// Mathematically verified using binomial distribution
const MULTIPLIERS: Record<string, Record<number, number[]>> = {
  LOW: {
    8: [5.43, 2.04, 1.07, 0.97, 0.48, 0.97, 1.07, 2.04, 5.43],
    9: [5.43, 1.94, 1.55, 0.97, 0.68, 0.68, 0.97, 1.55, 1.94, 5.43],
    10: [8.63, 2.91, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 2.91, 8.63],
    11: [8.15, 2.91, 1.84, 1.26, 0.97, 0.68, 0.68, 0.97, 1.26, 1.84, 2.91, 8.15],
    12: [9.7, 2.91, 1.55, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 1.55, 2.91, 9.7],
    13: [7.85, 3.88, 2.91, 1.84, 1.16, 0.87, 0.68, 0.68, 0.87, 1.16, 1.84, 2.91, 3.88, 7.85],
    14: [6.88, 3.88, 1.84, 1.36, 1.26, 1.07, 0.97, 0.48, 0.97, 1.07, 1.26, 1.36, 1.84, 3.88, 6.88],
    15: [14.55, 7.76, 2.91, 1.94, 1.45, 1.07, 0.97, 0.68, 0.68, 0.97, 1.07, 1.45, 1.94, 2.91, 7.76, 14.55],
    16: [15.52, 8.73, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.48, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.73, 15.52],
  },
  MEDIUM: {
    8: [12.62, 2.91, 1.26, 0.68, 0.39, 0.68, 1.26, 2.91, 12.62],
    9: [17.43, 3.87, 1.65, 0.87, 0.48, 0.48, 0.87, 1.65, 3.87, 17.43],
    10: [21.35, 4.85, 1.94, 1.36, 0.58, 0.39, 0.58, 1.36, 1.94, 4.85, 21.35],
    11: [23.27, 5.82, 2.91, 1.75, 0.68, 0.48, 0.48, 0.68, 1.75, 2.91, 5.82, 23.27],
    12: [32, 10.67, 3.88, 1.94, 1.07, 0.58, 0.29, 0.58, 1.07, 1.94, 3.88, 10.67, 32],
    13: [41.7, 12.61, 5.82, 2.91, 1.26, 0.68, 0.39, 0.39, 0.68, 1.26, 2.91, 5.82, 12.61, 41.7],
    14: [56.25, 14.55, 6.79, 3.88, 1.84, 0.97, 0.48, 0.19, 0.48, 0.97, 1.84, 3.88, 6.79, 14.55, 56.25],
    15: [85.33, 17.45, 10.67, 4.85, 2.91, 1.26, 0.48, 0.29, 0.29, 0.48, 1.26, 2.91, 4.85, 10.67, 17.45, 85.33],
    16: [106.68, 39.76, 9.7, 4.85, 2.91, 1.45, 0.97, 0.48, 0.29, 0.48, 0.97, 1.45, 2.91, 4.85, 9.7, 39.76, 106.68],
  },
  HIGH: {
    8: [28.1, 3.88, 1.45, 0.29, 0.19, 0.29, 1.45, 3.88, 28.1],
    9: [41.67, 6.78, 1.94, 0.58, 0.19, 0.19, 0.58, 1.94, 6.78, 41.67],
    10: [73.65, 9.69, 2.91, 0.87, 0.29, 0.19, 0.29, 0.87, 2.91, 9.69, 73.65],
    11: [116.18, 13.55, 5.03, 1.36, 0.39, 0.19, 0.19, 0.39, 1.36, 5.03, 13.55, 116.18],
    12: [164.66, 23.25, 7.85, 1.94, 0.68, 0.19, 0.19, 0.19, 0.68, 1.94, 7.85, 23.25, 164.66],
    13: [251.9, 35.85, 10.66, 3.88, 0.97, 0.19, 0.19, 0.19, 0.19, 0.97, 3.88, 10.66, 35.85, 251.9],
    14: [407.36, 54.31, 17.46, 4.85, 1.84, 0.29, 0.19, 0.19, 0.19, 0.29, 1.84, 4.85, 17.46, 54.31, 407.36],
    15: [601.05, 80.46, 26.17, 7.76, 2.91, 0.48, 0.19, 0.19, 0.19, 0.19, 0.48, 2.91, 7.76, 26.17, 80.46, 601.05],
    16: [969.93, 126.09, 25.22, 8.73, 3.88, 1.94, 0.19, 0.19, 0.19, 0.19, 0.19, 1.94, 3.88, 8.73, 25.22, 126.09, 969.93],
  },
};

// ============ ENHANCED PHYSICS CONSTANTS ============
const PHYSICS = {
  GRAVITY: 0.4,           // Increased for more realistic fall
  BOUNCE_FACTOR: 0.75,    // More bouncy
  FRICTION: 0.99,
  BALL_RADIUS: 10,
  PIN_RADIUS: 5,
  TRAIL_LENGTH: 12,
  JITTER: 2.0,
  TERMINAL_VELOCITY: 12,  // Max fall speed
};

// ============ VISUAL CONSTANTS ============
const VISUALS = {
  // Bucket colors based on risk level (gradient from edges to center)
  BUCKET_GRADIENTS: {
    LOW: {
      high: '#00ff88',    // Green for high multipliers
      mid: '#ffcc00',     // Yellow for mid
      low: '#666666',     // Gray for low
    },
    MEDIUM: {
      high: '#ff6600',    // Orange for high
      mid: '#ffcc00',     // Yellow for mid
      low: '#444444',     // Dark gray for low
    },
    HIGH: {
      high: '#ff0055',    // Red/Pink for high
      mid: '#ff6600',     // Orange for mid
      low: '#333333',     // Very dark for low
    },
  },
  GLOW_INTENSITY: 20,
  PIN_GLOW: '#00ffff',
  BALL_COLORS: ['#ffcc00', '#ff9900', '#ff6600'],
};

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number; time: number }[];
  pathIndex: number;
  path: number[];
  landed: boolean;
  bucketIndex: number;
  multiplier: number;
  payout: number;
  startTime: number;
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
  
  // Canvas dimensions
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 720;
  const PIN_GAP = 35;
  
  // Get multipliers for current settings
  const multipliers = MULTIPLIERS[risk][rows] || [];
  const numBuckets = rows + 1;
  
  // Get bucket color based on multiplier and risk level
  const getBucketColor = useCallback((mult: number, index: number, total: number): string => {
    const colors = VISUALS.BUCKET_GRADIENTS[risk];
    const distFromCenter = Math.abs(index - (total - 1) / 2) / ((total - 1) / 2);
    
    if (mult >= 50) return '#ff0055';      // Jackpot red
    if (mult >= 20) return '#ff3366';      // High red
    if (mult >= 10) return '#ff6633';      // Orange-red
    if (mult >= 5) return '#ff9900';       // Orange
    if (mult >= 2) return '#ffcc00';       // Yellow
    if (mult >= 1) return '#00cc66';       // Green
    if (mult >= 0.5) return '#0099cc';     // Blue
    return '#666666';                       // Gray for very low
  }, [risk]);

  // Get bucket glow color
  const getBucketGlow = useCallback((mult: number): string => {
    if (mult >= 50) return 'rgba(255, 0, 85, 0.8)';
    if (mult >= 20) return 'rgba(255, 51, 102, 0.6)';
    if (mult >= 10) return 'rgba(255, 102, 51, 0.5)';
    if (mult >= 5) return 'rgba(255, 153, 0, 0.4)';
    return 'rgba(255, 204, 0, 0.3)';
  }, []);
  
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
  
  // Draw the game with enhanced visuals
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#0a0e17');
    bgGradient.addColorStop(0.5, '#0d1117');
    bgGradient.addColorStop(1, '#0a0e17');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    const pins = getPinPositions();
    const bucketY = 60 + rows * PIN_GAP + 25;
    const bucketHeight = 60;
    const totalWidth = rows * PIN_GAP + 40;
    const bucketWidth = totalWidth / numBuckets;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    
    // Draw buckets with enhanced styling
    multipliers.forEach((mult, index) => {
      const x = startX + index * bucketWidth;
      const color = getBucketColor(mult, index, numBuckets);
      const isHighlighted = highlightedBucket === index;
      const isEdge = index === 0 || index === numBuckets - 1;
      const isNearEdge = index === 1 || index === numBuckets - 2;
      
      // Bucket glow effect for high multipliers
      if (mult >= 5 || isHighlighted) {
        ctx.shadowColor = getBucketGlow(mult);
        ctx.shadowBlur = isHighlighted ? 35 : 20;
      }
      
      // Bucket gradient fill
      const gradient = ctx.createLinearGradient(x, bucketY, x, bucketY + bucketHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.3, color);
      gradient.addColorStop(0.7, shadeColor(color, -30));
      gradient.addColorStop(1, shadeColor(color, -50));
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + 2, bucketY, bucketWidth - 4, bucketHeight, [0, 0, 8, 8]);
      ctx.fill();
      
      // Highlight animation
      if (isHighlighted) {
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      ctx.shadowBlur = 0;
      
      // Bucket top edge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, bucketY + 1);
      ctx.lineTo(x + bucketWidth - 4, bucketY + 1);
      ctx.stroke();
      
      // Multiplier text with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = isHighlighted ? '#ffffff' : 'rgba(255, 255, 255, 0.95)';
      ctx.font = mult >= 100 ? 'bold 9px Inter, Arial' : mult >= 10 ? 'bold 11px Inter, Arial' : 'bold 13px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Format multiplier display
      const displayMult = mult >= 100 ? mult.toFixed(0) : mult >= 10 ? mult.toFixed(1) : mult.toFixed(2);
      ctx.fillText(`${displayMult}x`, x + bucketWidth / 2, bucketY + bucketHeight / 2);
      ctx.shadowBlur = 0;
    });
    
    // Draw pins with glow effect
    pins.forEach(pin => {
      // Pin glow
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, PHYSICS.PIN_RADIUS + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.fill();
      
      // Pin body
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, PHYSICS.PIN_RADIUS, 0, Math.PI * 2);
      
      const pinGradient = ctx.createRadialGradient(
        pin.x - 1, pin.y - 1, 0,
        pin.x, pin.y, PHYSICS.PIN_RADIUS
      );
      pinGradient.addColorStop(0, '#ffffff');
      pinGradient.addColorStop(0.5, '#ccddff');
      pinGradient.addColorStop(1, '#99bbee');
      
      ctx.fillStyle = pinGradient;
      ctx.fill();
    });
    
    // Draw balls with enhanced trail and glow
    ballsRef.current.forEach(ball => {
      // Draw trail with fade effect
      ball.trail.forEach((pos, i) => {
        const age = Date.now() - pos.time;
        const alpha = Math.max(0, 1 - age / 300) * 0.6;
        const radius = PHYSICS.BALL_RADIUS * (0.4 + (i / ball.trail.length) * 0.6);
        
        if (alpha > 0) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
          ctx.fill();
        }
      });
      
      // Ball glow
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 25;
      
      // Ball body with gradient
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, PHYSICS.BALL_RADIUS, 0, Math.PI * 2);
      
      const ballGradient = ctx.createRadialGradient(
        ball.x - 3, ball.y - 3, 0,
        ball.x, ball.y, PHYSICS.BALL_RADIUS
      );
      ballGradient.addColorStop(0, '#ffee44');
      ballGradient.addColorStop(0.3, '#ffcc00');
      ballGradient.addColorStop(0.7, '#ff9900');
      ballGradient.addColorStop(1, '#ff6600');
      
      ctx.fillStyle = ballGradient;
      ctx.fill();
      
      // Ball highlight
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, PHYSICS.BALL_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Ball border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, PHYSICS.BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Draw last result notification
    if (lastResult) {
      const resultColor = lastResult.payout > betAmount ? '#00ff66' : '#ff4444';
      const isWin = lastResult.payout > betAmount;
      
      // Result box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowColor = resultColor;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 100, 12, 200, 55, 12);
      ctx.fill();
      
      ctx.strokeStyle = resultColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Result text
      ctx.fillStyle = resultColor;
      ctx.font = 'bold 22px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${lastResult.multiplier.toFixed(2)}x`, CANVAS_WIDTH / 2, 35);
      
      ctx.fillStyle = isWin ? '#00ff66' : '#ff6666';
      ctx.font = '15px Inter, Arial';
      const prefix = isWin ? '+' : '';
      ctx.fillText(`${prefix}$${(lastResult.payout - betAmount).toFixed(2)}`, CANVAS_WIDTH / 2, 55);
    }
  }, [getPinPositions, multipliers, numBuckets, rows, highlightedBucket, lastResult, betAmount, risk, getBucketColor, getBucketGlow]);
  
  // Helper function to shade colors
  const shadeColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };
  
  // Enhanced physics update with realistic gravity
  const updatePhysics = useCallback(() => {
    const pins = getPinPositions();
    const bucketY = 60 + rows * PIN_GAP + 25;
    const totalWidth = rows * PIN_GAP + 40;
    const bucketWidth = totalWidth / numBuckets;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    
    ballsRef.current = ballsRef.current.filter(ball => {
      if (ball.landed) return false;
      
      // Add current position to trail
      ball.trail.push({ x: ball.x, y: ball.y, time: Date.now() });
      if (ball.trail.length > PHYSICS.TRAIL_LENGTH) {
        ball.trail.shift();
      }
      
      // Apply gravity with terminal velocity
      ball.vy = Math.min(ball.vy + PHYSICS.GRAVITY, PHYSICS.TERMINAL_VELOCITY);
      
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
          ball.x += Math.cos(angle) * overlap * 1.2;
          ball.y += Math.sin(angle) * overlap * 1.2;
          
          // Reflect velocity with bounce
          const normalX = Math.cos(angle);
          const normalY = Math.sin(angle);
          const dotProduct = ball.vx * normalX + ball.vy * normalY;
          
          ball.vx -= 2 * dotProduct * normalX * PHYSICS.BOUNCE_FACTOR;
          ball.vy -= 2 * dotProduct * normalY * PHYSICS.BOUNCE_FACTOR;
          
          // Add controlled jitter
          ball.vx += (Math.random() - 0.5) * PHYSICS.JITTER;
          
          // Use predetermined path for direction bias
          if (ball.pathIndex < ball.path.length && pin.row === ball.pathIndex) {
            const direction = ball.path[ball.pathIndex];
            ball.vx += direction === 1 ? 2.5 : -2.5;
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
        
        setTimeout(() => {
          setHighlightedBucket(null);
        }, 2000);
        
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
        startTime: Date.now(),
      };
      
      ballsRef.current.push(newBall);
      
      // Wait for ball to land
      const animationTime = rows * 200 + 600;
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
    <div data-testid="plinko-game" className="flex flex-col lg:flex-row gap-6 p-4 bg-[#0a0e17] min-h-screen">
      {/* Game Canvas */}
      <div className="flex-1">
        <div className="bg-gradient-to-b from-[#111827] to-[#0d1117] rounded-2xl p-4 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Plinko</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-green-500/20 text-green-400 text-sm font-bold rounded-full border border-green-500/30 animate-pulse">
                ● LIVE
              </span>
              <span className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded-full border border-cyan-500/30">
                4% Edge
              </span>
            </div>
          </div>
          
          <canvas
            ref={canvasRef}
            data-testid="plinko-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full max-w-[800px] mx-auto rounded-xl border border-gray-800/30" 
            style={{ background: '#0d1117', aspectRatio: '800 / 720' }}
          />
        </div>
      </div>
      
      {/* Controls */}
      <div className="w-full lg:w-80">
        <div className="bg-gradient-to-b from-[#111827] to-[#0d1117] rounded-2xl p-5 space-y-5 border border-gray-800/50">
          {/* Bet Amount */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-medium">BET AMOUNT</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  data-testid="bet-amount-input"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-[#1a1f2e] border border-gray-700/50 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                  min="0.1"
                  step="0.1"
                />
              </div>
              <button
                data-testid="bet-2x"
                onClick={() => setBetAmount(prev => prev * 2)}
                className="px-4 py-2 bg-[#1a1f2e] border border-gray-700/50 rounded-xl text-white hover:bg-[#252b3d] transition-all font-medium"
              >
                2x
              </button>
              <button
                data-testid="bet-half"
                onClick={() => setBetAmount(prev => Math.max(0.1, prev / 2))}
                className="px-4 py-2 bg-[#1a1f2e] border border-gray-700/50 rounded-xl text-white hover:bg-[#252b3d] transition-all font-medium"
              >
                ½
              </button>
            </div>
          </div>
          
          {/* Risk Level */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-medium">RISK LEVEL</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-700/50">
              {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((r) => (
                <button
                  key={r}
                  data-testid={`risk-${r.toLowerCase()}`}
                  onClick={() => setRisk(r)}
                  className={`flex-1 py-3 font-bold transition-all ${
                    risk === r
                      ? r === 'LOW'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : r === 'MEDIUM'
                        ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
                        : 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                      : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#252b3d]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          
          {/* Rows Slider */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-medium">
              ROWS: <span data-testid="rows-display" className="text-cyan-400">{rows}</span>
            </label>
            <div className="relative">
              <input
                type="range"
                data-testid="rows-slider"
                min="8"
                max="16"
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                className="w-full h-2 bg-[#1a1f2e] rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
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
            data-testid="bet-button"
            onClick={placeBet}
            disabled={isPlaying || !user || betAmount > (parseFloat(user?.balance?.find(b => b.currency === 'USDT')?.available || '0'))}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              isPlaying
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 active:scale-[0.98]'
            }`}
          >
            {isPlaying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                DROPPING...
              </span>
            ) : (
              'DROP BALL [SPACE]'
            )}
          </button>
          
          {/* Balance */}
          {user && (
            <div className="text-center py-2 bg-[#1a1f2e]/50 rounded-xl">
              <span className="text-gray-400">Balance: </span>
              <span className="text-white font-bold text-lg">
                ${(parseFloat(user.balance?.find(b => b.currency === 'USDT')?.available || '0')).toFixed(2)}
              </span>
            </div>
          )}
          
          {/* History */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-medium">RECENT DROPS</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-6 bg-[#1a1f2e]/30 rounded-xl">
                  No games yet
                </div>
              ) : (
                history.map((h, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center px-4 py-2.5 rounded-xl transition-all ${
                      h.isWin 
                        ? 'bg-green-500/10 border border-green-500/20' 
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    <span className={`font-bold ${h.isWin ? 'text-green-400' : 'text-red-400'}`}>
                      {h.multiplier.toFixed(2)}x
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
