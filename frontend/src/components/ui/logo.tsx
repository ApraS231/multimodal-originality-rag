import React from 'react';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  variant?: 'badge' | 'transparent' | 'brass' | 'white' | 'raw';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  imageClassName?: string;
}

const sizeMap = {
  xs: 20,
  sm: 26,
  md: 34,
  lg: 42,
  xl: 52,
  '2xl': 68,
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'badge',
  showText = false,
  subtitle = 'STITEK BONTANG',
  className = '',
  imageClassName = '',
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 34;

  let imageSrc = '/logo.png';
  if (variant === 'transparent') imageSrc = '/logo-transparent.png';
  else if (variant === 'brass') imageSrc = '/logo-brass.png';
  else if (variant === 'white') imageSrc = '/logo-white.png';

  const renderImage = () => {
    if (variant === 'badge') {
      return (
        <div 
          className={`relative rounded-md overflow-hidden bg-[#F7F3E9] border-2 border-[#0D1B2A] shadow-[2px_2px_0px_#D4AF37] flex items-center justify-center shrink-0 select-none ${imageClassName}`}
          style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
        >
          <img
            src="/logo.png"
            alt="Veritas Logo"
            className="w-full h-full object-cover p-0.5"
            loading="eager"
          />
        </div>
      );
    }

    return (
      <img
        src={imageSrc}
        alt="Veritas Logo"
        className={`shrink-0 select-none object-contain ${imageClassName}`}
        style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
        loading="eager"
      />
    );
  };

  if (!showText) {
    return <div className={`inline-flex items-center ${className}`}>{renderImage()}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {renderImage()}
      <div className="flex flex-col text-left leading-tight select-none">
        <span className="font-brutalism font-black tracking-tight text-[#0D1B2A] dark:text-[#F7F3E9] text-sm uppercase">
          VERITAS
        </span>
        {subtitle && (
          <span className="text-[10px] font-mono font-semibold text-[#415A77] dark:text-[#A4B3C6] tracking-wider uppercase">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
