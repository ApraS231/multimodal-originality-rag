import React from 'react';

type StatusType =
  | 'COMPLETED'
  | 'PROCESSING'
  | 'QUEUED'
  | 'FAILED'
  | 'VERIFIED'
  | 'DRAFT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'FORCE_FAIL'
  | 'TRIGGER'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  /** Ukuran badge */
  size?: 'sm' | 'md';
  /** Animasi pulse untuk status aktif */
  pulse?: boolean;
  /** Bentuk sudut badge: 'rounded' (rounded-md 6px per R-11) atau 'pill' (rounded-full) */
  variant?: 'rounded' | 'pill';
  /** Tampilkan titik indikator mikro */
  showDot?: boolean;
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  COMPLETED: {
    badge: 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/30 dark:bg-[#415A77]/25 dark:text-[#F7F3E9] dark:border-[#415A77]/60',
    dot: 'bg-[#0D1B2A] dark:bg-[#D4AF37]',
  },
  VERIFIED: {
    badge: 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/30 dark:bg-[#415A77]/25 dark:text-[#F7F3E9] dark:border-[#415A77]/60',
    dot: 'bg-[#0D1B2A] dark:bg-[#D4AF37]',
  },
  CREATE: {
    badge: 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/30 dark:bg-[#415A77]/25 dark:text-[#F7F3E9] dark:border-[#415A77]/60',
    dot: 'bg-[#0D1B2A] dark:bg-[#D4AF37]',
  },
  PROCESSING: {
    badge: 'text-[#8C6D1F] bg-[#D4AF37]/15 border-[#D4AF37]/40 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:border-[#D4AF37]/50',
    dot: 'bg-[#D4AF37]',
  },
  QUEUED: {
    badge: 'text-[#415A77] bg-[#415A77]/10 border-[#415A77]/25 dark:bg-[#152238] dark:text-[#A4B3C6] dark:border-[#415A77]/40',
    dot: 'bg-[#415A77]',
  },
  DRAFT: {
    badge: 'text-[#8C6D1F] bg-[#D4AF37]/15 border-[#D4AF37]/40 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:border-[#D4AF37]/50',
    dot: 'bg-[#D4AF37]',
  },
  UPDATE: {
    badge: 'text-[#0D1B2A] bg-[#415A77]/15 border-[#415A77]/35 dark:bg-[#152238] dark:text-[#F7F3E9] dark:border-[#415A77]/50',
    dot: 'bg-[#415A77]',
  },
  TRIGGER: {
    badge: 'text-[#8C6D1F] bg-[#D4AF37]/15 border-[#D4AF37]/40 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:border-[#D4AF37]/50',
    dot: 'bg-[#D4AF37]',
  },
  FAILED: {
    badge: 'text-rose-800 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-600',
  },
  DELETE: {
    badge: 'text-rose-800 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-600',
  },
  FORCE_FAIL: {
    badge: 'text-rose-800 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-600',
  },
};

export default function StatusBadge({
  status,
  size = 'sm',
  pulse = false,
  variant = 'rounded',
  showDot = true,
}: StatusBadgeProps) {
  const currentStyle = STATUS_STYLES[status] || {
    badge: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  };

  const autoAnimate = (status === 'PROCESSING' || status === 'QUEUED') && pulse;

  const sizeClass =
    size === 'md'
      ? 'text-[11px] px-2.5 py-1 gap-1.5'
      : 'text-[10px] px-2 py-0.5 gap-1.2';

  const radiusClass = variant === 'pill' ? 'rounded-full' : 'rounded-md';

  return (
    <span
      data-slot="status-badge"
      className={`inline-flex items-center border font-bold uppercase tracking-wider font-mono select-none ${radiusClass} ${sizeClass} ${currentStyle.badge} ${
        autoAnimate ? 'animate-pulse' : ''
      }`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentStyle.dot} ${
            autoAnimate ? 'animate-ping opacity-75' : ''
          }`}
        />
      )}
      <span>{status}</span>
    </span>
  );
}
