import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  const viewportWidth = 600; // Lebar standar kanvas viewer
  const viewportHeight = 800; // Tinggi standar kanvas viewer

  // Sinkronisasi jika targetPage dari komponen luar berubah
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
      setInputPage(String(targetPage));
    }
  }, [targetPage]);

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
    const clamped = Math.max(1, Math.min(newPage, totalPages));
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

  // Menerapkan rumus transformasi spasial linear (72/dpi normalisasi)
  const getRenderedStyle = (box: BoundingBox) => {
    const normalizeFactor = ocrFallbackActive ? 72 / dpi : 1;

    // Asumsi halaman PDF standar (595.5 x 842 pt A4 atau 612 x 792 pt Letter)
    const originalPageWidth = box.width || 595.5;
    const originalPageHeight = box.height || 842;

    const scaleX = (viewportWidth / originalPageWidth) * normalizeFactor;
    const scaleY = (viewportHeight / originalPageHeight) * normalizeFactor;

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
        ? 'bg-[#415A77]/25 border-2 border-[#D4AF37] shadow-md shadow-[#D4AF37]/20 mix-blend-multiply z-20'
        : 'bg-[#415A77]/15 border border-[#415A77]/40 hover:bg-[#415A77]/25 mix-blend-multiply z-10';
    }
    if (type === 'TEMPLATE') {
      return isActive
        ? 'bg-sky-500/25 border-2 border-sky-500 shadow-md shadow-sky-500/20 mix-blend-multiply z-20'
        : 'bg-sky-500/15 border border-sky-500/40 hover:bg-sky-500/25 mix-blend-multiply z-10';
    }
    // Default PLAGIARISM (lembut, transparan, teks di bawahnya tetap terbaca 100%)
    return isActive
      ? 'bg-rose-500/30 border-2 border-rose-500 shadow-md shadow-rose-500/20 mix-blend-multiply z-20'
      : 'bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 mix-blend-multiply z-10';
  };

  return (
    <div className="relative w-full h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* OCR Warning Banner */}
      {ocrFallbackActive && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-amber-300 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Peringatan: Dokumen dideteksi berupa berkas hasil pemindaian (Scan). Modul Fallback OCR diaktifkan (72 DPI).
          </span>
        </div>
      )}

      {/* Layer Switcher & Filter Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1 text-[11px] font-medium">
          <span className="text-slate-400 mr-2 text-xs font-semibold">Lapisan Sorotan:</span>
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Semua ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PLAGIARISM')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'PLAGIARISM'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Plagiat ({counts.plagiat})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ORIGINAL')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'ORIGINAL'
                ? 'bg-[#0D1B2A] text-[#F7F3E9] shadow-xs'
                : 'text-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#0D1B2A]/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#415A77]/100"></span>
            Orisinal ({counts.orisinal})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('TEMPLATE')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'TEMPLATE'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-sky-400 hover:text-sky-200 hover:bg-sky-950/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            Template ({counts.template})
          </button>
        </div>

        {/* Page Navigator Controls */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Halaman Sebelumnya"
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <form onSubmit={handleInputSubmit} className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 text-[11px]">Hal</span>
            <input
              type="text"
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={() => setInputPage(String(currentPage))}
              className="w-10 text-center bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
            />
            <span className="text-slate-400 text-[11px]">/ {totalPages}</span>
          </form>

          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Halaman Berikutnya"
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PDF Viewport Container */}
      <div className="relative flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4">
        <div
          className="relative bg-white shadow-md rounded-lg"
          style={{ width: `${viewportWidth}px`, height: `${viewportHeight}px` }}
        >
          {/* PDF Embed Render dengan Hash #page={currentPage} */}
          <iframe
            key={`pdf-page-${currentPage}`}
            src={`${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0`}
            title="PDF Document Viewer"
            className="w-full h-full border-none rounded-lg"
          />

          {/* Canvas Overlay for Bounding Box Highlights pada Halaman Aktif Saja */}
          <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
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
                  className={`absolute rounded pointer-events-auto cursor-pointer transition-all duration-300 ${getBoxColorStyle(
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

      {/* Interactive Legend / Status Bar */}
      {activeHighlight ? (
        <div className="bg-slate-900 border-t border-slate-800 p-3 space-y-1 text-xs animate-in slide-in-from-bottom-2 duration-300 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  (activeHighlight.type || activeHighlight.comment?.type) === 'ORIGINAL'
                    ? 'bg-[#415A77]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                    : (activeHighlight.type || activeHighlight.comment?.type) === 'TEMPLATE'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {activeHighlight.type || activeHighlight.comment?.type || 'PLAGIARISM'}
              </span>
              <span className="text-slate-300 font-semibold truncate max-w-[280px]">
                Sumber: {activeHighlight.comment.source}
              </span>
              <span className="text-slate-500 text-[10px]">
                (Halaman {activeHighlight.position.pageNumber})
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-200 border border-slate-700 rounded font-semibold font-mono">
              Kemiripan: {activeHighlight.comment.similarity}%
            </span>
          </div>
          <p className="text-slate-200 leading-relaxed italic line-clamp-2">
            "{activeHighlight.comment.text}"
          </p>
          {activeHighlight.comment.reason && (
            <p className="text-slate-400 text-[11px]">
              Alasan Evaluasi: {activeHighlight.comment.reason}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/80 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>
            Halaman <strong className="text-slate-200">{currentPage}</strong> dari {totalPages}
          </span>
          <span>
            {currentPageHighlights.length > 0
              ? `${currentPageHighlights.length} sorotan pada halaman ini`
              : 'Tidak ada sorotan pada halaman ini'}
          </span>
        </div>
      )}
    </div>
  );
}
