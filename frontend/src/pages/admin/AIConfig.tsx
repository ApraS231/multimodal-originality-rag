import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Key, 
  Database, 
  Sliders, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Save, 
  BrainCircuit, 
  Terminal, 
  Check,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../../components/ui/toast-provider';
import LoadingSpinner from '../../components/ui/loading-spinner';
import ErrorState from '../../components/ui/error-state';
import PageHeader from '../../components/ui/page-header';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface SystemConfig {
  nama_model_ai: string;
  rrf_k: number;
  prompt_sistem: string;
  batas_unggahan: number;
  batas_pesan: number;
  tautan_supabase: string;
  kunci_api_gemini: string | null;
  kunci_api_openai: string | null;
  kunci_api_groq: string | null;
  kunci_api_supabase: string | null;
  kunci_kustom: Record<string, string> | null;
}

const AVAILABLE_MODELS = [
  {
    id: 'groq/llama3-8b-8192',
    name: 'Llama 3 8B',
    provider: 'Groq Cloud',
    speed: '~120 tok/s',
    tag: 'Rekomendasi Cepat',
    badgeColor: 'bg-[#415A77]/10 text-[#0D1B2A] border-[#415A77]/25',
    desc: 'Inference ultra-cepat dengan efisiensi biaya tertinggi untuk analisis rutin laporan praktikum.',
  },
  {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google AI',
    speed: '~65 tok/s',
    tag: 'Long Context (1M)',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    desc: 'Pemahaman semantik mendalam dengan jendela konteks 1 juta token untuk naskah laporan tebal.',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    speed: '~80 tok/s',
    tag: 'Frontier AI',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    desc: 'Model multimodal terdepan untuk penalaran kompleks dan klasifikasi orisinalitas presisi tinggi.',
  },
];

