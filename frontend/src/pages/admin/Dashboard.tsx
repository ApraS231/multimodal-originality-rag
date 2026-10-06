import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText, 
  Search, 
  Bot, 
  User, 
  Send,
  Activity, 
  ShieldAlert,
  TrendingUp,
  ArrowRight,
  GraduationCap,
  BookOpen,
  Compass,
  BrainCircuit,
  Layers,
  Plus,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Users as UsersIcon
} from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';
import PageHeader from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SegmentedControl } from '../../components/ui/grouped-list';
import MarkdownView from '../../components/ui/markdown-view';
import MascotAvatar from '../../components/mascot-avatar';

interface NavItem {
  id: string;
  name: string;
  type: 'prodi' | 'matkul' | 'kelas' | 'laporan';
  children?: NavItem[];
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  skor_orisinalitas?: number;
  nim?: string;
}

interface AnalyticsSummary {
  token_input: number;
  token_output: number;
  total_token: number;
  estimasi_biaya: number | string;
  total_laporan_dianalisis: number;
}

interface AnalyticsResponse {
  summary: AnalyticsSummary;
  prodi_cost: Array<{
    id_program_studi: string;
    nama_prodi: string;
    total_biaya: number | string;
  }>;
  daily_cost_trend: Array<{
    name: string;
    Biaya: number;
  }>;
}

interface LaporanTerbaru {
  id_laporan: string;
  nama_mahasiswa: string;
  nim: string;
  nama_prodi: string;
  nama_kelas: string;
  nama_matkul: string;
  skor_orisinalitas: number;
  tanggal_diunggah: string;
}

interface ReportsAnalyticsResponse {
  totalLaporan: number;
  rataSkor: number;
  totalPlagiat: number;
  totalAslab: number;
  prodiStats: Array<{
    id_program_studi: string;
    nama_prodi: string;
    rata_skor: number;
    total_laporan: number;
  }>;
  laporansTerbaru: LaporanTerbaru[];
}

interface ProgramStudiItem {
  id_program_studi: string;
  nama_prodi: string;
}

interface ChatMessage {
  id_pesan_obrolan: string;
  pengirim: 'USER' | 'AI';
  teks: string;
  tanggal_dibuat: string;
}

interface ChatSession {
  id_sesi_obrolan: string;
  judul_sesi: string;
  id_laporan: string | null;
  pesan_obrolan: ChatMessage[];
}

