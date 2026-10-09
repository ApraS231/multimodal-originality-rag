import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CoucouMochi, type MochiStatus } from './coucou-mochi';
import { 
  Sparkles, 
  ArrowRight, 
  Compass, 
  Heart, 
  X, 
  Moon, 
  Sun,
  MessageCircle,
  Volume2
} from 'lucide-react';

interface MochiPosition {
  x: number;
  y: number;
}

const MOCHI_SIZE = 135;
const STORAGE_KEY = 'veritas_landing_mochi_state';

// Daftar dialog interaktif bernuansa ramah, ceria, dan akademis STITEK Bontang
const MOCHI_DIALOGUES = [
  {
    text: "Halo! Aku Mochi Bersayap, maskot pendamping orisinalitas di STITEK Bontang! 🪽",
    tag: "Salam Veritas",
    mood: "happy" as const
  },
  {
    text: "Sayapku siap membantumu terbang bebas dari plagiarisme! Kejujuran karyamu bernilai tinggi lho.",
    tag: "Integritas",
    mood: "star" as const
  },
  {
    text: "Tahukah kamu? Veritas memadukan pgvector dan RRF untuk menganalisis kode dan dokumen multi-modal!",
    tag: "Fakta Teknologi",
    mood: "thinking" as const
  },
  {
    text: "Klik aku lagi dong! *kepak-kepak sayap* Aku suka menemani mahasiswa dan dosen menyusun karya ilmiah~",
    tag: "Interaksi",
    mood: "delighted" as const
  },
  {
    text: "Siap menguji orisinalitas naskah praktikummu? Klik tombol 'Masuk Portal' di atas ya!",
    tag: "Pemandu",
    mood: "wink" as const
  },
  {
    text: "Diagram alir, naskah PDF, sampai formula matematika LaTeX bisa dievaluasi bareng di sini!",
    tag: "Fitur Unggulan",
    mood: "star" as const
  },
  {
    text: "Elus aku lagi~ *blush* Semangat ya buat yang lagi bimbingan atau kejar deadline laporan praktikum!",
    tag: "Semangat Mahasiswa",
    mood: "heart" as const
  },
  {
    text: "Setiap baris kode yang kamu tulis sendiri adalah langkah nyata menjadi insinyur unggul STITEK!",
    tag: "Motivasi",
    mood: "happy" as const
  }
];

