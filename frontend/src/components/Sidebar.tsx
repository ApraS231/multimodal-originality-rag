import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../api/auth';
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
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  FolderArchive
} from 'lucide-react';
import { Logo } from './ui/logo';

const STORAGE_KEY = 'veritas-sidebar-collapsed';

export default function Sidebar() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const role = session?.user?.profil?.peran || 'ASLAB';
  const userName = session?.user?.nama || 'Pengguna';
  const initial = userName.charAt(0).toUpperCase();

  // Collapse state persisted in localStorage (hanya berlaku di desktop)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(isCollapsed)); } catch { /* noop */ }
  }, [isCollapsed]);

  const handleLogout = async () => {
    const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';
    await fetch(`${backendUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    navigate('/login');
  };

  // Definisikan item navigasi berdasarkan peran
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
      className={`sidebar-transition bg-white dark:bg-[#152238] border-r border-[#415A77]/20 flex flex-col h-screen flex-shrink-0 relative z-20 font-sans select-none
        w-13 sm:w-14 lg:${isCollapsed ? 'w-16' : 'w-64'}
      `}
      aria-label="Navigasi Veritas STITEK"
    >
      {/* Brand Section */}
      <div className="h-13 sm:h-14 px-2 sm:px-3.5 border-b border-[#415A77]/20 flex items-center justify-center lg:justify-between overflow-hidden shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size={32} />
          <div 
            className="hidden lg:flex flex-col min-w-0 animate-fade-in" 
            style={{ display: isCollapsed ? 'none' : 'flex' }}
          >
            <span className="text-sm font-bold tracking-tight text-[#0D1B2A] dark:text-[#F7F3E9] leading-none">VERITAS</span>
            <span className="text-[10px] font-medium text-[#415A77] dark:text-[#A4B3C6] mt-1 tracking-wider leading-none">STITEK BONTANG</span>
          </div>
        </div>
      </div>

      {/* Nav Items Section (Scrollable untuk mengakomodasi seluruh menu) */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-1.5 sm:px-2 lg:px-3 py-3 space-y-1">
        <span 
          className="text-[10px] font-semibold text-[#415A77] dark:text-[#A4B3C6] uppercase tracking-wider px-2 mb-2 font-mono hidden lg:block"
          style={{ display: isCollapsed ? 'none' : 'block' }}
        >
          Menu Utama
        </span>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.name}
              className={({ isActive }) => 
                `flex items-center justify-center lg:${isCollapsed ? 'justify-center' : 'justify-start'} gap-2.5 p-2 lg:${isCollapsed ? 'px-0 py-2.5' : 'px-3 py-2.5'} rounded-xl lg:rounded-lg text-xs font-medium transition-all ${
                  isActive 
                    ? 'bg-[#0D1B2A] text-[#F7F3E9] lg:border-l-2 lg:border-[#D4AF37] shadow-xs font-semibold scale-102 lg:scale-100' 
                    : 'text-[#415A77] hover:bg-[#F7F3E9] hover:text-[#0D1B2A] dark:text-[#A4B3C6] dark:hover:bg-[#1B2B3E] dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5 lg:w-4 lg:h-4 flex-shrink-0" />
              <span 
                className="hidden lg:inline truncate"
                style={{ display: isCollapsed ? 'none' : undefined }}
              >
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle Button (Hanya tampil di Desktop) */}
      <div className="hidden lg:block px-3 py-2 flex-shrink-0 border-t border-slate-200">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2 py-1.5 px-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer`}
          title={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        >
          {!isCollapsed && <span>Ciutkan</span>}
          {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Footer Profile Block */}
      <div className="p-1.5 sm:p-2 lg:p-3 border-t border-[#415A77]/20 bg-[#F7F3E9]/50 dark:bg-[#152238] flex flex-col gap-1.5 lg:gap-2 flex-shrink-0">
        <div className={`flex items-center justify-center lg:${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-8 h-8 rounded-md bg-[#415A77]/15 text-[#0D1B2A] dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0" title={userName}>
            {initial}
          </div>
          <div 
            className="hidden lg:flex flex-col min-w-0 animate-fade-in"
            style={{ display: isCollapsed ? 'none' : 'flex' }}
          >
            <span className="text-xs font-semibold text-[#0D1B2A] dark:text-[#F7F3E9] truncate leading-tight">{userName}</span>
            <span className="text-[10px] font-medium text-[#415A77] dark:text-[#A4B3C6] leading-none mt-1">
              {role === 'ADMIN' ? 'Administrator' : role === 'KEPALA_LAB' ? 'Kepala Lab' : 'Asisten Lab'}
            </span>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          title="Keluar dari sistem"
          className="w-full min-h-[36px] flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[#415A77]/20 hover:border-rose-200 hover:bg-rose-50 text-[#415A77] hover:text-rose-600 text-xs font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span 
            className="hidden lg:inline"
            style={{ display: isCollapsed ? 'none' : undefined }}
          >
            Keluar
          </span>
        </button>
      </div>
    </aside>
  );
}
