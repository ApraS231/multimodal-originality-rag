import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.ComponentProps<"div"> {
  variant?: "default" | "elevated" | "outlined" | "academic" | "grouped" | "subtle"
  size?: "default" | "sm" | "lg"
  interactive?: boolean
}

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-white dark:bg-[#152238] border border-[#415A77]/20 dark:border-white/10 shadow-xs text-[#0D1B2A] dark:text-[#F7F3E9]",
  elevated: "bg-white dark:bg-[#152238] border border-[#415A77]/25 dark:border-white/15 shadow-sm text-[#0D1B2A] dark:text-[#F7F3E9]",
  outlined: "bg-transparent border border-[#415A77]/35 dark:border-white/20 text-[#0D1B2A] dark:text-[#F7F3E9]",
  academic: "bg-[#F7F3E9] dark:bg-[#0D1B2A] border border-[#415A77]/25 dark:border-white/10 shadow-xs text-[#0D1B2A] dark:text-[#F7F3E9]",
  grouped: "bg-white dark:bg-[#152238] border border-[#415A77]/20 dark:border-white/10 shadow-xs divide-y divide-[#415A77]/15 dark:divide-slate-800 text-[#0D1B2A] dark:text-[#F7F3E9]",
  subtle: "bg-[#F7F3E9]/60 dark:bg-[#152238]/40 border-0 text-[#0D1B2A] dark:text-[#F7F3E9]",
}

const sizeStyles: Record<NonNullable<CardProps["size"]>, string> = {
  sm: "rounded-lg p-3 text-xs",
  default: "rounded-lg p-5 text-sm",
  lg: "rounded-lg p-6 text-base",
}

function Card({
  className,
  variant = "default",
  size = "default",
  interactive = false,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  ...props
}: CardProps) {
  const isInteractive = interactive || Boolean(onClick)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isInteractive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
    }
    onKeyDown?.(e)
  }

  return (
    <div
      data-slot="card"
      data-variant={variant}
      data-size={size}
      role={role ?? (isInteractive ? "button" : undefined)}
      tabIndex={isInteractive ? (tabIndex ?? 0) : tabIndex}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/card flex flex-col relative overflow-hidden transition-all duration-150 ease-out",
        variantStyles[variant],
        variant !== "grouped" && sizeStyles[size],
        variant === "grouped" && "rounded-lg",
        isInteractive && [
          "cursor-pointer select-none",
          "hover:border-[#415A77]/40 dark:hover:border-white/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2",
        ],
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1 p-5 pb-3 [.p-0_&]:p-0",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-sans font-bold text-slate-900 dark:text-white tracking-tight leading-snug text-base group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs text-slate-500 dark:text-slate-400 leading-relaxed", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("self-start ml-auto shrink-0", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 pt-0 [.p-0_&]:p-0", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center p-5 pt-3 gap-2 border-t border-slate-100 dark:border-white/10 mt-auto text-xs text-slate-500 dark:text-slate-400",
        className
      )}
      {...props}
    />
  )
}

export interface StatCardProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  value: React.ReactNode
  description?: React.ReactNode
  subtitle?: React.ReactNode
  variant?: "default" | "brass" | "sapphire" | "steel" | "blue" | "amber" | "rose" | "navy"
  interactive?: boolean
  trend?: {
    value: string
    positive?: boolean
  }
  badge?: React.ReactNode
}

function StatCard({
  className,
  title,
  value,
  description,
  subtitle,
  variant = "default",
  interactive = false,
  trend,
  badge,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  ...props
}: StatCardProps) {
  const isInteractive = interactive || Boolean(onClick)
  const displayDescription = description ?? subtitle

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isInteractive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
    }
    onKeyDown?.(e)
  }

  const variantValueColors = {
    default: "text-[#0D1B2A] dark:text-[#F7F3E9]",
    brass: "text-[#B89220] dark:text-[#D4AF37]",
    sapphire: "text-[#0D1B2A] dark:text-[#F7F3E9]",
    steel: "text-[#415A77] dark:text-[#A4B3C6]",
    blue: "text-[#415A77] dark:text-[#A4B3C6]",
    amber: "text-amber-700 dark:text-amber-400",
    rose: "text-rose-700 dark:text-rose-400",
    navy: "text-[#0D1B2A] dark:text-[#F7F3E9]",
  }

  return (
    <div
      data-slot="stat-card"
      role={role ?? (isInteractive ? "button" : undefined)}
      tabIndex={isInteractive ? (tabIndex ?? 0) : tabIndex}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "p-2.5 sm:p-5 rounded-lg border border-[#415A77]/20 dark:border-white/10 bg-white dark:bg-[#152238] shadow-xs transition-all duration-150 ease-out flex flex-col justify-between space-y-0.5 sm:space-y-1.5 min-w-0 overflow-hidden",
        isInteractive && [
          "cursor-pointer select-none",
          "hover:border-[#415A77]/40 dark:hover:border-white/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2",
        ],
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2 min-w-0">
        <span className="text-[9px] sm:text-[10px] font-bold text-[#415A77] dark:text-[#A4B3C6] uppercase tracking-wider truncate block font-mono">
          {title}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>

      <div className={cn("text-base sm:text-2xl md:text-3xl font-black font-mono tabular-nums leading-tight truncate", variantValueColors[variant])}>
        {value}
      </div>

      {(displayDescription || trend) && (
        <div className="text-[10px] sm:text-[11px] text-[#415A77] dark:text-[#A4B3C6] flex items-center gap-1 sm:gap-1.5 pt-0.5 min-w-0">
          {trend && (
            <span
              className={cn(
                "font-mono font-bold shrink-0",
                trend.positive ? "text-[#B89220] dark:text-[#D4AF37]" : "text-rose-700"
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
          )}
          {displayDescription && <span className="truncate block min-w-0">{displayDescription}</span>}
        </div>
      )}
    </div>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  StatCard,
}
