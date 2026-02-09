'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundContextSafe } from '@/contexts/SoundContext';
import config from '@/config/api';

// ============ PHYSICS CONSTANTS (Tuned for premium feel + anti-stuck) ============
const PHYSICS = {
  GRAVITY: 0.6,           // Heavier feel
  BOUNCE_FACTOR: 0.65,    // Slightly less bouncy to prevent trapping
  FRICTION: 0.985,        // Air resistance
  BALL_RADIUS: 10,
  PIN_RADIUS: 5,
  TRAIL_LENGTH: 14,
  JITTER: 2.0,            // Slightly more jitter to prevent stuck states
  TERMINAL_VELOCITY: 14,
  // Anti-stuck parameters
  MIN_VELOCITY: 0.5,      // Minimum velocity before anti-stuck kicks in
  STUCK_FRAMES: 15,       // Frames of low velocity before forcing movement
  MAX_FALL_TIME: 6000,    // Maximum ms before force-landing the ball (6 seconds)
  RESCUE_FORCE: 3.0,      // Force applied to rescue stuck balls
};

// ============ VISUAL CONSTANTS ============
const VISUALS = {
  BUCKET_GRADIENTS: {
    LOW: { high: '#00ff88', mid: '#ffcc00', low: '#666666' },
    MEDIUM: { high: '#ff6600', mid: '#ffcc00', low: '#444444' },
    HIGH: { high: '#ff0055', mid: '#ff6600', low: '#333333' },
  },
  GLOW_INTENSITY: 20,
  PIN_GLOW: '#00ffff',
  BALL_COLORS: ['#ffcc00', '#ff9900', '#ff6600'],
};

// ============ SOUND SYSTEM ============
class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioContext();
    }
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      // Web Audio API not supported
    }
  }

  private ensureContext() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playPinHit() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.setValueAtTime(800 + Math.random() * 400, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.05);
    gain.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  playBallDrop() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.2);
    gain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.2);
  }

  playBucketLand(multiplier: number) {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    if (multiplier >= 10) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.3);
      gain.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.4);
    } else if (multiplier >= 2) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
      gain.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.2);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);
      gain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.1);
    }
  }

  playWin(isJackpot: boolean = false) {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();
    const frequencies = isJackpot ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.audioContext) return;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
        gain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + 0.5);
      }, i * 100);
    });
  }

  playLose() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.2);
    gain.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.2);
  }

  playButtonClick() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
    gain.gain.setValueAtTime(this.volume * 0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  setEnabled(enabled: boolean) { this.enabled = enabled; }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(1, volume)); }
  isEnabled() { return this.enabled; }
  getVolume() { return this.volume; }
}

const soundManager = new SoundManager();

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
  targetBucketIndex: number; // Backend's correct bucket - used for magnet guidance
  multiplier: number;
  payout: number;
  profit: number;
  startTime: number;
  lastPinHit: number;
  resultRevealed: boolean;
  // Anti-stuck tracking
  stuckFrames: number;
  lastY: number;
  lastX: number;
}

interface AutoBetConfig {
  enabled: boolean;
  numberOfBets: number;
  betsRemaining: number;
  stopOnWin: boolean;
  stopOnLoss: boolean;
  stopOnWinAmount: number;
  stopOnLossAmount: number;
  totalProfit: number;
}

