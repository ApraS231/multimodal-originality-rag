import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  useAllReports, 
  useDeleteReport, 
  useBulkDeleteReports,
  useProdi,
  useMatkul,
  useKelas
} from '../../api/admin';
import type { ReportItem } from '../../api/admin';
import PageHeader from '../../components/ui/page-header';
import StatusBadge from '../../components/ui/status-badge';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import { useToast } from '../../components/ui/toast-provider';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SegmentedControl } from '../../components/ui/grouped-list';
import { 
  FolderArchive, 
  Search, 
  Trash2, 
  Eye, 
  FileText, 
  AlertTriangle, 
  X, 
  ExternalLink, 
  CheckSquare, 
  Square, 
  FolderTree, 
  List, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  RefreshCw, 
  Layers, 
  HardDrive,
  CloudUpload
} from 'lucide-react';

export default function AdminRepository() {
  const toast = useToast();
  const navigate = useNavigate();

  // State Filter & Tampilan
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('ALL');
  const [selectedMatkul, setSelectedMatkul] = useState('ALL');
  const [selectedKelas, setSelectedKelas] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');

  // Multi-selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal States
  const [deleteTarget, setDeleteTarget] = useState<ReportItem | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReportItem | null>(null);

  // Tree View Expand/Collapse States
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Query Master Data
  const { data: prodiList } = useProdi();
  const { data: matkulList } = useMatkul();
  const { data: kelasList } = useKelas();

  // Query Laporan
  const filterParams = useMemo(() => ({
    search: searchTerm,
    id_program_studi: selectedProdi,
    id_mata_kuliah: selectedMatkul,
    id_kelas: selectedKelas,
    status: selectedStatus,
  }), [searchTerm, selectedProdi, selectedMatkul, selectedKelas, selectedStatus]);

  const { data: reportsData, isLoading, isFetching, refetch } = useAllReports(filterParams);
  const deleteMutation = useDeleteReport();
  const bulkDeleteMutation = useBulkDeleteReports();

  const reports = reportsData?.reports || [];
  const stats = reportsData?.stats || { totalReports: 0, avgOriginality: 0, totalVectors: 0 };
  const totalCompleted = useMemo(() => reports.filter(r => r.status === 'COMPLETED').length, [reports]);

  // Handle Selection Checkboxes
  const isAllSelected = reports.length > 0 && selectedIds.length === reports.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reports.map((r) => r.id_laporan));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Eksekusi Hapus Satuan
  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id_laporan);
      toast.success(
        'Naskah Berhasil Dihapus',
        `Naskah ${deleteTarget.nama_mahasiswa} beserta embedding pgvector dan berkas fisik telah dibersihkan secara permanen.`
      );
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id_laporan));
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus Naskah', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Eksekusi Hapus Massal
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await bulkDeleteMutation.mutateAsync(selectedIds);
      toast.success(
        'Penghapusan Massal Berhasil',
        `Sebanyak ${res.deletedCount || selectedIds.length} naskah sampel berhasil dihapus dari sistem relasional, penyimpanan berkas, dan pgvector.`
      );
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      toast.error('Gagal Menghapus Sampel', err.message || 'Terjadi galat saat eksekusi penghapusan massal.');
    }
  };

  // Toggle Node Tree View
  const toggleTreeNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  // Struktur Hirarki untuk Tree View: Prodi -> Matkul -> Kelas -> Laporan[]
  const treeHierarchy = useMemo(() => {
    const hierarchy: Record<string, {
      prodiNama: string;
      matkuls: Record<string, {
        matkulNama: string;
        kelasMap: Record<string, {
          kelasNama: string;
          items: ReportItem[];
        }>;
      }>;
    }> = {};

    reports.forEach((item) => {
      const prodiKey = item.id_program_studi || 'UNASSIGNED_PRODI';
      const prodiNama = item.prodi?.nama_prodi || 'Program Studi Tidak Terdefinisi';

      const matkulKey = item.id_mata_kuliah || 'UNASSIGNED_MATKUL';
      const matkulNama = item.matkul?.nama_matkul || 'Mata Kuliah Tidak Terdefinisi';

      const kelasKey = item.id_kelas || 'UNASSIGNED_KELAS';
      const kelasNama = item.kelas?.nama_kelas || 'Kelas Praktikum Umum';

      if (!hierarchy[prodiKey]) {
        hierarchy[prodiKey] = { prodiNama, matkuls: {} };
      }
      if (!hierarchy[prodiKey].matkuls[matkulKey]) {
        hierarchy[prodiKey].matkuls[matkulKey] = { matkulNama, kelasMap: {} };
      }
      if (!hierarchy[prodiKey].matkuls[matkulKey].kelasMap[kelasKey]) {
        hierarchy[prodiKey].matkuls[matkulKey].kelasMap[kelasKey] = { kelasNama, items: [] };
      }

      hierarchy[prodiKey].matkuls[matkulKey].kelasMap[kelasKey].items.push(item);
    });

    return hierarchy;
  }, [reports]);

  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans pb-16">
      {/* 1. Header Utama Sederhana */}
      <PageHeader
        title="Direktori"
        titleAccent="Berkas"
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
              onClick={() => refetch()}
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

      {/* 3. Filter and Content Toolbar */}
      <Card size="sm" className="space-y-4">
        {/* Baris Atas: Input Pencarian & Switcher Mode */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Cari berdasarkan nama mahasiswa, NIM, atau berkas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 transition-colors w-full pl-9 pr-9 h-9 rounded-md shadow-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <SegmentedControl
            options={[
              { value: 'table', label: 'Tabel', icon: <List className="w-3.5 h-3.5" /> },
              { value: 'tree', label: 'Pohon Direktori', icon: <FolderTree className="w-3.5 h-3.5" /> },
            ]}
            value={viewMode}
            onChange={setViewMode}
            size="sm"
            className="self-end sm:self-auto"
          />
        </div>

        {/* Baris Bawah: Dropdown Filter dengan Label Bersih */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">
              Program Studi
            </label>
            <select
              value={selectedProdi}
              onChange={(e) => setSelectedProdi(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 shadow-xs cursor-pointer"
            >
              <option value="ALL">Semua Program Studi</option>
              {prodiList?.map((p) => (
                <option key={p.id_program_studi} value={p.id_program_studi}>
                  {p.nama_prodi}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">
              Mata Kuliah
            </label>
            <select
              value={selectedMatkul}
              onChange={(e) => setSelectedMatkul(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 shadow-xs cursor-pointer"
            >
              <option value="ALL">Semua Mata Kuliah</option>
              {matkulList?.map((m) => (
                <option key={m.id_mata_kuliah} value={m.id_mata_kuliah}>
                  {m.nama_matkul}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">
              Kelas Praktikum
            </label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 shadow-xs cursor-pointer"
            >
              <option value="ALL">Semua Kelas</option>
              {kelasList?.map((k) => (
                <option key={k.id_kelas} value={k.id_kelas}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">
              Status Pemrosesan
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 shadow-xs cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="QUEUED">QUEUED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>

        {/* Ringkasan & Reset Filter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Menampilkan <strong className="text-slate-900 font-bold">{reports.length}</strong> naskah laporan</span>
          {(selectedProdi !== 'ALL' || selectedMatkul !== 'ALL' || selectedKelas !== 'ALL' || selectedStatus !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedProdi('ALL');
                setSelectedMatkul('ALL');
                setSelectedKelas('ALL');
                setSelectedStatus('ALL');
                setSearchTerm('');
              }}
              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </Card>

      {/* 4. Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#0D1B2A] text-white px-5 py-3 rounded-lg shadow-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300 border border-slate-700/80">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-md bg-[#0D1B2A] text-[#F7F3E9] font-mono font-bold flex items-center justify-center text-xs">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold">
              {selectedIds.length} naskah sampel dipilih
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-300 hover:text-white hover:bg-white/10"
            >
              Batal Pilih
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih ({selectedIds.length})</span>
            </Button>
          </div>
        </div>
      )}

      {/* 5. Konten Utama: Tabel / Pohon / Empty State Sederhana */}
      {isLoading ? (
        <Card className="min-h-[260px] flex items-center justify-center">
          <LoadingSpinner message="Menyelaraskan direktori berkas laporan..." />
        </Card>
      ) : reports.length === 0 ? (
        <Card className="py-16">
          <EmptyState 
            icon={FolderArchive}
            title={searchTerm || selectedProdi !== 'ALL' || selectedMatkul !== 'ALL' || selectedKelas !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Tidak Ada Naskah yang Cocok'
              : 'Belum Ada Naskah Laporan'}
            description={searchTerm || selectedProdi !== 'ALL' || selectedMatkul !== 'ALL' || selectedKelas !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Tidak ada berkas yang sesuai dengan parameter filter yang dipilih.'
              : 'Repositori saat ini belum memiliki berkas laporan praktikum.'}
            actionLabel={searchTerm || selectedProdi !== 'ALL' || selectedMatkul !== 'ALL' || selectedKelas !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Reset Filter'
              : 'Mulai Penyerapan Dokumen'}
            onAction={() => {
              if (searchTerm || selectedProdi !== 'ALL' || selectedMatkul !== 'ALL' || selectedKelas !== 'ALL' || selectedStatus !== 'ALL') {
                setSelectedProdi('ALL');
                setSelectedMatkul('ALL');
                setSelectedKelas('ALL');
                setSelectedStatus('ALL');
                setSearchTerm('');
              } else {
                navigate('/admin/seeding');
              }
            }}
          />
        </Card>
      ) : viewMode === 'table' ? (
        /* ================= TAMPILAN TABEL INTERAKTIF ================= */
        <Card className="overflow-hidden p-0 shadow-sm border border-slate-200/80">
          <TableContainer ariaLabel="Tabel Dokumen Laporan Praktikum Repository">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center" align="center">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-slate-500 hover:text-[#0D1B2A] transition-colors cursor-pointer p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                      title={isAllSelected ? 'Batalkan pilih semua' : 'Pilih semua di halaman ini'}
                      aria-label={isAllSelected ? 'Batalkan pilih semua' : 'Pilih semua di halaman ini'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#0D1B2A]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Mahasiswa & Dokumen</TableHead>
                  <TableHead>Program Studi & Kelas</TableHead>
                  <TableHead>Mata Kuliah & Tahun</TableHead>
                  <TableHead>Status & Waktu</TableHead>
                  <TableHead>Orisinalitas</TableHead>
                  <TableHead align="right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const isSelected = selectedIds.includes(report.id_laporan);
                  const fileName = report.tautan_berkas ? report.tautan_berkas.split(/[/\\]/).pop() : '-';

                  return (
                    <TableRow
                      key={report.id_laporan}
                      selected={isSelected}
                    >
                      {/* Checkbox */}
                      <TableCell align="center" className="w-12 text-center">
                        <button
                          onClick={() => handleToggleSelectOne(report.id_laporan)}
                          className="text-slate-500 hover:text-[#0D1B2A] transition-colors cursor-pointer p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                          aria-label={`Pilih laporan ${report.nama_mahasiswa}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#0D1B2A]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </TableCell>

                      {/* Mahasiswa & Dokumen */}
                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-[#0D1B2A] truncate max-w-[240px]">
                            {report.nama_mahasiswa}
                          </span>
                          <span className="text-[11px] text-slate-600 font-mono tabular-nums mt-0.5">
                            NIM: {report.nim}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[220px] flex items-center gap-1 mt-0.5" title={report.tautan_berkas}>
                            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{fileName}</span>
                          </span>
                        </div>
                      </TableCell>

                      {/* Prodi & Kelas */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#0D1B2A]">
                            {report.prodi?.nama_prodi || '-'}
                          </span>
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
                              Kelas: {report.kelas?.nama_kelas || '-'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Mata Kuliah & Tahun */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#0D1B2A]">
                            {report.matkul?.nama_matkul || '-'}
                          </span>
                          <span className="text-[11px] text-slate-600 font-mono tabular-nums mt-0.5">
                            T.A: {report.tahun_akademik || '-'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status & Waktu */}
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={report.status} size="sm" pulse={report.status === 'PROCESSING'} />
                          <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                            {new Date(report.tanggal_dibuat).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </TableCell>

                      {/* Orisinalitas */}
                      <TableCell tabularNums>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono tabular-nums font-black text-sm ${
                              report.skor_orisinalitas >= 75 
                                ? 'text-[#0D1B2A]' 
                                : report.skor_orisinalitas >= 50 
                                ? 'text-amber-700' 
                                : 'text-rose-700'
                            }`}>
                              {report.skor_orisinalitas}%
                            </span>
                            {report.nilai_huruf && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0D1B2A] font-bold text-[10px] font-mono">
                                {report.nilai_huruf}
                              </span>
                            )}
                          </div>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full ${
                                report.skor_orisinalitas >= 75
                                  ? 'bg-[#D4AF37]'
                                  : report.skor_orisinalitas >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, report.skor_orisinalitas))}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Lihat PDF */}
                          <button
                            onClick={() => setPreviewReport(report)}
                            className="p-2 rounded-md border border-slate-200 bg-white hover:bg-[#0D1B2A] hover:text-white hover:border-[#0D1B2A] text-[#0D1B2A] transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                            title="Pratinjau Berkas PDF"
                            aria-label="Pratinjau Berkas PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Hapus Sampel */}
                          <button
                            onClick={() => setDeleteTarget(report)}
                            className="p-2 rounded-md border border-rose-200 bg-rose-50/70 hover:bg-rose-600 hover:text-white hover:border-rose-600 text-rose-600 transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                            title="Hapus Sampel Dokumen Permanen"
                            aria-label="Hapus Sampel Dokumen Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        /* ================= TAMPILAN POHON DIREKTORI (TREE VIEW) ================= */
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0D1B2A]/5 border border-[#0D1B2A]/10 flex items-center justify-center text-[#0D1B2A]">
                <FolderArchive className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#0D1B2A]">Struktur Direktori Repositori</h3>
                <p className="text-[11px] text-slate-500">
                  Hirarki berkas: Program Studi → Mata Kuliah → Kelas Praktikum → Sampel Laporan
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 font-sans">
            {Object.entries(treeHierarchy).map(([prodiKey, prodiVal]) => {
              const isProdiOpen = expandedNodes[prodiKey] ?? true;
              return (
                <div key={prodiKey} className="border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50/40">
                  {/* Node Prodi */}
                  <div
                    onClick={() => toggleTreeNode(prodiKey)}
                    className="flex items-center justify-between px-4 py-3 bg-slate-100/80 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      {isProdiOpen ? (
                        <FolderOpen className="w-4 h-4 text-[#0D1B2A]" />
                      ) : (
                        <Folder className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="font-bold text-xs text-[#0D1B2A]">{prodiVal.prodiNama}</span>
                    </div>
                    {isProdiOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>

                  {/* Level Matkul */}
                  {isProdiOpen && (
                    <div className="p-3 pl-6 space-y-2 border-t border-slate-200/80">
                      {Object.entries(prodiVal.matkuls).map(([matkulKey, matkulVal]) => {
                        const mNodeKey = `${prodiKey}_${matkulKey}`;
                        const isMatkulOpen = expandedNodes[mNodeKey] ?? true;

                        return (
                          <div key={matkulKey} className="border border-slate-200/80 rounded-md bg-white overflow-hidden">
                            {/* Node Matkul */}
                            <div
                              onClick={() => toggleTreeNode(mNodeKey)}
                              className="flex items-center justify-between px-3 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-semibold text-xs text-[#0D1B2A]">{matkulVal.matkulNama}</span>
                              </div>
                              {isMatkulOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            </div>

                            {/* Level Kelas */}
                            {isMatkulOpen && (
                              <div className="p-2.5 pl-6 space-y-2">
                                {Object.entries(matkulVal.kelasMap).map(([kelasKey, kelasVal]) => {
                                  return (
                                    <div key={kelasKey} className="space-y-2">
                                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <HardDrive className="w-3 h-3 text-slate-400" />
                                        <span>Kelas {kelasVal.kelasNama}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          ({kelasVal.items.length} naskah)
                                        </span>
                                      </div>

                                      {/* List Naskah */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                        {kelasVal.items.map((item) => (
                                          <div
                                            key={item.id_laporan}
                                            className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-white rounded-lg border border-slate-200/80 hover:border-slate-300 transition-all text-xs shadow-2xs"
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                              <div className="w-8 h-8 rounded-lg bg-[#0D1B2A]/5 flex items-center justify-center text-[#0D1B2A] shrink-0">
                                                <FileText className="w-4 h-4" />
                                              </div>
                                              <div className="min-w-0">
                                                <p className="font-bold text-[#0D1B2A] truncate">
                                                  {item.nama_mahasiswa}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-mono truncate">
                                                  NIM: {item.nim} | Orisinalitas: <strong className="text-[#0D1B2A]">{item.skor_orisinalitas}%</strong>
                                                </p>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              <button
                                                onClick={() => setPreviewReport(item)}
                                                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-[#0D1B2A] hover:text-white text-[#0D1B2A] transition-all cursor-pointer shadow-2xs"
                                                title="Pratinjau PDF"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => setDeleteTarget(item)}
                                                className="p-1.5 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 transition-all cursor-pointer shadow-2xs"
                                                title="Hapus Sampel"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ================= MODAL PRATINJAU PDF ================= */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-lg shadow-md flex flex-col overflow-hidden border border-slate-200">
            {/* Header Modal PDF */}
            <div className="px-6 py-4 bg-[#0D1B2A] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold truncate max-w-xl">
                    {previewReport.nama_mahasiswa} - {previewReport.nim}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    {previewReport.prodi?.nama_prodi || 'Prodi'} | {previewReport.matkul?.nama_matkul || 'Matkul'} | Skor Orisinalitas: {previewReport.skor_orisinalitas}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${backendUrl}/api/reports/${previewReport.id_laporan}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru</span>
                </a>
                <button
                  onClick={() => setPreviewReport(null)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Konten PDF Iframe */}
            <div className="flex-1 bg-slate-950 p-2">
              <iframe
                src={`${backendUrl}/api/reports/${previewReport.id_laporan}/pdf`}
                title={`PDF ${previewReport.nama_mahasiswa}`}
                className="w-full h-full border-none rounded-md bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS SATUAN ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-md border border-rose-100 space-y-4">
            <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-[#0D1B2A]">
                Hapus Sampel Naskah Laporan?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tindakan ini tidak dapat dibatalkan. Seluruh data terkait dokumen ini akan dibersihkan secara permanen:
              </p>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-md p-3 text-xs text-rose-900 space-y-1.5 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                <span>Naskah: <strong>{deleteTarget.nama_mahasiswa}</strong> ({deleteTarget.nim})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                <span>Vektor Embedding pgvector (<code className="font-mono text-[11px] bg-rose-100/70 px-1 py-0.5 rounded text-rose-800">laporan_text_vectors</code>)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                <span>Berkas fisik PDF pada server dan Supabase Storage</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmSingleDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                {deleteMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus Permanen</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS MASSAL ================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-md border border-rose-100 space-y-4">
            <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-[#0D1B2A]">
                Hapus {selectedIds.length} Sampel Terpilih?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Seluruh naskah yang dipilih akan dihapus secara kaskade dari database relasional, Supabase Storage, dan tabel vektor embedding pgvector.
              </p>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-md p-3 text-xs text-rose-900 space-y-1 font-medium">
              <p>⚠️ Peringatan: Dokumen yang dihapus tidak dapat dipulihkan kembali ke indeks vektor.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={bulkDeleteMutation.isPending}
                className="text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                {bulkDeleteMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus {selectedIds.length} Sampel</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
