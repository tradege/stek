'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCrashGame, GameState, BetStatus } from '@/hooks/useCrashGame';
import { useSocket } from '@/contexts/SocketContext';
import { useSoundContextSafe } from '@/contexts/SoundContext';

/**
 * Nova Rush — Spaceship Crash Game (Cinematic Edition)
 * A spaceship flies through an asteroid field, shooting lasers.
 * Meteors come from the right. The ship shoots and destroys some,
 * but eventually one hits and the ship explodes (crash!).
 * 
 * CINEMATIC UPGRADES:
 * - Multi-layer bloom/glow effects
 * - Shockwave rings on explosions
 * - Teardrop-shaped flame particles
 * - Volumetric engine exhaust
 * - Enhanced speed lines & motion blur
 * - Screen shake with spring physics
 * - Heat distortion near explosions
 * - Atmospheric nebula with depth
 * - Improved debris with ember trails
 */

const MIN_BET = 0.10;
const MAX_BET = 10000;

// ============ PARTICLE TYPES ============
interface Star { x: number; y: number; size: number; speed: number; brightness: number; layer: number; }
interface Meteor { x: number; y: number; size: number; speed: number; angle: number; rotation: number; rotSpeed: number; alive: boolean; targeted: boolean; exploding: boolean; explodeFrame: number; color: string; }
interface Laser { x: number; y: number; targetX: number; targetY: number; life: number; }
interface Debris { x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotSpeed: number; life: number; color: string; trail: {x: number; y: number}[]; }
interface EngineParticle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; }
interface ShockwaveRing { x: number; y: number; radius: number; maxRadius: number; life: number; maxLife: number; color: string; }
interface SpeedLine { x: number; y: number; length: number; speed: number; opacity: number; }

