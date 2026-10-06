import React from 'react';
import { cn } from '@/lib/utils';

export interface GroupedListProps extends React.ComponentProps<'div'> {
  /** Label judul grup seksi (opsional) */
  header?: React.ReactNode;
  /** Keterangan tambahan di bawah daftar (opsional) */
  footer?: React.ReactNode;
}

/**
 * Kontainer GroupedList bergaya macOS Settings / Clean Minimal Process Grid.
 * Menyajikan baris-baris informasi dan kendali terstruktur dengan pembatas divide-slate-100.
 */
export function GroupedList({
  header,
  footer,
  className,
  children,
  ...props
}: GroupedListProps) {
  return (
    <div className="space-y-1.5">
      {header && (
        <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
          {header}
        </div>
      )}
      <div
        data-slot="grouped-list"
        className={cn(
          "bg-white dark:bg-[#152238] rounded-lg border border-[#415A77]/20 dark:border-white/10 shadow-xs divide-y divide-[#415A77]/15 dark:divide-slate-800 text-xs overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
      {footer && (
        <div className="px-1 text-[11px] text-[#415A77] dark:text-[#A4B3C6]">
          {footer}
        </div>
      )}
    </div>
  );
}

export interface GroupedItemProps extends React.ComponentProps<'div'> {
  /** Judul baris */
  label: React.ReactNode;
  /** Keterangan pendukung di bawah judul */
  description?: React.ReactNode;
  /** Ikon sisi kiri opsional */
  icon?: React.ReactNode;
  /** Komponen aksi atau kontrol di sisi kanan */
  action?: React.ReactNode;
  /** Apakah baris dapat diklik */
  interactive?: boolean;
}

/**
 * Baris item terstruktur di dalam GroupedList:
 * Sisi kiri: Label + Subketerangan
 * Sisi kanan: Kontrol, selektor, atau badge nilai
 */
export function GroupedItem({
  label,
  description,
  icon,
  action,
  interactive = false,
  className,
  onClick,
  onKeyDown,
  children,
  ...props
}: GroupedItemProps) {
  const isClickable = interactive || Boolean(onClick);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyDown?.(e);
  };

  return (
    <div
      data-slot="grouped-item"
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "p-3.5 flex items-center justify-between gap-3 transition-colors duration-150 ease-out",
        isClickable && "cursor-pointer hover:bg-[#F7F3E9]/70 dark:hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-inset",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="shrink-0 text-slate-500 dark:text-slate-400">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
            {label}
          </span>
          {description && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
              {description}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {action ?? children}
      </div>
    </div>
  );
}

export interface SegmentedControlProps<T extends string> {
  options: Array<{
    value: T;
    label: React.ReactNode;
    icon?: React.ReactNode;
    count?: number | string;
  }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Bilah Tab Tersegmentasi (Segmented Control) bergaya macOS / Clean Minimal Light Mode.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div
      data-slot="segmented-control"
      className={cn(
        "flex p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-lg text-xs font-semibold border border-slate-300/40 dark:border-slate-700/40 select-none",
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const padClass = size === 'sm' ? 'py-1 px-2 text-[11px]' : 'py-1.5 px-3 text-xs';

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-md transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1.5",
              padClass,
              isSelected
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span className="text-[10px] font-mono opacity-80">
                ({opt.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
