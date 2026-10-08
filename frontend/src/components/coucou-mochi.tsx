import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CoucouMochiProps {
  size?: number;
  className?: string;
  onClick?: () => void;
  label?: string;
  interactive?: boolean;
}

interface Particle {
  type: 'heart' | 'star' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  rot: number;
  size: number;
}

type EmoteType = 'idle' | 'heart' | 'star' | 'wink' | 'happy' | 'surprised' | 'dizzy';

export function CoucouMochi({
  size = 140,
  className = '',
  onClick,
  label = 'Mochi Companion AI',
  interactive = true,
}: CoucouMochiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Anim state stored in refs for 60fps performance without React re-renders
  const stateRef = useRef({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    tilt: 0,
    targetTilt: 0,
    open: 1, // eye open factor (0 = closed, 1 = open)
    scaleX: 1,
    scaleY: 1,
    targetScaleX: 1,
    targetScaleY: 1,
    blush: 0.45,
    targetBlush: 0.45,
    emote: 'idle' as EmoteType,
    emoteUntil: 0,
    nextBlink: Date.now() + 2000,
    isBlinking: false,
    blinkStart: 0,
    isSquashing: false,
    squashStart: 0,
    particles: [] as Particle[],
    isHovered: false,
    lastTime: performance.now(),
  });

  // Track cursor across window
  useEffect(() => {
    if (!interactive) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      // Dead zone close to center
      if (dist < 40) {
        stateRef.current.targetYaw = 0;
        stateRef.current.targetPitch = 0;
        stateRef.current.targetTilt = 0;
        return;
      }

      // Smooth normalized angles
      const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.55;
      const nx = Math.max(-1, Math.min(1, dx / maxDist));
      const ny = Math.max(-1, Math.min(1, dy / maxDist));

      stateRef.current.targetYaw = nx * 0.52;
      stateRef.current.targetPitch = -ny * 0.42; // pitch up when cursor above
      stateRef.current.targetTilt = nx * 0.06;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [interactive]);

  // Main 60fps render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let animId: number;

    const render = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min((now - s.lastTime) / 1000, 0.05);
      s.lastTime = now;
      const t = now / 1000;

      // 1. Lerp cursor look angles with smooth spring damping
      const kLook = 1 - Math.pow(0.002, dt);
      s.yaw += (s.targetYaw - s.yaw) * kLook;
      s.pitch += (s.targetPitch - s.pitch) * kLook;
      s.tilt += (s.targetTilt - s.tilt) * kLook;

      // 2. Natural organic breathing (idle squash & stretch sine wave)
      const breathe = Math.sin(t * 2.2) * 0.025;
      const floatY = Math.sin(t * 1.6) * 0.035;

      // 3. Blinking cycle
      if (now > s.nextBlink && !s.isBlinking && s.emote === 'idle') {
        s.isBlinking = true;
        s.blinkStart = now;
      }

      if (s.isBlinking) {
        const elapsed = now - s.blinkStart;
        if (elapsed < 80) {
          s.open = 1 - (elapsed / 80) * 0.95; // closing
        } else if (elapsed < 200) {
          s.open = 0.05 + ((elapsed - 80) / 120) * 0.95; // reopening
        } else {
          s.open = 1;
          s.isBlinking = false;
          s.nextBlink = now + 2400 + Math.random() * 3200;
        }
      }

      // 4. Click boop squash animation with spring bounce
      let animScaleX = 1;
      let animScaleY = 1;
      if (s.isSquashing) {
        const elapsed = now - s.squashStart;
        if (elapsed < 420) {
          const progress = elapsed / 420;
          // Spring curve: squash down -> stretch up -> slight rebound -> rest
          const spring = Math.sin(progress * Math.PI * 3.5) * Math.exp(-progress * 4.5);
          animScaleX = 1 + spring * 0.22;
          animScaleY = 1 - spring * 0.25;
        } else {
          s.isSquashing = false;
        }
      }

      // Combine scales
      s.scaleX = (1 - breathe * 0.7) * animScaleX;
      s.scaleY = (1 + breathe) * animScaleY;

      // Emote expiration check
      if (s.emote !== 'idle' && now > s.emoteUntil) {
        s.emote = 'idle';
      }

      // Blush interpolation
      const targetBlush = s.isHovered ? 0.65 : (s.emote === 'heart' ? 0.75 : 0.45);
      s.blush += (targetBlush - s.blush) * (1 - Math.pow(0.005, dt));

      // 5. Canvas Drawing (Coucou superellipsoid engine)
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const W = size;
      const R = W * 0.32;
      const rx = R * 1.15;
      const ry = R * 0.88;

      const cx = W / 2;
      const cy = W / 2 + R * 0.05 + floatY * R;

      ctx.save();
      ctx.translate(cx, cy);
      if (s.tilt) ctx.rotate(s.tilt);
      ctx.scale(s.scaleX, s.scaleY);

      // Superellipsoid path (exponent 2.7)
      const pathPoints: [number, number][] = [];
      const n = 72;
      const e = 2 / 2.7;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), e);
        const py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), e);
        pathPoints.push([px, py]);
      }

      const setMochiPath = () => {
        ctx.beginPath();
        pathPoints.forEach(([px, py], i) => {
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
      };

      // Base Linear Gradient
      setMochiPath();
      const g = ctx.createLinearGradient(rx * 0.7, -ry * 0.85, -rx * 0.8, ry * 0.9);
      g.addColorStop(0, '#FFFAF5');
      g.addColorStop(1, '#DAC9BA');
      ctx.fillStyle = g;
      ctx.fill();

      // Ambient radial shadow
      setMochiPath();
      const sh = ctx.createRadialGradient(rx * 0.25, -ry * 0.32, R * 0.15, 0, 0, R * 1.25);
      sh.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sh.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
      sh.addColorStop(1, 'rgba(40, 20, 10, 0.18)');
      ctx.fillStyle = sh;
      ctx.fill();

      // Soft 3D Specular Highlight
      setMochiPath();
      const hl = ctx.createRadialGradient(rx * 0.32, -ry * 0.44, 0, rx * 0.32, -ry * 0.44, R * 0.45);
      hl.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = hl;
      ctx.fill();

      // Rosy Cheeks (Blush)
      if (s.blush > 0.01) {
        ctx.save();
        setMochiPath();
        ctx.clip();
        const yo = Math.sin(s.yaw) * rx * 0.8;
        ctx.fillStyle = `rgba(255, 120, 150, ${s.blush})`;
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sd * rx * 0.62 + yo, ry * 0.18, R * 0.18, R * 0.105, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Eyes (Coucou 3D Spherical Projection)
      const EYE_W = 0.25;
      const EYE_H = 0.27;
      const EYE_SP = 0.37;
      const EYE_P = -0.12;

      ctx.save();
      setMochiPath();
      ctx.clip();
      ctx.fillStyle = '#1A1412';
      ctx.strokeStyle = '#1A1412';

      for (const sd of [-1, 1]) {
        const eyeYaw = sd * EYE_SP + s.yaw;
        let eyePitch = EYE_P + s.pitch;
        eyePitch = ((eyePitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        const cp = Math.cos(eyePitch);
        if (Math.cos(eyeYaw) * cp < 0.04) continue;

        const px = Math.sin(eyeYaw) * cp * rx;
        const py = -Math.sin(eyePitch) * ry;
        const fx = Math.max(0.18, Math.cos(eyeYaw));
        const fy = Math.max(0.18, cp);

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(fx, fy);

        const ew = R * EYE_W;
        const eh = R * EYE_H;

        if (s.emote === 'happy') {
          ctx.lineWidth = ew * 0.52;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, eh * 0.18, ew * 0.85, Math.PI * 1.12, Math.PI * 1.88);
          ctx.stroke();
        } else if (s.emote === 'wink') {
          if (sd < 0) {
            const hh = Math.max(eh * s.open, ew * 0.3);
            ctx.beginPath();
            ctx.roundRect(-ew / 2, -hh / 2, ew, hh, Math.min(ew / 2, hh / 2));
            ctx.fill();
          } else {
            ctx.lineWidth = ew * 0.52;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, eh * 0.18, ew * 0.85, Math.PI * 1.12, Math.PI * 1.88);
            ctx.stroke();
          }
        } else if (s.emote === 'heart') {
          ctx.fillStyle = '#FF4D6D';
          const hs = ew * 1.25;
          ctx.beginPath();
          ctx.moveTo(0, hs * 0.38);
          ctx.bezierCurveTo(-hs * 1.05, -hs * 0.15, -hs * 0.5, -hs * 0.95, 0, -hs * 0.38);
          ctx.bezierCurveTo(hs * 0.5, -hs * 0.95, hs * 1.05, -hs * 0.15, 0, hs * 0.38);
          ctx.closePath();
          ctx.fill();
        } else if (s.emote === 'star') {
          ctx.fillStyle = '#F7B32B';
          const ro = ew * 1.15, ri = ew * 0.48;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / 5;
            const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fill();
        } else if (s.emote === 'surprised') {
          ctx.beginPath();
          ctx.arc(0, 0, ew * 0.48, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.emote === 'dizzy') {
          ctx.lineWidth = ew * 0.24;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let a = 0; a < 4.4 * Math.PI; a += 0.2) {
            const r = ew * 0.06 + a * ew * 0.058;
            const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
            if (a === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        } else {
          // Pill eyes (default with blinking)
          const hh = Math.max(eh * s.open, ew * 0.28);
          ctx.beginPath();
          ctx.roundRect(-ew / 2, -hh / 2, ew, hh, Math.min(ew / 2, hh / 2));
          ctx.fill();
        }

        ctx.restore();
      }
      ctx.restore();

      ctx.restore(); // end Mochi body

      // 6. Floating Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          s.particles.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0, 1 - p.age / p.life);
        const px = cx + p.x + p.vx * p.age * 50;
        const py = cy + p.y + p.vy * p.age * 50;

        ctx.save();
        ctx.translate(px, py);
        ctx.globalAlpha = alpha;

        if (p.type === 'heart') {
          ctx.fillStyle = '#FF4D6D';
          const hs = p.size;
          ctx.beginPath();
          ctx.moveTo(0, hs * 0.38);
          ctx.bezierCurveTo(-hs * 1.05, -hs * 0.15, -hs * 0.5, -hs * 0.95, 0, -hs * 0.38);
          ctx.bezierCurveTo(hs * 0.5, -hs * 0.95, hs * 1.05, -hs * 0.15, 0, hs * 0.38);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'star') {
          ctx.fillStyle = '#F7B32B';
          const ro = p.size, ri = p.size * 0.45;
          ctx.beginPath();
          for (let j = 0; j < 10; j++) {
            const r = j % 2 ? ri : ro, a = -Math.PI / 2 + (j * Math.PI) / 5 + p.rot;
            const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore(); // end dpr scale

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size]);

  // Click "Boop" interaction
  const handleBoop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const s = stateRef.current;
    const now = Date.now();

    // Trigger spring squash
    s.isSquashing = true;
    s.squashStart = performance.now();

    // Cycle or pick random cute emote
    const emotes: EmoteType[] = ['heart', 'star', 'wink', 'happy', 'surprised'];
    const chosen = emotes[Math.floor(Math.random() * emotes.length)];
    s.emote = chosen;
    s.emoteUntil = now + 900;

    // Spawn floating particle
    if (chosen === 'heart') {
      s.particles.push({
        type: 'heart',
        x: (Math.random() - 0.5) * 30,
        y: -size * 0.28,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.8 - Math.random() * 0.5,
        age: 0,
        life: 0.9,
        rot: 0,
        size: 10 + Math.random() * 4,
      });
    } else if (chosen === 'star' || chosen === 'happy') {
      s.particles.push({
        type: 'star',
        x: (Math.random() - 0.5) * 35,
        y: -size * 0.25,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.7 - Math.random() * 0.4,
        age: 0,
        life: 0.85,
        rot: Math.random() * 3,
        size: 9 + Math.random() * 3,
      });
    }

    if (onClick) {
      onClick();
    }
  }, [onClick, size]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block cursor-pointer select-none transition-transform duration-200 active:scale-95 ${className}`}
      style={{ width: size, height: size }}
      onClick={handleBoop}
      onMouseEnter={() => {
        stateRef.current.isHovered = true;
      }}
      onMouseLeave={() => {
        stateRef.current.isHovered = false;
        stateRef.current.targetYaw = 0;
        stateRef.current.targetPitch = 0;
        stateRef.current.targetTilt = 0;
      }}
      role="button"
      tabIndex={0}
      aria-label={`Boop ${label}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBoop(e as any);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default CoucouMochi;
