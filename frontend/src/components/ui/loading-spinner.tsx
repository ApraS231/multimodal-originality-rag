import React from 'react';

interface LoadingSpinnerProps {
  /** 'fullpage' = center screen, 'inline' = inline block, 'skeleton' = shimmer bars */
  variant?: 'fullpage' | 'inline' | 'skeleton';
  /** Teks keterangan di bawah spinner */
  message?: string;
  /** Jumlah baris skeleton (hanya untuk variant skeleton) */
  skeletonRows?: number;
}

export default function LoadingSpinner({ 
  variant = 'fullpage', 
  message = 'Memuat data...', 
  skeletonRows = 4 
}: LoadingSpinnerProps) {

  if (variant === 'skeleton') {
    return (
      <div className="space-y-3 animate-fade-in p-2">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <div 
              className="h-4 bg-slate-200/80 rounded-lg skeleton-shimmer" 
              style={{ width: `${65 + Math.random() * 30}%`, animationDelay: `${i * 0.12}s` }} 
            />
          </div>
        ))}
      </div>
    );
  }

  const spinner = (
    <svg className="animate-spin h-7 w-7 text-[#0D1B2A]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2.5 text-slate-600 py-2">
        {spinner}
        {message && <span className="text-xs font-semibold">{message}</span>}
      </div>
    );
  }

  // fullpage
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-600 space-y-3 animate-fade-in">
      {spinner}
      {message && <span className="text-xs font-semibold">{message}</span>}
    </div>
  );
}
