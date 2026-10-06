import { type LucideIcon, AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  /** Ikon Lucide kustom (default AlertTriangle) */
  icon?: LucideIcon;
  /** Judul pesan kesalahan */
  title?: string;
  /** Penjelasan detail kendala */
  description?: string;
  /** Label tombol coba kembali */
  retryLabel?: string;
  /** Handler ketika tombol retry diklik */
  onRetry?: () => void;
  /** Pesan teknis atau error code opsional */
  errorCode?: string | number;
}

/**
 * Komponen ErrorState terpadu sesuai standar antislop R-27 dan tema STITEK Bontang.
 * Memastikan antarmuka tangguh menghadapi kendala jaringan atau server.
 */
export default function ErrorState({
  icon: Icon = AlertTriangle,
  title = 'Gagal Memuat Data',
  description = 'Terjadi kendala saat mengambil informasi dari server. Silakan muat ulang atau coba beberapa saat lagi.',
  retryLabel = 'Coba Lagi',
  onRetry,
  errorCode
}: ErrorStateProps) {
  return (
    <div 
      role="alert" 
      aria-live="assertive"
      className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3.5 animate-fade-in"
    >
      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400">
        <Icon className="w-7 h-7" />
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
        {errorCode && (
          <p className="text-[11px] font-mono text-rose-600/80 dark:text-rose-400 mt-1">
            Kode Status: {errorCode}
          </p>
        )}
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-[#F7F3E9] text-xs font-semibold rounded-md shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
}