// ============ MAIN COMPONENT ============
const PlinkoGame: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const ballsRef = useRef<Ball[]>([]);
  
  const [betAmount, setBetAmount] = useState<number>(10);
  const [rows, setRows] = useState<number>(16);
  const [risk, setRisk] = useState<RiskLevel>('MEDIUM');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBalls, setActiveBalls] = useState(0);
  const activeBallsRef = useRef(0);
  const [lastResult, setLastResult] = useState<{ multiplier: number; payout: number } | null>(null);
  const [history, setHistory] = useState<{ multiplier: number; payout: number; isWin: boolean }[]>([]);
  const [highlightedBucket, setHighlightedBucket] = useState<number | null>(null);
  // Sound synced with global SoundContext
  const { isSoundActive, toggleGameSound, gameSoundEnabled } = useSoundContextSafe();
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [multipliersLoaded, setMultipliersLoaded] = useState(false);
  const [showFairness, setShowFairness] = useState(false);
  const [lastGameData, setLastGameData] = useState<any>(null);
  
  // Auto-bet state
  const [autoBet, setAutoBet] = useState<AutoBetConfig>({
    enabled: false,
    numberOfBets: 10,
    betsRemaining: 0,
    stopOnWin: false,
    stopOnLoss: false,
    stopOnWinAmount: 100,
    stopOnLossAmount: 50,
    totalProfit: 0,
  });
  const autoBetRef = useRef(autoBet);
  autoBetRef.current = autoBet;
  
  // Canvas dimensions
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 720;
  const PIN_GAP = 35;
  const numBuckets = rows + 1;

  // ============ FETCH MULTIPLIERS FROM SERVER (Single Source of Truth) ============
  useEffect(() => {
    const fetchMultipliers = async () => {
      try {
        const response = await fetch(
          `${config.apiUrl}/games/plinko/multipliers?rows=${rows}&risk=${risk}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.multipliers && data.multipliers.length > 0) {
            setMultipliers(data.multipliers);
            setMultipliersLoaded(true);
            return;
          }
        }
      } catch (e) {
        // Failed to fetch multipliers from server, using fallback
      }
      // Fallback: hardcoded multipliers (kept for offline/error resilience)
      const FALLBACK_MULTIPLIERS: Record<string, Record<number, number[]>> = {
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
      setMultipliers(FALLBACK_MULTIPLIERS[risk]?.[rows] || []);
      setMultipliersLoaded(true);
    };
    fetchMultipliers();
  }, [rows, risk]);

  // Sync SoundManager with global SoundContext
  useEffect(() => {
    soundManager.setEnabled(isSoundActive);
  }, [isSoundActive]);

  // ============ BUCKET COLORS ============
  const getBucketColor = useCallback((mult: number): string => {
    if (mult >= 50) return '#ff0055';
    if (mult >= 20) return '#ff3366';
    if (mult >= 10) return '#ff6633';
    if (mult >= 5) return '#ff9900';
    if (mult >= 2) return '#ffcc00';
    if (mult >= 1) return '#00cc66';
    if (mult >= 0.5) return '#0099cc';
    return '#666666';
  }, []);

  const getBucketGlow = useCallback((mult: number): string => {
    if (mult >= 50) return 'rgba(255, 0, 85, 0.8)';
    if (mult >= 20) return 'rgba(255, 51, 102, 0.6)';
    if (mult >= 10) return 'rgba(255, 102, 51, 0.5)';
    if (mult >= 5) return 'rgba(255, 153, 0, 0.4)';
    return 'rgba(255, 204, 0, 0.3)';
  }, []);

  // ============ PIN POSITIONS ============
  const getPinPositions = useCallback(() => {
    const pins: { x: number; y: number; row: number }[] = [];
    const startY = 60;
    const centerX = CANVAS_WIDTH / 2;
    for (let row = 0; row < rows; row++) {
      const pinsInRow = row + 3;
      const rowWidth = (pinsInRow - 1) * PIN_GAP;
      const startX = centerX - rowWidth / 2;
      for (let pin = 0; pin < pinsInRow; pin++) {
        pins.push({ x: startX + pin * PIN_GAP, y: startY + row * PIN_GAP, row });
      }
    }
    return pins;
  }, [rows]);

  // ============ DRAW FUNCTION ============
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#0d1117');
    bgGrad.addColorStop(1, '#0a0e14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw pins
    const pins = getPinPositions();
    pins.forEach(pin => {
      ctx.shadowColor = VISUALS.PIN_GLOW;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, PHYSICS.PIN_RADIUS, 0, Math.PI * 2);
      const pinGrad = ctx.createRadialGradient(pin.x - 1, pin.y - 1, 0, pin.x, pin.y, PHYSICS.PIN_RADIUS);
      pinGrad.addColorStop(0, '#ffffff');
      pinGrad.addColorStop(0.5, '#88ccff');
      pinGrad.addColorStop(1, '#4488aa');
      ctx.fillStyle = pinGrad;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw buckets
    const totalWidth = rows * PIN_GAP + 40;
    const bucketWidth = totalWidth / numBuckets;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    const bucketY = 60 + rows * PIN_GAP + 10;

    multipliers.forEach((mult, i) => {
      const x = startX + i * bucketWidth;
      const color = getBucketColor(mult);
      const isHighlighted = highlightedBucket === i;

      if (isHighlighted) {
        ctx.shadowColor = getBucketGlow(mult);
        ctx.shadowBlur = 25;
      }

      ctx.fillStyle = isHighlighted ? color : `${color}88`;
      ctx.beginPath();
      ctx.roundRect(x + 2, bucketY, bucketWidth - 4, 35, 6);
      ctx.fill();

      if (isHighlighted) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Multiplier text
      ctx.fillStyle = isHighlighted ? '#ffffff' : '#cccccc';
      ctx.font = `bold ${bucketWidth < 35 ? 9 : 11}px Inter, Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, x + bucketWidth / 2, bucketY + 22);
    });

    // Draw balls
    ballsRef.current.forEach(ball => {
      // Trail
      ball.trail.forEach((point, i) => {
        const alpha = (i / ball.trail.length) * 0.4;
        const radius = PHYSICS.BALL_RADIUS * (i / ball.trail.length) * 0.6;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
        ctx.fill();
      });

      // Ball glow
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 25;

      // Ball body
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, PHYSICS.BALL_RADIUS, 0, Math.PI * 2);
      const ballGrad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, PHYSICS.BALL_RADIUS);
      ballGrad.addColorStop(0, '#ffee44');
      ballGrad.addColorStop(0.3, '#ffcc00');
      ballGrad.addColorStop(0.7, '#ff9900');
      ballGrad.addColorStop(1, '#ff6600');
      ctx.fillStyle = ballGrad;
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

  // ============ FORCE LAND BALL (used by anti-stuck and timeout) ============
  const forceLandBall = useCallback((ball: Ball, startX: number, bucketWidth: number) => {
    ball.landed = true;
    ball.bucketIndex = ball.targetBucketIndex >= 0 ? ball.targetBucketIndex : Math.max(0, Math.min(numBuckets - 1, Math.floor((ball.x - startX) / bucketWidth)));
    ball.x = startX + (ball.bucketIndex + 0.5) * bucketWidth;

    soundManager.playBucketLand(ball.multiplier);
    setHighlightedBucket(ball.bucketIndex);
    setTimeout(() => setHighlightedBucket(null), 2000);

    if (!ball.resultRevealed) {
      ball.resultRevealed = true;
      setLastResult({ multiplier: ball.multiplier, payout: ball.payout });
      setHistory(prev => [
        { multiplier: ball.multiplier, payout: ball.payout, isWin: ball.payout > betAmount },
        ...prev.slice(0, 19),
      ]);
      if (ball.payout > betAmount) {
        soundManager.playWin(ball.multiplier >= 50);
      } else {
        soundManager.playLose();
      }
      refreshUser();
      activeBallsRef.current = Math.max(0, activeBallsRef.current - 1);
      setActiveBalls(activeBallsRef.current);
      if (activeBallsRef.current === 0) {
        setIsPlaying(false);
      }

      // Auto-bet logic
      const currentAutoBet = autoBetRef.current;
      if (currentAutoBet.enabled && currentAutoBet.betsRemaining > 0) {
        const newProfit = currentAutoBet.totalProfit + ball.profit;
        const shouldStop =
          (currentAutoBet.stopOnWin && ball.profit > 0 && newProfit >= currentAutoBet.stopOnWinAmount) ||
          (currentAutoBet.stopOnLoss && ball.profit < 0 && Math.abs(newProfit) >= currentAutoBet.stopOnLossAmount);

        if (shouldStop || currentAutoBet.betsRemaining <= 1) {
          setAutoBet(prev => ({ ...prev, enabled: false, betsRemaining: 0, totalProfit: newProfit }));
        } else {
          setAutoBet(prev => ({
            ...prev,
            betsRemaining: prev.betsRemaining - 1,
            totalProfit: newProfit,
          }));
          setTimeout(() => placeBetInternal(), 800);
        }
      }
    }
  }, [numBuckets, betAmount, refreshUser]);

  // ============ PHYSICS UPDATE WITH ANTI-STUCK MECHANISM ============
  const updatePhysics = useCallback(() => {
    const pins = getPinPositions();
    const bucketY = 60 + rows * PIN_GAP + 25;
    const totalWidth = rows * PIN_GAP + 40;
    const bucketWidth = totalWidth / numBuckets;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    const centerX = CANVAS_WIDTH / 2;
    const startY = 60;
    const now = Date.now();

    ballsRef.current = ballsRef.current.filter(ball => {
      if (ball.landed) return false;

      // ===== TIMEOUT SAFETY: Force-land after MAX_FALL_TIME =====
      const elapsed = now - ball.startTime;
      if (elapsed > PHYSICS.MAX_FALL_TIME) {
        forceLandBall(ball, startX, bucketWidth);
        return false;
      }

      // Trail
      ball.trail.push({ x: ball.x, y: ball.y, time: now });
      if (ball.trail.length > PHYSICS.TRAIL_LENGTH) ball.trail.shift();

      // Gravity with terminal velocity
      ball.vy = Math.min(ball.vy + PHYSICS.GRAVITY, PHYSICS.TERMINAL_VELOCITY);

      // Air resistance / friction
      ball.vx *= PHYSICS.FRICTION;

      // ===== ANTI-STUCK DETECTION =====
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      const moved = Math.abs(ball.y - ball.lastY) + Math.abs(ball.x - ball.lastX);
      
      if (speed < PHYSICS.MIN_VELOCITY || moved < 0.3) {
        ball.stuckFrames++;
      } else {
        ball.stuckFrames = 0;
      }

      // If stuck for too many frames, apply rescue force
      if (ball.stuckFrames > PHYSICS.STUCK_FRAMES) {
        // Push ball downward and to a random side
        ball.vy = PHYSICS.RESCUE_FORCE;
        ball.vx = (Math.random() - 0.5) * PHYSICS.RESCUE_FORCE * 2;
        // Push ball away from any nearby pin
        pins.forEach(pin => {
          const dx = ball.x - pin.x;
          const dy = ball.y - pin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < PHYSICS.BALL_RADIUS + PHYSICS.PIN_RADIUS + 5) {
            ball.x += (dx / dist) * 8;
            ball.y += (dy / dist) * 8;
          }
        });
        ball.stuckFrames = 0;
      }

      ball.lastX = ball.x;
      ball.lastY = ball.y;

      // Pin collisions
      let hitPin = false;
      pins.forEach(pin => {
        const dx = ball.x - pin.x;
        const dy = ball.y - pin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = PHYSICS.BALL_RADIUS + PHYSICS.PIN_RADIUS;

        if (dist < minDist && dist > 0) {
          hitPin = true;
          const angle = Math.atan2(dy, dx);
          const overlap = minDist - dist;
          
          // Push ball out of pin with extra margin to prevent re-entry
          ball.x += Math.cos(angle) * (overlap + 2);
          ball.y += Math.sin(angle) * (overlap + 2);

          const normalX = Math.cos(angle);
          const normalY = Math.sin(angle);
          const dotProduct = ball.vx * normalX + ball.vy * normalY;
          ball.vx -= 2 * dotProduct * normalX * PHYSICS.BOUNCE_FACTOR;
          ball.vy -= 2 * dotProduct * normalY * PHYSICS.BOUNCE_FACTOR;

          // Ensure ball always has minimum downward velocity after pin hit
          if (ball.vy < 1.0) {
            ball.vy = 1.0;
          }

          // Controlled jitter
          ball.vx += (Math.random() - 0.5) * PHYSICS.JITTER;

          // Path-based direction bias
          if (ball.pathIndex < ball.path.length && pin.row === ball.pathIndex) {
            const direction = ball.path[ball.pathIndex];
            ball.vx += direction === 1 ? 2.5 : -2.5;
            ball.pathIndex++;
          }

          // Throttled pin hit sound
          if (now - ball.lastPinHit > 50) {
            soundManager.playPinHit();
            ball.lastPinHit = now;
          }
        }
      });

      // Update position
      ball.x += ball.vx;
      ball.y += ball.vy;

      // ===== TRIANGULAR BOUNDARY COLLISION =====
      const progress = Math.max(0, (ball.y - startY) / (bucketY - startY));
      const topHalfWidth = PIN_GAP * 1.5;
      const bottomHalfWidth = totalWidth / 2 + PHYSICS.BALL_RADIUS;
      const currentHalfWidth = topHalfWidth + (bottomHalfWidth - topHalfWidth) * progress;

      // Left triangle wall
      if (ball.x < centerX - currentHalfWidth) {
        ball.x = centerX - currentHalfWidth;
        ball.vx = Math.abs(ball.vx) * 0.5;
        ball.x += 2;
      }
      // Right triangle wall
      if (ball.x > centerX + currentHalfWidth) {
        ball.x = centerX + currentHalfWidth;
        ball.vx = -Math.abs(ball.vx) * 0.5;
        ball.x -= 2;
      }

      // ===== MAGNET GUIDANCE: Ensure ball lands on correct backend bucket =====
      if (progress > 0.7 && ball.targetBucketIndex >= 0) {
        const targetX = startX + (ball.targetBucketIndex + 0.5) * bucketWidth;
        const dx = targetX - ball.x;
        const magnetStrength = (progress - 0.7) / 0.3;
        ball.vx += dx * 0.08 * magnetStrength;
      }

      // ===== BUCKET LANDING =====
      if (ball.y >= bucketY - PHYSICS.BALL_RADIUS) {
        forceLandBall(ball, startX, bucketWidth);
        return false;
      }

      return true;
    });
  }, [getPinPositions, rows, numBuckets, betAmount, refreshUser, forceLandBall]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      updatePhysics();
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [updatePhysics, draw]);

  // ============ PLACE BET (Internal - used by both manual and auto) ============
  const placeBetInternal = async () => {
    if (!user || !token) return;
    if (betAmount <= 0) return;

    const balance = parseFloat(user.balance?.find((b: any) => b.currency === 'USDT')?.available || '0');
    if (betAmount > balance) return;

    // Multi-ball: allow up to 10 concurrent balls
    if (activeBallsRef.current >= 10) return;

    setIsPlaying(true);
    activeBallsRef.current++;
    setActiveBalls(activeBallsRef.current);
    setLastResult(null);
    soundManager.playButtonClick();

    try {
      const response = await fetch(`${config.apiUrl}/games/plinko/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ betAmount, rows, risk }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to place bet');
      }

      const result = await response.json();

      // Store game data for provably fair verification
      setLastGameData(result);

      // Play ball drop sound
      soundManager.playBallDrop();

      // Create ball with result data attached + anti-stuck tracking
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
        targetBucketIndex: result.bucketIndex,
        multiplier: result.multiplier,
        payout: result.payout,
        profit: result.profit,
        startTime: Date.now(),
        lastPinHit: 0,
        resultRevealed: false,
        // Anti-stuck tracking
        stuckFrames: 0,
        lastY: 30,
        lastX: CANVAS_WIDTH / 2,
      };

      ballsRef.current.push(newBall);

    } catch (error: any) {
      activeBallsRef.current = Math.max(0, activeBallsRef.current - 1);
      setActiveBalls(activeBallsRef.current);
      if (activeBallsRef.current === 0) {
        setIsPlaying(false);
      }
      // Stop auto-bet on error
      if (autoBetRef.current.enabled) {
        setAutoBet(prev => ({ ...prev, enabled: false, betsRemaining: 0 }));
      }
      setLastResult(null);
      alert(error.message || 'Failed to place bet');
    }
  };

  // Manual bet handler
  const placeBet = async () => {
    if (!user || !token) {
      alert('Please login to play');
      return;
    }
    if (activeBallsRef.current >= 10) return;
    await placeBetInternal();
  };

  // Auto-bet start/stop
  const toggleAutoBet = () => {
    if (autoBet.enabled) {
      setAutoBet(prev => ({ ...prev, enabled: false, betsRemaining: 0 }));
    } else {
      setAutoBet(prev => ({
        ...prev,
        enabled: true,
        betsRemaining: prev.numberOfBets,
        totalProfit: 0,
      }));
      placeBetInternal();
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeBallsRef.current < 10 && activeTab === 'manual') {
        e.preventDefault();
        placeBet();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, betAmount, rows, risk, user, token, activeTab]);

  // ============ RENDER ============
  return (
    <div data-testid="plinko-game" className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 bg-[#0a0e17] min-h-screen">
      {/* Game Canvas */}
      <div className="flex-1 min-w-0">
        <div className="bg-gradient-to-b from-[#111827] to-[#0d1117] rounded-2xl p-3 sm:p-4 border border-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-lg sm:text-xl">🎯</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Plinko</h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Sound Toggle Button */}
              <button
                onClick={toggleGameSound}
                className={`p-2 rounded-lg transition-all ${
                  isSoundActive
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-gray-700/50 text-gray-500 border border-gray-600/30'
                }`}
                title={!isSoundActive ? 'Sound Off (enable in Settings)' : gameSoundEnabled ? 'Mute Game' : 'Unmute Game'}
              >
                {isSoundActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                )}
              </button>
              {/* Provably Fair Button */}
              <button
                onClick={() => setShowFairness(!showFairness)}
                className="p-2 rounded-lg bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50 hover:text-white transition-all"
                title="Provably Fair"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </button>
              <span className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs sm:text-sm font-bold rounded-full border border-green-500/30 animate-pulse">
                ● LIVE
              </span>
            </div>
          </div>

          {/* Provably Fair Panel */}
          {showFairness && (
            <div className="mb-4 p-4 bg-[#1a1f2e] rounded-xl border border-gray-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Provably Fair
              </h3>
              {lastGameData ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Server Seed Hash:</span>
                    <span className="text-cyan-400 font-mono text-xs break-all max-w-[200px]">
                      {lastGameData.serverSeedHash || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Client Seed:</span>
                    <span className="text-cyan-400 font-mono text-xs break-all max-w-[200px]">
                      {lastGameData.clientSeed || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nonce:</span>
                    <span className="text-white">{lastGameData.nonce ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Path:</span>
                    <span className="text-white font-mono text-xs">
                      [{lastGameData.path?.join(', ')}]
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Result:</span>
                    <span className="text-green-400 font-bold">{lastGameData.multiplier}x</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Play a game to see fairness data</p>
              )}
            </div>
          )}

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

      {/* Controls Panel */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="bg-gradient-to-b from-[#111827] to-[#0d1117] rounded-2xl p-4 sm:p-5 space-y-4 border border-gray-800/50">
          
          {/* Manual / Auto Tab Switcher */}
          <div className="flex rounded-xl overflow-hidden border border-gray-700/50">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2.5 font-bold text-sm transition-all ${
                activeTab === 'manual'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#252b3d]'
              }`}
            >
              MANUAL
            </button>
            <button
              onClick={() => setActiveTab('auto')}
              className={`flex-1 py-2.5 font-bold text-sm transition-all ${
                activeTab === 'auto'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#252b3d]'
              }`}
            >
              AUTO
            </button>
          </div>

          {/* Bet Amount */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">BET AMOUNT</label>
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
                  disabled={autoBet.enabled}
                />
              </div>
              <button
                data-testid="bet-2x"
                onClick={() => { soundManager.playButtonClick(); setBetAmount(prev => prev * 2); }}
                disabled={autoBet.enabled}
                className="px-3 sm:px-4 py-2 bg-[#1a1f2e] border border-gray-700/50 rounded-xl text-white hover:bg-[#252b3d] transition-all font-medium disabled:opacity-50"
              >
                2x
              </button>
              <button
                data-testid="bet-half"
                onClick={() => { soundManager.playButtonClick(); setBetAmount(prev => Math.max(0.1, prev / 2)); }}
                disabled={autoBet.enabled}
                className="px-3 sm:px-4 py-2 bg-[#1a1f2e] border border-gray-700/50 rounded-xl text-white hover:bg-[#252b3d] transition-all font-medium disabled:opacity-50"
              >
                ½
              </button>
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">RISK LEVEL</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-700/50">
              {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((r) => (
                <button
                  key={r}
                  data-testid={`risk-${r.toLowerCase()}`}
                  onClick={() => { soundManager.playButtonClick(); setRisk(r); }}
                  disabled={autoBet.enabled || activeBalls > 0}
                  className={`flex-1 py-2.5 sm:py-3 font-bold text-sm transition-all ${
                    risk === r
                      ? r === 'LOW'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : r === 'MEDIUM'
                        ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
                        : 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                      : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#252b3d]'
                  } disabled:opacity-50`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Rows Slider */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">
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
                disabled={autoBet.enabled || activeBalls > 0}
                className="w-full h-2 bg-[#1a1f2e] rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span>
              </div>
            </div>
          </div>

          {/* Auto-Bet Settings (shown only in Auto tab) */}
          {activeTab === 'auto' && (
            <div className="space-y-3 p-3 bg-[#1a1f2e]/50 rounded-xl border border-orange-500/20">
              <div>
                <label className="block text-xs text-gray-400 mb-1">NUMBER OF BETS</label>
                <input
                  type="number"
                  value={autoBet.numberOfBets}
                  onChange={(e) => setAutoBet(prev => ({ ...prev, numberOfBets: Math.max(1, Number(e.target.value)) }))}
                  disabled={autoBet.enabled}
                  className="w-full bg-[#0d1117] border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50"
                  min="1"
                  max="1000"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Stop on Win ($)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoBet.stopOnWin}
                    onChange={(e) => setAutoBet(prev => ({ ...prev, stopOnWin: e.target.checked }))}
                    disabled={autoBet.enabled}
                    className="accent-orange-500"
                  />
                  <input
                    type="number"
                    value={autoBet.stopOnWinAmount}
                    onChange={(e) => setAutoBet(prev => ({ ...prev, stopOnWinAmount: Number(e.target.value) }))}
                    disabled={autoBet.enabled || !autoBet.stopOnWin}
                    className="w-20 bg-[#0d1117] border border-gray-700/50 rounded-lg px-2 py-1 text-white text-xs focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Stop on Loss ($)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoBet.stopOnLoss}
                    onChange={(e) => setAutoBet(prev => ({ ...prev, stopOnLoss: e.target.checked }))}
                    disabled={autoBet.enabled}
                    className="accent-orange-500"
                  />
                  <input
                    type="number"
                    value={autoBet.stopOnLossAmount}
                    onChange={(e) => setAutoBet(prev => ({ ...prev, stopOnLossAmount: Number(e.target.value) }))}
                    disabled={autoBet.enabled || !autoBet.stopOnLoss}
                    className="w-20 bg-[#0d1117] border border-gray-700/50 rounded-lg px-2 py-1 text-white text-xs focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
              {autoBet.enabled && (
                <div className="text-center text-xs">
                  <span className="text-orange-400">Bets remaining: {autoBet.betsRemaining}</span>
                  <span className="mx-2 text-gray-600">|</span>
                  <span className={autoBet.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    P/L: ${autoBet.totalProfit.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bet / Auto-Bet Button */}
          {activeTab === 'manual' ? (
            <button
              data-testid="bet-button"
              onClick={placeBet}
              disabled={activeBalls >= 10 || !user || betAmount > (parseFloat(user?.balance?.find((b: any) => b.currency === 'USDT')?.available || '0'))}
              className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all ${
                activeBalls >= 10
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 active:scale-[0.98]'
              }`}
            >
              {activeBalls > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-400/30 flex items-center justify-center text-xs font-bold text-cyan-300">{activeBalls}</span>
                  DROP BALL [SPACE]
                </span>
              ) : (
                'DROP BALL [SPACE]'
              )}
            </button>
          ) : (
            <button
              onClick={toggleAutoBet}
              disabled={!user || (!autoBet.enabled && betAmount > (parseFloat(user?.balance?.find((b: any) => b.currency === 'USDT')?.available || '0')))}
              className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all ${
                autoBet.enabled
                  ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/30'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400 shadow-lg shadow-orange-500/30 active:scale-[0.98]'
              }`}
            >
              {autoBet.enabled ? 'STOP AUTO-BET' : 'START AUTO-BET'}
            </button>
          )}

          {/* Balance */}
          {user && (
            <div className="text-center py-2 bg-[#1a1f2e]/50 rounded-xl">
              <span className="text-gray-400 text-sm">Balance: </span>
              <span className="text-white font-bold text-base sm:text-lg">
                ${(parseFloat(user.balance?.find((b: any) => b.currency === 'USDT')?.available || '0')).toFixed(2)}
              </span>
            </div>
          )}

          {/* History */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">RECENT DROPS</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-6 bg-[#1a1f2e]/30 rounded-xl">
                  No games yet
                </div>
              ) : (
                history.map((h, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center px-3 sm:px-4 py-2 rounded-xl transition-all ${
                      h.isWin
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    <span className={`font-bold text-sm ${h.isWin ? 'text-green-400' : 'text-red-400'}`}>
                      {h.multiplier.toFixed(2)}x
                    </span>
                    <span className={`text-sm ${h.isWin ? 'text-green-400' : 'text-red-400'}`}>
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