export function WingedMochiLanding() {
  const navigate = useNavigate();

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
    // Posisi awal default di pojok kanan bawah
    return {
      x: Math.max(20, window.innerWidth - MOCHI_SIZE - 24),
      y: Math.max(80, window.innerHeight - MOCHI_SIZE - 32)
    };
  });

  // State interaksi
  const [isBubbleOpen, setIsBubbleOpen] = useState(true);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [mochiStatus, setMochiStatus] = useState<MochiStatus>('idle');
  const [isSleeping, setIsSleeping] = useState(false);
  const [petCount, setPetCount] = useState(0);
  const [petHeartVisible, setPetHeartVisible] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    moved: false
  });

  // Timer rotasi dialog otomatis (jika pengguna idle)
  useEffect(() => {
    if (isSleeping) return;
    const interval = setInterval(() => {
      setDialogueIndex(prev => (prev + 1) % MOCHI_DIALOGUES.length);
    }, 14000);
    return () => clearInterval(interval);
  }, [isSleeping]);

  // Handle window resize agar Mochi tidak keluar batas layar
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

  // Simpan posisi ke localStorage
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

    // Snap halus ke tepi terdekat jika dilepas di area tengah
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

  // Interaksi klik pada Mochi
  const handleMochiClick = useCallback(() => {
    if (isSleeping) {
      setIsSleeping(false);
      setIsBubbleOpen(true);
      setMochiStatus('success');
      setTimeout(() => setMochiStatus('idle'), 1200);
      return;
    }

    // Ubah ke dialog berikutnya
    setDialogueIndex(prev => (prev + 1) % MOCHI_DIALOGUES.length);
    setIsBubbleOpen(true);

    // Reaksi animasi Mochi
    setMochiStatus('success');
    setTimeout(() => setMochiStatus('idle'), 1300);
  }, [isSleeping]);

  // Aksi elus Mochi (Pet Mochi)
  const handlePetMochi = () => {
    setPetCount(prev => prev + 1);
    setPetHeartVisible(true);
    setMochiStatus('success');
    setTimeout(() => setPetHeartVisible(false), 900);
    setTimeout(() => setMochiStatus('idle'), 1400);
  };

  // Scroll halus ke fitur di Landing Page
  const handleScrollToFeatures = () => {
    const el = document.getElementById('fitur-utama') || document.querySelector('.hero-window-img');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    }
  };

  const currentDialogue = MOCHI_DIALOGUES[dialogueIndex];
  const isDockedLeft = pos.x < window.innerWidth / 2;

  // Jika sedang dalam mode tidur/tuck-away di tepi layar
  if (isSleeping) {
    return (
      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 90,
          touchAction: 'none',
        }}
        className="select-none cursor-pointer"
        onClick={() => {
          setIsSleeping(false);
          setIsBubbleOpen(true);
        }}
        title="Klik untuk membangunkan Mochi Bersayap"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-[#D4AF37]/50 shadow-lg backdrop-blur-md hover:scale-105 transition-all text-[#0D1B2A] text-xs font-semibold">
          <span className="text-base animate-pulse">🪽</span>
          <span className="text-[11px] font-mono text-slate-700">Mochi Tidur (Zzz)</span>
          <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
      </div>
    );
  }

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
      {/* 1. BUBBLE DIALOG INTERAKTIF */}
      {isBubbleOpen && (
        <div
          className={`mochi-bubble-content absolute z-20 w-72 sm:w-80 pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95 ${
            isDockedLeft 
              ? 'left-full ml-3 top-1/2 -translate-y-1/2' 
              : 'right-full mr-3 top-1/2 -translate-y-1/2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl p-4 shadow-xl text-[#0D1B2A] relative space-y-2.5">
            {/* Header Bubble */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🪽</span>
                <span className="text-xs font-bold font-sans text-stone-900">Mochi Veritas</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                  {currentDialogue.tag}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSleeping(true)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  title="Istirahatkan Mochi"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsBubbleOpen(false)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  title="Tutup Balon Percakapan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Isi Teks Percakapan */}
            <p className="text-xs font-sans text-stone-700 leading-relaxed font-normal min-h-[38px]">
              "{currentDialogue.text}"
            </p>

            {/* Tombol Aksi Cepat Interaktif */}
            <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={handlePetMochi}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Beri elusan sayang ke Mochi"
              >
                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                <span>Elus Mochi {petCount > 0 ? `(${petCount})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={handleScrollToFeatures}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-all hover:scale-105 cursor-pointer"
              >
                <Compass className="w-3 h-3 text-[#D4AF37]" />
                <span>Cek Fitur</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D1B2A] hover:bg-[#1B263B] text-white font-medium transition-all hover:scale-105 cursor-pointer ml-auto"
              >
                <span>Masuk</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Ekor Balon Penunjuk */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white/95 border-stone-200/90 rotate-45 ${
                isDockedLeft 
                  ? '-left-1.5 border-l border-b' 
                  : '-right-1.5 border-r border-t'
              }`}
            />
          </div>
        </div>
      )}

      {/* 2. KARAKTER MOCHI BERSAYAP CANVAS */}
      <div className="relative group">
        {/* Efek Aura Lembut di Belakang Mochi */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-200/30 via-white/50 to-sky-200/30 blur-md group-hover:scale-110 transition-transform pointer-events-none" />

        {/* Notifikasi Cinta saat Dielus (Petting Hearts) */}
        {petHeartVisible && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none animate-bounce text-rose-500 text-lg flex items-center gap-1 font-bold">
            ❤️ <span className="text-xs text-rose-600 font-mono">+Love</span>
          </div>
        )}

        {/* Komponen Mochi Canvas dengan Sayap Aktif */}
        <CoucouMochi
          size={MOCHI_SIZE}
          hasWings={true}
          interactive={true}
          status={mochiStatus}
          label="Mochi Veritas Bersayap"
          className="filter drop-shadow-md transition-transform duration-200 group-hover:scale-105"
        />

        {/* Badge Tombol Sapaan Mini (jika bubble tertutup) */}
        {!isBubbleOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsBubbleOpen(true);
            }}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-white/90 border border-stone-200 shadow-md text-[10px] font-mono text-stone-700 flex items-center gap-1 hover:bg-stone-50 cursor-pointer pointer-events-auto"
            title="Ajak Mochi Bicara"
          >
            <MessageCircle className="w-2.5 h-2.5 text-amber-500" />
            <span>Sapa</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default WingedMochiLanding;
