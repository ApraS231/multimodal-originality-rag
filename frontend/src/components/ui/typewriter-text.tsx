import { useEffect, useState, useRef, useMemo } from 'react';

export interface TypewriterTextProps {
  words: string[] | string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
  cursor?: boolean;
  cursorChar?: string;
  cursorClassName?: string;
  className?: string;
  onComplete?: () => void;
}

/**
 * TypewriterText - Ultra-smooth, zero-glitch typewriter animation component.
 * Renders characters with natural pacing, optional backspacing cycle, and blinking cursor.
 */
export default function TypewriterText({
  words,
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseDuration = 2400,
  loop = true,
  cursor = true,
  cursorChar = '|',
  cursorClassName = 'text-[#D4AF37] animate-pulse ml-0.5',
  className = '',
  onComplete
}: TypewriterTextProps) {
  const wordsKey = Array.isArray(words) ? words.join('|') : String(words);
  const wordList = useMemo(() => {
    return Array.isArray(words) ? words : [words];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordsKey]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (wordList.length === 0) return;

    const currentWord = wordList[currentWordIndex % wordList.length];

    if (!isDeleting) {
      // Typing phase
      if (currentText.length < currentWord.length) {
        timerRef.current = setTimeout(() => {
          setCurrentText(currentWord.slice(0, currentText.length + 1));
        }, typingSpeed);
      } else {
        // Word completely typed
        if (!loop && currentWordIndex === wordList.length - 1) {
          if (onComplete) onComplete();
          return;
        }
        timerRef.current = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDuration);
      }
    } else {
      // Deleting / Backspacing phase
      if (currentText.length > 0) {
        timerRef.current = setTimeout(() => {
          setCurrentText(currentWord.slice(0, currentText.length - 1));
        }, deletingSpeed);
      } else {
        // Word cleared, move to next word
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % wordList.length);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentText, isDeleting, currentWordIndex, wordList, typingSpeed, deletingSpeed, pauseDuration, loop, onComplete]);

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span>{currentText}</span>
      {cursor && (
        <span 
          aria-hidden="true"
          className={`select-none ${cursorClassName}`}
        >
          {cursorChar ? cursorChar : null}
        </span>
      )}
    </span>
  );
}
