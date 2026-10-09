import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKelas, useMatkul } from '../../api/admin';
import { BookOpen, Terminal, Shield, Mail, Award, CheckCircle, User, Eye, EyeOff, Key, Lock } from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';
import PageHeader from '../../components/ui/page-header';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface UserProfileData {
  user: {
    id: string;
    email: string;
    nama: string;
  };
  profil: {
    id_profil: string;
    id_pengguna: string;
    peran: string;
    nim: string | null;
    kode_aslab: string | null;
    kode_kalab: string | null;
    tanggal_dibuat: string;
    kelas_aslab: string[]; // daftar ID kelas yang diampu
    matkul_aslab: string[]; // daftar ID matkul yang diampu
  } | null;
}

export default function Profile() {
  const queryClient = useQueryClient();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // State local daftar ID penugasan kelas & matkul dari profil
  const [selectedKelas, setSelectedKelas] = useState<string[]>([]);
  const [selectedMatkul, setSelectedMatkul] = useState<string[]>([]);

  // States untuk Edit Profil Mandiri
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editNim, setEditNim] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // 1. Ambil detail data profil & penugasan aslab aktif
  const { data: profileResponse, isLoading: isLoadingProfile } = useQuery<UserProfileData>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/auth/profile`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil data profil');
      return res.json();
    },
  });

  // 2. Ambil daftar master kelas
  const { data: masterKelas, isLoading: isLoadingKelas } = useKelas();

  // 3. Ambil daftar master mata kuliah
  const { data: masterMatkul, isLoading: isLoadingMatkul } = useMatkul();

  // Efek sinkronisasi data awal
  useEffect(() => {
    if (profileResponse?.user) {
      setEditNama(profileResponse.user.nama || '');
    }
    if (profileResponse?.profil) {
      setEditNim(profileResponse.profil.nim || '');
      setSelectedKelas(profileResponse.profil.kelas_aslab || []);
      setSelectedMatkul(profileResponse.profil.matkul_aslab || []);
    }
  }, [profileResponse]);

  // Mutasi simpan data diri profil
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { nama: string; nim: string; password?: string }) => {
      const res = await fetch(`${backendUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui profil.');
      return data;
    },
    onSuccess: () => {
      setProfileSuccessMsg('Profil Anda berhasil diperbarui!');
      setIsEditingProfile(false);
      setEditPassword('');
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setProfileErrorMsg(err.message || 'Terjadi kesalahan.');
      setTimeout(() => setProfileErrorMsg(''), 4000);
    }
  });

  const handleUpdateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg('');
    if (!editNama.trim()) {
      setProfileErrorMsg('Nama lengkap wajib diisi.');
      return;
    }
    const payload: any = {
      nama: editNama,
      nim: editNim
    };
    if (editPassword.trim()) {
      if (editPassword.length < 6) {
        setProfileErrorMsg('Password minimal terdiri dari 6 karakter.');
        return;
      }
      payload.password = editPassword;
    }
    updateProfileMutation.mutate(payload);
  };

  const isLoading = isLoadingProfile || isLoadingKelas || isLoadingMatkul;

  if (isLoading) {
    return (
      <LoadingSpinner variant="fullpage" message="Menata data profil asisten..." />
    );
  }

  const user = profileResponse?.user;
  const profil = profileResponse?.profil;

  // Filter daftar kelas dan matkul yang telah ditugaskan oleh administrator
  const assignedKelasList = masterKelas?.filter((k) => selectedKelas.includes(k.id_kelas)) || [];
  const assignedMatkulList = masterMatkul?.filter((m) => selectedMatkul.includes(m.id_mata_kuliah)) || [];

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Profil &"
        titleAccent="Penugasan Aslab"
        description="Kelola data profil asisten laboratorium serta tinjau kelas dan mata kuliah bimbingan aktif yang ditugaskan administrator."
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <StatCard
          title="Wewenang Sistem"
          value={profil?.peran || 'ASLAB'}
          subtitle="Status Terverifikasi Aktif"
          variant="default"
        />
        <StatCard
          title="Kelas Diampu"
          value={assignedKelasList.length}
          subtitle="Bimbingan Terdaftar"
          variant="default"
        />
        <StatCard
          title="Mata Kuliah Diampu"
          value={assignedMatkulList.length}
          subtitle="Kurikulum Laboratorium"
          variant="brass"
        />
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ======================================================== */}
        {/* PILAR KIRI: DETAIL PROFIL & FORM EDIT MANDIRI */}
        {/* ======================================================== */}
        <div className="lg:col-span-1 space-y-6">
          {profileSuccessMsg && (
            <div className="p-3 bg-[#415A77]/10 border border-[#415A77]/25 text-[#0D1B2A] rounded-lg flex items-center gap-2.5 text-xs font-semibold animate-fade-in shadow-xs">
              <CheckCircle className="w-4 h-4 text-[#8C6D1F] flex-shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {!isEditingProfile ? (
            /* Mode 1: Tampilan Detail */
            <Card className="flex flex-col items-center text-center p-6 space-y-5 bg-white border border-slate-200/80">
              <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[#0D1B2A] text-2xl shadow-xs">
                {user?.nama.charAt(0).toUpperCase()}
              </div>
              
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#0D1B2A]">{user?.nama}</h2>
                <span className="text-xs font-semibold text-[#0D1B2A] bg-[#415A77]/10 border border-[#415A77]/25 px-3 py-0.5 rounded-full uppercase tracking-wider block w-max mx-auto">
                  {profil?.peran}
                </span>
              </div>

              <div className="w-full border-t border-slate-100 pt-4 pb-1 space-y-3 text-left text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium text-slate-700">{user?.email}</span>
                </div>
                {profil?.nim && (
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-700">NIM: <span className="font-mono font-bold text-[#0D1B2A]">{profil.nim}</span></span>
                  </div>
                )}
                {profil?.kode_aslab && (
                  <div className="flex items-center gap-2.5">
                    <Award className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-700">Kode Asisten: <span className="font-mono font-bold text-[#0D1B2A]">{profil.kode_aslab}</span></span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingProfile(true)}
                className="w-full"
              >
                <User className="w-3.5 h-3.5 mr-2" />
                Edit Data Diri
              </Button>
            </Card>
          ) : (
            /* Mode 2: Formulir Edit Mandiri */
            <Card className="p-6 text-left bg-white border border-slate-200/80">
              <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
                <div className="flex flex-col items-center text-center space-y-2 border-b border-slate-100 pb-4">
                  <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[#0D1B2A] text-xl shadow-xs">
                    {user?.nama.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0D1B2A]">
                    Ubah Profil Asisten
                  </h3>
                </div>

                {profileErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md font-medium text-center leading-relaxed">
                    {profileErrorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="edit-nama" className="text-xs font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Nama Lengkap *
                  </Label>
                  <Input
                    id="edit-nama"
                    type="text"
                    placeholder="Alvin Pratama"
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="bg-white border-slate-200/80 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 text-[#0D1B2A] text-xs h-10 rounded-md transition-all shadow-xs w-full"
                    required
                  />
                </div>

                {profil?.nim !== undefined && (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-nim" className="text-xs font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      NIM (Nomor Induk Mahasiswa)
                    </Label>
                    <Input
                      id="edit-nim"
                      type="text"
                      placeholder="2021001"
                      value={editNim}
                      onChange={(e) => setEditNim(e.target.value)}
                      className="bg-white border-slate-200/80 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 text-[#0D1B2A] text-xs h-10 rounded-md transition-all shadow-xs w-full font-mono font-bold"
                    />
                  </div>
                )}

                {/* Ganti Kata Sandi (Opsional) */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0D1B2A] flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Ubah Kata Sandi Baru
                    </span>
                    <p className="text-[11px] text-slate-500">Kosongkan jika tidak ingin mengubah kata sandi akun Anda.</p>
                  </div>

                  <div className="relative">
                    <Input
                      type={showEditPassword ? 'text' : 'password'}
                      placeholder="Kata sandi baru (min. 6 karakter)..."
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="bg-white border-slate-200/80 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 text-[#0D1B2A] text-xs h-10 rounded-md transition-all pr-10 shadow-xs w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileErrorMsg('');
                      setEditPassword('');
                    }}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    loading={updateProfileMutation.isPending}
                    className="flex-1"
                  >
                    Simpan Profil
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>

        {/* ======================================================== */}
        {/* PILAR KANAN: READ-ONLY ASSIGNMENTS DETAIL */}
        {/* ======================================================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Banner Kebijakan Hak Akses Terkelola */}
          <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-lg flex items-start gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-md bg-[#0D1B2A] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0D1B2A]">
                Penugasan Terkelola oleh Administrator
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Penetapan kelas bimbingan dan mata kuliah praktikum dikonfigurasi secara terpusat oleh Administrator Laboratorium untuk menjamin isolasi hak akses dokumen. Hubungi staf laboratorium jika terdapat pembaruan jadwal mengajar.
              </p>
            </div>
          </div>

          {/* Section 1: Kelas Bimbingan Aktif */}
          <Card className="space-y-4 p-5 bg-white border border-slate-200/80">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-[#0D1B2A]">
                  <BookOpen className="w-4 h-4 text-[#0D1B2A]" />
                  Kelas yang Diampu
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Daftar kelas bimbingan praktikum resmi yang dialokasikan untuk Anda.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-mono">
                {assignedKelasList.length} Kelas
              </span>
            </div>

            {assignedKelasList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {assignedKelasList.map((kelas) => (
                  <div
                    key={kelas.id_kelas}
                    className="p-3.5 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 transition-colors shadow-2xs flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" />
                        <span className="text-xs font-bold text-[#0D1B2A] truncate">
                          {kelas.nama_kelas}
                        </span>
                      </div>
                      {kelas.prodi && (
                        <p className="text-[11px] text-slate-500 pl-4 truncate mt-0.5">
                          {kelas.prodi.nama_prodi}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      Aktif
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Belum Ada Kelas Ditugaskan</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                  Administrator belum menetapkan kelas bimbingan untuk akun Anda. Silakan hubungi koordinator laboratorium.
                </p>
              </div>
            )}
          </Card>

          {/* Section 2: Mata Kuliah Diampu */}
          <Card className="space-y-4 p-5 bg-white border border-slate-200/80">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-[#0D1B2A]">
                  <Terminal className="w-4 h-4 text-[#0D1B2A]" />
                  Mata Kuliah Bimbingan
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Daftar mata kuliah praktikum yang berada dalam cakupan verifikasi Anda.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-mono">
                {assignedMatkulList.length} Mata Kuliah
              </span>
            </div>

            {assignedMatkulList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {assignedMatkulList.map((matkul) => (
                  <div
                    key={matkul.id_mata_kuliah}
                    className="p-3.5 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 transition-colors shadow-2xs flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" />
                        <span className="text-xs font-bold text-[#0D1B2A] truncate">
                          {matkul.nama_matkul}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#415A77]/10 text-[#0D1B2A] border border-[#415A77]/25/60 shrink-0">
                      Terdaftar
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <Terminal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Belum Ada Mata Kuliah Ditugaskan</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                  Administrator belum menetapkan mata kuliah praktikum untuk akun Anda. Silakan hubungi koordinator laboratorium.
                </p>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
