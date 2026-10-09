import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMatkul, useCreateMatkul, useUpdateMatkul, useDeleteMatkul } from '../../api/admin';
import type { MataKuliah } from '../../api/admin';
import { Can } from '../../components/providers';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  BookOpen, 
  X, 
  Check,
  CheckCircle2, 
  Copy, 
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Database,
  FolderArchive,
  Users,
  UserCheck,
  FileText,
  Clock
} from 'lucide-react';
import { useToast } from '../../components/ui/toast-provider';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { GroupedList, GroupedItem, SegmentedControl } from '../../components/ui/grouped-list';
import { cn } from '@/lib/utils';

export default function MataKuliahPage() {
  const navigate = useNavigate();
  const { data: matkulList, isLoading, error, refetch, isFetching } = useMatkul();
  const createMutation = useCreateMatkul();
  const updateMutation = useUpdateMatkul();
  const deleteMutation = useDeleteMatkul();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog & Detail states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create');
  const [selectedMatkul, setSelectedMatkul] = useState<MataKuliah | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailMatkul, setDetailMatkul] = useState<MataKuliah | null>(null);
  const [drawerTab, setDrawerTab] = useState<'summary' | 'reports' | 'aslab'>('summary');
  const [copiedId, setCopiedId] = useState(false);

  // Sinkronisasi data detail dengan cache query agar selalu memuat data aslab dan laporan terbaru
  const currentMatkul = useMemo(() => {
    if (!detailMatkul) return null;
    return matkulList?.find((m) => m.id_mata_kuliah === detailMatkul.id_mata_kuliah) || detailMatkul;
  }, [matkulList, detailMatkul]);

  // Form Fields
  const [inputNama, setInputNama] = useState('');
  const [valError, setValError] = useState('');
  const inputNamaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDialogOpen) {
      const timer = setTimeout(() => {
        inputNamaRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDialogOpen]);

  // Sinkronisasi status buka drawer dengan maskot CRT agar maskot bergeser otomatis
  useEffect(() => {
    if (isDetailOpen) {
      document.body.setAttribute('data-drawer-open', 'true');
      window.dispatchEvent(new CustomEvent('drawer-state-change', { detail: { open: true } }));
    } else {
      document.body.removeAttribute('data-drawer-open');
      window.dispatchEvent(new CustomEvent('drawer-state-change', { detail: { open: false } }));
    }
    return () => {
      document.body.removeAttribute('data-drawer-open');
      window.dispatchEvent(new CustomEvent('drawer-state-change', { detail: { open: false } }));
    };
  }, [isDetailOpen]);

  const handleOpenCreate = () => {
    setDialogMode('create');
    setSelectedMatkul(null);
    setInputNama('');
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenUpdate = (matkul: MataKuliah) => {
    setDialogMode('update');
    setSelectedMatkul(matkul);
    setInputNama(matkul.nama_matkul);
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenDetail = (matkul: MataKuliah) => {
    setDetailMatkul(matkul);
    setDrawerTab('summary');
    setIsDetailOpen(true);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.info('ID Disalin', 'UUID mata kuliah berhasil disalin ke clipboard.');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim()) {
      setValError('Nama Mata Kuliah wajib diisi.');
      return;
    }

    try {
      if (dialogMode === 'create') {
        await createMutation.mutateAsync(inputNama);
        toast.success('Mata Kuliah Dibuat', `Mata kuliah ${inputNama} berhasil didaftarkan.`);
      } else if (dialogMode === 'update' && selectedMatkul) {
        await updateMutation.mutateAsync({ id: selectedMatkul.id_mata_kuliah, nama_matkul: inputNama });
        toast.success('Mata Kuliah Diperbarui', `Informasi ${inputNama} berhasil disimpan.`);
        if (detailMatkul && detailMatkul.id_mata_kuliah === selectedMatkul.id_mata_kuliah) {
          setDetailMatkul({ ...detailMatkul, nama_matkul: inputNama });
        }
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      setValError(err.message || 'Terjadi kesalahan saat menyimpan.');
    }
  };

  const handleDelete = async (matkul: MataKuliah) => {
    if (confirm(`Apakah Anda yakin ingin menghapus Mata Kuliah "${matkul.nama_matkul}"? Seluruh konfigurasi fine-tuning dan laporan terkait akan terpengaruh.`)) {
      try {
        await deleteMutation.mutateAsync(matkul.id_mata_kuliah);
        toast.success('Mata Kuliah Dihapus', 'Mata kuliah praktikum berhasil dihapus.');
        setIsDetailOpen(false);
      } catch (err: any) {
        toast.error('Gagal Menghapus', err.message || 'Gagal menghapus data.');
      }
    }
  };

  // KPIs Operasional Riil (Bebas Metrik AI Slop)
  const stats = useMemo(() => {
    const list = matkulList || [];
    const totalMatkul = list.length;
    
    // Hitung total personel aslab unik yang ditugaskan
    const aslabIds = new Set<string>();
    list.forEach(m => {
      (m.aslab || []).forEach(a => {
        if (a.id_pengguna) aslabIds.add(a.id_pengguna);
      });
    });

    // Hitung total laporan terkumpul dan laporan menunggu verifikasi
    let totalLaporan = 0;
    let totalMenunggu = 0;
    list.forEach(m => {
      if (m.ringkasan_laporan) {
        totalLaporan += m.ringkasan_laporan.total || 0;
        totalMenunggu += m.ringkasan_laporan.menunggu || 0;
      }
    });

    return {
      totalMatkul,
      totalAslab: aslabIds.size,
      totalLaporan,
      totalMenunggu,
    };
  }, [matkulList]);

  const filteredMatkul = useMemo(() => {
    return matkulList?.filter((matkul) =>
      matkul.nama_matkul.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
  }, [matkulList, searchTerm]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 text-slate-900 font-sans animate-fade-in">
      
      {/* 1. Header Halaman */}
      <PageHeader 
        title="Mata Kuliah"
        description="Kelola master data mata kuliah praktikum akademik STITEK Bontang, penugasan aslab, dan repositori naskah."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              title="Segarkan Data"
              aria-label="Segarkan Data Mata Kuliah"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#0D1B2A]' : ''}`} />
            </button>
            <Can I="create" an="Matkul">
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Matkul</span>
              </button>
            </Can>
          </div>
        }
      />

      {/* 2. Kartu Metrik Ringkasan Operasional */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          title="Total Mata Kuliah"
          value={stats.totalMatkul}
          description="Subjek praktikum aktif terdaftar"
          variant="default"
        />

        <StatCard
          title="Asisten Terdaftar"
          value={`${stats.totalAslab} Orang`}
          description="Asisten laboratorium pengampu aktif"
          variant="navy"
        />

        <StatCard
          title="Laporan Praktikum"
          value={`${stats.totalLaporan} Berkas`}
          description={stats.totalMenunggu > 0 ? `${stats.totalMenunggu} berkas antre verifikasi aslab` : 'Seluruh dokumen telah diverifikasi'}
          variant={stats.totalMenunggu > 0 ? 'amber' : 'blue'}
        />
      </div>

      {/* 3. Toolbar Pencarian */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Cari nama mata kuliah..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs w-full pl-9 pr-8 h-9 rounded-md focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Menampilkan <strong className="text-slate-900 font-semibold">{filteredMatkul.length}</strong> dari {matkulList?.length || 0} mata kuliah
        </div>
      </div>

      {/* 4. Tabel Mata Kuliah Informatif */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20">
            <LoadingSpinner variant="fullpage" message="Memuat master data mata kuliah..." />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-rose-700 font-medium space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p>Gagal memuat data Mata Kuliah.</p>
            <button 
              onClick={() => refetch()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md cursor-pointer transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredMatkul.length === 0 ? (
          <div className="py-14">
            <EmptyState 
              icon={BookOpen}
              title="Tidak ada mata kuliah"
              description="Belum ada mata kuliah yang terdaftar atau hasil pencarian tidak ditemukan."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 w-12 text-center">No.</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Mata Kuliah</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Asisten Pengampu</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 text-center">Laporan Terkumpul</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 text-center">Rerata Orisinalitas</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-normal">
                {filteredMatkul.map((matkul, idx) => {
                  const aslabCount = matkul.aslab?.length || 0;
                  const totalLaporan = matkul.ringkasan_laporan?.total || 0;
                  const menungguLaporan = matkul.ringkasan_laporan?.menunggu || 0;
                  const rerata = matkul.ringkasan_laporan?.rerata_orisinalitas;

                  return (
                    <tr 
                      key={matkul.id_mata_kuliah} 
                      onClick={() => handleOpenDetail(matkul)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-500 text-xs">
                        {idx + 1}
                      </td>
                      
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-[#0D1B2A] transition-colors">
                          {matkul.nama_matkul}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {matkul.id_mata_kuliah.slice(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {aslabCount > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/25">
                              <Users className="w-3 h-3 text-[#8C6D1F]" />
                              {aslabCount} Aslab
                            </span>
                            <span className="text-[11px] text-slate-600 truncate max-w-[200px]">
                              {matkul.aslab?.map(a => a.nama).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate('/admin/users')}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 font-medium transition-colors cursor-pointer"
                            title="Tugaskan aslab untuk mata kuliah ini"
                          >
                            <span>+ Alokasikan Aslab</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="font-semibold text-slate-900 font-mono text-xs">
                          {totalLaporan} Berkas
                        </div>
                        {menungguLaporan > 0 ? (
                          <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                            {menungguLaporan} antre verifikasi
                          </div>
                        ) : totalLaporan > 0 ? (
                          <div className="text-[10px] text-[#0D1B2A] font-medium mt-0.5">
                            Semua terverifikasi
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Belum ada laporan
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {totalLaporan > 0 && rerata !== undefined ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                            rerata >= 80 
                              ? 'bg-[#415A77]/10 text-[#0D1B2A] border-[#415A77]/25' 
                              : rerata >= 60 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {rerata}%
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(matkul)}
                            className="h-7 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                            title="Lihat Detail Mata Kuliah"
                          >
                            Detail
                          </button>
                          <Can I="update" an="Matkul">
                            <button
                              onClick={() => handleOpenUpdate(matkul)}
                              className="h-7 w-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                              title="Sunting Mata Kuliah"
                              aria-label="Sunting Mata Kuliah"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </Can>
                          <Can I="delete" an="Matkul">
                            <button
                              onClick={() => handleDelete(matkul)}
                              disabled={deleteMutation.isPending}
                              className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                              title="Hapus Mata Kuliah"
                              aria-label="Hapus Mata Kuliah"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Detail Drawer (macOS System Settings / Clean Minimal Light Mode) */}
      {isDetailOpen && currentMatkul && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Latar Redup */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsDetailOpen(false)}
          />

          <div 
            data-side-drawer="true"
            className="relative w-full max-w-md bg-[#F7F3E9] h-full shadow-2xl border-l border-slate-200/80 z-10 flex flex-col justify-between overflow-hidden animate-slide-in-right"
          >
            {/* Header Side Tab */}
            <div className="p-5 border-b border-slate-200/80 bg-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Mata Kuliah Praktikum
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 mt-1 leading-snug tracking-tight">
                    {currentMatkul.nama_matkul}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyId(currentMatkul.id_mata_kuliah)}
                      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 text-[11px] font-mono text-slate-600 transition-colors cursor-pointer"
                      title="Salin UUID Mata Kuliah"
                    >
                      <span className="text-slate-400 select-none">UUID:</span>
                      <span className="max-w-[170px] truncate">{currentMatkul.id_mata_kuliah}</span>
                      {copiedId ? (
                        <CheckCircle2 className="w-3 h-3 text-[#8C6D1F] shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setIsDetailOpen(false)} 
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                  title="Tutup panel samping"
                  aria-label="Tutup Panel Samping"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bilah Tab Tersegmentasi (Segmented Control) */}
              <div className="mt-4">
                <SegmentedControl
                  options={[
                    { value: 'summary', label: 'Ringkasan', icon: <BookOpen className="w-3.5 h-3.5" /> },
                    { 
                      value: 'reports', 
                      label: 'Laporan', 
                      count: currentMatkul.ringkasan_laporan?.total ?? 0,
                      icon: <FileText className="w-3.5 h-3.5" /> 
                    },
                    { 
                      value: 'aslab', 
                      label: 'Asisten Lab', 
                      count: currentMatkul.aslab?.length ?? 0,
                      icon: <Users className="w-3.5 h-3.5" /> 
                    },
                  ]}
                  value={drawerTab}
                  onChange={setDrawerTab}
                />
              </div>
            </div>

            {/* Isi Konten Tab Berdasarkan Segmented Control */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
              {drawerTab === 'summary' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Single Unified Metric Card - 3 columns, divide-x, zero candy colors */}
                  <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs grid grid-cols-3 divide-x divide-slate-100 p-3.5">
                    <div className="text-center px-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Laporan</span>
                      <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
                        {currentMatkul.ringkasan_laporan?.total ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Terkumpul</span>
                    </div>
                    <div className="text-center px-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Asisten</span>
                      <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
                        {currentMatkul.aslab?.length ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Pengampu</span>
                    </div>
                    <div className="text-center px-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Rata-rata</span>
                      <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
                        {currentMatkul.ringkasan_laporan?.total ? `${currentMatkul.ringkasan_laporan.rerata_orisinalitas}%` : '-'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Orisinalitas</span>
                    </div>
                  </div>

                  {/* Status Verifikasi */}
                  <GroupedList header="Status Verifikasi Laporan">
                    <GroupedItem
                      label="Terverifikasi"
                      description="Naskah telah diverifikasi keasliannya"
                      icon={<span className="w-2 h-2 rounded-full bg-[#D4AF37] block" />}
                      action={
                        <span className="font-mono font-semibold text-slate-900 text-xs">
                          {currentMatkul.ringkasan_laporan?.diverifikasi ?? 0}
                        </span>
                      }
                    />
                    <GroupedItem
                      label="Menunggu Tinjauan"
                      description="Menunggu pemeriksaan asisten laboratorium"
                      icon={<span className="w-2 h-2 rounded-full bg-amber-500 block" />}
                      action={
                        <span className="font-mono font-semibold text-slate-900 text-xs">
                          {currentMatkul.ringkasan_laporan?.menunggu ?? 0}
                        </span>
                      }
                    />
                    {currentMatkul.ringkasan_laporan && currentMatkul.ringkasan_laporan.total > 0 && (
                      <div className="p-3.5 bg-slate-50/50 space-y-1.5">
                        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                          <span>Penyelesaian Verifikasi</span>
                          <span className="font-semibold text-slate-700">
                            {Math.round((currentMatkul.ringkasan_laporan.diverifikasi / currentMatkul.ringkasan_laporan.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-[#D4AF37] h-full transition-all duration-300"
                            style={{ 
                              width: `${(currentMatkul.ringkasan_laporan.diverifikasi / currentMatkul.ringkasan_laporan.total) * 100}%` 
                            }}
                          />
                          <div 
                            className="bg-amber-400 h-full transition-all duration-300"
                            style={{ 
                              width: `${(currentMatkul.ringkasan_laporan.menunggu / currentMatkul.ringkasan_laporan.total) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </GroupedList>

                  {/* Pintasan Terkait */}
                  <GroupedList header="Pintasan Terkait">
                    <GroupedItem
                      interactive
                      onClick={() => {
                        setIsDetailOpen(false);
                        navigate('/admin/repository');
                      }}
                      icon={<FolderArchive className="w-4 h-4 text-slate-500" />}
                      label="Direktori Berkas Lengkap"
                      description="Katalog dan riwayat seluruh naskah praktikum"
                      action={<ArrowRight className="w-4 h-4 text-slate-400" />}
                    />
                    <GroupedItem
                      interactive
                      onClick={() => {
                        setIsDetailOpen(false);
                        navigate('/admin/users');
                      }}
                      icon={<Users className="w-4 h-4 text-slate-500" />}
                      label="Kelola Alokasi Asisten Lab"
                      description="Atur penugasan aslab pengampu pada modul ini"
                      action={<ArrowRight className="w-4 h-4 text-slate-400" />}
                    />
                    <GroupedItem
                      interactive
                      onClick={() => {
                        setIsDetailOpen(false);
                        navigate('/admin/seeding');
                      }}
                      icon={<Database className="w-4 h-4 text-slate-500" />}
                      label="Korpus Cloud Seeding"
                      description="Basis referensi perbandingan orisinalitas AI"
                      action={<ArrowRight className="w-4 h-4 text-slate-400" />}
                    />
                  </GroupedList>
                </div>
              )}

              {drawerTab === 'reports' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Laporan Terkumpul Terbaru
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailOpen(false);
                        navigate('/admin/repository');
                      }}
                      className="text-[11px] text-[#0D1B2A] hover:text-[#0D1B2A] font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Buka Repositori</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {currentMatkul.laporan_terbaru && currentMatkul.laporan_terbaru.length > 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                      {currentMatkul.laporan_terbaru.map((laporan) => {
                        const score = Number(laporan.skor_orisinalitas || 0);
                        const formattedDate = new Date(laporan.tanggal_dibuat).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        });

                        return (
                          <div key={laporan.id_laporan} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 text-xs truncate">
                                  {laporan.nama_mahasiswa || 'Mahasiswa'}
                                </span>
                                {laporan.nim && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    ({laporan.nim})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{formattedDate}</span>
                                <span>•</span>
                                <span className={laporan.apakah_diverifikasi ? 'text-[#0D1B2A] font-medium' : 'text-amber-700 font-medium'}>
                                  {laporan.apakah_diverifikasi ? 'Terverifikasi' : 'Menunggu Review'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={cn(
                                "inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border",
                                score >= 80 
                                  ? 'bg-[#415A77]/10 text-[#0D1B2A] border-[#415A77]/25' 
                                  : score >= 60 
                                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              )}>
                                {score}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-white rounded-lg border border-slate-200/80 text-center space-y-1">
                      <FileText className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-xs font-medium text-slate-700">Belum Ada Dokumen</p>
                      <p className="text-[11px] text-slate-400">Belum ada dokumen laporan praktikum yang terkumpul untuk subjek ini.</p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center mt-2"
                    onClick={() => {
                      setIsDetailOpen(false);
                      navigate('/admin/repository');
                    }}
                  >
                    <span>Buka Seluruh Dokumen di Repositori</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              )}

              {drawerTab === 'aslab' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Asisten Laboratorium Pengampu
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailOpen(false);
                        navigate('/admin/users');
                      }}
                      className="text-[11px] text-[#0D1B2A] hover:text-[#0D1B2A] font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Kelola Penugasan</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {currentMatkul.aslab && currentMatkul.aslab.length > 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                      {currentMatkul.aslab.map((aslab) => {
                        const initials = (aslab.nama || 'A')
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <div 
                            key={aslab.id_profil || aslab.id_pengguna || aslab.email}
                            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 text-xs block truncate">
                                  {aslab.nama}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                  {aslab.kode_aslab && (
                                    <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-700 font-medium">
                                      {aslab.kode_aslab}
                                    </span>
                                  )}
                                  {aslab.nim && (
                                    <span className="font-mono text-slate-500">
                                      NIM: {aslab.nim}
                                    </span>
                                  )}
                                  <span className="truncate text-slate-400 font-mono text-[10px]">{aslab.email}</span>
                                </div>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/25 shrink-0">
                              <UserCheck className="w-3 h-3 text-[#8C6D1F]" />
                              Pengampu
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-white rounded-lg border border-dashed border-slate-300 text-center space-y-1.5">
                      <Users className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-xs font-medium text-slate-800">Belum Ada Aslab Ditugaskan</p>
                      <p className="text-[11px] text-slate-500">Mata kuliah ini belum dialokasikan ke asisten laboratorium.</p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center mt-2"
                    onClick={() => {
                      setIsDetailOpen(false);
                      navigate('/admin/users');
                    }}
                  >
                    <span>Alokasikan Pengampu di Manajemen Pengguna</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Footer Side Tab */}
            <div className="p-4 border-t border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
              <Can I="delete" an="Matkul">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(currentMatkul)}
                  disabled={deleteMutation.isPending}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Hapus</span>
                </Button>
              </Can>

              <Can I="update" an="Matkul">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleOpenUpdate(currentMatkul);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Sunting Matkul</span>
                </Button>
              </Can>
            </div>

          </div>
        </div>
      )}

      {/* 6. Form Modal Dialog (Tambah / Sunting - Portaled) */}
      {isDialogOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDialogOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-white border border-slate-200 relative z-10 shadow-lg rounded-lg overflow-hidden animate-scale-in flex flex-col">
            
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {dialogMode === 'create' ? 'Tambah Mata Kuliah' : 'Sunting Mata Kuliah'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dialogMode === 'create' ? 'Daftarkan subjek praktikum laboratorium baru ke dalam sistem.' : 'Perbarui nama subjek praktikum laboratorium.'}
                </p>
              </div>
              <button 
                onClick={() => setIsDialogOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                title="Tutup dialog"
                aria-label="Tutup Dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col">
              <div className="p-4 sm:p-5 space-y-4 text-xs">
                {valError && (
                  <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{valError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="nama_matkul" className="text-xs font-medium text-slate-700">
                    Nama Mata Kuliah <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    ref={inputNamaRef}
                    id="nama_matkul"
                    type="text"
                    placeholder="Contoh: Desain Pengalaman Pengguna"
                    value={inputNama}
                    onChange={(e) => setInputNama(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs h-9 rounded-md focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Gunakan nama resmi mata kuliah praktikum akademik STITEK Bontang.
                  </p>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-w-[110px] justify-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Matkul</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
