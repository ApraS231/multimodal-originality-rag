import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession, useLogout } from '../api/auth';
import { 
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard, 
  MapPin, 
  Bot, 
  Layers, 
  ChevronDown,
  LogOut,
  Check,
  FileText,
  Server,
  Database,
  Code2,
  Container,
  Zap,
  Sparkles,
  Search,
  ShieldCheck
} from 'lucide-react';
import CurvedTransition from '../components/ui/curved-transition';
import { Logo } from '../components/ui/logo';
import { ScrambleText } from '../components/ui/scramble-text';
import { CanvasParticles } from '../components/ui/canvas-particles';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const logoutMutation = useLogout();

  // State menu dropdown profil pengguna di floating navbar
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

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

  const startSwipeAndNavigate = (targetPath: string) => {
    if (isSwiping) return;
    setTargetPathToNavigate(targetPath);
    setIsSwiping(true);
  };

  const handleActionClick = () => {
    if (session?.user) {
      const role = session.user.role || session.user.profil?.peran;
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

  // GSAP ScrollTrigger Pinned Panels with Overscroll
  const pinnedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: gsap.Context | null = null;
    const timer = setTimeout(() => {
      ctx = gsap.context(() => {
        const panels = gsap.utils.toArray<HTMLElement>('.pinned-panel');
        panels.forEach((panel) => {
          ScrollTrigger.create({
            trigger: panel,
            start: 'top top',
            pin: true,
            pinSpacing: false,
            anticipatePin: 1,
          });
        });
      }, pinnedContainerRef);

      ScrollTrigger.refresh();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (ctx) ctx.revert();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#081018] text-[#F7F3E9] relative font-sans overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-white">
      
      {/* Background Atmospheric Glow & Subtle Vignette */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-[#152238]/70 via-[#0D1B2A]/40 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] right-[5%] w-[450px] h-[450px] bg-[#D4AF37]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[5%] w-[500px] h-[500px] bg-[#415A77]/10 blur-[140px] rounded-full" />
      </div>

      {/* ========================================================================= */}
      {/* 1. FLOATING PILL NAVBAR                                                   */}
      {/* ========================================================================= */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-40 w-[min(94%,880px)] select-none">
        <div className="bg-[#0D1B2A]/85 hover:bg-[#0D1B2A]/95 text-[#F7F3E9] border border-[#415A77]/30 backdrop-blur-xl rounded-full px-4 sm:px-6 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] flex items-center justify-between transition-all duration-300">
          
          {/* Sisi Kiri: Brand Logo & Title */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <Logo size={24} variant="transparent" />
            <div className="flex items-center">
              <span className="font-bold text-xs tracking-wider text-[#F7F3E9] group-hover:text-white transition-colors">VERITAS</span>
            </div>
          </div>

          {/* Tengah: Navigasi Tautan Halus (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-[12px] text-slate-300 font-medium">
            <button 
              type="button"
              onClick={() => scrollToSection('about-section')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Tentang
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('features-section')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Spesifikasi
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('tech-stack-section')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Teknologi
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('closing-section')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Komitmen
            </button>
          </nav>

          {/* Sisi Kanan: Action Button / User Profile Dropdown */}
          <div className="flex items-center gap-2">
            {session?.user ? (
              <div className="relative" ref={profileDropdownRef}>
                <button 
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1 bg-[#152238] hover:bg-[#1B2B3E] border border-[#415A77]/40 rounded-full transition-all cursor-pointer"
                >
                  <div className="w-5 h-5 bg-[#D4AF37] text-[#0D1B2A] rounded-full flex items-center justify-center text-[10px] font-bold">
                    {session.user.nama ? session.user.nama[0].toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-semibold text-[#F7F3E9] max-w-[90px] truncate">
                    {session.user.nama}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#0D1B2A] border border-[#415A77]/40 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3.5 py-2 border-b border-[#415A77]/20">
                      <p className="text-xs font-bold text-white truncate">{session.user.nama}</p>
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
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-[#152238] rounded-xl transition-colors text-left cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors text-left cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#F7F3E9] hover:bg-white text-[#0D1B2A] rounded-full text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
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
        {/* 2. HERO SECTION WITH TEXT SCRAMBLING & MOBILE RESPONSIVENESS             */}
        {/* ========================================================================= */}
        <section className="min-h-screen pt-28 sm:pt-36 pb-16 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto flex flex-col justify-between">
          
          {/* Eyebrow Label */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] sm:tracking-[0.25em] text-[#D4AF37] uppercase font-bold">
              PLATFORM VERIFIKASI ORISINALITAS • STITEK BONTANG
            </span>
          </div>

          {/* Hero Main Block (Asimetris & Responsif Mobile) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end my-auto py-6 sm:py-8">
            
            {/* Sisi Kiri: Judul Raksasa "VERITAS" dengan GSAP-Style ScrambleText */}
            <div className="lg:col-span-8 select-none w-full max-w-full overflow-hidden">
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[9.8rem] xl:text-[11.2rem] font-black font-brutalism tracking-tighter text-[#F7F3E9] leading-none break-normal">
                <ScrambleText 
                  text="Veritas" 
                  chars="X01984_!#%&?=/*+~^<>{}[]ABCDEFGHIJKLMNOPQRSTUVWXYZ" 
                  intervalTrigger={14000} 
                />
              </h1>
            </div>

            {/* Sisi Kanan: Paragraf Narasi Eksklusif + Pill CTA Button */}
            <div className="lg:col-span-4 flex flex-col items-start gap-5 sm:gap-6 pb-2 lg:pb-4">
              <p className="text-slate-300 text-xs sm:text-sm sm:text-[14.5px] leading-relaxed font-readable">
                Ekosistem analitik cerdas pendeteksi orisinalitas naskah praktikum mahasiswa STITEK Bontang. Memadukan penelusuran vektor dense, filter bias template modular, dan perbandingan spasial geometri PDF transparan.
              </p>

              {/* Pill Button Kapsul Lonjong dengan Ikon Panah Bulat */}
              <button
                type="button"
                onClick={handleActionClick}
                className="w-full sm:w-auto group inline-flex items-center justify-between sm:justify-start gap-3 px-6 py-3 rounded-full bg-[#F7F3E9] hover:bg-white text-[#0D1B2A] font-semibold text-xs sm:text-sm shadow-[0_8px_24px_rgba(247,243,233,0.12)] transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <span>{session?.user ? 'Buka Panel Dasbor' : 'Eksplorasi Naskah'}</span>
                <span className="w-6 h-6 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center text-xs group-hover:translate-x-0.5 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </span>
              </button>
            </div>
          </div>

          {/* Bawah Hero: Indikator Scroll & Meta Label */}
          <div className="flex items-center justify-between border-t border-[#415A77]/25 pt-6 text-[10px] sm:text-[11px] font-mono text-slate-400">
            <span>MULTIMODAL RAG • POSTGRESQL EMBEDDING • ELYSIAJS</span>
            <button
              type="button"
              onClick={() => scrollToSection('about-section')}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Scroll ke bawah</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. EDITORIAL STATEMENT SECTION                                            */}
        {/* ========================================================================= */}
        <section id="about-section" className="py-24 sm:py-36 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto text-center relative">
          
          {/* Eyebrow Label */}
          <div className="mb-6 flex justify-center">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.25em] sm:tracking-[0.3em] text-[#D4AF37] uppercase">
              INTEGRITAS ILMIAH
            </span>
          </div>

          {/* Kalimat Pernyataan Utama Campuran: Sans-Serif + High-Contrast Serif Italic */}
          <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-[#F7F3E9] leading-[1.3] tracking-tight max-w-5xl mx-auto mb-8 sm:mb-10 select-none">
            Veritas adalah ekosistem analitik akademik,{' '}
            <span className="font-editorial-italic font-normal text-[#D4AF37] text-[1.12em] tracking-normal">
              ditempa dari presisi penalaran AI.
            </span>{' '}
            Sistem memetakan kesamaan teks, grafik, dan struktur dokumen menjadi skor objektif yang dapat dipertanggungjawabkan.
          </h2>

          {/* Sub-paragraf Keterangan Halus */}
          <p className="text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto font-readable">
            Melayani sivitas akademika Teknik Informatika dan Sistem Informasi STITEK Bontang. Membantu asisten dan dosen memverifikasi ratusan berkas praktikum dengan transparan tanpa kompromi bias template.
          </p>
        </section>

        {/* ========================================================================= */}
        {/* 4. PINNED PANELS WITH OVERSCROLL (GSAP ScrollTrigger Methodology Rails)  */}
        {/* ========================================================================= */}
        <div id="features-section" ref={pinnedContainerRef} className="relative w-full">
          
          {/* Section Introduction Header */}
          <div className="py-16 text-center max-w-3xl mx-auto px-6 space-y-2">
            <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#D4AF37] uppercase block">
              METODOLOGI PEMERIKSAAN
            </span>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-brutalism text-[#F7F3E9] tracking-tight">
              Research-grade precision for academic excellence.
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 font-readable">
              Setiap panel naskah dianalisis melalui tahapan komputasi bertingkat sebelum skor final ditetapkan.
            </p>
          </div>

          {/* PANEL 01: Pemetaan Spasial Geometri PDF */}
          <section className="pinned-panel min-h-screen w-full flex items-center justify-center p-6 sm:p-12 lg:p-20 relative bg-[#081018] border-t border-[#415A77]/30 shadow-[0_-20px_50px_rgba(0,0,0,0.85)] z-[10]">
            <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
              
              {/* Sisi Kiri: Deskripsi & Indikator Panel */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#D4AF37] tracking-wider uppercase">01 • Kanvas Koordinat</span>
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-bold text-[#F7F3E9] font-brutalism">
                  Pemetaan Spasial Geometri Lembar Asli
                </h3>
                
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-readable">
                  Bukan sekadar ekstraksi teks mentah. Enjin PyMuPDF mengekstrak koordinat piksel spasial dari tata letak naskah laporan PDF asli sehingga asisten dapat melacak posisi tepat paragraf yang terindikasi sama.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Koordinat fisik lembar dokumen PDF asli mahasiswa</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Deteksi nomor halaman, header, dan kolom presisi</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Inspeksi berdampingan dengan penyorotan warna interaktif</span>
                  </li>
                </ul>
              </div>

              {/* Sisi Kanan: Visual Studio Mock Preview */}
              <div className="lg:col-span-6">
                <div className="bg-[#0D1B2A]/90 border border-[#415A77]/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#415A77]/30 text-[11px] font-mono text-slate-400">
                    <span>Halaman 08 • Kolom A</span>
                    <span className="text-[#D4AF37] font-bold">96.4% Kesamaan Geometri</span>
                  </div>
                  <div className="space-y-2 py-2">
                    <div className="h-2 w-full bg-[#D4AF37]/40 rounded" />
                    <div className="h-2 w-4/5 bg-[#D4AF37]/25 rounded" />
                    <div className="h-2 w-2/3 bg-slate-700/60 rounded" />
                  </div>
                  <div className="p-3 bg-[#152238]/60 border border-[#415A77]/25 rounded-xl font-mono text-[10px] text-slate-300">
                    <span className="text-[#D4AF37] font-semibold block mb-1">Bounding Box Spatial:</span>
                    <span>x0: 72.0, y0: 148.5, x1: 520.4, y1: 210.2 (Halaman 8)</span>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* PANEL 02: Filter Bias Template 5 Lapis */}
          <section className="pinned-panel min-h-screen w-full flex items-center justify-center p-6 sm:p-12 lg:p-20 relative bg-[#0B1522] border-t border-[#415A77]/40 shadow-[0_-20px_50px_rgba(0,0,0,0.85)] z-[11]">
            <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
              
              {/* Sisi Kiri: Deskripsi & Indikator Panel */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#D4AF37] tracking-wider uppercase">02 • Filter Bias Template</span>
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-bold text-[#F7F3E9] font-brutalism">
                  Pencegahan False Positive 5 Lapis
                </h3>
                
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-readable">
                  Naskah praktikum sering memuat teks pengantar dan instruksi modul praktikum seragam. Veritas secara otomatis mengeliminasi boilerplate template sehingga mahasiswa tidak dituduh menyalin teks panduan praktikum.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Eliminasi otomatis instruksi baku modul praktikum</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Deteksi centroid Prototypical Network modul lab</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Proteksi parafrase analitis mandiri mahasiswa</span>
                  </li>
                </ul>
              </div>

              {/* Sisi Kanan: Visual Matrix */}
              <div className="lg:col-span-6">
                <div className="bg-[#081018]/90 border border-[#415A77]/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[#415A77]/30 text-slate-400">
                    <span>Lapisan Penyaringan</span>
                    <span className="text-emerald-400 font-bold">100% Template Stripped</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-[#121E2E] rounded-lg">
                      <span className="text-slate-300">L1: Judul & Header Modul</span>
                      <span className="text-emerald-400 font-semibold">Tersaring</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-[#121E2E] rounded-lg">
                      <span className="text-slate-300">L2: Teori Dasar Panduan</span>
                      <span className="text-emerald-400 font-semibold">Tersaring</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-[#152238] border border-[#D4AF37]/30 rounded-lg">
                      <span className="text-[#F7F3E9] font-bold">L5: Analisis & Kesimpulan Mandiri</span>
                      <span className="text-[#D4AF37] font-bold">Dinilai Murni</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* PANEL 03: Pencarian Hibrida RRF & Cross-Encoder */}
          <section className="pinned-panel min-h-screen w-full flex items-center justify-center p-6 sm:p-12 lg:p-20 relative bg-[#0D1B2A] border-t border-[#415A77]/50 shadow-[0_-20px_50px_rgba(0,0,0,0.85)] z-[12]">
            <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
              
              {/* Sisi Kiri: Deskripsi & Indikator Panel */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#D4AF37] tracking-wider uppercase">03 • Enjin Hibrida RRF</span>
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-bold text-[#F7F3E9] font-brutalism">
                  Pencarian Hibrida RRF ($k = 60$)
                </h3>
                
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-readable">
                  Memadukan kecerdasan semantik Dense Vector Cosine Similarity dengan presisi Full-Text Search PostgreSQL melalui formula Reciprocal Rank Fusion, disempurnakan reranking Cross-Encoder.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Dense Vector Cosine Similarity berbasis embedding multimodal</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Full-Text Search PostgreSQL leksikal akurat</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>{"Formula RRF: $RRF(d) = \\sum \\frac{1}{k + r(d)}$ dengan $k=60$"}</span>
                  </li>
                </ul>
              </div>

              {/* Sisi Kanan: Visual Formula */}
              <div className="lg:col-span-6">
                <div className="bg-[#081018]/90 border border-[#415A77]/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 font-mono">
                  <div className="text-[11px] text-slate-400 pb-2 border-b border-[#415A77]/30 flex justify-between items-center">
                    <span>Formula Fusion</span>
                    <span className="text-[#D4AF37] font-bold">RRF Ranker</span>
                  </div>
                  <div className="p-4 bg-[#152238]/60 border border-[#415A77]/30 rounded-xl text-center text-[#F7F3E9] font-semibold text-sm sm:text-base">
                    {"$$RRF(d) = \\sum_{m \\in M} \\frac{1}{60 + r_m(d)}$$"}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center text-xs text-slate-300">
                    <div className="p-3 bg-[#121E2E] rounded-xl border border-[#415A77]/20">
                      <span className="text-[#D4AF37] block font-bold">Dense Vector</span>
                      <span className="text-[10px] text-slate-400">Cosine Similarity</span>
                    </div>
                    <div className="p-3 bg-[#121E2E] rounded-xl border border-[#415A77]/20">
                      <span className="text-[#D4AF37] block font-bold">Sparse Text</span>
                      <span className="text-[10px] text-slate-400">PostgreSQL BM25 / FTS</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* ========================================================================= */}
        {/* 5. TECH STACK SECTION WITH CANVAS PARTICLES & RESPONSIVE ANIMATION       */}
        {/* ========================================================================= */}
        <section id="tech-stack-section" className="py-28 sm:py-36 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto relative overflow-hidden z-[13]">
          
          {/* Canvas Particles Interactive Background */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto">
            <CanvasParticles particleCountMobile={36} particleCountDesktop={75} />
            <div className="absolute inset-0 bg-gradient-to-b from-[#081018]/80 via-transparent to-[#081018]/90 pointer-events-none" />
          </div>

          <div className="relative z-10 space-y-14">
            
            {/* Tech Stack Header */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.25em] text-[#D4AF37] uppercase block">
                INFRASTRUKTUR TEKNOLOGI
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-brutalism text-[#F7F3E9] tracking-tight">
                Enjin Komputasi Berkinerja Tinggi
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-readable leading-relaxed">
                Dirancang dengan arsitektur mikro-layanan mandiri untuk inferensi AI berkecepatan tinggi, skalabilitas relasional, dan presisi tanpa kompromi.
              </p>
            </div>

            {/* Tech Stack Cards Grid (6 Kartu Interaktif Beranimasi Responsif) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              {/* Card 1: FastAPI & Python 3.12 */}
              <div className="group bg-[#0D1B2A]/75 hover:bg-[#0D1B2A]/95 border border-[#415A77]/30 hover:border-[#D4AF37]/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Server className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">AI Core</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">FastAPI & Python 3.12</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 font-readable">
                    Menangani eksekusi inferensi model embedding multimodal, isolasi komputasi vektor, dan koordinasi PyMuPDF.
                  </p>
                </div>
              </div>

              {/* Card 2: Bun & ElysiaJS */}
              <div className="group bg-[#0D1B2A]/75 hover:bg-[#0D1B2A]/95 border border-[#415A77]/30 hover:border-[#D4AF37]/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Gateway</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">Bun & ElysiaJS</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 font-readable">
                    API Gateway ultra-cepat berbasis runtime Bun dengan throughput tinggi, validasi skema type-safe, dan efisiensi memori.
                  </p>
                </div>
              </div>

              {/* Card 3: PostgreSQL Vector & Relational */}
              <div className="group bg-[#0D1B2A]/75 hover:bg-[#0D1B2A]/95 border border-[#415A77]/30 hover:border-[#D4AF37]/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Database className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Database</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">PostgreSQL Vector Engine</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 font-readable">
                    Penyimpanan vektor dense semantik dan data relasional transaksional ACID dalam satu ekosistem terpadu.
                  </p>
                </div>
              </div>

              {/* Card 4: PyMuPDF Spatial Extraction */}
              <div className="group bg-[#0D1B2A]/75 hover:bg-[#0D1B2A]/95 border border-[#415A77]/30 hover:border-[#D4AF37]/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Geometry</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">PyMuPDF Spatial Engine</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 font-readable">
                    Ekstraksi piksel spasial dari tata letak naskah PDF asli untuk merekonstruksi bounding box bukti penjiplakan.
                  </p>
                </div>
              </div>

              {/* Card 5: React 19 & Vite */}
              <div className="group bg-[#0D1B2A]/75 hover:bg-[#0D1B2A]/95 border border-[#415A77]/30 hover:border-[#D4AF37]/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Frontend</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">React 19 & Vite</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 font-readable">
                    Antarmuka reaktif dengan render KaTeX matematis, animasi GSAP kinetik, dan transisi swipe mulus tanpa jeda.
                  </p>
                </div>
              </div>

              {/* Card 6: Docker Engine Production */}
              <div className="group bg-[#0D1B2A]/75 hover:bg-[#0D1B2A]/95 border border-[#415A77]/30 hover:border-[#D4AF37]/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#152238] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Container className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Deployment</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">Docker Production</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 font-readable">
                    Enkapsulasi kontainer multi-layanan mandiri untuk keandalan produksi bebas kebocoran memori dan isolasi terjamin.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. CLOSING CTA & WATERMARK FOOTER                                        */}
        {/* ========================================================================= */}
        <section id="closing-section" className="pt-28 pb-10 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto relative overflow-hidden z-[14]">
          
          {/* Closing Statement Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-20">
            <div className="space-y-4 max-w-2xl">
              <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.25em] text-[#D4AF37] uppercase">
                INTEGRITAS AKADEMIK
              </span>
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold font-brutalism text-[#F7F3E9] leading-tight">
                Menjaga martabat ilmiah,{' '}
                <span className="font-editorial-italic font-normal text-[#D4AF37] text-[1.12em]">
                  satu naskah demi satu naskah.
                </span>
              </h2>
            </div>

            {/* Pill CTA Button */}
            <button
              type="button"
              onClick={handleActionClick}
              className="group inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-[#F7F3E9] hover:bg-white text-[#0D1B2A] font-semibold text-sm shadow-[0_8px_28px_rgba(247,243,233,0.15)] transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer self-start lg:self-auto shrink-0"
            >
              <span>{session?.user ? 'Buka Panel Dasbor' : 'Mulai Pemeriksaan'}</span>
              <span className="w-6 h-6 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
              </span>
            </button>
          </div>

          {/* Hairline Divider */}
          <div className="border-t border-[#415A77]/25 w-full pt-12 pb-16">
            
            {/* 3-Column Footer Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-xs font-readable text-slate-400">
              
              {/* Kolom 1: Fitur Sistem */}
              <div className="space-y-3">
                <span className="font-mono text-[11px] font-bold text-slate-200 uppercase tracking-wider block">
                  SISTEM
                </span>
                <ul className="space-y-2">
                  <li><button type="button" onClick={handleActionClick} className="hover:text-white transition-colors cursor-pointer">Direktori Naskah Laporan</button></li>
                  <li><button type="button" onClick={handleActionClick} className="hover:text-white transition-colors cursor-pointer">Pemeriksaan Kesamaan Geometri</button></li>
                  <li><button type="button" onClick={handleActionClick} className="hover:text-white transition-colors cursor-pointer">Rekapitulasi Matriks Nilai</button></li>
                  <li><button type="button" onClick={handleActionClick} className="hover:text-white transition-colors cursor-pointer">Audit Logs Aktivitas</button></li>
                </ul>
              </div>

              {/* Kolom 2: Arsitektur Teknologi */}
              <div className="space-y-3">
                <span className="font-mono text-[11px] font-bold text-slate-200 uppercase tracking-wider block">
                  TEKNOLOGI
                </span>
                <ul className="space-y-2 text-slate-400">
                  <li>PostgreSQL Vector & Full-Text Engine</li>
                  <li>FastAPI Python Multimodal Agent</li>
                  <li>Bun & ElysiaJS High-Performance Gateway</li>
                  <li>PyMuPDF Spatial Coordinate Extraction</li>
                </ul>
              </div>

              {/* Kolom 3: Lembaga & Kontak */}
              <div className="space-y-3">
                <span className="font-mono text-[11px] font-bold text-slate-200 uppercase tracking-wider block">
                  INSTITUSI
                </span>
                <p className="leading-relaxed">
                  Sekolah Tinggi Teknologi Bontang (STITEK)<br />
                  Laboratorium Komputer & Informatika<br />
                  Kota Bontang, Kalimantan Timur
                </p>
                <p className="text-[#D4AF37] font-mono text-[11px]">
                  laboratorium@stitek.ac.id
                </p>
              </div>

            </div>
          </div>

          {/* GHOST WATERMARK RAKSASA DI LATAR BELAKANG FOOTER */}
          <div className="w-full overflow-hidden select-none pointer-events-none mt-4 -mb-10 text-center opacity-15">
            <span className="block text-[15vw] font-black font-brutalism tracking-tighter text-slate-400 leading-none">
              VERITAS
            </span>
          </div>

          {/* Baris Hak Cipta Bawah */}
          <div className="pt-6 border-t border-[#415A77]/20 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400 gap-2">
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
