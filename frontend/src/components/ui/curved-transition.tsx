import { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';

export type TransitionMode = 
  | 'enter-from-right' 
  | 'reveal-to-left' 
  | 'enter-from-left' 
  | 'reveal-to-right';

interface CurvedTransitionProps {
  mode: TransitionMode;
  duration?: number;
  color?: string;
  onComplete?: () => void;
}

/**
 * Helper to compute continuous C1 S-curve doublet paths for both fill polygon and glowing crest stroke.
 * - Tangents at Y=0, Y=50, and Y=100 are strictly vertical (0, 1) ensuring zero kinks or screen edge glitches.
 * - Fill path has NO stroke (avoiding borders along screen top/bottom/sides).
 * - Stroke path traces ONLY the curved wavefront with non-scaling-stroke for uniform 2.5px crispness.
 */
function computePaths(mode: TransitionMode, p: number): { fillPath: string; strokePath: string } {
  // Bulge peaks at p = 0.5 (halfway across the screen), max bulge = 18 units (18% viewport width)
  const bulge = Math.sin(p * Math.PI) * 18;

  if (mode === 'enter-from-right') {
    // Leading edge moves from X=100 to X=0 (moving leftwards, bulging leftwards)
    const xEdge = 100 - p * 100;
    const xCurve = Math.max(-5, xEdge - bulge);
    return {
      fillPath: `M 100 0 L ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100 L 100 100 Z`,
      strokePath: `M ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100`,
    };
  }

  if (mode === 'reveal-to-left') {
    // Trailing edge moves from X=100 to X=0 (curtain shrinks towards X=0, uncovering the right)
    const xEdge = 100 - p * 100;
    const xCurve = Math.max(-5, xEdge - bulge);
    return {
      fillPath: `M 0 0 L ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100 L 0 100 Z`,
      strokePath: `M ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100`,
    };
  }

  if (mode === 'enter-from-left') {
    // Leading edge moves from X=0 to X=100 (moving rightwards, bulging rightwards)
    const xEdge = p * 100;
    const xCurve = Math.min(105, xEdge + bulge);
    return {
      fillPath: `M 0 0 L ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100 L 0 100 Z`,
      strokePath: `M ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100`,
    };
  }

  if (mode === 'reveal-to-right') {
    // Trailing edge moves from X=0 to X=100 (curtain shrinks towards X=100, uncovering the left)
    const xEdge = p * 100;
    const xCurve = Math.min(105, xEdge + bulge);
    return {
      fillPath: `M 100 0 L ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100 L 100 100 Z`,
      strokePath: `M ${xEdge} 0 C ${xEdge} 25, ${xCurve} 25, ${xCurve} 50 C ${xCurve} 75, ${xEdge} 75, ${xEdge} 100`,
    };
  }

  return { fillPath: '', strokePath: '' };
}

export default function CurvedTransition({
  mode,
  duration = 0.75,
  color = '#0D1B2A',
  onComplete
}: CurvedTransitionProps) {
  const fillPathRef = useRef<SVGPathElement>(null);
  const strokePathRef = useRef<SVGPathElement>(null);

  // Initial path at p=0 for seamless first-frame painting (eliminates white flashes on mount)
  const initialPaths = useMemo(() => computePaths(mode, 0), [mode]);

  useEffect(() => {
    const fillEl = fillPathRef.current;
    const strokeEl = strokePathRef.current;
    if (!fillEl || !strokeEl) return;

    const progressObj = { value: 0 };

    // Set initial paths synchronously
    const init = computePaths(mode, 0);
    fillEl.setAttribute('d', init.fillPath);
    strokeEl.setAttribute('d', init.strokePath);

    const tween = gsap.to(progressObj, {
      value: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        const { fillPath, strokePath } = computePaths(mode, progressObj.value);
        fillEl.setAttribute('d', fillPath);
        strokeEl.setAttribute('d', strokePath);
      },
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });

    return () => {
      tween.kill();
    };
  }, [mode, duration, onComplete]);

  return (
    <svg 
      className="fixed inset-0 w-full h-full z-[9999] pointer-events-auto select-none overflow-hidden"
      viewBox="0 0 100 100" 
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="curve-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#D4AF37" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* 1. Solid Dark Curtain Fill (stroke="none" prevents edge border lines) */}
      <path 
        ref={fillPathRef} 
        d={initialPaths.fillPath}
        fill={color} 
        stroke="none"
      />

      {/* 2. Academic Blue Crest Wave Line */}
      <path 
        ref={strokePathRef} 
        d={initialPaths.strokePath}
        fill="none" 
        stroke="#D4AF37"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        filter="url(#curve-glow)"
      />
    </svg>
  );
}
