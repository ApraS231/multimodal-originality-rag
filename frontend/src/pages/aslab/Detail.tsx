import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PdfViewer from '../../components/pdf-viewer';
import Chatbot from '../../components/chatbot';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { 
  ArrowLeft, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  Image as ImageIcon, 
  FileText, 
  ExternalLink,
  Layers,
  X,
  Maximize2,
  RotateCcw,
  Calculator,
  CheckCircle2,
  Filter,
  Info,
  Copy
} from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';

interface Highlight {
  id: string;
  type?: 'PLAGIARISM' | 'ORIGINAL' | 'TEMPLATE';
  position: {
    pageNumber: number;
    boundingRect: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    };
    rects: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    }>;
  };
  comment: {
    text: string;
    source: string;
    similarity: number;
    reason?: string;
    type?: 'PLAGIARISM' | 'ORIGINAL' | 'TEMPLATE';
  };
}

interface ImagePlagiarismDetail {
  id: string;
  image_id: string;
  similarity_score: number;
  page_number: number;
  bounding_box: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  student_image_url: string;
  source_image_url: string;
  source_reference: {
    author: string;
    year: string | number;
    source_file_name: string;
    page_number: number;
  };
  hitl_status?: 'CONFIRMED' | 'EXEMPTED' | 'NEEDS_REVIEW' | 'PENDING';
  hitl_note?: string;
  verified_by?: string | null;
  verified_at?: string | null;
}

