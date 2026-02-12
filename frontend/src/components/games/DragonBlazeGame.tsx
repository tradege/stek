'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCrashGame, GameState, BetStatus } from '@/hooks/useCrashGame';
import { useSoundContextSafe } from '@/contexts/SoundContext';

// ============================================
// DESIGN SYSTEM COLORS
// ============================================
const COLORS = {
  bg: { dark: '#050510', mid: '#0a0a1a', light: '#0f0f25' },
  main: '#0A0E17',
  card: '#131B2C',
  cardBorder: '#1E293B',
  accent: '#00F0FF',
  danger: '#FF385C',
  success: '#00D46E',
  warning: '#FFB800',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  dragon1: { body: '#FF6B00', wing: '#FF4500', belly: '#FFD700', eye: '#FF0000', fire: '#FF8C00', glow: '#FF6B0040' },
  dragon2: { body: '#4A90D9', wing: '#2E6AB0', belly: '#87CEEB', eye: '#00BFFF', fire: '#1E90FF', glow: '#4A90D940' },
  city: { wall: '#4A3728', roof: '#8B0000', window: '#FFD700', tower: '#5C4033', sky: '#1a0a2e' },
  arrow: '#8B7355',
};

// ============================================
// LIGHTWEIGHT 1D PERLIN NOISE
// ============================================
class PerlinNoise1D {
  private perm: number[];
  constructor(seed: number) {
    this.perm = new Array(512);
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed % 233280;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  private lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  private grad(hash: number, x: number) { return (hash & 1) === 0 ? x : -x; }
  noise(x: number): number {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    return this.lerp(this.grad(this.perm[X], x), this.grad(this.perm[X + 1], x - 1), this.fade(x));
  }
}

// ============================================
// INTERFACES
// ============================================
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  rotation: number; rotSpeed: number;
  type: 'fire' | 'smoke' | 'spark' | 'debris' | 'arrow_trail' | 'explosion' | 'ember' | 'frost' | 'firebreath';
}

interface Arrow {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  trail: { x: number; y: number }[];
  active: boolean;
  hitDragon: number;
  targetDragon: number;
  destroyed: boolean; // destroyed by fire breath
}

interface Star {
  x: number; y: number;
  size: number; brightness: number;
  twinkleSpeed: number; twinklePhase: number;
}

interface Building {
  x: number; width: number; height: number;
  type: 'tower' | 'castle' | 'house' | 'wall';
  hasWindow: boolean; windowCount: number;
  roofStyle: 'pointed' | 'flat' | 'battlement';
}

interface ShockwaveRing {
  x: number; y: number;
  radius: number; maxRadius: number;
  life: number; maxLife: number;
  color: string;
}

interface DragonState {
  x: number; y: number;
  baseY: number;
  vx: number; vy: number;
  rotation: number;
  leanAngle: number;
  wingFlapCycle: number;
  wingFlapSpeed: number;
  tailWagCycle: number;
  jawOpen: number;
  headRotation: number;
  // Flight path
  perlinSeedX: number;
  perlinSeedY: number;
  flightPhase: number;
  // Dodging
  isDodging: boolean;
  dodgeTargetY: number;
  dodgeTimer: number;
  // Fire breath
  isBreathingFire: boolean;
  fireBreathTimer: number;
  fireBreathCooldown: number;
  fireBreathTargetX: number;
  fireBreathTargetY: number;
  // Falling
  isFalling: boolean;
  fallVY: number;
  fallVX: number;
  fallRotation: number;
  fallAngularVel: number;
  fallAlpha: number;
  hasHitGround: boolean;
  isFadingOut: boolean;
  isGone: boolean;
  // Idle personality
  idleTimer: number;
  idleAction: 'none' | 'head_turn' | 'tail_flick' | 'wing_stretch';
  idleActionTimer: number;
  // Celebration
  isCelebrating: boolean;
  celebrationTimer: number;
  // Stress
  isStressed: boolean;
  // Scale
  scale: number;
  zDepth: number;
}

// ============================================
// PARTICLE ENGINE (Enhanced)
// ============================================
class ParticleEngine {
  particles: Particle[] = [];
  private pool: Particle[] = [];
  
  private getParticle(): Particle {
    return this.pool.pop() || {
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      size: 0, color: '', rotation: 0, rotSpeed: 0, type: 'fire'
    };
  }
  
  emit(x: number, y: number, count: number, config: Partial<Particle> & { spread?: number; speed?: number }) {
    const spread = config.spread || Math.PI * 2;
    const speed = config.speed || 2;
    for (let i = 0; i < count; i++) {
      const angle = (config.type === 'fire' ? -Math.PI / 2 : 0) + (Math.random() - 0.5) * spread;
      const spd = speed * (0.5 + Math.random());
      const p = this.getParticle();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd + (config.vx || 0);
      p.vy = Math.sin(angle) * spd + (config.vy || 0);
      p.life = config.maxLife || 30;
      p.maxLife = config.maxLife || 30;
      p.size = config.size || 3;
      p.color = config.color || '#FF6B00';
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 0.2;
      p.type = config.type || 'fire';
      this.particles.push(p);
    }
  }
  
