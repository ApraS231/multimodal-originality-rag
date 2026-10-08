import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as THREE from 'three';
// @ts-expect-error - vanta does not provide official typescript definitions
import FOG from 'vanta/dist/vanta.fog.min.js';
import { 
  Lock, 
  Mail, 
  ArrowLeft, 
  User, 
  UserCheck, 
  Key, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast-provider';
import CurvedTransition from '../components/ui/curved-transition';
import { Logo } from '../components/ui/logo';

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';
  const location = useLocation();

  // Scroll to top saat halaman Login terbuka
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Vanta.js 3D Animated Fog Background Reference
  const vantaRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vantaEffect = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { THREE: typeof THREE }).THREE = THREE;
    }

    if (!vantaEffect.current && vantaRef.current) {
      try {
        let fogFn: ((opts: unknown) => unknown) | null = null;
        if (typeof window !== 'undefined' && (window as unknown as { VANTA?: { FOG?: (opts: unknown) => unknown } })?.VANTA?.FOG) {
          fogFn = (window as unknown as { VANTA: { FOG: (opts: unknown) => unknown } }).VANTA.FOG;
        }
        if (!fogFn) {
          let target: unknown = FOG;
          while (target && typeof target !== 'function' && typeof target === 'object' && 'default' in target) {
            target = (target as { default: unknown }).default;
          }
          if (typeof target === 'function') {
            fogFn = target as (opts: unknown) => unknown;
          }
        }

        if (typeof fogFn === 'function') {
          vantaEffect.current = fogFn({
            el: vantaRef.current,
            THREE: THREE,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            highlightColor: 0xffc300,
            midtoneColor: 0xff1f00,
            lowlightColor: 0x2d00ff,
            baseColor: 0xffebeb,
            blurFactor: 0.6,
            zoom: 1.0,
            speed: 1.0,
          });
        } else {
          console.error('Vanta FOG function not found after unwrapping. FOG is:', FOG);
        }
      } catch (err) {
        console.error('Failed to initialize Vanta FOG:', err);
      }
    }

    return () => {
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
    };
  }, []);

  // Membaca parameter query ?register=true
  const queryParams = new URLSearchParams(location.search);
  const showRegisterInit = queryParams.get('register') === 'true' || location.state?.register === true;

  // Membaca state transisi Curve Swipe
  const triggerSwipeOut = location.state?.triggerSwipeOut === true;
  const [renderSwipeOverlay, setRenderSwipeOverlay] = useState(triggerSwipeOut);

  // State transisi balik (Login -> Welcome)
  const [isSwipingBack, setIsSwipingBack] = useState(false);
  const [targetPathBack, setTargetPathBack] = useState<string | null>(null);

  const startSwipeBackAndNavigate = (targetPath: string) => {
    if (isSwipingBack) return;
    setTargetPathBack(targetPath);
    setIsSwipingBack(true);
  };

  // Toggle State (false = Login, true = Register)
  const [isRegister, setIsRegister] = useState(showRegisterInit);

  // States untuk Form Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // States untuk Form Register Aslab
  const [regNama, setRegNama] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNim, setRegNim] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');

  // Fungsi Fast Login khusus Asisten Lab (1-Klik langsung proses login)
  const handleFastLoginAslab = () => {
    setIsRegister(false);
    const email = 'alvin.aslab@stitek.ac.id';
    const password = 'PasswordAslab123!';
    setLoginEmail(email);
    setLoginPassword(password);
    setLoginError('');
    loginMutation.mutate({ email, password });
  };

  // 1. Mutation: Login
  const loginMutation = useMutation({
    mutationFn: async (credentials?: { email: string; password: string } | void) => {
      const email = (credentials?.email ?? loginEmail).trim();
      const password = credentials?.password ?? loginPassword;

      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(
          res.status === 404
            ? 'Endpoint API tidak ditemukan (HTTP 404). Nginx reverse proxy /api ke port 3000 belum aktif di server.'
            : `Respon server tidak valid (${res.status}): ${text.slice(0, 80)}`
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email atau kata sandi tidak valid.');
      return data;
    },
    onSuccess: async (data) => {
      setLoginError('');
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      
      const role = data.user?.profil?.peran;
      if (role === 'ADMIN') navigate('/admin/dashboard');
      else if (role === 'ASLAB') navigate('/aslab/dashboard');
      else if (role === 'KEPALA_LAB') navigate('/kepala-lab/dashboard');
      else navigate('/unauthorized');
    },
    onError: (err: any) => {
      setLoginError(err.message || 'Gagal masuk. Periksa kembali email dan kata sandi.');
    },
  });

  // 2. Mutation: Register Aslab
  const registerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${backendUrl}/api/auth/register-aslab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pendaftaran asisten gagal.');
      return data;
    },
    onSuccess: () => {
      toast.success(
        'Pendaftaran Berhasil',
        'Akun asisten laboratorium telah diajukan. Silakan tunggu persetujuan dari Administrator sebelum masuk.'
      );
      setIsRegister(false);
      setLoginEmail(regEmail.trim());
      setLoginPassword('');
      setRegNama('');
      setRegEmail('');
      setRegPassword('');
      setRegNim('');
    },
    onError: (err: any) => {
      setRegError(err.message || 'Terjadi kendala pada server saat pendaftaran.');
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Email dan kata sandi wajib diisi.');
      return;
    }
    loginMutation.mutate({ email: loginEmail.trim(), password: loginPassword });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regNama.trim() || !regEmail.trim() || !regNim.trim() || !regPassword) {
      setRegError('Semua kolom formulir pendaftaran wajib diisi.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Kata sandi minimal terdiri dari 6 karakter.');
      return;
    }
    registerMutation.mutate({
      nama: regNama.trim(),
      email: regEmail.trim(),
      password: regPassword,
      nim: regNim.trim(),
    });
  };

  return (
    <div 
      ref={vantaRef} 
      className="min-h-screen flex flex-col justify-between text-slate-900 p-4 sm:p-6 relative font-sans selection:bg-slate-900 selection:text-white overflow-hidden"
    >
      
      {/* Top Header Bar Navigasi */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 relative z-10">
        <Button 
          variant="brutalist-outline"
          size="sm"
          onClick={() => startSwipeBackAndNavigate('/')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5 text-[#0D1B2A]" />}
        >
          <span>Kembali ke Portal</span>
        </Button>
      </div>

      {/* Kartu Utama */}
      <div className="w-full max-w-[440px] mx-auto my-auto py-4 relative z-10">
        <div className="bg-white/95 backdrop-blur-xs rounded border-2 border-[#0D1B2A] shadow-[4px_4px_0px_#D4AF37] overflow-hidden">
          <div className="p-6 sm:p-8 space-y-5">
            {/* Header Brand Terpadu */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <Logo size={42} variant="badge" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-base font-brutalism font-black tracking-tight text-[#0D1B2A] uppercase">VERITAS</span>
                  <span className="text-[10px] font-semibold text-[#415A77] uppercase tracking-wider font-mono">STITEK BONTANG</span>
                </div>
              </div>

              <div className="pt-2">
                <h1 className="text-base font-brutalism font-bold tracking-tight text-[#0D1B2A]">
                  {isRegister ? 'Registrasi Asisten Lab' : 'Masuk ke Sistem'}
                </h1>
                <p className="text-xs text-[#415A77] max-w-[320px] mx-auto leading-relaxed mt-0.5">
                  {isRegister 
                    ? 'Pendaftaran akun mahasiswa untuk asisten laboratorium baru.'
                    : 'Sistem Deteksi Orisinalitas Laporan Praktikum'}
                </p>
              </div>
            </div>

            {/* Segmented Tab Switcher (Masuk / Daftar) */}
            <div className="grid grid-cols-2 p-1 bg-[#0D1B2A]/5 rounded border-2 border-[#0D1B2A]/15 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setRegError('');
                }}
                className={`h-8 rounded text-center text-xs font-semibold flex items-center justify-center transition-all duration-150 ease-out cursor-pointer ${
                  !isRegister 
                    ? 'bg-white text-[#0D1B2A] shadow-[1px_1px_0px_#D4AF37] font-bold border border-[#0D1B2A]' 
                    : 'text-[#415A77] hover:text-[#0D1B2A]'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setLoginError('');
                }}
                className={`h-8 rounded text-center text-xs font-semibold flex items-center justify-center transition-all duration-150 ease-out cursor-pointer ${
                  isRegister 
                    ? 'bg-white text-[#0D1B2A] shadow-[1px_1px_0px_#D4AF37] font-bold border border-[#0D1B2A]' 
                    : 'text-[#415A77] hover:text-[#0D1B2A]'
                }`}
              >
                Daftar Asisten
              </button>
            </div>

            {/* =============================================================== */}
            {/* 1. FORMULIR MASUK (LOGIN)                                       */}
            {/* =============================================================== */}
            {!isRegister ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-400 text-rose-800 text-xs rounded flex items-start gap-2 font-medium animate-fade-in shadow-[2px_2px_0px_rgba(220,38,38,0.15)]">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Institusi
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="nama@stitek.ac.id"
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="pl-9 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                      title={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Tombol Submit Login Menggunakan Komponen Button */}
                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="brutalist"
                    size="lg"
                    loading={loginMutation.isPending}
                    className="w-full h-10 text-xs"
                  >
                    Masuk ke Sistem
                  </Button>
                </div>

                {/* Kompartemen Fast Login Asisten Lab (1-Klik Langsung Masuk) */}
                <div className="p-3 rounded-lg bg-[#F7F3E9] border-2 border-[#0D1B2A]/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Akses Instan Pengujian</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#0D1B2A] font-mono font-bold">
                      1-KLIK
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFastLoginAslab}
                    disabled={loginMutation.isPending}
                    className="w-full py-2 px-3 bg-white hover:bg-[#F7F3E9] text-[#0D1B2A] rounded-md border-2 border-[#0D1B2A] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[2px_2px_0px_#D4AF37] hover:shadow-[3px_3px_0px_#0D1B2A] active:translate-y-0.5 active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    title="Masuk langsung sebagai Asisten Laboratorium (Alvin) tanpa mengetik sandi"
                  >
                    <UserCheck className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      {loginMutation.isPending ? 'Memproses Masuk...' : 'Fast Login Asisten Lab (Alvin)'}
                    </span>
                  </button>
                  <p className="text-[10px] text-slate-500 text-center font-mono">
                    alvin.aslab@stitek.ac.id
                  </p>
                </div>
              </form>
            ) : (
              /* Formulir Registrasi Asisten */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {regError && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-400 text-rose-800 text-xs rounded flex items-start gap-2 font-medium animate-fade-in shadow-[2px_2px_0px_rgba(220,38,38,0.15)]">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {/* Nama Lengkap */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="text"
                      required
                      value={regNama}
                      onChange={(e) => setRegNama(e.target.value)}
                      placeholder="Alvin Ramadhan"
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* NIM */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    NIM Mahasiswa
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="text"
                      required
                      value={regNim}
                      onChange={(e) => setRegNim(e.target.value)}
                      placeholder="contoh: 2201001"
                      className="pl-9 font-mono"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Kampus
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="aslab@stitek.ac.id"
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi (Min. 6 Karakter)
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="pl-9 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                      title={showRegPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Tombol Submit Register */}
                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="brutalist"
                    size="lg"
                    loading={registerMutation.isPending}
                    className="w-full h-10 text-xs"
                  >
                    Kirim Pendaftaran
                  </Button>
                </div>
              </form>
            )}

            {/* Helper Switch Bawah */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
              >
                {isRegister ? (
                  <span>Sudah memiliki akun terdaftar? <strong className="text-[#0D1B2A] underline font-semibold">Masuk di sini</strong></span>
                ) : (
                  <span>Belum memiliki akun asisten? <strong className="text-[#0D1B2A] underline font-semibold">Daftar sekarang</strong></span>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Footer Hak Cipta Ringkas */}
      <div className="w-full text-center py-2 text-[11px] text-[#0D1B2A] font-mono font-bold relative z-10 flex items-center justify-center gap-2">
        <Logo size={16} variant="transparent" />
        <span>© 2026 VERITAS • STITEK Bontang</span>
      </div>

      {/* Curved Box Wipe Out Transition Overlay (Revealing Login) */}
      {renderSwipeOverlay && (
        <CurvedTransition 
          mode="reveal-to-left" 
          duration={0.75} 
          onComplete={() => {
            setRenderSwipeOverlay(false);
            window.history.replaceState({}, document.title);
          }} 
        />
      )}

      {/* Curved Box Wipe Back Transition Overlay (Login -> Welcome) */}
      {isSwipingBack && (
        <CurvedTransition 
          mode="enter-from-left" 
          duration={0.75} 
          onComplete={() => {
            navigate(targetPathBack || '/', { state: { triggerSwipeOutBack: true } });
          }}
        />
      )}

    </div>
  );
}
