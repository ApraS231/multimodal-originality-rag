import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-xs text-[#0D1B2A] placeholder:text-slate-400 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-[#0D1B2A] focus-visible:border-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 aria-invalid:border-rose-400 aria-invalid:ring-2 aria-invalid:ring-rose-500/20 shadow-2xs dark:bg-[#152238] dark:border-[#415A77]/40 dark:text-[#F7F3E9] dark:placeholder:text-[#A4B3C6]/60 dark:focus-visible:border-[#D4AF37] dark:disabled:bg-slate-800/60 dark:aria-invalid:border-rose-500/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
