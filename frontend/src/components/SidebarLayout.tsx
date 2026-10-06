import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';
import Chatbot from './chatbot';

export default function SidebarLayout() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#F7F3E9] overflow-hidden flex font-sans text-[#0D1B2A]">

      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile Header Bar (shown only on mobile) */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between z-30 lg:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileDrawerOpen(true)}
            className="p-2 rounded-md hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            aria-label="Buka navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold text-sm tracking-tight text-slate-900">VERITAS</div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 z-50 lg:hidden animate-slide-in-right">
            <div className="relative">
              <button 
                onClick={() => setMobileDrawerOpen(false)}
                className="absolute top-3 right-[-42px] p-1.5 bg-white rounded-md border border-slate-200 text-slate-700 cursor-pointer shadow-md z-50"
                aria-label="Tutup navigasi"
              >
                <X className="w-4 h-4" />
              </button>
              <Sidebar />
            </div>
          </div>
        </>
      )}

      {/* Konten Halaman Sebelah Kanan */}
      <main className="flex-1 h-screen overflow-y-auto relative pt-14 lg:pt-0">
        <Outlet />
      </main>

      {/* Floating Mascot Chatbot */}
      <Chatbot />
    </div>
  );
}
