import React from 'react';
import { type LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  /** Ikon Lucide untuk ditampilkan */
  icon?: LucideIcon;
  /** Judul pesan kosong */
  title?: string;
  /** Deskripsi pesan kosong */
  description?: string;
  /** Teks tombol aksi (opsional) */
  actionLabel?: string;
  /** Handler klik tombol aksi */
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Belum ada data',
  description = 'Data belum tersedia saat ini.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in space-y-3.5">
      <div className="p-3.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700 text-slate-400 dark:text-slate-400">
        <Icon className="w-7 h-7" />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-3.5 py-1.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-[#F7F3E9] text-xs font-semibold rounded-md shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
