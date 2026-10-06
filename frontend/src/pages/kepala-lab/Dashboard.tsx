import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Activity, BarChart3 } from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import ErrorState from '../../components/ui/error-state';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import StatusBadge from '../../components/ui/status-badge';

interface LaporanTerbaru {
  id_laporan: string;
  nama_mahasiswa: string;
  nim: string;
  nama_prodi: string;
  nama_kelas: string;
  nama_matkul: string;
  skor_orisinalitas: number;
  tanggal_diunggah: string;
}

interface ProdiStat {
  id_program_studi: string;
  nama_prodi: string;
  rata_skor: number;
  total_laporan: number;
}

interface AnalyticsResponse {
  totalLaporan: number;
  rataSkor: number;
  totalPlagiat: number;
  totalAslab: number;
  prodiStats: ProdiStat[];
  laporanTerbaru: LaporanTerbaru[];
}

export default function KepalaLabDashboard() {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Fetch data analytics
  const { data, isLoading, error, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ['kalabAnalytics'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/reports/analytics`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat rekap analitik.');
      return res.json();
    },
  });

  if (isLoading) {
    return <LoadingSpinner variant="fullpage" message="Memuat rekapitulasi analitik..." />;
  }

  if (error || !data) {
    return (
      <ErrorState 
        title="Gagal Memuat Rekap Analitik"
        description={(error as Error)?.message || 'Terjadi kesalahan sistem saat mengambil data analitik kepala lab.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      
      {/* Header */}
      <PageHeader 
        title="Dasbor"
        titleAccent="Rekapitulasi Analitik"
        description="Pantau tingkat orisinalitas naskah praktikan, sebaran plagiarisme, dan performa asisten di seluruh program studi."
      />

      {/* Grid 1: Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Laporan */}
        <StatCard
          title="Total Laporan"
          value={data.totalLaporan}
          subtitle="Berkas PDF Terunggah"
          variant="default"
        />

        {/* Card 2: Rata-rata Skor Orisinalitas */}
        <StatCard
          title="Rata-Rata Orisinalitas"
          value={`${data.rataSkor}%`}
          subtitle="Skor Integritas Makro"
          variant="brass"
        />

        {/* Card 3: Plagiat Tinggi */}
        <StatCard
          title="Plagiat Tinggi (<50%)"
          value={data.totalPlagiat}
          subtitle="Butuh Evaluasi Khusus"
          variant="rose"
        />

        {/* Card 4: Asisten Aktif */}
        <StatCard
          title="Asisten Lab"
          value={data.totalAslab}
          subtitle="Aslab Terdaftar di Sistem"
          variant="default"
        />
      </div>

      {/* Grid 2: Sebaran Prodi & Laporan Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Kolom Kiri: Ringkasan Prodi (2/5) */}
        <div className="lg:col-span-2 rounded-lg border border-slate-200/80 bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[#0D1B2A]">
              <BarChart3 className="w-4 h-4 text-[#0D1B2A]" />
              Sebaran Program Studi
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Rata-rata tingkat orisinalitas di tiap prodi bimbingan.</p>
          </div>

          <div className="space-y-3.5 py-2 flex-1 flex flex-col justify-center">
            {data.prodiStats.length === 0 ? (
              <div className="text-center text-slate-500 text-xs italic py-4">Belum ada data prodi.</div>
            ) : (
              data.prodiStats.map((ps) => (
                <div key={ps.id_program_studi} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{ps.nama_prodi}</span>
                    <span className="text-[#0D1B2A] font-mono tabular-nums">{ps.rata_skor}% ({ps.total_laporan} Laporan)</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        ps.rata_skor >= 80 
                          ? 'bg-[#D4AF37]' 
                          : ps.rata_skor >= 60 
                          ? 'bg-amber-600' 
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${ps.rata_skor}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-100">
            *Semakin tinggi persentase, semakin orisinal laporan praktikan.
          </div>
        </div>

        {/* Kolom Kanan: 5 Laporan Terbaru (3/5) */}
        <div className="lg:col-span-3 rounded-lg border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[#0D1B2A]">
            <Activity className="w-4 h-4 text-[#0D1B2A]" />
            Aktivitas Analisis Terbaru
          </h3>
          
          <div className="space-y-2.5 pt-1">
            {!data.laporanTerbaru || data.laporanTerbaru.length === 0 ? (
              <EmptyState 
                title="Belum Ada Laporan"
                description="Belum ada laporan praktikum yang diunggah untuk dianalisis."
              />
            ) : (
              data.laporanTerbaru.map((lap) => (
                <div 
                  key={lap.id_laporan} 
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/aslab/view/${lap.id_laporan}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/aslab/view/${lap.id_laporan}`);
                    }
                  }}
                  className="flex items-center justify-between p-3.5 bg-slate-50/60 hover:bg-white border border-slate-200/70 hover:border-slate-300 rounded-lg transition-all cursor-pointer group shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  <div className="space-y-0.5 max-w-[70%]">
                    <h4 className="text-xs font-bold text-[#0D1B2A] group-hover:text-[#0D1B2A] transition-colors truncate">
                      {lap.nama_mahasiswa} ({lap.nim})
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium truncate">
                      {lap.nama_prodi} • {lap.nama_matkul} • {lap.nama_kelas}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold tabular-nums ${
                      lap.skor_orisinalitas >= 75 ? 'text-[#0D1B2A]' : 'text-rose-700'
                    }`}>
                      {lap.skor_orisinalitas}%
                    </span>
                    <StatusBadge 
                      status={
                        lap.skor_orisinalitas >= 75 
                          ? 'COMPLETED' 
                          : lap.skor_orisinalitas >= 50 
                          ? 'PROCESSING' 
                          : 'FAILED'
                      }
                    />
                    
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/aslab/view/${lap.id_laporan}`);
                      }}
                      className="h-8 w-8 p-0"
                      title="Lihat Detail Orisinalitas Spasial"
                      aria-label="Lihat Detail Orisinalitas Spasial"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
