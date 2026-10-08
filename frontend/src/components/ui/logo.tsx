import React from 'react';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  variant?: 'transparent' | 'brass' | 'white' | 'badge';
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
  '2xl': 64,
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'transparent',
  showText = false,
  subtitle = 'STITEK BONTANG',
  className = '',
  imageClassName = '',
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 34;

  let imageSrc = '/logo-transparent.png';
  if (variant === 'brass') imageSrc = '/logo-brass.png';
  else if (variant === 'white') imageSrc = '/logo-white.png';

  const renderImage = () => (
    <img
      src={imageSrc}
      alt="Logo Veritas STITEK Bontang"
      className={`shrink-0 select-none object-contain block bg-transparent border-0 shadow-none ${imageClassName}`}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      loading="eager"
    />
  );

  if (!showText) {
    return (
      <div className={`inline-flex items-center justify-center bg-transparent border-0 p-0 m-0 ${className}`}>
        {renderImage()}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 bg-transparent border-0 ${className}`}>
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