// Komponen pohon direktori rekursif
function GlobalDirectoryNode({ item, depth, searchTerm, onSelectLaporan }: {
  item: NavItem;
  depth: number;
  searchTerm: string;
  onSelectLaporan: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren = item.children && item.children.length > 0;

  const matchesSearch = (node: NavItem): boolean => {
    if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
    if (node.nim && node.nim.includes(searchTerm)) return true;
    if (node.children) {
      return node.children.some(child => matchesSearch(child));
    }
    return false;
  };

  if (searchTerm && !matchesSearch(item)) return null;

  const toggleOpen = () => {
    if (hasChildren) setIsOpen(!isOpen);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/25';
      case 'PROCESSING':
        return 'text-amber-700 bg-amber-50 border-amber-200 animate-pulse';
      case 'QUEUED':
        return 'text-slate-600 bg-slate-100 border-slate-200';
      case 'FAILED':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return 'text-slate-400 bg-slate-50 border-slate-200';
    }
  };

  const indentPadding = depth === 0 
    ? 'pl-0.5' 
    : depth === 1 
    ? 'pl-1.5 sm:pl-5 border-l border-slate-200 ml-1 sm:ml-3.5' 
    : 'pl-1.5 sm:pl-5 border-l border-slate-200 ml-1 sm:ml-4';

  return (
    <div className={`space-y-0.5 sm:space-y-1 ${indentPadding} transition-all w-full`}>
      <div 
        role="button"
        tabIndex={0}
        onClick={hasChildren ? toggleOpen : (item.type === 'laporan' ? () => onSelectLaporan(item.id) : undefined)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (hasChildren) toggleOpen();
            else if (item.type === 'laporan') onSelectLaporan(item.id);
          }
        }}
        className={`flex items-center justify-between p-2 sm:p-2.5 rounded-md transition-all select-none w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
          hasChildren 
            ? 'hover:bg-slate-100/70 cursor-pointer text-[#0D1B2A] font-semibold border border-transparent hover:border-slate-300' 
            : item.type === 'laporan'
            ? 'hover:bg-[#0D1B2A]/5 cursor-pointer text-[#0D1B2A] border border-transparent hover:border-slate-300 bg-white/50' 
            : 'text-slate-600 text-xs'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          {hasChildren ? (
            isOpen ? (
              <FolderOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#0D1B2A] shrink-0" />
            ) : (
              <Folder className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-600 shrink-0" />
            )
          ) : item.type === 'prodi' ? (
            <GraduationCap className="w-4 h-4 text-[#0D1B2A] shrink-0" />
          ) : item.type === 'matkul' ? (
            <BookOpen className="w-4 h-4 text-slate-700 shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          )}

          {item.type === 'laporan' ? (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-[#0D1B2A] truncate text-xs hover:text-[#0D1B2A] transition-colors">{item.name}</span>
              {item.nim && <span className="text-[10px] text-slate-600 font-mono">NIM: {item.nim}</span>}
            </div>
          ) : (
            <span className="truncate text-xs font-bold">{item.name}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          {item.type === 'laporan' && item.skor_orisinalitas !== undefined && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onSelectLaporan(item.id);
              }}
              className={`text-[10px] font-mono tabular-nums font-bold px-1.5 sm:px-2 py-0.5 rounded border shadow-2xs transition-all hover:scale-105 cursor-pointer ${
                item.skor_orisinalitas < 40 
                  ? 'bg-rose-50 border-rose-200 text-rose-700' 
                  : item.skor_orisinalitas < 75
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-[#415A77]/10 border-[#415A77]/25 text-[#0D1B2A]'
              }`}
            >
              {item.skor_orisinalitas}%
            </span>
          )}

          {item.type === 'laporan' && item.status && (
            <span className={`text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md border ${getStatusColor(item.status)}`}>
              {item.status}
            </span>
          )}

          {hasChildren && item.children && (
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 hidden sm:inline-block">
              {item.children.length}
            </span>
          )}

          {hasChildren && (
            isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          )}
        </div>
      </div>

      {hasChildren && isOpen && item.children && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <GlobalDirectoryNode 
              key={child.id} 
              item={child} 
              depth={depth + 1} 
              searchTerm={searchTerm} 
              onSelectLaporan={onSelectLaporan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Navigation tab state: 'overview' | 'directory' | 'chatbot'
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'directory' | 'chatbot'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 1. Ambil data analitik admin (biaya & token)
  const { data: analytics, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery<AnalyticsResponse>({
    queryKey: ['adminAnalytics'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/analytics`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat data analitik.');
      return res.json();
    },
    refetchInterval: 25000,
  });

  // 2. Ambil data analitik laporan kampus (rekapitulasi skor, prodi, dan laporan terbaru)
  const { data: reportsAnalytics, isLoading: isLoadingReportsAnalytics, refetch: refetchReportsAnalytics } = useQuery<ReportsAnalyticsResponse>({
    queryKey: ['adminReportsAnalytics'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/reports/analytics`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat analitik laporan.');
      return res.json();
    },
    refetchInterval: 25000,
  });

  // 3. Ambil daftar master Program Studi
  const { data: prodiList } = useQuery<ProgramStudiItem[]>({
    queryKey: ['adminProdiListDashboard'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/prodi`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 4. Ambil data pohon direktori global
  const { data: navData, isLoading: isLoadingNav, refetch: refetchNav } = useQuery<NavItem[]>({
    queryKey: ['adminNav'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/reports/nav`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat navigasi direktori');
      return res.json();
    },
    refetchInterval: 25000,
  });

  // 5. Ambil data sesi obrolan chatbot admin
  const { data: chatSessions } = useQuery<ChatSession[]>({
    queryKey: ['adminChatSessions'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/chatbot/sessions`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat sesi obrolan.');
      return res.json();
    },
    enabled: activeMainTab === 'chatbot',
  });

  // 6. Ambil detail pesan obrolan jika ada sesi aktif
  const { data: activeSession, isLoading: isLoadingMessages } = useQuery<ChatSession>({
    queryKey: ['adminSessionMessages', activeChatSessionId],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/chatbot/sessions/${activeChatSessionId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat pesan obrolan.');
      return res.json();
    },
    enabled: !!activeChatSessionId && activeMainTab === 'chatbot',
  });

  // Mutasi sesi obrolan baru
  const createChatSession = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${backendUrl}/api/chatbot/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul_sesi: 'Konsultasi Eksekutif Integritas',
          id_laporan: null,
        }),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Gagal membuat sesi obrolan baru.');
      return res.json();
    },
    onSuccess: (data) => {
      setActiveChatSessionId(data.id_sesi_obrolan);
      queryClient.invalidateQueries({ queryKey: ['adminChatSessions'] });
    },
  });

  // Mutasi kirim pesan chatbot dengan inisialisasi sesi otomatis
  const sendChatMessage = useMutation({
    mutationFn: async (teks: string) => {
      let targetId = activeChatSessionId;
      if (!targetId) {
        const resSession = await fetch(`${backendUrl}/api/chatbot/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            judul_sesi: 'Konsultasi Eksekutif Integritas',
            id_laporan: null,
          }),
          credentials: 'include',
        });
        if (resSession.ok) {
          const sData = await resSession.json();
          targetId = sData.id_sesi_obrolan;
          setActiveChatSessionId(targetId);
        }
      }

      const res = await fetch(`${backendUrl}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_sesi_obrolan: targetId || null,
          teks,
          id_laporan: null,
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal mengirim pesan.');
      }
      const data = await res.json();
      return { data, sessionId: data.id_sesi_obrolan || targetId };
    },
    onSuccess: (result) => {
      setChatInput('');
      if (result.sessionId) {
        setActiveChatSessionId(result.sessionId);
        queryClient.invalidateQueries({ queryKey: ['adminSessionMessages', result.sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['adminChatSessions'] });
    },
  });

  // Inisialisasi sesi chatbot saat tab chatbot dibuka
  useEffect(() => {
    if (activeMainTab === 'chatbot' && chatSessions) {
      const globalSession = chatSessions.find((s) => s.id_laporan === null);
      if (globalSession) {
        setActiveChatSessionId(globalSession.id_sesi_obrolan);
      } else if (!createChatSession.isPending && !activeChatSessionId) {
        createChatSession.mutate();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab, chatSessions]);

  // Scroll otomatis HANYA pada container chat, TIDAK pada window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeSession?.pesan_obrolan]);

  const handleSelectLaporan = (id: string) => {
    navigate(`/aslab/view/${id}`);
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchAnalytics(),
      refetchReportsAnalytics(),
      refetchNav(),
    ]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const quickPrompts = [
    'Berapa rata-rata skor orisinalitas kampus?',
    'Ringkas status antrean dan penggunaan token',
    'Apakah ada indikasi plagiarisme yang butuh evaluasi?',
  ];

  const handleQuickPrompt = (prompt: string) => {
    setChatInput(prompt);
  };

  // Kalkulasi data metrik
  const totalReportsCount = reportsAnalytics?.totalLaporan ?? analytics?.summary.total_laporan_dianalisis ?? 0;
  const hasReports = totalReportsCount > 0;
  const avgOriginalityScore = reportsAnalytics?.rataSkor ?? 0;
  const totalTokens = analytics?.summary.total_token || 0;
  const inputTokens = analytics?.summary.token_input || 0;
  const outputTokens = analytics?.summary.token_output || 0;
  const totalCost = Number(analytics?.summary.estimasi_biaya || 0).toFixed(4);
  const highPlagiarismCount = reportsAnalytics?.totalPlagiat ?? 0;

  // Cek apakah data tren harian bernilai 0 seluruhnya
  const isCostTrendFlat = analytics?.daily_cost_trend?.every(t => Number(t.Biaya) === 0) ?? true;

  // Gabungkan daftar Program Studi dengan metrik biaya & laporan
  const prodiDisplayList = React.useMemo(() => {
    const list = prodiList || [];
    return list.map((p) => {
      const costItem = analytics?.prodi_cost?.find(pc => pc.id_program_studi === p.id_program_studi);
      const statItem = reportsAnalytics?.prodiStats?.find(ps => ps.id_program_studi === p.id_program_studi);

      return {
        id_program_studi: p.id_program_studi,
        nama_prodi: p.nama_prodi,
        total_biaya: Number(costItem?.total_biaya || 0),
        total_laporan: statItem?.total_laporan || 0,
        rata_skor: statItem?.rata_skor || 0
      };
    });
  }, [prodiList, analytics?.prodi_cost, reportsAnalytics?.prodiStats]);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1500px] mx-auto space-y-3.5 sm:space-y-6 animate-fade-in font-sans text-slate-900">
      
      {/* 1. Header Eksekutif Terpadu & Pita Status Infrastruktur */}
      <div className="space-y-2.5 sm:space-y-3.5">
        <PageHeader 
          title="Dasbor Kontrol" 
          titleAccent="Sistem"
          description="Pusat kendali eksekutif, orisinalitas laporan akademik STITEK Bontang, performa komputasi AI, dan kesehatan infrastruktur."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                title="Perbarui Data Dasbor"
                aria-label="Perbarui Data Dasbor"
                className="px-2.5"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0D1B2A]' : ''}`} />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/users')}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#0D1B2A]" />
                <span>+ Pengguna</span>
              </Button>
            </div>
          }
        />

        {/* Pita Status Infrastruktur Terpadu */}
        <div className="p-2.5 sm:p-3 px-3 sm:px-4 bg-white border border-slate-200/80 rounded-lg shadow-xs flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <span className="font-bold text-[#0D1B2A]">Infrastruktur Veritas:</span>
            <span className="text-[#0D1B2A] bg-[#415A77]/10 border border-[#415A77]/25 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
              Seluruh Layanan Normal
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              FastAPI Core: <strong className="text-[#0D1B2A]">Online</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              Supabase pgvector: <strong className="text-[#0D1B2A]">1536 dim</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Model LLM: <strong className="text-[#0D1B2A]">Llama 3 8B / Gemini</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              Retrieval: <strong className="text-[#0D1B2A]">Hybrid RRF (k = 60)</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Banner Peringatan Plagiat Tinggi (Hanya jika ada temuan) */}
      {highPlagiarismCount > 0 && (
        <div className="p-3 sm:p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-3 text-xs animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5 text-rose-800 font-bold">
            <ShieldAlert className="w-4.5 h-4.5 text-rose-600 shrink-0" />
            <span>Peringatan Orisinalitas: Terdapat {highPlagiarismCount} berkas laporan dengan skor &lt; 50% yang membutuhkan evaluasi khusus.</span>
          </div>
          <Button 
            variant="destructive"
            size="sm"
            onClick={() => navigate('/kepala-lab/matrix')}
            className="shrink-0"
          >
            <span>Buka Matriks Peninjauan</span>
          </Button>
        </div>
      )}

      {/* 3. Hero KPI Grid (4 Kolom Terpadu) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* KPI 1: Total Berkas Laporan */}
        <StatCard
          title="Total Berkas Laporan"
          value={isLoadingReportsAnalytics && isLoadingAnalytics ? '...' : totalReportsCount}
          subtitle={hasReports ? "Terverifikasi • Naskah Praktikum" : "Siap menerima naskah"}
          variant="default"
        />

        {/* KPI 2: Rata-Rata Orisinalitas */}
        <StatCard
          title="Rata-Rata Orisinalitas"
          value={isLoadingReportsAnalytics ? '...' : hasReports ? `${avgOriginalityScore}%` : 'N/A'}
          subtitle={hasReports ? (avgOriginalityScore >= 75 ? "Kategori Baik • Target ≥ 70%" : "Perlu Evaluasi • Target ≥ 70%") : "Belum ada evaluasi laporan"}
          variant={hasReports ? (avgOriginalityScore >= 75 ? "blue" : "amber") : "default"}
        />

        {/* KPI 3: Konsumsi Token AI */}
        <StatCard
          title="Konsumsi Token LLM"
          value={isLoadingAnalytics ? '...' : totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : '0 Token'}
          subtitle={totalTokens > 0 ? `${(inputTokens / 1000).toFixed(1)}k In / ${(outputTokens / 1000).toFixed(1)}k Out` : "Inferensi siap digunakan"}
          variant="default"
        />

        {/* KPI 4: Estimasi Biaya Pemanggilan */}
        <StatCard
          title="Estimasi Biaya AI"
          value={`$${totalCost}`}
          subtitle="RRF Hybrid • Efisiensi Komputasi"
          variant="amber"
        />
      </div>

      {/* 4. Tab Navigasi Konten Utama */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 border-b border-slate-200/80 pb-2 sm:pb-2.5">
        <SegmentedControl
          options={[
            { value: 'overview', label: 'Ringkasan & Analitik', icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { 
              value: 'directory', 
              label: 'Direktori Akademik', 
              icon: <Folder className="w-3.5 h-3.5" />,
              count: navData && navData.length > 0 ? navData.length : undefined 
            },
            { value: 'chatbot', label: 'Veritas Copilot', icon: <Bot className="w-3.5 h-3.5" /> },
          ]}
          value={activeMainTab}
          onChange={setActiveMainTab}
          className="max-w-lg w-full sm:w-auto"
        />

        <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
          Panel Eksekutif STITEK Bontang
        </span>
      </div>

      {/* 5. TAB 1: RINGKASAN & ANALITIK */}
      {activeMainTab === 'overview' && (
        <div className="space-y-3.5 sm:space-y-6 animate-fade-in">
               {/* Baris 1: Grafik Tren Pengeluaran & Beban Prodi (2 Kolom) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6">
            
            {/* Kolom Kiri: Tren Pengeluaran & Beban AI Harian (7 Kolom) */}
            <div className="lg:col-span-7 rounded-lg border border-slate-200/80 bg-white p-3.5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3.5 border-b border-slate-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0D1B2A]" />
                    <h3 className="text-sm font-bold text-[#0D1B2A] uppercase tracking-wider">
                      Tren Pengeluaran & Beban AI Harian
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Aktivitas inferensi LLM dan biaya token dalam 7 hari terakhir.
                  </p>
                </div>
                <span className="text-[10px] font-mono tabular-nums font-bold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                  Total: ${totalCost}
                </span>
              </div>

              {/* Area Chart dengan Informasi jika Data Kosong */}
              <div className="w-full h-[200px] mt-4 relative">
                {isLoadingAnalytics ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    Memuat data grafik tren...
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics?.daily_cost_trend || []} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="brassGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.3} />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                        <Tooltip 
                          contentStyle={{ 
                            background: '#0D1B2A', 
                            color: '#F8FAFC',
                            border: '1px solid #D4AF37', 
                            borderRadius: '6px', 
                            fontSize: '11px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                          formatter={(value: any) => [`$${Number(value).toFixed(4)}`, 'Biaya Komputasi']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="Biaya" 
                          stroke="#D4AF37" 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#brassGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    {isCostTrendFlat && (
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        <div className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-md shadow-xs text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0D1B2A]" />
                          <span>Kuota AI optimal (Belum ada pemanggilan berbayar 7 hari terakhir)</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                <span>{`Sistem Retrieval: Reciprocal Rank Fusion (k = 60)`}</span>
                <span className="tabular-nums">Rata-rata Biaya: ${(Number(totalCost) / 7).toFixed(4)} / hari</span>
              </div>
            </div>

            {/* Kolom Kanan: Distribusi per Program Studi (5 Kolom) */}
            <div className="lg:col-span-5 rounded-lg border border-slate-200/80 bg-white p-3.5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0D1B2A]" />
                    <h3 className="text-sm font-bold text-[#0D1B2A] uppercase tracking-wider">
                      Distribusi Program Studi
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Akademik</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">
                  Pemetaan jumlah laporan dan alokasi biaya inferensi AI per program studi.
                </p>
              </div>

              <div className="my-3.5 space-y-3">
                {prodiDisplayList.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">
                    Belum ada program studi terdaftar.
                  </div>
                ) : (
                  prodiDisplayList.map((p, idx) => {
                    const totalNum = Number(totalCost) > 0 ? Number(totalCost) : 1;
                    const pct = p.total_biaya > 0 ? Math.min(100, Math.max(12, Math.round((p.total_biaya / totalNum) * 100))) : 0;
                    const barColors = ['bg-slate-900', 'bg-[#D4AF37]', 'bg-slate-600', 'bg-[#D4AF37]'];

                    return (
                      <div key={p.id_program_studi} className="p-2.5 rounded-md bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#0D1B2A]">{p.nama_prodi}</span>
                          <span className="font-mono tabular-nums text-[11px] font-bold text-amber-700">${p.total_biaya.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-600">
                          <span>{p.total_laporan} Dokumen Laporan</span>
                          <span>{p.rata_skor > 0 ? `${p.rata_skor}% Rata-Rata` : 'Siap Digunakan'}</span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${barColors[idx % barColors.length]}`} 
                            style={{ width: `${pct || 100}%`, opacity: pct > 0 ? 1 : 0.25 }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-600">Manajemen master data prodi?</span>
                <button 
                  onClick={() => navigate('/admin/prodi')}
                  className="font-bold text-[#0D1B2A] hover:text-[#0D1B2A] flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                >
                  <span>Kelola Prodi</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

          </div>

          {/* Baris 2: Laporan Terbaru & Pintasan Modul (2 Kolom) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6">
            
            {/* Kolom Kiri: Verifikasi Laporan Terkini (7 Kolom) */}
            <div className="lg:col-span-7 rounded-lg border border-slate-200/80 bg-white p-3.5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-[#0D1B2A]/5 text-[#0D1B2A] flex items-center justify-center">
                      <Activity className="w-4 h-4 text-[#0D1B2A]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0D1B2A] uppercase tracking-wider">
                        Verifikasi Laporan Terkini
                      </h3>
                      <p className="text-[11px] text-slate-600">Naskah bimbingan terbaru yang diajukan ke sistem deteksi.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/aslab/checker')}
                    className="text-xs font-bold text-[#0D1B2A] hover:text-[#0D1B2A] flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                  >
                    <span>Cek Dokumen</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="mt-4 space-y-2.5">
                  {isLoadingReportsAnalytics ? (
                    <div className="py-8 text-center text-slate-500 text-xs">Memuat data laporan...</div>
                  ) : !reportsAnalytics?.laporansTerbaru || reportsAnalytics.laporansTerbaru.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-[#0D1B2A]">Belum Ada Laporan Praktikum</p>
                      <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                        Mulai uji orisinalitas naskah mahasiswa menggunakan fitur Pengecekan Dokumen.
                      </p>
                      <button
                        onClick={() => navigate('/aslab/checker')}
                        className="mt-2 px-4 py-2 bg-[#0D1B2A] hover:bg-[#1E293B] text-white rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                      >
                        + Pengecekan Dokumen Baru
                      </button>
                    </div>
                  ) : (
                    reportsAnalytics.laporansTerbaru.map((lap) => (
                      <div 
                        key={lap.id_laporan}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectLaporan(lap.id_laporan)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectLaporan(lap.id_laporan);
                          }
                        }}
                        className="p-3 bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-slate-300 rounded-md flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-[#0D1B2A] group-hover:text-white transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#0D1B2A] group-hover:text-[#0D1B2A] transition-colors truncate">
                              {lap.nama_mahasiswa}
                            </div>
                            <div className="text-[10px] text-slate-600 flex items-center gap-2 mt-0.5 truncate">
                              <span className="font-mono">NIM: {lap.nim}</span>
                              <span>•</span>
                              <span className="truncate">{lap.nama_matkul} ({lap.nama_kelas})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-xs font-bold text-[#0D1B2A]">
                              {lap.skor_orisinalitas}%
                            </div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                              Orisinalitas
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3.5 mt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <span className="text-slate-600">Ingin eksplorasi struktur folder bimbingan?</span>
                <button
                  onClick={() => setActiveMainTab('directory')}
                  className="font-bold text-[#0D1B2A] hover:text-[#0D1B2A] transition-colors cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                >
                  <span>Buka Direktori</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Kolom Kanan: Pintasan Operasional Modul (5 Kolom) */}
            <div className="lg:col-span-5 rounded-lg border border-slate-200/80 bg-white p-3.5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#0D1B2A]" />
                    <h3 className="text-sm font-bold text-[#0D1B2A] uppercase tracking-wider">
                      Pintasan Modul Utama
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Navigasi Cepat</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">
                  Akses langsung ke konfigurasi sistem, antrean, dan manajemen akun.
                </p>
              </div>

              <div className="my-3 space-y-2.5">
                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/admin/users')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('/admin/users');
                    }
                  }}
                  className="p-3 bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/80 rounded-md flex items-center justify-between transition-all cursor-pointer group shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-[#0D1B2A]/5 text-[#0D1B2A] flex items-center justify-center group-hover:bg-[#0D1B2A] group-hover:text-white transition-colors">
                      <UsersIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0D1B2A]">Manajemen Pengguna</h4>
                      <p className="text-[10px] text-slate-600">Otorisasi akun Asisten Lab & Kepala Lab</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/admin/ai-config')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('/admin/ai-config');
                    }
                  }}
                  className="p-3 bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/80 rounded-md flex items-center justify-between transition-all cursor-pointer group shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-[#415A77]/10 text-[#0D1B2A] flex items-center justify-center group-hover:bg-[#D4AF37] group-hover:text-white transition-colors">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0D1B2A]">Konfigurasi Mesin AI</h4>
                      <p className="text-[10px] text-slate-600">Pilihan model LLM, bobot RRF, & kuota API</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/admin/queue-monitor')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('/admin/queue-monitor');
                    }
                  }}
                  className="p-3 bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/80 rounded-md flex items-center justify-between transition-all cursor-pointer group shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition-colors">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0D1B2A]">Monitoring Antrean Dokumen</h4>
                      <p className="text-[10px] text-slate-600">Status pemrosesan background worker PgBoss</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-600">Butuh bantuan konsultasi AI?</span>
                <button
                  onClick={() => setActiveMainTab('chatbot')}
                  className="font-bold text-[#0D1B2A] hover:text-[#0D1B2A] flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                >
                  <span>Tanya Veritas Copilot</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 6. TAB 2: DIREKTORI AKADEMIK GLOBAL */}
      {activeMainTab === 'directory' && (
        <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 sm:p-6 shadow-xs space-y-3.5 sm:space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-[#0D1B2A]" />
                <h2 className="text-base font-bold text-[#0D1B2A] uppercase tracking-wider">
                  Struktur Direktori Laporan Global
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Navigasi hierarkis dokumen: Program Studi &rarr; Mata Kuliah &rarr; Kelas Praktikum &rarr; Berkas Laporan Mahasiswa.
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <input 
                type="text" 
                placeholder="Cari naskah, mahasiswa, atau NIM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2 pl-9 text-xs focus:border-[#D4AF37] focus:bg-white focus:outline-none transition-all text-[#0D1B2A] placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="min-h-[250px] max-h-[500px] overflow-y-auto pr-1 sm:pr-2 space-y-1 sm:space-y-1.5 custom-scrollbar">
            {isLoadingNav ? (
              <LoadingSpinner variant="fullpage" message="Menyusun pohon direktori laporan akademik..." />
            ) : !navData || navData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 text-xs gap-2">
                <Folder className="w-8 h-8 text-slate-400" />
                <span>Belum ada data dokumen yang terdaftar dalam direktori akademik.</span>
              </div>
            ) : (
              navData.map((node) => (
                <GlobalDirectoryNode 
                  key={node.id} 
                  item={node} 
                  depth={0} 
                  searchTerm={searchTerm} 
                  onSelectLaporan={handleSelectLaporan}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. TAB 3: VERITAS COPILOT AI */}
      {activeMainTab === 'chatbot' && (
        <div className="rounded-lg border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between max-w-4xl mx-auto min-h-[550px] animate-fade-in">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#0D1B2A] border border-slate-700/70 flex items-center justify-center p-0.5 shadow-xs overflow-hidden">
                  <MascotAvatar size={38} label="Maskot Veritas Copilot Header" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0D1B2A] uppercase tracking-wider">
                    Veritas Copilot
                  </h3>
                  <span className="text-[11px] text-[#0D1B2A] font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                    Asisten AI Akademik Kampus STITEK Bontang
                  </span>
                </div>
              </div>
              <BrainCircuit className="w-5 h-5 text-[#0D1B2A]" />
            </div>

            {/* Bubble Dialog Stream */}
            <div 
              ref={chatContainerRef}
              className="h-[340px] overflow-y-auto py-4 space-y-3.5 custom-scrollbar text-xs pr-2"
            >
              {isLoadingMessages ? (
                <div className="text-slate-500 text-xs text-center py-16">
                  Menghubungkan ke server asisten AI...
                </div>
              ) : activeSession?.pesan_obrolan && activeSession.pesan_obrolan.length > 0 ? (
                activeSession.pesan_obrolan.map((msg) => (
                  <div 
                    key={msg.id_pesan_obrolan} 
                    className={`flex gap-3 max-w-[85%] ${
                      msg.pengirim === 'USER' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold overflow-hidden shadow-xs ${
                      msg.pengirim === 'USER' 
                        ? 'bg-[#0D1B2A] text-white' 
                        : 'bg-[#0D1B2A] border border-slate-700'
                    }`}>
                      {msg.pengirim === 'USER' ? <User className="w-3.5 h-3.5" /> : <MascotAvatar size={24} label="Avatar AI" />}
                    </div>
                    <div className={`p-3.5 rounded-lg text-[12px] leading-relaxed shadow-2xs overflow-hidden ${
                      msg.pengirim === 'USER' 
                        ? 'bg-[#0D1B2A] text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200 w-full'
                    }`}>
                      {msg.pengirim === 'USER' ? (
                        <p className="whitespace-pre-wrap">{msg.teks}</p>
                      ) : (
                        <MarkdownView content={msg.teks} />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 py-6 px-4 gap-3">
                  <MascotAvatar size={88} speechText="Halo Admin Veritas!" label="Maskot Veritas AI" />
                  <span className="text-xs font-semibold max-w-sm leading-relaxed text-[#0D1B2A]">
                    Tanyakan status orisinalitas laporan, tren biaya token, parameter algoritma RRF, atau riwayat penugasan asisten lab.
                  </span>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="pt-2.5 pb-1.5 flex flex-wrap gap-2 border-t border-slate-200/80">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickPrompt(p)}
                  className="text-[11px] px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer font-medium border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Form Input Pesan */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim() || sendChatMessage.isPending) return;
              sendChatMessage.mutate(chatInput);
            }}
            className="border-t border-slate-200/80 pt-3.5 flex items-center gap-2.5 shrink-0 mt-2"
          >
            <input 
              type="text" 
              placeholder="Tanyakan analisis global atau konsultasi integritas..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={sendChatMessage.isPending}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs text-[#0D1B2A] placeholder-slate-400 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-all focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            />
            <button 
              type="submit" 
              disabled={!chatInput.trim() || sendChatMessage.isPending}
              className="px-4 py-2.5 rounded-md bg-[#0D1B2A] hover:bg-[#1E293B] text-white flex items-center gap-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <span>Kirim</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
