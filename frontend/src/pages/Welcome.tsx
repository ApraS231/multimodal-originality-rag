import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession, useLogout } from '../api/auth';
import { 
  ArrowRight,
  ArrowUpRight,
  LogIn, 
  LayoutDashboard, 
  MapPin, 
  Bot, 
  Layers, 
  Cpu, 
  ChevronDown,
  LogOut,
  ShieldCheck,
  Check,
  FileText
} from 'lucide-react';
import CurvedTransition from '../components/ui/curved-transition';
import { Logo } from '../components/ui/logo';

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

  return (
    <div className="min-h-screen bg-[#081018] text-[#F7F3E9] relative font-sans overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-white">
      
      {/* Background Atmospheric Glow & Subtle Vignette */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-[#152238]/70 via-[#0D1B2A]/40 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] right-[5%] w-[450px] h-[450px] bg-[#D4AF37]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[5%] w-[500px] h-[500px] bg-[#415A77]/10 blur-[140px] rounded-full" />
      </div>

      {/* ========================================================================= */}
      {/* 1. FLOATING PILL NAVBAR (Inspired by Hirael Floating Capsule)            */}
      {/* ========================================================================= */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-40 w-[min(94%,880px)] select-none">
        <div className="bg-[#0D1B2A]/85 hover:bg-[#0D1B2A]/95 text-[#F7F3E9] border border-[#415A77]/30 backdrop-blur-xl rounded-full px-4 sm:px-6 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] flex items-center justify-between transition-all duration-300">
          
          {/* Sisi Kiri: Brand Logo & Title */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <Logo size={24} variant="transparent" />
            <div className="flex items-center gap-1">
              <span className="font-bold text-xs tracking-wider text-[#F7F3E9] group-hover:text-white transition-colors">VERITAS</span>
              <span className="text-[#D4AF37] text-xs font-mono font-bold">*</span>
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
        {/* 2. HERO SECTION (Inspired by Image 1: Giant Title + Narrative + Pill CTA)*/}
        {/* ========================================================================= */}
        <section className="min-h-screen pt-36 pb-20 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto flex flex-col justify-between">
          
          {/* Eyebrow Label */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[11px] font-mono tracking-[0.25em] text-[#D4AF37] uppercase font-bold">
              PLATFORM VERIFIKASI ORISINALITAS • STITEK BONTANG
            </span>
          </div>

          {/* Hero Main Block (Asimetris: Kiri Title Raksasa, Kanan Deskripsi & CTA) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end my-auto py-8">
            
            {/* Sisi Kiri: Judul Raksasa "VERITAS*" */}
            <div className="lg:col-span-8 select-none">
              <h1 className="text-7xl sm:text-8xl md:text-9xl lg:text-[10.5rem] xl:text-[12rem] font-black font-brutalism tracking-tighter text-[#F7F3E9] leading-none flex items-baseline">
                <span>Veritas</span>
                <span className="text-[#D4AF37] font-mono ml-1 sm:ml-2 text-[0.6em] leading-none">*</span>
              </h1>
            </div>

            {/* Sisi Kanan: Paragraf Narasi Eksklusif + Pill CTA Button */}
            <div className="lg:col-span-4 flex flex-col items-start lg:items-start gap-6 pb-2 lg:pb-4">
              <p className="text-slate-300 text-sm sm:text-[14.5px] leading-relaxed font-readable">
                Ekosistem analitik cerdas pendeteksi orisinalitas naskah praktikum mahasiswa STITEK Bontang. Memadukan penelusuran vektor dense, filter bias template modular, dan perbandingan spasial geometri PDF transparan.
              </p>

              {/* Pill Button Kapsul Lonjong dengan Ikon Panah Bulat */}
              <button
                type="button"
                onClick={handleActionClick}
                className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#F7F3E9] hover:bg-white text-[#0D1B2A] font-semibold text-xs sm:text-sm shadow-[0_8px_24px_rgba(247,243,233,0.12)] transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <span>{session?.user ? 'Buka Panel Dasbor' : 'Eksplorasi Naskah'}</span>
                <span className="w-6 h-6 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center text-xs group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </button>
            </div>
          </div>

          {/* Bawah Hero: Indikator Scroll & Meta Label */}
          <div className="flex items-center justify-between border-t border-[#415A77]/25 pt-6 text-[11px] font-mono text-slate-400">
            <span>MULTIMODAL RAG • QDRANT VECTOR • ELYSIAJS</span>
            <button
              type="button"
              onClick={() => scrollToSection('about-section')}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Scroll ke bawah</span>
              <span>↓</span>
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. EDITORIAL STATEMENT SECTION (Inspired by Image 2: Mixed Typography)  */}
        {/* ========================================================================= */}
        <section id="about-section" className="py-28 sm:py-36 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto text-center relative">
          
          {/* Eyebrow Label */}
          <div className="mb-6 flex justify-center">
            <span className="text-[11px] font-mono font-bold tracking-[0.3em] text-[#D4AF37] uppercase">
              INTEGRITAS ILMIAH
            </span>
          </div>

          {/* Kalimat Pernyataan Utama Campuran: Sans-Serif + High-Contrast Serif Italic */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-[#F7F3E9] leading-[1.25] tracking-tight max-w-5xl mx-auto mb-10 select-none">
            Veritas adalah ekosistem analitik akademik,{' '}
            <span className="font-editorial-italic font-normal text-[#D4AF37] text-[1.12em] tracking-normal">
              ditempa dari presisi penalaran AI.
            </span>{' '}
            Kami memetakan kesamaan teks, grafik, dan struktur dokumen menjadi skor objektif yang dapat dipertanggungjawabkan.
          </h2>

          {/* Sub-paragraf Keterangan Halus */}
          <p className="text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto font-readable">
            Melayani sivitas akademika Teknik Informatika dan Sistem Informasi STITEK Bontang. Membantu asisten dan dosen memverifikasi ratusan berkas praktikum dengan transparan tanpa kompromi bias template.
          </p>
        </section>

        {/* ========================================================================= */}
        {/* 4. FEATURE SHOWCASE CARDS (Inspired by Image 3: 4 Studio-Grade Cards Rail) */}
        {/* ========================================================================= */}
        <section id="features-section" className="py-24 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto">
          
          {/* Section Header */}
          <div className="mb-14 text-center max-w-2xl mx-auto space-y-2">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-brutalism text-[#F7F3E9] tracking-tight">
              Research-grade precision for academic excellence.
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 font-readable">
              Dirancang untuk objektivitas murni. Didukung kecerdasan buatan multimodal.
            </p>
          </div>

          {/* The 4-Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* KARTU 1: Inspection Canvas Preview Card (Match "Your creative canvas") */}
            <div className="bg-[#121E2E]/90 border border-[#415A77]/30 rounded-2xl p-6 flex flex-col justify-between min-h-[360px] relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
              <div className="space-y-3 z-10">
                <div className="w-8 h-8 rounded-lg bg-[#1B2B3E] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#D4AF37] uppercase tracking-wider">Kanvas Visual</span>
                  <h4 className="text-base font-bold text-[#F7F3E9]">Inspeksi Berdampingan</h4>
                </div>
              </div>

              {/* Visual Graphic Representation */}
              <div className="my-auto py-4">
                <div className="p-3 bg-[#0D1B2A]/90 border border-[#415A77]/30 rounded-xl space-y-2 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-[#415A77]/20">
                    <span>Halaman 12 • Kolom B</span>
                    <span className="text-[#D4AF37] font-bold">96.4% Match</span>
                  </div>
                  <div className="space-y-1 text-slate-300 text-[9.5px]">
                    <div className="h-1.5 w-full bg-[#D4AF37]/40 rounded" />
                    <div className="h-1.5 w-4/5 bg-[#D4AF37]/25 rounded" />
                    <div className="h-1.5 w-2/3 bg-slate-700 rounded" />
                  </div>
                </div>
              </div>

              <div className="z-10 pt-2 border-t border-[#415A77]/20">
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                  Ruang inspeksi spasial.
                </span>
              </div>
            </div>

            {/* KARTU 2: Fitur 01 - Pemetaan Spasial Geometri PDF */}
            <div className="bg-[#152238]/85 border border-[#415A77]/30 hover:border-[#D4AF37]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[360px] transition-all duration-300 hover:-translate-y-1 group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[#1B2B3E] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">01</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-[#F7F3E9] mb-3">Pemetaan Spasial Geometri</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Koordinat fisik lembar PDF asli</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Deteksi nomor halaman presisi</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Perbandingan visual berdampingan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Jejak audit perubahan naskah</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={handleActionClick}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-[#D4AF37] transition-colors mt-6 cursor-pointer text-left"
              >
                <span>Pelajari geometri</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* KARTU 3: Fitur 02 - Filter Bias Template 5 Lapis */}
            <div className="bg-[#152238]/85 border border-[#415A77]/30 hover:border-[#D4AF37]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[360px] transition-all duration-300 hover:-translate-y-1 group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[#1B2B3E] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">02</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-[#F7F3E9] mb-3">Filter Bias Template 5 Lapis</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Eliminasi instruksi modul praktikum</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Proteksi parafrase akademis baku</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Deteksi centroid Prototypical Network</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Pencegahan false positive tuduhan</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={handleActionClick}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-[#D4AF37] transition-colors mt-6 cursor-pointer text-left"
              >
                <span>Pelajari filter bias</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* KARTU 4: Fitur 03 - Pencarian Hibrida RRF (k = 60) */}
            <div className="bg-[#152238]/85 border border-[#415A77]/30 hover:border-[#D4AF37]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[360px] transition-all duration-300 hover:-translate-y-1 group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[#1B2B3E] border border-[#415A77]/40 flex items-center justify-center text-[#D4AF37]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">03</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-[#F7F3E9] mb-3">Pencarian Hibrida RRF</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Dense Vector Search via Qdrant</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Full-Text Search PostgreSQL</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Reciprocal Rank Fusion (k = 60)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>Cross-Encoder reranking komparasi</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={handleActionClick}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-[#D4AF37] transition-colors mt-6 cursor-pointer text-left"
              >
                <span>Pelajari formula RRF</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. CLOSING CTA & WATERMARK FOOTER (Inspired by Image 4)                  */}
        {/* ========================================================================= */}
        <section id="closing-section" className="pt-28 pb-10 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto relative overflow-hidden">
          
          {/* Closing Statement Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-20">
            <div className="space-y-4 max-w-2xl">
              <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#D4AF37] uppercase">
                INTEGRITAS AKADEMIK
              </span>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold font-brutalism text-[#F7F3E9] leading-tight">
                Menjaga martabat ilmiah,{' '}
                <span className="font-editorial-italic font-normal text-[#D4AF37] text-[1.12em]">
                  satu naskah demi satu naskah.
                </span>
              </h2>
            </div>

            {/* Pill CTA Button (Match Image 4 "Start a project ↗") */}
            <button
              type="button"
              onClick={handleActionClick}
              className="group inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-[#F7F3E9] hover:bg-white text-[#0D1B2A] font-semibold text-sm shadow-[0_8px_28px_rgba(247,243,233,0.15)] transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer self-start lg:self-auto shrink-0"
            >
              <span>{session?.user ? 'Buka Panel Dasbor' : 'Mulai Pemeriksaan'}</span>
              <span className="w-6 h-6 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                ↗
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
                  <li>Qdrant Vector Database Engine</li>
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

          {/* GHOST WATERMARK RAKSASA DI LATAR BELAKANG FOOTER (Inspired by Image 4 "Hirael" Ghost Logo) */}
          <div className="w-full overflow-hidden select-none pointer-events-none mt-4 -mb-10 text-center opacity-15">
            <span className="block text-[15vw] font-black font-brutalism tracking-tighter text-slate-400 leading-none">
              VERITAS
            </span>
          </div>

          {/* Baris Hak Cipta Bawah */}
          <div className="pt-6 border-t border-[#415A77]/20 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
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
