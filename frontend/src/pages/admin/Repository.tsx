import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useAllReports } from '../../api/admin';
import type { ReportItem } from '../../api/admin';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import AcademicFileManager from '../../components/academic-file-manager';
import type { NavItem } from '../../components/academic-file-manager';
import { 
  FileText, 
  X, 
  RefreshCw, 
  CloudUpload
} from 'lucide-react';
import { useToast } from '../../components/ui/toast-provider';

export default function AdminRepository() {
  const toast = useToast();
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Query Navigasi Direktori untuk File Manager
  const { data: navData, isLoading: isNavLoading } = useQuery<NavItem[]>({
    queryKey: ['aslabNav'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/reports/nav`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat direktori');
      return res.json();
    },
  });

  // Query Laporan & Statistik Repositori
  const { data: reportsData, isFetching, refetch } = useAllReports();
  const reports = reportsData?.reports || [];
  const stats = reportsData?.stats || { totalReports: 0, avgOriginality: 0, totalVectors: 0 };
  const totalCompleted = useMemo(() => reports.filter(r => r.status === 'COMPLETED').length, [reports]);

  // Modal Pratinjau PDF
  const [previewReport, setPreviewReport] = useState<ReportItem | null>(null);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 text-[#0D1B2A] font-sans animate-fade-in">
      {/* 1. Header Halaman */}
      <PageHeader
        title="Direktori Berkas"
        description="Repositori naskah laporan praktikum, verifikasi orisinalitas, dan manajemen sampel berkas."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/admin/seeding')}
              className="gap-1.5"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Serap Dokumen</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                toast.info('Menyinkronkan Repositori', 'Memperbarui data direktori berkas...');
              }}
              disabled={isFetching}
              className="gap-1.5"
              title="Segarkan data terkini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#0D1B2A]' : ''}`} />
              <span>Segarkan</span>
            </Button>
          </div>
        }
      />

      {/* 2. Ringkasan Metrik (Antislop StatCards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Naskah"
          value={<>{stats.totalReports} <span className="text-xs font-normal text-slate-500 ml-1">dokumen</span></>}
          description="Basis data relasional"
          variant="default"
        />

        <StatCard
          title="Vektor pgvector"
          value={<>{stats.totalVectors} <span className="text-xs font-mono font-normal text-slate-500 ml-1">chunk</span></>}
          description="Dense HNSW (768 dimensi)"
          variant="default"
        />

        <StatCard
          title="Naskah Selesai"
          value={<>{totalCompleted} <span className="text-xs font-normal text-[#0D1B2A]/80 ml-1">/ {reports.length}</span></>}
          description="Siap evaluasi orisinalitas"
          variant="brass"
        />

        <StatCard
          title="Rata-rata Orisinalitas"
          value={`${stats.avgOriginality}%`}
          description="Integritas naskah"
          variant="amber"
        />
      </div>

      {/* 3. Konten Utama: Academic File Manager */}
      <AcademicFileManager
        role="ADMIN"
        navData={navData}
        isLoading={isNavLoading}
        onSelectLaporan={(id) => {
          const found = reports.find(r => r.id_laporan === id);
          if (found) setPreviewReport(found);
          else navigate(`/aslab/view/${id}`);
        }}
        title="File Manager Repositori Naskah"
        subtitle="Manajemen penuh struktur folder akademik: buat folder, unggah naskah, ubah nama, palet warna, dan penghapusan."
      />

      {/* 4. Modal Pratinjau Dokumen PDF (Portaled) */}
      {previewReport && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewReport(null);
          }}
        >
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0D1B2A]" />
                <h3 className="font-bold text-sm text-[#0D1B2A]">
                  Pratinjau Naskah: {previewReport.nama_mahasiswa} ({previewReport.nim})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2 overflow-hidden">
              <iframe
                src={`${backendUrl}/api/reports/${previewReport.id_laporan}/pdf`}
                title={`PDF ${previewReport.nama_mahasiswa}`}
                className="w-full h-full border-none rounded-md bg-white"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
