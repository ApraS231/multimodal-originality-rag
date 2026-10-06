import React, { useState, useEffect, useRef, useCallback } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  animateOn?: 'mount' | 'hover';
}

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}|:"<>?[]\\;\',./',
  className = '',
  animateOn = 'mount',
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRevealing(true);

    const length = text.length;
    let iteration = 0;

    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration / maxIterations) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      if (iteration >= length * maxIterations) {
        setDisplayText(text);
        setIsRevealing(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }

      iteration++;
    }, speed);
  }, [text, maxIterations, characters, speed]);

  useEffect(() => {
    if (animateOn === 'mount') {
      startAnimation();
    } else {
      setDisplayText(text);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, animateOn, startAnimation]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover' && !isRevealing) {
      startAnimation();
    }
  };

  return (
    <span 
      className={`font-mono inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText || text}
    </span>
  );
}
