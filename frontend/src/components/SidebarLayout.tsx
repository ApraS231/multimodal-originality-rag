import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
  FolderArchive 
} from 'lucide-react';

// Side Tab Khusus Tampilan Layar Mobile (Ramping, Terintegrasi, Bebas dari Drawer / Modal Popup)
function MobileSideTab({ role, userName }: { role: string; userName: string }) {
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const initial = (userName || 'P').charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Ignored
    }
    navigate('/login');
  };

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
    <aside 
      className="w-13 sm:w-14 bg-white dark:bg-[#152238] border-r border-[#415A77]/20 flex flex-col h-screen flex-shrink-0 relative z-20 font-sans select-none"
      aria-label="Side Tab Mobile Veritas"
    >
      {/* Brand Icon Mini */}
      <div className="h-13 px-2 border-b border-[#415A77]/20 flex items-center justify-center shrink-0">
        <Logo size={28} />
      </div>

      {/* Rel Ikon Navigasi Lengkap (Dapat di-scroll vertikal halus tanpa scrollbar kasar) */}
      <nav 
        className="flex-1 overflow-y-auto px-1.5 py-2.5 flex flex-col items-center gap-1.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.name}
              className={({ isActive }) =>
                `w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0D1B2A] text-white shadow-xs font-bold scale-102'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-[#A4B3C6]'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5" />
            </NavLink>
          );
        })}
      </nav>

      {/* Profil Singkat & Tombol Keluar */}
      <div className="p-1.5 border-t border-[#415A77]/20 bg-[#F7F3E9]/50 dark:bg-[#152238] flex flex-col items-center gap-1.5 shrink-0">
        <div 
          className="w-8 h-8 rounded-lg bg-[#415A77]/15 text-[#0D1B2A] dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] flex items-center justify-center font-bold text-xs shadow-2xs" 
          title={userName}
        >
          {initial}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Keluar"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}

export default function SidebarLayout() {
  const { data: session } = useSession();
  const role = session?.user?.profil?.peran || 'ASLAB';
  const userName = session?.user?.nama || 'Pengguna';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F7F3E9] flex font-sans text-[#0D1B2A]">
      {/* 1. Desktop Sidebar (Utuh seperti semula, w-64 atau w-16 saat diciutkan) */}
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>

      {/* 2. Mobile Side Tab (Khusus mobile, w-13/w-14 ramping berdampingan dengan konten) */}
      <div className="flex lg:hidden h-full">
        <MobileSideTab role={role} userName={userName} />
      </div>

      {/* 3. Kolom Konten Sebelah Kanan (Berdampingan bersih, tidak ada tabrakan visual) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Mobile Header Bar Ringkas (Penanda Sistem & Role Badge) */}
        <header className="h-13 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3.5 flex items-center justify-between z-10 lg:hidden select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#0D1B2A] tracking-wider uppercase">Veritas</span>
            <span className="text-[10px] text-slate-400 font-mono">STITEK</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {role === 'ADMIN' ? 'ADMIN' : role === 'KEPALA_LAB' ? 'KEPALA LAB' : 'ASLAB'}
          </span>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 h-full overflow-y-auto relative">
          <Outlet />
        </main>
      </div>

      {/* Floating Mascot Chatbot (Draggable bebas ke mana saja + stick to edge) */}
      <Chatbot />
    </div>
  );
}
