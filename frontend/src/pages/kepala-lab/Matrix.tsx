import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProdi, useKelas } from '../../api/admin';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { GraduationCap, School, Calendar, Search, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '../../components/ui/loading-spinner';
import EmptyState from '../../components/ui/empty-state';
import ErrorState from '../../components/ui/error-state';
import PageHeader from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
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


interface MatkulColumn {
  id_mata_kuliah: string;
  nama_matkul: string;
}

interface LaporanMatkulItem {
  id_laporan: string;
  skor_orisinalitas: number;
  nilai_huruf: string;
  apakah_diverifikasi: boolean;
}

interface MatrixRow {
  nim: string;
  nama_mahasiswa: string;
  laporan_matkul: Record<string, LaporanMatkulItem | null>;
}

interface MatrixResponse {
  columns: MatkulColumn[];
  rows: MatrixRow[];
}

export default function Matrix() {
  const navigate = useNavigate();
  const { data: prodiList } = useProdi();
  const { data: kelasList } = useKelas();

  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [tahunAkademik, setTahunAkademik] = useState(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');

  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Kueri memuat data matriks silang
  const { data: matrixData, isLoading, error, refetch } = useQuery<MatrixResponse>({
    queryKey: ['reportsMatrix', selectedProdiId, selectedKelasId, tahunAkademik],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProdiId) params.append('id_program_studi', selectedProdiId);
      if (selectedKelasId) params.append('id_kelas', selectedKelasId);
      if (tahunAkademik) params.append('tahun_akademik', tahunAkademik);

      const res = await fetch(`${backendUrl}/api/reports/matrix?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat matriks kelulusan praktikan.');
      return res.json();
    },
  });

  // Ekspor rekap data matriks silang ke file CSV dengan UTF-8 BOM
  const handleExportCSV = () => {
    if (!matrixData || matrixData.rows.length === 0) return;

    // Header CSV: NIM, Nama Mahasiswa, Matkul1, Matkul2, ...
    const headers = ['NIM', 'Nama Mahasiswa', ...matrixData.columns.map((c) => c.nama_matkul)];
    
    const csvRows = [
      headers.join(','), // baris header
      ...matrixData.rows.map((row) => {
        const rowCells = [
          `"${row.nim}"`,
          `"${row.nama_mahasiswa}"`,
          ...matrixData.columns.map((col) => {
            const report = row.laporan_matkul[col.id_mata_kuliah];
            return report ? `"${report.skor_orisinalitas}% [${report.nilai_huruf}]"` : '"-"';
          }),
        ];
        return rowCells.join(',');
      }),
    ];

    // Gunakan BOM \uFEFF agar Microsoft Excel mengenali pemisah dan pengodean karakter dengan benar
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rekap_orisinalitas_${tahunAkademik}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter pencarian nama / NIM praktikan
  const filteredRows = matrixData?.rows.filter((row) => {
    const matchesName = row.nama_mahasiswa.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNIM = row.nim.includes(searchTerm);
    return matchesName || matchesNIM;
  }) || [];

  const totalPraktikan = matrixData?.rows?.length || 0;
  const totalMatkul = matrixData?.columns?.length || 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-[#0D1B2A] animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title="Matriks"
        titleAccent="Nilai & Orisinalitas"
        description="Rekapitulasi silang mahasiswa dengan mata kuliah untuk nilai praktikum terintegrasi deteksi plagiarisme."
        actions={
          <Button
            onClick={handleExportCSV}
            disabled={!matrixData || matrixData.rows.length === 0}
            variant="default"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Ekspor Rekap CSV
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Praktikan Terdata"
          value={totalPraktikan}
          subtitle="NIM Mahasiswa Aktif"
          variant="default"
        />

        <StatCard
          title="Mata Kuliah Diuji"
          value={totalMatkul}
          subtitle="Kolom Modul Terdaftar"
          variant="default"
        />

        <StatCard
          title="Standar Format"
          value="RFC-4180"
          subtitle="UTF-8 BOM CSV Excel"
          variant="default"
        />

        <StatCard
          title="Verifikasi Nilai"
          value="Terpadu"
          subtitle="Nilai Huruf + Skor Plagiasi"
          variant="brass"
        />
      </div>

      {/* Filter Controls Card */}
      <Card size="sm" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end bg-white border border-slate-200/80">
        {/* Prodi Dropdown */}
        <div className="space-y-1.5">
          <Label htmlFor="prodi" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-[#0D1B2A]" />
            Program Studi
          </Label>
          <select
            id="prodi"
            value={selectedProdiId}
            onChange={(e) => {
              setSelectedProdiId(e.target.value);
              setSelectedKelasId('');
            }}
            className="w-full h-10 px-3 rounded-md border border-slate-200/80 bg-white text-[#0D1B2A] text-xs focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all focus:outline-none"
          >
            <option value="" className="text-slate-400">Semua Program Studi...</option>
            {prodiList?.map((prodi) => (
              <option key={prodi.id_program_studi} value={prodi.id_program_studi} className="text-[#0D1B2A]">
                {prodi.nama_prodi}
              </option>
            ))}
          </select>
        </div>

        {/* Kelas Dropdown */}
        <div className="space-y-1.5">
          <Label htmlFor="kelas" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-slate-500" />
            Kelas Praktikum
          </Label>
          <select
            id="kelas"
            value={selectedKelasId}
            onChange={(e) => setSelectedKelasId(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-slate-200/80 bg-white text-[#0D1B2A] text-xs focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all focus:outline-none disabled:opacity-50"
            disabled={!selectedProdiId}
          >
            <option value="" className="text-slate-400">Semua Kelas...</option>
            {kelasList
              ?.filter((k) => k.id_program_studi === selectedProdiId)
              .map((kelas) => (
                <option key={kelas.id_kelas} value={kelas.id_kelas} className="text-[#0D1B2A]">
                  {kelas.nama_kelas}
                </option>
              ))}
          </select>
        </div>

        {/* Tahun Akademik */}
        <div className="space-y-1.5">
          <Label htmlFor="tahun" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            Tahun Akademik
          </Label>
          <Input
            id="tahun"
            type="number"
            value={tahunAkademik}
            onChange={(e) => setTahunAkademik(e.target.value)}
            className="bg-white border-slate-200/80 text-[#0D1B2A] focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all h-10 text-xs rounded-md font-mono font-bold"
          />
        </div>

        {/* Pencarian Nama/NIM */}
        <div className="space-y-1.5">
          <Label htmlFor="searchPraktikan" className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            Cari Mahasiswa
          </Label>
          <div className="relative">
            <Input
              id="searchPraktikan"
              type="text"
              placeholder="Ketik Nama atau NIM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border-slate-200/80 text-[#0D1B2A] placeholder-slate-400 focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#D4AF37] transition-all pl-9 h-10 text-xs rounded-md w-full"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>
        </div>
      </Card>

      {/* Matrix Grid Table Card */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <LoadingSpinner variant="fullpage" message="Menyusun matriks orisinalitas silang..." />
        ) : error ? (
          <ErrorState 
            title="Gagal Memuat Matriks"
            description={(error as Error)?.message || 'Terjadi kesalahan sistem saat menyusun matriks silang.'}
            onRetry={() => refetch()}
          />
        ) : !matrixData || matrixData.columns.length === 0 ? (
          <EmptyState 
            icon={FileSpreadsheet}
            title="Tidak Ada Mata Kuliah Terdeteksi"
            description="Pastikan data laporan telah diunggah dan ter-index ke dalam sistem."
          />
        ) : (
          <TableContainer ariaLabel="Matriks Tabulasi Silang Orisinalitas Laporan Praktikum" bordered>
            <Table>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="px-6 min-w-[120px]">NIM</TableHead>
                  <TableHead className="px-6 min-w-[180px]">Nama Mahasiswa</TableHead>
                  {matrixData.columns.map((col) => (
                    <TableHead key={col.id_mata_kuliah} align="center" className="min-w-[150px]">
                      {col.nama_matkul}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.nim}>
                    <TableCell tabularNums className="px-6 font-bold text-slate-600">
                      {row.nim}
                    </TableCell>
                    <TableCell className="px-6 font-bold text-[#0D1B2A] text-sm font-sans">
                      {row.nama_mahasiswa}
                    </TableCell>
                    {matrixData.columns.map((col) => {
                      const report = row.laporan_matkul[col.id_mata_kuliah];
                      if (!report) {
                        return (
                          <TableCell key={col.id_mata_kuliah} align="center" className="text-slate-400 font-bold">
                            -
                          </TableCell>
                        );
                      }
                      const isOriginal = report.skor_orisinalitas >= 75;
                      return (
                        <TableCell 
                          key={col.id_mata_kuliah} 
                          align="center"
                          tabularNums
                          onClick={() => navigate(`/aslab/view/${report.id_laporan}`)}
                          className="cursor-pointer hover:bg-slate-100/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                        >
                          <span 
                            className={`inline-block px-2 py-0.5 rounded font-mono text-xs ${
                              isOriginal 
                                ? 'text-[#0D1B2A] bg-[#415A77]/10 font-bold border border-[#415A77]/25/60' 
                                : 'text-rose-700 bg-rose-50/80 font-bold border border-rose-200/60'
                            }`}
                            title="Klik untuk membuka detail analisis orisinalitas"
                          >
                            {report.skor_orisinalitas.toFixed(1)}% [{report.nilai_huruf}]
                          </span>
                        </TableCell>
                      );
                    })}
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
