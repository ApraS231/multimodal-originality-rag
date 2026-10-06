import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Shield, 
  UserCheck, 
  X, 
  Check, 
  Eye, 
  EyeOff, 
  GraduationCap, 
  Award, 
  AlertCircle, 
  Copy, 
  CheckCircle2, 
  RefreshCw,
  BookOpen
} from 'lucide-react';
import PageHeader from '../../components/ui/page-header';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import { useToast } from '../../components/ui/toast-provider';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { StatCard } from '../../components/ui/card';
import { useKelas, useMatkul, useUpdateUserAssignments } from '../../api/admin';

// ============================================================================
// Tipe Data Antarmuka
// ============================================================================

interface KelasAslabRelation {
  id_kelas_aslab: string;
  id_kelas: string;
  kelas?: {
    id_kelas: string;
    nama_kelas: string;
  };
}

interface MatkulAslabRelation {
  id_matkul_aslab: string;
  id_mata_kuliah: string;
  matkul?: {
    id_mata_kuliah: string;
    nama_matkul: string;
  };
}

interface UserProfile {
  id_profil: string;
  peran: 'ADMIN' | 'ASLAB' | 'KEPALA_LAB';
  nim: string | null;
  kode_aslab: string | null;
  kode_kalab: string | null;
  status_persetujuan?: 'PENDING' | 'APPROVED' | 'REJECTED';
  kelas_aslab?: KelasAslabRelation[];
  matkul_aslab?: MatkulAslabRelation[];
}

interface User {
  id: string;
  email: string;
  nama: string;
  tanggal_dibuat: string;
  profil: UserProfile | null;
}

// ============================================================================
// Komponen Bantu: Lencana Peran & Status (Kepatuhan Penuh antislop-ui)
// ============================================================================

function RoleBadge({ role }: { role?: string }) {
  switch (role) {
    case 'ADMIN':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
          <Shield className="w-3.5 h-3.5 text-slate-700" />
          <span>Administrator</span>
        </span>
      );
    case 'KEPALA_LAB':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
          <Award className="w-3.5 h-3.5 text-amber-700" />
          <span>Kepala Lab</span>
        </span>
      );
    case 'ASLAB':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/25">
          <GraduationCap className="w-3.5 h-3.5 text-[#0D1B2A]" />
          <span>Asisten Lab</span>
        </span>
      );
  }
}

function StatusIndicator({ status }: { status?: string }) {
  switch (status) {
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D1B2A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0" />
          <span>Aktif</span>
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
          <span>Menunggu</span>
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-800">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
          <span>Ditolak</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
          <span>Terdaftar</span>
        </span>
      );
  }
}

// ============================================================================
// Komponen Utama: Users
// ============================================================================

