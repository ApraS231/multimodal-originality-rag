import React, { useState } from 'react';
import { CoucouMochi } from './coucou-mochi';
import { Mascot } from 'page-mascot';

interface MascotAvatarProps {
  size?: number;
  className?: string;
  onClick?: () => void;
  showStatusDot?: boolean;
  speechText?: string;
  label?: string;
  directionsUrl?: string;
  reactionsUrl?: string;
  useSmoothCanvas?: boolean;
  status?: 'idle' | 'typing' | 'thinking' | 'success';
}

export function MascotAvatar({
  size = 140,
  className = '',
  onClick,
  showStatusDot = false,
  speechText,
  label = 'Veritas Mascot AI',
  directionsUrl = '/mascots/mochi-directions.webp',
  reactionsUrl = '/mascots/mochi-reactions.webp',
  useSmoothCanvas = true,
  status = 'idle',
}: MascotAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Balon sapaan interaktif saat kursor mendekat atau diarahkan */}
      {speechText && (
        <div
          className={`absolute -top-9 z-20 pointer-events-none transition-all duration-300 transform ${
            isHovered
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-95 -translate-y-0.5 scale-95'
          }`}
        >
          <div className="bg-[#0D1B2A] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap border border-slate-700/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span>{speechText}</span>
          </div>
          {/* Panah kecil balon obrolan */}
          <div className="w-2.5 h-2.5 bg-[#0D1B2A] border-r border-b border-slate-700/80 transform rotate-45 mx-auto -mt-1.5" />
        </div>
      )}

      {/* Komponen Maskot Interaktif dengan animasi mulus 60 FPS */}
      <div className="relative group cursor-pointer transition-all duration-300 active:scale-95 filter drop-shadow-md hover:drop-shadow-xl">
        {useSmoothCanvas ? (
          <CoucouMochi
            size={size}
            label={label}
            onClick={onClick}
            status={status}
          />
        ) : (
          <Mascot
            directions={directionsUrl}
            reactions={reactionsUrl}
            size={size}
            label={label}
          />
        )}

        {/* Indikator Status Online AI */}
        {showStatusDot && (
          <span
            className={`absolute rounded-full bg-[#415A77]/100 border-2 border-white shadow-xs pointer-events-none ${
              size >= 120 
                ? 'bottom-2.5 right-2.5 w-4 h-4' 
                : 'bottom-1 right-1 w-3 h-3'
            }`}
            title="Veritas AI Online"
          />
        )}
      </div>
    </div>
  );
}

export default MascotAvatar;
