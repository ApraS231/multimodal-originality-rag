import React, { useEffect, useState, useRef, useCallback } from 'react';

interface ScrambleTextProps {
  text: string;
  className?: string;
  chars?: string;
  autoStart?: boolean;
  intervalTrigger?: number; // optional periodic re-scramble in ms
  onComplete?: () => void;
}

const DEFAULT_CHARS = 'X0101984_!#%&?=/*+~^<>{}[]ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ScrambleText: React.FC<ScrambleTextProps> = ({
  text,
  className = '',
  chars = DEFAULT_CHARS,
  autoStart = true,
  intervalTrigger,
  onComplete,
}) => {
  const [displayText, setDisplayText] = useState(text);
  const isAnimatingRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const scramble = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const length = text.length;
    let iteration = 0;
    const maxIterations = length * 3.5;

    const tick = () => {
      iteration += 1;
      const progress = iteration / maxIterations;
      const resolvedIndex = Math.floor(progress * length);

      let scrambled = '';
      for (let i = 0; i < length; i++) {
        if (text[i] === ' ' || text[i] === '\n') {
          scrambled += text[i];
        } else if (i < resolvedIndex) {
          scrambled += text[i];
        } else {
          const randomIndex = Math.floor(Math.random() * chars.length);
          scrambled += chars[randomIndex];
        }
      }

      setDisplayText(scrambled);

      if (iteration < maxIterations) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayText(text);
        isAnimatingRef.current = false;
        if (onComplete) onComplete();
      }
    };

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);
  }, [text, chars, onComplete]);

  useEffect(() => {
    if (autoStart) {
      // Sedikit jeda 250ms saat inisialisasi agar transisi terlihat jelas
      const timer = setTimeout(() => {
        scramble();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoStart, scramble]);

  useEffect(() => {
    if (!intervalTrigger) return;
    const interval = setInterval(() => {
      scramble();
    }, intervalTrigger);
    return () => clearInterval(interval);
  }, [intervalTrigger, scramble]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <span
      className={`inline-block select-none cursor-pointer transition-colors ${className}`}
      onClick={scramble}
      onMouseEnter={scramble}
      role="text"
      aria-label={text}
      title="Klik untuk mengacak teks"
    >
      {displayText}
    </span>
  );
};

export default ScrambleText;
