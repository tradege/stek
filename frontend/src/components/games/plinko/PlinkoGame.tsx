'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundContextSafe } from '@/contexts/SoundContext';
import config from '@/config/api';

// ============ ANIMATION CONSTANTS ============
const ANIM = {
  BALL_RADIUS: 10,
  PIN_RADIUS: 5,
  TRAIL_LENGTH: 14,
  // Deterministic animation timing
  STEP_DURATION: 80,        // ms per peg row step
  EASING: 'smooth',         // smooth interpolation between waypoints
};

// ============ VISUAL CONSTANTS ============
const VISUALS = {
  GLOW_INTENSITY: 20,
  PIN_GLOW: '#00ffff',
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

// ============ DETERMINISTIC BALL TYPE ============
interface Ball {
  // Waypoints: pre-calculated positions the ball must pass through
  waypoints: { x: number; y: number }[];
  currentWaypointIndex: number;
  // Current interpolated position
  x: number;
  y: number;
  // Animation timing
  startTime: number;
  stepDuration: number;
  // Trail for visual effect
  trail: { x: number; y: number; time: number }[];
  // Result data
  landed: boolean;
  bucketIndex: number;
  targetBucketIndex: number;
  multiplier: number;
  payout: number;
  profit: number;
  resultRevealed: boolean;
  // Track last pin hit for sound throttling
  lastSoundStep: number;
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

// ============ EASING FUNCTION ============
// Smooth ease-in-out for natural-looking movement
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
  const { isSoundActive, toggleGameSound, gameSoundEnabled } = useSoundContextSafe();
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [multipliersLoaded, setMultipliersLoaded] = useState(false);
  const [showFairness, setShowFairness] = useState(false);
  const [lastGameData, setLastGameData] = useState<any>(null);
  
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
  
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 720;
  const PIN_GAP = 35;
  const numBuckets = rows + 1;

  // ============ FETCH MULTIPLIERS FROM SERVER ============
  useEffect(() => {
    const fetchMultipliers = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/games/plinko/multipliers?rows=${rows}&risk=${risk}`);
        if (response.ok) {
          const data = await response.json();
          if (data.multipliers && Array.isArray(data.multipliers)) {
            setMultipliers(data.multipliers);
            setMultipliersLoaded(true);
            return;
          }
        }
      } catch (e) {}
      
      const FALLBACK_MULTIPLIERS: Record<string, Record<number, number[]>> = {
        LOW: {
          8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
          9: [5.6, 2.0, 1.6, 1.0, 0.7, 0.7, 1.0, 1.6, 2.0, 5.6],
          10: [8.9, 3.0, 1.4, 1.1, 1.0, 0.4, 1.0, 1.1, 1.4, 3.0, 8.9],
          11: [8.4, 3.0, 1.9, 1.3, 1.0, 0.7, 0.7, 1.0, 1.3, 1.9, 3.0, 8.4],
          12: [10.0, 3.0, 1.6, 1.4, 1.1, 1.0, 0.3, 1.0, 1.1, 1.4, 1.6, 3.0, 10.0],
          13: [8.1, 4.0, 3.0, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3.0, 4.0, 8.1],
          14: [7.1, 4.0, 1.9, 1.4, 1.3, 1.0, 0.9, 0.5, 0.9, 1.0, 1.3, 1.4, 1.9, 4.0, 7.1],
          15: [15.0, 8.0, 3.0, 2.0, 1.5, 1.1, 1.0, 0.7, 0.7, 1.0, 1.1, 1.5, 2.0, 3.0, 8.0, 15.0],
          16: [16.0, 9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16.0],
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

  // ============ CALCULATE DETERMINISTIC WAYPOINTS ============
  // Given a path array from the backend (array of 0=Left, 1=Right),
  // compute exact X,Y coordinates for each peg the ball passes through.
  const calculateWaypoints = useCallback((path: number[]): { x: number; y: number }[] => {
    const centerX = CANVAS_WIDTH / 2;
    const startY = 60;
    const totalWidth = rows * PIN_GAP + 40;
    const bucketWidth = totalWidth / numBuckets;
    const bucketStartX = CANVAS_WIDTH / 2 - totalWidth / 2;
    const bucketY = startY + rows * PIN_GAP + 25;

    const waypoints: { x: number; y: number }[] = [];

    // Starting position: top center (drop point)
    waypoints.push({ x: centerX, y: 25 });

    // Track the ball's horizontal slot position.
    // At each row, the ball is between two pegs. 
    // We track which "slot" (gap between pegs) the ball is in.
    // Row 0 has 3 pegs, so 2 gaps above it. The ball starts in the middle.
    // Actually, the ball drops from above row 0, hitting a peg in row 0.
    // 
    // For row r, there are (r+3) pegs.
    // The ball enters from above and hits one of the pegs.
    // Path[r] = 0 means go left, 1 means go right of the peg it hits.
    //
    // Simpler model: track a cumulative offset.
    // The ball starts centered. Each L/R shifts it by half a PIN_GAP.
    
    let xOffset = 0; // cumulative offset from center in units of PIN_GAP/2

    for (let row = 0; row < rows && row < path.length; row++) {
      const direction = path[row]; // 0 = left, 1 = right
      
      // After bouncing off the peg at this row, the ball shifts left or right
      if (direction === 1) {
        xOffset += 1; // shift right by half PIN_GAP
      } else {
        xOffset -= 1; // shift left by half PIN_GAP
      }

      // The ball's X position after this row's bounce
      const ballX = centerX + xOffset * (PIN_GAP / 2);
      // The ball's Y position: midway between this row and the next row
      const ballY = startY + row * PIN_GAP + PIN_GAP * 0.65;

      waypoints.push({ x: ballX, y: ballY });
    }

    // Final waypoint: the bucket landing position
    // Calculate which bucket the ball lands in from the path
    let rightCount = 0;
    for (let i = 0; i < Math.min(rows, path.length); i++) {
      if (path[i] === 1) rightCount++;
    }
    const bucketIndex = rightCount;
    const finalX = bucketStartX + (bucketIndex + 0.5) * bucketWidth;
    const finalY = bucketY;
    waypoints.push({ x: finalX, y: finalY });

    return waypoints;
  }, [rows, numBuckets]);

  // ============ DRAW FUNCTION ============
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#0d1117');
    bgGrad.addColorStop(1, '#0a0e14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const pins = getPinPositions();
    pins.forEach(pin => {
      ctx.shadowColor = VISUALS.PIN_GLOW;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, ANIM.PIN_RADIUS, 0, Math.PI * 2);
      const pinGrad = ctx.createRadialGradient(pin.x - 1, pin.y - 1, 0, pin.x, pin.y, ANIM.PIN_RADIUS);
      pinGrad.addColorStop(0, '#ffffff');
      pinGrad.addColorStop(0.5, '#88ccff');
      pinGrad.addColorStop(1, '#4488aa');
      ctx.fillStyle = pinGrad;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

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
        const radius = ANIM.BALL_RADIUS * (i / ball.trail.length) * 0.6;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
        ctx.fill();
      });

      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 25;

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ANIM.BALL_RADIUS, 0, Math.PI * 2);
      const ballGrad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ANIM.BALL_RADIUS);
      ballGrad.addColorStop(0, '#ffee44');
      ballGrad.addColorStop(0.3, '#ffcc00');
      ballGrad.addColorStop(0.7, '#ff9900');
      ballGrad.addColorStop(1, '#ff6600');
      ctx.fillStyle = ballGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, ANIM.BALL_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ANIM.BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Result display
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

  // ============ LAND BALL (reveal result) ============
  const landBall = useCallback((ball: Ball) => {
    ball.landed = true;
    ball.bucketIndex = ball.targetBucketIndex;

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

  // ============ DETERMINISTIC ANIMATION UPDATE ============
  const updateAnimation = useCallback(() => {
    const now = Date.now();

    ballsRef.current = ballsRef.current.filter(ball => {
      if (ball.landed) return false;

      const elapsed = now - ball.startTime;
      const totalSteps = ball.waypoints.length - 1;
      const totalDuration = totalSteps * ball.stepDuration;

      // Calculate which step we're on and the progress within that step
      const rawProgress = Math.min(elapsed / totalDuration, 1.0);
      const currentStepFloat = rawProgress * totalSteps;
      const currentStep = Math.min(Math.floor(currentStepFloat), totalSteps - 1);
      const stepProgress = currentStepFloat - currentStep;

      // Get the two waypoints we're interpolating between
      const from = ball.waypoints[currentStep];
      const to = ball.waypoints[Math.min(currentStep + 1, totalSteps)];

      // Apply easing for smooth movement
      const easedProgress = easeInOutQuad(stepProgress);

      // Interpolate position
      ball.x = from.x + (to.x - from.x) * easedProgress;
      ball.y = from.y + (to.y - from.y) * easedProgress;

      // Update trail
      ball.trail.push({ x: ball.x, y: ball.y, time: now });
      if (ball.trail.length > ANIM.TRAIL_LENGTH) ball.trail.shift();

      // Play pin hit sound at each new step (each peg row)
      if (currentStep > ball.lastSoundStep && currentStep > 0 && currentStep < totalSteps) {
        ball.lastSoundStep = currentStep;
        soundManager.playPinHit();
      }

      // Check if animation is complete
      if (elapsed >= totalDuration) {
        // Snap to final position
        const finalWp = ball.waypoints[totalSteps];
        ball.x = finalWp.x;
        ball.y = finalWp.y;
        landBall(ball);
        return false;
      }

      return true;
    });
  }, [landBall]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      updateAnimation();
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [updateAnimation, draw]);

  // ============ PLACE BET ============
  const placeBetInternal = async () => {
    if (!user || !token) return;
    if (betAmount <= 0) return;

    const balance = parseFloat(user.balance?.find((b: any) => b.currency === 'USDT')?.available || '0');
    if (betAmount > balance) return;

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

      setLastGameData(result);
      soundManager.playBallDrop();

      // Calculate deterministic waypoints from the backend path
      const waypoints = calculateWaypoints(result.path);

      // Calculate bucket index from path
      let rightCount = 0;
      for (let i = 0; i < Math.min(rows, result.path.length); i++) {
        if (result.path[i] === 1) rightCount++;
      }

      const newBall: Ball = {
        waypoints,
        currentWaypointIndex: 0,
        x: waypoints[0].x,
        y: waypoints[0].y,
        startTime: Date.now(),
        stepDuration: ANIM.STEP_DURATION,
        trail: [],
        landed: false,
        bucketIndex: -1,
        targetBucketIndex: result.bucketIndex ?? rightCount,
        multiplier: result.multiplier,
        payout: result.payout,
        profit: result.profit,
        resultRevealed: false,
        lastSoundStep: 0,
      };

      ballsRef.current.push(newBall);

    } catch (error: any) {
      activeBallsRef.current = Math.max(0, activeBallsRef.current - 1);
      setActiveBalls(activeBallsRef.current);
      if (activeBallsRef.current === 0) {
        setIsPlaying(false);
      }
      if (autoBetRef.current.enabled) {
        setAutoBet(prev => ({ ...prev, enabled: false, betsRemaining: 0 }));
      }
      setLastResult(null);
      alert(error.message || 'Failed to place bet');
    }
  };

  const placeBet = async () => {
    if (!user || !token) {
      alert('Please login to play');
      return;
    }
    if (activeBallsRef.current >= 10) return;
    await placeBetInternal();
  };

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
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-lg sm:text-xl">🎯</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Plinko</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleGameSound}
                className={`p-2 rounded-lg transition-all ${
                  isSoundActive
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
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
                    <span className="text-accent-primary font-mono text-xs break-all max-w-[200px]">
                      {lastGameData.serverSeedHash || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Client Seed:</span>
                    <span className="text-accent-primary font-mono text-xs break-all max-w-[200px]">
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
                  ? 'bg-accent-primary text-white shadow-lg shadow-primary/30'
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
                  className="w-full bg-[#1a1f2e] border border-gray-700/50 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
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
              ROWS: <span data-testid="rows-display" className="text-accent-primary">{rows}</span>
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
                className="w-full h-2 bg-[#1a1f2e] rounded-lg appearance-none cursor-pointer primary disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span>
              </div>
            </div>
          </div>

          {/* Auto-Bet Settings */}
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
                  : 'bg-gradient-to-r from-primary to-blue-600 text-white hover:from-primary hover:to-blue-500 shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]'
              }`}
            >
              {activeBalls > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/30 flex items-center justify-center text-xs font-bold text-accent-primary">{activeBalls}</span>
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
