import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Kontainer tabel yang mendukung overflow horizontal dengan aksesibilitas keyboard dan pembaca layar.
 * Memenuhi WCAG 2.1 SC 2.1.1 (Keyboard Accessible) dengan tabIndex={0} pada viewport scroll.
 */
interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string
  bordered?: boolean
}

const TableContainer = React.forwardRef<HTMLDivElement, TableContainerProps>(
  ({ className, ariaLabel = "Tabel Data Akademik", bordered = false, children, ...props }, ref) => (
    <div
      ref={ref}
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn(
        "w-full overflow-x-auto custom-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-lg",
        bordered && "border border-slate-200 dark:border-slate-800 shadow-xs",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
TableContainer.displayName = "TableContainer"

/**
 * Elemen tabel utama dengan reset semantik dan tipografi presisi ilmiah.
 */
const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      data-slot="table"
      className={cn("w-full border-collapse text-left text-xs text-slate-700 dark:text-slate-300", className)}
      {...props}
    />
  )
)
Table.displayName = "Table"

/**
 * Header tabel dengan dukungan opsi sticky untuk mempermudah peninjauan dataset panjang.
 */
interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean
}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, sticky = false, ...props }, ref) => (
    <thead
      ref={ref}
      data-slot="table-header"
      className={cn(
        "border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200",
        sticky && "sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs shadow-xs",
        className
      )}
      {...props}
    />
  )
)
TableHeader.displayName = "TableHeader"

/**
 * Konten tubuh tabel dengan pemisah baris halus.
 */
const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      data-slot="table-body"
      className={cn("divide-y divide-slate-100 dark:divide-slate-800 font-medium", className)}
      {...props}
    />
  )
)
TableBody.displayName = "TableBody"

/**
 * Bagian penutup tabel (footer) untuk agregasi atau metrik total.
 */
const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      data-slot="table-footer"
      className={cn("border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 font-medium text-slate-800 dark:text-slate-200", className)}
      {...props}
    />
  )
)
TableFooter.displayName = "TableFooter"

/**
 * Baris tabel dengan penanganan status interaktif, keyboard accessibility, dan visual feedback terukur.
 */
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean
  selected?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, interactive = false, selected = false, onClick, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        onClick(e as unknown as React.MouseEvent<HTMLTableRowElement>)
      }
      onKeyDown?.(e)
    }

    return (
      <tr
        ref={ref}
        data-slot="table-row"
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? "button" : undefined}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "transition-colors duration-150 ease-out",
          interactive && "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-inset",
          selected && "bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-50/80",
          className
        )}
        {...props}
      />
    )
  }
)
TableRow.displayName = "TableRow"

/**
 * Sel header tabel dengan dukungan perataan teks dan kontras tinggi.
 */
interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right"
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, align = "left", scope = "col", ...props }, ref) => (
    <th
      ref={ref}
      data-slot="table-head"
      scope={scope}
      className={cn(
        "py-3 px-4 font-bold uppercase text-[11px] tracking-wider text-slate-800 dark:text-slate-200 select-none",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = "TableHead"

/**
 * Sel data tabel dengan opsi angka tabular (tabularNums) dan pengaturan perataan.
 */
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right"
  tabularNums?: boolean
  compact?: boolean
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = "left", tabularNums = false, compact = false, ...props }, ref) => (
    <td
      ref={ref}
      data-slot="table-cell"
      className={cn(
        "align-middle text-slate-700 dark:text-slate-300",
        compact ? "py-2 px-3" : "py-3 px-4",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        tabularNums && "font-mono tabular-nums",
        className
      )}
      {...props}
    />
  )
)
TableCell.displayName = "TableCell"

/**
 * Keterangan semantik tabel untuk pembaca layar.
 */
const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-slate-500 font-normal", className)}
      {...props}
    />
  )
)
TableCaption.displayName = "TableCaption"

export {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
}