// ============ WIN CELEBRATION ============
const WinCelebration: React.FC<{ amount: number; show: boolean }> = ({ amount, show }) => {
  if (!show) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className="animate-win-shake">
        <div className="text-5xl font-black text-green-400 animate-multiplier-pulse"
             style={{ textShadow: '0 0 40px #00D46E, 0 0 80px #00D46E' }}>
          +${Number(amount).toFixed(2)}
        </div>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============
const NovaRushGame: React.FC = () => {
  const {
    gameState, currentMultiplier, crashPoint, countdown, gameId,
    betStatus, currentBet, potentialWin, recentCrashes,
    placeBet, cashOut, isConnected, error,
  } = useCrashGame();

  const { socket } = useSocket();
  const { playSound, toggleGameSound, gameSoundEnabled, isSoundActive, clientSeed: globalClientSeed, setClientSeed: setGlobalClientSeed } = useSoundContextSafe();

  // State
  const [betAmount, setBetAmount] = useState<string>('100');
  const [autoCashout, setAutoCashout] = useState<string>('2.00');
  const [showError, setShowError] = useState(false);
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [autoBetCount, setAutoBetCount] = useState<string>('10');
  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetRemaining, setAutoBetRemaining] = useState(0);
  const [stopOnWin, setStopOnWin] = useState<string>('');
  const [stopOnLoss, setStopOnLoss] = useState<string>('');
  const autoBetRef = useRef(false);
  const [showFairPanel, setShowFairPanel] = useState(false);
  const [lastServerSeedHash, setLastServerSeedHash] = useState<string>('');
  const [lastNonce, setLastNonce] = useState<number>(0);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  // Game objects refs
  const starsRef = useRef<Star[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const lasersRef = useRef<Laser[]>([]);
  const debrisRef = useRef<Debris[]>([]);
  const engineParticlesRef = useRef<EngineParticle[]>([]);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
  const speedLinesRef = useRef<SpeedLine[]>([]);
  const shipPosRef = useRef({ x: 150, y: 0, targetY: 0, vy: 0, vx: 0, isDodging: false, dodgeTimer: 0, leanAngle: 0 });
  const shipAngleRef = useRef(0);
  const crashAnimRef = useRef({ active: false, frame: 0 });
  const lastMeteorSpawnRef = useRef(0);
  const lastLaserRef = useRef(0);
  const gameTimeRef = useRef(0);

  // Screen shake state
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0, velocityX: 0, velocityY: 0 });

  // ============ INITIALIZE STARS (3 parallax layers) ============
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 250; i++) {
      const layer = i < 50 ? 0 : i < 150 ? 1 : 2; // far, mid, near
      stars.push({
        x: Math.random() * 1200,
        y: Math.random() * 700,
        size: layer === 0 ? Math.random() * 1 + 0.3 : layer === 1 ? Math.random() * 1.5 + 0.5 : Math.random() * 2.5 + 1,
        speed: layer === 0 ? Math.random() * 0.5 + 0.2 : layer === 1 ? Math.random() * 1.5 + 0.5 : Math.random() * 3 + 1.5,
        brightness: Math.random() * 0.8 + 0.2,
        layer,
      });
    }
    starsRef.current = stars;
  }, []);

  // ============ RESPONSIVE CANVAS ============
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

  // ============ RESET ON NEW GAME ============
  useEffect(() => {
    if (gameState === 'WAITING') {
      meteorsRef.current = [];
      lasersRef.current = [];
      debrisRef.current = [];
      engineParticlesRef.current = [];
      shockwavesRef.current = [];
      speedLinesRef.current = [];
      crashAnimRef.current = { active: false, frame: 0 };
      gameTimeRef.current = 0;
      shakeRef.current = { x: 0, y: 0, intensity: 0, velocityX: 0, velocityY: 0 };
      // Reset ship dodging state
      shipPosRef.current.isDodging = false;
      shipPosRef.current.dodgeTimer = 0;
      shipPosRef.current.vy = 0;
      shipPosRef.current.vx = 0;
      shipPosRef.current.leanAngle = 0;
      setShowWinCelebration(false);
    }
  }, [gameState]);

  // ============ CRASH / WIN EFFECTS ============
  useEffect(() => {
    if (gameState === 'CRASHED') {
      playSound('crash');
      crashAnimRef.current = { active: true, frame: 0 };

      // Spawn a KILLING METEOR that visually hits the ship
      const ship = shipPosRef.current;
      meteorsRef.current.push({
        x: ship.x + 5, y: ship.y,
        size: 20, speed: 0, angle: 0,
        rotation: 0, rotSpeed: 0,
        alive: false, targeted: false,
        exploding: true, explodeFrame: 0,
        color: '#ff4400',
      });

      // Trigger screen shake with spring physics
      shakeRef.current.intensity = 22;

      // Create debris with trails
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 2;
        debrisRef.current.push({
          x: ship.x, y: ship.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 6 + 2,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          life: 80 + Math.random() * 50,
          color: ['#ff4444', '#ff8800', '#ffcc00', '#ffffff', '#4488ff', '#00aaff'][Math.floor(Math.random() * 6)],
          trail: [],
        });
      }

      // Create shockwave rings
      shockwavesRef.current.push(
        { x: ship.x, y: ship.y, radius: 5, maxRadius: 120, life: 30, maxLife: 30, color: '#ff6644' },
        { x: ship.x, y: ship.y, radius: 5, maxRadius: 80, life: 20, maxLife: 20, color: '#ffaa44' },
        { x: ship.x, y: ship.y, radius: 5, maxRadius: 200, life: 40, maxLife: 40, color: '#ff334488' },
      );

      if (betStatus === 'CASHED_OUT' && potentialWin) {
        setLastWinAmount(potentialWin);
        setShowWinCelebration(true);
        setTimeout(() => setShowWinCelebration(false), 3000);
        if (autoBetRef.current && stopOnWin) {
          const winThreshold = parseFloat(stopOnWin);
          if (!isNaN(winThreshold) && potentialWin >= winThreshold) {
            autoBetRef.current = false; setAutoBetActive(false); setAutoBetRemaining(0);
          }
        }
      }
      if (betStatus === 'LOST' && autoBetRef.current && stopOnLoss) {
        const lossThreshold = parseFloat(stopOnLoss);
        const betAmt = parseFloat(betAmount);
        if (!isNaN(lossThreshold) && !isNaN(betAmt) && betAmt >= lossThreshold) {
          autoBetRef.current = false; setAutoBetActive(false); setAutoBetRemaining(0);
        }
      }
    }
  }, [gameState, betStatus, potentialWin, playSound, stopOnWin, stopOnLoss, betAmount]);

  // ============ AUTO-BET LOGIC ============
  useEffect(() => {
    if (!autoBetRef.current) return;
    if (gameState !== 'WAITING') return;
    if (betStatus !== 'NONE') return;
    if (autoBetRemaining <= 0) {
      autoBetRef.current = false; setAutoBetActive(false); return;
    }
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

  // ============ FAIRNESS DATA ============
  useEffect(() => {
    if (!socket) return;
    const handleFairnessData = (data: any) => {
      if (data.serverSeedHash) setLastServerSeedHash(data.serverSeedHash);
      if (data.nonce !== undefined) setLastNonce(data.nonce);
    };
    socket.on('crash:fairness', handleFairnessData);
    socket.on('crash:bet_placed', (data: any) => {
      if (data.serverSeedHash) setLastServerSeedHash(data.serverSeedHash);
      if (data.nonce !== undefined) setLastNonce(data.nonce);
    });
    return () => { socket.off('crash:fairness', handleFairnessData); };
  }, [socket]);

  // ============ DRAW SPACESHIP (Cinematic) ============
  const drawShip = (ctx: CanvasRenderingContext2D, x: number, y: number, crashed: boolean) => {
    ctx.save();
    ctx.translate(x, y);

    if (crashed) {
      // Multi-layer explosion flash with bloom
      for (let layer = 3; layer >= 0; layer--) {
        const radius = 40 + layer * 25;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        const alpha = (0.3 - layer * 0.06);
        gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha + 0.3})`);
        gradient.addColorStop(0.2, `rgba(255, 200, 50, ${alpha + 0.1})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 0, ${alpha})`);
        gradient.addColorStop(0.8, `rgba(255, 30, 0, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // === MULTI-LAYER ENGINE GLOW (Bloom) ===
      const glowLayers = [
        { radius: 35, alpha: 0.15, color: '0, 100, 255' },
        { radius: 28, alpha: 0.3, color: '0, 150, 255' },
        { radius: 20, alpha: 0.5, color: '50, 180, 255' },
        { radius: 12, alpha: 0.8, color: '150, 220, 255' },
      ];
      for (const gl of glowLayers) {
        const glow = ctx.createRadialGradient(-30, 0, 0, -30, 0, gl.radius);
        glow.addColorStop(0, `rgba(${gl.color}, ${gl.alpha})`);
        glow.addColorStop(1, `rgba(${gl.color}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(-30, 0, gl.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // === ENGINE FLAME (Teardrop shape) ===
      const time = Date.now() / 100;
      const flameLen = 22 + Math.sin(time * 1.5) * 8 + Math.random() * 5;
      const flameWidth = 7 + Math.sin(time * 2.3) * 2;

      // Outer flame
      const outerGrad = ctx.createLinearGradient(-30 - flameLen, 0, -25, 0);
      outerGrad.addColorStop(0, 'rgba(0, 80, 255, 0)');
      outerGrad.addColorStop(0.3, 'rgba(0, 120, 255, 0.4)');
      outerGrad.addColorStop(0.7, 'rgba(80, 180, 255, 0.7)');
      outerGrad.addColorStop(1, 'rgba(200, 230, 255, 0.9)');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.moveTo(-25, -flameWidth);
      ctx.bezierCurveTo(-28, -flameWidth * 0.8, -30 - flameLen * 0.7, -flameWidth * 0.3, -30 - flameLen, 0);
      ctx.bezierCurveTo(-30 - flameLen * 0.7, flameWidth * 0.3, -28, flameWidth * 0.8, -25, flameWidth);
      ctx.closePath();
      ctx.fill();

      // Inner bright core flame
      const innerLen = flameLen * 0.6;
      const innerWidth = flameWidth * 0.5;
      ctx.fillStyle = 'rgba(220, 240, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(-25, -innerWidth);
      ctx.bezierCurveTo(-27, -innerWidth * 0.6, -30 - innerLen * 0.5, -innerWidth * 0.2, -30 - innerLen, 0);
      ctx.bezierCurveTo(-30 - innerLen * 0.5, innerWidth * 0.2, -27, innerWidth * 0.6, -25, innerWidth);
      ctx.closePath();
      ctx.fill();

      // === SHIP BODY ===
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 20;

      // Main hull with improved gradient
      const hullGrad = ctx.createLinearGradient(0, -12, 0, 12);
      hullGrad.addColorStop(0, '#7788aa');
      hullGrad.addColorStop(0.2, '#aabbdd');
      hullGrad.addColorStop(0.4, '#ddeeff');
      hullGrad.addColorStop(0.5, '#ffffff');
      hullGrad.addColorStop(0.6, '#ccddef');
      hullGrad.addColorStop(0.8, '#99aacc');
      hullGrad.addColorStop(1, '#556677');
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(15, -10);
      ctx.lineTo(-20, -12);
      ctx.lineTo(-28, -8);
      ctx.lineTo(-28, 8);
      ctx.lineTo(-20, 12);
      ctx.lineTo(15, 10);
      ctx.closePath();
      ctx.fill();

      // Hull edge highlight
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(150, 200, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(15, -10);
      ctx.lineTo(-20, -12);
      ctx.stroke();

      // Cockpit window with animated glow
      const cockpitPulse = Math.sin(Date.now() / 600) * 0.15 + 0.85;
      const cockpitGrad = ctx.createRadialGradient(18, 0, 0, 18, 0, 10);
      cockpitGrad.addColorStop(0, `rgba(0, 255, 220, ${cockpitPulse})`);
      cockpitGrad.addColorStop(0.5, `rgba(0, 220, 255, ${cockpitPulse * 0.7})`);
      cockpitGrad.addColorStop(1, `rgba(0, 150, 255, ${cockpitPulse * 0.3})`);
      ctx.fillStyle = cockpitGrad;
      ctx.beginPath();
      ctx.ellipse(18, 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cockpit bloom
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(0, 255, 200, 0.15)';
      ctx.beginPath();
      ctx.ellipse(18, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Wings with metallic sheen
      const wingGrad = ctx.createLinearGradient(-5, -10, -15, -22);
      wingGrad.addColorStop(0, '#667788');
      wingGrad.addColorStop(0.5, '#8899aa');
      wingGrad.addColorStop(1, '#445566');
      ctx.fillStyle = wingGrad;
      // Top wing
      ctx.beginPath();
      ctx.moveTo(-5, -10);
      ctx.lineTo(-15, -22);
      ctx.lineTo(-25, -20);
      ctx.lineTo(-20, -12);
      ctx.closePath();
      ctx.fill();
      // Bottom wing
      ctx.beginPath();
      ctx.moveTo(-5, 10);
      ctx.lineTo(-15, 22);
      ctx.lineTo(-25, 20);
      ctx.lineTo(-20, 12);
      ctx.closePath();
      ctx.fill();

      // Wing tips glow with bloom
      const tipPulse = Math.sin(Date.now() / 400) * 0.3 + 0.7;
      [{ y: -22 }, { y: 22 }].forEach(({ y }) => {
        // Outer bloom
        ctx.fillStyle = `rgba(0, 255, 170, ${tipPulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(-15, y, 6, 0, Math.PI * 2);
        ctx.fill();
        // Inner glow
        ctx.fillStyle = `rgba(0, 255, 170, ${tipPulse * 0.6})`;
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(-15, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    ctx.restore();
  };

  // ============ DRAW METEOR (Cinematic) ============
  const drawMeteor = (ctx: CanvasRenderingContext2D, meteor: Meteor) => {
    ctx.save();
    ctx.translate(meteor.x, meteor.y);
    ctx.rotate(meteor.rotation);

    if (meteor.exploding) {
      const progress = meteor.explodeFrame / 25;

      // Shockwave ring
      if (meteor.explodeFrame < 15) {
        const ringRadius = meteor.size * (1 + progress * 5);
        const ringAlpha = 1 - progress;
        ctx.strokeStyle = `rgba(255, 200, 100, ${ringAlpha * 0.6})`;
        ctx.lineWidth = 2 * (1 - progress);
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Multi-layer explosion with bloom
      for (let layer = 2; layer >= 0; layer--) {
        const radius = meteor.size * (1 + progress * (3 + layer));
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        const layerAlpha = (1 - progress) * (0.4 - layer * 0.1);
        gradient.addColorStop(0, `rgba(255, 255, 200, ${layerAlpha + 0.2})`);
        gradient.addColorStop(0.3, `rgba(255, 200, 50, ${layerAlpha})`);
        gradient.addColorStop(0.6, `rgba(255, 100, 0, ${layerAlpha * 0.6})`);
        gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Explosion sparks with trails
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + progress * 2.5;
        const dist = meteor.size * (0.5 + progress * 2.5);
        const sparkSize = 2.5 * (1 - progress);
        const sparkX = Math.cos(angle) * dist;
        const sparkY = Math.sin(angle) * dist;

        // Spark trail
        ctx.strokeStyle = `rgba(255, ${180 + Math.random() * 75}, 50, ${(1 - progress) * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sparkX, sparkY);
        ctx.lineTo(sparkX - Math.cos(angle) * 8, sparkY - Math.sin(angle) * 8);
        ctx.stroke();

        // Spark glow
        ctx.fillStyle = `rgba(255, ${200 + Math.random() * 55}, 100, ${1 - progress})`;
        ctx.shadowColor = '#ffaa44';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else {
      // === METEOR BODY with improved shading ===
      ctx.shadowColor = meteor.color;
      ctx.shadowBlur = 12;

      const grad = ctx.createRadialGradient(-meteor.size * 0.3, -meteor.size * 0.3, 0, 0, 0, meteor.size);
      grad.addColorStop(0, '#ffeecc');
      grad.addColorStop(0.2, '#ffddaa');
      grad.addColorStop(0.4, meteor.color);
      grad.addColorStop(0.7, '#884422');
      grad.addColorStop(1, '#331108');
      ctx.fillStyle = grad;

      // Irregular rocky shape with more vertices
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10;
        const r = meteor.size * (0.65 + Math.sin(i * 1.7 + 0.5) * 0.25 + Math.cos(i * 2.3) * 0.1);
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();

      // Surface detail - craters
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(meteor.size * 0.2, -meteor.size * 0.1, meteor.size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-meteor.size * 0.15, meteor.size * 0.2, meteor.size * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // === FIRE TRAIL (Teardrop shaped) ===
      const trailLen = 25 + Math.random() * 15;
      const trailWidth = meteor.size * 0.5;

      // Outer fire trail
      const trailGrad = ctx.createLinearGradient(meteor.size * 0.3, 0, meteor.size + trailLen, 0);
      trailGrad.addColorStop(0, 'rgba(255, 200, 80, 0.7)');
      trailGrad.addColorStop(0.3, 'rgba(255, 120, 30, 0.5)');
      trailGrad.addColorStop(0.7, 'rgba(255, 60, 0, 0.2)');
      trailGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = trailGrad;
      ctx.beginPath();
      ctx.moveTo(meteor.size * 0.3, -trailWidth);
      ctx.bezierCurveTo(meteor.size * 0.8, -trailWidth * 0.6, meteor.size + trailLen * 0.6, -trailWidth * 0.2, meteor.size + trailLen, 0);
      ctx.bezierCurveTo(meteor.size + trailLen * 0.6, trailWidth * 0.2, meteor.size * 0.8, trailWidth * 0.6, meteor.size * 0.3, trailWidth);
      ctx.closePath();
      ctx.fill();

      // Inner bright core trail
      const innerTrailGrad = ctx.createLinearGradient(meteor.size * 0.3, 0, meteor.size + trailLen * 0.5, 0);
      innerTrailGrad.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
      innerTrailGrad.addColorStop(0.5, 'rgba(255, 200, 100, 0.3)');
      innerTrailGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
      ctx.fillStyle = innerTrailGrad;
      ctx.beginPath();
      ctx.moveTo(meteor.size * 0.3, -trailWidth * 0.4);
      ctx.bezierCurveTo(meteor.size * 0.6, -trailWidth * 0.2, meteor.size + trailLen * 0.3, -trailWidth * 0.05, meteor.size + trailLen * 0.5, 0);
      ctx.bezierCurveTo(meteor.size + trailLen * 0.3, trailWidth * 0.05, meteor.size * 0.6, trailWidth * 0.2, meteor.size * 0.3, trailWidth * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  // ============ MAIN CANVAS ANIMATION ============
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);

      // === UPDATE SCREEN SHAKE (Spring Physics) ===
      const shake = shakeRef.current;
      if (shake.intensity > 0) {
        const springForce = 0.15;
        const damping = 0.85;
        shake.velocityX += (-shake.x * springForce + (Math.random() - 0.5) * shake.intensity * 2);
        shake.velocityY += (-shake.y * springForce + (Math.random() - 0.5) * shake.intensity * 2);
        shake.velocityX *= damping;
        shake.velocityY *= damping;
        shake.x += shake.velocityX;
        shake.y += shake.velocityY;
        shake.intensity *= 0.93;
        if (shake.intensity < 0.2) {
          shake.intensity = 0;
          shake.x = 0; shake.y = 0;
          shake.velocityX = 0; shake.velocityY = 0;
        }
      }

      ctx.save();
      ctx.translate(shake.x, shake.y);

      // === DEEP SPACE BACKGROUND ===
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#010008');
      bgGrad.addColorStop(0.3, '#040018');
      bgGrad.addColorStop(0.6, '#060012');
      bgGrad.addColorStop(1, '#020008');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-10, -10, w + 20, h + 20);

      // === NEBULA EFFECTS (Multiple layers for depth) ===
      const nebulaTime = Date.now() / 8000;
      // Purple nebula
      const neb1 = ctx.createRadialGradient(
        w * (0.65 + Math.sin(nebulaTime) * 0.05), h * (0.3 + Math.cos(nebulaTime * 0.7) * 0.03),
        0, w * 0.65, h * 0.3, w * 0.4
      );
      neb1.addColorStop(0, 'rgba(120, 0, 180, 0.12)');
      neb1.addColorStop(0.4, 'rgba(60, 0, 120, 0.06)');
      neb1.addColorStop(1, 'rgba(0, 0, 40, 0)');
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, w, h);

      // Blue nebula
      const neb2 = ctx.createRadialGradient(
        w * (0.3 + Math.cos(nebulaTime * 0.8) * 0.04), h * (0.6 + Math.sin(nebulaTime * 0.5) * 0.03),
        0, w * 0.3, h * 0.6, w * 0.35
      );
      neb2.addColorStop(0, 'rgba(0, 60, 180, 0.08)');
      neb2.addColorStop(0.5, 'rgba(0, 30, 100, 0.04)');
      neb2.addColorStop(1, 'rgba(0, 0, 30, 0)');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);

      const isRunning = gameState === 'RUNNING';
      const isCrashed = gameState === 'CRASHED';
      const speedFactor = isRunning ? Math.min(currentMultiplier * 0.3, 3) : isCrashed ? 0.3 : 0;

      // ===== PARALLAX STARFIELD (3 layers) =====
      starsRef.current.forEach(star => {
        if (isRunning || isCrashed) {
          const layerSpeed = star.layer === 0 ? 0.3 : star.layer === 1 ? 0.7 : 1.0;
          star.x -= star.speed * (isRunning ? 1.5 * layerSpeed : 0.2);
          if (star.x < 0) { star.x = w; star.y = Math.random() * h; }
        }
        const twinkle = Math.sin(Date.now() / (400 + star.layer * 200) + star.x * 0.5) * 0.3 + 0.7;
        const starAlpha = star.brightness * twinkle;

        // Star glow for bright stars
        if (star.size > 1.5) {
          ctx.fillStyle = `rgba(180, 200, 255, ${starAlpha * 0.15})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(200, 220, 255, ${starAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Speed lines for fast stars during flight
        if (isRunning && star.speed > 1.5) {
          const lineLength = star.speed * (6 + speedFactor * 4);
          ctx.strokeStyle = `rgba(200, 220, 255, ${star.brightness * 0.25})`;
          ctx.lineWidth = star.size * 0.4;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x + lineLength, star.y);
          ctx.stroke();
        }
      });

      // ===== SPEED LINES (during high multiplier) =====
      if (isRunning && currentMultiplier > 2) {
        if (Math.random() < 0.3) {
          speedLinesRef.current.push({
            x: w + 10,
            y: Math.random() * h,
            length: 30 + Math.random() * 60,
            speed: 8 + Math.random() * 12,
            opacity: 0.2 + Math.random() * 0.3,
          });
        }
      }
      speedLinesRef.current = speedLinesRef.current.filter(line => {
        line.x -= line.speed;
        line.opacity -= 0.008;
        if (line.x < -line.length || line.opacity <= 0) return false;
        ctx.strokeStyle = `rgba(100, 180, 255, ${line.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x + line.length, line.y);
        ctx.stroke();
        return true;
      });

      // Ship position with DYNAMIC dodging AI + organic movement
      const ship = shipPosRef.current;
      const baseShipX = 150;
      const bobSpeed = isRunning ? 600 : 1200;
      const bobAmount = isRunning ? 18 + Math.sin(Date.now() / 1800) * 8 : 8;
      const naturalY = h / 2 + Math.sin(Date.now() / bobSpeed) * bobAmount + Math.sin(Date.now() / 1300) * 6;
      const naturalX = baseShipX + Math.sin(Date.now() / 2000) * 15 + Math.sin(Date.now() / 900) * 8;
      
      // Evasion AI — detect incoming meteors and dodge
      if (isRunning && !isCrashed) {
        let closestThreat: Meteor | null = null;
        let closestDist = Infinity;
        for (const m of meteorsRef.current) {
          if (!m.alive || m.exploding) continue;
          const dx = m.x - ship.x;
          const dy = m.y - ship.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Meteor approaching from the right and within threat zone
          if (dx > 0 && dx < 250 && dist < closestDist) {
            closestThreat = m;
            closestDist = dist;
          }
        }
        
        if (closestThreat && closestDist < 200) {
          ship.isDodging = true;
          ship.dodgeTimer = 30;
          const meteorDy = closestThreat.y - ship.y;
          // Dodge in opposite direction of meteor
          if (meteorDy > 0) {
            ship.targetY = ship.y - 60 - Math.random() * 30; // Dodge UP
          } else {
            ship.targetY = ship.y + 60 + Math.random() * 30; // Dodge DOWN
          }
          ship.targetY = Math.max(h * 0.15, Math.min(h * 0.85, ship.targetY));
        } else if (ship.dodgeTimer > 0) {
          ship.dodgeTimer--;
        } else {
          ship.isDodging = false;
          ship.targetY = naturalY;
        }
      } else {
        ship.targetY = naturalY;
        ship.isDodging = false;
      }
      
      // Smooth movement to target
      if (ship.isDodging) {
        ship.vy += (ship.targetY - ship.y) * 0.15;
        ship.vy *= 0.8;
      } else {
        ship.vy += (ship.targetY - ship.y) * 0.06;
        ship.vy *= 0.9;
      }
      ship.y += ship.vy * 0.12;
      ship.y = Math.max(h * 0.1, Math.min(h * 0.9, ship.y));
      
      // X movement — slight weaving
      ship.vx += (naturalX - ship.x) * 0.04;
      ship.vx *= 0.92;
      ship.x = baseShipX + ship.vx;
      
      // Lean angle based on vertical velocity
      const targetLean = ship.vy * 0.015;
      ship.leanAngle += (targetLean - ship.leanAngle) * 0.1;
      
      const shipX = ship.x;
      const shipY = ship.y;

      if (isRunning) {
        gameTimeRef.current++;
        const now = Date.now();

        // ===== SPAWN METEORS — aimed DIRECTLY at the ship =====
        const spawnRate = Math.max(250, 1200 - gameTimeRef.current * 5);
        if (now - lastMeteorSpawnRef.current > spawnRate) {
          lastMeteorSpawnRef.current = now;
          // Spawn from right side, aimed at ship's current position
          const spawnX = w + 50;
          const spawnY = Math.random() * h * 0.8 + h * 0.1;
          const aimDx = shipX - spawnX;
          const aimDy = shipY + (Math.random() - 0.5) * 40 - spawnY; // slight scatter
          const aimAngle = Math.atan2(aimDy, aimDx);
          meteorsRef.current.push({
            x: spawnX,
            y: spawnY,
            size: Math.random() * 15 + 10,
            speed: Math.random() * 3.5 + 2.5,
            angle: aimAngle,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.1,
            alive: true,
            targeted: false,
            exploding: false,
            explodeFrame: 0,
            color: ['#cc6633', '#aa5522', '#dd8844', '#bb7744', '#ee9955'][Math.floor(Math.random() * 5)],
          });
        }

        // ===== SHIP SHOOTS LASERS =====
        if (now - lastLaserRef.current > 400 + Math.random() * 300) {
          lastLaserRef.current = now;
          const target = meteorsRef.current
            .filter(m => m.alive && !m.exploding && !m.targeted && m.x < w - 50)
            .sort((a, b) => a.x - b.x)[0];

          if (target) {
            target.targeted = true;
            lasersRef.current.push({
              x: shipX + 35, y: shipY,
              targetX: target.x, targetY: target.y,
              life: 10,
            });
            setTimeout(() => {
              target.exploding = true;
              target.explodeFrame = 0;
              // Add shockwave for meteor explosion
              shockwavesRef.current.push({
                x: target.x, y: target.y,
                radius: 3, maxRadius: target.size * 3,
                life: 15, maxLife: 15,
                color: '#ffaa44',
              });
            }, 100);
          }
        }

        // ===== ENGINE PARTICLES (More volumetric) =====
        if (gameTimeRef.current % 2 === 0) {
          const count = currentMultiplier > 3 ? 3 : 2;
          for (let i = 0; i < count; i++) {
            engineParticlesRef.current.push({
              x: shipX - 30 + (Math.random() - 0.5) * 4,
              y: shipY + (Math.random() - 0.5) * 10,
              vx: -Math.random() * 5 - 2 - speedFactor,
              vy: (Math.random() - 0.5) * 2,
              life: 25 + Math.random() * 15,
              maxLife: 40,
              size: Math.random() * 5 + 1.5,
            });
          }
        }
      }

      // ===== UPDATE & DRAW ENGINE PARTICLES (Volumetric) =====
      engineParticlesRef.current = engineParticlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.life--;
        if (p.life <= 0) return false;
        const alpha = p.life / p.maxLife;
        const progress = 1 - alpha;

        // Outer glow
        const glowSize = p.size * alpha * 2.5;
        ctx.fillStyle = `rgba(0, 100, 255, ${alpha * 0.15})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Core particle with color transition (blue -> white -> transparent)
        const r = Math.floor(50 + progress * 200);
        const g = Math.floor(100 + progress * 120);
        const b = Math.floor(200 + progress * 55);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      // ===== UPDATE & DRAW METEORS =====
      meteorsRef.current = meteorsRef.current.filter(meteor => {
        if (meteor.exploding) {
          meteor.explodeFrame++;
          drawMeteor(ctx, meteor);
          return meteor.explodeFrame < 25;
        }
        if (!meteor.alive) return false;

        meteor.x += Math.cos(meteor.angle) * meteor.speed;
        meteor.y += Math.sin(meteor.angle) * meteor.speed * 0.5;
        meteor.rotation += meteor.rotSpeed;

        // Near-miss detection — sparks when meteor passes close to ship
        if (!isCrashed) {
          const mdx = meteor.x - shipX;
          const mdy = meteor.y - shipY;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < 50 && mDist > 20) {
            // Near miss! Sparks and screen shake
            shakeRef.current.intensity = Math.max(shakeRef.current.intensity, 3);
          }
        }

        if (meteor.x < -50) return false;
        drawMeteor(ctx, meteor);
        return true;
      });

      // ===== DRAW LASERS (Enhanced with bloom) =====
      lasersRef.current = lasersRef.current.filter(laser => {
        laser.life--;
        if (laser.life <= 0) return false;
        const alpha = laser.life / 10;

        // Outer bloom
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 25;
        ctx.strokeStyle = `rgba(0, 255, 170, ${alpha * 0.3})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y);
        ctx.lineTo(laser.targetX, laser.targetY);
        ctx.stroke();

        // Mid glow
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(0, 255, 170, ${alpha * 0.6})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y);
        ctx.lineTo(laser.targetX, laser.targetY);
        ctx.stroke();

        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(220, 255, 240, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y);
        ctx.lineTo(laser.targetX, laser.targetY);
        ctx.stroke();

        // Impact point glow
        ctx.fillStyle = `rgba(0, 255, 170, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(laser.targetX, laser.targetY, 6 * alpha, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // ===== DRAW SHOCKWAVE RINGS =====
      shockwavesRef.current = shockwavesRef.current.filter(sw => {
        sw.life--;
        if (sw.life <= 0) return false;
        const progress = 1 - sw.life / sw.maxLife;
        sw.radius = sw.maxRadius * progress;
        const alpha = (1 - progress) * 0.6;
        const lineWidth = 3 * (1 - progress);

        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      });

      // ===== DRAW DEBRIS with ember trails =====
      debrisRef.current = debrisRef.current.filter(d => {
        // Store trail position
        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 6) d.trail.shift();

        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.03;
        d.vx *= 0.995;
        d.rotation += d.rotSpeed;
        d.life--;
        if (d.life <= 0) return false;
        const alpha = d.life / 130;

        // Draw ember trail
        if (d.trail.length > 1) {
          for (let i = 0; i < d.trail.length - 1; i++) {
            const trailAlpha = (i / d.trail.length) * alpha * 0.4;
            ctx.fillStyle = `rgba(255, ${150 + Math.random() * 50}, 50, ${trailAlpha})`;
            ctx.beginPath();
            ctx.arc(d.trail[i].x, d.trail[i].y, d.size * 0.3 * (i / d.trail.length), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw debris piece
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);

        // Debris glow
        ctx.shadowColor = d.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.3})`;
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
        ctx.shadowBlur = 0;

        ctx.restore();
        return true;
      });

      // ===== DRAW SHIP with lean angle =====
      if (!isCrashed || crashAnimRef.current.frame < 12) {
        ctx.save();
        ctx.translate(shipX, shipY);
        ctx.rotate(ship.leanAngle || 0);
        ctx.translate(-shipX, -shipY);
        drawShip(ctx, shipX, shipY, isCrashed);
        ctx.restore();
      }
      if (isCrashed) {
        crashAnimRef.current.frame++;
      }

      // ===== MULTIPLIER DISPLAY =====
      const centerX = w / 2;
      const centerY = h / 2;

      if (gameState === 'WAITING') {
        const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;

        // Pulsing ring
        ctx.strokeStyle = `rgba(0, 200, 255, ${pulse * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 55 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(0, 200, 255, ${pulse * 0.1})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.4})`;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (countdown > 0) {
          ctx.fillText(`LAUNCHING IN ${Math.ceil(countdown)}s`, centerX, centerY);
        } else {
          ctx.fillText('PREPARING LAUNCH...', centerX, centerY);
        }
      }

      if (isRunning) {
        // Multiplier with enhanced glow
        ctx.save();
        const multColor = currentMultiplier >= 10 ? '#ffcc00' : currentMultiplier >= 5 ? '#00ff88' : '#00ddff';
        const multShadow = currentMultiplier >= 5 ? '#ffcc00' : '#00ffcc';
        const fontSize = Math.min(52, 36 + currentMultiplier * 1.5);

        // Multi-layer text bloom
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const multText = `${Number(currentMultiplier).toFixed(2)}x`;

        // Outer glow
        ctx.shadowColor = multShadow;
        ctx.shadowBlur = 40;
        ctx.fillStyle = `${multColor}44`;
        ctx.fillText(multText, centerX, 50);

        // Mid glow
        ctx.shadowBlur = 20;
        ctx.fillStyle = `${multColor}88`;
        ctx.fillText(multText, centerX, 50);

        // Core text
        ctx.shadowBlur = 10;
        ctx.fillStyle = multColor;
        ctx.fillText(multText, centerX, 50);

        ctx.shadowBlur = 0;
        ctx.restore();
      }

      if (isCrashed) {
        // Crash display with dramatic glow
        ctx.save();
        const crashText = `CRASHED @ ${Number(crashPoint || 0).toFixed(2)}x`;
        ctx.font = 'bold 42px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outer red glow
        ctx.shadowColor = '#ff3344';
        ctx.shadowBlur = 50;
        ctx.fillStyle = '#ff334444';
        ctx.fillText(crashText, centerX, centerY);

        // Mid glow
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ff334488';
        ctx.fillText(crashText, centerX, centerY);

        // Core text
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ff3344';
        ctx.fillText(crashText, centerX, centerY);

        ctx.shadowBlur = 0;
        ctx.restore();
      }

      ctx.restore(); // Restore screen shake transform

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [gameState, currentMultiplier, crashPoint, countdown, isConnected]);

  // ============ KEYBOARD HOTKEYS ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'WAITING' && betStatus === 'NONE') handlePlaceBet();
        else if (gameState === 'RUNNING' && betStatus === 'PLACED') handleCashOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, betStatus]);

  // ============ BET HANDLERS ============
  const handlePlaceBet = () => {
    const amount = parseFloat(betAmount);
    const autoCashoutValue = parseFloat(autoCashout);
    if (isNaN(amount) || amount < MIN_BET || amount > MAX_BET) return;
    playSound('bet');
    placeBet(amount, autoCashoutValue > 1 ? autoCashoutValue : undefined);
  };

  const handleCashOut = () => { playSound('win'); cashOut(); };

  const handleStartAutoBet = () => {
    const count = parseInt(autoBetCount);
    if (isNaN(count) || count <= 0) return;
    autoBetRef.current = true; setAutoBetActive(true); setAutoBetRemaining(count);
  };

  const handleStopAutoBet = () => {
    autoBetRef.current = false; setAutoBetActive(false); setAutoBetRemaining(0);
  };

  const getButtonConfig = () => {
    if (!isConnected) return { text: 'CONNECTING...', disabled: true, className: 'bg-gray-600' };
    if (gameState === 'WAITING') {
      if (betStatus === 'PLACED') return { text: 'BET PLACED ✓', disabled: true, className: 'bg-green-600' };
      return { text: 'LAUNCH BET [SPACE]', disabled: false, className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500' };
    }
    if (gameState === 'RUNNING') {
      if (betStatus === 'PLACED') return { text: `EJECT $${Number(potentialWin || 0).toFixed(2)} [SPACE]`, disabled: false, className: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 animate-multiplier-pulse' };
      return { text: 'IN FLIGHT...', disabled: true, className: 'bg-gray-600' };
    }
    if (gameState === 'CRASHED') {
      if (betStatus === 'CASHED_OUT') return { text: `EJECTED $${Number(potentialWin || 0).toFixed(2)}!`, disabled: true, className: 'bg-gradient-to-r from-green-500 to-emerald-500' };
      if (betStatus === 'LOST') return { text: 'DESTROYED', disabled: true, className: 'bg-gradient-to-r from-red-600 to-red-500' };
      return { text: 'NEXT FLIGHT...', disabled: true, className: 'bg-gray-600' };
    }
    return { text: 'LAUNCH BET', disabled: true, className: 'bg-gray-600' };
  };

  const buttonConfig = getButtonConfig();

  // ============ RENDER ============
  return (
        <div className="bg-[#0A0E17] rounded-2xl p-4 md:p-6 shadow-2xl border border-[#1E293B] relative overflow-hidden">
      <WinCelebration amount={lastWinAmount} show={showWinCelebration} />

      {/* Header */}
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl">🚀</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Nova Rush</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleGameSound} className={`p-2 rounded-lg transition-all ${isSoundActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-700/50 text-gray-500 border border-gray-600/30'}`}>
            {isSoundActive ? '🔊' : '🔇'}
          </button>
          <button onClick={() => setShowFairPanel(!showFairPanel)} className="p-2 rounded-lg bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50 text-xs">🛡️</button>
          <span className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30 animate-pulse">● LIVE</span>
        </div>
      </div>

      {/* Provably Fair Panel */}
      {showFairPanel && (
        <div className="mb-4 p-4 bg-[#0a0025] rounded-xl border border-purple-700/30">
          <h3 className="text-white font-bold mb-3">🛡️ Provably Fair</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Server Seed Hash:</span><span className="text-blue-400 font-mono text-xs max-w-[200px] truncate">{lastServerSeedHash || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Client Seed:</span><span className="text-blue-400 font-mono text-xs max-w-[200px] truncate">{globalClientSeed || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Nonce:</span><span className="text-white">{lastNonce || 'N/A'}</span></div>
          </div>
        </div>
      )}

      {/* Game Canvas */}
      <div ref={containerRef} className="relative w-full aspect-[16/9] max-h-[400px] rounded-xl overflow-hidden border border-purple-800/30 mb-4">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Recent Crashes */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {recentCrashes.slice(0, 10).map((cp, i) => (
          <span key={i} className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${cp >= 10 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : cp >= 2 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {Number(cp).toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Bet Controls */}
        <div className="space-y-3">
          {/* Tab Switcher */}
          <div className="flex rounded-xl overflow-hidden border border-purple-700/30">
            <button onClick={() => setActiveTab('MANUAL')} className={`flex-1 py-2 font-bold text-sm ${activeTab === 'MANUAL' ? 'bg-blue-600 text-white' : 'bg-[#0a0025] text-gray-400 hover:bg-[#150040]'}`}>MANUAL</button>
            <button onClick={() => setActiveTab('AUTO')} className={`flex-1 py-2 font-bold text-sm ${activeTab === 'AUTO' ? 'bg-purple-600 text-white' : 'bg-[#0a0025] text-gray-400 hover:bg-[#150040]'}`}>AUTO</button>
          </div>

          {/* Bet Amount */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">BET AMOUNT</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="w-full bg-[#0a0025] border border-purple-700/30 rounded-xl pl-8 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" min="0.1" step="0.1" disabled={autoBetActive} />
              </div>
              <button onClick={() => setBetAmount(prev => String(Number(prev) * 2))} disabled={autoBetActive} className="px-3 py-2 bg-[#0a0025] border border-purple-700/30 rounded-xl text-white hover:bg-[#150040] disabled:opacity-50">2x</button>
              <button onClick={() => setBetAmount(prev => String(Math.max(0.1, Number(prev) / 2)))} disabled={autoBetActive} className="px-3 py-2 bg-[#0a0025] border border-purple-700/30 rounded-xl text-white hover:bg-[#150040] disabled:opacity-50">½</button>
            </div>
          </div>

          {/* Auto Cashout */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">AUTO EJECT AT</label>
            <div className="relative">
              <input type="number" value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} className="w-full bg-[#0a0025] border border-purple-700/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" min="1.01" step="0.01" disabled={autoBetActive} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">x</span>
            </div>
          </div>

          {/* Auto-bet settings */}
          {activeTab === 'AUTO' && (
            <div className="space-y-2 p-3 bg-[#0a0025]/50 rounded-xl border border-purple-500/20">
              <div><label className="block text-xs text-gray-400 mb-1">NUMBER OF BETS</label><input type="number" value={autoBetCount} onChange={(e) => setAutoBetCount(e.target.value)} disabled={autoBetActive} className="w-full bg-[#050015] border border-purple-700/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none disabled:opacity-50" min="1" max="1000" /></div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">Stop Win $</label><input type="number" value={stopOnWin} onChange={(e) => setStopOnWin(e.target.value)} disabled={autoBetActive} className="w-full bg-[#050015] border border-purple-700/30 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none disabled:opacity-50" /></div>
                <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">Stop Loss $</label><input type="number" value={stopOnLoss} onChange={(e) => setStopOnLoss(e.target.value)} disabled={autoBetActive} className="w-full bg-[#050015] border border-purple-700/30 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none disabled:opacity-50" /></div>
              </div>
              {autoBetActive && <div className="text-center text-xs text-purple-400">Bets remaining: {autoBetRemaining}</div>}
            </div>
          )}
        </div>

        {/* Right: Action Button + Info */}
        <div className="space-y-3 flex flex-col justify-end">
          {/* Current bet info */}
          {betStatus === 'PLACED' && gameState === 'RUNNING' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
              <div className="text-xs text-gray-400">POTENTIAL WIN</div>
              <div className="text-2xl font-bold text-blue-400">${Number(potentialWin || 0).toFixed(2)}</div>
            </div>
          )}

          {/* Main Button */}
          {activeTab === 'MANUAL' ? (
            <button onClick={gameState === 'RUNNING' && betStatus === 'PLACED' ? handleCashOut : handlePlaceBet} disabled={buttonConfig.disabled} className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${buttonConfig.className} disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]`}>
              {buttonConfig.text}
            </button>
          ) : (
            <button onClick={autoBetActive ? handleStopAutoBet : handleStartAutoBet} className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${autoBetActive ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-400 hover:to-blue-400'} active:scale-[0.98]`}>
              {autoBetActive ? 'STOP AUTO-BET' : 'START AUTO-BET'}
            </button>
          )}

          {/* Error */}
          {showError && error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs text-center">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovaRushGame;
