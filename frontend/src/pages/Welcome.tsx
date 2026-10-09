import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession, useLogout } from '../api/auth';
import { 
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard, 
  Bot, 
  Layers, 
  ChevronDown,
  LogOut,
  ShieldCheck,
  Check,
  FileText,
  BookOpen
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CurvedTransition from '../components/ui/curved-transition';
import { Logo } from '../components/ui/logo';

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const logoutMutation = useLogout();

  // Reference container untuk GSAP context
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // State menu dropdown profil pengguna di floating navbar
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // State scroll navbar untuk estetika dinamis
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Menutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  // Membaca state transisi Curved Wipe Back (Kembali dari Login)
  const triggerSwipeOutBack = location.state?.triggerSwipeOutBack === true;
  const [renderSwipeOverlayBack, setRenderSwipeOverlayBack] = useState(triggerSwipeOutBack);

  const [isSwiping, setIsSwiping] = useState(false);
  const [targetPathToNavigate, setTargetPathToNavigate] = useState<string | null>(null);

  useEffect(() => {
    if (triggerSwipeOutBack) {
      window.scrollTo(0, 0);
    }
  }, [triggerSwipeOutBack]);

  // =========================================================================
  // GSAP STORY SCROLLING ANIMATION SYSTEM
  // =========================================================================
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // 1. Reading Story Progress Bar (Bar Kemajuan Cerita di Bagian Atas)
      if (progressBarRef.current) {
        gsap.to(progressBarRef.current, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: document.documentElement,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.2,
          },
        });
      }

      // 2. Parallax Halus Bingkai Jendela Hero & Judul VERITAS (Window Depth Effect)
      gsap.to('.hero-window-img', {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-window-container',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      gsap.to('.hero-window-title', {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-window-container',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      // 3. Sequential Reveal Hero Headline & Narrative
      gsap.from('.story-reveal-hero', {
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#manifesto-section',
          start: 'top 85%',
          toggleActions: 'play none none none',
          once: true,
        },
      });

      // 4. Parallax Spanduk Perpustakaan & Animasi Teks Naskah
      gsap.to('.library-banner-img', {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: {
          trigger: '.library-banner-container',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
        },
      });

      gsap.from('.library-banner-text', {
        y: 35,
        opacity: 0,
        duration: 0.9,
        stagger: 0.14,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.library-banner-container',
          start: 'top 75%',
          toggleActions: 'play none none none',
          once: true,
        },
      });

      // 6. Cascade Muncul Berurutan Baris Tabel Ledger Direktori
      gsap.from('.ledger-row', {
        y: 22,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '#archive-section',
          start: 'top 80%',
          toggleActions: 'play none none none',
          once: true,
        },
      });

      // 7. Reveal Penutup Monumental & Tombol CTA
      gsap.from('.story-reveal-closing', {
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#closing-section',
          start: 'top 82%',
          toggleActions: 'play none none none',
          once: true,
        },
      });

      // 8. Parallax Mengambang Ghost Watermark "VERITAS"
      gsap.to('.ghost-watermark', {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: '#closing-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });

    }, mainContainerRef);

    return () => ctx.revert();
  }, []);

  const startSwipeAndNavigate = (targetPath: string) => {
    if (isSwiping) return;
    setTargetPathToNavigate(targetPath);
    setIsSwiping(true);
  };

  const handleActionClick = () => {
    if (session?.user) {
      const role = (session.user.role || session.user.profil?.peran || '').toUpperCase();
      if (role === 'ADMIN') startSwipeAndNavigate('/admin/dashboard');
      else if (role === 'ASLAB') startSwipeAndNavigate('/aslab/dashboard');
      else if (role === 'KEPALA_LAB') startSwipeAndNavigate('/kepala-lab/dashboard');
      else startSwipeAndNavigate('/admin/dashboard');
    } else {
      startSwipeAndNavigate('/login');
    }
  };

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-[#FAF9F6] text-[#0D1B2A] relative font-sans overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-[#0D1B2A]">
      
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* STORY SCROLLING PROGRESS BAR (Hairline Top Reading Indicator)             */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div 
        ref={progressBarRef}
        className="fixed top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#D4AF37] via-[#0D1B2A] to-[#D4AF37] z-50 origin-left scale-x-0 pointer-events-none"
      />

      {/* Background Soft Atmospheric Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-stone-200/40 via-stone-100/20 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[35%] right-[5%] w-[400px] h-[400px] bg-[#D4AF37]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[5%] w-[450px] h-[450px] bg-[#415A77]/5 blur-[140px] rounded-full" />
      </div>

      {/* ========================================================================= */}
      {/* 1. FLOATING PILL NAVBAR (Clean Minimal Light Mode Capsule)                 */}
      {/* ========================================================================= */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-40 w-[min(94%,920px)] select-none">
        <div className={`transition-all duration-300 text-[#0D1B2A] border border-stone-200/80 backdrop-blur-xl rounded-full px-4 sm:px-6 py-2.5 shadow-[0_8px_30px_rgba(13,27,42,0.06)] flex items-center justify-between ${
          isScrolled ? 'bg-white/95 shadow-[0_12px_36px_rgba(13,27,42,0.1)]' : 'bg-white/85'
        }`}>
          
          {/* Sisi Kiri: Brand Logo & Title */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <Logo size={24} variant="transparent" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-wider text-[#0D1B2A] group-hover:text-[#415A77] transition-colors">VERITAS</span>
              <span className="hidden sm:inline text-[10px] font-mono text-[#415A77]/60 tracking-wider">• STITEK</span>
            </div>
          </div>

          {/* Tengah: Navigasi Tautan Halus (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-[12px] text-[#415A77] font-medium">
            <button 
              type="button"
              onClick={() => scrollToSection('manifesto-section')}
              className="hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Tentang
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('archive-section')}
              className="hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Arsip Modul
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('closing-section')}
              className="hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Institusi
            </button>
          </nav>

          {/* Sisi Kanan: Action Button / User Profile Dropdown */}
          <div className="flex items-center gap-2">
            {session?.user ? (
              <div className="relative" ref={profileDropdownRef}>
                <button 
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-full transition-all cursor-pointer"
                >
                  <div className="w-5 h-5 bg-[#0D1B2A] text-[#D4AF37] rounded-full flex items-center justify-center text-[10px] font-bold">
                    {session.user.nama ? session.user.nama[0].toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-semibold text-[#0D1B2A] max-w-[90px] truncate">
                    {session.user.nama}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-[#415A77] transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-stone-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3.5 py-2 border-b border-stone-100">
                      <p className="text-xs font-bold text-[#0D1B2A] truncate">{session.user.nama}</p>
                      <p className="text-[10px] text-[#D4AF37] font-mono mt-0.5">
                        {session.user.role || session.user.profil?.peran || 'ASLAB'}
                      </p>
                    </div>
                    <div className="p-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          handleActionClick();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#0D1B2A] hover:bg-stone-100 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Panel Dasbor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          logoutMutation.mutate();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar Sesi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleActionClick}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0D1B2A] hover:bg-[#152238] text-[#F7F3E9] rounded-full text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <span>Masuk</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`relative z-10 w-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isSwiping ? 'scale-[0.985] opacity-80 filter blur-[0.3px]' : 'scale-100 opacity-100'
      }`}>

        {/* ========================================================================= */}
        {/* 2. HERO SECTION (Architectural Arched Window Frame + Giant Statement)   */}
        {/* ========================================================================= */}
        <section className="pt-28 sm:pt-32 pb-16 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto flex flex-col gap-10">
          
          {/* Eyebrow Label */}
          <div className="flex items-center justify-between text-[11px] font-mono text-[#415A77]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <span className="font-bold tracking-[0.25em] text-[#0D1B2A] uppercase">
                STUDIO ANALISIS ORISINALITAS • STITEK BONTANG
              </span>
            </div>
            <span className="hidden sm:inline font-mono tracking-wider text-stone-500">
              SESI AKADEMIK 2026
            </span>
          </div>

          {/* Top Architectural Window Visual Frame dengan Tipografi VERITAS */}
          <div className="hero-window-container relative w-full rounded-3xl sm:rounded-[2.5rem] overflow-hidden border border-stone-200/90 shadow-[0_20px_50px_rgba(13,27,42,0.08)] bg-stone-100 group">
            <div className="aspect-[16/10] sm:aspect-[21/9] w-full relative overflow-hidden flex items-center justify-center">
              <img 
                src="/landing/hero-studio.jpg" 
                alt="Veritas Academic Research Studio with Arched Windows" 
                className="hero-window-img w-full h-full object-cover object-center scale-[1.04] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A]/45 via-[#0D1B2A]/20 to-[#0D1B2A]/10 pointer-events-none" />

              {/* Tulisan VERITAS Monumental di Bagian Tengah Visual Window */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 p-4">
                <span className="hero-window-title text-6xl sm:text-8xl md:text-9xl lg:text-[8rem] xl:text-[9.5rem] font-black font-brutalism tracking-tighter text-white drop-shadow-[0_8px_32px_rgba(13,27,42,0.6)] leading-none transition-transform duration-700 group-hover:scale-[1.02]">
                  VERITAS
                </span>
              </div>
            </div>
          </div>

          {/* Typographic Hero Headline & Asymmetric Narrative */}
          <div id="manifesto-section" className="pt-6 sm:pt-10 pb-6 border-b border-stone-200/80">
            
            {/* Monumental Headline */}
            <div className="mb-8 story-reveal-hero">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#0D1B2A] text-[#D4AF37] flex items-center justify-center text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-[#415A77] uppercase">
                  SISTEM INTEGRITAS AKADEMIK
                </span>
              </div>
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[6.5rem] font-bold font-brutalism tracking-tighter text-[#0D1B2A] leading-[0.98] select-none">
                ACADEMIC ORIGINALITY<br />
                <span className="font-editorial-italic font-normal text-[#415A77] text-[0.92em]">
                  & Intelligent Verification.
                </span>
              </h1>
            </div>

            {/* Split Narrative: Kiri Deskripsi Filosofis, Kanan Tombol Aksi */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
              <div className="lg:col-span-8 space-y-3 story-reveal-hero">
                <p className="text-base sm:text-lg text-[#415A77] leading-relaxed font-readable">
                  Veritas adalah ekosistem analitik akademik yang memetakan orisinalitas naskah praktikum dan laporan tugas akhir mahasiswa STITEK Bontang. Sistem menggabungkan pencarian vektor *dense*, pemfilteran bias modul berjenjang, dan inspeksi komparasi spasial geometri PDF secara objektif.
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-[11px] font-mono text-stone-500">
                  <span>MULTIMODAL RAG</span>
                  <span>•</span>
                  <span>POSTGRESQL EMBEDDING</span>
                  <span>•</span>
                  <span>ELYSIAJS GATEWAY</span>
                  <span>•</span>
                  <span>PYMUPDF GEOMETRY</span>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-start gap-4 story-reveal-hero">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="group inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-[#0D1B2A] hover:bg-[#152238] text-[#F7F3E9] font-semibold text-xs sm:text-sm shadow-[0_10px_25px_rgba(13,27,42,0.15)] transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer"
                >
                  <span>{session?.user ? 'Buka Panel Dasbor' : 'Eksplorasi Naskah'}</span>
                  <span className="w-6 h-6 rounded-full bg-white/10 text-[#D4AF37] flex items-center justify-center text-xs group-hover:translate-x-0.5 transition-transform">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
                <span className="text-[11px] font-mono text-stone-500">
                  Melayani Program Studi Informatika & Sistem Informasi
                </span>
              </div>
            </div>

          </div>

        </section>

        {/* ========================================================================= */}
        {/* 3. FULL-WIDTH LIBRARY EDITORIAL BREAK BANNER (Cinematic Story Parallax)   */}
        {/* ========================================================================= */}
        <section className="py-12 sm:py-16 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <div className="library-banner-container relative w-full rounded-3xl sm:rounded-[2.5rem] overflow-hidden border border-stone-200/90 shadow-[0_20px_50px_rgba(13,27,42,0.08)] bg-stone-900">
            
            {/* Background Image Parallax */}
            <div className="min-h-[440px] sm:min-h-[500px] w-full relative flex items-center overflow-hidden">
              <img 
                src="/landing/library-banner.jpg" 
                alt="Modern Academic Library Research Archive" 
                className="library-banner-img absolute inset-0 w-full h-[120%] -top-[10%] object-cover object-center filter brightness-90"
              />
              
              {/* Deep Sapphire Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0D1B2A]/90 via-[#0D1B2A]/70 to-[#0D1B2A]/30" />
              
              {/* Content Overlaid */}
              <div className="relative z-10 p-8 sm:p-14 lg:p-20 max-w-2xl space-y-5 text-white">
                <div className="library-banner-text inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10.5px] font-mono text-[#D4AF37]">
                  <BookOpen className="w-3 h-3" />
                  <span className="font-bold tracking-wider uppercase">STANDAR RISET AKADEMIK</span>
                </div>
                
                <h2 className="library-banner-text text-3xl sm:text-4xl md:text-5xl font-bold font-brutalism text-white tracking-tight leading-tight">
                  FOCUS ON SCIENTIFIC RIGOR AND ACADEMIC INTEGRITY.
                </h2>
                
                <p className="library-banner-text text-xs sm:text-sm md:text-base text-slate-200 leading-relaxed font-readable">
                  Menumbuhkan ekosistem kejujuran ilmiah bagi mahasiswa dan tenaga pendidik STITEK Bontang. Setiap baris tulisan dan naskah praktikum diuji melalui parameter komputasi transparan yang dapat dipertanggungjawabkan.
                </p>

                <div className="library-banner-text pt-2">
                  <button
                    type="button"
                    onClick={handleActionClick}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-[#0D1B2A] text-xs font-semibold hover:bg-[#F7F3E9] transition-colors shadow-sm cursor-pointer"
                  >
                    <span>Pelajari Kerangka Evaluasi</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. LEDGER TABLE DIRECTORY (Clean Minimalist Architecture Archive)        */}
        {/* ========================================================================= */}
        <section id="archive-section" className="py-20 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          
          {/* Header Direktori */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200/70 pb-5">
            <div>
              <span className="text-xs font-semibold text-[#415A77] tracking-wider uppercase block mb-1">
                Arsitektur Komputasi
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-brutalism text-[#0D1B2A] tracking-tight">
                Spesifikasi Modul & Metodologi Sistem
              </h2>
            </div>
            <p className="text-xs text-[#415A77]">
              5 Modul Terintegrasi dalam Pipeline
            </p>
          </div>

          {/* Minimalist Ledger Table */}
          <div className="bg-white border border-stone-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70 font-mono text-[11px] text-[#415A77] uppercase tracking-wider">
                    <th className="py-3.5 px-6 font-semibold w-16">No</th>
                    <th className="py-3.5 px-6 font-semibold">Modul & Kapabilitas</th>
                    <th className="py-3.5 px-6 font-semibold">Klasifikasi</th>
                    <th className="py-3.5 px-6 font-semibold">Metodologi Ilmiah</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Keluaran Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-readable text-[#0D1B2A]">
                  
                  {/* Baris 1 */}
                  <tr className="ledger-row hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-stone-400">01</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-xs sm:text-sm text-[#0D1B2A]">Ekstraksi Geometri PDF Spasial</div>
                      <div className="text-[11px] text-[#415A77] mt-0.5">Pemetaan koordinat fisik teks dan visual per halaman</div>
                    </td>
                    <td className="py-4 px-6 text-[11px] text-[#415A77]">Analisis Spasial</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-[11px] text-[#0D1B2A] bg-stone-100/70 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
                        PyMuPDF Bounding Box ($BBox$)
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-xs font-medium text-stone-700">
                        Matriks Koordinat Objek
                      </span>
                    </td>
                  </tr>

                  {/* Baris 2 */}
                  <tr className="ledger-row hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-stone-400">02</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-xs sm:text-sm text-[#0D1B2A]">Pencarian Hibrida RRF</div>
                      <div className="text-[11px] text-[#415A77] mt-0.5">Penggabungan ranking kemiripan dense dan leksikal</div>
                    </td>
                    <td className="py-4 px-6 text-[11px] text-[#415A77]">Retrieval Engine</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-[11px] text-[#0D1B2A] bg-stone-100/70 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
                        Reciprocal Rank Fusion ($k = 60$)
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-xs font-medium text-stone-700">
                        Peringkat Kemiripan Fusi
                      </span>
                    </td>
                  </tr>

                  {/* Baris 3 */}
                  <tr className="ledger-row hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-stone-400">03</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-xs sm:text-sm text-[#0D1B2A]">Filter Bias Modul 5 Lapis</div>
                      <div className="text-[11px] text-[#415A77] mt-0.5">Pembersihan kalimat template modul dan soal praktikum</div>
                    </td>
                    <td className="py-4 px-6 text-[11px] text-[#415A77]">Pra-pemrosesan Data</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-[11px] text-[#0D1B2A] bg-stone-100/70 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
                        Few-Shot Prototypical Centroid
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-xs font-medium text-stone-700">
                        Naskah Bersih Bebas Bias
                      </span>
                    </td>
                  </tr>

                  {/* Baris 4 */}
                  <tr className="ledger-row hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-stone-400">04</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-xs sm:text-sm text-[#0D1B2A]">Cross-Encoder Multimodal Reranking</div>
                      <div className="text-[11px] text-[#415A77] mt-0.5">Skoring ulang pasangan teks dan gambar kandidat plagiarisme</div>
                    </td>
                    <td className="py-4 px-6 text-[11px] text-[#415A77]">Inferensi Multimodal</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-[11px] text-[#0D1B2A] bg-stone-100/70 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
                        MiniLM-L6 Cross Attention
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-xs font-medium text-stone-700">
                        Skor Probabilitas Pasangan
                      </span>
                    </td>
                  </tr>

                  {/* Baris 5 */}
                  <tr className="ledger-row hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-stone-400">05</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-xs sm:text-sm text-[#0D1B2A]">Rekapitulasi & Verifikasi Penilaian</div>
                      <div className="text-[11px] text-[#415A77] mt-0.5">Panel peninjauan asisten laboratorium dan dosen penguji</div>
                    </td>
                    <td className="py-4 px-6 text-[11px] text-[#415A77]">Panel Evaluasi</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-[11px] text-[#0D1B2A] bg-stone-100/70 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
                        PostgreSQL Matrix & PDF Export
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-xs font-medium text-stone-700">
                        Berita Acara Digital Siap Cetak
                      </span>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

            {/* Table Footer Action & Note */}
            <div className="border-t border-stone-200/80 bg-stone-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#415A77]">
              <span>Semua modul berjalan terintegrasi dalam pipeline deteksi orisinalitas saat berkas laporan diunggah.</span>
              <button
                type="button"
                onClick={handleActionClick}
                className="font-semibold text-[#0D1B2A] hover:text-[#D4AF37] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-md px-3 py-1.5 self-start sm:self-auto border border-stone-200 bg-white hover:bg-stone-50 shadow-2xs cursor-pointer"
              >
                Buka Konsol Pengujian
              </button>
            </div>
          </div>

        </section>

        {/* ========================================================================= */}
        {/* 6. GRAND CLOSING STATEMENT & ACADEMIC FOOTER                            */}
        {/* ========================================================================= */}
        <section id="closing-section" className="pt-32 pb-16 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto relative overflow-hidden">
          
          {/* Closing Statement Header */}
          <div className="story-reveal-closing flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-20 border-b border-stone-200/80 pb-16">
            <div className="space-y-4 max-w-2xl">
              <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#D4AF37] uppercase">
                INTEGRITAS AKADEMIK
              </span>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold font-brutalism text-[#0D1B2A] leading-tight">
                Menjaga martabat ilmiah,{' '}
                <span className="font-editorial-italic font-normal text-[#415A77] text-[1.08em]">
                  satu naskah demi satu naskah.
                </span>
              </h2>
            </div>

            {/* Pill CTA Button */}
            <button
              type="button"
              onClick={handleActionClick}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#0D1B2A] hover:bg-[#152238] text-[#F7F3E9] font-semibold text-sm shadow-[0_10px_28px_rgba(13,27,42,0.15)] transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer self-start lg:self-auto shrink-0"
            >
              <span>{session?.user ? 'Buka Panel Dasbor' : 'Mulai Pemeriksaan'}</span>
              <span className="w-6 h-6 rounded-full bg-white/10 text-[#D4AF37] flex items-center justify-center text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          {/* 3-Column Footer Grid */}
          <div className="story-reveal-closing grid grid-cols-1 sm:grid-cols-3 gap-8 text-xs font-readable text-[#415A77] pb-16">
            
            {/* Kolom 1: Fitur Sistem */}
            <div className="space-y-3">
              <span className="font-mono text-[11px] font-bold text-[#0D1B2A] uppercase tracking-wider block">
                SISTEM
              </span>
              <ul className="space-y-2">
                <li><button type="button" onClick={handleActionClick} className="hover:text-[#0D1B2A] transition-colors cursor-pointer">Direktori Naskah Laporan</button></li>
                <li><button type="button" onClick={handleActionClick} className="hover:text-[#0D1B2A] transition-colors cursor-pointer">Pemeriksaan Kesamaan Geometri</button></li>
                <li><button type="button" onClick={handleActionClick} className="hover:text-[#0D1B2A] transition-colors cursor-pointer">Rekapitulasi Matriks Nilai</button></li>
                <li><button type="button" onClick={handleActionClick} className="hover:text-[#0D1B2A] transition-colors cursor-pointer">Audit Logs Aktivitas</button></li>
              </ul>
            </div>

            {/* Kolom 2: Arsitektur Teknologi */}
            <div className="space-y-3">
              <span className="font-mono text-[11px] font-bold text-[#0D1B2A] uppercase tracking-wider block">
                TEKNOLOGI
              </span>
              <ul className="space-y-2 text-[#415A77]">
                <li>PostgreSQL Vector & Full-Text Engine</li>
                <li>FastAPI Python Multimodal Agent</li>
                <li>Bun & ElysiaJS High-Performance Gateway</li>
                <li>PyMuPDF Spatial Coordinate Extraction</li>
              </ul>
            </div>

            {/* Kolom 3: Lembaga & Kontak (Tanpa Email yang Dihapus) */}
            <div className="space-y-3">
              <span className="font-mono text-[11px] font-bold text-[#0D1B2A] uppercase tracking-wider block">
                INSTITUSI
              </span>
              <p className="leading-relaxed">
                Sekolah Tinggi Teknologi Bontang (STITEK)<br />
                Laboratorium Komputer & Informatika<br />
                Kota Bontang, Kalimantan Timur
              </p>
            </div>

          </div>

          {/* GHOST WATERMARK DI LATAR BELAKANG FOOTER */}
          <div className="ghost-watermark w-full overflow-hidden select-none pointer-events-none mt-4 -mb-8 text-center opacity-[0.05]">
            <span className="block text-[15vw] font-black font-brutalism tracking-tighter text-[#0D1B2A] leading-none">
              VERITAS
            </span>
          </div>

          {/* Baris Hak Cipta Bawah */}
          <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-stone-500 gap-2">
            <span>© {new Date().getFullYear()} STITEK Bontang. Hak Cipta Dilindungi Undang-Undang.</span>
            <span>Versi Produksi 2.0 • Multimodal AI</span>
          </div>

        </section>

      </main>

      {/* Curved Box Wipe Transition Overlay (Welcome -> Login) */}
      {isSwiping && (
        <CurvedTransition 
          mode="enter-from-right" 
          duration={0.75} 
          onComplete={() => {
            navigate(targetPathToNavigate || '/login', { state: { triggerSwipeOut: true } });
          }}
        />
      )}

      {/* Curved Box Wipe Out Back Transition Overlay (Returning to Welcome) */}
      {renderSwipeOverlayBack && (
        <CurvedTransition 
          mode="reveal-to-right" 
          duration={0.75} 
          onComplete={() => {
            setRenderSwipeOverlayBack(false);
            window.history.replaceState({}, document.title);
          }} 
        />
      )}

    </div>
  );
}