export default function Users() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Master Data Kelas & Mata Kuliah
  const { data: masterKelas } = useKelas();
  const { data: masterMatkul } = useMatkul();
  const updateAssignmentsMutation = useUpdateUserAssignments();

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [filterRole, setFilterRole] = useState<'ALL' | 'ADMIN' | 'ASLAB' | 'KEPALA_LAB'>('ALL');

  // Modal Dialog Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Modal Penugasan State
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentTargetUser, setAssignmentTargetUser] = useState<User | null>(null);
  const [assignmentSelectedKelas, setAssignmentSelectedKelas] = useState<string[]>([]);
  const [assignmentSelectedMatkul, setAssignmentSelectedMatkul] = useState<string[]>([]);

  // Drawer Detail State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState(false);

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

  // Form Fields
  const [inputNama, setInputNama] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inputPeran, setInputPeran] = useState<'ADMIN' | 'ASLAB' | 'KEPALA_LAB'>('ASLAB');
  const [inputNim, setInputNim] = useState('');
  const [inputKodeAslab, setInputKodeAslab] = useState('');
  const [inputKodeKalab, setInputKodeKalab] = useState('');
  const [valError, setValError] = useState('');

  // 1. Kueri Pengambilan Data Pengguna
  const { data: usersList, isLoading, isFetching, error, refetch } = useQuery<User[]>({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/users`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat daftar pengguna.');
      return res.json();
    },
  });

  // 2. Mutasi Penambahan Pengguna
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${backendUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pengguna baru.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Pengguna Baru Dibuat', `Akun untuk ${inputNama} berhasil dibuat.`);
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      setValError(err.message);
    },
  });

  // 3. Mutasi Pembaruan Pengguna
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`${backendUrl}/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui data pengguna.');
      return data;
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Pengguna Diperbarui', `Informasi akun ${inputNama} berhasil diperbarui.`);
      setIsDialogOpen(false);
      if (detailUser && detailUser.id === updatedData.id) {
        setDetailUser(updatedData);
      }
    },
    onError: (err: any) => {
      setValError(err.message);
    },
  });

  // 4. Mutasi Penghapusan Pengguna
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${backendUrl}/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengguna.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Pengguna Dihapus', 'Akun pengguna berhasil dihapus dari sistem.');
      setIsDetailOpen(false);
    },
    onError: (err: any) => {
      toast.error('Gagal Menghapus', err.message);
    },
  });

  // 5. Mutasi Persetujuan Akun
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${backendUrl}/api/admin/users/${id}/approve`, {
        method: 'PUT',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui pengguna.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Pengguna Disetujui', 'Calon asisten laboratorium telah diaktifkan.');
      if (detailUser) {
        setDetailUser({
          ...detailUser,
          profil: detailUser.profil ? { ...detailUser.profil, status_persetujuan: 'APPROVED' } : null
        });
      }
    },
    onError: (err: any) => {
      toast.error('Gagal Menyetujui', err.message);
    },
  });

  // 6. Mutasi Penolakan Akun
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${backendUrl}/api/admin/users/${id}/reject`, {
        method: 'PUT',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menolak pengguna.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Pengguna Ditolak', 'Permohonan akun pengguna telah ditolak.');
      if (detailUser) {
        setDetailUser({
          ...detailUser,
          profil: detailUser.profil ? { ...detailUser.profil, status_persetujuan: 'REJECTED' } : null
        });
      }
    },
    onError: (err: any) => {
      toast.error('Gagal Menolak', err.message);
    },
  });

  // Dialog Handlers
  const handleOpenCreate = () => {
    setDialogMode('create');
    setSelectedUser(null);
    setInputNama('');
    setInputEmail('');
    setInputPassword('');
    setShowPassword(false);
    setInputPeran('ASLAB');
    setInputNim('');
    setInputKodeAslab('');
    setInputKodeKalab('');
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenUpdate = (user: User) => {
    setDialogMode('update');
    setSelectedUser(user);
    setInputNama(user.nama);
    setInputEmail(user.email);
    setInputPassword('');
    setShowPassword(false);
    setInputPeran(user.profil?.peran || 'ASLAB');
    setInputNim(user.profil?.nim || '');
    setInputKodeAslab(user.profil?.kode_aslab || '');
    setInputKodeKalab(user.profil?.kode_kalab || '');
    setValError('');
    setIsDialogOpen(true);
  };

  const handleOpenDetail = (user: User) => {
    setDetailUser(user);
    setIsDetailOpen(true);
  };

  const handleOpenAssignment = (user: User) => {
    setAssignmentTargetUser(user);
    const initialKelas = user.profil?.kelas_aslab?.map(k => k.id_kelas) || [];
    const initialMatkul = user.profil?.matkul_aslab?.map(m => m.id_mata_kuliah) || [];
    setAssignmentSelectedKelas(initialKelas);
    setAssignmentSelectedMatkul(initialMatkul);
    setIsAssignmentModalOpen(true);
  };

  const handleToggleAssignmentKelas = (idKelas: string) => {
    setAssignmentSelectedKelas(prev => 
      prev.includes(idKelas) ? prev.filter(id => id !== idKelas) : [...prev, idKelas]
    );
  };

  const handleToggleAssignmentMatkul = (idMatkul: string) => {
    setAssignmentSelectedMatkul(prev => 
      prev.includes(idMatkul) ? prev.filter(id => id !== idMatkul) : [...prev, idMatkul]
    );
  };

  const handleSaveAssignment = async () => {
    if (!assignmentTargetUser) return;
    try {
      await updateAssignmentsMutation.mutateAsync({
        userId: assignmentTargetUser.id,
        kelasIds: assignmentSelectedKelas,
        matkulIds: assignmentSelectedMatkul,
      });
      toast.success('Penugasan Diperbarui', `Penugasan untuk ${assignmentTargetUser.nama} berhasil disimpan.`);
      setIsAssignmentModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error('Gagal Menyimpan Penugasan', err.message);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValError('');

    if (!inputNama.trim() || !inputEmail.trim()) {
      setValError('Nama lengkap dan alamat surel wajib diisi.');
      return;
    }

    if (dialogMode === 'create' && !inputPassword) {
      setValError('Kata sandi awal wajib diisi untuk pengguna baru.');
      return;
    }

    const payload: any = {
      nama: inputNama.trim(),
      email: inputEmail.trim(),
      peran: inputPeran,
      nim: inputPeran === 'ASLAB' ? inputNim.trim() || null : null,
      kode_aslab: inputPeran === 'ASLAB' ? inputKodeAslab.trim() || null : null,
      kode_kalab: inputPeran === 'KEPALA_LAB' ? inputKodeKalab.trim() || null : null,
    };

    if (inputPassword.trim()) {
      payload.kata_sandi = inputPassword.trim();
    }

    if (dialogMode === 'create') {
      createMutation.mutate(payload);
    } else if (dialogMode === 'update' && selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, payload });
    }
  };

  const handleDelete = (user: User) => {
    if (window.confirm(`Hapus akun "${user.nama}" secara permanen? Seluruh data verifikasi naskah miliknya akan terpengaruh.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  // Ringkasan Statistik
  const stats = useMemo(() => {
    if (!usersList) return { total: 0, aslab: 0, pending: 0, adminStaff: 0 };
    return {
      total: usersList.length,
      aslab: usersList.filter(u => u.profil?.peran === 'ASLAB' && u.profil?.status_persetujuan === 'APPROVED').length,
      pending: usersList.filter(u => u.profil?.status_persetujuan === 'PENDING').length,
      adminStaff: usersList.filter(u => u.profil?.peran === 'ADMIN' || u.profil?.peran === 'KEPALA_LAB').length,
    };
  }, [usersList]);

  // Penyaringan Data Pengguna
  const filteredUsers = useMemo(() => {
    return usersList?.filter(u => {
      if (filterStatus === 'APPROVED' && u.profil?.status_persetujuan !== 'APPROVED') return false;
      if (filterStatus === 'PENDING' && u.profil?.status_persetujuan !== 'PENDING') return false;
      if (filterStatus === 'REJECTED' && u.profil?.status_persetujuan !== 'REJECTED') return false;

      if (filterRole !== 'ALL' && u.profil?.peran !== filterRole) return false;

      const q = searchTerm.toLowerCase();
      return (
        u.nama.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.profil?.nim && u.profil.nim.includes(q)) ||
        (u.profil?.kode_aslab && u.profil.kode_aslab.toLowerCase().includes(q)) ||
        (u.profil?.kode_kalab && u.profil.kode_kalab.toLowerCase().includes(q))
      );
    }) || [];
  }, [usersList, filterStatus, filterRole, searchTerm]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-900 font-sans animate-fade-in">
      
      {/* 1. Header Halaman */}
      <PageHeader 
        title="Manajemen Pengguna" 
        description="Kelola akun pengguna, wewenang akses akademik, dan penugasan kelas praktikum."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
              title="Segarkan Data"
              aria-label="Segarkan Data Pengguna"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#0D1B2A]' : ''}`} />
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pengguna</span>
            </button>
          </div>
        }
      />

      {/* 2. Kartu Metrik Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pengguna"
          value={stats.total}
          description="Semua akun terdaftar"
          variant="default"
        />

        <StatCard
          title="Aslab Aktif"
          value={stats.aslab}
          description="Wewenang verifikasi laporan"
          variant="brass"
        />

        <StatCard
          title="Antrean Persetujuan"
          value={stats.pending}
          description={stats.pending > 0 ? "Memerlukan konfirmasi" : "Tidak ada permohonan"}
          variant="amber"
          badge={stats.pending > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
              {stats.pending} MENUNGGU
            </span>
          ) : undefined}
        />

        <StatCard
          title="Staf Pengelola"
          value={stats.adminStaff}
          description="Admin & Kepala Lab"
          variant="navy"
        />
      </div>

      {/* 3. Toolbar Pencarian & Filter */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          
          {/* Input Pencarian */}
          <div className="relative w-full lg:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input 
              type="text" 
              placeholder="Cari nama, surel, atau NIM..."
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

          {/* Pengelompokan Filter Segmented */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Filter Peran */}
            <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              {(['ALL', 'ASLAB', 'KEPALA_LAB', 'ADMIN'] as const).map((r) => {
                const label = r === 'ALL' ? 'Semua' : r === 'ASLAB' ? 'Aslab' : r === 'KEPALA_LAB' ? 'Kepala Lab' : 'Admin';
                const isActive = filterRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setFilterRole(r)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Filter Status */}
            <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              {(['ALL', 'APPROVED', 'PENDING'] as const).map((s) => {
                const label = s === 'ALL' ? 'Semua Status' : s === 'APPROVED' ? 'Aktif' : 'Menunggu';
                const isActive = filterStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{label}</span>
                    {s === 'PENDING' && stats.pending > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-600 text-white text-[10px] rounded-full font-mono font-bold">
                        {stats.pending}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {(filterRole !== 'ALL' || filterStatus !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setFilterRole('ALL');
                  setFilterStatus('ALL');
                  setSearchTerm('');
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer px-1"
              >
                Reset
              </button>
            )}

          </div>
        </div>

        {/* Informasi Jumlah Akun */}
        <div className="text-[11px] text-slate-500 pt-1">
          Menampilkan <strong className="text-slate-900 font-semibold">{filteredUsers.length}</strong> dari {usersList?.length || 0} akun pengguna
        </div>
      </div>

      {/* 4. Tabel Manajemen Pengguna */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20">
            <LoadingSpinner variant="fullpage" message="Menyiapkan data pengguna..." />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-rose-700 font-medium space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p>Gagal memuat daftar pengguna sistem.</p>
            <button 
              onClick={() => refetch()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md cursor-pointer transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-14">
            <EmptyState 
              icon={UserCheck}
              title="Tidak ada pengguna ditemukan"
              description="Tidak ditemukan akun yang sesuai dengan kriteria pencarian atau filter aktif."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Pengguna</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Peran</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Atribut & Penugasan</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Terdaftar</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900">Status</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-slate-900 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-normal">
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    onClick={() => handleOpenDetail(user)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Kolom 1: Pengguna (Nama & Email Terpadu) */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-[#0D1B2A] transition-colors truncate">
                          {user.nama}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                          {user.email}
                        </span>
                      </div>
                    </td>

                    {/* Kolom 2: Peran */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <RoleBadge role={user.profil?.peran} />
                    </td>

                    {/* Kolom 3: Atribut & Penugasan */}
                    <td className="py-3 px-4">
                      {user.profil?.peran === 'ASLAB' && (
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                            {user.profil.nim && <span>NIM: {user.profil.nim}</span>}
                            {user.profil.nim && user.profil.kode_aslab && <span className="text-slate-300">•</span>}
                            {user.profil.kode_aslab && <span>{user.profil.kode_aslab}</span>}
                          </div>
                          <div>
                            {user.profil.kelas_aslab && user.profil.kelas_aslab.length > 0 ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/25"
                                title={`${user.profil.kelas_aslab.length} Kelas dan ${user.profil.matkul_aslab?.length || 0} Mata Kuliah`}
                              >
                                {user.profil.kelas_aslab.length} Kelas • {user.profil.matkul_aslab?.length || 0} Matkul
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Belum ada penugasan
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {user.profil?.peran === 'KEPALA_LAB' && (
                        <span className="font-mono text-xs text-slate-700">
                          {user.profil.kode_kalab ? `Kode: ${user.profil.kode_kalab}` : 'Supervisi Laboratorium'}
                        </span>
                      )}
                      {user.profil?.peran === 'ADMIN' && (
                        <span className="text-xs text-slate-500">
                          Akses Sistem Penuh
                        </span>
                      )}
                    </td>

                    {/* Kolom 4: Tanggal Terdaftar */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                      {new Date(user.tanggal_dibuat).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>

                    {/* Kolom 5: Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusIndicator status={user.profil?.status_persetujuan} />
                    </td>

                    {/* Kolom 6: Aksi */}
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {user.profil?.status_persetujuan === 'PENDING' && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate(user.id)}
                              disabled={approveMutation.isPending}
                              className="h-7 px-2.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                              title="Setujui Akun"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate(user.id)}
                              disabled={rejectMutation.isPending}
                              className="h-7 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                              title="Tolak Akun"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                        {user.profil?.peran === 'ASLAB' && (
                          <button
                            onClick={() => handleOpenAssignment(user)}
                            className="h-7 px-2.5 bg-[#415A77]/10 hover:bg-[#415A77]/15 text-[#0D1B2A] border border-[#415A77]/25 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                            title="Atur Penugasan Kelas & Mata Kuliah"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-[#0D1B2A]" />
                            <span>Penugasan</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetail(user)}
                          className="h-7 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                          title="Lihat Detail Akun"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => handleOpenUpdate(user)}
                          className="h-7 w-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                          title="Sunting Akun"
                          aria-label="Sunting Akun"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={deleteMutation.isPending}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                          title="Hapus Akun"
                          aria-label="Hapus Akun"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Detail Drawer Sheet */}
      {isDetailOpen && detailUser && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsDetailOpen(false)}
          />

          <div 
            data-side-drawer="true"
            className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 z-10 flex flex-col justify-between overflow-hidden animate-slide-in-right"
          >
            
            {/* Header Drawer */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {detailUser.nama.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {detailUser.nama}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <RoleBadge role={detailUser.profil?.peran} />
                    <StatusIndicator status={detailUser.profil?.status_persetujuan} />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Tutup"
                aria-label="Tutup Laci Detail"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Isi Drawer */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">
              
              {/* Seksi 1: Identitas Akun */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-900 block">
                  Identitas Akun
                </span>
                
                <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">ID Akun</span>
                    <div className="flex items-center gap-1 font-mono text-xs text-slate-900">
                      <span>{detailUser.id.slice(0, 13)}...</span>
                      <button 
                        onClick={() => handleCopyId(detailUser.id)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer transition-colors"
                        title="Salin ID"
                      >
                        {copiedId ? <CheckCircle2 className="w-3.5 h-3.5 text-[#8C6D1F]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Surel</span>
                    <span className="font-mono text-xs text-slate-900">{detailUser.email}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Tanggal Daftar</span>
                    <span className="font-mono text-xs text-slate-900">
                      {new Date(detailUser.tanggal_dibuat).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seksi 2: Atribut Akademik */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-900 block">
                  Atribut Akademik
                </span>

                <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Peran</span>
                    <span className="font-semibold text-slate-900">{detailUser.profil?.peran || 'Pengguna'}</span>
                  </div>

                  {detailUser.profil?.nim && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">NIM</span>
                      <span className="font-mono font-semibold text-slate-900">{detailUser.profil.nim}</span>
                    </div>
                  )}

                  {detailUser.profil?.kode_aslab && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Kode Aslab</span>
                      <span className="font-mono font-semibold text-slate-900">{detailUser.profil.kode_aslab}</span>
                    </div>
                  )}

                  {detailUser.profil?.kode_kalab && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Kode Kalab</span>
                      <span className="font-mono font-semibold text-amber-900">{detailUser.profil.kode_kalab}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Status Otorisasi</span>
                    <StatusIndicator status={detailUser.profil?.status_persetujuan} />
                  </div>
                </div>
              </div>

              {/* Seksi 3: Penugasan Bimbingan Aslab */}
              {detailUser.profil?.peran === 'ASLAB' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 block">
                      Penugasan Praktikum
                    </span>
                    <button
                      onClick={() => handleOpenAssignment(detailUser)}
                      className="text-xs font-medium text-[#0D1B2A] hover:text-[#0D1B2A] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Atur Penugasan</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-3">
                    {/* Kelas */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-slate-700 block">Kelas yang Diampu:</span>
                      {detailUser.profil?.kelas_aslab && detailUser.profil.kelas_aslab.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {detailUser.profil.kelas_aslab.map((k) => (
                            <span
                              key={k.id_kelas_aslab}
                              className="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 text-xs font-medium"
                            >
                              {k.kelas?.nama_kelas || k.id_kelas}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Belum ada kelas yang ditetapkan.</p>
                      )}
                    </div>

                    {/* Matkul */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200">
                      <span className="text-xs font-medium text-slate-700 block">Mata Kuliah:</span>
                      {detailUser.profil?.matkul_aslab && detailUser.profil.matkul_aslab.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {detailUser.profil.matkul_aslab.map((m) => (
                            <span
                              key={m.id_matkul_aslab}
                              className="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 text-xs font-medium"
                            >
                              {m.matkul?.nama_matkul || m.id_mata_kuliah}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Belum ada mata kuliah yang ditetapkan.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Seksi 4: Wewenang Sistem */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-900 block">
                  Hak Akses Sistem
                </span>

                <div className="bg-white p-3.5 rounded-md border border-slate-200 space-y-2 text-slate-600 text-xs">
                  {detailUser.profil?.peran === 'ADMIN' && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Akses penuh konfigurasi sistem, penugasan, dan database</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Manajemen antrean analisis berkas dan parameter model AI</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Audit log aktivitas dan pemantauan token sistem</span>
                      </div>
                    </>
                  )}

                  {detailUser.profil?.peran === 'ASLAB' && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Verifikasi orisinalitas laporan praktikum kelas binaan</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Inspeksi penyorotan koordinat spasial teks dan gambar PDF</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Pengunggahan laporan praktikan tunggal dan batch cloud</span>
                      </div>
                    </>
                  )}

                  {detailUser.profil?.peran === 'KEPALA_LAB' && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Persetujuan akhir skor orisinalitas dan audit asisten</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Evaluasi matriks confusion matrix model deteksi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                        <span>Pengawasan tren orisinalitas lintas program studi</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Drawer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2.5">
              {detailUser.profil?.status_persetujuan === 'PENDING' ? (
                <div className="flex items-center gap-2 w-full">
                  <button
                    onClick={() => approveMutation.mutate(detailUser.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white rounded-md font-medium text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Setujui Akun</span>
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(detailUser.id)}
                    disabled={rejectMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    <span>Tolak</span>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenUpdate(detailUser);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sunting Akun</span>
                  </button>
                  <button
                    onClick={() => handleDelete(detailUser)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md cursor-pointer transition-colors"
                    title="Hapus Akun"
                    aria-label="Hapus Akun Pengguna"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 6. Form Dialog Modal (Create / Edit Form) */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-lg bg-white border border-slate-200 shadow-md relative overflow-hidden animate-scale-in max-h-[92vh] flex flex-col rounded-lg">
            
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {dialogMode === 'create' ? 'Tambah Pengguna Baru' : 'Sunting Data Pengguna'}
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Lengkapi identitas, peran, dan kredensial akun pengguna.
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

            {/* Formulir */}
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-xs">
                {valError && (
                  <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{valError}</span>
                  </div>
                )}

                {/* Pemilihan Peran (Segmented Control) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">
                    Peran Wewenang Sistem <span className="text-rose-600">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-md border border-slate-200">
                    {(['ASLAB', 'KEPALA_LAB', 'ADMIN'] as const).map((r) => {
                      const label = r === 'ASLAB' ? 'Asisten Lab' : r === 'KEPALA_LAB' ? 'Kepala Lab' : 'Admin';
                      const isSelected = inputPeran === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInputPeran(r)}
                          className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nama Lengkap */}
                <div className="space-y-1.5">
                  <Label htmlFor="nama" className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    Nama Lengkap <span className="text-rose-600">*</span>
                  </Label>
                  <Input 
                    id="nama"
                    value={inputNama}
                    onChange={(e) => setInputNama(e.target.value)}
                    placeholder="Contoh: Alvin Pratama"
                    className="bg-white border-slate-300 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 text-slate-900 text-xs h-9 rounded-md"
                    required
                  />
                </div>

                {/* Alamat Surel */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    Alamat Surel Kampus <span className="text-rose-600">*</span>
                  </Label>
                  <Input 
                    id="email"
                    type="email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="alvin@stitek.ac.id"
                    className="bg-white border-slate-300 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 text-slate-900 text-xs h-9 rounded-md font-mono"
                    required
                  />
                </div>

                {/* Atribut Khusus Sesuai Peran */}
                {inputPeran === 'ASLAB' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="nim" className="text-xs font-medium text-slate-700">
                        NIM Mahasiswa
                      </Label>
                      <Input 
                        id="nim"
                        value={inputNim}
                        onChange={(e) => setInputNim(e.target.value)}
                        placeholder="Contoh: 2201001"
                        className="bg-white border-slate-300 text-slate-900 text-xs h-9 rounded-md font-mono focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="kodeAslab" className="text-xs font-medium text-slate-700">
                        Kode Asisten
                      </Label>
                      <Input 
                        id="kodeAslab"
                        value={inputKodeAslab}
                        onChange={(e) => setInputKodeAslab(e.target.value)}
                        placeholder="Contoh: ASLAB-001"
                        className="bg-white border-slate-300 text-slate-900 text-xs h-9 rounded-md font-mono focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                )}

                {inputPeran === 'KEPALA_LAB' && (
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="kodeKalab" className="text-xs font-medium text-slate-700">
                      Kode Kepala Lab
                    </Label>
                    <Input 
                      id="kodeKalab"
                      value={inputKodeKalab}
                      onChange={(e) => setInputKodeKalab(e.target.value)}
                      placeholder="Contoh: KALAB-001"
                      className="bg-white border-slate-300 text-slate-900 text-xs h-9 rounded-md font-mono focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                    />
                  </div>
                )}

                {/* Kredensial Kata Sandi */}
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    {dialogMode === 'create' ? 'Kata Sandi Awal' : 'Ubah Kata Sandi (Opsional)'}
                    {dialogMode === 'create' && <span className="text-rose-600">*</span>}
                  </Label>
                  <div className="relative">
                    <Input 
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      placeholder={dialogMode === 'create' ? 'Minimal 8 karakter' : 'Biarkan kosong jika tidak diubah'}
                      className="pr-10 bg-white border-slate-300 text-slate-900 text-xs h-9 rounded-md font-mono focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      required={dialogMode === 'create'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {dialogMode === 'create' 
                      ? 'Minimal 8 karakter. Pengguna dapat mengubah kata sandi mandiri di profil.' 
                      : 'Biarkan kosong untuk mempertahankan kata sandi aktif.'}
                  </p>
                </div>

              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
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
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-w-[120px]"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{dialogMode === 'create' ? 'Simpan Pengguna' : 'Perbarui Akun'}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7. Modal Dialog Kelola Penugasan Asisten Laboratorium */}
      {isAssignmentModalOpen && assignmentTargetUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-xl bg-white border border-slate-200 shadow-md relative overflow-hidden animate-scale-in max-h-[92vh] flex flex-col rounded-lg">
            
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Penugasan Asisten Laboratorium
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan kelas bimbingan dan mata kuliah praktikum resmi yang dikelola asisten ini.
                </p>
              </div>
              <button
                onClick={() => setIsAssignmentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                title="Tutup dialog"
                aria-label="Tutup Dialog Penugasan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pita Informasi Asisten */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-slate-900">{assignmentTargetUser.nama}</span>
                <span className="text-slate-400">•</span>
                <span className="font-mono text-slate-500">{assignmentTargetUser.email}</span>
              </div>
              {assignmentTargetUser.profil?.kode_aslab && (
                <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs shrink-0 ml-2">
                  {assignmentTargetUser.profil.kode_aslab}
                </span>
              )}
            </div>

            {/* Isi Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs custom-scrollbar">
              
              {/* Seksi 1: Kelas Bimbingan */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs">
                    Kelas Bimbingan ({assignmentSelectedKelas.length} dipilih)
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setAssignmentSelectedKelas(masterKelas?.map(k => k.id_kelas) || [])}
                      className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setAssignmentSelectedKelas([])}
                      className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {masterKelas?.map((kelas) => {
                    const isChecked = assignmentSelectedKelas.includes(kelas.id_kelas);
                    return (
                      <button
                        key={kelas.id_kelas}
                        type="button"
                        onClick={() => handleToggleAssignmentKelas(kelas.id_kelas)}
                        className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center justify-between text-xs ${
                          isChecked
                            ? 'bg-[#415A77]/10 border-[#D4AF37] text-[#0D1B2A] font-medium shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate pr-1">{kelas.nama_kelas}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-[#0D1B2A] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seksi 2: Mata Kuliah Bimbingan */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs">
                    Mata Kuliah Praktikum ({assignmentSelectedMatkul.length} dipilih)
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setAssignmentSelectedMatkul(masterMatkul?.map(m => m.id_mata_kuliah) || [])}
                      className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setAssignmentSelectedMatkul([])}
                      className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {masterMatkul?.map((matkul) => {
                    const isChecked = assignmentSelectedMatkul.includes(matkul.id_mata_kuliah);
                    return (
                      <button
                        key={matkul.id_mata_kuliah}
                        type="button"
                        onClick={() => handleToggleAssignmentMatkul(matkul.id_mata_kuliah)}
                        className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center justify-between text-xs ${
                          isChecked
                            ? 'bg-[#415A77]/10 border-[#D4AF37] text-[#0D1B2A] font-medium shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate pr-1">{matkul.nama_matkul}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-[#0D1B2A] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500">
                {assignmentSelectedKelas.length} kelas dan {assignmentSelectedMatkul.length} mata kuliah dipilih.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignmentModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  disabled={updateAssignmentsMutation.isPending}
                  className="px-4 py-1.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updateAssignmentsMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Penugasan</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
