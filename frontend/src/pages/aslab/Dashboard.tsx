import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import AcademicFileManager from '../../components/academic-file-manager';
import type { NavItem } from '../../components/academic-file-manager';

export default function AslabDashboard() {
  const navigate = useNavigate();

  const { data: navData, isLoading } = useQuery<NavItem[]>({
    queryKey: ['aslabNav'],
    queryFn: async () => {
      const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/reports/nav`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat navigasi direktori');
      return res.json();
    },
    refetchInterval: 10000, // polling otomatis setiap 10 detik untuk progress bar reaktif
  });

  const handleSelectLaporan = (id: string) => {
    navigate(`/aslab/view/${id}`);
  };

  // Helper rekursif untuk mengumpulkan seluruh berkas laporan praktikan
  const collectReports = (nodes: NavItem[]): NavItem[] => {
    let reports: NavItem[] = [];
    for (const node of nodes) {
      if (node.type === 'laporan') {
        reports.push(node);
      }
      if (node.children) {
        reports = reports.concat(collectReports(node.children));
      }
    }
    return reports;
  };

  const allReports = navData ? collectReports(navData) : [];
  const totalReports = allReports.length;
  const completedReports = allReports.filter(r => r.status === 'COMPLETED').length;
  const activeQueue = allReports.filter(r => r.status === 'PROCESSING' || r.status === 'QUEUED').length;
  const completedWithScore = allReports.filter(r => r.status === 'COMPLETED' && r.skor_orisinalitas !== undefined);
  const avgScore = completedWithScore.length > 0
    ? (completedWithScore.reduce((acc, curr) => acc + (curr.skor_orisinalitas || 0), 0) / completedWithScore.length).toFixed(1)
    : '0.0';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Direktori"
        titleAccent="Laporan"
        description="Direktori naskah bimbingan, verifikasi kelulusan praktikum, dan pemeriksaan skor orisinalitas."
        actions={
          <Button
            onClick={() => navigate('/aslab/checker')}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <span>Pengecekan Dokumen</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Naskah */}
        <StatCard
          title="Total Berkas Bimbingan"
          value={totalReports}
          subtitle="Laporan Terdaftar"
          variant="default"
        />

        {/* Card 2: Selesai Dianalisis */}
        <StatCard
          title="Analisis Selesai"
          value={completedReports}
          subtitle="Status COMPLETED"
          variant="brass"
        />

        {/* Card 3: Rata-Rata Orisinalitas */}
        <StatCard
          title="Rata-Rata Orisinalitas"
          value={`${avgScore}%`}
          subtitle="Integritas Akademik"
          variant="brass"
        />

        {/* Card 4: Antrean Aktif */}
        <StatCard
          title="Antrean Proses"
          value={activeQueue}
          subtitle={activeQueue > 0 ? "Dalam Antrean Pekerja" : "Antrean Bersih"}
          variant={activeQueue > 0 ? "amber" : "default"}
        />
      </div>

      {/* File Manager Direktori Akademik (Role Aslab: View Only) */}
      <AcademicFileManager
        role="ASLAB"
        navData={navData}
        isLoading={isLoading}
        onSelectLaporan={handleSelectLaporan}
        title="Direktori Berkas Bimbingan"
        subtitle="Telusuri program studi, kelas praktikum, dan naskah bimbingan orisinalitas."
      />
    </div>
  );
}
