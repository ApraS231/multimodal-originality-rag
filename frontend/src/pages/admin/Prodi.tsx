import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useProdi, useCreateProdi, useUpdateProdi, useDeleteProdi } from '../../api/admin';
import type { ProgramStudi } from '../../api/admin';
import { Can } from '../../components/providers';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  GraduationCap, 
  X, 
  Check, 
  CheckCircle2, 
  Copy, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../../components/ui/toast-provider';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { GroupedList, GroupedItem } from '../../components/ui/grouped-list';

export default function Prodi() {
  const { data: prodiList, isLoading, error, refetch, isFetching } = useProdi();
  const createMutation = useCreateProdi();
  const updateMutation = useUpdateProdi();
  const deleteMutation = useDeleteProdi();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog & Detail states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create');
  const [selectedProdi, setSelectedProdi] = useState<ProgramStudi | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailProdi, setDetailProdi] = useState<ProgramStudi | null>(null);
  const [copiedId, setCopiedId] = useState(false);

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
    setSelectedProdi(null);
    setInputNama('');
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenUpdate = (prodi: ProgramStudi) => {
    setDialogMode('update');
    setSelectedProdi(prodi);
    setInputNama(prodi.nama_prodi);
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenDetail = (prodi: ProgramStudi) => {
    setDetailProdi(prodi);
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
      setValError('Nama Program Studi wajib diisi.');
      return;
    }

    try {
      if (dialogMode === 'create') {
        await createMutation.mutateAsync(inputNama);
        toast.success('Prodi Dibuat', `Program studi ${inputNama} berhasil didaftarkan.`);
      } else if (dialogMode === 'update' && selectedProdi) {
        await updateMutation.mutateAsync({ id: selectedProdi.id_program_studi, nama_prodi: inputNama });
        toast.success('Prodi Diperbarui', `Nama program studi ${inputNama} berhasil disimpan.`);
        if (detailProdi && detailProdi.id_program_studi === selectedProdi.id_program_studi) {
          setDetailProdi({ ...detailProdi, nama_prodi: inputNama });
        }
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      setValError(err.message || 'Terjadi kesalahan saat menyimpan.');
    }
  };

  const handleDelete = async (prodi: ProgramStudi) => {
    if (confirm(`Apakah Anda yakin ingin menghapus Program Studi "${prodi.nama_prodi}"? Seluruh kelas dan relasi terkait akan terpengaruh.`)) {
      try {
        await deleteMutation.mutateAsync(prodi.id_program_studi);
        toast.success('Prodi Dihapus', 'Program studi berhasil dihapus.');
        setIsDetailOpen(false);
      } catch (err: any) {
        toast.error('Gagal Menghapus', err.message || 'Gagal menghapus data.');
      }
    }
  };

  // KPIs
  const stats = useMemo(() => {
    return {
      total: prodiList?.length || 0,
    };
  }, [prodiList]);

  const filteredProdi = useMemo(() => {
    return prodiList?.filter((prodi) =>
      prodi.nama_prodi.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
  }, [prodiList, searchTerm]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 text-slate-900 font-sans animate-fade-in">
      
      {/* 1. Header Halaman */}
      <PageHeader 
        title="Program Studi"
        description="Kelola master data program studi akademik STITEK Bontang dan relasi kurikulum."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              title="Segarkan Data"
              aria-label="Segarkan Data Program Studi"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#0D1B2A]' : ''}`} />
            </button>
            <Can I="create" an="Prodi">
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Prodi</span>
              </button>
            </Can>
          </div>
        }
      />

      {/* 2. Kartu Metrik Ringkasan */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          title="Total Program Studi"
          value={stats.total}
          description="Entitas akademik aktif"
          variant="default"
        />

        <StatCard
          title="Institusi Akademik"
          value="STITEK"
          description="Sekolah Tinggi Teknologi Bontang"
          variant="navy"
        />

        <StatCard
          title="Isolasi Ruang Lingkup"
          value="Terisolasi"
          description="Akses laporan scoped per prodi"
          variant="brass"
        />
      </div>

      {/* 3. Toolbar Pencarian */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Cari nama program studi..."
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
          Menampilkan <strong className="text-slate-900 font-semibold">{filteredProdi.length}</strong> dari {prodiList?.length || 0} program studi
        </div>
      </div>

      {/* 4. Tabel Program Studi */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20">
            <LoadingSpinner variant="fullpage" message="Memuat master data program studi..." />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-rose-700 font-medium space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p>Gagal memuat data Program Studi.</p>
            <button 
              onClick={() => refetch()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md cursor-pointer transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredProdi.length === 0 ? (
          <div className="py-14">
            <EmptyState 
              icon={GraduationCap}
              title="Tidak ada program studi"
              description="Belum ada program studi yang terdaftar atau hasil pencarian tidak ditemukan."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 w-16 text-center">No.</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Nama Program Studi</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Institusi</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Identifier UUID</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-normal">
                {filteredProdi.map((prodi, idx) => (
                  <tr 
                    key={prodi.id_program_studi} 
                    onClick={() => handleOpenDetail(prodi)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-xs">
                      {idx + 1}
                    </td>
                    
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-[#0D1B2A] transition-colors block truncate">
                        {prodi.nama_prodi}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      STITEK Bontang
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {prodi.id_program_studi.slice(0, 16)}...
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(prodi)}
                          className="h-7 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                          title="Lihat Detail Program Studi"
                        >
                          Detail
                        </button>
                        <Can I="update" an="Prodi">
                          <button
                            onClick={() => handleOpenUpdate(prodi)}
                            className="h-7 w-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                            title="Sunting Program Studi"
                            aria-label="Sunting Program Studi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </Can>
                        <Can I="delete" an="Prodi">
                          <button
                            onClick={() => handleDelete(prodi)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                            title="Hapus Program Studi"
                            aria-label="Hapus Program Studi"
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
      {isDetailOpen && detailProdi && (
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
                    Program Studi Akademik
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 mt-1 leading-snug tracking-tight">
                    {detailProdi.nama_prodi}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyId(detailProdi.id_program_studi)}
                      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 text-[11px] font-mono text-slate-600 transition-colors cursor-pointer"
                      title="Salin UUID Program Studi"
                    >
                      <span className="text-slate-400 select-none">UUID:</span>
                      <span className="max-w-[170px] truncate">{detailProdi.id_program_studi}</span>
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
              <GroupedList header="Rincian Entitas">
                <GroupedItem
                  label="Nama Program Studi"
                  description="Unit pengelola kurikulum akademik"
                  action={<span className="font-semibold text-slate-900 text-xs">{detailProdi.nama_prodi}</span>}
                />
                <GroupedItem
                  label="Institusi Pendidikan"
                  description="Kampus penyelenggara praktikum"
                  action={<span className="font-medium text-slate-700 text-xs">STITEK Bontang</span>}
                />
              </GroupedList>

              <GroupedList header="Cakupan Sistem & Isolasi">
                <GroupedItem
                  icon={<CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />}
                  label="Pengelompokan Kelas Praktikum"
                  description="Seluruh kelas bimbingan terasosiasi langsung pada entitas prodi ini."
                />
                <GroupedItem
                  icon={<CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />}
                  label="Isolasi Korpus Dokumen"
                  description="Pencarian kemiripan vektor dibatasi berdasarkan ruang lingkup prodi dan kelas aslab."
                />
              </GroupedList>
            </div>

            {/* Footer Side Tab */}
            <div className="p-4 border-t border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
              <Can I="delete" an="Prodi">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(detailProdi)}
                  disabled={deleteMutation.isPending}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Hapus</span>
                </Button>
              </Can>

              <Can I="update" an="Prodi">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleOpenUpdate(detailProdi);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Sunting Prodi</span>
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
                  {dialogMode === 'create' ? 'Tambah Program Studi' : 'Sunting Program Studi'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dialogMode === 'create' ? 'Daftarkan program studi akademik baru ke dalam sistem.' : 'Perbarui nama program studi akademik.'}
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
                  <Label htmlFor="nama_prodi" className="text-xs font-medium text-slate-700">
                    Nama Program Studi <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    ref={inputNamaRef}
                    id="nama_prodi"
                    type="text"
                    placeholder="Contoh: Teknik Informatika"
                    value={inputNama}
                    onChange={(e) => setInputNama(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs h-9 rounded-md focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Gunakan nama resmi program studi akademik STITEK Bontang.
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
                      <span>Simpan Prodi</span>
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
