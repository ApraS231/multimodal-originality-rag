import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-xs font-medium whitespace-nowrap transition-all duration-150 ease-out outline-none select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-rose-300 aria-invalid:ring-2 aria-invalid:ring-rose-500/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-[#0D1B2A] text-[#F7F3E9] hover:bg-[#1B2B3E] shadow-xs active:bg-[#0D1B2A]/90 dark:bg-[#F7F3E9] dark:text-[#0D1B2A] dark:hover:bg-white",
        brass:
          "bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#C4A02F] shadow-xs active:bg-[#B39327] font-semibold",
        navy:
          "bg-[#0D1B2A] text-[#F7F3E9] hover:bg-[#1B2B3E] shadow-xs active:bg-[#0D1B2A]/90",
        outline:
          "border border-[#415A77]/25 bg-white text-[#0D1B2A] hover:bg-slate-50 hover:border-[#415A77]/40 shadow-2xs active:bg-slate-100 dark:border-[#415A77]/40 dark:bg-[#152238] dark:text-[#F7F3E9] dark:hover:bg-[#1B2B3E]",
        secondary:
          "bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/15 hover:bg-[#415A77]/15 active:bg-[#415A77]/25 dark:bg-[#415A77]/25 dark:text-[#F7F3E9] dark:hover:bg-[#415A77]/35",
        ghost:
          "text-[#415A77] hover:bg-[#415A77]/10 hover:text-[#0D1B2A] dark:text-[#A4B3C6] dark:hover:bg-[#415A77]/20 dark:hover:text-white",
        destructive:
          "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 shadow-2xs dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 dark:hover:bg-rose-900/50",
        "destructive-solid":
          "bg-rose-600 text-white hover:bg-rose-700 shadow-xs active:bg-rose-800",
        link:
          "text-[#8C6D1F] dark:text-[#D4AF37] underline-offset-4 hover:underline p-0 h-auto font-medium border-transparent",
        brutalist:
          "bg-[#0D1B2A] text-[#F7F3E9] border-2 border-[#0D1B2A] shadow-[2px_2px_0px_#D4AF37] hover:shadow-[3px_3px_0px_#D4AF37] hover:bg-[#1B2B3E] active:shadow-[1px_1px_0px_#D4AF37] active:translate-x-px active:translate-y-px rounded font-bold",
        "brutalist-brass":
          "bg-[#D4AF37] text-[#0D1B2A] border-2 border-[#0D1B2A] shadow-[2px_2px_0px_#0D1B2A] hover:shadow-[3px_3px_0px_#0D1B2A] hover:bg-[#C4A02F] active:shadow-[1px_1px_0px_#0D1B2A] active:translate-x-px active:translate-y-px font-bold rounded",
        "brutalist-outline":
          "border-2 border-[#0D1B2A] bg-white text-[#0D1B2A] hover:bg-[#F7F3E9] shadow-[2px_2px_0px_#D4AF37] active:shadow-none active:translate-x-px active:translate-y-px font-bold rounded",
      },
      size: {
        default: "h-8 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  /** Status memuat data (8-state model) */
  loading?: boolean
  /** Ikon sisi kiri opsional */
  leftIcon?: React.ReactNode
  /** Ikon sisi kanan opsional */
  rightIcon?: React.ReactNode
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <ButtonPrimitive
      data-slot="button"
      aria-busy={loading ? "true" : undefined}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
