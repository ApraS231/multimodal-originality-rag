import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import { 
  Menu, 
  LayoutDashboard, 
  FileCheck, 
  UserCheck, 
  FolderArchive, 
  Database, 
  BarChart 
} from 'lucide-react';
import Chatbot from './chatbot';
import { Logo } from './ui/logo';
import { useSession } from '../api/auth';

export default function SidebarLayout() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { data: session } = useSession();
  const role = session?.user?.profil?.peran || 'ASLAB';

  const getBottomNavItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { name: 'Dasbor', path: '/admin/dashboard', icon: LayoutDashboard },
          { name: 'Berkas', path: '/admin/repository', icon: FolderArchive },
          { name: 'Unggah', path: '/admin/seeding', icon: Database },
        ];
      case 'KEPALA_LAB':
        return [
          { name: 'Rekap', path: '/kepala-lab/dashboard', icon: BarChart },
          { name: 'Matriks', path: '/kepala-lab/matrix', icon: LayoutDashboard },
        ];
      case 'ASLAB':
      default:
        return [
          { name: 'Direktori', path: '/aslab/dashboard', icon: LayoutDashboard },
          { name: 'Pengecekan', path: '/aslab/checker', icon: FileCheck },
          { name: 'Profil', path: '/aslab/profile', icon: UserCheck },
        ];
    }
  };

  const bottomNavItems = getBottomNavItems();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F7F3E9] flex font-sans text-[#0D1B2A]">

      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile Header Bar (shown only on mobile) */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 flex items-center justify-between z-30 lg:hidden select-none">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Logo size={28} showText />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {role === 'ADMIN' ? 'ADMIN' : role === 'KEPALA_LAB' ? 'KEPALA LAB' : 'ASLAB'}
          </span>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Blur */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Drawer Sidebar */}
          <div className="fixed left-0 top-0 bottom-0 z-50 animate-in slide-in-from-left duration-200">
            <Sidebar 
              isMobileDrawer={true} 
              onCloseMobile={() => setMobileDrawerOpen(false)} 
            />
          </div>
        </div>
      )}

      {/* Konten Halaman Sebelah Kanan (Satu-satunya area dengan scrollbar, diberi bottom padding untuk mobile nav) */}
      <main className="flex-1 h-full overflow-y-auto relative pt-14 lg:pt-0 pb-16 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb-Zone Friendly) */}
      <nav 
        className="fixed bottom-0 left-0 right-0 h-15 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-30 lg:hidden flex items-center justify-around px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] select-none"
        aria-label="Navigasi Bawah Mobile"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#0D1B2A] font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-md transition-all ${isActive ? 'bg-[#0D1B2A] text-white shadow-2xs' : 'text-slate-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* Tombol Menu untuk membuka Drawer Seluruh Fitur */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer ${
            mobileDrawerOpen ? 'text-[#0D1B2A] font-bold' : ''
          }`}
          aria-label="Buka Semua Menu"
        >
          <div className="p-1 rounded-md text-slate-500 hover:bg-slate-100">
            <Menu className="w-4 h-4" />
          </div>
          <span>Menu</span>
        </button>
      </nav>

      {/* Floating Mascot Chatbot */}
      <Chatbot />
    </div>
  );
}
