import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Folder, 
  FileText, 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  Download, 
  Share2, 
  Trash2, 
  Edit3, 
  Lock, 
  Unlock, 
  Plus, 
  Eye, 
  Check, 
  X, 
  ArrowLeft, 
  MoreVertical, 
  CheckCircle2, 
  Clock, 
  FileCode, 
  FileSpreadsheet, 
  Image as ImageIcon,
  ShieldAlert,
  FolderPlus,
  UploadCloud
} from 'lucide-react';
import { useToast } from './ui/toast-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import StatusBadge from './ui/status-badge';
import LoadingSpinner from './ui/loading-spinner';
import EmptyState from './ui/empty-state';
import { 
  useCreateProdi, 
  useUpdateProdi, 
  useDeleteProdi,
  useCreateMatkul,
  useUpdateMatkul,
  useDeleteMatkul,
  useCreateKelas,
  useUpdateKelas,
  useDeleteKelas,
  useDeleteReport
} from '../api/admin';

export interface NavItem {
  id: string;
  name: string;
  type: 'prodi' | 'matkul' | 'kelas' | 'laporan';
  children?: NavItem[];
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  skor_orisinalitas?: number;
  nim?: string;
  tautan_berkas?: string;
  tanggal_dibuat?: string;
  updated_at?: string;
  file_size?: string;
}

export interface AcademicFileManagerProps {
  role: 'ADMIN' | 'ASLAB' | 'KEPALA_LAB';
  navData?: NavItem[];
  isLoading?: boolean;
  onSelectLaporan?: (idLaporan: string) => void;
  className?: string;
  title?: string;
  subtitle?: string;
}

// Palet warna kurasi untuk folder kartu visual (sesuai referensi Screenshot 1, 2, 3)
export type FolderColor = 'slate' | 'amber' | 'blue' | 'mint' | 'purple' | 'lime' | 'rose' | 'brass';

interface ColorDefinition {
  id: FolderColor;
  label: string;
  hex: string;
  fill: string;
  border: string;
  text: string;
  badge: string;
}

