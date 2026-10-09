import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  X, 
  Info,
  Maximize2,
  ExternalLink
} from 'lucide-react';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export type HighlightType = 'PLAGIARISM' | 'ORIGINAL' | 'TEMPLATE';

export interface Highlight {
  id: string;
  type?: HighlightType;
  position: {
    pageNumber: number;
    boundingRect: BoundingBox;
    rects: BoundingBox[];
  };
  comment: {
    text: string;
    source: string;
    similarity: number;
    reason?: string;
    type?: HighlightType;
  };
}

interface PdfViewerProps {
  pdfUrl: string;
  highlights?: Highlight[];
  activeHighlightId?: string | null;
  ocrFallbackActive?: boolean;
  dpi?: number;
  totalPages?: number;
  targetPage?: number;
  onSelectHighlight?: (id: string) => void;
  onPageChange?: (page: number) => void;
}

export default function PdfViewer({
  pdfUrl,
  highlights = [],
  activeHighlightId,
  ocrFallbackActive = false,
  dpi = 72,
  totalPages = 103,
  targetPage,
  onSelectHighlight,
  onPageChange,
}: PdfViewerProps) {
  const [filterType, setFilterType] = useState<'ALL' | HighlightType>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(targetPage || 1);
  const [inputPage, setInputPage] = useState<string>(String(currentPage));
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [isOcrDismissed, setIsOcrDismissed] = useState<boolean>(false);

  const baseViewportWidth = 600;  // Lebar standar kanvas dokumen
  const baseViewportHeight = 800; // Tinggi standar kanvas dokumen

  // Hitung batas total halaman maksimum dari data atau prop
  const maxDetectedPage = highlights.reduce((max, h) => Math.max(max, h.position?.pageNumber || 1), 1);
  const resolvedTotalPages = Math.max(totalPages || 1, maxDetectedPage);

  // Sinkronisasi jika targetPage dari komponen luar berubah
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
      setInputPage(String(targetPage));
    }
  }, [targetPage]);

  // Auto-fit skala tampilan awal di layar mobile (< 640px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      const padding = 28;
      const availableWidth = window.innerWidth - padding;
      const fitRatio = Math.max(0.5, Math.min(1.0, Math.round((availableWidth / baseViewportWidth) * 100) / 100));
      setZoomScale(fitRatio);
    }
  }, []);

  // Sinkronisasi otomatis ke halaman sorotan aktif saat dipilih
  useEffect(() => {
    if (activeHighlightId) {
      const activeHl = highlights.find((h) => h.id === activeHighlightId);
      if (activeHl?.position?.pageNumber && activeHl.position.pageNumber !== currentPage) {
        const p = activeHl.position.pageNumber;
        setCurrentPage(p);
        setInputPage(String(p));
        onPageChange?.(p);
      }
    }
  }, [activeHighlightId, highlights]);

  // Pintasan Keyboard: Panah Kiri/Kanan untuk halaman, Esc untuk batalkan sorotan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika fokus di elemen input form
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handlePageChange(currentPage + 1);
      } else if (e.key === 'Escape') {
        if (activeHighlightId && onSelectHighlight) {
          onSelectHighlight('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, resolvedTotalPages, activeHighlightId, onSelectHighlight]);

  const activeHighlight = highlights.find((h) => h.id === activeHighlightId);

  // Filter highlights sesuai tombol segmented filter
  const filteredHighlights = highlights.filter((hl) => {
    const hlType = hl.type || hl.comment?.type || 'PLAGIARISM';
    if (filterType === 'ALL') return true;
    return hlType === filterType;
  });

  // HANYA sorotan yang berada pada halaman aktif saat ini
  const currentPageHighlights = filteredHighlights.filter(
    (hl) => hl.position.pageNumber === currentPage
  );

  // Hitung jumlah masing-masing kategori secara keseluruhan
  const counts = {
    all: highlights.length,
    plagiat: highlights.filter((h) => (h.type || h.comment?.type) === 'PLAGIARISM').length,
    orisinal: highlights.filter((h) => (h.type || h.comment?.type) === 'ORIGINAL').length,
    template: highlights.filter((h) => (h.type || h.comment?.type) === 'TEMPLATE').length,
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, resolvedTotalPages));
    setCurrentPage(clamped);
    setInputPage(String(clamped));
    onPageChange?.(clamped);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputPage, 10);
    if (!isNaN(parsed)) {
      handlePageChange(parsed);
    } else {
      setInputPage(String(currentPage));
    }
  };

  // Menerapkan rumus transformasi spasial linear (72/dpi normalisasi + zoom scaling)
  const getRenderedStyle = (box: BoundingBox) => {
    const normalizeFactor = ocrFallbackActive ? 72 / dpi : 1;

    // Asumsi halaman PDF standar (595.5 x 842 pt A4 atau 612 x 792 pt Letter)
    const originalPageWidth = box.width || 595.5;
    const originalPageHeight = box.height || 842;

    const scaleX = (baseViewportWidth / originalPageWidth) * normalizeFactor * zoomScale;
    const scaleY = (baseViewportHeight / originalPageHeight) * normalizeFactor * zoomScale;

    const left = box.x1 * scaleX;
    const top = box.y1 * scaleY;
    const width = Math.max(8, (box.x2 - box.x1) * scaleX);
    const height = Math.max(8, (box.y2 - box.y1) * scaleY);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  const getBoxColorStyle = (type: HighlightType, isActive: boolean) => {
    if (type === 'ORIGINAL') {
      return isActive
        ? 'bg-emerald-500/30 border-2 border-emerald-600 ring-2 ring-emerald-400/40 shadow-sm z-20'
        : 'bg-emerald-500/18 border border-emerald-500/50 hover:bg-emerald-500/28 hover:border-emerald-600 z-10';
    }
    if (type === 'TEMPLATE') {
      return isActive
        ? 'bg-sky-500/30 border-2 border-sky-600 ring-2 ring-sky-400/40 shadow-sm z-20'
        : 'bg-sky-500/18 border border-sky-500/50 hover:bg-sky-500/28 hover:border-sky-600 z-10';
    }
    // Default PLAGIARISM
    return isActive
      ? 'bg-rose-500/30 border-2 border-rose-600 ring-2 ring-rose-400/40 shadow-sm z-20'
      : 'bg-rose-500/18 border border-rose-500/50 hover:bg-rose-500/28 hover:border-rose-600 z-10';
  };

  return (
    <div className="relative w-full h-full bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden flex flex-col font-sans text-[#0D1B2A]">
      {/* 1. OCR Warning Banner (Minimalis, Lembut & Dapat Ditutup) */}
      {ocrFallbackActive && !isOcrDismissed && (
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-3.5 py-1.5 text-amber-900 text-[11px] font-medium flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 truncate">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              Dokumen terdeteksi berupa pindaian (Scan). Modul Fallback OCR aktif ({dpi} DPI).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOcrDismissed(true)}
            className="text-amber-700 hover:text-amber-950 p-0.5 rounded hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
            title="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Layer Filter & Top Controls Toolbar (Minimalist Light Theme) */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 z-10 shrink-0 select-none">
        {/* Sisi Kiri: Filter Sorotan Pill Group */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium overflow-x-auto no-scrollbar scroll-smooth w-full sm:w-auto py-0.5">
          <span className="text-slate-400 mr-1 text-xs font-semibold hidden sm:inline">Sorotan:</span>

          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterType === 'ALL'
                ? 'bg-[#0D1B2A] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>Semua</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold transition-colors ${
                filterType === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('PLAGIARISM')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterType === 'PLAGIARISM'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>Plagiat</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold transition-colors ${
                filterType === 'PLAGIARISM' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {counts.plagiat}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('ORIGINAL')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterType === 'ORIGINAL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Orisinal</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold transition-colors ${
                filterType === 'ORIGINAL' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {counts.orisinal}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('TEMPLATE')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterType === 'TEMPLATE'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-sky-700 hover:bg-sky-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
            <span>Template</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold transition-colors ${
                filterType === 'TEMPLATE' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'
              }`}
            >
              {counts.template}
            </span>
          </button>
        </div>

        {/* Sisi Kanan: Kontrol Zoom & Halaman (Reflow Rapi di Mobile) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setZoomScale((s) => Math.max(0.6, Math.round((s - 0.15) * 100) / 100))}
              disabled={zoomScale <= 0.6}
              title="Perkecil Tampilan"
              className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(1.0)}
              title="Atur Ulang Skala (100%)"
              className="px-2 py-1 text-[10px] font-mono font-bold text-slate-600 hover:text-slate-900 cursor-pointer min-h-[32px] flex items-center justify-center"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((s) => Math.min(2.0, Math.round((s + 0.15) * 100) / 100))}
              disabled={zoomScale >= 2.0}
              title="Perbesar Tampilan"
              className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page Navigator */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              title="Halaman Sebelumnya (←)"
              className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <form onSubmit={handleInputSubmit} className="flex items-center gap-1 text-xs">
              <input
                type="text"
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                onBlur={() => setInputPage(String(currentPage))}
                className="w-8 text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs text-[#0D1B2A] font-mono font-bold focus:outline-none focus:border-[#D4AF37]"
              />
              <span className="text-slate-400 text-[11px] font-mono">/ {resolvedTotalPages}</span>
            </form>

            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= resolvedTotalPages}
              title="Halaman Berikutnya (→)"
              className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Notice: Peramban Android/iOS tidak merender PDF di dalam iframe */}
      <div className="md:hidden px-3.5 py-2 bg-amber-50/90 border-b border-amber-200/80 flex items-center justify-between text-xs text-amber-900 shrink-0">
        <span className="truncate pr-2">Buka dokumen penuh di aplikasi PDF ponsel:</span>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline shrink-0 inline-flex items-center gap-1 text-amber-950 hover:text-amber-800"
        >
          <span>Buka PDF</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* 3. PDF Viewport Canvas (Soft Neutral Backdrop & Pristine White Sheet) */}
      <div className="relative flex-1 bg-slate-100/70 overflow-auto flex items-center justify-center p-4 sm:p-6 select-none">
        <div
          className="relative bg-white shadow-md border border-slate-200/90 rounded-md transition-all duration-150 origin-center"
          style={{
            width: `${baseViewportWidth * zoomScale}px`,
            height: `${baseViewportHeight * zoomScale}px`,
          }}
        >
          {/* PDF Embed Render dengan Hash #page={currentPage} */}
          <iframe
            key={`pdf-page-${currentPage}`}
            src={`${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0`}
            title={`PDF Document - Halaman ${currentPage}`}
            className="w-full h-full border-none rounded-md bg-white pointer-events-auto"
          />

          {/* Canvas Overlay for Bounding Box Highlights pada Halaman Aktif Saja */}
          <div className="absolute inset-0 pointer-events-none rounded-md overflow-hidden">
            {currentPageHighlights.map((hl) => {
              const isActive = hl.id === activeHighlightId;
              const hlType: HighlightType = hl.type || hl.comment?.type || 'PLAGIARISM';

              // Validasi agar hanya kotak dengan koordinat riil yang dirender
              const validRects = hl.position.rects.filter(
                (rect) =>
                  rect &&
                  Number(rect.x2) > Number(rect.x1) &&
                  Number(rect.y2) > Number(rect.y1) &&
                  !(Number(rect.x1) === 0 && Number(rect.x2) === 0)
              );

              return validRects.map((rect, idx) => (
                <div
                  key={`${hl.id}-${idx}`}
                  onClick={() => onSelectHighlight && onSelectHighlight(hl.id)}
                  className={`absolute rounded pointer-events-auto cursor-pointer transition-all duration-200 ${getBoxColorStyle(
                    hlType,
                    isActive
                  )}`}
                  style={getRenderedStyle(rect)}
                  title={`${hl.comment.text} (${hl.comment.similarity}% cocok)`}
                />
              ));
            })}
          </div>
        </div>
      </div>

      {/* 4. Inspector Drawer / Status Footer Minimalis */}
      {activeHighlight ? (
        <div className="bg-white border-t border-slate-200/90 p-3.5 space-y-1.5 text-xs animate-in slide-in-from-bottom-2 duration-200 shrink-0 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  (activeHighlight.type || activeHighlight.comment?.type) === 'ORIGINAL'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : (activeHighlight.type || activeHighlight.comment?.type) === 'TEMPLATE'
                    ? 'bg-sky-50 text-sky-800 border border-sky-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {activeHighlight.type || activeHighlight.comment?.type || 'PLAGIARISM'}
              </span>
              <span className="text-slate-800 font-semibold truncate max-w-[280px]">
                Sumber: {activeHighlight.comment.source}
              </span>
              <span className="text-slate-400 text-[11px] font-mono">
                (Halaman {activeHighlight.position.pageNumber})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded font-semibold font-mono">
                Kemiripan: {activeHighlight.comment.similarity}%
              </span>
              <button
                type="button"
                onClick={() => onSelectHighlight?.('')}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup detail sorotan (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <blockquote className="text-slate-700 border-l-2 border-slate-300 pl-2.5 py-0.5 italic line-clamp-2 bg-slate-50/60 rounded-r">
            "{activeHighlight.comment.text}"
          </blockquote>

          {activeHighlight.comment.reason && (
            <p className="text-slate-500 text-[11px]">
              Catatan Evaluasi: {activeHighlight.comment.reason}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white border-t border-slate-200/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <span>
              Halaman <strong className="text-slate-900 font-mono">{currentPage}</strong> dari{' '}
              <span className="font-mono">{resolvedTotalPages}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {currentPageHighlights.length > 0
                ? `${currentPageHighlights.length} sorotan aktif`
                : 'Tidak ada sorotan pada halaman ini'}
            </span>
          </span>
          <span className="text-slate-400 hidden sm:inline text-[10px]">
            Pintasan: ← / → ganti halaman • Esc batalkan pilihan
          </span>
        </div>
      )}
    </div>
  );
}