interface LaporanDetail {
  id_laporan: string;
  nama_mahasiswa: string;
  nim: string;
  tahun_akademik: number;
  tautan_berkas: string;
  skor_orisinalitas: string | number;
  skor_plagiarisme: string | number;
  skor_orisinalitas_koreksi: string | number | null;
  nilai_huruf: string | null;
  apakah_diverifikasi: boolean;
  status: string;
  ocr_fallback_active: boolean;
  highlights: Highlight[];
  image_plagiarism_details?: ImagePlagiarismDetail[];
  extracted_images?: Array<{ id: string; url: string; nomor_halaman: number }>;
  prodi: { nama_prodi: string };
  kelas: { nama_kelas: string };
  matkul: { nama_matkul: string };
}

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'info' | 'text' | 'images' | 'verification'>('info');
  const [scoreOverride, setScoreOverride] = useState('');
  const [nilaiHuruf, setNilaiHuruf] = useState('A');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [targetPage, setTargetPage] = useState<number>(1);
  const [imageSubTab, setImageSubTab] = useState<'plagiarism' | 'gallery'>('plagiarism');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [mobileActiveView, setMobileActiveView] = useState<'pdf' | 'analysis'>('pdf');

  // Status salin ke papan klip
  const [copiedNim, setCopiedNim] = useState(false);
  const [copiedReportId, setCopiedReportId] = useState(false);

  const handleCopyNim = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedNim(true);
    setTimeout(() => setCopiedNim(false), 2000);
  };

  const handleCopyReportId = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedReportId(true);
    setTimeout(() => setCopiedReportId(false), 2000);
  };

  // Filter dan State Verifikasi Manual (HITL) Gambar
  const [hitlFilter, setHitlFilter] = useState<'ALL' | 'CONFIRMED' | 'EXEMPTED' | 'NEEDS_REVIEW' | 'PENDING'>('ALL');
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const resolveImageUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    return `${backendUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  // Filter kategori highlight teks
  const [listFilter, setListFilter] = useState<'ALL' | 'PLAGIARISM' | 'ORIGINAL' | 'TEMPLATE'>('ALL');

  const { data: laporan, isLoading, error } = useQuery<LaporanDetail>({
    queryKey: ['reportDetail', id],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/reports/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat detail laporan.');
      return res.json();
    },
    enabled: !!id,
  });

  const overrideMutation = useMutation({
    mutationFn: async (payload: { scoreOriginalOverride: string; nilaiHuruf: string }) => {
      const res = await fetch(`${backendUrl}/api/reports/${id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan penilaian manual.');
      }
      return data;
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['reportDetail', id] });
      setTimeout(() => setSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
      setSaveSuccess(false);
    },
  });

  const handleSubmitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreOverride) {
      setErrorMsg('Skor koreksi wajib diisi.');
      return;
    }
    const val = parseFloat(scoreOverride);
    if (isNaN(val) || val < 0 || val > 100) {
      setErrorMsg('Skor harus berupa angka antara 0 hingga 100.');
      return;
    }
    overrideMutation.mutate({
      scoreOriginalOverride: scoreOverride,
      nilaiHuruf,
    });
  };

  const hitlMutation = useMutation({
    mutationFn: async (payload: { matchId: string; hitlStatus: string; hitlNote?: string; batchUpdate?: boolean }) => {
      const res = await fetch(`${backendUrl}/api/reports/${id}/hitl-image`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan status verifikasi manual.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportDetail', id] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Gagal memperbarui verifikasi gambar.');
    },
  });

  const handleUpdateHitlStatus = (matchId: string, status: string) => {
    const currentNote = notesMap[matchId];
    hitlMutation.mutate({
      matchId,
      hitlStatus: status,
      hitlNote: currentNote,
    });
  };

  const handleSaveHitlNote = (matchId: string) => {
    const note = notesMap[matchId];
    if (note === undefined) return;
    const currentMatch = laporan?.image_plagiarism_details?.find(m => m.id === matchId);
    hitlMutation.mutate({
      matchId,
      hitlStatus: currentMatch?.hitl_status || 'PENDING',
      hitlNote: note,
    });
  };

  const handleBatchHitl = (status: string) => {
    hitlMutation.mutate({
      matchId: 'BATCH',
      hitlStatus: status,
      batchUpdate: true,
    });
  };

  if (isLoading) {
    return (
      <LoadingSpinner variant="fullpage" message="Memuat naskah dan data spasial orisinalitas..." />
    );
  }

  if (error || !laporan) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white border border-rose-200 rounded-lg shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Gagal Membuka Laporan</h2>
          <p className="text-xs text-slate-500">
            {error ? (error as Error).message : 'Laporan tidak ditemukan atau Anda tidak memiliki akses.'}
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => navigate('/aslab/dashboard')}
        >
          Kembali ke Dasbor Aslab
        </Button>
      </div>
    );
  }

  const rawHighlights = laporan.highlights || [];
  const imagePlagiarismList = laporan.image_plagiarism_details || [];
  const extractedImages = laporan.extracted_images || [];

  const hitlCounts = {
    all: imagePlagiarismList.length,
    confirmed: imagePlagiarismList.filter(m => m.hitl_status === 'CONFIRMED').length,
    exempted: imagePlagiarismList.filter(m => m.hitl_status === 'EXEMPTED').length,
    needs_review: imagePlagiarismList.filter(m => m.hitl_status === 'NEEDS_REVIEW').length,
    pending: imagePlagiarismList.filter(m => !m.hitl_status || m.hitl_status === 'PENDING').length,
  };

  const filteredImagePlagiarism = imagePlagiarismList.filter(m => {
    if (hitlFilter === 'ALL') return true;
    if (hitlFilter === 'PENDING') return !m.hitl_status || m.hitl_status === 'PENDING';
    return m.hitl_status === hitlFilter;
  });

  // Kalkulasi rekomendasi skor Human-in-the-Loop jika ada gambar yang dikecualikan
  const baseOriScore = typeof laporan.skor_orisinalitas === 'number' 
    ? laporan.skor_orisinalitas 
    : parseFloat(String(laporan.skor_orisinalitas || 0));
  const basePlagScore = typeof laporan.skor_plagiarisme === 'number' 
    ? laporan.skor_plagiarisme 
    : parseFloat(String(laporan.skor_plagiarisme || 0));

  const totalDetectedImages = imagePlagiarismList.length;
  const exemptedImageCount = hitlCounts.exempted;
  const exemptionRatio = totalDetectedImages > 0 ? exemptedImageCount / totalDetectedImages : 0;
  const hitlScoreDelta = Math.round(basePlagScore * 0.3 * exemptionRatio * 10) / 10;
  const recommendedHitlScore = Math.min(100, Math.round((baseOriScore + hitlScoreDelta) * 10) / 10);

  const counts = {
    all: rawHighlights.length,
    plagiat: rawHighlights.filter(h => (h.type || h.comment?.type) === 'PLAGIARISM').length,
    orisinal: rawHighlights.filter(h => (h.type || h.comment?.type) === 'ORIGINAL').length,
    template: rawHighlights.filter(h => (h.type || h.comment?.type) === 'TEMPLATE').length,
    images: imagePlagiarismList.length > 0 ? imagePlagiarismList.length : extractedImages.length
  };

  const filteredListHighlights = rawHighlights.filter(h => {
    const hType = h.type || h.comment?.type || 'ORIGINAL';
    if (listFilter === 'ALL') return true;
    return hType === listFilter;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* Top Header Bar (Responsif Mobile & Desktop) */}
      <header className="px-3.5 py-2.5 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/aslab/dashboard')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5 text-slate-500" />}
            className="h-8 text-xs shrink-0"
          >
            Dasbor
          </Button>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {laporan.nama_mahasiswa || 'Laporan Praktikan'}
              </h1>
              <span className="text-[11px] text-slate-500 font-mono">({laporan.nim || '-'})</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
              {laporan.matkul?.nama_matkul} • {laporan.kelas?.nama_kelas} • TA {laporan.tahun_akademik}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {laporan.ocr_fallback_active && (
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">OCR Fallback Aktif</span>
              <span className="sm:hidden">OCR</span>
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
            laporan.apakah_diverifikasi
              ? 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/25'
              : 'text-slate-600 bg-slate-100 border-slate-200'
          }`}>
            {laporan.apakah_diverifikasi ? 'TERVERIFIKASI' : 'MENUNGGU VERIFIKASI'}
          </span>
        </div>
      </header>

      {/* Segmented Switcher untuk Perangkat Mobile (Dokumen PDF vs Analisis Evaluasi) */}
      <div className="flex items-center p-1.5 bg-slate-100 border-b border-slate-200 md:hidden z-10 shrink-0 select-none">
        <button
          type="button"
          onClick={() => setMobileActiveView('pdf')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileActiveView === 'pdf'
              ? 'bg-white text-[#0D1B2A] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>Dokumen PDF</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
            {laporan.highlights?.length || 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveView('analysis')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileActiveView === 'analysis'
              ? 'bg-white text-[#0D1B2A] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Evaluasi & Nilai</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700">
            {Number(laporan.skor_orisinalitas).toFixed(0)}%
          </span>
        </button>
      </div>

      {/* Main Split-Screen Container (Berdampingan di Desktop, Berganti Tab di Mobile) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sisi Kiri (PDF Viewer) */}
        <section className={`flex-[6] h-full p-2 sm:p-4 md:p-6 border-r border-slate-200 overflow-hidden bg-slate-100/60 ${
          mobileActiveView === 'pdf' ? 'flex flex-col' : 'hidden md:flex'
        }`}>
          <PdfViewer
            pdfUrl={`${backendUrl}/api/reports/${id}/pdf`}
            highlights={laporan.highlights}
            activeHighlightId={activeHighlightId}
            ocrFallbackActive={laporan.ocr_fallback_active}
            totalPages={103}
            targetPage={targetPage}
            onPageChange={(p) => setTargetPage(p)}
            onSelectHighlight={(hlId) => {
              setActiveHighlightId(hlId);
              const found = laporan.highlights?.find(h => h.id === hlId);
              if (found?.position?.pageNumber) {
                setTargetPage(found.position.pageNumber);
              }
            }}
          />
        </section>

        {/* Sisi Kanan (Analisis Teks, Gambar CLIP & Penilaian) */}
        <section className={`flex-[4] h-full p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 ${
          mobileActiveView === 'analysis' ? 'block' : 'hidden md:block'
        }`}>
          {/* Pratinjau Visual Ringkas (macOS Preview Header) */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  METRIK DETEKSI SISTEM
                </span>
                <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                  Evaluasi Integritas Naskah
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                laporan.apakah_diverifikasi
                  ? 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/25'
                  : 'text-slate-700 bg-slate-100 border-slate-200'
              }`}>
                {laporan.apakah_diverifikasi ? 'Terverifikasi' : 'Menunggu Review'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50/80 border border-slate-100 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Orisinalitas
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                </div>
                <p className="text-2xl font-bold font-mono text-[#0D1B2A] mt-1">
                  {Number(laporan.skor_orisinalitas).toFixed(1)}%
                </p>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-[#D4AF37] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, Number(laporan.skor_orisinalitas)))}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50/80 border border-slate-100 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Kemiripan
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                </div>
                <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
                  {Number(laporan.skor_plagiarisme).toFixed(1)}%
                </p>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-rose-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, Number(laporan.skor_plagiarisme)))}%` }}
                  />
                </div>
              </div>
            </div>

            {laporan.skor_orisinalitas_koreksi !== null && laporan.skor_orisinalitas_koreksi !== undefined && (
              <div className="p-2 rounded bg-[#415A77]/10 border border-[#415A77]/25 flex items-center justify-between text-[11px] text-[#0D1B2A] font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0D1B2A] shrink-0" />
                  <span>Koreksi Evaluator: <strong className="font-mono">{Number(laporan.skor_orisinalitas_koreksi).toFixed(1)}%</strong></span>
                </div>
                {laporan.nilai_huruf && (
                  <span className="px-1.5 py-0.2 rounded bg-[#0D1B2A] text-[#F7F3E9] font-mono font-bold text-[10px]">
                    Nilai {laporan.nilai_huruf}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Segmented Control Bar (macOS LIST) */}
          <div className="flex p-1 bg-slate-200/70 rounded-lg text-xs font-semibold border border-slate-300/40">
            <button
              type="button"
              onClick={() => setActiveRightTab('info')}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeRightTab === 'info'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Informasi</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('text')}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeRightTab === 'text'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Teks ({counts.all})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('images')}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeRightTab === 'images'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Gambar ({counts.images})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('verification')}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeRightTab === 'verification'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Nilai</span>
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* TAB 1: INFORMASI DETAIL LAPORAN (macOS Grouped PANEL)         */}
          {/* ------------------------------------------------------------- */}
          {activeRightTab === 'info' && (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-100 text-xs">
                {/* Baris 1: Mahasiswa Praktikan */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Mahasiswa Praktikan
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Identitas terdaftar dalam sistem akademik
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-right shrink-0">
                    <span className="font-semibold text-slate-900">
                      {laporan.nama_mahasiswa || '-'}
                    </span>
                    {laporan.nim && (
                      <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-700">
                        <span>{laporan.nim}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyNim(laporan.nim)}
                          className="hover:text-slate-900 text-slate-400 p-0.5 cursor-pointer"
                          title="Salin NIM"
                        >
                          {copiedNim ? <Check className="w-3 h-3 text-[#8C6D1F]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Baris 2: Subjek & Kelas */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Mata Kuliah & Kelas
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Subjek praktikum laboratorium komputer
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-medium text-slate-900 block">
                      {laporan.matkul?.nama_matkul || '-'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Kelas {laporan.kelas?.nama_kelas || '-'}
                    </span>
                  </div>
                </div>

                {/* Baris 3: Program Studi */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Program Studi
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Jurusan akademik STITEK Bontang
                    </span>
                  </div>
                  <span className="font-medium text-slate-900 text-right shrink-0">
                    {laporan.prodi?.nama_prodi || '-'}
                  </span>
                </div>

                {/* Baris 4: Tahun Akademik */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Tahun Akademik
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Periode pengerjaan praktikum
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-slate-800 text-right shrink-0">
                    TA {laporan.tahun_akademik}
                  </span>
                </div>

                {/* Baris 5: Status Otorisasi Dokumen */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Status Verifikasi
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Persetujuan evaluator laboratorium
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border shrink-0 ${
                    laporan.apakah_diverifikasi
                      ? 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/25'
                      : 'text-slate-700 bg-slate-100 border-slate-200'
                  }`}>
                    {laporan.apakah_diverifikasi ? 'TERVERIFIKASI' : 'MENUNGGU VERIFIKASI'}
                  </span>
                </div>

                {/* Baris 6: Mesin Ekstraksi Teks (OCR) */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Mesin Ekstraksi Teks
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Penanganan otomatis dokumen pindaian citra
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                    laporan.ocr_fallback_active
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {laporan.ocr_fallback_active ? 'OCR Aktif' : 'Standar PDF'}
                  </span>
                </div>

                {/* Baris 7: Pipeline AI */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Arsitektur Pendeteksi
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Kombinasi embedding Supabase pgvector dan Cross-Encoder
                    </span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    Hybrid RRF + CLIP
                  </span>
                </div>

                {/* Baris 8: Rekomendasi HITL */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block">
                      Rekomendasi Penilaian HITL
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {exemptedImageCount > 0 
                        ? `${exemptedImageCount} gambar dikecualikan sebagai modul resmi`
                        : 'Belum ada pengecualian modul resmi'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {recommendedHitlScore}%
                    </span>
                    {exemptedImageCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setScoreOverride(recommendedHitlScore.toFixed(1));
                          setActiveRightTab('verification');
                        }}
                        className="px-2 py-0.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Terapkan
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bilah Aksi Tambahan (Footer Link bergaya macOS Settings) */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => window.open(`${backendUrl}/api/reports/${id}/pdf`, '_blank')}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Naskah Asli PDF di Tab Baru</span>
                </button>

                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <span>ID: {laporan.id_laporan?.slice(0, 8)}...</span>
                  <button
                    type="button"
                    onClick={() => handleCopyReportId(laporan.id_laporan)}
                    className="p-1 hover:text-slate-900 text-slate-400 cursor-pointer"
                    title="Salin ID Laporan"
                  >
                    {copiedReportId ? <Check className="w-2.5 h-2.5 text-[#8C6D1F]" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: ANALISIS KUTIPAN TEKS (macOS Grouped PANEL)            */}
          {/* ------------------------------------------------------------- */}
          {activeRightTab === 'text' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Daftar Segmen Teks ({filteredListHighlights.length})
                </span>
                <div className="flex gap-1 text-[10px] bg-slate-200/70 p-0.5 rounded-md">
                  <button
                    type="button"
                    onClick={() => setListFilter('ALL')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      listFilter === 'ALL' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({counts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilter('PLAGIARISM')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      listFilter === 'PLAGIARISM' ? 'bg-white text-rose-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    Plagiat ({counts.plagiat})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilter('ORIGINAL')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      listFilter === 'ORIGINAL' ? 'bg-white text-[#0D1B2A] font-semibold shadow-xs' : 'text-slate-600 hover:text-[#0D1B2A]'
                    }`}
                  >
                    Orisinal ({counts.orisinal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilter('TEMPLATE')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      listFilter === 'TEMPLATE' ? 'bg-white text-sky-800 font-semibold shadow-xs' : 'text-slate-600 hover:text-sky-800'
                    }`}
                  >
                    Template ({counts.template})
                  </button>
                </div>
              </div>

              {/* Grouped Panel untuk Segmen Teks */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden max-h-[460px] overflow-y-auto custom-scrollbar">
                {filteredListHighlights.map((hl) => {
                  const isActive = hl.id === activeHighlightId;
                  const hlType = hl.type || hl.comment?.type || 'ORIGINAL';

                  return (
                    <div
                      key={hl.id}
                      onClick={() => {
                        setActiveHighlightId(hl.id);
                        if (hl.position?.pageNumber) {
                          setTargetPage(hl.position.pageNumber);
                        }
                        if (window.innerWidth < 768) {
                          setMobileActiveView('pdf');
                        }
                      }}
                      className={`p-3 text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-slate-50/90 font-medium'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                            hlType === 'ORIGINAL'
                              ? 'bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/25'
                              : hlType === 'TEMPLATE'
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {hlType}
                          </span>
                          <span className="text-slate-700 truncate text-[11px] font-mono">
                            {hl.comment.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono font-bold text-[11px] ${
                            hlType === 'ORIGINAL'
                              ? 'text-[#0D1B2A]'
                              : hlType === 'TEMPLATE'
                              ? 'text-sky-700'
                              : 'text-rose-600'
                          }`}>
                            {hl.comment.similarity}%
                          </span>
                          {hl.position?.pageNumber && (
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                              Hal {hl.position.pageNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-600 italic line-clamp-2 leading-relaxed text-[11px]">
                        "{hl.comment.text}"
                      </p>
                    </div>
                  );
                })}
                {filteredListHighlights.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Tidak ada segmen dalam kategori filter ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: VISUALISASI GAMBAR BERDAMPINGAN (CLIP) & GALERI NASKAH */}
          {/* ------------------------------------------------------------- */}
          {activeRightTab === 'images' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#0D1B2A]" />
                    <span>Evaluasi Visual Spasial & Galeri</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Deteksi kemiripan embedding citra CLIP terhadap arsip praktikum.
                  </p>
                </div>
              </div>

              {/* Sub-tab Switcher: Temuan Plagiat vs Galeri Naskah */}
              <div className="flex p-0.5 bg-slate-100 rounded-md text-[11px] font-semibold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setImageSubTab('plagiarism')}
                  className={`flex-1 py-1 rounded transition-all cursor-pointer text-center ${
                    imageSubTab === 'plagiarism'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Temuan Plagiat ({imagePlagiarismList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setImageSubTab('gallery')}
                  className={`flex-1 py-1 rounded transition-all cursor-pointer text-center ${
                    imageSubTab === 'gallery'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Galeri Naskah ({extractedImages.length})
                </button>
              </div>

              {imageSubTab === 'plagiarism' ? (
                imagePlagiarismList.length === 0 ? (
                  <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#415A77]/10 text-[#0D1B2A] flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5" />
                    </div>
                    <h5 className="text-xs font-bold text-slate-900">Tidak Ada Duplikasi Visual</h5>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Seluruh diagram dan gambar pada laporan ini memiliki kemiripan embedding CLIP di bawah ambang batas kecurigaan (85%).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Panel Kontrol & Filter Audit Spasial (HITL) */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#0D1B2A] shrink-0" />
                          <span className="text-xs font-bold text-slate-900">Audit Orisinalitas Spasial (HITL)</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleBatchHitl('EXEMPTED')}
                            disabled={hitlMutation.isPending}
                            className="px-2.5 py-1 rounded-md bg-[#415A77]/10 text-[#0D1B2A] hover:bg-[#415A77]/15 border border-[#415A77]/35 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            title="Kecualikan semua gambar sebagai template modul"
                          >
                            Abaikan Semua Modul
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBatchHitl('PENDING')}
                            disabled={hitlMutation.isPending}
                            className="px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            title="Kembalikan semua status ke belum diverifikasi"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Filter Chips HITL */}
                      <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-100 text-[11px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
                          <Filter className="w-3 h-3" /> Filter:
                        </span>
                        <button
                          type="button"
                          onClick={() => setHitlFilter('ALL')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            hitlFilter === 'ALL'
                              ? 'bg-slate-900 text-white font-semibold'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Semua ({hitlCounts.all})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHitlFilter('CONFIRMED')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            hitlFilter === 'CONFIRMED'
                              ? 'bg-rose-600 text-white font-semibold'
                              : 'bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                        >
                          Plagiat ({hitlCounts.confirmed})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHitlFilter('EXEMPTED')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            hitlFilter === 'EXEMPTED'
                              ? 'bg-[#0D1B2A] text-[#F7F3E9] font-semibold'
                              : 'bg-slate-50 text-slate-600 hover:bg-[#415A77]/10 hover:text-[#0D1B2A]'
                          }`}
                        >
                          Modul ({hitlCounts.exempted})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHitlFilter('NEEDS_REVIEW')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            hitlFilter === 'NEEDS_REVIEW'
                              ? 'bg-amber-600 text-white font-semibold'
                              : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                        >
                          Klarifikasi ({hitlCounts.needs_review})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHitlFilter('PENDING')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            hitlFilter === 'PENDING'
                              ? 'bg-slate-700 text-white font-semibold'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Belum Dicek ({hitlCounts.pending})
                        </button>
                      </div>

                      {/* Banner Rekomendasi Skor jika ada gambar yang di-exempt */}
                      {hitlCounts.exempted > 0 && (
                        <div className="p-2.5 rounded-md bg-[#415A77]/10 border border-[#415A77]/25 flex items-center justify-between text-[11px] animate-fade-in">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-[#0D1B2A] shrink-0" />
                            <div className="text-[#0D1B2A]">
                              <span className="font-semibold">{hitlCounts.exempted} gambar dikecualikan</span> sebagai modul resmi. Rekomendasi skor akhir: <span className="font-bold font-mono text-[#0D1B2A]">{recommendedHitlScore}%</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setScoreOverride(recommendedHitlScore.toFixed(1));
                              setActiveRightTab('verification');
                            }}
                            className="px-2.5 py-1 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white font-semibold rounded-md text-[10px] cursor-pointer transition-colors shrink-0 shadow-xs"
                          >
                            Terapkan ke Nilai
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Grouped Panel untuk Temuan Gambar */}
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                      {filteredImagePlagiarism.length === 0 ? (
                        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-slate-500 text-xs shadow-xs">
                          Tidak ada temuan gambar pada kategori filter ini.
                        </div>
                      ) : (
                        filteredImagePlagiarism.map((match, idx) => {
                          const isExempted = match.hitl_status === 'EXEMPTED';
                          const isConfirmed = match.hitl_status === 'CONFIRMED';
                          const isNeedsReview = match.hitl_status === 'NEEDS_REVIEW';
                          const noteVal = notesMap[match.id] !== undefined ? notesMap[match.id] : (match.hitl_note || '');

                          return (
                            <div 
                              key={match.id || idx} 
                              className={`p-3.5 rounded-lg transition-all space-y-2.5 bg-white border border-slate-200 shadow-xs ${
                                isExempted
                                  ? 'border-l-4 border-l-[#D4AF37]'
                                  : isConfirmed
                                  ? 'border-l-4 border-l-rose-600'
                                  : isNeedsReview
                                  ? 'border-l-4 border-l-amber-500'
                                  : 'border-l-4 border-l-slate-300'
                              }`}
                            >
                              {/* Header Kartu: Index + Hal + Navigasi + Status */}
                              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-mono font-bold">
                                    #{String(idx + 1).padStart(2, '0')}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900">
                                    Halaman {match.page_number}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetPage(match.page_number);
                                      if (window.innerWidth < 768) {
                                        setMobileActiveView('pdf');
                                      }
                                    }}
                                    className="text-[10px] font-medium text-[#0D1B2A] hover:text-[#0D1B2A] hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                                    title={`Buka naskah pada halaman ${match.page_number}`}
                                  >
                                    <span>Lompat ke Hal {match.page_number}</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    isExempted
                                      ? 'bg-slate-100 text-slate-400 line-through'
                                      : match.similarity_score >= 85
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    Kemiripan: {match.similarity_score}%
                                  </span>
                                </div>
                              </div>

                              {/* Layout Dua Kolom Berdampingan (Side-by-Side) */}
                              <div className="grid grid-cols-2 gap-2.5">
                                {/* Kolom Kiri: Naskah Praktikan */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold text-slate-700">Naskah Praktikan</span>
                                    <span className="text-slate-400 font-mono">Hal {match.page_number}</span>
                                  </div>
                                  <div
                                    onClick={() => setSelectedPreviewImage({
                                      url: resolveImageUrl(match.student_image_url),
                                      title: `Gambar Praktikan - Halaman ${match.page_number}`
                                    })}
                                    className="group relative h-32 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-center p-1.5 overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
                                  >
                                    {match.student_image_url ? (
                                      <>
                                        <img
                                          src={resolveImageUrl(match.student_image_url)}
                                          alt={`Gambar Praktikan Hal ${match.page_number}`}
                                          className="max-h-full max-w-full object-contain"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-semibold gap-1">
                                          <Maximize2 className="w-3 h-3" />
                                          <span>Perbesar</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-[10px] text-slate-400">Pratinjau tidak tersedia</div>
                                    )}
                                  </div>
                                </div>

                                {/* Kolom Kanan: Arsip Pembanding */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold text-slate-700">Arsip Pembanding</span>
                                    <span className="text-slate-400 truncate max-w-[100px]" title={match.source_reference.author}>
                                      {match.source_reference.author}
                                    </span>
                                  </div>
                                  <div
                                    onClick={() => setSelectedPreviewImage({
                                      url: resolveImageUrl(match.source_image_url),
                                      title: `Arsip Pembanding (${match.source_reference.author})`
                                    })}
                                    className="group relative h-32 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-center p-1.5 overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
                                  >
                                    {match.source_image_url ? (
                                      <>
                                        <img
                                          src={resolveImageUrl(match.source_image_url)}
                                          alt="Gambar Pembanding"
                                          className="max-h-full max-w-full object-contain"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-semibold gap-1">
                                          <Maximize2 className="w-3 h-3" />
                                          <span>Perbesar</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-[10px] text-slate-400">Pratinjau tidak tersedia</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Informasi Sitasi Dokumen Sumber */}
                              <div className="flex items-center justify-between text-[10px] text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                                <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                                  <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="font-medium text-slate-500 shrink-0">Arsip:</span>
                                  <span className="font-mono text-slate-900 truncate" title={match.source_reference.source_file_name}>
                                    {match.source_reference.source_file_name}
                                  </span>
                                </div>
                                <div className="text-slate-500 shrink-0">
                                  <span>{match.source_reference.author}</span> • <span className="font-mono">TA {match.source_reference.year}</span>
                                </div>
                              </div>

                              {/* Kontrol Keputusan Evaluator dengan Selektor Dropdown Bergaya macOS */}
                              <div className="pt-2 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-slate-800">
                                      Keputusan Auditor
                                    </span>
                                    {match.hitl_status && match.hitl_status !== 'PENDING' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateHitlStatus(match.id, 'PENDING')}
                                        disabled={hitlMutation.isPending}
                                        className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer ml-1"
                                        title="Kembalikan status verifikasi ke awal"
                                      >
                                        <RotateCcw className="w-2.5 h-2.5" />
                                        <span>Reset</span>
                                      </button>
                                    )}
                                  </div>

                                  <select
                                    value={match.hitl_status || 'PENDING'}
                                    onChange={(e) => handleUpdateHitlStatus(match.id, e.target.value)}
                                    disabled={hitlMutation.isPending}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-colors ${
                                      isConfirmed
                                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                                        : isExempted
                                        ? 'bg-[#415A77]/10 text-[#0D1B2A] border-[#415A77]/25'
                                        : isNeedsReview
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <option value="PENDING">Belum Diperiksa</option>
                                    <option value="CONFIRMED">Plagiat Valid</option>
                                    <option value="EXEMPTED">Abaikan (Modul Resmi)</option>
                                    <option value="NEEDS_REVIEW">Perlu Klarifikasi</option>
                                  </select>
                                </div>

                                {/* Catatan Evaluator */}
                                <div>
                                  <input
                                    type="text"
                                    placeholder="Catatan justifikasi (contoh: 'Diagram alir latihan modul bab 2')..."
                                    value={noteVal}
                                    onChange={(e) => setNotesMap({ ...notesMap, [match.id]: e.target.value })}
                                    onBlur={() => handleSaveHitlNote(match.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveHitlNote(match.id);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* Sub-tab Galeri Seluruh Gambar Naskah */
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {extractedImages.length === 0 ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-slate-500 text-xs">
                      Belum ada gambar yang terindeks untuk naskah ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {extractedImages.map((img) => (
                        <div
                          key={img.id}
                          className="p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 space-y-1.5 transition-all group"
                        >
                          <div
                            onClick={() => setSelectedPreviewImage({
                              url: resolveImageUrl(img.url),
                              title: `Gambar Naskah - Halaman ${img.nomor_halaman}`
                            })}
                            className="relative h-28 bg-slate-50 rounded-md border border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                          >
                            <img
                              src={resolveImageUrl(img.url)}
                              alt={`Gambar Hal ${img.nomor_halaman}`}
                              className="max-h-full max-w-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-semibold gap-1">
                              <Maximize2 className="w-3 h-3" />
                              <span>Lihat</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-0.5 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold font-mono">
                              Hal {img.nomor_halaman}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetPage(img.nomor_halaman);
                                if (window.innerWidth < 768) {
                                  setMobileActiveView('pdf');
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-[#415A77]/10 hover:bg-[#415A77]/15 text-[#0D1B2A] font-semibold transition-colors cursor-pointer"
                            >
                              Buka di PDF
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 4: PENETAPAN NILAI AKHIR (macOS Grouped PANEL)            */}
          {/* ------------------------------------------------------------- */}
          {activeRightTab === 'verification' && (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-100 text-xs">
                {/* Header Panel */}
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#0D1B2A]" />
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Penetapan Nilai Manual (HITL)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Penyesuaian skor orisinalitas akhir dan predikat huruf
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitOverride} className="p-3.5 space-y-3.5">
                  {saveSuccess && (
                    <div className="p-2.5 rounded-md bg-[#415A77]/10 border border-[#415A77]/25 text-[#0D1B2A] text-xs flex items-center gap-2 animate-fade-in">
                      <Check className="w-4 h-4 text-[#8C6D1F]" />
                      <span>Penetapan nilai berhasil disimpan ke basis data.</span>
                    </div>
                  )}
                  {errorMsg && (
                    <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-fade-in">
                      {errorMsg}
                    </div>
                  )}

                  {/* Baris 1: Skor Orisinalitas Koreksi */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="scoreOverride" className="font-semibold text-slate-900 block cursor-pointer">
                        Skor Orisinalitas Koreksi
                      </Label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Rentang nilai 0.0 hingga 100.0%
                      </p>
                    </div>
                    <div className="relative w-28 shrink-0">
                      <Input
                        id="scoreOverride"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="85.0"
                        value={scoreOverride}
                        onChange={(e) => setScoreOverride(e.target.value)}
                        className="bg-slate-50 border-slate-300 text-xs h-8 rounded-md font-mono pl-2.5 pr-6 focus-visible:ring-2 focus-visible:ring-[#D4AF37] text-right"
                        required
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 font-mono select-none">%</span>
                    </div>
                  </div>

                  {/* Baris 2: Nilai Huruf Akhir */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Predikat Nilai Huruf
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Indeks huruf kelulusan resmi
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                      {['A', 'B', 'C', 'D', 'E'].map((grade) => {
                        const isSelected = nilaiHuruf === grade;
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => setNilaiHuruf(grade)}
                            className={`w-7 h-7 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {grade}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Baris 3: Rekomendasi HITL Otomatis */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Kalkulasi Rekomendasi HITL
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Rasio pengecualian gambar modul resmi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScoreOverride(recommendedHitlScore.toFixed(1))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono font-bold rounded border border-slate-200 transition-colors cursor-pointer"
                      title="Salin rekomendasi skor ke input koreksi"
                    >
                      Gunakan {recommendedHitlScore}%
                    </button>
                  </div>

                  {/* Tombol Simpan Nilai */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={overrideMutation.isPending}
                      className="w-full py-2 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{overrideMutation.isPending ? 'Menyimpan...' : 'Simpan Verifikasi Nilai'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>

      <Chatbot
        idLaporan={laporan.id_laporan}
        namaMahasiswa={laporan.nama_mahasiswa}
        onSelectHighlight={(id) => setActiveHighlightId(id)}
      />

      {/* Modal Preview Gambar Ukuran Penuh */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-4 space-y-3 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 truncate">
                {selectedPreviewImage.title}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPreviewImage(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center bg-slate-950/5 rounded-lg p-2 overflow-hidden">
              <img
                src={selectedPreviewImage.url}
                alt={selectedPreviewImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
