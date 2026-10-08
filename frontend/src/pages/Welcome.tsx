import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession, useLogout } from '../api/auth';
import { 
  Cpu, 
  ArrowDown, 
  ArrowRight,
  LogIn, 
  LayoutDashboard, 
  Upload, 
  BarChart, 
  MapPin, 
  Bot, 
  Layers, 
  Users,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import TypewriterText from '../components/ui/typewriter-text';
import ScrollReveal from '../components/ui/scroll-reveal';
import CurvedTransition from '../components/ui/curved-transition';
import { Button } from '../components/ui/button';
import { Logo } from '../components/ui/logo';

gsap.registerPlugin(ScrollTrigger);

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const logoutMutation = useLogout();

  // State menu dropdown profil pengguna di header
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Deteksi klik di luar menu dropdown profil untuk menutupnya secara otomatis
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

  // Membaca state transisi Curve Swipe Back (Kembali)
  const triggerSwipeOutBack = location.state?.triggerSwipeOutBack === true;
  const [renderSwipeOverlayBack, setRenderSwipeOverlayBack] = useState(triggerSwipeOutBack);

  // State untuk Section 4: Radar Scanner & Split Nodes (Accordion Dropdown)
  const [activeFeature, setActiveFeature] = useState<number | null>(0);

  // Refs untuk animasi GSAP ScrollTrigger
  const pipelineSectionRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<SVGLineElement>(null);
  const line2Ref = useRef<SVGLineElement>(null);
  const stepNumsRef = useRef<(HTMLDivElement | null)[]>([]);
  const stepTextsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [isSwiping, setIsSwiping] = useState(false);
  const [targetPathToNavigate, setTargetPathToNavigate] = useState<string | null>(null);

  // Scroll to top jika kembali dari halaman Login
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Animasi Lini Aliran Data SVG Fleksibel (Section 3)
      if (pipelineSectionRef.current) {
        // Baris Konektor 1 (Scrub diperhalus dengan inersia 1.2s)
        if (line1Ref.current) {
          gsap.fromTo(line1Ref.current,
            { strokeDashoffset: 100 },
            {
              strokeDashoffset: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: pipelineSectionRef.current,
                start: 'top center+=20%',
                end: 'center center+=10%',
                scrub: 1.2
              }
            }
          );
        }

        // Baris Konektor 2 (Scrub diperhalus dengan inersia 1.2s)
        if (line2Ref.current) {
          gsap.fromTo(line2Ref.current,
            { strokeDashoffset: 100 },
            {
              strokeDashoffset: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: pipelineSectionRef.current,
                start: 'center center',
                end: 'bottom center',
                scrub: 1.2
              }
            }
          );
        }

        // 2. Animasikan perubahan warna teks angka langkah
        stepNumsRef.current.forEach((numEl) => {
          if (!numEl) return;
          gsap.fromTo(numEl, 
            { color: 'rgba(13, 27, 42, 0.25)' },
            {
              color: '#D4AF37', // Metallic Brass aktif
              scrollTrigger: {
                trigger: numEl,
                start: 'top center+=30%',
                end: 'bottom center-=10%',
                toggleActions: 'play reverse play reverse'
              }
            }
          );
        });

        // 3. Animasikan pemudaran paragraf deskripsi langkah
        stepTextsRef.current.forEach((textEl) => {
          if (!textEl) return;
          gsap.fromTo(textEl,
            { opacity: 0.35, y: 15 },
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              scrollTrigger: {
                trigger: textEl,
                start: 'top center+=35%',
                end: 'bottom center-=10%',
                toggleActions: 'play reverse play reverse'
              }
            }
          );
        });
      }
    });

    return () => {
      ctx.revert();
    };
  }, []);

  // Data tahap pipeline deteksi orisinalitas
  const pipelineSteps = [
    {
      title: 'Pemetaan Spasial Geometri PDF',
      shortLabel: 'Geometri PDF',
      desc: 'Koordinat teks pembanding disorot secara interaktif langsung pada lembar dokumen PDF asli lengkap dengan nomor halaman dan bounding box fisik.',
      icon: MapPin
    },
    {
      title: 'Filter Bias Template 5 Lapis',
      shortLabel: 'Filter Bias',
      desc: 'Sistem menyaring otomatis kalimat instruksi modul praktikum, frasa akademik generik, frekuensi lintas laporan, dan centroid Prototypical Network agar tidak salah tuduh.',
      icon: Bot
    },
    {
      title: 'Penelusuran Hibrida RRF (k = 60)',
      shortLabel: 'RRF Hibrida',
      desc: 'Mengombinasikan penelusuran semantik vektor dense dengan PostgreSQL Full-Text Search untuk mendeteksi parafrase dan jiplakan kata kunci presisi.',
      icon: Layers
    },
    {
      title: 'Transparansi Human-in-the-Loop',
      shortLabel: 'Verifikasi Aslab',
      desc: 'Asisten Laboratorium memegang kendali penuh untuk meninjau perbandingan dokumen secara berdampingan, mengoreksi skor, dan memberi nilai praktikum.',
      icon: Users
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F3E9] text-[#0D1B2A] relative font-sans flex flex-col justify-between">
      
      {/* Header Navigasi */}
      <header className="sticky top-0 w-full h-[72px] bg-[#F7F3E9]/95 backdrop-blur-md border-b-2 border-[#0D1B2A] px-[21px] md:px-[34px] flex justify-between items-center z-30 select-none">
        
        {/* Struktur Kiri: Brand Block */}
        <div className="flex items-center gap-3">
          <Logo size={42} />
          <div className="hidden sm:flex flex-col text-left leading-tight">
            <span className="font-brutalism font-black text-xs text-[#0D1B2A] tracking-wider">VERITAS</span>
            <span className="text-[10px] font-mono text-[#415A77] font-semibold">STITEK BONTANG</span>
          </div>
        </div>

        {/* Struktur Kanan: Action Block */}
        <div className="flex items-center gap-3">
          {session?.user ? (
            /* User Profile & Action Dropdown */
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#F7F3E9] border-2 border-[#0D1B2A] hover:shadow-[2px_2px_0px_#D4AF37] rounded transition-all duration-150 cursor-pointer"
              >
                <div className="w-[26px] h-[26px] bg-[#0D1B2A] text-[#F7F3E9] rounded flex items-center justify-center text-[11px] font-bold">
                  {session.user.nama ? session.user.nama[0].toUpperCase() : 'U'}
                </div>
                <span className="text-[12px] font-bold text-[#0D1B2A] max-w-[120px] truncate">
                  {session.user.nama}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#415A77] transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180 text-[#0D1B2A]' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded border-2 border-[#0D1B2A] shadow-[3px_3px_0px_#D4AF37] py-1.5 z-50 animate-fade-in">
                  <div className="px-4 py-2.5 border-b border-[#415A77]/15">
                    <p className="text-xs font-bold text-[#0D1B2A] truncate">{session.user.nama}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-none bg-[#D4AF37]" />
                      <span className="text-[10px] font-mono text-[#415A77] font-bold uppercase tracking-wider">
                        {session.user.role || session.user.profil?.peran || 'USER'}
                      </span>
                    </div>
                  </div>
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        handleActionClick();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#0D1B2A] hover:bg-[#F7F3E9] rounded transition-colors text-left cursor-pointer"
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#0D1B2A]" />
                      <span>Panel Dasbor</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        logoutMutation.mutate();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Keluar Sesi</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button
                variant="brutalist-outline"
                size="sm"
                onClick={() => startSwipeAndNavigate('/login?register=true')}
              >
                Daftar ASLAB
              </Button>
              <Button
                variant="brutalist"
                size="sm"
                onClick={handleActionClick}
                className="gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk ke Sistem</span>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Story Container (Smooth Scale/Fade saat Transisi Layar) */}
      <main className={`relative z-10 flex-1 flex flex-col w-full max-w-7xl mx-auto px-[21px] md:px-[55px] gap-[120px] md:gap-[180px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isSwiping ? 'scale-[0.985] opacity-80 filter blur-[0.3px]' : 'scale-100 opacity-100'
      }`}>
        
        {/* ========================================================================= */}
        {/* Section 1: Hero Section (Viewport 1 - 100vh) */}
        {/* ========================================================================= */}
        <section className="min-h-[calc(100vh-72px)] flex flex-col justify-center items-center text-center relative py-[55px] md:py-[89px] z-10">
          <div className="max-w-4xl flex flex-col items-center mx-auto">
            

            {/* Judul Utama Kokoh dan Berwibawa */}
            <div className="w-full max-w-4xl flex flex-col items-center justify-center select-none mb-6">
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-brutalism font-black tracking-tighter text-[#0D1B2A] leading-none select-none flex items-center justify-center min-h-[1.15em]">
                VERITAS
              </h1>

              {/* Subtitle Dinamis Typewriting */}
              <div className="flex items-center gap-2 mt-4 text-[11px] sm:text-xs font-mono tracking-widest text-[#415A77] uppercase font-bold select-none min-h-[1.5em]">
                <span className="w-3 h-0.5 bg-[#D4AF37] shrink-0" />
                <TypewriterText
                  words={[
                    "Validasi Orisinalitas Laporan Praktikum",
                    "Pemetaan Geometri Spasial PDF Presisi",
                    "Pencegahan Bias Template Modul Otomatis"
                  ]}
                  typingSpeed={60}
                  deletingSpeed={30}
                  pauseDuration={3200}
                  loop={true}
                  cursor={true}
                  cursorChar="▍"
                  cursorClassName="text-[#D4AF37] ml-1 text-[10px]"
                />
              </div>
            </div>

            {/* Paragraf Deskripsi */}
            <p className="text-[#415A77] font-readable text-xs sm:text-sm leading-relaxed max-w-lg mx-auto text-center mb-8">
              Platform verifikasi orisinalitas laporan praktikum mahasiswa STITEK Bontang. Memadukan penelusuran hibrida RRF, pemetaan spasial geometri PDF, dan filter bias template modul untuk keputusan akademik yang adil dan objektif.
            </p>

            {/* Tombol Aksi Utama */}
            <Button
              variant="brutalist-brass"
              size="lg"
              onClick={() => scrollToSection('about-section')}
              className="px-8 py-3.5 h-auto text-xs cursor-pointer group gap-2"
            >
              <span>Mulai Penelusuran</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#0D1B2A]" />
            </Button>
          </div>

          {/* Indikator Gulir Bawah */}
          <div 
            onClick={() => scrollToSection('about-section')}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 cursor-pointer select-none text-[#415A77] hover:text-[#0D1B2A] transition-colors"
          >
            <span className="text-[10px] font-mono tracking-widest uppercase font-semibold">Scroll Down</span>
            <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 2: Deskripsi Sistem */}
        {/* ========================================================================= */}
        <section id="about-section" className="min-h-[85vh] flex flex-col justify-center items-center py-[55px] text-center z-10">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-3 flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-2 border-[#0D1B2A] text-[10px] font-mono tracking-widest text-[#0D1B2A] uppercase font-bold select-none shadow-[2px_2px_0px_#D4AF37] rounded">
                <span className="w-1.5 h-1.5 bg-[#D4AF37]"></span>
                <span>Tujuan Akademik</span>
              </div>
              <h2 className="text-xl md:text-2xl font-brutalism font-bold text-[#0D1B2A] select-none">TENTANG SISTEM</h2>
            </div>

            {/* Animasi ScrollReveal Teks Besar & Bold */}
            <ScrollReveal
              baseOpacity={0.08}
              enableBlur={true}
              baseRotation={0}
              blurStrength={5}
              wordAnimationEnd="center center+=10%"
              containerClassName="mx-auto"
              textClassName="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-brutalism font-black tracking-tight text-[#0D1B2A] leading-relaxed"
            >
              VERITAS merupakan sistem cerdas yang menganalisis setiap laporan praktikum mahasiswa STITEK Bontang secara objektif, mendeteksi kesamaan semantik, memetakan koordinat kesamaan langsung pada lembar PDF asli, serta mengisolasi template praktikum standar guna menegakkan kejujuran akademik secara terukur.
            </ScrollReveal>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 3: Connected Pipeline Deteksi */}
        {/* ========================================================================= */}
        <section 
          ref={pipelineSectionRef}
          className="min-h-[85vh] flex flex-col justify-center py-[55px] z-10"
        >
          <div className="max-w-5xl mx-auto w-full space-y-16 relative">
            <div className="text-center space-y-3 flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-2 border-[#0D1B2A] text-[10px] font-mono tracking-widest text-[#0D1B2A] uppercase font-bold select-none shadow-[2px_2px_0px_#D4AF37] rounded">
                <span className="w-1.5 h-1.5 bg-[#D4AF37]"></span>
                <span>Alur Verifikasi</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-brutalism font-bold text-[#0D1B2A]">Connected Pipeline</h2>
              <p className="text-xs sm:text-sm text-[#415A77] font-readable max-w-md mx-auto">
                Tahapan sistematis pemrosesan naskah laporan praktikum dari pengunggahan hingga keputusan asisten laboratorium.
              </p>
            </div>

            {/* Pipeline Container */}
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 md:gap-2 w-full py-6 px-4">
              
              {/* Langkah 1 */}
              <div 
                ref={(el) => { stepTextsRef.current[0] = el; }}
                className="flex flex-col items-center md:items-start text-center md:text-left space-y-4 max-w-[260px] z-10"
              >
                <div 
                  ref={(el) => { stepNumsRef.current[0] = el; }}
                  className="w-16 h-16 rounded bg-white border-2 border-[#0D1B2A] text-[#0D1B2A] flex items-center justify-center font-brutalism font-black text-2xl shadow-[2px_2px_0px_#D4AF37] transition-all duration-300 select-none"
                >
                  01
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-center md:justify-start text-[#0D1B2A]">
                    <Upload className="w-4 h-4 text-[#D4AF37]" />
                    <h3 className="text-base font-brutalism font-bold uppercase tracking-wider">Unggah Berkas</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#415A77] font-readable leading-relaxed">
                    Naskah laporan PDF diunggah ke repositori, baik satuan oleh asisten maupun sinkronisasi massal per kelas praktikum.
                  </p>
                </div>
              </div>

              {/* Garis Konektor SVG 1 Adaptif */}
              <div className="flex-1 h-[2px] mx-4 relative hidden md:block select-none" style={{ minWidth: '80px' }}>
                <svg className="w-full h-[4px] absolute top-1/2 -translate-y-1/2 overflow-visible" viewBox="0 0 100 4" preserveAspectRatio="none" fill="none">
                  <line x1="0" y1="2" x2="100" y2="2" stroke="rgba(65, 90, 119, 0.2)" strokeWidth="3" strokeLinecap="round" />
                  <line 
                    ref={line1Ref}
                    pathLength="100"
                    x1="0" y1="2" x2="100" y2="2" 
                    stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" 
                    strokeDasharray="100" strokeDashoffset="100"
                  />
                </svg>
              </div>

              {/* Langkah 2 */}
              <div 
                ref={(el) => { stepTextsRef.current[1] = el; }}
                className="flex flex-col items-center md:items-start text-center md:text-left space-y-4 max-w-[260px] z-10"
              >
                <div 
                  ref={(el) => { stepNumsRef.current[1] = el; }}
                  className="w-16 h-16 rounded bg-white border-2 border-[#0D1B2A] text-[#0D1B2A] flex items-center justify-center font-brutalism font-black text-2xl shadow-[2px_2px_0px_#D4AF37] transition-all duration-300 select-none"
                >
                  02
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-center md:justify-start text-[#0D1B2A]">
                    <Cpu className="w-4 h-4 text-[#D4AF37]" />
                    <h3 className="text-base font-brutalism font-bold uppercase tracking-wider">Analisis Hibrida</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#415A77] font-readable leading-relaxed">
                    Filter 5 lapis memilah template modul praktikum, dilanjutkan pencocokan vektor RRF dan pembatas guardrail semantik.
                  </p>
                </div>
              </div>

              {/* Garis Konektor SVG 2 Adaptif */}
              <div className="flex-1 h-[2px] mx-4 relative hidden md:block select-none" style={{ minWidth: '80px' }}>
                <svg className="w-full h-[4px] absolute top-1/2 -translate-y-1/2 overflow-visible" viewBox="0 0 100 4" preserveAspectRatio="none" fill="none">
                  <line x1="0" y1="2" x2="100" y2="2" stroke="rgba(65, 90, 119, 0.2)" strokeWidth="3" strokeLinecap="round" />
                  <line 
                    ref={line2Ref}
                    pathLength="100"
                    x1="0" y1="2" x2="100" y2="2" 
                    stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" 
                    strokeDasharray="100" strokeDashoffset="100"
                  />
                </svg>
              </div>

              {/* Langkah 3 */}
              <div 
                ref={(el) => { stepTextsRef.current[2] = el; }}
                className="flex flex-col items-center md:items-start text-center md:text-left space-y-4 max-w-[260px] z-10"
              >
                <div 
                  ref={(el) => { stepNumsRef.current[2] = el; }}
                  className="w-16 h-16 rounded bg-white border-2 border-[#0D1B2A] text-[#0D1B2A] flex items-center justify-center font-brutalism font-black text-2xl shadow-[2px_2px_0px_#D4AF37] transition-all duration-300 select-none"
                >
                  03
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-center md:justify-start text-[#0D1B2A]">
                    <BarChart className="w-4 h-4 text-[#D4AF37]" />
                    <h3 className="text-base font-brutalism font-bold uppercase tracking-wider">Verifikasi Aslab</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#415A77] font-readable leading-relaxed">
                    Hasil pemetaan spasial tersaji berdampingan untuk diperiksa asisten lab sebelum penetapan nilai mutu laporan.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 4: Arsitektur Deteksi, Pipeline Interaktif */}
        {/* ========================================================================= */}
        <section className="min-h-[85vh] flex flex-col justify-center py-[55px] z-10">
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 space-y-10">
            <div className="text-center space-y-3 flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-2 border-[#0D1B2A] text-[10px] font-mono tracking-widest text-[#0D1B2A] uppercase font-bold select-none shadow-[2px_2px_0px_#D4AF37] rounded">
                <span className="w-1.5 h-1.5 bg-[#D4AF37]"></span>
                <span>Teknologi</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-brutalism font-bold text-[#0D1B2A]">Arsitektur Deteksi Orisinalitas</h2>
              <p className="text-xs sm:text-sm text-[#415A77] font-readable max-w-md mx-auto">
                Empat tahap pemrosesan yang bekerja berurutan untuk memverifikasi keaslian setiap laporan praktikum.
              </p>
            </div>

            {/* Pipeline Strip: 4 tahap horizontal */}
            <div className="relative">
              <div className="pipeline-strip" role="tablist" aria-label="Tahap deteksi orisinalitas">
                {pipelineSteps.map((step, idx) => {
                  const IconComp = step.icon;
                  const isActive = activeFeature === idx;
                  return (
                    <div key={idx} className="pipeline-step">
                      {/* Garis koneksi ke tahap berikutnya */}
                      {idx < pipelineSteps.length - 1 && (
                        <div
                          className="pipeline-connector hidden md:block"
                          style={{
                            left: '50%',
                            width: '100%'
                          }}
                        />
                      )}
                      <button
                        role="tab"
                        type="button"
                        className="pipeline-step-btn"
                        aria-expanded={isActive}
                        aria-controls={`pipeline-panel-${idx}`}
                        aria-selected={isActive}
                        id={`pipeline-tab-${idx}`}
                        onClick={() => setActiveFeature(isActive ? null : idx)}
                      >
                        <span className="pipeline-step-index">0{idx + 1}</span>
                        <div className="pipeline-step-icon">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="pipeline-step-label">{step.shortLabel}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Panel detail di bawah strip */}
              <div className={`grid-transition-height mt-4 ${activeFeature !== null ? 'grid-transition-height-open' : 'grid-transition-height-closed'}`}>
                <div className="grid-transition-inner">
                  {activeFeature !== null && (() => {
                    const step = pipelineSteps[activeFeature];
                    const IconComp = step.icon;
                    return (
                      <div
                        className="pipeline-detail-panel"
                        id={`pipeline-panel-${activeFeature}`}
                        role="tabpanel"
                        aria-labelledby={`pipeline-tab-${activeFeature}`}
                        style={{
                          ['--arrow-offset' as string]: `calc(${(activeFeature / (pipelineSteps.length - 1)) * 100}% + ${activeFeature === 0 ? '40px' : activeFeature === pipelineSteps.length - 1 ? '-40px' : '0px'})`
                        }}
                      >
                        <style>{`.pipeline-detail-panel::before { left: var(--arrow-offset, 50%); }`}</style>
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-md bg-[#0D1B2A] text-[#D4AF37] shrink-0 shadow-xs">
                            <IconComp className="w-5 h-5" />
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <h3 className="text-sm sm:text-base font-brutalism font-bold text-[#0D1B2A]">
                              {step.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-[#415A77] font-readable leading-relaxed">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 5: Komitmen Integritas Ilmiah & CTA */}
        {/* ========================================================================= */}
        <section className="min-h-[70vh] flex flex-col justify-center items-center py-[55px] text-center relative z-10">
          <div className="w-full max-w-3xl mx-auto bg-white border-2 border-[#0D1B2A] shadow-[6px_6px_0px_#D4AF37] p-8 md:p-14 space-y-6 relative rounded">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F7F3E9] border border-[#0D1B2A]/30 text-[10px] font-mono tracking-widest text-[#0D1B2A] uppercase font-bold select-none rounded">
              <span className="w-2 h-2 bg-[#D4AF37] inline-block"></span>
              <span>STANDAR AKADEMIK STITEK BONTANG</span>
            </div>

            {/* Judul Komitmen Integritas */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-brutalism font-black text-[#0D1B2A] leading-tight select-none">
              Menjaga Orisinalitas, Menegakkan Integritas Ilmiah
            </h2>
            
            <p className="text-[#415A77] font-readable text-xs sm:text-sm leading-relaxed max-w-lg mx-auto">
              Penyusunan naskah praktikum secara mandiri melatih penalaran analitis dan etika penelitian mahasiswa. Platform Veritas memfasilitasi verifikasi orisinalitas berbasis bukti fisik nyata guna mewujudkan evaluasi laboratorium yang adil dan objektif.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="brutalist-brass"
                size="lg"
                onClick={handleActionClick}
                className="px-8 py-3 h-auto text-xs cursor-pointer flex items-center justify-center gap-2 group w-full sm:w-auto"
              >
                <span>{session?.user ? 'Buka Panel Dasbor' : 'Masuk ke Platform'}</span>
                <LogIn className="w-4 h-4 text-[#0D1B2A] group-hover:translate-x-0.5 transition-transform" />
              </Button>
              {!session?.user && (
                <Button
                  variant="brutalist-outline"
                  size="lg"
                  onClick={() => startSwipeAndNavigate('/login?register=true')}
                  className="px-6 py-3 h-auto text-xs w-full sm:w-auto"
                >
                  <span>Daftar Asisten Lab</span>
                </Button>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full py-8 text-[11px] text-[#415A77] border-t-2 border-[#0D1B2A] bg-white/60 font-mono select-none z-20 flex flex-col items-center justify-center gap-2.5">
        <Logo size={24} variant="transparent" />
        <div className="text-center px-4">
          © {new Date().getFullYear()} Sekolah Tinggi Teknologi Bontang. Sistem Deteksi Orisinalitas Laporan Praktikum.
        </div>
      </footer>

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
