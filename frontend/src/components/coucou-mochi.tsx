import React, { useEffect, useRef, useCallback } from 'react';

export type MochiStatus = 'idle' | 'typing' | 'thinking' | 'success';

export interface CoucouMochiProps {
  size?: number;
  className?: string;
  onClick?: () => void;
  label?: string;
  interactive?: boolean;
  status?: MochiStatus;
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

type EmoteType = 'idle' | 'heart' | 'star' | 'wink' | 'happy' | 'surprised' | 'dizzy' | 'delighted';

export function CoucouMochi({
  size = 140,
  className = '',
  onClick,
  label = 'Mochi Companion AI',
  interactive = true,
  status = 'idle',
}: CoucouMochiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cycle index for variety of emotes on each click
  const emoteCycleRef = useRef(0);

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
    currentStatus: status,
  });

  // Keep stateRef in sync with status prop
  useEffect(() => {
    stateRef.current.currentStatus = status;
    if (status === 'success') {
      stateRef.current.emote = 'delighted';
      stateRef.current.emoteUntil = Date.now() + 1600;
    }
  }, [status]);

  // Track cursor across window when idle
  useEffect(() => {
    if (!interactive) return;

    const handlePointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      // When thinking, Mochi looks up pensively, don't override with mouse
      if (s.currentStatus === 'thinking') return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      // Dead zone close to center
      if (dist < 35) {
        s.targetYaw = 0;
        s.targetPitch = 0;
        s.targetTilt = 0;
        return;
      }

      // Smooth normalized angles
      const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.55;
      const nx = Math.max(-1, Math.min(1, dx / maxDist));
      const ny = Math.max(-1, Math.min(1, dy / maxDist));

      s.targetYaw = nx * 0.52;
      s.targetPitch = -ny * 0.42; // pitch up when cursor above
      s.targetTilt = nx * 0.06;
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

      // 1. Status Overrides (Thinking / Typing / Idle)
      if (s.currentStatus === 'thinking') {
        // Looking up thoughtfully, soft inquisitive sway
        s.targetYaw = 0.42;
        s.targetPitch = 0.36;
        s.targetTilt = Math.sin(t * 3.2) * 0.08;
      } else if (s.currentStatus === 'typing') {
        // Listening / waiting posture: slight curious tilt towards input
        s.targetYaw = -0.22;
        s.targetPitch = -0.12;
        s.targetTilt = 0.14;
      }

      // 2. Lerp angles with smooth spring damping
      const kLook = 1 - Math.pow(0.0025, dt);
      s.yaw += (s.targetYaw - s.yaw) * kLook;
      s.pitch += (s.targetPitch - s.pitch) * kLook;
      s.tilt += (s.targetTilt - s.tilt) * kLook;

      // 3. Natural organic breathing (idle squash & stretch sine wave)
      const breatheSpeed = s.currentStatus === 'thinking' ? 3.2 : (s.currentStatus === 'typing' ? 2.6 : 2.0);
      const breathe = Math.sin(t * breatheSpeed) * 0.024;
      const floatY = Math.sin(t * 1.5) * 0.035;

      // 4. Blinking cycle
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

      // 5. Click boop squash animation with spring bounce
      let animScaleX = 1;
      let animScaleY = 1;
      if (s.isSquashing) {
        const elapsed = now - s.squashStart;
        if (elapsed < 440) {
          const progress = elapsed / 440;
          // Spring curve: squash down -> stretch up -> slight rebound -> rest
          const spring = Math.sin(progress * Math.PI * 3.5) * Math.exp(-progress * 4.2);
          animScaleX = 1 + spring * 0.24;
          animScaleY = 1 - spring * 0.28;
        } else {
          s.isSquashing = false;
        }
      }

      // Combine scales
      s.scaleX = (1 - breathe * 0.7) * animScaleX;
      s.scaleY = (1 + breathe) * animScaleY;

      // 6. Emote expiration -> smooth return to normal idle!
      if (s.emote !== 'idle' && now > s.emoteUntil) {
        s.emote = 'idle';
      }

      // Blush interpolation
      const targetBlush = s.isHovered 
        ? 0.65 
        : (s.emote === 'heart' ? 0.75 : (s.currentStatus === 'typing' ? 0.55 : 0.45));
      s.blush += (targetBlush - s.blush) * (1 - Math.pow(0.005, dt));

      // 7. Canvas Drawing (Coucou superellipsoid engine)
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
      // Slight soft lavender tint when thinking
      const topColor = s.currentStatus === 'thinking' ? '#FAF5FF' : '#FFFAF5';
      const botColor = s.currentStatus === 'thinking' ? '#D6C8E0' : '#DAC9BA';
      g.addColorStop(0, topColor);
      g.addColorStop(1, botColor);
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

        if (s.emote === 'happy' || s.emote === 'delighted') {
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

      // 8. Coucou Thinking Bubble (Animated Wave Dots)
      if (s.currentStatus === 'thinking') {
        const bx = cx - rx * 0.65;
        const by = cy - ry * 0.78 + Math.sin(t * 3) * 3;
        const bw = R * 0.72;
        const bh = R * 0.42;

        ctx.save();
        ctx.translate(bx, by);

        // Bubble Shadow
        ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
        ctx.shadowBlur = 10;

        // Bubble Background (Deep Navy / Violet border)
        ctx.fillStyle = '#0D1B2A';
        ctx.beginPath();
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
        ctx.fill();

        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Pointer triangle to Mochi's head
        ctx.beginPath();
        ctx.moveTo(bw * 0.15, bh * 0.35);
        ctx.lineTo(bw * 0.35, bh * 0.85);
        ctx.lineTo(bw * 0.35, bh * 0.35);
        ctx.fillStyle = '#0D1B2A';
        ctx.fill();

        // 3 Animated Bouncing Dots inside the bubble
        ctx.shadowBlur = 0;
        for (let i = 0; i < 3; i++) {
          const ph = ((t * 2.8 - i * 0.25) % 1 + 1) % 1;
          const bounce = Math.sin(ph * Math.PI) * 2.5;
          const dotR = R * 0.055;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc((i - 1) * R * 0.18, -bounce, dotR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // 9. Listening / Typing Badge (Curious single pulsing wave indicator)
      if (s.currentStatus === 'typing') {
        const bx = cx + rx * 0.65;
        const by = cy - ry * 0.72;
        const pulse = 1 + Math.sin(t * 4) * 0.18;

        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = '#D4AF37';
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.09, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // 10. Floating Particles (Hearts & Stars)
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

  // Click "Boop" interaction:
  // Shows emote + particles -> smoothly transitions back to normal idle!
  const handleBoop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const s = stateRef.current;
    const now = Date.now();

    // Trigger spring squash bounce
    s.isSquashing = true;
    s.squashStart = performance.now();

    // Cycle through adorable emotes so every click gives a delightful reaction
    const emotes: EmoteType[] = ['heart', 'star', 'wink', 'happy', 'delighted', 'surprised'];
    const chosen = emotes[emoteCycleRef.current % emotes.length];
    emoteCycleRef.current += 1;

    s.emote = chosen;
    // Emote lasts 1.3 seconds, then automatically returns to 'idle'!
    s.emoteUntil = now + 1300;

    // Spawn floating particle matching the emote
    if (chosen === 'heart') {
      s.particles.push({
        type: 'heart',
        x: (Math.random() - 0.5) * 32,
        y: -size * 0.28,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -0.85 - Math.random() * 0.5,
        age: 0,
        life: 0.95,
        rot: 0,
        size: 11 + Math.random() * 4,
      });
    } else if (chosen === 'star' || chosen === 'happy' || chosen === 'delighted') {
      s.particles.push({
        type: 'star',
        x: (Math.random() - 0.5) * 36,
        y: -size * 0.25,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.75 - Math.random() * 0.4,
        age: 0,
        life: 0.9,
        rot: Math.random() * 3,
        size: 10 + Math.random() * 3,
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