export const FOLDER_COLORS: Record<FolderColor, ColorDefinition> = {
  slate: {
    id: 'slate',
    label: 'Slate Grey',
    hex: '#64748B',
    fill: '#F1F5F9',
    border: '#94A3B8',
    text: '#334155',
    badge: 'bg-slate-100 text-slate-700 border-slate-300'
  },
  amber: {
    id: 'amber',
    label: 'Warm Amber',
    hex: '#F59E0B',
    fill: '#FEF3C7',
    border: '#F59E0B',
    text: '#B45309',
    badge: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  blue: {
    id: 'blue',
    label: 'Ocean Blue',
    hex: '#0284C7',
    fill: '#E0F2FE',
    border: '#0284C7',
    text: '#0369A1',
    badge: 'bg-sky-100 text-sky-800 border-sky-300'
  },
  mint: {
    id: 'mint',
    label: 'Mint Emerald',
    hex: '#10B981',
    fill: '#D1FAE5',
    border: '#10B981',
    text: '#047857',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  purple: {
    id: 'purple',
    label: 'Soft Violet',
    hex: '#8B5CF6',
    fill: '#EDE9FE',
    border: '#8B5CF6',
    text: '#6D28D9',
    badge: 'bg-purple-100 text-purple-800 border-purple-300'
  },
  lime: {
    id: 'lime',
    label: 'Fresh Lime',
    hex: '#84CC16',
    fill: '#ECFCCB',
    border: '#84CC16',
    text: '#4D7C0F',
    badge: 'bg-lime-100 text-lime-800 border-lime-300'
  },
  rose: {
    id: 'rose',
    label: 'Crimson Rose',
    hex: '#F43F5E',
    fill: '#FFE4E6',
    border: '#F43F5E',
    text: '#BE123C',
    badge: 'bg-rose-100 text-rose-800 border-rose-300'
  },
  brass: {
    id: 'brass',
    label: 'STITEK Brass',
    hex: '#D4AF37',
    fill: '#FDF8E7',
    border: '#D4AF37',
    text: '#927012',
    badge: 'bg-amber-50 text-amber-900 border-amber-400'
  }
};

// SVG Ikon Folder Kustom dengan Bilangan Hitung Terbaca (Seperti Screenshot 1 & 2)
function NumberedFolderGraphic({ count, colorHex }: { count: number; colorHex: string }) {
  return (
    <div className="relative w-28 h-20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 select-none">
      <svg 
        viewBox="0 0 108 84" 
        className="w-full h-full filter drop-shadow-xs" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tab Belakang Folder */}
        <path 
          d="M 12 16 C 12 11, 16 7, 21 7 L 44 7 C 48 7, 51 9, 53 12 L 58 18 L 88 18 C 93 18, 97 22, 97 27 L 97 68 C 97 73, 93 77, 88 77 L 21 77 C 16 77, 12 73, 12 68 Z" 
          fill={colorHex} 
          fillOpacity="0.82" 
        />
        {/* Saku Depan Folder */}
        <path 
          d="M 8 28 C 8 23, 12 19, 17 19 L 91 19 C 96 19, 100 23, 100 28 L 98 69 C 98 74, 94 78, 89 78 L 19 78 C 14 78, 10 74, 10 69 Z" 
          fill={colorHex} 
        />
        {/* Garis Kilap Lembut di Bibir Saku */}
        <path 
          d="M 18 21 L 90 21" 
          stroke="rgba(255,255,255,0.35)" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
        />
        {/* Angka Jumlah Berkas di Tengah Folder */}
        <text 
          x="54" 
          y="56" 
          textAnchor="middle" 
          fill="#FFFFFF" 
          fontWeight="800" 
          fontSize="24" 
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="-0.5px"
        >
          {count}
        </text>
      </svg>
    </div>
  );
}

// Ikon Badge Dokumen Berkas (PDF, DOCX, XLS, JPG)
function FileTypeBadge({ name, score }: { name: string; score?: number }) {
  const ext = name.split('.').pop()?.toLowerCase() || 'pdf';

  if (ext === 'xlsx' || ext === 'xls') {
    return (
      <div className="w-16 h-20 rounded-lg border-2 border-slate-700 bg-white flex flex-col items-center justify-between p-2 shadow-2xs group-hover:scale-105 transition-transform">
        <FileSpreadsheet className="w-5 h-5 text-slate-700 mt-1" />
        <span className="font-bold text-[10px] tracking-wider text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono">XLS</span>
      </div>
    );
  }

  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
    return (
      <div className="w-16 h-20 rounded-lg border-2 border-rose-500 bg-white flex flex-col items-center justify-between p-2 shadow-2xs group-hover:scale-105 transition-transform">
        <ImageIcon className="w-5 h-5 text-rose-500 mt-1" />
        <span className="font-bold text-[10px] tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-mono">JPG</span>
      </div>
    );
  }

  if (ext === 'py' || ext === 'ts' || ext === 'js') {
    return (
      <div className="w-16 h-20 rounded-lg border-2 border-indigo-600 bg-white flex flex-col items-center justify-between p-2 shadow-2xs group-hover:scale-105 transition-transform">
        <FileCode className="w-5 h-5 text-indigo-600 mt-1" />
        <span className="font-bold text-[10px] tracking-wider text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">CODE</span>
      </div>
    );
  }

  // Default: Dokumen Akademik Laporan PDF
  return (
    <div className="w-16 h-20 rounded-lg border-2 border-rose-600/90 bg-white flex flex-col items-center justify-between p-2 shadow-2xs group-hover:scale-105 transition-transform relative">
      <FileText className="w-5 h-5 text-rose-600 mt-1" />
      <span className="font-bold text-[10px] tracking-wider text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-mono">PDF</span>
      {score !== undefined && (
        <span 
          className={`absolute -top-1.5 -right-2 text-[8.5px] font-bold px-1.5 py-0.2 rounded-full border shadow-2xs font-mono ${
            score >= 75 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
          }`}
        >
          {score.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

export default function AcademicFileManager({
  role,
  navData = [],
  isLoading = false,
  onSelectLaporan,
  className = '',
  title = 'Manajemen Direktori Laporan',
  subtitle = 'Kelola struktur folder akademik, kelas bimbingan praktikum, dan naskah orisinalitas.'
}: AcademicFileManagerProps) {
  const toast = useToast();
  const navigate = useNavigate();

  // Mode Tampilan: Grid (▦) atau List (≡)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Navigasi Jalur Folder (Breadcrumb Drill-down)
  // path[0] adalah root ("Direktori Utama")
  const [currentPath, setCurrentPath] = useState<{ id: string; name: string; type: 'root' | 'prodi' | 'matkul' | 'kelas' }[]>([
    { id: 'root', name: 'Direktori Utama', type: 'root' }
  ]);

  // Pencarian
  const [searchTerm, setSearchTerm] = useState('');

  // Tab Kategori: 'ALL' | 'prodi' | 'matkul' | 'kelas' | 'laporan'
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'prodi' | 'matkul' | 'kelas' | 'laporan'>('ALL');

  // Custom Metadata (Warna Folder & Status) - Disimpan di localStorage
  const [folderColors, setFolderColors] = useState<Record<string, FolderColor>>({});
  const [folderStatuses, setFolderStatuses] = useState<Record<string, 'Inprogress' | 'Completed'>>({});
  const [lockedFolders, setLockedFolders] = useState<Record<string, boolean>>({});

  // Menu Konteks Popover (3-Dots)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // State Modal Tambah Folder Baru (Hanya Admin)
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'prodi' | 'matkul' | 'kelas'>('prodi');

  // State Inline Edit Nama (Hanya Admin)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');

  // Status Hak Akses
  const isAdmin = role === 'ADMIN';
  const isViewOnly = !isAdmin; // Aslab hanya View

  // Query Mutations (Admin Only)
  const createProdiMutation = useCreateProdi();
  const updateProdiMutation = useUpdateProdi();
  const deleteProdiMutation = useDeleteProdi();

  const createMatkulMutation = useCreateMatkul();
  const updateMatkulMutation = useUpdateMatkul();
  const deleteMatkulMutation = useDeleteMatkul();

  const createKelasMutation = useCreateKelas();
  const updateKelasMutation = useUpdateKelas();
  const deleteKelasMutation = useDeleteKelas();

  const deleteReportMutation = useDeleteReport();

  // Load custom colors & statuses from localStorage
  useEffect(() => {
    try {
      const savedColors = localStorage.getItem('stitek_filemanager_colors');
      if (savedColors) setFolderColors(JSON.parse(savedColors));

      const savedStatuses = localStorage.getItem('stitek_filemanager_statuses');
      if (savedStatuses) setFolderStatuses(JSON.parse(savedStatuses));

      const savedLocks = localStorage.getItem('stitek_filemanager_locks');
      if (savedLocks) setLockedFolders(JSON.parse(savedLocks));
    } catch {
      // ignore
    }
  }, []);

  // Save changes to localStorage
  const saveColors = (newColors: Record<string, FolderColor>) => {
    setFolderColors(newColors);
    localStorage.setItem('stitek_filemanager_colors', JSON.stringify(newColors));
  };

  const saveStatuses = (newStatuses: Record<string, 'Inprogress' | 'Completed'>) => {
    setFolderStatuses(newStatuses);
    localStorage.setItem('stitek_filemanager_statuses', JSON.stringify(newStatuses));
  };

  const saveLocks = (newLocks: Record<string, boolean>) => {
    setLockedFolders(newLocks);
    localStorage.setItem('stitek_filemanager_locks', JSON.stringify(newLocks));
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper untuk mendapatkan node saat ini berdasarkan `currentPath`
  const currentNode = useMemo(() => {
    if (currentPath.length <= 1) return null; // di root

    let currentChildren = navData;
    let foundNode: NavItem | null = null;

    for (let i = 1; i < currentPath.length; i++) {
      const targetId = currentPath[i].id;
      const found = currentChildren.find(c => c.id === targetId);
      if (found) {
        foundNode = found;
        currentChildren = found.children || [];
      } else {
        break;
      }
    }

    return foundNode;
  }, [currentPath, navData]);

  // Mengumpulkan item yang ditampilkan di folder saat ini
  const displayedItems = useMemo(() => {
    let rawItems: NavItem[] = [];

    if (currentPath.length === 1) {
      // Root level: tampilkan Prodi
      rawItems = navData;
    } else if (currentNode && currentNode.children) {
      rawItems = currentNode.children;
    }

    // Filter kategori jika dipilih
    if (activeCategory !== 'ALL') {
      rawItems = rawItems.filter(item => item.type === activeCategory);
    }

    // Pencarian global atau lokal
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rawItems = rawItems.filter(item => {
        const matchName = item.name.toLowerCase().includes(q);
        const matchNim = item.nim?.toLowerCase().includes(q);
        return matchName || matchNim;
      });
    }

    return rawItems;
  }, [currentPath, currentNode, navData, activeCategory, searchTerm]);

  // Menghitung jumlah berkas rekursif di bawah suatu folder
  const countFilesInNode = (node: NavItem): number => {
    if (node.type === 'laporan') return 1;
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((acc, child) => acc + countFilesInNode(child), 0);
  };

  // Mendapatkan warna folder (default atau kustom)
  const getItemColor = (item: NavItem, idx: number): FolderColor => {
    if (folderColors[item.id]) return folderColors[item.id];
    // Default warna berputar agar variatif dan cantik seperti Screenshot 1
    const palette: FolderColor[] = ['amber', 'blue', 'mint', 'purple', 'slate', 'lime', 'rose', 'brass'];
    return palette[idx % palette.length];
  };

  // Navigasi masuk ke dalam folder
  const handleOpenFolder = (item: NavItem) => {
    if (item.type === 'laporan') {
      if (onSelectLaporan) onSelectLaporan(item.id);
      else navigate(`/aslab/view/${item.id}`);
      return;
    }
    setCurrentPath(prev => [...prev, { id: item.id, name: item.name, type: item.type }]);
    setSearchTerm('');
    setActiveMenuId(null);
  };

  // Navigasi mundur (Breadcrumbs)
  const handleGoBack = () => {
    if (currentPath.length > 1) {
      setCurrentPath(prev => prev.slice(0, prev.length - 1));
      setActiveMenuId(null);
    }
  };

  const handleNavigatePathIndex = (index: number) => {
    setCurrentPath(prev => prev.slice(0, index + 1));
    setActiveMenuId(null);
  };

  // Handler Salin Lokasi
  const handleCopyLink = (item: NavItem) => {
    navigator.clipboard.writeText(window.location.origin + `/aslab/view/${item.id}`);
    toast.success('Tautan Tersalin', `Lokasi tautan "${item.name}" telah disalin ke papan klip.`);
    setActiveMenuId(null);
  };

  // Handler Unduh Berkas / Arsip
  const handleDownload = (item: NavItem) => {
    if (item.tautan_berkas) {
      window.open(item.tautan_berkas, '_blank');
    } else {
      toast.info('Unduh Arsip', `Menyiapkan arsip ZIP untuk "${item.name}"...`);
    }
    setActiveMenuId(null);
  };

  // Handler Ganti Warna (ADMIN ONLY)
  const handleChangeColor = (itemId: string, newColor: FolderColor) => {
    if (!isAdmin) return;
    const updated = { ...folderColors, [itemId]: newColor };
    saveColors(updated);
    toast.success('Warna Diperbarui', `Warna folder berhasil diselaraskan ke ${FOLDER_COLORS[newColor].label}.`);
  };

  // Handler Ganti Status (ADMIN ONLY)
  const handleChangeStatus = (itemId: string, newStatus: 'Inprogress' | 'Completed') => {
    if (!isAdmin) return;
    const updated = { ...folderStatuses, [itemId]: newStatus };
    saveStatuses(updated);
    toast.success('Status Diperbarui', `Status folder disetel ke "${newStatus}".`);
  };

  // Handler Kunci / Buka Kunci (ADMIN ONLY)
  const handleToggleLock = (itemId: string) => {
    if (!isAdmin) return;
    const updated = { ...lockedFolders, [itemId]: !lockedFolders[itemId] };
    saveLocks(updated);
    toast.info('Proteksi Folder', updated[itemId] ? 'Folder berhasil dikunci.' : 'Kunci folder telah dibuka.');
  };

  // Handler Hapus Folder / Berkas (ADMIN ONLY)
  const handleDeleteItem = async (item: NavItem) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus "${item.name}"?`);
    if (!confirmDelete) return;

    try {
      if (item.type === 'prodi') {
        await deleteProdiMutation.mutateAsync(item.id);
      } else if (item.type === 'matkul') {
        await deleteMatkulMutation.mutateAsync(item.id);
      } else if (item.type === 'kelas') {
        await deleteKelasMutation.mutateAsync(item.id);
      } else if (item.type === 'laporan') {
        await deleteReportMutation.mutateAsync(item.id);
      }
      toast.success('Item Dihapus', `"${item.name}" berhasil dihapus dari direktori.`);
      setActiveMenuId(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus', err.message || 'Terjadi galat pada server.');
    }
  };

  // Handler Rename Simpan (ADMIN ONLY)
  const handleSaveRename = async (item: NavItem) => {
    if (!isAdmin || !editingItemName.trim()) {
      setEditingItemId(null);
      return;
    }

    try {
      if (item.type === 'prodi') {
        await updateProdiMutation.mutateAsync({ id: item.id, nama_prodi: editingItemName.trim() });
      } else if (item.type === 'matkul') {
        await updateMatkulMutation.mutateAsync({ id: item.id, nama_matkul: editingItemName.trim() });
      } else if (item.type === 'kelas') {
        await updateKelasMutation.mutateAsync({ id_kelas: item.id, nama_kelas: editingItemName.trim() });
      }
      toast.success('Nama Diperbarui', `Nama berhasil diubah menjadi "${editingItemName.trim()}".`);
      setEditingItemId(null);
    } catch (err: any) {
      toast.error('Gagal Memperbarui Nama', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Handler Tambah Folder Baru (ADMIN ONLY)
  const handleCreateNewFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newFolderName.trim()) return;

    try {
      if (newFolderType === 'prodi') {
        await createProdiMutation.mutateAsync(newFolderName.trim());
      } else if (newFolderType === 'matkul') {
        await createMatkulMutation.mutateAsync(newFolderName.trim());
      } else if (newFolderType === 'kelas') {
        const parentProdiId = currentPath.find(p => p.type === 'prodi')?.id || (navData[0]?.id || '');
        await createKelasMutation.mutateAsync({
          nama_kelas: newFolderName.trim(),
          id_program_studi: parentProdiId
        });
      }
      toast.success('Folder Dibuat', `Folder baru "${newFolderName.trim()}" berhasil ditambahkan.`);
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
    } catch (err: any) {
      toast.error('Gagal Membuat Folder', err.message || 'Periksa koneksi sistem.');
    }
  };

  return (
    <div className={`space-y-6 ${className} font-sans text-[#0D1B2A]`}>
      {/* 1. HEADER ATAS & TAB NAVIGASI (Persis Screenshot 1) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Baris Judul & Tombol Kembali */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            {currentPath.length > 1 && (
              <button
                type="button"
                onClick={handleGoBack}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                title="Kembali ke folder sebelumnya"
              >
                <ArrowLeft className="w-4.5 h-4.5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-[#0D1B2A] tracking-tight flex items-center gap-2">
                <span>{title}</span>
                {isViewOnly && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Mode Tinjau (View Only)
                  </span>
                )}
                {isAdmin && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Akses Admin (Full Edit)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>

          {/* Breadcrumb Path Trail */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto max-w-full pb-1 sm:pb-0">
            {currentPath.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                <button
                  type="button"
                  onClick={() => handleNavigatePathIndex(idx)}
                  className={`px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer truncate max-w-[150px] ${
                    idx === currentPath.length - 1 ? 'font-bold text-[#0D1B2A] bg-slate-100' : 'text-slate-600'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Baris Tab Kategori (Case Info / Assessment Plans / Manage Documents) */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-[#0D1B2A] text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Direktori
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('prodi')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCategory === 'prodi'
                ? 'bg-[#0D1B2A] text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Program Studi
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('matkul')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCategory === 'matkul'
                ? 'bg-[#0D1B2A] text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Mata Kuliah
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('kelas')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCategory === 'kelas'
                ? 'bg-[#0D1B2A] text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kelas Praktikum
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('laporan')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCategory === 'laporan'
                ? 'bg-[#0D1B2A] text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Naskah Laporan
          </button>
        </div>

        {/* 2. ACTION TOOLBAR (Pencarian, Switcher Grid/List, & Tombol Tambah HANYA ADMIN) */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
          {/* Tombol Tambah Folder & Berkas: HANYA TAMPIL UNTUK ADMIN */}
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <Button
                  onClick={() => {
                    const currentDepthType = currentPath[currentPath.length - 1].type;
                    if (currentDepthType === 'root') setNewFolderType('prodi');
                    else if (currentDepthType === 'prodi') setNewFolderType('matkul');
                    else setNewFolderType('kelas');
                    setIsNewFolderModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-slate-300 hover:border-slate-400 text-xs text-slate-800 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Folder Baru</span>
                </Button>
                <Button
                  onClick={() => navigate('/admin/seeding')}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-slate-300 hover:border-slate-400 text-xs text-slate-800 font-semibold"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
                  <span>+ Tambah Berkas</span>
                </Button>
              </>
            ) : (
              // Untuk Aslab: Label indikator mode peninjauan
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Folder className="w-4 h-4 text-[#D4AF37]" />
                <span className="font-medium text-slate-700">Penjelajahan Berkas Bimbingan Praktikum</span>
              </div>
            )}
          </div>

          {/* Kotak Pencarian & View Switcher (List vs Grid) */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Input
                type="text"
                placeholder="Cari nama berkas / NIM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-xs pl-8 pr-3 bg-white border-slate-200 rounded-lg focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tombol Pengalih Tampilan (List & Grid) */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white shadow-2xs text-emerald-700 font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Tampilan Tabel Berkas (List View)"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-2xs text-emerald-700 font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Tampilan Kartu Folder (Grid View)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KONTEN UTAMA: GRID ATAU LIST VIEW */}
      {isLoading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-16 shadow-xs flex items-center justify-center">
          <LoadingSpinner variant="section" message="Menyelaraskan direktori file manager..." />
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 shadow-xs">
          <EmptyState
            icon={Folder}
            title={searchTerm ? 'Tidak Ada Berkas yang Cocok' : 'Direktori Masih Kosong'}
            description={
              searchTerm
                ? `Tidak ditemukan berkas atau folder dengan kata kunci "${searchTerm}".`
                : 'Folder ini belum memiliki subfolder atau naskah laporan praktikum.'
            }
            actionLabel={isAdmin ? '+ Tambah Folder Baru' : undefined}
            onAction={isAdmin ? () => setIsNewFolderModalOpen(true) : undefined}
          />
        </div>
      ) : viewMode === 'grid' ? (
        /* ========================================================================= */
        /* GRID VIEW (Screenshot 1 & 2: Kartu Folder Bernomor & Berwarna, File Cards) */
        /* ========================================================================= */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayedItems.map((item, idx) => {
            const isFolder = item.type !== 'laporan';
            const fileCount = countFilesInNode(item);
            const colorKey = getItemColor(item, idx);
            const colorDef = FOLDER_COLORS[colorKey];
            const isLocked = lockedFolders[item.id] || false;
            const statusVal = folderStatuses[item.id] || (item.status === 'COMPLETED' ? 'Completed' : 'Inprogress');

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenFolder(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenFolder(item);
                  }
                }}
                className={`bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative flex flex-col items-center justify-between text-center cursor-pointer group select-none min-h-[175px] ${
                  item.type === 'laporan' ? 'hover:bg-slate-50/60' : ''
                }`}
              >
                {/* Header Kartu: Lock icon & 3-dots Menu Button */}
                <div className="w-full flex items-center justify-between mb-1" onClick={(e) => e.stopPropagation()}>
                  <div>
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400" title="Folder Terkunci" />
                    ) : (
                      <span className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Tombol 3 Titik (⋮) untuk memunculkan Context Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Opsi Folder"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* POPOVER CONTEXT MENU (Screenshot 2: Download, Rename, Share, Color Picker, Delete) */}
                    {activeMenuId === item.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-7 z-50 w-64 bg-[#0D1B2A] text-white rounded-xl shadow-2xl border border-slate-700/80 p-3 text-left animate-in fade-in zoom-in-95 duration-150 select-none"
                      >
                        {/* Baris Tombol Aksi Cepat */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            title="Unduh Berkas / Arsip"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Tombol Edit / Rename: HANYA UNTUK ADMIN */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditingItemName(item.name);
                                setActiveMenuId(null);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                              title="Ubah Nama Folder"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            title="Salin Tautan / Lokasi"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          {/* Tombol Kunci Folder: HANYA UNTUK ADMIN */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleLock(item.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                              title={isLocked ? "Buka Kunci Folder" : "Kunci Folder"}
                            >
                              {isLocked ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4" />}
                            </button>
                          )}

                          {/* Tombol Hapus: HANYA UNTUK ADMIN */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                              title="Hapus Folder"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Palet Warna Folder (HANYA UNTUK ADMIN - Screenshot 2) */}
                        {isAdmin && isFolder && (
                          <div className="space-y-1.5 mb-2.5">
                            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                              Warna Folder
                            </span>
                            <div className="grid grid-cols-4 gap-1.5">
                              {Object.values(FOLDER_COLORS).map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleChangeColor(item.id, c.id)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                                  style={{ backgroundColor: c.hex }}
                                  title={c.label}
                                >
                                  {colorKey === c.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pengatur Status Folder (ADMIN) atau Tinjauan Status (ASLAB) */}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                          <span className="text-[10.5px] text-slate-400">Status:</span>
                          {isAdmin ? (
                            <select
                              value={statusVal}
                              onChange={(e) => handleChangeStatus(item.id, e.target.value as any)}
                              className="bg-white/10 text-white text-[11px] rounded px-2 py-0.5 border border-white/20 focus:outline-none cursor-pointer"
                            >
                              <option value="Inprogress" className="bg-[#0D1B2A] text-amber-400">Inprogress</option>
                              <option value="Completed" className="bg-[#0D1B2A] text-emerald-400">Completed</option>
                            </select>
                          ) : (
                            <span className={`text-[10.5px] font-bold ${statusVal === 'Completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {statusVal}
                            </span>
                          )}
                        </div>

                        {/* Banner Read-Only untuk Aslab */}
                        {isViewOnly && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-[9.5px] text-slate-400 text-center font-mono">
                            Hak Akses Aslab: Tinjauan Berkas
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tengah Kartu: Ikon Folder Grafis Bernomor atau Badge Berkas */}
                <div className="my-auto py-1">
                  {isFolder ? (
                    <NumberedFolderGraphic count={fileCount} colorHex={colorDef.hex} />
                  ) : (
                    <FileTypeBadge name={item.name} score={item.skor_orisinalitas} />
                  )}
                </div>

                {/* Bawah Kartu: Nama Item & Metadata */}
                <div className="w-full mt-2" onClick={(e) => editingItemId === item.id && e.stopPropagation()}>
                  {editingItemId === item.id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        value={editingItemName}
                        onChange={(e) => setEditingItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(item);
                          if (e.key === 'Escape') setEditingItemId(null);
                        }}
                        autoFocus
                        className="w-full text-xs font-semibold text-[#0D1B2A] bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(item)}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Simpan Nama"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                        title="Batal"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 
                        className="text-xs font-bold text-[#0D1B2A] truncate w-full group-hover:text-emerald-700 transition-colors" 
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                        {isFolder 
                          ? `${fileCount} Berkas Terdaftar` 
                          : (item.nim ? `NIM: ${item.nim}` : 'Laporan Mahasiswa')
                        }
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Kartu Tambah Folder Baru (HANYA TAMPIL UNTUK ADMIN - Screenshot 1) */}
          {isAdmin && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                const currentDepthType = currentPath[currentPath.length - 1].type;
                if (currentDepthType === 'root') setNewFolderType('prodi');
                else if (currentDepthType === 'prodi') setNewFolderType('matkul');
                else setNewFolderType('kelas');
                setIsNewFolderModalOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsNewFolderModalOpen(true);
                }
              }}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-slate-50/50 hover:bg-emerald-50/30 rounded-2xl p-4 transition-all flex flex-col items-center justify-center text-center cursor-pointer group min-h-[175px]"
              title="Tambah Folder Baru"
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-emerald-600 group-hover:text-white text-slate-500 flex items-center justify-center transition-colors mb-2 shadow-2xs">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-800">
                Tambah Folder Baru
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Struktur Akademik
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* LIST VIEW (Screenshot 3: Tabel Type, Name, Status, Modified, Action)      */
        /* ========================================================================= */
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold font-mono text-[11px]">
                  <th className="py-3 px-4 w-14">Type</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 w-36">Status</th>
                  <th className="py-3 px-4 w-36">Modified</th>
                  <th className="py-3 px-4 w-44 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.map((item, idx) => {
                  const isFolder = item.type !== 'laporan';
                  const fileCount = countFilesInNode(item);
                  const colorKey = getItemColor(item, idx);
                  const colorDef = FOLDER_COLORS[colorKey];
                  const isLocked = lockedFolders[item.id] || false;
                  const statusVal = folderStatuses[item.id] || (item.status === 'COMPLETED' ? 'Completed' : 'Inprogress');

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleOpenFolder(item)}
                    >
                      {/* 1. Kolom TYPE */}
                      <td className="py-3 px-4">
                        {isFolder ? (
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-2xs"
                            style={{ backgroundColor: colorDef.hex }}
                          >
                            <Folder className="w-4 h-4 fill-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold font-mono text-[9px]">
                            PDF
                          </div>
                        )}
                      </td>

                      {/* 2. Kolom NAME */}
                      <td className="py-3 px-4" onClick={(e) => editingItemId === item.id && e.stopPropagation()}>
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-1.5 max-w-sm">
                            <input
                              type="text"
                              value={editingItemName}
                              onChange={(e) => setEditingItemName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(item);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                              autoFocus
                              className="text-xs font-semibold text-[#0D1B2A] bg-amber-50 border border-amber-300 rounded px-2 py-1 w-full focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(item)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {item.name}
                            </span>
                            {isFolder && (
                              <span className="text-slate-400 font-mono text-[11px]">
                                ({fileCount} files)
                              </span>
                            )}
                            {item.skor_orisinalitas !== undefined && (
                              <span 
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  item.skor_orisinalitas >= 75 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.skor_orisinalitas.toFixed(1)}% Orisinal
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Kolom STATUS */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <select
                            value={statusVal}
                            onChange={(e) => handleChangeStatus(item.id, e.target.value as any)}
                            className={`text-xs font-semibold rounded-md px-2 py-1 border transition-colors cursor-pointer ${
                              statusVal === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <option value="Inprogress">Inprogress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              statusVal === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {statusVal}
                          </span>
                        )}
                      </td>

                      {/* 4. Kolom MODIFIED */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {item.updated_at 
                          ? new Date(item.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '09/Okt/2026'
                        }
                      </td>

                      {/* 5. Kolom ACTION (Screenshot 3) */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          {/* Tombol Lihat / Detail Naskah */}
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(item)}
                            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Buka / Pratinjau"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Tombol Unduh */}
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Unduh Berkas"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Tombol Bagikan */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Salin Tautan"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          {/* AKSI KHUSUS ADMIN (Rename, Color Picker, Delete) */}
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingItemName(item.name);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                                title="Ubah Nama"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                                className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                                title="Ganti Warna Folder"
                              >
                                <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: colorDef.hex }} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 rounded hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL TAMBAH FOLDER BARU (HANYA UNTUK ADMIN) */}
      {isAdmin && isNewFolderModalOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0D1B2A]">Tambah Folder Akademik Baru</h3>
                  <p className="text-[11px] text-slate-500">Buat folder program studi, mata kuliah, atau kelas.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewFolder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Tingkat Struktur Folder</label>
                <select
                  value={newFolderType}
                  onChange={(e) => setNewFolderType(e.target.value as any)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="prodi">Program Studi (Root Folder)</option>
                  <option value="matkul">Mata Kuliah</option>
                  <option value="kelas">Kelas Praktikum</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Nama Folder</label>
                <Input
                  type="text"
                  placeholder="Contoh: Teknik Elektro, Desain Web, dsb..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  disabled={createProdiMutation.isPending || createMatkulMutation.isPending || createKelasMutation.isPending}
                >
                  Simpan Folder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
