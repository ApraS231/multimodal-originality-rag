import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';
import ErrorState from '../../components/ui/error-state';
import PageHeader from '../../components/ui/page-header';
import { Card, StatCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface AnalyticsSummary {
  token_input: number;
  token_output: number;
  total_token: number;
  estimasi_biaya: number | string;
  total_laporan_dianalisis: number;
}

interface ProdiCostItem {
  id_program_studi: string;
  nama_prodi: string;
  total_biaya: number | string;
}

interface DailyCostTrendItem {
  name: string;
  Biaya: number;
}

interface AnalyticsResponse {
  summary: AnalyticsSummary;
  prodi_cost: ProdiCostItem[];
  daily_cost_trend: DailyCostTrendItem[];
}

const COLORS = ['#0D1B2A', '#D4AF37', '#334155', '#D97706', '#D4AF37', '#64748B'];

export default function Analytics() {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  const { data: analytics, isLoading, error, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ['adminAnalytics'],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/admin/analytics`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat analitik operasional.');
      return res.json();
    },
  });

  if (isLoading) {
    return <LoadingSpinner variant="fullpage" message="Memuat analitik operasional AI..." />;
  }

  if (error) {
    return (
      <ErrorState 
        title="Gagal Memuat Analitik"
        description={(error as Error)?.message || 'Terjadi kesalahan sistem saat mengambil data analitik operasional.'}
        onRetry={() => refetch()}
      />
    );
  }

  const totalToken = analytics?.summary.total_token || 0;
  const totalCost = Number(analytics?.summary.estimasi_biaya || 0);
  const totalLaporan = analytics?.summary.total_laporan_dianalisis || 0;
  const avgTokens = totalLaporan > 0 ? Math.round(totalToken / totalLaporan) : 0;

  // Format data untuk Pie Chart
  const pieData = analytics?.prodi_cost.map((pc) => ({
    name: pc.nama_prodi,
    value: Number(pc.total_biaya),
  })) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Analitik"
        titleAccent="Biaya AI"
        description="Pemantauan konsumsi token LLM (Gemini / Llama), biaya komputasi AI, dan log perubahan sistem."
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate('/admin/audit-logs')}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <span>Audit Logs</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        }
      />

      {isLoading ? (
        <LoadingSpinner variant="fullpage" message="Agregasi penggunaan token dan biaya operasional..." />
      ) : error ? (
        <div className="text-center py-20 text-rose-600 space-y-2">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <p className="font-bold">Gagal memuat data analitik sistem.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Token Terpakai"
              value={totalToken.toLocaleString()}
              subtitle={`Input: ${analytics?.summary?.token_input?.toLocaleString() || 0} • Output: ${analytics?.summary?.token_output?.toLocaleString() || 0}`}
              variant="default"
            />
            <StatCard
              title="Estimasi Biaya API"
              value={`$${totalCost.toFixed(5)}`}
              subtitle={`Rp ${(totalCost * 15500).toLocaleString('id-ID', { maximumFractionDigits: 2 })} (Kurs: 15.500)`}
              variant="amber"
            />
            <StatCard
              title="Rata-rata Token / Laporan"
              value={avgTokens.toLocaleString()}
              subtitle="Konsumsi rata-rata run-rate LLM"
              variant="default"
            />
            <StatCard
              title="Laporan Dianalisis"
              value={totalLaporan.toLocaleString()}
              subtitle="Analisis selesai sukses tersimpan"
              variant="brass"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Line Chart Tren Token */}
            <Card className="lg:col-span-2 space-y-4">
              <div>
                <h3 className="font-sans text-sm font-bold text-[#0D1B2A] tracking-tight">Tren Pengeluaran Harian</h3>
                <p className="text-slate-500 text-xs mt-0.5">Statistik fluktuasi estimasi biaya pemanggilan LLM harian (7 Hari Terakhir).</p>
              </div>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.daily_cost_trend || []}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0D1B2A', color: '#F7F3E9', border: '1px solid #D4AF37', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="Biaya" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Donut Chart Alokasi Prodi */}
            <Card className="flex flex-col justify-between">
              <div>
                <h3 className="font-sans text-sm font-bold text-[#0D1B2A] tracking-tight">Alokasi Biaya Program Studi</h3>
                <p className="text-slate-500 text-xs mt-0.5">Proporsi alokasi pengeluaran dana komputasi per prodi.</p>
              </div>
              <div className="h-64 flex flex-col justify-between items-center py-4">
                <div className="w-full h-44 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#0D1B2A', color: '#F7F3E9', border: '1px solid #D4AF37', borderRadius: '6px', fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center space-y-0.5 pointer-events-none">
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Dana Global</span>
                    <span className="text-lg font-bold font-mono text-[#0D1B2A]">${totalCost.toFixed(4)}</span>
                  </div>
                </div>

                {/* Legenda Custom */}
                <div className="w-full grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-semibold max-h-20 overflow-y-auto px-2">
                  {pieData.map((entry, idx) => (
                    <div key={entry.name} className="flex items-center gap-1.5 truncate" title={entry.name}>
                      <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
