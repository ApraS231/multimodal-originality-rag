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
  BarChart,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Chatbot from './chatbot';
import { Logo } from './ui/logo';
import { useSession } from '../api/auth';

export default function SidebarLayout() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobileTabVisible, setIsMobileTabVisible] = useState(true);
  const { data: session } = useSession();
  const role = session?.user?.profil?.peran || 'ASLAB';

  const getMobileTabItems = () => {
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

  const mobileTabItems = getMobileTabItems();

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
            aria-label="Buka menu navigasi lengkap"
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

      {/* Mobile Drawer Overlay (Full Menu Sidebar) */}
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

      {/* Interactive Mobile Side Tab (Pengganti Bottom Navbar - Ramping, Interaktif, dan Cepat) */}
      <div className="lg:hidden">
        {isMobileTabVisible ? (
          <aside 
            className="fixed left-0 top-18 z-40 bg-white/95 backdrop-blur-md border-r border-y border-slate-200/90 rounded-r-2xl shadow-[0_8px_24px_rgba(13,27,42,0.12)] py-2 px-1 flex flex-col items-center gap-1.5 animate-in slide-in-from-left duration-200 select-none"
            aria-label="Side Tab Navigasi Mobile"
          >
            {/* Nav Items Ramping */}
            <div className="flex flex-col items-center gap-1">
              {mobileTabItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.name}
                    className={({ isActive }) =>
                      `w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#0D1B2A] text-white shadow-xs scale-102 font-bold'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </NavLink>
                );
              })}
            </div>

            <div className="w-6 h-[1px] bg-slate-200 my-0.5" />

            {/* Tombol Buka Menu Penuh (Drawer) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Buka menu lengkap"
              aria-label="Buka menu lengkap"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            {/* Tombol Ciutkan Tab ke Tepi Layar */}
            <button
              type="button"
              onClick={() => setIsMobileTabVisible(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer mt-0.5"
              title="Sembunyikan tab ke tepi layar"
              aria-label="Ciutkan tab ke tepi layar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </aside>
        ) : (
          /* Handle Tab Menempel di Pinggir Layar saat Diciutkan */
          <button
            type="button"
            onClick={() => setIsMobileTabVisible(true)}
            className="fixed left-0 top-22 z-40 w-5 h-12 bg-[#0D1B2A] text-white rounded-r-lg shadow-md flex items-center justify-center cursor-pointer hover:w-6 transition-all duration-200 animate-in fade-in"
            title="Tampilkan Side Tab Navigasi"
            aria-label="Tampilkan Side Tab Navigasi"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#D4AF37]" />
          </button>
        )}
      </div>

      {/* Konten Halaman Sebelah Kanan (Satu-satunya area dengan scrollbar, bebas dari bottom bar) */}
      <main className="flex-1 h-full overflow-y-auto relative pt-14 lg:pt-0 pb-4 lg:pb-0">
        <Outlet />
      </main>

      {/* Floating Mascot Chatbot (Bisa di-drag bebas ke mana saja + stick to edge) */}
      <Chatbot />
    </div>
  );
}
