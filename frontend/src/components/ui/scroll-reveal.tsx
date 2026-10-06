import React, { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: React.ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement | Window | null>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
}

export default function ScrollReveal({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom'
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderContent = useMemo(() => {
    if (typeof children === 'string') {
      return children.split(/(\s+)/).map((word, index) => {
        if (word.match(/^\s+$/)) return word;
        return (
          <span className="word inline-block" key={index}>
            {word}
          </span>
        );
      });
    }
    // Jika children berupa JSX element/components, render apa adanya
    return children;
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;

    const ctx = gsap.context(() => {
      // 1. Animasi posisi/rotasi kontainer dengan inersia scrub halus
      if (baseRotation !== 0) {
        gsap.fromTo(
          el,
          { transformOrigin: '50% 50%', rotate: baseRotation, y: 15 },
          {
            ease: 'none',
            rotate: 0,
            y: 0,
            scrollTrigger: {
              trigger: el,
              scroller,
              start: 'top bottom-=10%',
              end: rotationEnd,
              scrub: 0.8
            }
          }
        );
      } else {
        gsap.fromTo(
          el,
          { y: 15 },
          {
            ease: 'none',
            y: 0,
            scrollTrigger: {
              trigger: el,
              scroller,
              start: 'top bottom-=10%',
              end: rotationEnd,
              scrub: 0.8
            }
          }
        );
      }

      const wordElements = el.querySelectorAll('.word');

      if (wordElements.length > 0) {
        // 2a. Gabungkan animasi opacity dan filter blur dalam satu tween terpadu (mencegah desinkronisasi & lag GPU)
        gsap.fromTo(
          wordElements,
          { 
            opacity: baseOpacity, 
            filter: enableBlur ? `blur(${blurStrength}px)` : 'none' 
          },
          {
            ease: 'none',
            opacity: 1,
            filter: 'blur(0px)',
            stagger: 0.04,
            scrollTrigger: {
              trigger: el,
              scroller,
              start: 'top bottom-=15%',
              end: wordAnimationEnd,
              scrub: 0.8
            }
          }
        );
      } else {
        // 2b. Animasi untuk element/bento cards secara utuh
        gsap.fromTo(
          el.children,
          { 
            opacity: baseOpacity, 
            filter: enableBlur ? `blur(${blurStrength}px)` : 'none' 
          },
          {
            ease: 'none',
            opacity: 1,
            filter: 'blur(0px)',
            scrollTrigger: {
              trigger: el,
              scroller,
              start: 'top bottom-=15%',
              end: wordAnimationEnd,
              scrub: 0.8
            }
          }
        );
      }
    }, el);

    // Refresh ScrollTrigger setelah font web dimuat untuk mencegah layout snapping
    if (document.fonts) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      });
    }

    return () => {
      ctx.revert();
    };
  }, [scrollContainerRef, enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength, children]);

  return (
    <div ref={containerRef} className={`scroll-reveal select-none my-5 ${containerClassName}`}>
      <div className={`scroll-reveal-text ${textClassName}`}>
        {renderContent}
      </div>
    </div>
  );
}