export default function AIConfig() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Form State
  const [modelName, setModelName] = useState('groq/llama3-8b-8192');
  const [rrfK, setRrfK] = useState(60);
  const [promptSistem, setPromptSistem] = useState('');
  const [batasUnggahan, setBatasUnggahan] = useState(30);
  const [batasPesan, setBatasPesan] = useState(50);
  const [tautanSupabase, setTautanSupabase] = useState('');

  // Keys state (untuk yang di-update)
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Custom Keys (Dinamis)
  const [customKeys, setCustomKeys] = useState<{ key: string; value: string }[]>([]);

  // Tipe penyamaran masking input sandi
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleShowKey = (name: string) => {
    setShowKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // State Fine-Tuning SBERT (Pipeline C - Domain Adaptation)
  const [ftMatkul, setFtMatkul] = useState('');
  const [ftEpochs, setFtEpochs] = useState(1);
  const [ftBatchSize, setFtBatchSize] = useState(16);
  const [lastFtResult, setLastFtResult] = useState<{ taskId?: string; message?: string; timestamp?: string } | null>(null);

  // Daftar mata kuliah untuk target fine-tuning
  const { data: daftarMatkul } = useQuery<{ id_mata_kuliah: string; nama_matkul: string }[]>({
    queryKey: ['adminMatkul'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/matkul`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Mutasi pemicuan fine-tuning model SBERT
  const fineTuneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/fine-tune`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_mata_kuliah: ftMatkul || undefined,
          epochs: String(ftEpochs),
          batchSize: String(ftBatchSize),
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memicu proses fine-tuning model.');
      }
      return data;
    },
    onSuccess: (data) => {
      setLastFtResult({
        taskId: data.taskId,
        message: data.message,
        timestamp: new Date().toLocaleTimeString('id-ID'),
      });
      toast.showToast({
        title: 'Fine-Tuning SBERT Dipicu',
        description: data.message || `Pelatihan model SBERT berjalan di latar belakang (Task ID: ${data.taskId}).`,
        variant: 'success',
      });
    },
    onError: (err: any) => {
      toast.showToast({
        title: 'Gagal Memicu Fine-Tuning',
        description: err.message || 'Terjadi kesalahan sistem saat memicu pelatihan model.',
        variant: 'error',
      });
    },
  });

  // Load konfigurasi dari API
  const { data: config, isLoading, error } = useQuery<SystemConfig>({
    queryKey: ['systemConfig'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/config`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat konfigurasi sistem.');
      return res.json();
    },
  });

  // Populate data saat fetch sukses
  useEffect(() => {
    if (config) {
      setModelName(config.nama_model_ai || 'groq/llama3-8b-8192');
      setRrfK(config.rrf_k || 60);
      setPromptSistem(config.prompt_sistem || '');
      setBatasUnggahan(config.batas_unggahan || 30);
      setBatasPesan(config.batas_pesan || 50);
      setTautanSupabase(config.tautan_supabase || '');
      
      setGeminiKey('');
      setOpenaiKey('');
      setGroqKey('');
      setSupabaseKey('');

      if (config.kunci_kustom) {
        const rows = Object.entries(config.kunci_kustom).map(([k, v]) => ({
          key: k,
          value: v,
        }));
        setCustomKeys(rows);
      } else {
        setCustomKeys([]);
      }
    }
  }, [config]);

  // Mutasi memperbarui konfigurasi
  const updateConfigMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${backendUrl}/api/admin/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan konfigurasi.');
      }
      return data;
    },
    onSuccess: () => {
      toast.showToast({
        title: 'Konfigurasi Disimpan',
        description: 'Parameter sistem, tuning algoritma RRF, dan masking API keys berhasil diperbarui.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
    },
    onError: (err: any) => {
      toast.showToast({
        title: 'Gagal Menyimpan',
        description: err.message || 'Terjadi kesalahan sistem saat memperbarui konfigurasi.',
        variant: 'error',
      });
    },
  });

  const handleAddCustomKeyRow = () => {
    setCustomKeys([...customKeys, { key: '', value: '' }]);
  };

  const handleRemoveCustomKeyRow = (index: number) => {
    const updated = customKeys.filter((_, idx) => idx !== index);
    setCustomKeys(updated);
  };

  const handleCustomKeyChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...customKeys];
    updated[index][field] = val;
    setCustomKeys(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customKeysRecord: Record<string, string> = {};
    customKeys.forEach((row) => {
      if (row.key.trim()) {
        customKeysRecord[row.key.trim()] = row.value;
      }
    });

    const payload: any = {
      nama_model_ai: modelName,
      rrf_k: Number(rrfK),
      prompt_sistem: promptSistem,
      batas_unggahan: Number(batasUnggahan),
      batas_pesan: Number(batasPesan),
      tautan_supabase: tautanSupabase,
      kunci_kustom: customKeysRecord,
    };

    if (geminiKey) payload.kunci_api_gemini = geminiKey;
    if (openaiKey) payload.kunci_api_openai = openaiKey;
    if (groqKey) payload.kunci_api_groq = groqKey;
    if (supabaseKey) payload.kunci_api_supabase = supabaseKey;

    updateConfigMutation.mutate(payload);
  };

  if (isLoading) {
    return <LoadingSpinner variant="fullpage" message="Memuat konfigurasi sistem AI..." />;
  }

  if (error) {
    return (
      <ErrorState 
        title="Gagal Memuat Konfigurasi"
        description={(error as Error)?.message || 'Terjadi kesalahan sistem saat mengambil konfigurasi AI.'}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['systemConfig'] })}
      />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Mesin AI &"
        titleAccent="Konfigurasi"
        description="Atur parameter core LLM, tuning konstanta RRF, batas kuota, masking kredensial, dan runtime sinkronisasi."
      />

      {/* KPI Summary Cards (Antislop StatCards - Clean, No SVG/Icon/Emoticon) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Model Utama LLM */}
        <StatCard
          title="Model Utama LLM"
          value={modelName.split('/')[1] || modelName}
          subtitle={`Provider: ${modelName.split('/')[0] || 'Default'}`}
          variant="default"
        />

        {/* Card 2: Konstanta RRF */}
        <StatCard
          title="Konstanta RRF (k)"
          value={rrfK}
          subtitle={`Formula: 1 / (${rrfK} + rank)`}
          variant="default"
        />

        {/* Card 3: Batas Halaman / File */}
        <StatCard
          title="Batas Halaman / File"
          value={`${batasUnggahan} Hal`}
          subtitle={`Pesan Chat: ${batasPesan}`}
          variant="default"
        />

        {/* Card 4: Keamanan Kunci API */}
        <StatCard
          title="Keamanan Kunci API"
          value="Masked"
          subtitle="Enkripsi Environment"
          variant="brass"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner variant="fullpage" message="Menyelaraskan konfigurasi global..." />
      ) : error ? (
        <div className="text-center py-20 text-rose-600 space-y-2">
          <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
          <p className="text-sm font-bold">Gagal memuat konfigurasi sistem.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* ======================================================== */}
          {/* SEKSI 1: VISUAL MODEL AI SELECTOR                        */}
          {/* ======================================================== */}
          <Card className="p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-[#0D1B2A]" />
                  Pemilihan Model Utama LLM
                </h3>
                <p className="text-slate-600 text-xs mt-0.5">Pilih model yang mengeksekusi pipeline sintesis dan analisis orisinalitas.</p>
              </div>
              <span className="text-[11px] font-mono px-3 py-1 rounded-md bg-[#0D1B2A]/5 text-[#0D1B2A] font-bold border border-[#0D1B2A]/10">
                Aktif: {modelName}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = modelName === m.id;
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setModelName(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setModelName(m.id);
                      }
                    }}
                    className={`relative p-5 rounded-lg border transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-1 ${
                      isSelected
                        ? 'border-[#D4AF37] bg-[#415A77]/10/20 ring-1 ring-[#D4AF37]/30 shadow-xs'
                        : 'border-slate-200/80 bg-slate-50/40 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {/* Top Row: Provider & Checkmark */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {m.provider}
                      </span>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-md bg-[#0D1B2A] text-[#F7F3E9] flex items-center justify-center shadow-2xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-slate-300 bg-white" />
                      )}
                    </div>

                    {/* Model Title & Tag */}
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-[#0D1B2A]">
                        {m.name}
                      </h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide inline-block ${m.badgeColor}`}>
                        {m.tag}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {m.desc}
                    </p>

                    {/* Speed indicator footer */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-600">
                      <span>Kecepatan:</span>
                      <span className="font-bold text-[#0D1B2A]">{m.speed}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ======================================================== */}
          {/* SEKSI 2: PARAMETER TUNING ALGORITMA RRF & LIMITASI       */}
          {/* ======================================================== */}
          <Card className="p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#0D1B2A]" />
                Tuning Algoritma RRF & Batasan Kuota
              </h3>
              <p className="text-slate-600 text-xs mt-0.5">Sesuaikan bobot reciprocal rank fusion dan parameter batas pemrosesan berkas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Field 1: RRF K Stepper + Range */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <Label htmlFor="rrfK" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Konstanta RRF (k)
                  </Label>
                  <span className="text-xs font-black font-mono tabular-nums px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[#0D1B2A]">
                    {rrfK}
                  </span>
                </div>
                <Input
                  id="rrfK"
                  type="number"
                  min={1}
                  max={200}
                  value={rrfK}
                  onChange={(e) => setRrfK(Number(e.target.value))}
                  className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] h-10 rounded-md text-xs font-mono"
                />
                <p className="text-[11px] text-slate-600 font-mono">
                  Default: 60. Rumus skor: RRF = 1 / (k + rank).
                </p>
              </div>

              {/* Field 2: Max Uploads */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <Label htmlFor="batasUnggahan" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Batas Dokumen / Batch
                  </Label>
                  <span className="text-xs font-black font-mono tabular-nums px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[#0D1B2A]">
                    {batasUnggahan} Dokumen
                  </span>
                </div>
                <Input
                  id="batasUnggahan"
                  type="number"
                  min={1}
                  max={100}
                  value={batasUnggahan}
                  onChange={(e) => setBatasUnggahan(Number(e.target.value))}
                  className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] h-10 rounded-md text-xs font-mono"
                />
                <p className="text-[11px] text-slate-600 font-mono">
                  Maksimal berkas per proses upload checker aslab.
                </p>
              </div>

              {/* Field 3: Max Messages */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <Label htmlFor="batasPesan" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Batas Dialog Copilot
                  </Label>
                  <span className="text-xs font-black font-mono tabular-nums px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[#0D1B2A]">
                    {batasPesan} Pesan
                  </span>
                </div>
                <Input
                  id="batasPesan"
                  type="number"
                  min={5}
                  max={100}
                  value={batasPesan}
                  onChange={(e) => setBatasPesan(Number(e.target.value))}
                  className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] h-10 rounded-md text-xs font-mono"
                />
                <p className="text-[11px] text-slate-600 font-mono">
                  Batas riwayat chat yang diumpankan ke prompt AI.
                </p>
              </div>
            </div>

            {/* System Prompt Code Box (Clean, without fake macOS traffic lights) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="promptSistem" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-600" />
                  System Prompt Instruksi Inti
                </Label>
                <span className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {promptSistem.length} Karakter
                </span>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 text-slate-100 p-4 font-mono text-xs shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-slate-300">system_instructions.md</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Markdown</span>
                </div>
                <textarea
                  id="promptSistem"
                  rows={6}
                  value={promptSistem}
                  onChange={(e) => setPromptSistem(e.target.value)}
                  className="w-full bg-transparent text-[#D4AF37] focus:outline-none leading-relaxed resize-y font-mono text-xs custom-scrollbar focus-visible:ring-1 focus-visible:ring-[#D4AF37] rounded p-1"
                  placeholder="Masukkan instruksi aturan verifikasi keaslian..."
                  required
                />
              </div>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* SEKSI 3: ADAPTASI DOMAIN & FINE-TUNING SBERT (PIPELINE C)*/}
          {/* ======================================================== */}
          <Card className="p-6 shadow-xs space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#0D1B2A]" />
                  Adaptasi Domain & Fine-Tuning SBERT (Pipeline C)
                </h3>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                  Latih ulang representasi semantik Sentence-BERT menggunakan naskah terverifikasi (skor orisinalitas &gt; 75%) dan korpus seeding untuk mitigasi pergeseran domain (<em className="italic text-slate-700">semantic drift</em>).
                </p>
              </div>
              <span className="text-[11px] font-mono px-3 py-1 rounded-md bg-[#415A77]/10 text-[#0D1B2A] font-bold border border-[#415A77]/25 shrink-0">
                Arsitektur: SimCSE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Field 1: Target Mata Kuliah */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-2">
                <Label htmlFor="ftMatkul" className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Target Mata Kuliah
                </Label>
                <select
                  id="ftMatkul"
                  value={ftMatkul}
                  onChange={(e) => setFtMatkul(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 text-[#0D1B2A] rounded-md text-xs focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] cursor-pointer"
                >
                  <option value="">Semua Mata Kuliah (Global Adaptation)</option>
                  {daftarMatkul?.map((mk) => (
                    <option key={mk.id_mata_kuliah} value={mk.id_mata_kuliah}>
                      {mk.nama_matkul}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-600 font-mono">
                  Membatasi korpus naskah spesifik mata kuliah atau melatih model global.
                </p>
              </div>

              {/* Field 2: Epochs */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="ftEpochs" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Jumlah Epoch
                  </Label>
                  <span className="text-xs font-black font-mono tabular-nums px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[#0D1B2A]">
                    {ftEpochs} Epoch
                  </span>
                </div>
                <Input
                  id="ftEpochs"
                  type="number"
                  min={1}
                  max={5}
                  value={ftEpochs}
                  onChange={(e) => setFtEpochs(Math.max(1, Math.min(5, Number(e.target.value))))}
                  className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] h-10 rounded-md text-xs font-mono"
                />
                <p className="text-[11px] text-slate-600 font-mono">
                  Rekomendasi 1 epoch untuk adaptasi representasi tanpa overfitting.
                </p>
              </div>

              {/* Field 3: Batch Size */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="ftBatchSize" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Ukuran Batch
                  </Label>
                  <span className="text-xs font-black font-mono tabular-nums px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[#0D1B2A]">
                    {ftBatchSize} Sampel
                  </span>
                </div>
                <Input
                  id="ftBatchSize"
                  type="number"
                  min={2}
                  max={32}
                  step={2}
                  value={ftBatchSize}
                  onChange={(e) => setFtBatchSize(Math.max(2, Math.min(32, Number(e.target.value))))}
                  className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] h-10 rounded-md text-xs font-mono"
                />
                <p className="text-[11px] text-slate-600 font-mono">
                  Ukuran batch untuk MultipleNegativesRankingLoss unsupervised.
                </p>
              </div>
            </div>

            {/* Catatan Teknis Drift Protection */}
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-[#0D1B2A] block">
                Mekanisme Perlindungan Drift (<em className="italic font-semibold text-slate-700">Drift Protection</em>) &amp; <em className="italic font-semibold text-slate-700">Hot-Swapping</em>:
              </span>
              <p className="leading-relaxed">
                Sistem secara otomatis menyaring naskah dengan kriteria{' '}
                <span className="font-mono font-bold text-[#0D1B2A] bg-[#415A77]/10 px-1.5 py-0.5 rounded border border-[#415A77]/25 text-[11px]">
                  skor orisinalitas &gt; 75.0%
                </span>{' '}
                dan status terverifikasi kepala lab untuk mengeliminasi risiko{' '}
                <em className="italic text-slate-800">data poisoning</em>. Bobot hasil pelatihan disimpan di direktori model lokal dan langsung dimuat ke memori aktif (<em className="italic text-slate-800">hot-swapping</em>) tanpa memerlukan penghentian layanan.
              </p>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200/80">
              {lastFtResult ? (
                <div className="flex items-center gap-2 text-xs font-mono text-[#0D1B2A] bg-[#415A77]/10 px-3 py-1.5 rounded-md border border-[#415A77]/25">
                  <Check className="w-4 h-4 text-[#8C6D1F] shrink-0" />
                  <span>Selesai dipicu pukul {lastFtResult.timestamp} (Task ID: {lastFtResult.taskId})</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-mono">
                  Status Model: Aktif &amp; Siap Menerima Pelatihan Ulang
                </span>
              )}

              <button
                type="button"
                onClick={() => fineTuneMutation.mutate()}
                disabled={fineTuneMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white text-xs font-bold uppercase tracking-wider rounded-md transition-colors shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${fineTuneMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{fineTuneMutation.isPending ? 'Memproses Pelatihan...' : 'Mulai Pelatihan Model SBERT'}</span>
              </button>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* SEKSI 4: KREDENSIAL API KEYS DENGAN MASKING ELEGAN       */}
          {/* ======================================================== */}
          <Card className="p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <Key className="w-5 h-5 text-[#0D1B2A]" />
                Kredensial API & Masking Provider AI
              </h3>
              <p className="text-slate-600 text-xs mt-0.5">
                Kunci disimpan terenkripsi di server. Kosongkan isian jika tidak ingin mengubah kunci tersimpan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Provider 1: Gemini */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Google Gemini API
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    config?.kunci_api_gemini ? 'bg-[#415A77]/10 text-[#0D1B2A]' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {config?.kunci_api_gemini ? 'TERKONFIGURASI' : 'KOSONG'}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showKeys['gemini'] ? 'text' : 'password'}
                    placeholder="Masukkan Gemini API Key baru..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showKeys['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Provider 2: OpenAI */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    OpenAI API
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    config?.kunci_api_openai ? 'bg-[#415A77]/10 text-[#0D1B2A]' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {config?.kunci_api_openai ? 'TERKONFIGURASI' : 'KOSONG'}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showKeys['openai'] ? 'text' : 'password'}
                    placeholder="Masukkan OpenAI API Key baru..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showKeys['openai'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Provider 3: Groq */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Groq Cloud API
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    config?.kunci_api_groq ? 'bg-[#415A77]/10 text-[#0D1B2A]' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {config?.kunci_api_groq ? 'TERKONFIGURASI' : 'KOSONG'}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showKeys['groq'] ? 'text' : 'password'}
                    placeholder="Masukkan Groq API Key baru..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('groq')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showKeys['groq'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Supabase Service Role Integration */}
            <div className="pt-2 border-t border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0D1B2A]" />
                <h4 className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider">
                  Kredensial Supabase pgvector
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tautanSupabase" className="text-xs font-semibold text-slate-700">
                    Endpoint URL Supabase
                  </Label>
                  <Input
                    id="tautanSupabase"
                    placeholder="https://xyzcompany.supabase.co"
                    value={tautanSupabase}
                    onChange={(e) => setTautanSupabase(e.target.value)}
                    className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supabaseKey" className="text-xs font-semibold text-slate-700">
                    Service Role Key / Anon Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="supabaseKey"
                      type={showKeys['supabase'] ? 'text' : 'password'}
                      placeholder="Masukkan token Supabase baru..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('supabase')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showKeys['supabase'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* SEKSI 6: PARAMETER KUSTOM TAMBAHAN (DYNAMIC KEY-VALUE)   */}
          {/* ======================================================== */}
          <Card className="p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#0D1B2A]" />
                  Parameter Kustom Ekstra (Environment)
                </h3>
                <p className="text-slate-600 text-xs mt-0.5">Pasangan kunci-nilai fleksibel untuk kebutuhan integrasi pihak ketiga atau flag eksperimen.</p>
              </div>

              <button
                type="button"
                onClick={handleAddCustomKeyRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0D1B2A] rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="space-y-3">
              {customKeys.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-300 rounded-lg bg-slate-50/50 space-y-1">
                  <p className="text-xs text-slate-700 font-bold">Belum ada parameter kustom tambahan</p>
                  <p className="text-[11px] text-slate-500">Gunakan tombol "Tambah Baris" untuk menyisipkan variabel environment khusus.</p>
                </div>
              ) : (
                customKeys.map((row, idx) => (
                  <div key={idx} className="flex gap-3 items-center p-3 rounded-lg bg-slate-50/60 border border-slate-200/80">
                    <div className="flex-1">
                      <Input
                        placeholder="Nama Variabel (Contoh: SUPABASE_VECTOR_TABLE)"
                        value={row.key}
                        onChange={(e) => handleCustomKeyChange(idx, 'key', e.target.value)}
                        className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Nilai Variabel (Contoh: public.laporan_text_vectors)"
                        value={row.value}
                        onChange={(e) => handleCustomKeyChange(idx, 'value', e.target.value)}
                        className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-all h-10 rounded-md text-xs font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomKeyRow(idx)}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md border border-rose-200 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                      title="Hapus Parameter"
                      aria-label="Hapus Parameter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* ======================================================== */}
          {/* STICKY ACTION BAR SIMPAN                                 */}
          {/* ======================================================== */}
          <div className="sticky bottom-6 z-30 p-4 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
              <span className="text-xs text-[#0D1B2A] font-semibold">
                Perubahan tersimpan secara instan di runtime server.
              </span>
            </div>

            <Button
              type="submit"
              variant="default"
              size="default"
              disabled={updateConfigMutation.isPending}
              className="flex items-center gap-2 text-xs font-semibold"
            >
              <Save className="w-4 h-4" />
              <span>{updateConfigMutation.isPending ? 'Menyinkronkan...' : 'Simpan Semua Konfigurasi'}</span>
            </Button>
          </div>

        </form>
      )}
    </div>
  );
}
