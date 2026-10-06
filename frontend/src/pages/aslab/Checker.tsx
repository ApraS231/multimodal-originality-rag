import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useProdi, useKelas, useMatkul } from '../../api/admin';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  ArrowLeft, 
  RefreshCw, 
  X, 
  GraduationCap, 
  CloudLightning, 
  FileUp, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  User,
  Hash
} from 'lucide-react';
import PageHeader from '../../components/ui/page-header';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SegmentedControl } from '../../components/ui/grouped-list';

interface ScrapePayload {
  queryKeywords: string[];
  id_program_studi: string;
  id_kelas: string;
  id_mata_kuliah: string;
  tahun_akademik: string;
}

export default function Checker() {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';
  const { data: prodiList } = useProdi();
  const { data: kelasList } = useKelas();
  const { data: matkulList } = useMatkul();

  // Ambil data profil aslab untuk membatasi pilihan kelas & mata kuliah
  const { data: profileResponse } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/auth/profile`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengambil data profil');
      return res.json();
    },
  });

  const isAslab = profileResponse?.profil?.peran === 'ASLAB';
  const assignedKelasIds: string[] = profileResponse?.profil?.kelas_aslab || [];
  const assignedMatkulIds: string[] = profileResponse?.profil?.matkul_aslab || [];

  // Filter daftar kelas & mata kuliah bimbingan sesuai penugasan dari admin
  const filteredKelasList = kelasList?.filter((k) => {
    if (!isAslab) return true;
    return assignedKelasIds.includes(k.id_kelas);
  });

  const filteredMatkulList = matkulList?.filter((m) => {
    if (!isAslab) return true;
    return assignedMatkulIds.includes(m.id_mata_kuliah);
  });

  const filteredProdiList = prodiList?.filter((p) => {
    if (!isAslab) return true;
    return filteredKelasList?.some((k) => k.id_program_studi === p.id_program_studi);
  });

  const isAslabWithoutAssignment = isAslab && (assignedKelasIds.length === 0 || assignedMatkulIds.length === 0);

  // Mode tab: 'single' (Unggah Langsung) atau 'batch' (Scrape Cloud)
  const [activeMode, setActiveMode] = useState<'single' | 'batch'>('single');

  // State bersama: Metadata Akademik
  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [selectedMatkulId, setSelectedMatkulId] = useState('');
  const [tahunAkademik, setTahunAkademik] = useState(new Date().getFullYear().toString());

  // State khusus Mode Single Upload
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [namaMahasiswa, setNamaMahasiswa] = useState('');
  const [nimMahasiswa, setNimMahasiswa] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State khusus Mode Batch Scrape
  const [keywords, setKeywords] = useState('');

  // Status & Notifikasi
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadedReportId, setUploadedReportId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastProgress, setToastProgress] = useState(0);
  const [toastStatus, setToastStatus] = useState<'processing' | 'completed' | 'failed'>('processing');

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 1. Mutation: Upload Berkas Tunggal (Direct Single Upload)
  const singleUploadMutation = useMutation({
    mutationFn: async () => {
      if (!singleFile) throw new Error('Harap pilih berkas PDF terlebih dahulu.');

      const formData = new FormData();
      formData.append('file', singleFile);
      formData.append('id_program_studi', selectedProdiId);
      formData.append('id_kelas', selectedKelasId);
      formData.append('id_mata_kuliah', selectedMatkulId);
      formData.append('tahun_akademik', tahunAkademik);
      if (namaMahasiswa.trim()) formData.append('nama_mahasiswa', namaMahasiswa.trim());
      if (nimMahasiswa.trim()) formData.append('nim', nimMahasiswa.trim());

      const res = await fetch(`${backendUrl}/api/seeding/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menganalisis berkas laporan.');
      }
      return data;
    },
    onSuccess: (data) => {
      setErrorMsg('');
      setSuccessMsg(data.message || 'Laporan berhasil diproses!');
      setUploadedReportId(data.id_laporan || null);
      setSingleFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses berkas laporan.');
    },
  });

  // 2. Mutation: Batch Scraping Cloud
  const scrapeMutation = useMutation({
    mutationFn: async (payload: ScrapePayload) => {
      const res = await fetch(`${backendUrl}/api/seeding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memicu pengunggahan massal.');
      }
      return data;
    },
    onSuccess: (data) => {
      const tid = data.taskId;
      setToastTitle('Memulai penyerapan massal...');
      setToastMessage('Menghubungkan ke pipa ekstraksi cloud...');
      setToastProgress(0);
      setToastStatus('processing');
      setShowToast(true);
      setErrorMsg('');

      const source = new EventSource(`${backendUrl}/api/scrape/stream/${tid}`);
      eventSourceRef.current = source;

      source.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.message) setToastMessage(update.message);

          if (update.downloaded && update.total) {
            setToastTitle(`Mengunduh berkas (${update.downloaded}/${update.total})`);
            const calculatedProgress = Math.round((update.downloaded / update.total) * 100);
            setToastProgress(calculatedProgress);
          }

          if (update.status === 'completed') {
            setToastStatus('completed');
            setToastTitle('Scraping Massal Selesai');
            setToastMessage('Seluruh berkas laporan berhasil diunggah.');
            setToastProgress(100);
            source.close();
          }

          if (update.status === 'failed') {
            setToastStatus('failed');
            setToastTitle('Scraping Massal Gagal');
            setToastMessage(update.message || 'Terjadi kesalahan pemrosesan.');
            source.close();
          }
        } catch (err) {
          console.error('Gagal memproses SSE:', err);
          setToastMessage(event.data);
        }
      };

      source.onerror = () => {
        setToastStatus('failed');
        setToastTitle('Koneksi Terputus');
        setToastMessage('Sambungan ke server progress scraping terputus.');
        source.close();
      };
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Gagal memulai penyerapan cloud.');
    },
  });

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setSingleFile(file);
        setErrorMsg('');
      } else {
        setErrorMsg('Hanya berkas PDF (.pdf) yang diperkenankan.');
      }
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!singleFile) {
      setErrorMsg('Harap lampirkan dokumen PDF praktikan.');
      return;
    }
    if (!selectedProdiId || !selectedKelasId || !selectedMatkulId || !tahunAkademik) {
      setErrorMsg('Seluruh kolom metadata akademik bertanda bintang wajib ditentukan.');
      return;
    }
    singleUploadMutation.mutate();
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!keywords.trim()) {
      setErrorMsg('Tautan Cloud Folder / Kata Kunci pencarian wajib diisi.');
      return;
    }
    if (!selectedProdiId || !selectedKelasId || !selectedMatkulId || !tahunAkademik) {
      setErrorMsg('Seluruh kolom metadata akademik bertanda bintang wajib ditentukan.');
      return;
    }

    const queryKeywords = keywords.split(',').map((k) => k.trim()).filter((k) => k !== '');
    scrapeMutation.mutate({
      queryKeywords,
      id_program_studi: selectedProdiId,
      id_kelas: selectedKelasId,
      id_mata_kuliah: selectedMatkulId,
      tahun_akademik: tahunAkademik,
    });
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] font-sans">
      {/* Header */}
      <PageHeader 
        title="Dokumen"
        titleAccent="Checker"
        description="Unggah berkas laporan praktikan untuk analisis orisinalitas langsung atau sinkronisasi folder cloud."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/aslab/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dasbor Asisten</span>
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Pipa Analisis"
          value="Hybrid RRF"
          subtitle="Dense + Full-Text Search"
          variant="brass"
        />
        <StatCard
          title="Format Valid"
          value="PDF (Maks. 25 MB)"
          subtitle="PyMuPDF + EasyOCR Fallback"
          variant="navy"
        />
        <StatCard
          title="Verifikasi Visual"
          value="CLIP Cosine"
          subtitle="Deteksi Duplikasi Diagram & Gambar"
          variant="default"
        />
      </div>

      {/* Segmented Mode Switcher */}
      <SegmentedControl
        options={[
          { value: 'single', label: 'Unggah Berkas Tunggal', icon: <FileUp className="w-3.5 h-3.5" /> },
          { value: 'batch', label: 'Penyerapan Cloud Batch', icon: <CloudLightning className="w-3.5 h-3.5" /> },
        ]}
        value={activeMode}
        onChange={(val) => {
          setActiveMode(val);
          setErrorMsg('');
          setSuccessMsg('');
        }}
        className="max-w-md"
      />

      {/* Notifikasi Status */}
      {isAslabWithoutAssignment && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-start gap-3 animate-fade-in shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Penugasan Belum Ditetapkan Administrator</p>
            <p className="text-amber-800 leading-relaxed">
              Akun Anda belum memiliki alokasi kelas bimbingan atau mata kuliah praktikum aktif. Hak akses pengunggahan berkas dibatasi oleh Administrator Laboratorium untuk menjaga integritas data.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-[#415A77]/10 border border-[#415A77]/25 text-[#0D1B2A] text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
            <span>{successMsg}</span>
          </div>
          {uploadedReportId && (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate(`/aslab/reports/${uploadedReportId}`)}
            >
              <span>Lihat Detail Laporan</span>
            </Button>
          )}
        </div>
      )}

      {/* Card Formulir Utama */}
      <Card className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-[#0D1B2A] dark:text-white flex items-center gap-2">
              {activeMode === 'single' ? (
                <>
                  <FileUp className="w-5 h-5 text-[#0D1B2A]" />
                  <span>Unggah Berkas PDF Praktikan (Analisis Instan)</span>
                </>
              ) : (
                <>
                  <CloudLightning className="w-5 h-5 text-slate-700" />
                  <span>Penyerapan Massal Folder Cloud (Batch Seeding)</span>
                </>
              )}
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {activeMode === 'single'
                ? 'Unggah satu dokumen PDF laporan untuk ekstraksi teks, kemiripan visual CLIP, dan verifikasi orisinalitas instan.'
                : 'Sinkronisasi seluruh berkas praktikan satu kelas bimbingan secara otomatis melalui folder Google Drive.'}
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* A. FORMULIR MODE 1: UNGGAH BERKAS TUNGGAL                     */}
        {/* ------------------------------------------------------------- */}
        {activeMode === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="space-y-6">
            {/* Area Unggah Berkas PDF */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Berkas Laporan Praktikum (Format PDF) *
              </Label>
              
              {!singleFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-[#D4AF37] bg-[#415A77]/10/50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSingleFile(e.target.files[0]);
                        setErrorMsg('');
                      }
                    }}
                  />
                  <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-[#0D1B2A]">
                    Tarik dan lepaskan berkas PDF di sini, atau <span className="text-[#0D1B2A] underline">pilih dari perangkat</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Batas ukuran maksimum 25 MB per dokumen.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#415A77]/10/60 border border-[#415A77]/25 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#0D1B2A] text-[#F7F3E9] flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0D1B2A] truncate max-w-sm">
                        {singleFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {(singleFile.size / (1024 * 1024)).toFixed(2)} MB • Berkas siap dianalisis
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSingleFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                    title="Hapus berkas"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Metadata Akademik */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#0D1B2A]" />
                <span>Asosiasi Akademik & Identitas Praktikan</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prodi */}
                <div className="space-y-1.5">
                  <Label htmlFor="single-prodi" className="text-xs font-semibold text-slate-600">
                    Program Studi *
                  </Label>
                  <select
                    id="single-prodi"
                    value={selectedProdiId}
                    onChange={(e) => {
                      setSelectedProdiId(e.target.value);
                      setSelectedKelasId('');
                    }}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                    required
                  >
                    <option value="">Pilih Program Studi...</option>
                    {filteredProdiList?.map((prodi) => (
                      <option key={prodi.id_program_studi} value={prodi.id_program_studi}>
                        {prodi.nama_prodi}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kelas */}
                <div className="space-y-1.5">
                  <Label htmlFor="single-kelas" className="text-xs font-semibold text-slate-600">
                    Kelas Bimbingan *
                  </Label>
                  <select
                    id="single-kelas"
                    value={selectedKelasId}
                    onChange={(e) => setSelectedKelasId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none disabled:opacity-50"
                    required
                    disabled={!selectedProdiId || isAslabWithoutAssignment}
                  >
                    <option value="">Pilih Kelas...</option>
                    {filteredKelasList
                      ?.filter((k) => k.id_program_studi === selectedProdiId)
                      .map((kelas) => (
                        <option key={kelas.id_kelas} value={kelas.id_kelas}>
                          {kelas.nama_kelas}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Mata Kuliah */}
                <div className="space-y-1.5">
                  <Label htmlFor="single-matkul" className="text-xs font-semibold text-slate-600">
                    Mata Kuliah Praktikum *
                  </Label>
                  <select
                    id="single-matkul"
                    value={selectedMatkulId}
                    onChange={(e) => setSelectedMatkulId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                    required
                    disabled={isAslabWithoutAssignment}
                  >
                    <option value="">Pilih Mata Kuliah...</option>
                    {filteredMatkulList?.map((matkul) => (
                      <option key={matkul.id_mata_kuliah} value={matkul.id_mata_kuliah}>
                        {matkul.nama_matkul}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tahun Akademik */}
                <div className="space-y-1.5">
                  <Label htmlFor="single-tahun" className="text-xs font-semibold text-slate-600">
                    Tahun Akademik *
                  </Label>
                  <Input
                    id="single-tahun"
                    type="number"
                    value={tahunAkademik}
                    onChange={(e) => setTahunAkademik(e.target.value)}
                    className="bg-white border-slate-300 h-10 rounded-md text-xs font-mono"
                    required
                  />
                </div>

                {/* Nama Praktikan (Opsional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="single-nama" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nama Praktikan (Opsional)</span>
                  </Label>
                  <Input
                    id="single-nama"
                    type="text"
                    placeholder="Ekstraksi otomatis atau ketik nama..."
                    value={namaMahasiswa}
                    onChange={(e) => setNamaMahasiswa(e.target.value)}
                    className="bg-white border-slate-300 h-10 rounded-md text-xs"
                  />
                </div>

                {/* NIM Praktikan (Opsional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="single-nim" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>NIM Praktikan (Opsional)</span>
                  </Label>
                  <Input
                    id="single-nim"
                    type="text"
                    placeholder="contoh: 2201001"
                    value={nimMahasiswa}
                    onChange={(e) => setNimMahasiswa(e.target.value)}
                    className="bg-white border-slate-300 h-10 rounded-md text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Tombol Aksi Single Submit */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="default"
                disabled={singleUploadMutation.isPending || isAslabWithoutAssignment}
                loading={singleUploadMutation.isPending}
                className="gap-2"
              >
                <FileUp className="w-4 h-4" />
                <span>Analisis Orisinalitas Laporan</span>
              </Button>
            </div>
          </form>
        ) : (
          /* ----------------------------------------------------------- */
          /* B. FORMULIR MODE 2: PENYERAPAN MASSAL CLOUD SEEDING         */
          /* ----------------------------------------------------------- */
          <form onSubmit={handleBatchSubmit} className="space-y-6">
            {/* Metadata Akademik */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-700" />
                <span>Target Asosiasi Akademik Kelas</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prodi */}
                <div className="space-y-1.5">
                  <Label htmlFor="batch-prodi" className="text-xs font-semibold text-slate-600">
                    Program Studi *
                  </Label>
                  <select
                    id="batch-prodi"
                    value={selectedProdiId}
                    onChange={(e) => {
                      setSelectedProdiId(e.target.value);
                      setSelectedKelasId('');
                    }}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                    required
                  >
                    <option value="">Pilih Program Studi...</option>
                    {filteredProdiList?.map((prodi) => (
                      <option key={prodi.id_program_studi} value={prodi.id_program_studi}>
                        {prodi.nama_prodi}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kelas */}
                <div className="space-y-1.5">
                  <Label htmlFor="batch-kelas" className="text-xs font-semibold text-slate-600">
                    Kelas Bimbingan *
                  </Label>
                  <select
                    id="batch-kelas"
                    value={selectedKelasId}
                    onChange={(e) => setSelectedKelasId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none disabled:opacity-50"
                    required
                    disabled={!selectedProdiId || isAslabWithoutAssignment}
                  >
                    <option value="">Pilih Kelas...</option>
                    {filteredKelasList
                      ?.filter((k) => k.id_program_studi === selectedProdiId)
                      .map((kelas) => (
                        <option key={kelas.id_kelas} value={kelas.id_kelas}>
                          {kelas.nama_kelas}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Mata Kuliah */}
                <div className="space-y-1.5">
                  <Label htmlFor="batch-matkul" className="text-xs font-semibold text-slate-600">
                    Mata Kuliah Praktikum *
                  </Label>
                  <select
                    id="batch-matkul"
                    value={selectedMatkulId}
                    onChange={(e) => setSelectedMatkulId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-[#0D1B2A] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                    required
                    disabled={isAslabWithoutAssignment}
                  >
                    <option value="">Pilih Mata Kuliah...</option>
                    {filteredMatkulList?.map((matkul) => (
                      <option key={matkul.id_mata_kuliah} value={matkul.id_mata_kuliah}>
                        {matkul.nama_matkul}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tahun Akademik */}
                <div className="space-y-1.5">
                  <Label htmlFor="batch-tahun" className="text-xs font-semibold text-slate-600">
                    Tahun Akademik *
                  </Label>
                  <Input
                    id="batch-tahun"
                    type="number"
                    value={tahunAkademik}
                    onChange={(e) => setTahunAkademik(e.target.value)}
                    className="bg-white border-slate-300 h-10 rounded-md text-xs font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Sumber Cloud Storage & Keywords */}
            <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider flex items-center gap-2">
                  <CloudLightning className="w-4 h-4 text-slate-700" />
                  <span>Folder Cloud & Kata Kunci Pencarian *</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Google Drive Folder / Tags</span>
              </div>

              <div className="space-y-2">
                <Input
                  id="keywords"
                  type="text"
                  placeholder="Contoh: praktikum-ti-2026-A, modul_basis_data_1"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="bg-slate-50 border-slate-300 h-10 rounded-md text-xs font-mono"
                  required
                />
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Contoh tag:</span>
                  <button
                    type="button"
                    onClick={() => setKeywords('modul_1_web')}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] transition-colors cursor-pointer"
                  >
                    modul_1_web
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeywords('laporan_akhir_basisdata')}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] transition-colors cursor-pointer"
                  >
                    laporan_akhir_basisdata
                  </button>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Batch Submit */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="default"
                disabled={scrapeMutation.isPending || isAslabWithoutAssignment}
                loading={scrapeMutation.isPending}
                className="gap-2"
              >
                <CloudLightning className="w-4 h-4" />
                <span>Mulai Sinkronisasi Cloud</span>
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Live Toaster Floating Log Overlay */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-md p-4 animate-in slide-in-from-bottom-3 duration-200">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#D4AF37] rounded-t-lg" />
          
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[#0D1B2A] flex items-center gap-2">
                {toastStatus === 'processing' && <RefreshCw className="w-3.5 h-3.5 text-[#8C6D1F] animate-spin" />}
                {toastTitle}
              </h4>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed truncate max-w-[280px]">
                {toastMessage}
              </p>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3.5 space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-600 font-semibold">
              <span>Status: {toastStatus}</span>
              <span>{toastProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4AF37] rounded-full transition-all duration-300"
                style={{ width: `${toastProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