  emitDirectional(x: number, y: number, count: number, targetX: number, targetY: number, config: Partial<Particle> & { speed?: number; spreadAngle?: number }) {
    const baseAngle = Math.atan2(targetY - y, targetX - x);
    const spreadAngle = config.spreadAngle || Math.PI / 6;
    const speed = config.speed || 6;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spreadAngle;
      const spd = speed * (0.7 + Math.random() * 0.6);
      const p = this.getParticle();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = config.maxLife || 20;
      p.maxLife = config.maxLife || 20;
      p.size = config.size || 4;
      p.color = config.color || '#FF6B00';
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 0.15;
      p.type = config.type || 'firebreath';
      this.particles.push(p);
    }
  }
  
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.rotation += p.rotSpeed;
      if (p.type === 'debris' || p.type === 'explosion') p.vy += 0.15;
      if (p.type === 'smoke') { p.vy -= 0.06; p.vx *= 0.97; p.size *= 1.008; }
      if (p.type === 'fire') { p.vy -= 0.12; p.size *= 0.96; p.vx += (Math.random() - 0.5) * 0.3; }
      if (p.type === 'ember') { p.vy += 0.08; p.vx *= 0.99; }
      if (p.type === 'frost') { p.vy -= 0.04; p.vx *= 0.98; p.size *= 0.97; }
      if (p.type === 'firebreath') { p.size *= 0.95; p.vx *= 0.98; p.vy *= 0.98; }
      if (p.life <= 0) {
        this.pool.push(this.particles.splice(i, 1)[0]);
      }
    }
  }
  
  // Check if any firebreath particle hits an arrow
  checkFireBreathHits(arrows: Arrow[], dragonX: number): boolean {
    let hit = false;
    for (const arrow of arrows) {
      if (!arrow.active || arrow.destroyed) continue;
      for (const p of this.particles) {
        if (p.type !== 'firebreath') continue;
        const dx = p.x - arrow.x;
        const dy = p.y - arrow.y;
        if (Math.sqrt(dx * dx + dy * dy) < p.size + 15) {
          arrow.destroyed = true;
          arrow.active = false;
          hit = true;
          // Spawn destruction particles
          this.emit(arrow.x, arrow.y, 10, {
            type: 'spark', size: 4, maxLife: 15, speed: 3, color: '#FFD700', spread: Math.PI * 2
          });
          this.emit(arrow.x, arrow.y, 5, {
            type: 'debris', size: 3, maxLife: 20, speed: 2, color: '#8B7355', spread: Math.PI * 2
          });
          break;
        }
      }
    }
    return hit;
  }
  
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      
      if (p.type === 'fire' || p.type === 'firebreath') {
        const flameH = p.size * 1.5;
        const flameW = p.size * 0.7;
        ctx.globalAlpha = alpha * 0.3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 1.5;
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 1.2);
        glowGrad.addColorStop(0, p.color);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, flameH * 0.3);
        ctx.bezierCurveTo(flameW, flameH * 0.1, flameW * 0.5, -flameH * 0.5, 0, -flameH);
        ctx.bezierCurveTo(-flameW * 0.5, -flameH * 0.5, -flameW, flameH * 0.1, 0, flameH * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#FFD700';
        const innerH = flameH * 0.5;
        const innerW = flameW * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, innerH * 0.2);
        ctx.bezierCurveTo(innerW, innerH * 0.05, innerW * 0.3, -innerH * 0.4, 0, -innerH);
        ctx.bezierCurveTo(-innerW * 0.3, -innerH * 0.4, -innerW, innerH * 0.05, 0, innerH * 0.2);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'explosion') {
        for (let layer = 2; layer >= 0; layer--) {
          const layerSize = p.size * (1 + layer * 0.4);
          const layerAlpha = alpha * (0.3 - layer * 0.08);
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, layerSize);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.4, p.color + '80');
          grad.addColorStop(1, 'transparent');
          ctx.globalAlpha = layerAlpha;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, layerSize, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === 'spark') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(p.size, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (p.type === 'debris') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 3;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.shadowBlur = 0;
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillStyle = p.color;
        for (let s = 0; s < 3; s++) {
          const wobble = Math.sin(p.life * 0.3 + s) * p.size * 0.05;
          ctx.beginPath();
          ctx.ellipse(wobble, wobble * 0.5, p.size * (1 - s * 0.1), p.size * 0.8 * (1 - s * 0.1), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === 'frost') {
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size;
        // Snowflake-like shape
        for (let r = 0; r < 3; r++) {
          ctx.save();
          ctx.rotate(r * Math.PI / 3);
          ctx.fillRect(-p.size * 0.1, -p.size * 0.6, p.size * 0.2, p.size * 1.2);
          ctx.restore();
        }
        ctx.shadowBlur = 0;
      } else if (p.type === 'arrow_trail') {
        ctx.fillStyle = `rgba(200, 180, 150, ${alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ember') {
        const flicker = 0.5 + Math.sin(p.life * 8) * 0.5;
        ctx.globalAlpha = alpha * flicker;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }
}

// ============================================
// DRAGON DRAWING - Detailed with Bezier Curves
// ============================================
function drawDragonSprite(
  ctx: CanvasRenderingContext2D, 
  dragon: DragonState,
  colors: typeof COLORS.dragon1, 
  globalTime: number,
  isCrashed: boolean
) {
  ctx.save();
  ctx.translate(dragon.x, dragon.y);
  
  // Apply falling rotation
  if (dragon.isFalling) {
    ctx.rotate(dragon.fallRotation);
    ctx.globalAlpha = dragon.fallAlpha;
  } else {
    ctx.rotate(dragon.rotation);
  }
  
  ctx.scale(dragon.scale, dragon.scale);
  
  const wingAngle = Math.sin(dragon.wingFlapCycle) * 0.7;
  const tailWag = Math.sin(dragon.tailWagCycle) * 6;
  const breathOpen = dragon.jawOpen;
  
  // === DRAGON AURA GLOW ===
  if (!isCrashed && !dragon.isFalling) {
    ctx.shadowColor = colors.fire;
    ctx.shadowBlur = 30 + Math.sin(globalTime * 0.05) * 8;
    ctx.fillStyle = colors.glow || (colors.fire + '15');
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  // === TAIL (multi-segment flowing) ===
  ctx.save();
  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-25, 0);
  // 4-segment flowing tail with independent waves
  const t1x = -40, t1y = tailWag * 0.8;
  const t2x = -55, t2y = tailWag * 1.3 + Math.sin(globalTime * 0.08 + 1) * 4;
  const t3x = -68, t3y = tailWag * 0.9 + Math.sin(globalTime * 0.06 + 2) * 5;
  const t4x = -78, t4y = tailWag * 0.5 + Math.sin(globalTime * 0.1 + 3) * 3;
  ctx.bezierCurveTo(t1x, t1y, t2x, t2y, t3x, t3y);
  ctx.lineTo(t4x, t4y);
  ctx.stroke();
  // Tail gets thinner
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.wing;
  ctx.beginPath();
  ctx.moveTo(t3x, t3y);
  ctx.lineTo(t4x, t4y);
  ctx.stroke();
  // Tail tip (spade/diamond shape)
  ctx.fillStyle = colors.wing;
  ctx.beginPath();
  ctx.moveTo(t4x, t4y);
  ctx.lineTo(t4x - 10, t4y - 7);
  ctx.quadraticCurveTo(t4x - 5, t4y, t4x - 10, t4y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  
  // === BACK LEGS ===
  ctx.save();
  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 3.5;
  const legSwing = Math.sin(globalTime * 0.04) * 3;
  // Back left leg
  ctx.beginPath();
  ctx.moveTo(-12, 9);
  ctx.quadraticCurveTo(-15, 16 + legSwing, -11, 20 + legSwing);
  ctx.stroke();
  // Back right leg (slightly behind)
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(-8, 9);
  ctx.quadraticCurveTo(-10, 15 - legSwing, -7, 19 - legSwing);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Claws
  ctx.strokeStyle = colors.belly;
  ctx.lineWidth = 1.5;
  [-11, -7].forEach((cx, idx) => {
    const cy = idx === 0 ? 20 + legSwing : 19 - legSwing;
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy); ctx.lineTo(cx - 3, cy + 3);
    ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 3.5);
    ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 3, cy + 3);
    ctx.stroke();
  });
  ctx.restore();
  
  // === FRONT LEGS ===
  ctx.save();
  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 3;
  const flegSwing = Math.sin(globalTime * 0.04 + Math.PI) * 3;
  ctx.beginPath();
  ctx.moveTo(12, 8);
  ctx.quadraticCurveTo(14, 15 + flegSwing, 17, 18 + flegSwing);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.quadraticCurveTo(10, 14 - flegSwing, 13, 17 - flegSwing);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.belly;
  ctx.lineWidth = 1.5;
  [17, 13].forEach((cx, idx) => {
    const cy = idx === 0 ? 18 + flegSwing : 17 - flegSwing;
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy); ctx.lineTo(cx - 3, cy + 3);
    ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 3.5);
    ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 3, cy + 3);
    ctx.stroke();
  });
  ctx.restore();
  
  // === WINGS (with joints and membrane veins) ===
  // Back wing (darker, further)
  ctx.save();
  ctx.translate(-5, -8);
  ctx.rotate(wingAngle * 0.85 + dragon.leanAngle * 0.3);
  ctx.fillStyle = colors.wing + 'BB';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-8, -20, -18, -38, -8, -55);
  ctx.lineTo(0, -48);
  ctx.bezierCurveTo(8, -35, 12, -30, 18, -40);
  ctx.lineTo(22, -30);
  ctx.bezierCurveTo(18, -15, 14, -5, 10, 0);
  ctx.closePath();
  ctx.fill();
  // Membrane veins
  ctx.strokeStyle = colors.body + '50';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -25, -4, -48);
  ctx.moveTo(3, -2); ctx.quadraticCurveTo(3, -20, 5, -42);
  ctx.moveTo(8, -2); ctx.quadraticCurveTo(12, -18, 18, -35);
  ctx.stroke();
  // Wing bone joints (small circles)
  ctx.fillStyle = colors.body;
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-4, -25, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -22, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  
  // Front wing (brighter, closer)
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(wingAngle + dragon.leanAngle * 0.5);
  // Wing membrane gradient
  const wingGrad = ctx.createLinearGradient(0, 0, 0, -60);
  wingGrad.addColorStop(0, colors.wing);
  wingGrad.addColorStop(0.5, colors.wing + 'DD');
  wingGrad.addColorStop(1, colors.wing + '99');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-10, -22, -22, -45, -10, -60);
  ctx.lineTo(-2, -52);
  ctx.bezierCurveTo(8, -38, 14, -32, 22, -45);
  ctx.lineTo(25, -32);
  ctx.bezierCurveTo(20, -15, 15, -5, 12, 0);
  ctx.closePath();
  ctx.fill();
  // Membrane veins
  ctx.strokeStyle = colors.body + '40';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.bezierCurveTo(-5, -20, -8, -40, -6, -52);
  ctx.moveTo(4, -2); ctx.bezierCurveTo(4, -22, 3, -38, -2, -52);
  ctx.moveTo(10, -2); ctx.bezierCurveTo(14, -18, 18, -28, 22, -38);
  ctx.stroke();
  // Wing bone joints
  ctx.fillStyle = colors.body;
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-6, -28, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -25, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  
  // === BODY (gradient ellipse with scales) ===
  const bodyGrad = ctx.createRadialGradient(0, -2, 5, 0, 2, 28);
  bodyGrad.addColorStop(0, colors.belly);
  bodyGrad.addColorStop(0.4, colors.body);
  bodyGrad.addColorStop(1, colors.wing);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Belly highlight
  ctx.fillStyle = colors.belly + 'AA';
  ctx.beginPath();
  ctx.ellipse(2, 5, 19, 6, 0.05, 0, Math.PI);
  ctx.fill();
  
  // Scale pattern (arc-based)
  ctx.fillStyle = colors.wing + '25';
  for (let i = -16; i < 16; i += 5) {
    for (let j = -6; j < 2; j += 5) {
      ctx.beginPath();
      ctx.arc(i + (j % 2) * 2.5, j, 2.5, 0, Math.PI, true);
      ctx.fill();
    }
  }
  
  // Spine ridge
  ctx.strokeStyle = colors.wing + '60';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-20, -5);
  for (let i = -18; i < 20; i += 4) {
    ctx.lineTo(i, -7 + Math.sin(i * 0.3) * 1.5);
    ctx.lineTo(i + 2, -5 + Math.sin(i * 0.3) * 1.5);
  }
  ctx.stroke();
  
  // === NECK (bezier curve connecting body to head) ===
  ctx.save();
  ctx.rotate(dragon.headRotation * 0.3); // Neck follows head slightly
  const neckGrad = ctx.createLinearGradient(20, -8, 32, 0);
  neckGrad.addColorStop(0, colors.body);
  neckGrad.addColorStop(1, colors.body);
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(20, -6);
  ctx.bezierCurveTo(24, -10, 28, -9, 30, -5);
  ctx.lineTo(30, 3);
  ctx.bezierCurveTo(28, 7, 24, 8, 20, 5);
  ctx.closePath();
  ctx.fill();
  // Neck belly
  ctx.fillStyle = colors.belly + '80';
  ctx.beginPath();
  ctx.moveTo(22, 2);
  ctx.bezierCurveTo(24, 5, 28, 5, 30, 2);
  ctx.lineTo(30, 0);
  ctx.bezierCurveTo(28, 3, 24, 3, 22, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  
  // === HEAD (rotatable) ===
  ctx.save();
  ctx.translate(30, -2);
  ctx.rotate(dragon.headRotation);
  
  // Head shape
  const headGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
  headGrad.addColorStop(0, colors.body);
  headGrad.addColorStop(1, colors.wing);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 9, 0.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Snout
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(9, 0, 7, 5.5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  
  // Jaw (opens when breathing fire)
  ctx.save();
  ctx.translate(8, 4);
  ctx.rotate(breathOpen * Math.PI / 5); // Max ~36 degree open
  ctx.fillStyle = colors.belly;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 3.5, 0.1, 0, Math.PI);
  ctx.fill();
  // Teeth
  if (breathOpen > 0.1) {
    ctx.fillStyle = '#FFFFFF';
    for (let t = -4; t < 5; t += 2.5) {
      ctx.beginPath();
      ctx.moveTo(t, -1);
      ctx.lineTo(t + 0.8, -3);
      ctx.lineTo(t + 1.6, -1);
      ctx.fill();
    }
  }
  ctx.restore();
  
  // Eye (with glow and pupil)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(2, -5, 4.5, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris
  ctx.fillStyle = colors.eye;
  ctx.shadowColor = colors.eye;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(3, -5, 3, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Pupil (slit)
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(3.5, -5, 1.3, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlight
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(1.5, -6.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Horns (two, with gradient)
  const hornGrad = ctx.createLinearGradient(0, -8, 0, -24);
  hornGrad.addColorStop(0, colors.belly);
  hornGrad.addColorStop(1, '#FFFFFF80');
  ctx.fillStyle = hornGrad;
  // Horn 1
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.quadraticCurveTo(-8, -18, -3, -24);
  ctx.lineTo(-1, -9);
  ctx.closePath();
  ctx.fill();
  // Horn 2
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(-2, -16, 2, -21);
  ctx.lineTo(3, -9);
  ctx.closePath();
  ctx.fill();
  
  // Nostrils (with smoke wisps when stressed)
  ctx.fillStyle = '#00000080';
  ctx.beginPath();
  ctx.ellipse(14, -2, 1.2, 0.8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, 1, 1.2, 0.8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Ear/frill
  ctx.fillStyle = colors.wing + '80';
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.quadraticCurveTo(-12, -8, -10, -2);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore(); // head transform
  
  ctx.restore(); // main dragon transform
}

// ============================================
// MEDIEVAL CITY DRAWING
// ============================================
function drawMedievalCity(ctx: CanvasRenderingContext2D, buildings: Building[], 
  scrollX: number, canvasW: number, canvasH: number, arrowFlash: number) {
  const groundY = canvasH * 0.85;
  
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, canvasH);
  groundGrad.addColorStop(0, '#2D1B0E');
  groundGrad.addColorStop(0.2, '#241509');
  groundGrad.addColorStop(0.5, '#1A0F06');
  groundGrad.addColorStop(1, '#0A0E17');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, canvasW, canvasH - groundY);
  
  ctx.strokeStyle = '#1a3a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x < canvasW; x += 3) {
    ctx.lineTo(x, groundY + Math.sin(x * 0.1 + scrollX * 0.01) * 2);
  }
  ctx.stroke();
  
  for (const b of buildings) {
    const bx = ((b.x - scrollX * 0.3) % (canvasW + 200)) - 100;
    if (bx < -b.width - 50 || bx > canvasW + 50) continue;
    const by = groundY - b.height;
    
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(bx + 5, by + 5, b.width, b.height);
    ctx.fillStyle = COLORS.city.wall;
    ctx.fillRect(bx, by, b.width, b.height);
    
    ctx.strokeStyle = '#3A2A1A';
    ctx.lineWidth = 0.5;
    for (let row = 0; row < b.height; row += 8) {
      const offset = (row / 8) % 2 === 0 ? 0 : 10;
      for (let col = offset; col < b.width; col += 20) {
        ctx.strokeRect(bx + col, by + row, 20, 8);
      }
    }
    
    if (b.roofStyle === 'pointed') {
      ctx.fillStyle = COLORS.city.roof;
      ctx.beginPath();
      ctx.moveTo(bx - 5, by);
      ctx.lineTo(bx + b.width / 2, by - 25);
      ctx.lineTo(bx + b.width + 5, by);
      ctx.closePath();
      ctx.fill();
    } else if (b.roofStyle === 'battlement') {
      ctx.fillStyle = COLORS.city.wall;
      for (let i = 0; i < b.width; i += 12) {
        ctx.fillRect(bx + i, by - 8, 8, 8);
      }
    }
    
    if (b.hasWindow) {
      for (let w = 0; w < b.windowCount; w++) {
        const wx = bx + 8 + (w * (b.width - 16)) / Math.max(1, b.windowCount - 1);
        const wy = by + b.height * 0.3;
        const windowGlow = arrowFlash > 0 ? 20 : 8;
        ctx.fillStyle = arrowFlash > 0 ? '#FFFFFF' : COLORS.city.window;
        ctx.shadowColor = COLORS.city.window;
        ctx.shadowBlur = windowGlow;
        ctx.fillRect(wx - 3, wy - 4, 6, 8);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = COLORS.city.wall;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx, wy - 4); ctx.lineTo(wx, wy + 4);
        ctx.moveTo(wx - 3, wy); ctx.lineTo(wx + 3, wy);
        ctx.stroke();
      }
    }
    
    if (b.type === 'house') {
      ctx.fillStyle = '#2A1A0A';
      ctx.beginPath();
      ctx.arc(bx + b.width / 2, by + b.height - 12, 6, Math.PI, 0);
      ctx.fillRect(bx + b.width / 2 - 6, by + b.height - 12, 12, 12);
      ctx.fill();
    }
    
    if (b.type === 'tower' || b.type === 'castle') {
      ctx.strokeStyle = '#5C4033';
      ctx.lineWidth = 2;
      const flagX = bx + b.width / 2;
      const flagY = b.roofStyle === 'pointed' ? by - 25 : by - 8;
      ctx.beginPath();
      ctx.moveTo(flagX, flagY);
      ctx.lineTo(flagX, flagY - 15);
      ctx.stroke();
      ctx.fillStyle = '#CC0000';
      ctx.beginPath();
      ctx.moveTo(flagX, flagY - 15);
      ctx.quadraticCurveTo(flagX + 8, flagY - 12 + Math.sin(scrollX * 0.05) * 2, flagX + 12, flagY - 10);
      ctx.lineTo(flagX, flagY - 8);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ============================================
// ARROW DRAWING
// ============================================
function drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow) {
  if (arrow.destroyed) return;
  ctx.save();
  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(arrow.angle);
  
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#8B7355';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-20, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  
  ctx.strokeStyle = COLORS.arrow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(8, 0);
  ctx.stroke();
  
  ctx.fillStyle = '#D0D0D0';
  ctx.shadowColor = '#FFFFFF';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(6, -3);
  ctx.lineTo(6, 3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  
  ctx.fillStyle = '#CC0000';
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-22, -4);
  ctx.lineTo(-16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-22, 4);
  ctx.lineTo(-16, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ============================================
// CREATE DRAGON STATE
// ============================================
function createDragonState(baseY: number, zDepth: number, seed: number): DragonState {
  return {
    x: 0, y: baseY, baseY,
    vx: 0, vy: 0,
    rotation: 0, leanAngle: 0,
    wingFlapCycle: Math.random() * Math.PI * 2,
    wingFlapSpeed: 0.12,
    tailWagCycle: Math.random() * Math.PI * 2,
    jawOpen: 0, headRotation: 0,
    perlinSeedX: seed * 137.5,
    perlinSeedY: seed * 293.7,
    flightPhase: Math.random() * 1000,
    isDodging: false, dodgeTargetY: baseY, dodgeTimer: 0,
    isBreathingFire: false, fireBreathTimer: 0, fireBreathCooldown: 0,
    fireBreathTargetX: 0, fireBreathTargetY: 0,
    isFalling: false, fallVY: 0, fallVX: 0,
    fallRotation: 0, fallAngularVel: 0, fallAlpha: 1,
    hasHitGround: false, isFadingOut: false, isGone: false,
    idleTimer: 2000 + Math.random() * 3000,
    idleAction: 'none', idleActionTimer: 0,
    isCelebrating: false, celebrationTimer: 0,
    isStressed: false,
    scale: 1.0 * (0.85 + zDepth * 0.3),
    zDepth,
  };
}

// ============================================
// UPDATE DRAGON FLIGHT PATH (Perlin + Sine)
// ============================================
function updateDragonFlight(dragon: DragonState, perlin: PerlinNoise1D, dt: number, globalTime: number, canvasH: number) {
  if (dragon.isFalling || dragon.isGone) return;
  
  dragon.flightPhase += dt * 1.0;
  
  // Perlin noise for organic movement — VERY large amplitude for dramatic independent paths
  const noiseY = perlin.noise(globalTime * 0.008 + dragon.perlinSeedY) * 65;
  const noiseX = perlin.noise(globalTime * 0.007 + dragon.perlinSeedX) * 35;
  
  // Multiple sine waves for complex, lifelike bobbing
  const sineY = Math.sin(dragon.flightPhase * 0.09) * 22 + Math.sin(dragon.flightPhase * 0.04) * 12;
  const sineX = Math.sin(dragon.flightPhase * 0.06 + 1.5) * 10;
  
  // Combined target position
  const targetY = dragon.baseY + noiseY + sineY;
  
  if (!dragon.isDodging) {
    // Smooth but visible interpolation to target
    dragon.vy += (targetY - dragon.y) * 0.06 * dt;
    dragon.vy *= 0.88;
    dragon.y += dragon.vy * dt * 0.12;
    // X offset from Perlin noise + sine for non-linear, weaving flight
    dragon.vx = (noiseX + sineX) * 0.4;
  } else {
    // Dodging — FAST dramatic evasion
    dragon.vy += (dragon.dodgeTargetY - dragon.y) * 0.18 * dt;
    dragon.vy *= 0.82;
    dragon.y += dragon.vy * dt * 0.15;
  }
  
  // Clamp Y position
  dragon.y = Math.max(canvasH * 0.15, Math.min(canvasH * 0.65, dragon.y));
  
  // Banking (rotation based on vertical velocity)
  const targetRotation = dragon.vy * 0.008;
  dragon.rotation += (targetRotation - dragon.rotation) * 0.1;
  dragon.leanAngle = dragon.rotation * 0.5;
  
  // Wing flap speed varies with movement
  const movementIntensity = Math.abs(dragon.vy) * 0.03;
  const stressBonus = dragon.isStressed ? 0.06 : 0;
  const dodgeBonus = dragon.isDodging ? 0.04 : 0;
  dragon.wingFlapSpeed = 0.12 + movementIntensity + stressBonus + dodgeBonus;
  dragon.wingFlapCycle += dragon.wingFlapSpeed * dt;
  
  // Tail wag
  dragon.tailWagCycle += (0.05 + movementIntensity * 0.5) * dt;
}

// ============================================
// UPDATE DRAGON DODGING AI
// ============================================
function updateDragonDodging(dragon: DragonState, arrows: Arrow[], dt: number, canvasW: number, canvasH: number) {
  if (dragon.isFalling || dragon.isGone) return;
  
  const THREAT_DISTANCE_X = canvasW * 0.35;
  const THREAT_DISTANCE_Y = 50;
  const DODGE_OFFSET = 80; // Dramatic dodging
  const FIRE_BREATH_CHANCE = 0.15; // Very aggressive — dragons actively defend
  const FIRE_BREATH_COOLDOWN = 25; // Very short cooldown — dragons breathe fire frequently
  
  let closestThreat: Arrow | null = null;
  let closestDist = Infinity;
  
  for (const arrow of arrows) {
    if (!arrow.active || arrow.destroyed) continue;
    const dx = arrow.x - dragon.x;
    const dy = arrow.y - dragon.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Arrow is approaching from the right and within threat zone
    if (dx > 0 && dx < THREAT_DISTANCE_X && Math.abs(dy) < THREAT_DISTANCE_Y * 2 && dist < closestDist) {
      closestThreat = arrow;
      closestDist = dist;
    }
  }
  
  if (closestThreat) {
    const dy = closestThreat.y - dragon.y;
    
    // Decide: dodge or fire breath — dragons ALWAYS try to fire first, then dodge
    if (dragon.fireBreathCooldown <= 0 && Math.random() < FIRE_BREATH_CHANCE && closestDist < THREAT_DISTANCE_X * 0.8) {
      // FIRE BREATH!
      dragon.isBreathingFire = true;
      dragon.fireBreathTimer = 40; // frames
      dragon.fireBreathCooldown = FIRE_BREATH_COOLDOWN;
      dragon.fireBreathTargetX = closestThreat.x;
      dragon.fireBreathTargetY = closestThreat.y;
      dragon.jawOpen = 1;
      dragon.isDodging = false;
    } else if (!dragon.isBreathingFire) {
      // DODGE — dramatic last-second evasion
      dragon.isDodging = true;
      const urgency = Math.max(0, 1 - closestDist / (THREAT_DISTANCE_X * 0.8));
      const dodgeAmount = DODGE_OFFSET + urgency * 40 + Math.random() * 25;
      if (dy > 0) {
        // Arrow below - dodge up
        dragon.dodgeTargetY = dragon.baseY - dodgeAmount;
      } else {
        // Arrow above - dodge down  
        dragon.dodgeTargetY = dragon.baseY + dodgeAmount;
      }
      dragon.dodgeTargetY = Math.max(canvasH * 0.15, Math.min(canvasH * 0.65, dragon.dodgeTargetY));
    }
    
    // Head tracks closest threat
    const headAngle = Math.atan2(closestThreat.y - dragon.y, closestThreat.x - dragon.x);
    dragon.headRotation += (headAngle * 0.3 - dragon.headRotation) * 0.08;
    
    dragon.isStressed = closestDist < THREAT_DISTANCE_X * 0.4;
  } else {
    dragon.isDodging = false;
    dragon.isStressed = false;
    // Slowly return head to neutral
    dragon.headRotation *= 0.95;
  }
  
  // Update fire breath
  if (dragon.isBreathingFire) {
    dragon.fireBreathTimer -= dt;
    dragon.jawOpen = Math.max(0, dragon.fireBreathTimer / 40);
    if (dragon.fireBreathTimer <= 0) {
      dragon.isBreathingFire = false;
      dragon.jawOpen = 0;
    }
  }
  
  // Cooldown
  if (dragon.fireBreathCooldown > 0) {
    dragon.fireBreathCooldown -= dt;
  }
}

// ============================================
// UPDATE DRAGON FALLING
// ============================================
function startDragonFalling(dragon: DragonState) {
  dragon.isFalling = true;
  dragon.fallVY = -3 - Math.random() * 4; // Initial upward bounce
  dragon.fallVX = (Math.random() - 0.5) * 4;
  dragon.fallAngularVel = (Math.random() - 0.5) * 0.15;
  dragon.fallRotation = dragon.rotation;
  dragon.fallAlpha = 1;
  dragon.hasHitGround = false;
  dragon.isFadingOut = false;
  dragon.wingFlapSpeed = 0.02; // Slow dying flaps
}

function updateDragonFalling(dragon: DragonState, dt: number, canvasH: number): boolean {
  if (!dragon.isFalling) return false;
  
  const GRAVITY = 0.35;
  const GROUND_Y = canvasH * 0.82;
  
  if (!dragon.hasHitGround) {
    dragon.fallVY += GRAVITY * dt;
    dragon.x += dragon.fallVX * dt;
    dragon.y += dragon.fallVY * dt;
    dragon.fallRotation += dragon.fallAngularVel * dt;
    
    // Slow dying wing flaps
    dragon.wingFlapCycle += 0.03 * dt;
    
    // Hit ground
    if (dragon.y >= GROUND_Y) {
      dragon.y = GROUND_Y;
      dragon.hasHitGround = true;
      dragon.isFadingOut = true;
      dragon.fallVY = 0;
      dragon.fallVX = 0;
      dragon.fallAngularVel = 0;
    }
  }
  
  // Fade out after hitting ground
  if (dragon.isFadingOut) {
    dragon.fallAlpha -= 0.008 * dt;
    if (dragon.fallAlpha <= 0) {
      dragon.fallAlpha = 0;
      dragon.isGone = true;
      return true; // Dragon is completely gone
    }
  }
  
  return false;
}

// ============================================
// UPDATE DRAGON PERSONALITY (Idle animations)
// ============================================
function updateDragonPersonality(dragon: DragonState, otherDragon: DragonState | null, dt: number) {
  if (dragon.isFalling || dragon.isGone || dragon.isDodging || dragon.isBreathingFire) return;
  
  dragon.idleTimer -= dt * 16;
  
  if (dragon.idleAction === 'none') {
    if (dragon.idleTimer <= 0) {
      // Pick a random idle action
      const actions: DragonState['idleAction'][] = ['head_turn', 'tail_flick', 'wing_stretch'];
      dragon.idleAction = actions[Math.floor(Math.random() * actions.length)];
      dragon.idleActionTimer = 0;
    }
  } else {
    dragon.idleActionTimer += dt * 16;
    
    switch (dragon.idleAction) {
      case 'head_turn':
        if (dragon.idleActionTimer < 1000) {
          dragon.headRotation = Math.sin(dragon.idleActionTimer / 1000 * Math.PI * 2) * 0.3;
        } else {
          dragon.idleAction = 'none';
          dragon.headRotation = 0;
          dragon.idleTimer = 3000 + Math.random() * 5000;
        }
        break;
      case 'tail_flick':
        if (dragon.idleActionTimer < 500) {
          dragon.tailWagCycle += 0.4 * dt;
        } else {
          dragon.idleAction = 'none';
          dragon.idleTimer = 3000 + Math.random() * 5000;
        }
        break;
      case 'wing_stretch':
        if (dragon.idleActionTimer < 800) {
          const progress = dragon.idleActionTimer / 800;
          dragon.wingFlapCycle = Math.sin(progress * Math.PI) * Math.PI / 3;
          dragon.wingFlapSpeed = 0.02;
        } else {
          dragon.idleAction = 'none';
          dragon.wingFlapSpeed = 0.12;
          dragon.idleTimer = 3000 + Math.random() * 5000;
        }
        break;
    }
  }
  
  // Dragons look at each other when close
  if (otherDragon && !otherDragon.isGone && dragon.idleAction === 'none') {
    const dx = otherDragon.x - dragon.x;
    const dy = otherDragon.y - dragon.y;
    if (Math.abs(dx) < 100 && Math.abs(dy) < 80) {
      const lookAngle = Math.atan2(dy, dx);
      dragon.headRotation += (lookAngle * 0.2 - dragon.headRotation) * 0.03;
    }
  }
}


// ============================================
// MAIN COMPONENT
// ============================================
const DragonBlazeGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const particleEngineRef = useRef(new ParticleEngine());
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const globalTimeRef = useRef(0);
  const perlinRef = useRef(new PerlinNoise1D(Math.floor(Math.random() * 10000)));
  
  const {
    gameState, currentMultiplier, currentMultiplier2, crashPoint, crashPoint2, countdown,
    gameId, betStatus, currentBet, potentialWin,
    recentCrashes, placeBet, cashOut, isConnected, error,
    placeBet2, cashOut2, betStatus2, currentBet2, potentialWin2,
    dragon1Crashed: d1CrashedBackend, dragon2Crashed: d2CrashedBackend
  } = useCrashGame();
  
  const { gameSoundEnabled, toggleGameSound, isSoundActive, playSound, clientSeed } = useSoundContextSafe();
  
  // Local state
  const [betAmount, setBetAmount] = useState('10');
  const [autoCashout, setAutoCashout] = useState('');
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [showFairPanel, setShowFairPanel] = useState(false);
  const [lastServerSeedHash, setLastServerSeedHash] = useState('');
  const [lastNonce, setLastNonce] = useState(0);
  
  // Dragon 2 local UI state (betting handled by useCrashGame slot 2)
  const [dragon2Bet, setDragon2Bet] = useState('10');
  const [dragon2AutoCashout, setDragon2AutoCashout] = useState('');
  const [betMode, setBetMode] = useState<'dragon1' | 'dragon2' | 'both'>('both');
  
  // Use backend state for dragon crash and betting
  const dragon2BetStatus = betStatus2;
  const dragon2PotentialWin = potentialWin2;
  
  // Animation state refs
  const scrollXRef = useRef(0);
  const arrowsRef = useRef<Arrow[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const starsRef = useRef<Star[]>([]);
  const arrowFlashRef = useRef(0);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0, velocityX: 0, velocityY: 0 });
  const crashExplosionRef = useRef(0);
  const dragon2CrashExplosionRef = useRef(false);
  // Track previous backend crash states to detect transitions
  const prevD1CrashedRef = useRef(false);
  const prevD2CrashedRef = useRef(false);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
  
  // Dragon state refs (mutable for animation loop)
  const dragon1Ref = useRef<DragonState>(createDragonState(0, 1.0, 1));
  const dragon2Ref = useRef<DragonState>(createDragonState(0, 0.85, 2));
  
  // Show states
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  
  const MIN_BET = 1;
  const MAX_BET = 10000;
  
  // Initialize buildings and stars
  useEffect(() => {
    const buildings: Building[] = [];
    const types: Building['type'][] = ['tower', 'castle', 'house', 'wall', 'house', 'tower'];
    for (let i = 0; i < 20; i++) {
      const type = types[i % types.length];
      buildings.push({
        x: i * 120 + Math.random() * 40,
        width: type === 'castle' ? 60 : type === 'tower' ? 25 : type === 'wall' ? 80 : 35,
        height: type === 'castle' ? 90 : type === 'tower' ? 100 : type === 'wall' ? 40 : 50 + Math.random() * 20,
        type,
        hasWindow: type !== 'wall',
        windowCount: type === 'castle' ? 4 : type === 'tower' ? 1 : 2,
        roofStyle: type === 'tower' ? 'pointed' : type === 'castle' ? 'battlement' : type === 'wall' ? 'battlement' : 'pointed',
      });
    }
    buildingsRef.current = buildings;
    
    const stars: Star[] = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * 2000,
        y: Math.random() * 300,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        twinkleSpeed: 0.02 + Math.random() * 0.03,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;
  }, []);
  
  // Reset dragons on new round
  useEffect(() => {
    if (gameState === 'WAITING' || gameState === 'STARTING') {
      const canvas = canvasRef.current;
      const h = canvas ? canvas.getBoundingClientRect().height : 350;
      dragon1Ref.current = createDragonState(h * 0.35, 1.0, Math.random() * 1000);
      dragon2Ref.current = createDragonState(h * 0.5, 0.85, Math.random() * 1000 + 500);
      crashExplosionRef.current = 0;
      dragon2CrashExplosionRef.current = false;
      prevD1CrashedRef.current = false;
      prevD2CrashedRef.current = false;
      // Dragon 2 bet status is now managed by useCrashGame hook (slot 2)
    }
  }, [gameState]);
  
  // Dragon crash states are now fully managed by the backend via useCrashGame hook
  // No local simulation needed — d1CrashedBackend and d2CrashedBackend come from the server
  
  // Spawn arrows from city — ALWAYS aimed directly at a dragon
  useEffect(() => {
    if (gameState !== 'RUNNING' && gameState !== 'CRASHED') return;
    // Don't spawn arrows if both dragons are gone
    // (arrows are spawned during RUNNING, and continue briefly during CRASHED for visual effect)
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const d1 = dragon1Ref.current;
      const d2 = dragon2Ref.current;
      
      // Pick which dragon to target (skip if that dragon is already gone)
      let targetDragon: 1 | 2;
      if (d1.isGone || d1.isFalling) targetDragon = 2;
      else if (d2.isGone || d2.isFalling) targetDragon = 1;
      else targetDragon = Math.random() > 0.5 ? 1 : 2;
      
      const targetD = targetDragon === 1 ? d1 : d2;
      if (targetD.isGone) return; // both gone, no arrows
      
      // Arrow starts from the city (right side, bottom area)
      const startX = w * (0.7 + Math.random() * 0.25);
      const startY = h * (0.55 + Math.random() * 0.25);
      
      // Aim DIRECTLY at the dragon — arrows look like they'll definitely hit
      const leadX = targetD.x + targetD.vx * 5 + (Math.random() - 0.5) * 10;
      const leadY = targetD.y + (Math.random() - 0.5) * 15;
      const dx = leadX - startX;
      const dy = leadY - startY;
      const angle = Math.atan2(dy, dx);
      const speed = 5.5 + Math.random() * 3; // Fast, deadly arrows
      
      arrowsRef.current.push({
        x: startX, y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle,
        trail: [],
        active: true,
        hitDragon: 0,
        targetDragon,
        destroyed: false,
      });
      
      arrowFlashRef.current = 5;
    }, 300 + Math.random() * 300); // Very frequent arrows — constant danger
    
    return () => clearInterval(interval);
  }, [gameState]);
  
  // ==================== MAIN ANIMATION LOOP ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const animate = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 16.67, 3);
      lastTimeRef.current = timestamp;
      frameCountRef.current++;
      globalTimeRef.current += dt;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }
      
      ctx.clearRect(0, 0, w, h);
      
      const d1 = dragon1Ref.current;
      const d2 = dragon2Ref.current;
      
      // Set dragon X positions — each dragon at a different horizontal position + Perlin offset
      d1.x = w * 0.2 + (d1.vx || 0);
      d2.x = w * 0.38 + (d2.vx || 0);
      
      // Initialize baseY if not set properly
      if (d1.baseY < 10) { d1.baseY = h * 0.35; d1.y = d1.baseY; }
      if (d2.baseY < 10) { d2.baseY = h * 0.5; d2.y = d2.baseY; }
      
      // === SCREEN SHAKE (Spring Physics) ===
      ctx.save();
      const shake = shakeRef.current;
      if (shake.intensity > 0) {
        const springForce = 0.12;
        const damping = 0.82;
        shake.velocityX += (-shake.x * springForce + (Math.random() - 0.5) * shake.intensity * 2);
        shake.velocityY += (-shake.y * springForce + (Math.random() - 0.5) * shake.intensity * 2);
        shake.velocityX *= damping;
        shake.velocityY *= damping;
        shake.x += shake.velocityX;
        shake.y += shake.velocityY;
        shake.intensity *= 0.92;
        if (shake.intensity < 0.2) {
          shake.intensity = 0;
          shake.x = 0; shake.y = 0;
          shake.velocityX = 0; shake.velocityY = 0;
        }
        ctx.translate(shake.x, shake.y);
      }
      
      // === BACKGROUND ===
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#080418');
      bgGrad.addColorStop(0.2, '#140828');
      bgGrad.addColorStop(0.4, '#1a0a2e');
      bgGrad.addColorStop(0.6, '#150820');
      bgGrad.addColorStop(1, '#0A0E17');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-10, -10, w + 20, h + 20);
      
      // === ATMOSPHERIC HAZE ===
      const hazeGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
      hazeGrad.addColorStop(0, 'rgba(10, 14, 23, 0)');
      hazeGrad.addColorStop(0.5, 'rgba(10, 14, 23, 0.15)');
      hazeGrad.addColorStop(1, 'rgba(10, 14, 23, 0.4)');
      ctx.fillStyle = hazeGrad;
      ctx.fillRect(0, 0, w, h);
      
      // === STARS ===
      for (const star of starsRef.current) {
        const sx = ((star.x - scrollXRef.current * 0.05) % w + w) % w;
        star.twinklePhase += star.twinkleSpeed * dt;
        const brightness = 0.3 + Math.sin(star.twinklePhase) * 0.4 + 0.3;
        if (star.size > 1.2) {
          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.1})`;
          ctx.beginPath();
          ctx.arc(sx, star.y, star.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.beginPath();
        ctx.arc(sx, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // === MOON ===
      for (let layer = 3; layer >= 0; layer--) {
        const moonRadius = 25 + layer * 15;
        ctx.fillStyle = `rgba(255, 228, 181, ${0.03 - layer * 0.005})`;
        ctx.beginPath();
        ctx.arc(w * 0.8, h * 0.15, moonRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFE4B5';
      ctx.shadowColor = '#FFE4B5';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.15, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200, 180, 140, 0.3)';
      ctx.beginPath(); ctx.arc(w * 0.8 - 5, h * 0.15 - 5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.8 + 8, h * 0.15 + 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.8 - 8, h * 0.15 + 6, 4, 0, Math.PI * 2); ctx.fill();
      
      // === MOUNTAINS ===
      ctx.fillStyle = '#0D0520';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.75);
      for (let x = 0; x <= w; x += 20) {
        const mx = x - (scrollXRef.current * 0.08) % 20;
        ctx.lineTo(x, h * 0.62 + Math.sin(mx * 0.015) * 35 + Math.sin(mx * 0.004) * 55);
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      
      ctx.fillStyle = '#0A0318';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      for (let x = 0; x <= w; x += 25) {
        const mx = x - (scrollXRef.current * 0.12) % 25;
        ctx.lineTo(x, h * 0.7 + Math.sin(mx * 0.025) * 25 + Math.sin(mx * 0.008) * 40);
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      
      // === CITY ===
      if (arrowFlashRef.current > 0) arrowFlashRef.current -= dt;
      drawMedievalCity(ctx, buildingsRef.current, scrollXRef.current, w, h, arrowFlashRef.current);
      
      // === UPDATE DRAGONS ===
      // Each dragon crashes independently based on backend crash states.
      // When one falls, the other continues flying.
      const d1Crashed = d1CrashedBackend;
      const d2Crashed_local = d2CrashedBackend;

      // === UPDATE ANIMATION STATE ===
      // Keep scrolling as long as at least one dragon is still flying
      const anyDragonFlying = (!d1Crashed || !d1.isGone) || (!d2Crashed_local || !d2.isGone);
      if (gameState === 'RUNNING' && anyDragonFlying) {
        // Use the higher of the two active multipliers for scroll speed
        const activeMultiplier = Math.max(
          d1Crashed ? 1 : (currentMultiplier || 1),
          d2Crashed_local ? 1 : (currentMultiplier2 || 1)
        );
        scrollXRef.current += 1.5 * dt * Math.min(activeMultiplier, 5);
      }
      
      // Dragon 1 flight & AI
      if (!d1Crashed && !d1.isFalling) {
        updateDragonFlight(d1, perlinRef.current, dt, globalTimeRef.current, h);
        updateDragonDodging(d1, arrowsRef.current, dt, w, h);
        updateDragonPersonality(d1, d2.isGone ? null : d2, dt);
        
        // Fire breath particles
        if (d1.isBreathingFire) {
          const mouthX = d1.x + 42 * d1.scale;
          const mouthY = d1.y - 2 * d1.scale;
          particleEngineRef.current.emitDirectional(mouthX, mouthY, 3, d1.fireBreathTargetX, d1.fireBreathTargetY, {
            type: 'firebreath', size: 6, maxLife: 18, speed: 7, color: COLORS.dragon1.fire, spreadAngle: Math.PI / 5
          });
          particleEngineRef.current.emitDirectional(mouthX, mouthY, 1, d1.fireBreathTargetX, d1.fireBreathTargetY, {
            type: 'firebreath', size: 3, maxLife: 12, speed: 8, color: '#FFD700', spreadAngle: Math.PI / 8
          });
        }
        
        // Trail particles
        if (gameState === 'RUNNING') {
          particleEngineRef.current.emit(d1.x - 30 * d1.scale, d1.y, 2, {
            type: 'fire', size: 5, maxLife: 18, speed: 1.8, color: '#FF6B00', vx: -2
          });
          if (frameCountRef.current % 4 === 0) {
            particleEngineRef.current.emit(d1.x - 20 * d1.scale, d1.y, 1, {
              type: 'ember', size: 1.5, maxLife: 30, speed: 1, color: '#FFD700', vx: -1
            });
          }
        }
      }
      
      // Dragon 1 crash — detect transition from not-crashed to crashed
      if (d1Crashed && !prevD1CrashedRef.current && !d1.isFalling) {
        prevD1CrashedRef.current = true;
      }
      if (d1Crashed && crashExplosionRef.current === 0 && !d1.isFalling) {
        crashExplosionRef.current = 1;
        // Spawn a final arrow that visually "hits" the dragon
        arrowsRef.current.push({
          x: d1.x + 5, y: d1.y, // Arrow appears AT the dragon (already hit)
          vx: 0, vy: 0, angle: Math.PI, trail: [],
          active: false, hitDragon: 1, targetDragon: 1, destroyed: false,
        });
        startDragonFalling(d1);
        shakeRef.current.intensity = 0; // shake disabled
        particleEngineRef.current.emit(d1.x, d1.y, 40, {
          type: 'explosion', size: 7, maxLife: 45, speed: 5.5, color: '#FF6B00', spread: Math.PI * 2
        });
        particleEngineRef.current.emit(d1.x, d1.y, 20, {
          type: 'smoke', size: 12, maxLife: 70, speed: 2, color: '#444444', spread: Math.PI * 2
        });
        particleEngineRef.current.emit(d1.x, d1.y, 25, {
          type: 'debris', size: 4, maxLife: 55, speed: 4.5, color: '#FF4500', spread: Math.PI * 2
        });
        particleEngineRef.current.emit(d1.x, d1.y, 15, {
          type: 'ember', size: 2.5, maxLife: 60, speed: 3, color: '#FFD700', spread: Math.PI * 2
        });
        shockwavesRef.current.push(
          { x: d1.x, y: d1.y, radius: 5, maxRadius: 100, life: 25, maxLife: 25, color: '#FF6B00' },
          { x: d1.x, y: d1.y, radius: 5, maxRadius: 60, life: 18, maxLife: 18, color: '#FFD700' },
        );
      }
      
      // Update falling dragon 1
      if (d1.isFalling) {
        updateDragonFalling(d1, dt, h);
        // Smoke trail while falling
        if (frameCountRef.current % 2 === 0 && !d1.isGone) {
          particleEngineRef.current.emit(d1.x, d1.y, 3, {
            type: 'smoke', size: 7, maxLife: 35, speed: 1.2, color: '#333'
          });
          particleEngineRef.current.emit(d1.x, d1.y, 1, {
            type: 'ember', size: 1.5, maxLife: 20, speed: 1, color: '#FF6B00'
          });
        }
        // Ground impact dust
        if (d1.hasHitGround && d1.fallAlpha > 0.9) {
          particleEngineRef.current.emit(d1.x, d1.y, 20, {
            type: 'debris', size: 3, maxLife: 30, speed: 3, color: '#8B7355', spread: Math.PI
          });
          particleEngineRef.current.emit(d1.x, d1.y, 10, {
            type: 'smoke', size: 10, maxLife: 40, speed: 1.5, color: '#555', spread: Math.PI
          });
          shockwavesRef.current.push(
            { x: d1.x, y: d1.y, radius: 5, maxRadius: 50, life: 15, maxLife: 15, color: '#8B7355' },
          );
        }
      }
      
      // Dragon 2 flight & AI — continues even after Dragon 1 crashes
      if (!d2Crashed_local && !d2.isFalling) {
        updateDragonFlight(d2, perlinRef.current, dt, globalTimeRef.current, h);
        updateDragonDodging(d2, arrowsRef.current, dt, w, h);
        updateDragonPersonality(d2, d1.isGone ? null : d1, dt);
        
        // Fire breath particles (ice/blue)
        if (d2.isBreathingFire) {
          const mouthX = d2.x + 42 * d2.scale;
          const mouthY = d2.y - 2 * d2.scale;
          particleEngineRef.current.emitDirectional(mouthX, mouthY, 4, d2.fireBreathTargetX, d2.fireBreathTargetY, {
            type: 'firebreath', size: 6, maxLife: 20, speed: 8, color: COLORS.dragon2.fire, spreadAngle: Math.PI / 4
          });
          particleEngineRef.current.emitDirectional(mouthX, mouthY, 2, d2.fireBreathTargetX, d2.fireBreathTargetY, {
            type: 'frost', size: 4, maxLife: 16, speed: 7, color: '#87CEEB', spreadAngle: Math.PI / 5
          });
        }
        
        // Trail particles (ice) — always show when dragon is alive
        particleEngineRef.current.emit(d2.x - 30 * d2.scale, d2.y, 2, {
          type: 'frost', size: 4, maxLife: 14, speed: 1.4, color: '#4A90D9', vx: -1.5
        });
        if (frameCountRef.current % 5 === 0) {
          particleEngineRef.current.emit(d2.x - 20 * d2.scale, d2.y, 1, {
            type: 'ember', size: 1.2, maxLife: 25, speed: 0.8, color: '#87CEEB', vx: -1
          });
        }
      }
      
      // Dragon 2 crash — a KILLING ARROW hits the dragon!
      if (d2Crashed_local && !dragon2CrashExplosionRef.current && !d2.isFalling) {
        dragon2CrashExplosionRef.current = true;
        // Spawn a final arrow that visually "hits" the dragon
        arrowsRef.current.push({
          x: d2.x + 5, y: d2.y,
          vx: 0, vy: 0, angle: Math.PI, trail: [],
          active: false, hitDragon: 2, targetDragon: 2, destroyed: false,
        });
        startDragonFalling(d2);
        shakeRef.current.intensity = 0; // shake disabled
        particleEngineRef.current.emit(d2.x, d2.y, 30, {
          type: 'explosion', size: 6, maxLife: 38, speed: 4.5, color: '#4A90D9', spread: Math.PI * 2
        });
        particleEngineRef.current.emit(d2.x, d2.y, 15, {
          type: 'smoke', size: 10, maxLife: 55, speed: 1.8, color: '#2a2a4a', spread: Math.PI * 2
        });
        particleEngineRef.current.emit(d2.x, d2.y, 12, {
          type: 'ember', size: 2, maxLife: 50, speed: 2.5, color: '#87CEEB', spread: Math.PI * 2
        });
        shockwavesRef.current.push(
          { x: d2.x, y: d2.y, radius: 5, maxRadius: 80, life: 22, maxLife: 22, color: '#4A90D9' },
        );
      }
      
      // Update falling dragon 2
      if (d2.isFalling) {
        updateDragonFalling(d2, dt, h);
        if (frameCountRef.current % 3 === 0 && !d2.isGone) {
          particleEngineRef.current.emit(d2.x, d2.y, 2, {
            type: 'smoke', size: 6, maxLife: 28, speed: 0.9, color: '#2a2a4a'
          });
          particleEngineRef.current.emit(d2.x, d2.y, 1, {
            type: 'ember', size: 1.5, maxLife: 18, speed: 0.8, color: '#4A90D9'
          });
        }
        if (d2.hasHitGround && d2.fallAlpha > 0.9) {
          particleEngineRef.current.emit(d2.x, d2.y, 15, {
            type: 'debris', size: 3, maxLife: 25, speed: 2.5, color: '#6a6a8a', spread: Math.PI
          });
          particleEngineRef.current.emit(d2.x, d2.y, 8, {
            type: 'smoke', size: 8, maxLife: 35, speed: 1.2, color: '#444', spread: Math.PI
          });
        }
      }
      
      // If one dragon is gone and the other continues, adjust the survivor
      if (d2.isGone && !d1.isGone && !d1.isFalling) {
        d1.baseY += (h * 0.42 - d1.baseY) * 0.01; // Slowly center
        d1.scale += (1.15 - d1.scale) * 0.005; // Slightly bigger
      }
      if (d1.isGone && !d2.isGone && !d2.isFalling) {
        d2.baseY += (h * 0.42 - d2.baseY) * 0.01;
        d2.scale += (1.1 - d2.scale) * 0.005;
      }
      
      // === ARROWS ===
      for (let i = arrowsRef.current.length - 1; i >= 0; i--) {
        const arrow = arrowsRef.current[i];
        if (!arrow.active || arrow.destroyed) { arrowsRef.current.splice(i, 1); continue; }
        
        arrow.trail.push({ x: arrow.x, y: arrow.y });
        if (arrow.trail.length > 8) arrow.trail.shift();
        
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;
        arrow.vy += 0.05 * dt;
        arrow.angle = Math.atan2(arrow.vy, arrow.vx);
        
        if (frameCountRef.current % 3 === 0) {
          particleEngineRef.current.emit(arrow.x, arrow.y, 1, {
            type: 'arrow_trail', size: 2, maxLife: 10, speed: 0.3, color: '#8B7355'
          });
        }
        
        // Near-miss detection — arrows pass close to dragons creating tension
        // Dragons ALWAYS dodge successfully... until the backend says crash
        if (!d1.isFalling && !d1.isGone) {
          const d1x = arrow.x - d1.x;
          const d1y = arrow.y - d1.y;
          const d1Dist = Math.sqrt(d1x * d1x + d1y * d1y);
          // Near miss — sparks fly when arrow passes close
          if (d1Dist < 45 * d1.scale && d1Dist > 20 * d1.scale) {
            if (frameCountRef.current % 3 === 0) {
              particleEngineRef.current.emit(arrow.x, arrow.y, 3, {
                type: 'spark', size: 3, maxLife: 10, speed: 2.5, color: '#FFD700'
              });
            }
            // shake disabled
          }
        }
        if (!d2.isFalling && !d2.isGone) {
          const d2x = arrow.x - d2.x;
          const d2y = arrow.y - d2.y;
          const d2Dist = Math.sqrt(d2x * d2x + d2y * d2y);
          if (d2Dist < 45 * d2.scale && d2Dist > 20 * d2.scale) {
            if (frameCountRef.current % 3 === 0) {
              particleEngineRef.current.emit(arrow.x, arrow.y, 3, {
                type: 'spark', size: 3, maxLife: 10, speed: 2.5, color: '#87CEEB'
              });
            }
            // shake disabled
          }
        }
        
        if (arrow.x < -50 || arrow.x > w + 50 || arrow.y > h + 50) {
          arrow.active = false;
        }
        
        drawArrow(ctx, arrow);
      }
      
      // Check fire breath hits on arrows
      particleEngineRef.current.checkFireBreathHits(arrowsRef.current, d1.x);
      
      // === DRAW DRAGONS (sorted by zDepth) ===
      const dragonsToDraw = [
        { dragon: d1, colors: COLORS.dragon1, crashed: d1Crashed, label: 'DRAGON 1', num: 1 },
        { dragon: d2, colors: COLORS.dragon2, crashed: d2Crashed_local, label: 'DRAGON 2', num: 2 },
      ].sort((a, b) => a.dragon.zDepth - b.dragon.zDepth);
      
      for (const { dragon, colors, crashed, label, num } of dragonsToDraw) {
        if (dragon.isGone) continue;
        
        drawDragonSprite(ctx, dragon, colors, globalTimeRef.current, crashed);
        
        // Label with glow
        if (!dragon.isFalling) {
          ctx.shadowColor = colors.fire;
          ctx.shadowBlur = 8;
          ctx.fillStyle = colors.fire;
          ctx.font = `bold ${12 * dragon.scale}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(label, dragon.x, dragon.y - 35 * dragon.scale);
          ctx.shadowBlur = 0;
        }
      }
      
      // === PARTICLES ===
      particleEngineRef.current.update();
      particleEngineRef.current.draw(ctx);
      
      // === SHOCKWAVE RINGS ===
      shockwavesRef.current = shockwavesRef.current.filter(sw => {
        sw.life--;
        if (sw.life <= 0) return false;
        const progress = 1 - sw.life / sw.maxLife;
        sw.radius = sw.maxRadius * progress;
        const alpha = (1 - progress) * 0.5;
        const lineWidth = 3 * (1 - progress * 0.8);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      });
      
      // === MULTIPLIER DISPLAY (Dual Dragon) ===
      if (gameState === 'WAITING' || gameState === 'STARTING') {
        // Show countdown or waiting
        const waitText = countdown > 0 ? `${countdown}s` : 'WAITING...';
        const fontSize = Math.min(w * 0.08, 48);
        ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.accent;
        ctx.shadowBlur = 20;
        ctx.fillStyle = COLORS.accent;
        ctx.fillText(waitText, w / 2, h * 0.2);
        ctx.shadowBlur = 0;
      } else {
        // Show two multipliers side by side
        const fontSize = Math.min(w * 0.06, 38);
        ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        
        // Dragon 1 multiplier (left side)
        const m1 = d1Crashed ? (crashPoint || currentMultiplier) : currentMultiplier;
        const m1Color = d1Crashed ? COLORS.danger : m1 >= 5 ? COLORS.warning : m1 >= 2 ? COLORS.success : '#FF6B00';
        const m1Text = `${m1.toFixed(2)}x`;
        ctx.shadowColor = m1Color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = m1Color;
        ctx.fillText(m1Text, w * 0.3, h * 0.15);
        ctx.shadowBlur = 0;
        // Dragon 1 label
        ctx.font = `bold ${Math.min(w * 0.025, 14)}px Inter, sans-serif`;
        ctx.fillStyle = d1Crashed ? COLORS.danger + '99' : '#FF6B00AA';
        ctx.fillText(d1Crashed ? 'DRAGON 1 CRASHED' : 'DRAGON 1', w * 0.3, h * 0.15 + fontSize * 0.6);
        
        // Dragon 2 multiplier (right side)
        const m2 = d2Crashed_local ? (crashPoint2 || currentMultiplier2) : currentMultiplier2;
        const m2Color = d2Crashed_local ? COLORS.danger : m2 >= 5 ? COLORS.warning : m2 >= 2 ? COLORS.success : '#4A90D9';
        const m2Text = `${m2.toFixed(2)}x`;
        ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
        ctx.shadowColor = m2Color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = m2Color;
        ctx.fillText(m2Text, w * 0.7, h * 0.15);
        ctx.shadowBlur = 0;
        // Dragon 2 label
        ctx.font = `bold ${Math.min(w * 0.025, 14)}px Inter, sans-serif`;
        ctx.fillStyle = d2Crashed_local ? COLORS.danger + '99' : '#4A90D9AA';
        ctx.fillText(d2Crashed_local ? 'DRAGON 2 CRASHED' : 'DRAGON 2', w * 0.7, h * 0.15 + fontSize * 0.6);
      }
      
      ctx.restore(); // restore shake transform
      
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameState, currentMultiplier, currentMultiplier2, crashPoint, crashPoint2, countdown, d1CrashedBackend, d2CrashedBackend]);
  
  // ==================== HANDLERS ====================
  const handlePlaceBet = useCallback((dragonNum: 1 | 2) => {
    if (dragonNum === 1) {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount < MIN_BET || amount > MAX_BET) return;
      const ac = parseFloat(autoCashout);
      placeBet(amount, isNaN(ac) || ac <= 1 ? undefined : ac, 'dragon');
      playSound('bet');
    } else {
      const amount = parseFloat(dragon2Bet);
      if (isNaN(amount) || amount < MIN_BET || amount > MAX_BET) return;
      const ac2 = parseFloat(dragon2AutoCashout);
      placeBet2(amount, isNaN(ac2) || ac2 <= 1 ? undefined : ac2, 'dragon');
      playSound('bet');
    }
  }, [betAmount, autoCashout, dragon2Bet, dragon2AutoCashout, placeBet, placeBet2, playSound]);
  
  // Cashout lock to prevent double-trigger on mobile touch
  const cashoutLockRef = useRef<{ [key: number]: boolean }>({});
  
  const handleCashOut = useCallback((dragonNum: 1 | 2) => {
    // Prevent double-trigger: if this dragon is already being cashed out, ignore
    if (cashoutLockRef.current[dragonNum]) {
      console.log("[Crash] Cashout already in progress for Dragon", dragonNum, "- ignoring");
      return;
    }
    cashoutLockRef.current[dragonNum] = true;
    setTimeout(() => { cashoutLockRef.current[dragonNum] = false; }, 2000);
    
    if (dragonNum === 1) {
      cashOut();
      playSound('win');
    } else if (dragonNum === 2) {
      cashOut2();
      playSound('win');
    }
  }, [cashOut, cashOut2, playSound]);
  
  // Keyboard shortcuts:
  // SPACE = bet/cashout based on mode (in 'both' mode: one at a time, dragon 1 first)
  // Key '1' = bet/cashout Dragon 1 only
  // Key '2' = bet/cashout Dragon 2 only
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      
      // Key '1' - Dragon 1 only
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        if (gameState === 'RUNNING' && betStatus === 'PLACED') {
          handleCashOut(1);
        } else if (gameState === 'WAITING' && betStatus === 'NONE' && (betMode === 'dragon1' || betMode === 'both')) {
          handlePlaceBet(1);
        }
        return;
      }
      
      // Key '2' - Dragon 2 only
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        if (gameState === 'RUNNING' && betStatus2 === 'PLACED') {
          handleCashOut(2);
        } else if (gameState === 'WAITING' && betStatus2 === 'NONE' && (betMode === 'dragon2' || betMode === 'both')) {
          handlePlaceBet(2);
        }
        return;
      }
      
      // SPACE - smart bet/cashout
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'RUNNING') {
          // In 'both' mode: cash out one at a time (dragon 1 first, then dragon 2)
          if (betMode === 'both') {
            if (betStatus === 'PLACED') {
              handleCashOut(1);
            } else if (betStatus2 === 'PLACED') {
              handleCashOut(2);
            }
          } else if (betMode === 'dragon1' && betStatus === 'PLACED') {
            handleCashOut(1);
          } else if (betMode === 'dragon2' && betStatus2 === 'PLACED') {
            handleCashOut(2);
          }
        } else if (gameState === 'WAITING') {
          // SPACE places bets on all active modes
          if (betMode === 'dragon1' || betMode === 'both') {
            if (betStatus === 'NONE') handlePlaceBet(1);
          }
          if (betMode === 'dragon2' || betMode === 'both') {
            if (betStatus2 === 'NONE') handlePlaceBet(2);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, betStatus, betStatus2, betMode, handleCashOut, handlePlaceBet]);
  
  // Button config
  const getButtonConfig = (dragonNum: 1 | 2) => {
    const bs = dragonNum === 1 ? betStatus : betStatus2;
    const crashed = dragonNum === 1 ? d1CrashedBackend : d2CrashedBackend;
    const pw = dragonNum === 1 ? potentialWin : potentialWin2;
    const dragonColor = dragonNum === 1 ? 'from-orange-500 to-red-600' : 'from-blue-500 to-purple-600';
    const dragonHover = dragonNum === 1 ? 'hover:from-orange-400 hover:to-red-500' : 'hover:from-blue-400 hover:to-purple-500';
    
    if (!isConnected) return { text: 'CONNECTING...', disabled: true, className: 'bg-gray-600' };
    if (gameState === 'WAITING') {
      if (bs === 'PLACED') return { text: 'BET PLACED ✓', disabled: true, className: dragonNum === 1 ? 'bg-orange-600' : 'bg-blue-600' };
      return { text: `BET DRAGON ${dragonNum}`, disabled: false, className: `bg-gradient-to-r ${dragonColor} ${dragonHover}` };
    }
    if (gameState === 'STARTING') {
      if (bs === 'PLACED') return { text: 'STARTING...', disabled: true, className: dragonNum === 1 ? 'bg-orange-600' : 'bg-blue-600' };
      return { text: `BET DRAGON ${dragonNum}`, disabled: false, className: `bg-gradient-to-r ${dragonColor} ${dragonHover}` };
    }
    if (gameState === 'RUNNING') {
      if (crashed) return { text: 'FALLEN!', disabled: true, className: 'bg-red-600' };
      if (bs === 'PLACED') return { text: `CASHOUT $${Number(pw || 0).toFixed(2)}`, disabled: false, className: 'bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse' };
      return { text: 'FLYING...', disabled: true, className: 'bg-gray-600' };
    }
    if (gameState === 'CRASHED') {
      if (bs === 'CASHED_OUT' || bs === 'WON') return { text: `WON $${Number(pw || 0).toFixed(2)}!`, disabled: true, className: 'bg-green-600' };
      if (bs === 'PLACED' || bs === 'LOST') return { text: 'FALLEN!', disabled: true, className: 'bg-red-600' };
      return { text: 'NEXT ROUND...', disabled: true, className: 'bg-gray-600' };
    }
    return { text: 'WAIT...', disabled: true, className: 'bg-gray-600' };
  };
  
  const btn1 = getButtonConfig(1);
  const btn2 = getButtonConfig(2);
  
  // ==================== RENDER ====================
  return (
    <div className="bg-[#0A0E17] rounded-2xl p-4 md:p-6 shadow-2xl border border-[#1E293B] relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">{isConnected ? 'LIVE' : 'CONNECTING'}</span>
          {gameId && <span className="text-xs text-gray-500 ml-2 font-mono">#{gameId.slice(-6)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFairPanel(!showFairPanel)}
            className="p-2 rounded-lg bg-[#2f4553] hover:bg-[#3d5a6e] transition-colors text-xs text-gray-400 hover:text-[#00F0FF] border border-[#2f4553]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </button>
          <button onClick={toggleGameSound}
            className={`p-2 rounded-lg bg-[#2f4553] hover:bg-[#3d5a6e] transition-colors border border-[#2f4553] ${!isSoundActive ? 'text-red-400' : 'text-gray-400 hover:text-white'}`}>
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
        <div className="mb-4 p-4 bg-[#1a2c38] rounded-xl border border-[#2f4553]/50 backdrop-blur-sm relative z-10">
          <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Provably Fair
          </h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Server Seed Hash</label>
              <div className="bg-[#0f1923] rounded-lg px-3 py-2 text-xs font-mono text-gray-300 break-all border border-[#2f4553]/50">
                {lastServerSeedHash || 'Play a round to see the hash'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Client Seed</label>
              <div className="bg-[#0f1923] rounded-lg px-3 py-2 text-xs font-mono text-gray-300 border border-[#2f4553]/50">
                {clientSeed || 'Set in Settings'}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Canvas */}
      <div className="relative mb-4 md:mb-6" ref={containerRef}>
        <canvas ref={canvasRef}
          className="w-full rounded-xl border border-[#2f4553]/50"
          style={{ height: 'clamp(250px, 45vw, 350px)', background: '#050510' }}
        />
      </div>
      
      {/* Recent crashes */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {recentCrashes.slice(0, 10).map((crash, index) => (
          <div key={index}
            className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-mono whitespace-nowrap ${
              crash >= 10 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-400 border border-yellow-500/30' :
              crash >= 2 ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
              'bg-red-500/20 text-red-400 border border-red-500/20'
            }`}>
            {Number(crash).toFixed(2)}x
          </div>
        ))}
      </div>
      
      {/* Bet Mode Selector - Aviator-style tabs */}
      <div className="flex mb-4 bg-[#1a2c38] rounded-xl p-1 border border-[#2f4553]/50">
        <button onClick={() => setBetMode('dragon1')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            betMode === 'dragon1' ? 'bg-gradient-to-r from-orange-600/80 to-red-600/80 text-white shadow-lg shadow-orange-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}>
          🐉 Dragon 1
        </button>
        <button onClick={() => setBetMode('both')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            betMode === 'both' ? 'bg-gradient-to-r from-orange-500/70 via-purple-500/70 to-blue-500/70 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}>
          🐉🐲 Both
        </button>
        <button onClick={() => setBetMode('dragon2')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            betMode === 'dragon2' ? 'bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}>
          🐲 Dragon 2
        </button>
      </div>
      
      {/* Betting Controls - Aviator-style layout */}
      <div className={`grid ${betMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        {/* Dragon 1 Controls - shown in 'dragon1' and 'both' modes */}
        {(betMode === 'dragon1' || betMode === 'both') && (
          <div className={`p-3 md:p-4 rounded-xl border transition-all border-orange-500/30 bg-gradient-to-b from-orange-500/5 to-transparent`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">🐉 DRAGON 1</h4>
              {betStatus === 'PLACED' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">ACTIVE</span>}
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Bet Amount</label>
                <div className="flex gap-1">
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)}
                    className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="10" min={MIN_BET} max={MAX_BET} disabled={betStatus !== 'NONE'} />
                  <button onClick={() => setBetAmount(String(Math.max(MIN_BET, Math.floor(Number(betAmount) / 2))))}
                    disabled={betStatus !== 'NONE'}
                    className="px-2 py-1 bg-[#2f4553] hover:bg-[#3d5a6e] rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-40">½</button>
                  <button onClick={() => setBetAmount(String(Math.min(MAX_BET, Number(betAmount) * 2)))}
                    disabled={betStatus !== 'NONE'}
                    className="px-2 py-1 bg-[#2f4553] hover:bg-[#3d5a6e] rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-40">2×</button>
                </div>
                {betMode !== 'both' && (
                  <div className="flex gap-1 mt-1">
                    {[1, 5, 10, 50, 100].map(v => (
                      <button key={v} onClick={() => setBetAmount(String(v))}
                        disabled={betStatus !== 'NONE'}
                        className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors disabled:opacity-40 ${
                          betAmount === String(v) ? 'bg-orange-500/30 text-orange-300 border border-orange-500/40' : 'bg-[#2f4553] text-gray-400 hover:bg-[#3d5a6e] border border-transparent'
                        }`}>{v}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Auto Cashout</label>
                <input type="number" value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="2.00" step="0.1" min="1.01" disabled={betStatus !== 'NONE'} />
              </div>
              <div className="text-[9px] text-yellow-400 bg-black/50 p-1 rounded mb-1 font-mono">
                gs={gameState} bs={betStatus} bs2={betStatus2} conn={isConnected?'Y':'N'} err={error||'none'}
              </div>
              <button
                onClick={() => betStatus === 'PLACED' && gameState === 'RUNNING' ? handleCashOut(1) : handlePlaceBet(1)}
                disabled={btn1.disabled}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${btn1.className} disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}>
                {btn1.text}
                {betStatus === 'PLACED' && gameState === 'RUNNING' && (
                  <span className="block text-[10px] font-normal opacity-80 mt-0.5">${Number(potentialWin || 0).toFixed(2)} potential</span>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Dragon 2 Controls - shown in 'dragon2' and 'both' modes */}
        {(betMode === 'dragon2' || betMode === 'both') && (
          <div className={`p-3 md:p-4 rounded-xl border transition-all border-blue-500/30 bg-gradient-to-b from-blue-500/5 to-transparent`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">🐲 DRAGON 2</h4>
              {betStatus2 === 'PLACED' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">ACTIVE</span>}
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Bet Amount</label>
                <div className="flex gap-1">
                  <input type="number" value={dragon2Bet} onChange={(e) => setDragon2Bet(e.target.value)}
                    className="flex-1 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="10" min={MIN_BET} max={MAX_BET} disabled={betStatus2 !== 'NONE'} />
                  <button onClick={() => setDragon2Bet(String(Math.max(MIN_BET, Math.floor(Number(dragon2Bet) / 2))))}
                    disabled={betStatus2 !== 'NONE'}
                    className="px-2 py-1 bg-[#2f4553] hover:bg-[#3d5a6e] rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-40">½</button>
                  <button onClick={() => setDragon2Bet(String(Math.min(MAX_BET, Number(dragon2Bet) * 2)))}
                    disabled={betStatus2 !== 'NONE'}
                    className="px-2 py-1 bg-[#2f4553] hover:bg-[#3d5a6e] rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-40">2×</button>
                </div>
                {betMode !== 'both' && (
                  <div className="flex gap-1 mt-1">
                    {[1, 5, 10, 50, 100].map(v => (
                      <button key={v} onClick={() => setDragon2Bet(String(v))}
                        disabled={betStatus2 !== 'NONE'}
                        className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors disabled:opacity-40 ${
                          dragon2Bet === String(v) ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-[#2f4553] text-gray-400 hover:bg-[#3d5a6e] border border-transparent'
                        }`}>{v}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Auto Cashout</label>
                <input type="number" value={dragon2AutoCashout} onChange={(e) => setDragon2AutoCashout(e.target.value)}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="2.00" step="0.1" min="1.01" disabled={betStatus2 !== 'NONE'} />
              </div>
              <button
                onClick={() => dragon2BetStatus === 'PLACED' && gameState === 'RUNNING' && !d2CrashedBackend ? handleCashOut(2) : handlePlaceBet(2)}
                disabled={btn2.disabled}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${btn2.className} disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}>
                {btn2.text}
                {betStatus2 === 'PLACED' && gameState === 'RUNNING' && (
                  <span className="block text-[10px] font-normal opacity-80 mt-0.5">${Number(potentialWin2 || 0).toFixed(2)} potential</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Active bets summary */}
      {(currentBet || betStatus2 === 'PLACED') && (
        <div className="mt-3 flex gap-2">
          {currentBet && (
            <div className="flex-1 p-2 bg-orange-500/10 rounded-lg flex justify-between items-center border border-orange-500/20">
              <span className="text-orange-400 text-xs">🐉 Dragon 1</span>
              <span className="text-orange-300 font-bold text-xs font-mono">${Number(currentBet?.betAmount || 0).toFixed(2)}</span>
            </div>
          )}
          {betStatus2 === 'PLACED' && (
            <div className="flex-1 p-2 bg-blue-500/10 rounded-lg flex justify-between items-center border border-blue-500/20">
              <span className="text-blue-400 text-xs">🐲 Dragon 2</span>
              <span className="text-blue-300 font-bold text-xs font-mono">${Number(currentBet2?.betAmount || dragon2Bet || 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Hotkey hint */}
      <div className="mt-3 text-center text-xs text-gray-500 space-y-0.5">
        <div>
          <kbd className="px-1.5 py-0.5 bg-[#2f4553] rounded text-gray-400 border border-[#2f4553] font-mono text-[10px]">SPACE</kbd>
          {' '}{gameState === 'RUNNING' && (betStatus === 'PLACED' || betStatus2 === 'PLACED') ? 'Cashout (one at a time)' : 'Bet'}
        </div>
        {betMode === 'both' && (
          <div>
            <kbd className="px-1.5 py-0.5 bg-[#2f4553] rounded text-orange-400 border border-[#2f4553] font-mono text-[10px]">1</kbd>
            {' '}Dragon 1{' · '}
            <kbd className="px-1.5 py-0.5 bg-[#2f4553] rounded text-blue-400 border border-[#2f4553] font-mono text-[10px]">2</kbd>
            {' '}Dragon 2
          </div>
        )}
      </div>
    </div>
  );
};

export default DragonBlazeGame;
