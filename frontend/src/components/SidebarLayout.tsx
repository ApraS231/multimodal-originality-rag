import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Chatbot from './chatbot';
import { useSession } from '../api/auth';

export default function SidebarLayout() {
  const { data: session } = useSession();
  const role = session?.user?.profil?.peran || 'ASLAB';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F7F3E9] flex font-sans text-[#0D1B2A]">
      {/* Side Tab di Mobile (w-13 sm:w-14) / Sidebar Penuh di Desktop (w-64 atau w-16) */}
      <Sidebar />

      {/* Kolom Konten Sebelah Kanan (Berdampingan bersih, tidak ada tabrakan visual) */}
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
