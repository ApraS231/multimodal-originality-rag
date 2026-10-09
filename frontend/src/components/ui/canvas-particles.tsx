import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number; // depth
  radius: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  rotationSpeed: number;
  color: string;
  shape: 'circle' | 'pill' | 'diamond' | 'cross';
  baseAlpha: number;
}

interface CanvasParticlesProps {
  className?: string;
  particleCountMobile?: number;
  particleCountDesktop?: number;
}

const PALETTE = [
  '#D4AF37', // Gold / Champagne
  '#38BDF8', // Cyan Glow
  '#818CF8', // Indigo
  '#34D399', // Emerald
  '#F7F3E9', // Warm White
  '#415A77', // Soft Slate
];

export const CanvasParticles: React.FC<CanvasParticlesProps> = ({
  className = '',
  particleCountMobile = 36,
  particleCountDesktop = 75,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const isMobile = window.innerWidth < 768;
    const count = isMobile ? particleCountMobile : particleCountDesktop;

    // Mouse / Touch pointer interaction coordinates
    const pointer = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      isInteracting: false,
    };

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize particles
    const shapes: ('circle' | 'pill' | 'diamond' | 'cross')[] = ['circle', 'pill', 'diamond', 'cross'];
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 0.8 + 0.2, // scale factor from depth
        radius: (Math.random() * 8 + 4),
        vx: (Math.random() - 0.5) * (isMobile ? 0.4 : 0.7),
        vy: (Math.random() - 0.5) * (isMobile ? 0.4 : 0.7),
        vz: (Math.random() - 0.5) * 0.002,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        baseAlpha: Math.random() * 0.55 + 0.25,
      });
    }

    // Pointer events (Desktop hover & Mobile touch swipe)
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      pointer.targetX = clientX - rect.left;
      pointer.targetY = clientY - rect.top;
      pointer.isInteracting = true;
    };

    const onPointerLeave = () => {
      pointer.isInteracting = false;
      pointer.targetX = -1000;
      pointer.targetY = -1000;
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerLeave);

    // Render loop
    const render = () => {
      // Smooth pointer interpolation
      pointer.x += (pointer.targetX - pointer.x) * 0.1;
      pointer.y += (pointer.targetY - pointer.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle connecting constellation lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = isMobile ? 85 : 120;

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12 * particles[i].z;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Interaction gravitational / repulsive swirl
        if (pointer.isInteracting) {
          const pdx = p.x - pointer.x;
          const pdy = p.y - pointer.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          const forceRadius = isMobile ? 120 : 180;

          if (pdist < forceRadius && pdist > 0) {
            const force = (1 - pdist / forceRadius) * (isMobile ? 1.5 : 2.5);
            p.vx += (pdx / pdist) * force * 0.15;
            p.vy += (pdy / pdist) * force * 0.15;
          }
        }

        // Apply friction
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Move particle
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.rotationSpeed;
        p.z += p.vz;
        if (p.z > 1.2 || p.z < 0.2) p.vz = -p.vz;

        // Wrap around boundaries
        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;
        if (p.y < -30) p.y = height + 30;
        if (p.y > height + 30) p.y = -30;

        // Draw shape with depth scale
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(p.z, p.z);
        ctx.globalAlpha = p.baseAlpha * p.z;
        ctx.fillStyle = p.color;

        const r = p.radius;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'pill') {
          // Pill capsule shape
          const w = r * 2.2;
          const h = r * 1.1;
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
          ctx.fill();
        } else if (p.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -r * 1.3);
          ctx.lineTo(r * 1.3, 0);
          ctx.lineTo(0, r * 1.3);
          ctx.lineTo(-r * 1.3, 0);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'cross') {
          const arm = r * 1.2;
          const thick = r * 0.45;
          ctx.fillRect(-thick / 2, -arm, thick, arm * 2);
          ctx.fillRect(-arm, -thick / 2, arm * 2, thick);
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerLeave);
    };
  }, [particleCountMobile, particleCountDesktop]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
};

export default CanvasParticles;
