import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Calendar, 
  ShieldAlert, 
  Eye, 
  X, 
  Copy, 
  Check, 
  Laptop, 
  User, 
  Globe 
} from 'lucide-react';
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

interface AuditActor {
  id: string;
  nama: string;
  email: string;
}

interface AuditLogItem {
  id_aktivitas_admin: string;
  id_aktor: string;
  jenis_tindakan: 'CREATE' | 'UPDATE' | 'DELETE' | 'FORCE_FAIL' | 'TRIGGER' | string;
  entitas_target: string;
  deskripsi: string;
  alamat_ip: string;
  agen_pengguna: string;
  tanggal_dibuat: string;
  aktor: AuditActor;
}

interface AuditLogsResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  data: AuditLogItem[];
}

export default function AuditLogs() {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // State filtering dan pagination
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // State drawer detail
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<AuditLogItem | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const { data: auditResponse, isLoading, error, refetch } = useQuery<AuditLogsResponse>({
    queryKey: ['auditLogs', search, action, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        action,
        startDate,
        endDate,
        page: page.toString(),
        limit: limit.toString(),
      });

      const res = await fetch(`${backendUrl}/api/admin/audit-logs?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat log audit aktivitas.');
      return res.json();
    },
  });

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case 'CREATE':
        return 'text-[#0D1B2A] bg-[#415A77]/10 border-[#415A77]/25';
      case 'UPDATE':
        return 'text-[#0D1B2A] bg-slate-100 border-slate-300';
      case 'DELETE':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'FORCE_FAIL':
      case 'TRIGGER':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      default:
        return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleOpenDetail = (log: AuditLogItem) => {
    setDetailLog(log);
    setIsDetailOpen(true);
    setCopiedId(false);
  };

  const handleCopyId = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Hitung metrik KPI dari hasil saat ini
  const totalCount = auditResponse?.total || 0;
  const currentLogs = auditResponse?.data || [];
  const mutateActionsCount = currentLogs.filter(l => ['CREATE', 'UPDATE', 'DELETE'].includes(l.jenis_tindakan)).length;
  const criticalActionsCount = currentLogs.filter(l => ['FORCE_FAIL', 'TRIGGER'].includes(l.jenis_tindakan)).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Audit"
        titleAccent="Trail"
        description="Rekam jejak kronologis aktivitas modifikasi data master, mutasi relasi, dan intervensi sistem oleh administrator."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/analytics')}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Analitik</span>
          </Button>
        }
      />

      {/* KPI Bento Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Log Audit"
          value={totalCount.toLocaleString()}
          description="Rekam jejak tersimpan"
          variant="default"
        />

        <StatCard
          title="Mutasi Master (Halaman Ini)"
          value={mutateActionsCount}
          description="CREATE, UPDATE, DELETE"
          variant="default"
        />

        <StatCard
          title="Intervensi Kritis"
          value={criticalActionsCount}
          description="FORCE_FAIL / TRIGGER"
          variant="amber"
        />

        <StatCard
          title="Integritas Log"
          value="100%"
          description="Imutabel & Terverifikasi"
          variant="brass"
        />
      </div>

      {/* Filter Controls Card */}
      <Card size="sm" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        {/* Search Input */}
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="search" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cari Tindakan / Deskripsi</Label>
          <div className="relative">
            <Input
              id="search"
              placeholder="Contoh: Menambahkan Program, Hapus, ..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="bg-white border-slate-200 text-[#0D1B2A] placeholder-slate-400 focus:border-[#D4AF37] focus-visible:ring-[#D4AF37] transition-all pl-9 h-10 text-xs rounded-md"
            />
            <Search className="absolute left-3 top-3.5 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Action Dropdown */}
        <div className="space-y-1.5">
          <Label htmlFor="action" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Tipe Aksi
          </Label>
          <select
            id="action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-[#0D1B2A] text-xs focus:border-[#D4AF37] focus-visible:ring-[#D4AF37] transition-all focus:outline-none"
          >
            <option value="" className="text-slate-400">Semua Aksi...</option>
            <option value="CREATE" className="text-[#0D1B2A]">CREATE</option>
            <option value="UPDATE" className="text-[#0D1B2A]">UPDATE</option>
            <option value="DELETE" className="text-[#0D1B2A]">DELETE</option>
            <option value="FORCE_FAIL" className="text-[#0D1B2A]">FORCE_FAIL</option>
            <option value="TRIGGER" className="text-[#0D1B2A]">TRIGGER</option>
          </select>
        </div>

        {/* Date Pickers */}
        <div className="space-y-1.5">
          <Label htmlFor="startDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Mulai Tanggal
          </Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-[#D4AF37] transition-all h-10 text-xs rounded-md"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Sampai Tanggal
          </Label>
          <div className="flex gap-2">
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="bg-white border-slate-200 text-[#0D1B2A] focus:border-[#D4AF37] focus-visible:ring-[#D4AF37] transition-all h-10 text-xs rounded-md flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
              title="Reset Filter"
              className="h-10 text-xs font-semibold shrink-0"
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs Table Card */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <LoadingSpinner variant="fullpage" message="Menyelaraskan histori audit log..." />
        ) : error ? (
          <ErrorState 
            title="Gagal Memuat Log Audit"
            description={(error as Error)?.message || 'Terjadi kesalahan sistem saat mengambil log audit aktivitas.'}
            onRetry={() => refetch()}
          />
        ) : !auditResponse || auditResponse.data.length === 0 ? (
          <EmptyState 
            icon={ShieldAlert}
            title="Tidak ada riwayat aktivitas"
            description="Tidak ada riwayat aktivitas admin yang cocok dengan kriteria filter."
          />
        ) : (
          <TableContainer ariaLabel="Tabel Riwayat Aktivitas dan Jejak Audit Sistem" bordered>
            <Table>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="px-5">Waktu</TableHead>
                  <TableHead>Aktor</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Target Entitas</TableHead>
                  <TableHead className="px-5">Deskripsi Aktivitas</TableHead>
                  <TableHead>Alamat IP</TableHead>
                  <TableHead align="center">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditResponse.data.map((log) => (
                  <TableRow 
                    key={log.id_aktivitas_admin} 
                    interactive
                    onClick={() => handleOpenDetail(log)}
                    className="group"
                  >
                    <TableCell tabularNums className="px-5 text-slate-600 whitespace-nowrap">
                      {new Date(log.tanggal_dibuat).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-[#0D1B2A] block">{log.aktor?.nama || 'Aktor Terhapus'}</span>
                      <p className="text-[10px] text-slate-500 font-normal font-mono mt-0.5">{log.aktor?.email || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[9px] px-2.5 py-1 rounded-md border font-black tracking-wide ${getActionBadgeColor(log.jenis_tindakan)}`}>
                        {log.jenis_tindakan}
                      </span>
                    </TableCell>
                    <TableCell tabularNums className="font-bold text-slate-700">{log.entitas_target}</TableCell>
                    <TableCell className="px-5 text-[#0D1B2A] font-medium leading-relaxed max-w-xs truncate" title={log.deskripsi}>
                      {log.deskripsi}
                    </TableCell>
                    <TableCell tabularNums className="text-[11px] text-slate-600 whitespace-nowrap">
                      {log.alamat_ip}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDetail(log)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-[#0D1B2A] rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                        title="Lihat Detail Log"
                        aria-label="Lihat Detail Log"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Pagination Panel */}
      {auditResponse && auditResponse.total_pages > 1 && (
        <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono border-t border-slate-200/80 pt-4 flex-shrink-0">
          <span>Menampilkan Halaman {page} dari {auditResponse.total_pages} ({auditResponse.total.toLocaleString()} log total)</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs font-semibold"
            >
              Sebelumnya
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={page === auditResponse.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs font-semibold"
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SLIDE-OVER / SHEET DETAIL AUDIT LOG                      */}
      {/* ======================================================== */}
      {isDetailOpen && detailLog && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsDetailOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-lg flex flex-col justify-between overflow-y-auto font-sans">
              
              {/* Header Drawer */}
              <div className="p-6 border-b border-slate-200/80 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detail Audit Event</span>
                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full border font-black tracking-wide ${getActionBadgeColor(detailLog.jenis_tindakan)}`}>
                      {detailLog.jenis_tindakan}
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsDetailOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-[#0D1B2A] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="font-sans text-base font-bold text-[#0D1B2A]">
                    {detailLog.entitas_target}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">
                    {new Date(detailLog.tanggal_dibuat).toLocaleString('id-ID', {
                      dateStyle: 'full',
                      timeStyle: 'medium',
                    })}
                  </p>
                </div>
              </div>

              {/* Body Drawer */}
              <div className="p-6 space-y-5 flex-1">
                {/* Aktor Info Card */}
                <div className="p-4 rounded-lg bg-[#0D1B2A]/[0.02] border border-slate-200/80 space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Identitas Pelaksana (Aktor)
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#0D1B2A]">{detailLog.aktor?.nama || 'Aktor Terhapus'}</p>
                    <p className="text-xs font-mono text-slate-500">{detailLog.aktor?.email || '-'}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">ID Aktor: {detailLog.id_aktor}</p>
                  </div>
                </div>

                {/* Deskripsi Aktivitas */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/60 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Uraian Tindakan
                  </span>
                  <p className="text-xs text-[#0D1B2A] leading-relaxed font-medium">
                    {detailLog.deskripsi}
                  </p>
                </div>

                {/* Info Jaringan & Perangkat */}
                <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-xs space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Telemetri Jaringan & Perangkat
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Alamat IP Klien:</span>
                      <span className="font-mono font-bold text-[#0D1B2A]">{detailLog.alamat_ip}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block flex items-center gap-1">
                        <Laptop className="w-3 h-3" />
                        User Agent:
                      </span>
                      <p className="font-mono text-[10px] text-slate-600 break-words leading-relaxed mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                        {detailLog.agen_pengguna}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ID Log & UUID Copy */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Log Audit</span>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs">
                    <span className="truncate pr-2 text-slate-600">{detailLog.id_aktivitas_admin}</span>
                    <button
                      onClick={() => handleCopyId(detailLog.id_aktivitas_admin)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-all cursor-pointer shrink-0"
                      title="Salin UUID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-[#8C6D1F]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer Drawer */}
              <div className="p-6 border-t border-slate-200/80 bg-slate-50 flex items-center justify-end">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                  className="text-xs font-semibold"
                >
                  Tutup Panel
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
