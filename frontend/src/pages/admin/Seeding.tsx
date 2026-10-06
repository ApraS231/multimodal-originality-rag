import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useProdi, useKelas, useMatkul } from '../../api/admin';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Database, Terminal as TerminalIcon, Play, RefreshCw, CheckCircle2, SlidersHorizontal, Copy, Check } from 'lucide-react';
import PageHeader from '../../components/ui/page-header';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/toast-provider';

interface SeedingPayload {
  queryKeywords: string[];
  id_program_studi: string;
  id_kelas: string;
  id_mata_kuliah: string;
  tahun_akademik: string;
}

export default function Seeding() {
  const { data: prodiList } = useProdi();
  const { data: kelasList } = useKelas();
  const { data: matkulList } = useMatkul();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  const [keywords, setKeywords] = useState('');
  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [selectedMatkulId, setSelectedMatkulId] = useState('');
  const [tahunAkademik, setTahunAkademik] = useState(new Date().getFullYear().toString());

  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [seedingStatus, setSeedingStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const { success: showSuccessToast } = useToast();

  const terminalRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleCopyLogs = () => {
    if (logs.length > 0) {
      navigator.clipboard.writeText(logs.join('\n'));
      setCopied(true);
      showSuccessToast('Log Disalin', 'Seluruh riwayat log aktivitas agen berhasil disalin ke papan klip.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Auto-scroll internal terminal log tanpa menggeser viewport browser
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Clean-up EventSource saat unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const seedingMutation = useMutation({
    mutationFn: async (payload: SeedingPayload) => {
      const res = await fetch(`${backendUrl}/api/seeding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memicu pipa seeding cloud.');
      }
      return data; // { success: true, taskId: "..." }
    },
    onSuccess: (data) => {
      const tid = data.taskId;
      setTaskId(tid);
      setSeedingStatus('processing');
      setProgress(0);
      setLogs(['[Sistem] Menghubungkan ke pipa scraping AI service...']);
      setErrorMsg('');

      // Memulai koneksi SSE (Server-Sent Events)
      const source = new EventSource(`${backendUrl}/api/scrape/stream/${tid}`);
      eventSourceRef.current = source;

      source.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          
          if (update.new_logs && Array.isArray(update.new_logs) && update.new_logs.length > 0) {
            setLogs((prev) => {
              const existingSet = new Set(prev);
              const toAdd = update.new_logs.filter((l: string) => !existingSet.has(l));
              return [...prev, ...toAdd];
            });
          } else if (update.message) {
            setLogs((prev) => {
              if (prev.length > 0 && prev[prev.length - 1] === update.message) return prev;
              return [...prev, update.message];
            });
          }

          if (update.progress !== undefined) {
            setProgress(update.progress);
          } else if (update.downloaded && update.total) {
            const calculatedProgress = Math.round((update.downloaded / update.total) * 100);
            setProgress(calculatedProgress);
          }

          if (update.status === 'completed') {
            setSeedingStatus('completed');
            source.close();
          }

          if (update.status === 'failed') {
            setSeedingStatus('failed');
            setLogs((prev) => [...prev, `[Error] ${update.message || 'Proses seeding gagal.'}`]);
            source.close();
          }
        } catch (err) {
          console.error('Gagal memproses SSE:', err);
          setLogs((prev) => [...prev, event.data]);
        }
      };

      source.onerror = () => {
        // Abaikan jika EventSource sedang dalam proses penyambungan ulang otomatis
        if (source.readyState === EventSource.CONNECTING) {
          return;
        }

        // Cek status terkini ke server melalui polling REST API
        fetch(`${backendUrl}/api/scrape/status/${tid}`)
          .then((r) => r.json())
          .then((statusData) => {
            if (statusData && (statusData.status === 'processing' || statusData.status === 'completed')) {
              if (statusData.message) {
                setLogs((prev) => [...prev, `[Progres] ${statusData.message}`]);
              }
              if (statusData.progress !== undefined) {
                setProgress(statusData.progress);
              }
              if (statusData.status === 'completed') {
                setSeedingStatus('completed');
                setLogs((prev) => [...prev, '[Sistem] Ingesti data dan vektorisasi selesai dengan sukses.']);
                source.close();
              }
              return;
            }

            setSeedingStatus('failed');
            setErrorMsg(statusData?.message || 'Sambungan SSE ke server progress terputus.');
            setLogs((prev) => [
              ...prev, 
              '[Error] Sambungan ke server progress terputus.',
              '[Sistem] Pastikan AI Service (FastAPI) aktif dan responsif.'
            ]);
            source.close();
          })
          .catch(() => {
            setSeedingStatus('failed');
            setErrorMsg('Sambungan SSE ke server progress terputus.');
            setLogs((prev) => [
              ...prev, 
              '[Error] Sambungan ke server progress terputus.',
              '[Sistem] Pastikan AI Service (FastAPI) aktif dan responsif.'
            ]);
            source.close();
          });
      };
    },
    onError: (err: any) => {
      setSeedingStatus('failed');
      const msg = err.message || 'Gagal memulai penyerapan cloud.';
      setErrorMsg(msg);
      setLogs([
        '[Sistem] Memulai koneksi ke pipa penyerapan cloud...',
        `[Error] ${msg}`,
        '[Sistem] Pastikan AI Service (FastAPI) aktif dan backend dapat terhubung.'
      ]);
    },
  });

  // Polling fallback sinkronisasi status setiap 2 detik saat status processing
  useEffect(() => {
    if (seedingStatus !== 'processing' || !taskId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/scrape/status/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.status) {
          if (data.progress !== undefined) {
            setProgress((prev) => Math.max(prev, data.progress));
          }
          if (data.new_logs && Array.isArray(data.new_logs) && data.new_logs.length > 0) {
            setLogs((prev) => {
              const existingSet = new Set(prev);
              const toAdd = data.new_logs.filter((l: string) => !existingSet.has(l));
              return [...prev, ...toAdd];
            });
          } else if (data.message) {
            setLogs((prev) => {
              const last = prev[prev.length - 1];
              if (last !== data.message) {
                return [...prev, data.message];
              }
              return prev;
            });
          }
          if (data.status === 'completed') {
            setSeedingStatus('completed');
            if (eventSourceRef.current) eventSourceRef.current.close();
          } else if (data.status === 'failed') {
            setSeedingStatus('failed');
            setLogs((prev) => [...prev, `[Error] ${data.message || 'Proses seeding gagal.'}`]);
            if (eventSourceRef.current) eventSourceRef.current.close();
          }
        }
      } catch {
        // Abaikan galat polling sementara
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [seedingStatus, taskId, backendUrl]);

  const fineTuneMutation = useMutation({
    mutationFn: async (id_mata_kuliah?: string) => {
      const res = await fetch(`${backendUrl}/api/fine-tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id_mata_kuliah ? { id_mata_kuliah } : {}),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menjalankan fine-tuning model SBERT.');
      return data;
    },
    onSuccess: (data) => {
      setLogs((prev) => [...prev, `[Sistem] ${data.message || 'Fine-tuning SBERT berhasil diselesaikan.'}`]);
    },
    onError: (err: any) => {
      setLogs((prev) => [...prev, `[Error] ${err.message || 'Gagal memicu fine-tuning.'}`]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) {
      setErrorMsg('Tautan Google Drive / Kata kunci scraping wajib diisi.');
      return;
    }
    if (!selectedProdiId || !selectedKelasId || !selectedMatkulId || !tahunAkademik) {
      setErrorMsg('Semua kolom metadata akademik wajib dipilih.');
      return;
    }

    const queryKeywords = keywords.split(',').map((k) => k.trim()).filter((k) => k !== '');

    seedingMutation.mutate({
      queryKeywords,
      id_program_studi: selectedProdiId,
      id_kelas: selectedKelasId,
      id_mata_kuliah: selectedMatkulId,
      tahun_akademik: tahunAkademik,
    });
  };

  const handleResetLogs = () => {
    setSeedingStatus('idle');
    setTaskId(null);
    setProgress(0);
    setLogs([]);
    setErrorMsg('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Cloud"
        titleAccent="Seeding"
        description="Penyerapan modul master dan naskah praktikum terdahulu dari cloud untuk melatih database vektor (Supabase pgvector)."
      />

      {/* KPI Bento Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Pipa Ingesti AI"
          value="Cloud Pipeline"
          subtitle="Penyelarasan SSE Otomatis"
          variant="default"
        />
        <StatCard
          title="Database Vektor"
          value="pgvector"
          subtitle="Embedding 1536-dimensi"
          variant="navy"
        />
        <StatCard
          title="Kesiapan Ekstraksi"
          value="Dual Engine"
          subtitle="PyMuPDF + OCR Tesseract"
          variant="brass"
        />
      </div>

      {/* Main Dual-Panel Layout: Form (Left) & Realtime Monitor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Panel Kiri: Form Metadata & Asosiasi (Selalu Persisten) */}
        <div className="lg:col-span-5">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#0D1B2A]" />
                    Formulir Metadata Ingesti
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">Asosiasikan dokumen dengan struktur kurikulum.</p>
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                  Config
                </span>
              </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-fade-in flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Field Asosiasi Akademik */}
            <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">1</span>
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Asosiasi Akademik</h3>
              </div>

              {/* Prodi Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="prodi" className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">Program Studi *</Label>
                <select
                  id="prodi"
                  value={selectedProdiId}
                  onChange={(e) => {
                    setSelectedProdiId(e.target.value);
                    setSelectedKelasId('');
                  }}
                  disabled={seedingMutation.isPending}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all focus:outline-none disabled:opacity-60"
                  required
                >
                  <option value="" className="text-slate-400">Pilih Program Studi...</option>
                  {prodiList?.map((prodi) => (
                    <option key={prodi.id_program_studi} value={prodi.id_program_studi} className="text-slate-900">
                      {prodi.nama_prodi}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kelas Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="kelas" className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">Kelas *</Label>
                <select
                  id="kelas"
                  value={selectedKelasId}
                  onChange={(e) => setSelectedKelasId(e.target.value)}
                  disabled={!selectedProdiId || seedingMutation.isPending}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all focus:outline-none disabled:opacity-50"
                  required
                >
                  <option value="" className="text-slate-400">Pilih Kelas...</option>
                  {kelasList
                    ?.filter((k) => k.id_program_studi === selectedProdiId)
                    .map((kelas) => (
                      <option key={kelas.id_kelas} value={kelas.id_kelas} className="text-slate-900">
                        {kelas.nama_kelas}
                      </option>
                    ))}
                </select>
              </div>

              {/* Matkul Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="matkul" className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">Mata Kuliah *</Label>
                <select
                  id="matkul"
                  value={selectedMatkulId}
                  onChange={(e) => setSelectedMatkulId(e.target.value)}
                  disabled={seedingMutation.isPending}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all focus:outline-none disabled:opacity-60"
                  required
                >
                  <option value="" className="text-slate-400">Pilih Mata Kuliah...</option>
                  {matkulList?.map((matkul) => (
                    <option key={matkul.id_mata_kuliah} value={matkul.id_mata_kuliah} className="text-slate-900">
                      {matkul.nama_matkul}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahun Akademik */}
              <div className="space-y-1">
                <Label htmlFor="tahun" className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">Tahun Akademik *</Label>
                <Input
                  id="tahun"
                  type="number"
                  value={tahunAkademik}
                  onChange={(e) => setTahunAkademik(e.target.value)}
                  disabled={seedingMutation.isPending}
                  className="bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all h-10 rounded-md text-xs font-mono disabled:opacity-60"
                  required
                />
              </div>
            </div>

            {/* Field Sumber Google Drive */}
            <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">2</span>
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Tautan Google Drive Folder</h3>
                </div>
              </div>

              <Input
                id="keywords"
                type="text"
                placeholder="https://drive.google.com/drive/folders/1ABC..."
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={seedingMutation.isPending}
                className="bg-slate-50/60 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all h-10 rounded-md text-xs font-mono disabled:opacity-60"
                required
              />
              <p className="text-[11px] text-slate-500 leading-normal">
                Sistem otomatis memfilter & mengunduh naskah PDF secara efisien tanpa mendownload beban file biner raksasa.
              </p>
            </div>

            {/* Tombol Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="default"
                size="lg"
                disabled={seedingMutation.isPending}
                loading={seedingMutation.isPending}
                className="w-full gap-2 font-mono uppercase tracking-wider text-xs"
              >
                <Play className="w-4 h-4" />
                <span>Mulai Pipa Cloud Seeding</span>
              </Button>
            </div>
          </form>
          </Card>
        </div>

        {/* Panel Kanan: Live Monitor & Scraper Console Logs (Selalu Tampak) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="space-y-4 p-6 bg-white border border-slate-200/80">
            {/* Header Status Monitor */}
            <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0D1B2A]">
                  Status Ingesti:
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  seedingStatus === 'idle'
                    ? 'bg-slate-100 text-slate-600'
                    : seedingStatus === 'processing'
                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                    : seedingStatus === 'completed'
                    ? 'bg-[#415A77]/15 text-[#0D1B2A]'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {seedingStatus === 'idle' && 'Standby (Siap Memulai)'}
                  {seedingStatus === 'processing' && 'Sedang Menyerap Berkas...'}
                  {seedingStatus === 'completed' && 'Ingesti Berhasil'}
                  {seedingStatus === 'failed' && 'Penyerapan Gagal'}
                </span>
              </div>
              <span className="text-[#0D1B2A] font-mono font-bold text-lg">{progress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-[1px]">
              <div
                className="h-full bg-gradient-to-r from-[#0D1B2A] to-[#D4AF37] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Terminal Window */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <TerminalIcon className="w-3.5 h-3.5 text-slate-500" />
                  Terminal Log Real-Time {taskId ? `(ID: ${taskId.slice(0, 8)}...)` : ''}
                </span>
                <div className="flex items-center gap-2">
                  {logs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyLogs}
                      className="text-[10px] text-slate-400 hover:text-[#D4AF37] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Salin semua log aktivitas"
                    >
                      {copied ? <Check className="w-3 h-3 text-[#D4AF37]" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Tersalin' : 'Salin Log'}</span>
                    </button>
                  )}
                  {logs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetLogs}
                      className="text-[10px] text-slate-400 hover:text-rose-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Bersihkan</span>
                    </button>
                  )}
                </div>
              </div>

              <div 
                ref={terminalRef}
                className="w-full h-80 bg-[#0D1B2A] border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-y-auto space-y-1.5 shadow-inner text-slate-100 select-text"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                    <TerminalIcon className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                    <p className="text-xs text-slate-400 font-sans max-w-sm">
                      Terminal siap menerima pipa ingesti. Pilih metadata di sebelah kiri dan klik <strong className="text-slate-300 font-semibold">Mulai Pipa Cloud Seeding</strong>.
                    </p>
                  </div>
                ) : (
                  logs.map((log, index) => {
                    const match = log.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*(\[[^\]]+\])\s*(.*)$/);
                    if (match) {
                      const timeStr = match[1];
                      const tagStr = match[2];
                      const textStr = match[3];

                      let badgeClass = 'bg-slate-800/90 text-slate-300 border-slate-700/80';
                      if (tagStr.includes('Cloud Scout')) {
                        badgeClass = 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60';
                      } else if (tagStr.includes('Perception')) {
                        badgeClass = 'bg-[#0D1B2A] text-[#F7F3E9] border-[#D4AF37]/60';
                      } else if (tagStr.includes('Triage')) {
                        badgeClass = 'bg-purple-950/80 text-purple-300 border-purple-700/60';
                      } else if (tagStr.includes('Vector Ingestion') || tagStr.includes('Vector')) {
                        badgeClass = 'bg-amber-950/80 text-amber-300 border-amber-700/60';
                      } else if (tagStr.includes('Adaptation')) {
                        badgeClass = 'bg-sky-950/80 text-sky-300 border-sky-700/60';
                      } else if (tagStr.includes('Supervisor')) {
                        badgeClass = 'bg-[#0D1B2A] text-[#F7F3E9] border-[#D4AF37]/60';
                      } else if (tagStr.includes('Error')) {
                        badgeClass = 'bg-rose-950/80 text-rose-300 border-rose-700/60 font-bold';
                      }

                      return (
                        <div key={index} className="flex items-start gap-2 leading-relaxed text-[11px] py-0.5 border-b border-slate-800/40 last:border-0">
                          <span className="text-slate-500 font-mono text-[10px] shrink-0 select-none">{timeStr}</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold font-mono shrink-0 select-none ${badgeClass}`}>
                            {tagStr.replace(/^\[|\]$/g, '')}
                          </span>
                          <span className="text-slate-200 font-sans break-words">{textStr}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={index}
                        className={`leading-relaxed text-[11px] ${
                          log.startsWith('[Error]')
                            ? 'text-rose-400 font-bold'
                            : log.startsWith('[Sistem]')
                            ? 'text-amber-400 font-bold'
                            : 'text-slate-300'
                        }`}
                      >
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Ringkasan Sukses Setelah Seeding */}
            {seedingStatus === 'completed' && (
              <div className="p-4 rounded-xl bg-[#415A77]/10/90 border border-[#415A77]/25 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#0D1B2A]">
                      Ringkasan Ingesti Cloud Berhasil
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#415A77]/15 text-[#0D1B2A] px-2 py-0.5 rounded-full">
                    Selesai
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 bg-white/90 rounded-lg border border-[#415A77]/20">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Asosiasi Matkul</span>
                    <span className="text-xs font-bold text-[#0D1B2A] truncate block mt-0.5">
                      {matkulList?.find((m) => m.id_mata_kuliah === selectedMatkulId)?.nama_matkul || 'Terkait'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/90 rounded-lg border border-[#415A77]/20">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Database Vektor</span>
                    <span className="text-xs font-bold text-[#0D1B2A] flex items-center gap-1 mt-0.5">
                      <Database className="w-3 h-3" />
                      <span>Supabase pgvector</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/90 rounded-lg border border-[#415A77]/20">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Model SBERT</span>
                    <span className="text-xs font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Terlatih Ulang</span>
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => fineTuneMutation.mutate(selectedMatkulId)}
                    disabled={fineTuneMutation.isPending}
                    className="flex items-center gap-2 text-xs font-semibold"
                  >
                    <SlidersHorizontal className={`w-3.5 h-3.5 ${fineTuneMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>{fineTuneMutation.isPending ? 'Melatih SBERT...' : 'Latih Ulang SBERT Mandiri'}</span>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
