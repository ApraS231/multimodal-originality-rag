import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Chatbot from './chatbot';
import { useSession, useLogout } from '../api/auth';
import { Logo } from './ui/logo';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Terminal, 
  Database, 
  Cpu, 
  Activity, 
  ShieldAlert, 
  TrendingUp, 
  FileCheck, 
  BarChart, 
  UserCheck, 
  LogOut, 
  GraduationCap, 
  FolderArchive,
  Menu,
  X
} from 'lucide-react';

export default function SidebarLayout() {
  const { data: session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const role = session?.user?.profil?.peran || 'ASLAB';
  const userName = session?.user?.nama || 'Pengguna';
  const initial = (userName || 'P').charAt(0).toUpperCase();

  // Menutup drawer saat rute berpindah atau tombol Escape ditekan
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    if (isDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Diabaikan
    }
    navigate('/login');
  };

  // Navigasi lengkap untuk Slide-Over Drawer
  const getNavItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { name: 'Dasbor Utama', path: '/admin/dashboard', icon: LayoutDashboard },
          { name: 'Program Studi', path: '/admin/prodi', icon: GraduationCap },
          { name: 'Kelas Praktikum', path: '/admin/kelas', icon: BookOpen },
          { name: 'Mata Kuliah', path: '/admin/matkul', icon: Terminal },
          { name: 'Cloud Seeding', path: '/admin/seeding', icon: Database },
          { name: 'Direktori Berkas', path: '/admin/repository', icon: FolderArchive },
          { name: 'Konfigurasi AI', path: '/admin/ai-config', icon: Cpu },
          { name: 'Antrean Dokumen', path: '/admin/queue-monitor', icon: Activity },
          { name: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldAlert },
          { name: 'Biaya AI', path: '/admin/analytics', icon: TrendingUp },
          { name: 'Manajemen Pengguna', path: '/admin/users', icon: Users },
        ];
      case 'ASLAB':
        return [
          { name: 'Direktori Laporan', path: '/aslab/dashboard', icon: LayoutDashboard },
          { name: 'Pengecekan Dokumen', path: '/aslab/checker', icon: FileCheck },
          { name: 'Profil & Pengampu', path: '/aslab/profile', icon: UserCheck },
        ];
      case 'KEPALA_LAB':
        return [
          { name: 'Rekapitulasi', path: '/kepala-lab/dashboard', icon: BarChart },
          { name: 'Matriks Nilai', path: '/kepala-lab/matrix', icon: LayoutDashboard },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F7F3E9] flex font-sans text-[#0D1B2A]">
      {/* 1. DESKTOP SIDEBAR (Tampil utuh pada breakpoint lg ke atas) */}
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>

      {/* 2. AREA UTAMA (100% Lebar penuh pada layar ponsel, tidak terhimpit side strip) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden w-full">
        {/* 2.1 HEADER APLIKASI MOBILE (Ramping, Terpadu & Bernilai Ergonomis Tinggi) */}
        <header className="h-13 bg-white/95 dark:bg-[#152238]/95 backdrop-blur-md border-b border-[#415A77]/15 px-3 sm:px-4 flex items-center justify-between z-20 lg:hidden select-none shrink-0 sticky top-0 shadow-2xs">
          {/* Sisi Kiri: Tombol Pemicu Menu Drawer & Identitas Kampus */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#0D1B2A] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              aria-label="Buka Menu Navigasi"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0D1B2A] dark:text-[#F7F3E9] tracking-wider uppercase leading-none">VERITAS</span>
                <span className="text-[9px] text-[#415A77] dark:text-[#A4B3C6] font-mono leading-none mt-0.5">STITEK BONTANG</span>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Lencana Peran & Avatar Pengguna */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#415A77]/10 text-[#0D1B2A] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] border border-[#415A77]/20">
              {role === 'ADMIN' ? 'ADMIN' : role === 'KEPALA_LAB' ? 'KEPALA LAB' : 'ASLAB'}
            </span>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-8 h-8 rounded-full bg-[#0D1B2A] text-white dark:bg-[#D4AF37] dark:text-[#0D1B2A] font-bold text-xs flex items-center justify-center shadow-2xs hover:ring-2 hover:ring-[#D4AF37] transition-all cursor-pointer"
              title={`Menu Pengguna (${userName})`}
              aria-label={`Menu Pengguna ${userName}`}
            >
              {initial}
            </button>
          </div>
        </header>

        {/* 2.2 KONTEN UTAMA HALAMAN */}
        <main className="flex-1 h-full overflow-y-auto relative pb-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* 3. SLIDE-OVER NAVIGATION DRAWER (SIDEBAR MOBILE) */}
      {isDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 lg:hidden bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Panel Navigasi Samping"
        >
          <div 
            className="fixed inset-y-0 left-0 w-[285px] max-w-[85vw] bg-white dark:bg-[#152238] shadow-2xl flex flex-col border-r border-[#415A77]/20 animate-in slide-in-from-left duration-250 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div className="h-14 px-4 border-b border-[#415A77]/15 flex items-center justify-between shrink-0 bg-[#F7F3E9]/50 dark:bg-[#0D1B2A]/50">
              <div className="flex items-center gap-2">
                <Logo size={26} />
                <div>
                  <span className="text-xs font-bold text-[#0D1B2A] dark:text-[#F7F3E9] tracking-wider uppercase block">VERITAS</span>
                  <span className="text-[9.5px] text-[#415A77] dark:text-[#A4B3C6] font-mono block">Deteksi Orisinalitas</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Kartu Profil Pengguna */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#152238]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0D1B2A] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 border border-slate-700/80">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#0D1B2A] dark:text-white truncate">{userName}</p>
                  <span className="inline-block mt-0.5 text-[9.5px] font-mono px-2 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Daftar Navigasi Lengkap */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
              <p className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2.5 pb-1 font-mono">
                Navigasi Menu
              </p>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#0D1B2A] text-white shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-[#A4B3C6] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Footer Drawer dengan Aksi Keluar */}
            <div className="p-3 border-t border-[#415A77]/15 bg-[#F7F3E9]/40 dark:bg-[#0D1B2A]/40 shrink-0">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Sistem</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. Maskot Mochi Veritas AI (Draggable bebas dengan posisi default aman) */}
      <Chatbot />
    </div>
  );
}
