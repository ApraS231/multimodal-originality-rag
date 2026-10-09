import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CoucouMochi, type MochiStatus } from './coucou-mochi';
import { X } from 'lucide-react';

interface MochiPosition {
  x: number;
  y: number;
}

const MOCHI_SIZE = 130;
const STORAGE_KEY = 'veritas_landing_mochi_state';

// Dialog ringkas, manis, dan ramah akademis STITEK
const MOCHI_DIALOGUES = [
  "Halo! Aku Mochi, pemandu orisinalitasmu 🪽",
  "Sayapku siap membantumu terbang bebas dari plagiarisme! ✨",
  "Veritas memadukan pgvector dan RRF multi-modal lho!",
  "Setiap baris kode yang kamu tulis sendiri bernilai tinggi! 💻",
  "Semangat untuk naskah praktikum dan tugas akhirnya ya! 🎓",
  "Klik aku untuk menyapa dan melihat kepakan sayapku! 🪽",
  "Integritas akademik adalah kebanggaan sivitas STITEK! 🏛️"
];

export function WingedMochiLanding() {
  // Posisi Mochi (dapat digeser secara bebas & menempel di tepi layar)
  const [pos, setPos] = useState<MochiPosition>(() => {
    if (typeof window === 'undefined') return { x: 100, y: 300 };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.min(window.innerWidth - MOCHI_SIZE - 20, Math.max(20, parsed.x)),
            y: Math.min(window.innerHeight - MOCHI_SIZE - 20, Math.max(80, parsed.y))
          };
        }
      } catch {}
    }
    // Posisi default awal di pojok kanan bawah
    return {
      x: Math.max(20, window.innerWidth - MOCHI_SIZE - 24),
      y: Math.max(80, window.innerHeight - MOCHI_SIZE - 32)
    };
  });

  // State bubble chat (default tersembunyi agar tidak menutupi tampilan)
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [mochiStatus, setMochiStatus] = useState<MochiStatus>('idle');

  // Timers
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    moved: false
  });

  // 1. Sapaan pertama: Muncul sekali secara halus setelah 8 detik, lalu otomatis hilang dalam 4.5 detik
  useEffect(() => {
    const initialGreeting = setTimeout(() => {
      setDialogueIndex(0);
      setIsBubbleOpen(true);

      autoCloseTimerRef.current = setTimeout(() => {
        setIsBubbleOpen(false);
      }, 4500);
    }, 8000);

    return () => {
      clearTimeout(initialGreeting);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  // 2. Kemunculan periodik dibuat JARANG (setiap 75 detik), dan langsung hilang otomatis setelah 4 detik
  useEffect(() => {
    const rareInterval = setInterval(() => {
      setDialogueIndex(prev => (prev + 1) % MOCHI_DIALOGUES.length);
      setIsBubbleOpen(true);

      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        setIsBubbleOpen(false);
      }, 4200);
    }, 75000); // 75 detik (jarang)

    return () => clearInterval(rareInterval);
  }, []);

  // Handle window resize agar Mochi tetap di dalam area layar
  useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: Math.min(window.innerWidth - MOCHI_SIZE - 20, Math.max(20, prev.x)),
        y: Math.min(window.innerHeight - MOCHI_SIZE - 20, Math.max(80, prev.y))
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const savePosition = (newX: number, newY: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: newX, y: newY }));
    } catch {}
  };

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.mochi-bubble-content')) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
      moved: false
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const nextX = Math.max(16, Math.min(window.innerWidth - MOCHI_SIZE - 16, dragRef.current.initX + dx));
    const nextY = Math.max(70, Math.min(window.innerHeight - MOCHI_SIZE - 16, dragRef.current.initY + dy));
    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Snap halus ke tepi terdekat
    const isCloserToLeft = pos.x < window.innerWidth / 2;
    const snapMargin = 24;
    const finalX = isCloserToLeft ? snapMargin : window.innerWidth - MOCHI_SIZE - snapMargin;
    
    setPos(prev => {
      savePosition(finalX, prev.y);
      return { x: finalX, y: prev.y };
    });

    // Jika hanya klik biasa tanpa drag, picu aksi interaksi
    if (!dragRef.current.moved) {
      handleMochiClick();
    }
  };

  // Interaksi klik pada Mochi: memunculkan pesan singkat lalu otomatis hilang
  const handleMochiClick = useCallback(() => {
    setDialogueIndex(prev => (prev + 1) % MOCHI_DIALOGUES.length);
    setIsBubbleOpen(true);
    setMochiStatus('success');

    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      setIsBubbleOpen(false);
      setMochiStatus('idle');
    }, 4500);
  }, []);

  const currentDialogue = MOCHI_DIALOGUES[dialogueIndex];
  const isDockedLeft = pos.x < window.innerWidth / 2;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 90,
        touchAction: 'none',
      }}
      className={`select-none transition-shadow ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 1. BUBBLE CHAT MINIMALIS & RINGKAS (Auto-fades & non-obtrusive) */}
      {isBubbleOpen && (
        <div
          className={`mochi-bubble-content absolute z-20 pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95 ${
            isDockedLeft 
              ? 'left-full ml-3 top-1/2 -translate-y-1/2' 
              : 'right-full mr-3 top-1/2 -translate-y-1/2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl px-3.5 py-2.5 shadow-md text-[#0D1B2A] relative max-w-[220px] flex items-start gap-2">
            <p className="text-[11.5px] font-sans text-stone-800 leading-snug flex-1 select-none">
              {currentDialogue}
            </p>
            <button
              type="button"
              onClick={() => setIsBubbleOpen(false)}
              className="text-stone-400 hover:text-stone-600 p-0.5 -mr-1 -mt-0.5 rounded cursor-pointer transition-colors"
              title="Tutup"
            >
              <X className="w-3 h-3" />
            </button>

            {/* Ekor Balon Penunjuk */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white/95 border-stone-200/90 rotate-45 ${
                isDockedLeft 
                  ? '-left-1 border-l border-b' 
                  : '-right-1 border-r border-t'
              }`}
            />
          </div>
        </div>
      )}

      {/* 2. KARAKTER MOCHI BERSAYAP CANVAS */}
      <div className="relative group">
        {/* Efek Aura Halus */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-200/25 via-white/40 to-sky-200/25 blur-md group-hover:scale-110 transition-transform pointer-events-none" />

        <CoucouMochi
          size={MOCHI_SIZE}
          hasWings={true}
          interactive={true}
          status={mochiStatus}
          label="Mochi Veritas Bersayap"
          className="filter drop-shadow-md transition-transform duration-200 group-hover:scale-105"
        />
      </div>
    </div>
  );
}

export default WingedMochiLanding;
