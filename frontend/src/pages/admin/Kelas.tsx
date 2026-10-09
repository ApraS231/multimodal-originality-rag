import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useKelas, useCreateKelas, useUpdateKelas, useDeleteKelas, useProdi } from '../../api/admin';
import type { Kelas } from '../../api/admin';
import { Can } from '../../components/providers';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  BookOpen, 
  X, 
  Check, 
  GraduationCap, 
  AlertCircle,
  Copy,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../../components/ui/toast-provider';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { GroupedList, GroupedItem } from '../../components/ui/grouped-list';

export default function KelasPage() {
  const { data: kelasList, isLoading: isLoadingKelas, error: errorKelas, refetch, isFetching } = useKelas();
  const { data: prodiList } = useProdi();
  
  const createMutation = useCreateKelas();
  const updateMutation = useUpdateKelas();
  const deleteMutation = useDeleteKelas();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProdi, setFilterProdi] = useState<string>('ALL');

  // Dialog & Detail States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create');
  const [selectedKelas, setSelectedKelas] = useState<Kelas | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailKelas, setDetailKelas] = useState<Kelas | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Form Fields
  const [inputNama, setInputNama] = useState('');
  const [selectedProdiId, setSelectedProdiId] = useState('');
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

  // Sinkronisasi status drawer dengan maskot
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
    setSelectedKelas(null);
    setInputNama('');
    setSelectedProdiId(prodiList && prodiList.length > 0 ? prodiList[0].id_program_studi : '');
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenUpdate = (kelas: Kelas) => {
    setDialogMode('update');
    setSelectedKelas(kelas);
    setInputNama(kelas.nama_kelas);
    setSelectedProdiId(kelas.id_program_studi);
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenDetail = (kelas: Kelas) => {
    setDetailKelas(kelas);
    setIsDetailOpen(true);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim()) {
      setValError('Nama Kelas wajib diisi.');
      return;
    }
    if (!selectedProdiId) {
      setValError('Program Studi wajib dipilih.');
      return;
    }

    try {
      if (dialogMode === 'create') {
        await createMutation.mutateAsync({
          nama_kelas: inputNama,
          id_program_studi: selectedProdiId,
        });
        toast.success('Kelas Ditambahkan', `Kelas ${inputNama} berhasil dibuat.`);
      } else if (dialogMode === 'update' && selectedKelas) {
        const updated = await updateMutation.mutateAsync({
          id: selectedKelas.id_kelas,
          id_kelas: selectedKelas.id_kelas,
          nama_kelas: inputNama,
          id_program_studi: selectedProdiId,
          payload: {
            nama_kelas: inputNama,
            id_program_studi: selectedProdiId,
          }
        });
        toast.success('Kelas Diperbarui', `Informasi kelas ${inputNama} berhasil disimpan.`);
        if (detailKelas && detailKelas.id_kelas === selectedKelas.id_kelas) {
          const prodiObj = prodiList?.find(p => p.id_program_studi === selectedProdiId);
          setDetailKelas({
            ...detailKelas,
            ...updated,
            nama_kelas: inputNama,
            id_program_studi: selectedProdiId,
            prodi: prodiObj,
          });
        }
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      setValError(err.message || 'Terjadi kesalahan saat menyimpan.');
    }
  };

  const handleDelete = async (kelas: Kelas) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kelas "${kelas.nama_kelas}"? Seluruh laporan praktikum di dalamnya akan terpengaruh.`)) {
      try {
        await deleteMutation.mutateAsync(kelas.id_kelas);
        toast.success('Kelas Dihapus', 'Data kelas praktikum berhasil dihapus.');
        setIsDetailOpen(false);
      } catch (err: any) {
        toast.error('Gagal Menghapus', err.message || 'Gagal menghapus data.');
      }
    }
  };

  // KPIs
  const stats = useMemo(() => {
    if (!kelasList) return { totalKelas: 0, totalProdi: 0 };
    const distinctProdi = new Set(kelasList.map(k => k.id_program_studi));
    return {
      totalKelas: kelasList.length,
      totalProdi: distinctProdi.size,
    };
  }, [kelasList]);

  // Filter
  const filteredKelas = useMemo(() => {
    return kelasList?.filter((kelas) => {
      if (filterProdi !== 'ALL' && kelas.id_program_studi !== filterProdi) return false;
      const q = searchTerm.toLowerCase();
      return (
        kelas.nama_kelas.toLowerCase().includes(q) ||
        (kelas.prodi?.nama_prodi && kelas.prodi.nama_prodi.toLowerCase().includes(q))
      );
    }) || [];
  }, [kelasList, filterProdi, searchTerm]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 text-slate-900 font-sans animate-fade-in">
      
      {/* 1. Header Halaman */}
      <PageHeader 
        title="Kelas Praktikum"
        description="Kelola data kelas praktikum mahasiswa STITEK Bontang dan relasi program studi akademik."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              title="Segarkan Data"
              aria-label="Segarkan Data Kelas"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#0D1B2A]' : ''}`} />
            </button>
            <Can I="create" an="Kelas">
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kelas</span>
              </button>
            </Can>
          </div>
        }
      />

      {/* 2. Kartu Metrik Ringkasan */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          title="Total Kelas Praktikum"
          value={stats.totalKelas}
          description="Rombongan belajar aktif"
          variant="default"
        />

        <StatCard
          title="Program Studi Terhubung"
          value={stats.totalProdi}
          description="Jurusan penyelenggara"
          variant="amber"
        />

        <StatCard
          title="Ruang Lingkup Aslab"
          value="Terkonfigurasi"
          description="Alokasi hak akses terlindungi"
          variant="brass"
        />
      </div>

      {/* 3. Toolbar Pencarian & Filter */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Cari kelas praktikum..."
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

        {/* Filter Prodi Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={filterProdi}
            onChange={(e) => setFilterProdi(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Program Studi</option>
            {prodiList?.map(p => (
              <option key={p.id_program_studi} value={p.id_program_studi}>
                {p.nama_prodi}
              </option>
            ))}
          </select>

          <div className="text-xs text-slate-500 hidden md:block whitespace-nowrap">
            Menampilkan <strong className="text-slate-900 font-semibold">{filteredKelas.length}</strong> kelas
          </div>
        </div>
      </div>

      {/* 4. Tabel Kelas Praktikum */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {isLoadingKelas ? (
          <div className="py-20">
            <LoadingSpinner variant="fullpage" message="Memuat master data kelas..." />
          </div>
        ) : errorKelas ? (
          <div className="text-center py-16 text-rose-700 font-medium space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p>Gagal memuat data Kelas Praktikum.</p>
            <button 
              onClick={() => refetch()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md cursor-pointer transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredKelas.length === 0 ? (
          <div className="py-14">
            <EmptyState 
              icon={BookOpen}
              title="Tidak ada kelas praktikum"
              description="Belum ada kelas yang terdaftar atau hasil pencarian tidak ditemukan."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 w-16 text-center">No.</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Nama Kelas</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Program Studi</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Identifier UUID</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-normal">
                {filteredKelas.map((kelas, idx) => (
                  <tr 
                    key={kelas.id_kelas} 
                    onClick={() => handleOpenDetail(kelas)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-xs">
                      {idx + 1}
                    </td>
                    
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-[#0D1B2A] transition-colors block truncate">
                        {kelas.nama_kelas}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                        <span>{kelas.prodi?.nama_prodi || 'Belum Terhubung'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {kelas.id_kelas.slice(0, 16)}...
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(kelas)}
                          className="h-7 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                          title="Lihat Detail Kelas"
                        >
                          Detail
                        </button>
                        <Can I="update" an="Kelas">
                          <button
                            onClick={() => handleOpenUpdate(kelas)}
                            className="h-7 w-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                            title="Sunting Kelas"
                            aria-label="Sunting Kelas"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </Can>
                        <Can I="delete" an="Kelas">
                          <button
                            onClick={() => handleDelete(kelas)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                            title="Hapus Kelas"
                            aria-label="Hapus Kelas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Detail Drawer (Side Tab) */}
      {isDetailOpen && detailKelas && (
        <div className="fixed inset-0 z-[60] flex justify-end">
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
                    Kelas Praktikum
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 mt-1 leading-snug tracking-tight">
                    {detailKelas.nama_kelas}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyId(detailKelas.id_kelas)}
                      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 text-[11px] font-mono text-slate-600 transition-colors cursor-pointer"
                      title="Salin UUID Kelas"
                    >
                      <span className="text-slate-400 select-none">UUID:</span>
                      <span className="max-w-[170px] truncate">{detailKelas.id_kelas}</span>
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
            </div>

            {/* Isi Side Tab */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
              <GroupedList header="Informasi Kelas">
                <GroupedItem
                  label="Nama Kelas"
                  description="Kelompok rombongan belajar praktikum"
                  action={<span className="font-semibold text-slate-900 text-xs">{detailKelas.nama_kelas}</span>}
                />
                <GroupedItem
                  label="Program Studi"
                  description="Jurusan akademik penaung kelas"
                  action={
                    <span className="font-mono text-xs text-slate-700 font-medium">
                      {detailKelas.prodi?.nama_prodi || 'Tidak Terhubung'}
                    </span>
                  }
                />
              </GroupedList>

              <GroupedList header="Alokasi Bimbingan & Validasi">
                <GroupedItem
                  icon={<CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />}
                  label="Penugasan Asisten Laboratorium"
                  description="Dapat dialokasikan kepada aslab untuk batasan verifikasi naskah praktikan."
                />
                <GroupedItem
                  icon={<CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />}
                  label="Filter Pengunggahan Laporan"
                  description="Katalog laporan dan cloud seeding dikelompokkan secara ketat per kelas."
                />
              </GroupedList>
            </div>

            {/* Footer Side Tab */}
            <div className="p-4 border-t border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
              <Can I="delete" an="Kelas">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(detailKelas)}
                  disabled={deleteMutation.isPending}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Hapus</span>
                </Button>
              </Can>

              <Can I="update" an="Kelas">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleOpenUpdate(detailKelas);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Sunting Kelas</span>
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
                  {dialogMode === 'create' ? 'Tambah Kelas Praktikum' : 'Sunting Kelas Praktikum'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dialogMode === 'create' ? 'Daftarkan kelas praktikum baru ke dalam sistem.' : 'Perbarui nama kelas atau program studi terkait.'}
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
                  <Label htmlFor="nama_kelas" className="text-xs font-medium text-slate-700">
                    Nama Kelas Praktikum <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    ref={inputNamaRef}
                    id="nama_kelas"
                    type="text"
                    placeholder="Contoh: Malam_2023 atau Pagi_2024"
                    value={inputNama}
                    onChange={(e) => setInputNama(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs h-9 rounded-md focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prodi_select" className="text-xs font-medium text-slate-700">
                    Program Studi Terkait <span className="text-rose-600">*</span>
                  </Label>
                  <select
                    id="prodi_select"
                    value={selectedProdiId}
                    onChange={(e) => setSelectedProdiId(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 text-slate-900 rounded-md text-xs focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>Pilih Program Studi</option>
                    {prodiList?.map(p => (
                      <option key={p.id_program_studi} value={p.id_program_studi}>
                        {p.nama_prodi}
                      </option>
                    ))}
                  </select>
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
                      <span>Simpan Kelas</span>
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
