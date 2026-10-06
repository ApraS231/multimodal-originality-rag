import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Play, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  ShieldAlert 
} from 'lucide-react';
import { useToast } from '../../components/ui/toast-provider';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import ErrorState from '../../components/ui/error-state';
import PageHeader from '../../components/ui/page-header';
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

interface QueueJobItem {
  id_laporan: string;
  nama_berkas: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  tanggal_dibuat: string;
  id_pengguna: string;
  pengunggah?: {
    nama: string;
    email: string;
  };
  prodi?: {
    nama_prodi: string;
  };
  kelas?: {
    nama_kelas: string;
  };
}

export default function QueueMonitor() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // 1. Fetch active/pending queue jobs
  const { data: queueJobs = [], isLoading, error, refetch, isRefetching } = useQuery<QueueJobItem[]>({
    queryKey: ['adminQueueMonitor'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/queue/stuck`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat daftar antrean aktif.');
      return res.json();
    },
    refetchInterval: 10000, // Polling halus tiap 10 detik
  });

  // Mutasi intervensi paksa: gagalkan pekerjaan tertahan
  const forceFailMutation = useMutation({
    mutationFn: async (id_laporan: string) => {
      const res = await fetch(`${backendUrl}/api/admin/queue/${id_laporan}/force-fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Dibatalkan paksa oleh administrator via Monitoring Antrean' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menggagalkan pekerjaan.');
      }
      return res.json();
    },
    onSuccess: () => {
      success('Pekerjaan Dibatalkan', 'Status antrean berhasil diubah ke GAGAL untuk membebaskan worker.');
      queryClient.invalidateQueries({ queryKey: ['adminQueueMonitor'] });
    },
    onError: (err: any) => {
      toastError('Intervensi Gagal', err.message || 'Terjadi kesalahan sistem.');
    },
  });

  const handleForceFail = (id: string, fileName: string) => {
    const confirm = window.confirm(`Apakah Anda yakin ingin membatalkan paksa (Force Fail) analisis dokumen "${fileName}"? Tindakan ini akan membebaskan antrean pg-boss.`);
    if (confirm) {
      forceFailMutation.mutate(id);
    }
  };

  const getDurationString = (dateStr: string) => {
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} Menit`;
    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${hours} Jam ${remMins} Menit`;
  };

  // Filter pekerjaan yang terindikasi macet (stuck > 5 menit)
  const stuckJobs = useMemo(() => {
    return queueJobs.filter((job) => {
      const jobTime = new Date(job.tanggal_dibuat).getTime();
      const now = new Date().getTime();
      const diffMinutes = (now - jobTime) / (1000 * 60);
      return diffMinutes >= 5; // Terkunci lebih dari 5 menit
    });
  }, [queueJobs]);

  const stats = useMemo(() => {
    return {
      totalActive: queueJobs.length,
      stuckCount: stuckJobs.length,
      processingCount: queueJobs.filter((j) => j.status === 'PROCESSING').length,
    };
  }, [queueJobs, stuckJobs]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      
      {/* 1. Header Section */}
      <PageHeader 
        title="Antrean"
        titleAccent="Dokumen"
        description="Pantau status pemrosesan analisis orisinalitas laporan latar belakang dan lakukan intervensi cepat jika terjadi kemacetan antrean."
        actions={
          <Button
            onClick={() => refetch()}
            disabled={isRefetching}
            loading={isRefetching}
            variant="default"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Segarkan Antrean
          </Button>
        }
      />

      {/* 2. Top KPI Cards (Antislop StatCards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Antrean Tertahan"
          value={<>{stats.stuckCount} <span className="text-xs font-normal text-slate-500">Berkas</span></>}
          description={stats.stuckCount > 0 ? "Memerlukan intervensi admin" : "Seluruh proses berjalan lancar"}
          variant={stats.stuckCount > 0 ? "rose" : "blue"}
          badge={stats.stuckCount > 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-300">
              STUCK
            </span>
          ) : undefined}
        />

        <StatCard
          title="Batas Waktu Toleransi"
          value="10 Menit"
          description="Ambang batas deteksi macet"
          variant="amber"
        />

        <StatCard
          title="Status Worker pg-boss"
          value="Aktif"
          description="Background queue engine"
          variant="navy"
          badge={
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0D1B2A] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              ONLINE
            </span>
          }
        />
      </div>

      {/* 3. Ketentuan Antrean Alert Box */}
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-200/80 flex items-start gap-3 text-xs leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0D1B2A] font-bold uppercase tracking-wider block mb-1">
            Mekanisme Intervensi Antrean Macet (Stuck Jobs):
          </strong>
          <p className="text-slate-700">
            Laporan otomatis digolongkan sebagai <span className="font-semibold text-amber-800">Stuck</span> apabila proses analisis berstatus <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-bold font-mono">QUEUED</code> atau <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-bold font-mono">PROCESSING</code> melebihi batas waktu 10 menit tanpa kemajuan. Tekan tombol <strong className="text-rose-600">Force Fail</strong> untuk membebaskan alokasi pekerja dan memperbolehkan pengunggahan ulang berkas.
          </p>
        </div>
      </div>

      {/* 4. Table Card Area */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="py-24">
            <LoadingSpinner variant="fullpage" message="Menganalisis status antrean pg-boss..." />
          </div>
        ) : error ? (
          <div className="py-12">
            <ErrorState 
              title="Gagal Memuat Status Antrean"
              description={(error as Error)?.message || 'Terjadi kesalahan sistem saat memantau antrean pg-boss.'}
              onRetry={() => refetch()}
            />
          </div>
        ) : !stuckJobs || stuckJobs.length === 0 ? (
          <div className="py-16">
            <EmptyState 
              icon={CheckCircle2}
              title="Antrean Berjalan Normal"
              description="Tidak ada analisis laporan praktikum yang tertahan (stuck) saat ini. Seluruh antrean berhasil diproses."
            />
          </div>
        ) : (
          <TableContainer ariaLabel="Tabel Antrean Analisis Tertahan (Stuck Jobs)" bordered>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Nama Berkas Laporan</TableHead>
                  <TableHead>Pengunggah (Aslab)</TableHead>
                  <TableHead>Program Studi & Kelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu Tunggu</TableHead>
                  <TableHead align="center" className="px-6">Intervensi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuckJobs.map((job) => (
                  <TableRow key={job.id_laporan}>
                    <TableCell className="px-6 font-bold text-[#0D1B2A] max-w-[240px] truncate" title={job.nama_berkas}>
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="truncate">{job.nama_berkas}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-[#0D1B2A]">
                      {job.pengunggah?.nama || 'Asisten Lab'}
                    </TableCell>
                    <TableCell className="space-y-0.5">
                      <p className="font-bold text-[#0D1B2A]">{job.prodi?.nama_prodi || 'Program Studi'}</p>
                      <p className="text-[10px] text-slate-500">Kelas: {job.kelas?.nama_kelas || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                        job.status === 'PROCESSING' 
                          ? 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/25 animate-pulse'
                          : 'text-amber-800 bg-amber-50 border-amber-200'
                      }`}>
                        <Play className="w-2.5 h-2.5 shrink-0" />
                        {job.status}
                      </span>
                    </TableCell>
                    <TableCell tabularNums className="font-bold text-rose-700">
                      {getDurationString(job.tanggal_dibuat)}
                    </TableCell>
                    <TableCell align="center" className="px-6">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleForceFail(job.id_laporan, job.nama_berkas)}
                        aria-label={`Gagalkan paksa antrean untuk ${job.nama_berkas}`}
                      >
                        Force Fail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

    </div>
  );
}
