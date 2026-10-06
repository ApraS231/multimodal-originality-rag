import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const getBackendUrl = () => import.meta.env.VITE_API_BACKEND_URL || '';

// ==========================================
// Tipe Antarmuka (Interfaces)
// ==========================================
export interface ProgramStudi {
  id_program_studi: string;
  nama_prodi: string;
  created_at?: string;
  updated_at?: string;
}

export interface Kelas {
  id_kelas: string;
  nama_kelas: string;
  id_program_studi: string;
  prodi?: ProgramStudi;
  created_at?: string;
  updated_at?: string;
}

export interface AslabPengampu {
  id_profil: string;
  id_pengguna: string;
  nama: string;
  email: string;
  kode_aslab: string | null;
  nim: string | null;
}

export interface RingkasanLaporanMatkul {
  total: number;
  diverifikasi: number;
  menunggu: number;
  rerata_orisinalitas: number;
}

export interface LaporanSingkatMatkul {
  id_laporan: string;
  nama_mahasiswa: string | null;
  nim: string | null;
  skor_orisinalitas: number;
  skor_plagiarisme: number;
  apakah_diverifikasi: boolean;
  status: string;
  tanggal_dibuat: string;
}

export interface MataKuliah {
  id_mata_kuliah: string;
  nama_matkul: string;
  aslab?: AslabPengampu[];
  ringkasan_laporan?: RingkasanLaporanMatkul;
  laporan_terbaru?: LaporanSingkatMatkul[];
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// Hooks Program Studi (Prodi)
// ==========================================
export const useProdi = () => {
  return useQuery<ProgramStudi[]>({
    queryKey: ['prodi'],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/admin/prodi`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil data Program Studi');
      return res.json();
    },
  });
};

export const useCreateProdi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nama_prodi: string) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/prodi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_prodi }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menambahkan Program Studi');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prodi'] });
    },
  });
};

export const useUpdateProdi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; id_program_studi?: string; nama_prodi: string }) => {
      const id = args.id || args.id_program_studi;
      if (!id) throw new Error('ID Program Studi tidak ditemukan.');
      const res = await fetch(`${getBackendUrl()}/api/admin/prodi/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_prodi: args.nama_prodi }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memperbarui Program Studi');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prodi'] });
    },
  });
};

export const useDeleteProdi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/prodi/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus Program Studi');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prodi'] });
    },
  });
};

// ==========================================
// Hooks Kelas
// ==========================================
export const useKelas = () => {
  return useQuery<Kelas[]>({
    queryKey: ['kelas'],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/admin/kelas`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil data Kelas');
      return res.json();
    },
  });
};

export const useCreateKelas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nama_kelas: string; id_program_studi: string }) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/kelas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menambahkan Kelas');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kelas'] });
    },
  });
};

export const useUpdateKelas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id?: string;
      id_kelas?: string;
      nama_kelas?: string;
      id_program_studi?: string;
      payload?: { nama_kelas: string; id_program_studi: string };
    }) => {
      const id = args.id || args.id_kelas;
      if (!id) {
        throw new Error('ID Kelas tidak ditemukan.');
      }
      const bodyPayload = args.payload || {
        nama_kelas: args.nama_kelas || '',
        id_program_studi: args.id_program_studi || '',
      };
      const res = await fetch(`${getBackendUrl()}/api/admin/kelas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memperbarui Kelas');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kelas'] });
    },
  });
};

export const useDeleteKelas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/kelas/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus Kelas');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kelas'] });
    },
  });
};

// ==========================================
// Hooks Mata Kuliah (Matkul)
// ==========================================
export const useMatkul = () => {
  return useQuery<MataKuliah[]>({
    queryKey: ['matkul'],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/admin/matkul`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil data Mata Kuliah');
      return res.json();
    },
  });
};

export const useCreateMatkul = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nama_matkul: string) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/matkul`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_matkul }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menambahkan Mata Kuliah');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matkul'] });
    },
  });
};

export const useUpdateMatkul = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; id_mata_kuliah?: string; nama_matkul: string }) => {
      const id = args.id || args.id_mata_kuliah;
      if (!id) throw new Error('ID Mata Kuliah tidak ditemukan.');
      const res = await fetch(`${getBackendUrl()}/api/admin/matkul/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_matkul: args.nama_matkul }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memperbarui Mata Kuliah');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matkul'] });
    },
  });
};

export const useDeleteMatkul = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/matkul/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus Mata Kuliah');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matkul'] });
    },
  });
};

// ==========================================
// Tipe & Hooks Direktori Laporan (Repository)
// ==========================================
export interface ReportAuthor {
  id: string;
  nama: string;
  email: string;
}

export interface ReportItem {
  id_laporan: string;
  nama_mahasiswa: string;
  nim: string;
  status: string;
  tautan_berkas: string;
  id_pengunggah: string;
  id_program_studi: string;
  id_kelas: string;
  id_mata_kuliah: string;
  tahun_akademik: number;
  skor_orisinalitas: number;
  skor_plagiarisme: number;
  skor_orisinalitas_override?: number | null;
  nilai_huruf?: string | null;
  waktu_mulai_analisis?: string | null;
  waktu_selesai_analisis?: string | null;
  tanggal_dibuat: string;
  prodi?: ProgramStudi;
  kelas?: Kelas;
  matkul?: MataKuliah;
  pengunggah?: ReportAuthor;
}

export interface AllReportsResponse {
  success: boolean;
  reports: ReportItem[];
  total: number;
  stats: {
    totalReports: number;
    avgOriginality: number;
    totalVectors: number;
  };
}

export interface AllReportsFilter {
  search?: string;
  id_program_studi?: string;
  id_mata_kuliah?: string;
  id_kelas?: string;
  status?: string;
}

export const useAllReports = (filter?: AllReportsFilter) => {
  return useQuery<AllReportsResponse>({
    queryKey: ['allReports', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.search) params.append('search', filter.search);
      if (filter?.id_program_studi && filter.id_program_studi !== 'ALL') {
        params.append('id_program_studi', filter.id_program_studi);
      }
      if (filter?.id_mata_kuliah && filter.id_mata_kuliah !== 'ALL') {
        params.append('id_mata_kuliah', filter.id_mata_kuliah);
      }
      if (filter?.id_kelas && filter.id_kelas !== 'ALL') {
        params.append('id_kelas', filter.id_kelas);
      }
      if (filter?.status && filter.status !== 'ALL') {
        params.append('status', filter.status);
      }

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${getBackendUrl()}/api/reports/all${qs}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil direktori naskah/laporan');
      return res.json();
    },
  });
};

export const useDeleteReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getBackendUrl()}/api/reports/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus naskah laporan');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allReports'] });
      queryClient.invalidateQueries({ queryKey: ['aslabNav'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useBulkDeleteReports = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`${getBackendUrl()}/api/reports/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus naskah terpilih');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allReports'] });
      queryClient.invalidateQueries({ queryKey: ['aslabNav'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useUpdateUserAssignments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, kelasIds, matkulIds }: { userId: string; kelasIds: string[]; matkulIds: string[] }) => {
      const res = await fetch(`${getBackendUrl()}/api/admin/users/${userId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kelasIds, matkulIds }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui penugasan pengguna');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
};


