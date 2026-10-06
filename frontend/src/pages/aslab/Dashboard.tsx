import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '../../components/ui/input';
import { Folder, FolderOpen, FileText, ChevronDown, ChevronRight, Search, Activity, BookOpen, GraduationCap, ArrowRight } from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import ErrorState from '../../components/ui/error-state';
import PageHeader from '../../components/ui/page-header';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import StatusBadge from '../../components/ui/status-badge';

interface NavItem {
  id: string;
  name: string;
  type: 'prodi' | 'matkul' | 'kelas' | 'laporan';
  children?: NavItem[];
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  skor_orisinalitas?: number;
  nim?: string;
}

// Komponen rekursif untuk me-render item direktori pohon
function TreeNode({ item, depth, searchTerm, onSelectLaporan }: {
  item: NavItem;
  depth: number;
  searchTerm: string;
  onSelectLaporan: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2); // default open untuk tingkat atas

  const hasChildren = item.children && item.children.length > 0;
  
  // Mencocokkan pencarian
  const matchesSearch = (node: NavItem): boolean => {
    if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
    if (node.nim && node.nim.includes(searchTerm)) return true;
    if (node.children) {
      return node.children.some(child => matchesSearch(child));
    }
    return false;
  };

  if (searchTerm && !matchesSearch(item)) {
    return null;
  }

  const toggleOpen = () => {
    if (hasChildren) setIsOpen(!isOpen);
  };

  const getOrisinalitasColor = (score?: number) => {
    if (score === undefined) return 'text-slate-600';
    return score >= 75 ? 'text-[#0D1B2A] font-bold' : 'text-rose-700 font-bold';
  };

  return (
    <div className="select-none font-mono">
      <div
        role="button"
        tabIndex={0}
        onClick={item.type === 'laporan' ? () => onSelectLaporan(item.id) : toggleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (item.type === 'laporan') onSelectLaporan(item.id);
            else toggleOpen();
          }
        }}
        className={`flex items-center justify-between py-2.5 px-3.5 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
          item.type === 'laporan'
            ? 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
            : 'hover:bg-slate-100/70'
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <div className="flex items-center gap-2.5 truncate">
          {hasChildren ? (
            isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <div className="w-4" />
          )}

          {item.type === 'prodi' && <GraduationCap className="w-4.5 h-4.5 text-[#0D1B2A] shrink-0" />}
          {item.type === 'matkul' && <BookOpen className="w-4.5 h-4.5 text-slate-700 shrink-0" />}
          {item.type === 'kelas' && (isOpen ? <FolderOpen className="w-4.5 h-4.5 text-[#0D1B2A] shrink-0" /> : <Folder className="w-4.5 h-4.5 text-slate-600 shrink-0" />)}
          {item.type === 'laporan' && <FileText className="w-4.5 h-4.5 text-slate-500 shrink-0" />}

          <span className={`text-xs tracking-wide ${item.type === 'laporan' ? 'text-slate-800 font-sans font-medium' : 'text-[#0D1B2A] font-sans font-bold text-sm'}`}>
            {item.name}
          </span>
        </div>

        {item.type === 'laporan' && (
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {item.status === 'COMPLETED' && item.skor_orisinalitas !== undefined && (
              <span className={`text-[11px] font-mono tabular-nums ${getOrisinalitasColor(item.skor_orisinalitas)}`}>
                {item.skor_orisinalitas.toFixed(1)}% Orisinal
              </span>
            )}
            <StatusBadge status={item.status || 'QUEUED'} size="sm" />
          </div>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="mt-0.5 border-l border-slate-200 ml-5.5">
          {item.children?.map(child => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              searchTerm={searchTerm}
              onSelectLaporan={onSelectLaporan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AslabDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: navData, isLoading, error, refetch } = useQuery<NavItem[]>({
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

      {/* Directory Card */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-[#0D1B2A] uppercase tracking-wider">Struktur Folder Akademik</h2>
            <p className="text-slate-600 text-xs mt-0.5">Telusuri program studi, kelas praktikum, dan berkas analisis.</p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Input
              type="text"
              placeholder="Cari naskah / NIM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border-slate-200 text-[#0D1B2A] placeholder-slate-400 text-xs focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all w-full pl-9 h-10 rounded-md font-mono"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
          </div>
        </div>

        <div>
          {isLoading ? (
            <LoadingSpinner variant="fullpage" message="Menyelaraskan struktur direktori bimbingan..." />
          ) : error ? (
            <ErrorState 
              title="Gagal Memuat Direktori"
              description={(error as Error)?.message || 'Gagal memuat direktori bimbingan. Silakan coba beberapa saat lagi.'}
              onRetry={() => refetch()}
            />
          ) : !navData || navData.length === 0 ? (
            <EmptyState 
              icon={Activity}
              title="Belum ada data laporan aktif yang diunggah"
              description="Hubungi Admin atau gunakan menu Pengecekan Dokumen untuk memulai."
            />
          ) : (
            <div className="space-y-1">
              {navData.map(node => (
                <TreeNode
                  key={node.id}
                  item={node}
                  depth={0}
                  searchTerm={searchTerm}
                  onSelectLaporan={handleSelectLaporan}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
