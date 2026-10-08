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
  FolderOpen,
  UploadCloud,
  FolderPlus
} from 'lucide-react';
import { useToast } from './ui/toast-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
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

export type FolderColor = 'slate' | 'amber' | 'blue' | 'mint' | 'purple' | 'lime' | 'rose' | 'brass';

interface ColorDefinition {
  id: FolderColor;
  label: string;
  hex: string;
}

export const FOLDER_COLORS: Record<FolderColor, ColorDefinition> = {
  slate: { id: 'slate', label: 'Slate', hex: '#64748B' },
  amber: { id: 'amber', label: 'Amber', hex: '#F59E0B' },
  blue: { id: 'blue', label: 'Blue', hex: '#0284C7' },
  mint: { id: 'mint', label: 'Mint', hex: '#10B981' },
  purple: { id: 'purple', label: 'Violet', hex: '#8B5CF6' },
  lime: { id: 'lime', label: 'Lime', hex: '#84CC16' },
  rose: { id: 'rose', label: 'Rose', hex: '#F43F5E' },
  brass: { id: 'brass', label: 'Brass', hex: '#D4AF37' }
};

// SVG Ikon Folder Minimalis dengan Angka Jumlah Berkas di Tengah
function NumberedFolderGraphic({ count, colorHex }: { count: number; colorHex: string }) {
  return (
    <div className="relative w-22 h-16 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 select-none py-1">
      <svg 
        viewBox="0 0 108 84" 
        className="w-full h-full filter drop-shadow-2xs" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tab Belakang Folder */}
        <path 
          d="M 12 16 C 12 11, 16 7, 21 7 L 44 7 C 48 7, 51 9, 53 12 L 58 18 L 88 18 C 93 18, 97 22, 97 27 L 97 68 C 97 73, 93 77, 88 77 L 21 77 C 16 77, 12 73, 12 68 Z" 
          fill={colorHex} 
          fillOpacity="0.85" 
        />
        {/* Saku Depan Folder */}
        <path 
          d="M 8 28 C 8 23, 12 19, 17 19 L 91 19 C 96 19, 100 23, 100 28 L 98 69 C 98 74, 94 78, 89 78 L 19 78 C 14 78, 10 74, 10 69 Z" 
          fill={colorHex} 
        />
        {/* Garis Kilap Halus */}
        <path 
          d="M 18 21 L 90 21" 
          stroke="rgba(255,255,255,0.4)" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
        />
        {/* Angka Hitung Berkas */}
        <text 
          x="54" 
          y="56" 
          textAnchor="middle" 
          fill="#FFFFFF" 
          fontWeight="800" 
          fontSize="24" 
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {count}
        </text>
      </svg>
    </div>
  );
}

// Ikon Badge Berkas Dokumen Minimalis
function MinimalistFileGraphic({ score }: { score?: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-1">
      <div className="w-13 h-15 rounded-xl bg-rose-50/70 border border-rose-200/90 flex flex-col items-center justify-center relative shadow-2xs group-hover:scale-105 transition-transform">
        <FileText className="w-5.5 h-5.5 text-rose-600 stroke-[1.8]" />
        <span className="text-[8.5px] font-extrabold font-mono text-rose-700 tracking-wider mt-0.5">PDF</span>
      </div>
      {score !== undefined && (
        <span 
          className={`text-[9.5px] font-mono font-bold px-2 py-0.2 rounded-full border shadow-2xs mt-1.5 ${
            score >= 75 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90' 
              : 'bg-rose-50 text-rose-700 border-rose-200/90'
          }`}
        >
          {score.toFixed(0)}% Orisinal
        </span>
      )}
    </div>
  );
}

export interface BreadcrumbCrumb {
  id: string;
  name: string;
  type: 'root' | 'prodi' | 'matkul' | 'kelas';
}

export interface FlattenedNavItem extends NavItem {
  parentTrail?: BreadcrumbCrumb[];
  parentLabel?: string;
}

// 1. Helper rekursif: kumpulkan seluruh item bertipe tertentu dari subtree
function collectItemsByType(
  nodes: NavItem[],
  targetType: 'prodi' | 'matkul' | 'kelas' | 'laporan',
  currentTrail: BreadcrumbCrumb[] = [{ id: 'root', name: 'Direktori Utama', type: 'root' }]
): FlattenedNavItem[] {
  let result: FlattenedNavItem[] = [];

  for (const node of nodes) {
    const nodeTrail: BreadcrumbCrumb[] = [
      ...currentTrail,
      { id: node.id, name: node.name, type: node.type as BreadcrumbCrumb['type'] }
    ];

    if (node.type === targetType) {
      const parentLabelParts = currentTrail.slice(1).map(c => c.name);
      const parentLabel = parentLabelParts.length > 0 ? parentLabelParts.join(' / ') : undefined;

      result.push({
        ...node,
        parentTrail: nodeTrail,
        parentLabel
      });
    }

    if (node.children && node.children.length > 0) {
      result = result.concat(collectItemsByType(node.children, targetType, nodeTrail));
    }
  }

  return result;
}

// 2. Helper rekursif: temukan jejak navigasi lengkap dari root ke target ID
function findNodeTrail(
  nodes: NavItem[],
  targetId: string,
  currentTrail: BreadcrumbCrumb[] = [{ id: 'root', name: 'Direktori Utama', type: 'root' }]
): BreadcrumbCrumb[] | null {
  for (const node of nodes) {
    const nodeTrail: BreadcrumbCrumb[] = [
      ...currentTrail,
      { id: node.id, name: node.name, type: node.type as BreadcrumbCrumb['type'] }
    ];

    if (node.id === targetId) {
      return nodeTrail;
    }

    if (node.children && node.children.length > 0) {
      const found = findNodeTrail(node.children, targetId, nodeTrail);
      if (found) return found;
    }
  }
  return null;
}

// 3. Helper rekursif: pencarian global di seluruh pohon direktori
function searchItemsGlobally(
  nodes: NavItem[],
  query: string,
  currentTrail: BreadcrumbCrumb[] = [{ id: 'root', name: 'Direktori Utama', type: 'root' }]
): FlattenedNavItem[] {
  const q = query.toLowerCase().trim();
  let result: FlattenedNavItem[] = [];

  for (const node of nodes) {
    const nodeTrail: BreadcrumbCrumb[] = [
      ...currentTrail,
      { id: node.id, name: node.name, type: node.type as BreadcrumbCrumb['type'] }
    ];

    const matchName = node.name.toLowerCase().includes(q);
    const matchNim = node.nim?.toLowerCase().includes(q);

    if (matchName || matchNim) {
      const parentLabelParts = currentTrail.slice(1).map(c => c.name);
      const parentLabel = parentLabelParts.length > 0 ? parentLabelParts.join(' / ') : undefined;

      result.push({
        ...node,
        parentTrail: nodeTrail,
        parentLabel
      });
    }

    if (node.children && node.children.length > 0) {
      result = result.concat(searchItemsGlobally(node.children, query, nodeTrail));
    }
  }

  return result;
}

export default function AcademicFileManager({
  role,
  navData = [],
  isLoading = false,
  onSelectLaporan,
  className = ''
}: AcademicFileManagerProps) {
  const toast = useToast();
  const navigate = useNavigate();

  // Mode Tampilan: Grid (▦) atau List (≡)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Breadcrumbs Trail
  const [currentPath, setCurrentPath] = useState<BreadcrumbCrumb[]>([
    { id: 'root', name: 'Direktori Utama', type: 'root' }
  ]);

  // Pencarian
  const [searchTerm, setSearchTerm] = useState('');

  // Tab Kategori: 'ALL' | 'prodi' | 'matkul' | 'kelas' | 'laporan'
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'prodi' | 'matkul' | 'kelas' | 'laporan'>('ALL');

  // Custom Metadata (Warna Folder & Status) - Disimpan di localStorage
  const [folderColors, setFolderColors] = useState<Record<string, FolderColor>>({});
  const [lockedFolders, setLockedFolders] = useState<Record<string, boolean>>({});

  // Menu Konteks Popover (3-Dots)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modal Tambah Folder Baru (Hanya Admin)
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'prodi' | 'matkul' | 'kelas'>('prodi');

  // Inline Rename (Hanya Admin)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');

  const isAdmin = role === 'ADMIN';

  // Mutations
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

  // Load persisted colors from localStorage
  useEffect(() => {
    try {
      const savedColors = localStorage.getItem('stitek_filemanager_colors');
      if (savedColors) setFolderColors(JSON.parse(savedColors));

      const savedLocks = localStorage.getItem('stitek_filemanager_locks');
      if (savedLocks) setLockedFolders(JSON.parse(savedLocks));
    } catch {
      // noop
    }
  }, []);

  const saveColors = (newColors: Record<string, FolderColor>) => {
    setFolderColors(newColors);
    localStorage.setItem('stitek_filemanager_colors', JSON.stringify(newColors));
  };

  const saveLocks = (newLocks: Record<string, boolean>) => {
    setLockedFolders(newLocks);
    localStorage.setItem('stitek_filemanager_locks', JSON.stringify(newLocks));
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Current node in tree
  const currentNode = useMemo(() => {
    if (currentPath.length <= 1) return null;

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

  // Kategori Counts (Dihitung di seluruh direktori untuk lencana kuantitas)
  const categoryCounts = useMemo(() => {
    const prodis = collectItemsByType(navData, 'prodi');
    const matkuls = collectItemsByType(navData, 'matkul');
    const kelas = collectItemsByType(navData, 'kelas');
    const reports = collectItemsByType(navData, 'laporan');

    return {
      prodi: prodis.length,
      matkul: matkuls.length,
      kelas: kelas.length,
      laporan: reports.length,
      all: currentPath.length === 1 ? navData.length : (currentNode?.children?.length || 0)
    };
  }, [navData, currentPath.length, currentNode]);

  // Displayed items in current folder view
  const displayedItems = useMemo<FlattenedNavItem[]>(() => {
    // 1. Jika ada kata kunci pencarian -> Pencarian Rekursif Global di seluruh sistem
    if (searchTerm.trim()) {
      let results = searchItemsGlobally(navData, searchTerm);
      if (activeCategory !== 'ALL') {
        results = results.filter(item => item.type === activeCategory);
      }
      return results;
    }

    // 2. Jika filter kategori aktif spesifik (Smart Category Flattening)
    if (activeCategory !== 'ALL') {
      const baseNodes = currentPath.length === 1 
        ? navData 
        : (currentNode?.children || []);

      return collectItemsByType(baseNodes, activeCategory, currentPath);
    }

    // 3. Jika 'ALL' -> Navigasi Hirarkis Standar
    if (currentPath.length === 1) {
      return navData.map(item => ({
        ...item,
        parentTrail: [
          { id: 'root', name: 'Direktori Utama', type: 'root' },
          { id: item.id, name: item.name, type: item.type as BreadcrumbCrumb['type'] }
        ]
      }));
    } else if (currentNode && currentNode.children) {
      return currentNode.children.map(item => ({
        ...item,
        parentTrail: [
          ...currentPath,
          { id: item.id, name: item.name, type: item.type as BreadcrumbCrumb['type'] }
        ]
      }));
    }

    return [];
  }, [currentPath, currentNode, navData, activeCategory, searchTerm]);

  const countFilesInNode = (node: NavItem): number => {
    if (node.type === 'laporan') return 1;
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((acc, child) => acc + countFilesInNode(child), 0);
  };

  const getItemColor = (item: NavItem, idx: number): FolderColor => {
    if (folderColors[item.id]) return folderColors[item.id];
    const palette: FolderColor[] = ['amber', 'blue', 'mint', 'purple', 'slate', 'lime', 'rose', 'brass'];
    return palette[idx % palette.length];
  };

  const handleOpenFolder = (item: FlattenedNavItem) => {
    if (item.type === 'laporan') {
      if (onSelectLaporan) onSelectLaporan(item.id);
      else navigate(`/aslab/view/${item.id}`);
      return;
    }

    // Jika item memiliki jejak breadcrumbs lengkap (dari flattening atau pencarian)
    if (item.parentTrail && item.parentTrail.length > 0) {
      setCurrentPath(item.parentTrail);
    } else {
      const fullTrail = findNodeTrail(navData, item.id);
      if (fullTrail) {
        setCurrentPath(fullTrail);
      } else {
        setCurrentPath(prev => [...prev, { id: item.id, name: item.name, type: item.type as BreadcrumbCrumb['type'] }]);
      }
    }
    setActiveCategory('ALL');
    setSearchTerm('');
    setActiveMenuId(null);
  };

  const handleGoBack = () => {
    if (currentPath.length > 1) {
      setCurrentPath(prev => prev.slice(0, prev.length - 1));
      setActiveCategory('ALL');
      setActiveMenuId(null);
    }
  };

  const handleNavigatePathIndex = (index: number) => {
    setCurrentPath(prev => prev.slice(0, index + 1));
    setActiveCategory('ALL');
    setActiveMenuId(null);
  };

  const handleCopyLink = (item: NavItem) => {
    navigator.clipboard.writeText(window.location.origin + `/aslab/view/${item.id}`);
    toast.success('Tautan Tersalin', `Lokasi tautan "${item.name}" berhasil disalin.`);
    setActiveMenuId(null);
  };

  const handleDownload = (item: NavItem) => {
    if (item.tautan_berkas) {
      window.open(item.tautan_berkas, '_blank');
    } else {
      toast.info('Unduh Berkas', `Menyiapkan unduhan "${item.name}"...`);
    }
    setActiveMenuId(null);
  };

  const handleChangeColor = (itemId: string, newColor: FolderColor) => {
    if (!isAdmin) return;
    const updated = { ...folderColors, [itemId]: newColor };
    saveColors(updated);
    toast.success('Warna Diperbarui', `Warna folder disetel ke ${FOLDER_COLORS[newColor].label}.`);
  };

  const handleToggleLock = (itemId: string) => {
    if (!isAdmin) return;
    const updated = { ...lockedFolders, [itemId]: !lockedFolders[itemId] };
    saveLocks(updated);
    toast.info('Proteksi Folder', updated[itemId] ? 'Folder dikunci.' : 'Kunci folder dibuka.');
  };

  const handleDeleteItem = async (item: NavItem) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm(`Hapus "${item.name}" dari direktori?`);
    if (!confirmDelete) return;

    try {
      if (item.type === 'prodi') await deleteProdiMutation.mutateAsync(item.id);
      else if (item.type === 'matkul') await deleteMatkulMutation.mutateAsync(item.id);
      else if (item.type === 'kelas') await deleteKelasMutation.mutateAsync(item.id);
      else if (item.type === 'laporan') await deleteReportMutation.mutateAsync(item.id);
      toast.success('Berhasil Dihapus', `"${item.name}" telah dihapus.`);
      setActiveMenuId(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus', err.message || 'Terjadi galat.');
    }
  };

  const handleSaveRename = async (item: NavItem) => {
    if (!isAdmin || !editingItemName.trim()) {
      setEditingItemId(null);
      return;
    }

    try {
      if (item.type === 'prodi') await updateProdiMutation.mutateAsync({ id: item.id, nama_prodi: editingItemName.trim() });
      else if (item.type === 'matkul') await updateMatkulMutation.mutateAsync({ id: item.id, nama_matkul: editingItemName.trim() });
      else if (item.type === 'kelas') await updateKelasMutation.mutateAsync({ id_kelas: item.id, nama_kelas: editingItemName.trim() });
      toast.success('Nama Diperbarui', `Nama berhasil disimpan.`);
      setEditingItemId(null);
    } catch (err: any) {
      toast.error('Gagal Memperbarui', err.message || 'Terjadi galat.');
    }
  };

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
      toast.success('Folder Dibuat', `Folder baru "${newFolderName.trim()}" ditambahkan.`);
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
    } catch (err: any) {
      toast.error('Gagal Membuat Folder', err.message || 'Periksa koneksi sistem.');
    }
  };

  return (
    <div className={`space-y-4 ${className} font-sans text-[#0D1B2A]`}>
      {/* 1. HEADER FILE MANAGER MINIMALIS & BERSIH (1 Baris Utama + 1 Baris Kategori) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
        {/* Baris 1: Breadcrumbs Trail & Tools */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          {/* Navigasi Breadcrumbs */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {currentPath.length > 1 && (
              <button
                type="button"
                onClick={handleGoBack}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer mr-0.5"
                title="Kembali ke folder sebelumnya"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              {currentPath.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <span className="text-slate-300 font-mono">/</span>}
                  <button
                    type="button"
                    onClick={() => handleNavigatePathIndex(idx)}
                    className={`px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer truncate max-w-[170px] ${
                      idx === currentPath.length - 1 && activeCategory === 'ALL' && !searchTerm
                        ? 'font-bold text-[#0D1B2A] bg-slate-100 text-xs' 
                        : 'text-slate-500 hover:text-slate-800 text-xs'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}

              {activeCategory !== 'ALL' && (
                <>
                  <span className="text-slate-300 font-mono">/</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/90 text-amber-900 font-medium text-xs shadow-2xs">
                    <span>
                      {activeCategory === 'prodi' ? 'Semua Prodi' :
                       activeCategory === 'matkul' ? 'Semua Mata Kuliah' :
                       activeCategory === 'kelas' ? 'Semua Kelas' : 'Semua Laporan'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('ALL')}
                      className="hover:text-amber-950 p-0.5 cursor-pointer ml-0.5"
                      title="Kembali ke direktori normal"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </>
              )}

              {searchTerm.trim() && (
                <>
                  <span className="text-slate-300 font-mono">/</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200/90 text-sky-900 font-medium text-xs shadow-2xs">
                    <span>Cari: "{searchTerm}"</span>
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="hover:text-sky-950 p-0.5 cursor-pointer ml-0.5"
                      title="Hapus pencarian"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </>
              )}
            </div>

            <span className="text-[11px] font-mono text-slate-400 ml-1">
              ({displayedItems.length} item)
            </span>
          </div>

          {/* Sisi Kanan: Pencarian, Switcher View, & Tombol Admin */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
            {isAdmin && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  onClick={() => setIsNewFolderModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-[11px] font-semibold border-slate-300 px-2 sm:px-3"
                >
                  <Plus className="w-3 h-3 text-emerald-600" />
                  <span>Folder</span>
                </Button>
                <Button
                  onClick={() => navigate('/admin/seeding')}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-[11px] font-semibold border-slate-300 px-2 sm:px-3"
                >
                  <UploadCloud className="w-3 h-3 text-sky-600" />
                  <span>Unggah</span>
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              {/* Kotak Pencarian Minimalis */}
              <div className="relative flex-1 sm:w-60">
                <Input
                  type="text"
                  placeholder="Cari naskah / NIM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs pl-7 pr-3 bg-slate-50/70 border-slate-200 rounded-lg focus:border-[#D4AF37] focus:bg-white transition-all font-sans"
                />
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Switcher Tampilan Grid / List */}
              <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white shadow-2xs text-[#0D1B2A] font-bold'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Tabel Berkas"
                >
                  <ListIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white shadow-2xs text-[#0D1B2A] font-bold'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Grid Kartu"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Baris 2: Tab Filter Kategori Ringkas dengan Counter Badge */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto text-[11px] no-scrollbar">
          {(['ALL', 'prodi', 'matkul', 'kelas', 'laporan'] as const).map((cat) => {
            const config = {
              ALL: { label: 'Semua', count: categoryCounts.all },
              prodi: { label: 'Prodi', count: categoryCounts.prodi },
              matkul: { label: 'Mata Kuliah', count: categoryCounts.matkul },
              kelas: { label: 'Kelas', count: categoryCounts.kelas },
              laporan: { label: 'Naskah Laporan', count: categoryCounts.laporan }
            }[cat];

            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`group px-3 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[#0D1B2A] text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                }`}
              >
                <span>{config.label}</span>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                  }`}
                >
                  {config.count}
                </span>
              </button>
            );
          })}

          {activeCategory !== 'ALL' && (
            <span className="text-[10px] text-slate-400 font-sans ml-auto hidden md:inline-block pr-1">
              Menampilkan seluruh entitas ({activeCategory === 'matkul' ? 'mata kuliah' : activeCategory})
            </span>
          )}
        </div>
      </div>

      {/* 2. KONTEN UTAMA: GRID ATAU LIST VIEW */}
      {isLoading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-16 shadow-xs flex items-center justify-center">
          <LoadingSpinner variant="inline" message="Menyelaraskan direktori file manager..." />
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 shadow-xs text-center space-y-4">
          <EmptyState
            icon={Folder}
            title={
              searchTerm
                ? 'Tidak Ada Berkas yang Cocok'
                : activeCategory !== 'ALL'
                ? `Belum Ada ${activeCategory === 'matkul' ? 'Mata Kuliah' : activeCategory === 'kelas' ? 'Kelas' : activeCategory === 'prodi' ? 'Prodi' : 'Naskah Laporan'}`
                : 'Direktori Masih Kosong'
            }
            description={
              searchTerm
                ? `Tidak ditemukan berkas dengan kata kunci "${searchTerm}". Silakan periksa kembali ejaan atau NIM.`
                : activeCategory !== 'ALL'
                ? `Tidak ditemukan berkas dalam kategori ini pada lokasi yang dipilih.`
                : 'Belum ada berkas atau subfolder pada lokasi ini.'
            }
            actionLabel={
              searchTerm
                ? 'Hapus Pencarian'
                : activeCategory !== 'ALL'
                ? 'Tampilkan Semua Berkas'
                : currentPath.length > 1
                ? 'Kembali ke Direktori Utama'
                : isAdmin ? '+ Tambah Folder Baru' : undefined
            }
            onAction={
              searchTerm
                ? () => setSearchTerm('')
                : activeCategory !== 'ALL'
                ? () => setActiveCategory('ALL')
                : currentPath.length > 1
                ? () => setCurrentPath([{ id: 'root', name: 'Direktori Utama', type: 'root' }])
                : isAdmin ? () => setIsNewFolderModalOpen(true) : undefined
            }
          />

          {currentPath.length > 1 && !searchTerm && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                className="text-xs gap-1 border-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Folder Sebelumnya</span>
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= GRID VIEW MINIMALIS ================= */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {displayedItems.map((item, idx) => {
            const isFolder = item.type !== 'laporan';
            const fileCount = countFilesInNode(item);
            const colorKey = getItemColor(item, idx);
            const colorDef = FOLDER_COLORS[colorKey];
            const isLocked = lockedFolders[item.id] || false;

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
                className={`bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all relative flex flex-col items-center justify-between text-center cursor-pointer group select-none min-h-[160px] ${
                  item.type === 'laporan' ? 'hover:bg-slate-50/50' : ''
                }`}
              >
                {/* Header Kartu: Status Lock & Tombol Menu 3 Titik Minimalis */}
                <div className="w-full flex items-center justify-between mb-1" onClick={(e) => e.stopPropagation()}>
                  <div>
                    {isLocked ? (
                      <span title="Terkunci"><Lock className="w-3.5 h-3.5 text-slate-400" /></span>
                    ) : (
                      <span className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Tombol 3 Titik (⋮) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                      className="p-1 rounded-md text-slate-300 group-hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Opsi Berkas"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* POPOVER DETAIL MINIMALIS (Sleek White Card, Tanpa Kotak Hitam Besar) */}
                    {activeMenuId === item.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-6.5 z-50 w-44 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200/90 py-1.5 px-1 text-left animate-in fade-in zoom-in-95 duration-150 select-none"
                      >
                        {/* 1. Buka / Pratinjau */}
                        <button
                          type="button"
                          onClick={() => handleOpenFolder(item)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isFolder ? <FolderOpen className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                          <span>{isFolder ? 'Buka Folder' : 'Lihat Analisis'}</span>
                        </button>

                        {/* 2. Unduh Berkas / Arsip */}
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isFolder ? 'Unduh Arsip' : 'Unduh Dokumen'}</span>
                        </button>

                        {/* 3. Salin Tautan */}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Salin Tautan</span>
                        </button>

                        {/* FITUR KHUSUS ADMIN (Ubah Nama, Palet Warna, Hapus) */}
                        {isAdmin && (
                          <>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditingItemName(item.name);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Ubah Nama</span>
                            </button>

                            {isFolder && (
                              <div className="px-2.5 py-1.5 border-t border-slate-100 mt-1">
                                <span className="text-[10px] font-mono text-slate-400 block mb-1">Warna Folder</span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {Object.values(FOLDER_COLORS).slice(0, 6).map(c => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => handleChangeColor(item.id, c.id)}
                                      className="w-4 h-4 rounded-full transition-transform hover:scale-125 relative"
                                      style={{ backgroundColor: c.hex }}
                                      title={c.label}
                                    >
                                      {colorKey === c.id && <Check className="w-2.5 h-2.5 text-white stroke-[3] mx-auto" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="my-1 border-t border-slate-100" />
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bagian Tengah: Ikon Folder Bernomor atau Badge Dokumen */}
                <div className="my-auto py-1">
                  {isFolder ? (
                    <NumberedFolderGraphic count={fileCount} colorHex={colorDef.hex} />
                  ) : (
                    <MinimalistFileGraphic score={item.skor_orisinalitas} />
                  )}
                </div>

                {/* Bagian Bawah: Nama Entitas & Metadata Minimalis */}
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
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        title="Simpan"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                        title="Batal"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 
                        className="text-xs font-semibold text-slate-900 truncate w-full group-hover:text-emerald-700 transition-colors" 
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      {item.parentLabel && (
                        <span 
                          className="inline-block text-[9px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 mt-0.5 truncate max-w-full"
                          title={item.parentLabel}
                        >
                          {item.parentLabel}
                        </span>
                      )}
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        {isFolder 
                          ? `${fileCount} berkas` 
                          : (item.nim ? `NIM: ${item.nim}` : 'Naskah Mahasiswa')
                        }
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Kartu Tambah Folder Baru (HANYA UNTUK ADMIN) */}
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
              className="border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-slate-50/50 hover:bg-emerald-50/30 rounded-xl p-3.5 transition-all flex flex-col items-center justify-center text-center cursor-pointer group min-h-[160px]"
              title="Tambah Folder Baru"
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-emerald-600 group-hover:text-white text-slate-500 flex items-center justify-center transition-colors mb-2 shadow-2xs">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-800">
                Tambah Folder
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Akademik
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ================= LIST VIEW TABEL MINIMALIS ================= */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold font-mono text-[11px]">
                  <th className="py-2.5 px-3 sm:px-4 w-10 sm:w-12">Tipe</th>
                  <th className="py-2.5 px-3 sm:px-4">Nama</th>
                  <th className="py-2.5 px-4 w-28 hidden sm:table-cell">Status</th>
                  <th className="py-2.5 px-4 w-28 hidden md:table-cell">Dimodifikasi</th>
                  <th className="py-2.5 px-3 sm:px-4 w-24 sm:w-32 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.map((item, idx) => {
                  const isFolder = item.type !== 'laporan';
                  const fileCount = countFilesInNode(item);
                  const colorKey = getItemColor(item, idx);
                  const colorDef = FOLDER_COLORS[colorKey];

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleOpenFolder(item)}
                    >
                      <td className="py-2.5 px-3 sm:px-4">
                        {isFolder ? (
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shadow-2xs"
                            style={{ backgroundColor: colorDef.hex }}
                          >
                            <Folder className="w-3.5 h-3.5 fill-white" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold font-mono text-[8.5px]">
                            PDF
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 sm:px-4" onClick={(e) => editingItemId === item.id && e.stopPropagation()}>
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
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                {item.name}
                              </span>
                              {isFolder && (
                                <span className="text-slate-400 font-mono text-[10px] sm:text-[11px]">
                                  ({fileCount} berkas)
                                </span>
                              )}
                              {item.skor_orisinalitas !== undefined && (
                                <span 
                                  className={`text-[9px] sm:text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${
                                    item.skor_orisinalitas >= 75 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {item.skor_orisinalitas.toFixed(0)}%
                                </span>
                              )}
                              {/* Status Badge Ringkas di Mobile */}
                              {!isFolder && item.status && (
                                <span className={`sm:hidden text-[8.5px] font-mono px-1 rounded-sm border ${
                                  item.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {item.status === 'COMPLETED' ? 'Selesai' : 'Proses'}
                                </span>
                              )}
                            </div>
                            {item.parentLabel && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-sm mt-0.5">
                                {item.parentLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] hidden sm:table-cell">
                        {item.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                            Selesai
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
                            Diproses
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] hidden md:table-cell">
                        {item.updated_at 
                          ? new Date(item.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '09/Okt/2026'
                        }
                      </td>

                      <td className="py-2.5 px-3 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(item)}
                            className="p-1 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Buka"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            className="p-1 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Unduh"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="p-1 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Salin Tautan"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingItemName(item.name);
                                }}
                                className="p-1 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                                title="Ubah Nama"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="p-1 rounded hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* 3. MODAL TAMBAH FOLDER BARU (ADMIN ONLY) */}
      {isAdmin && isNewFolderModalOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-[#0D1B2A]">Tambah Folder Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewFolder} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">Tingkat Struktur</label>
                <select
                  value={newFolderType}
                  onChange={(e) => setNewFolderType(e.target.value as any)}
                  className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="prodi">Program Studi (Root)</option>
                  <option value="matkul">Mata Kuliah</option>
                  <option value="kelas">Kelas Praktikum</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">Nama Folder</label>
                <Input
                  type="text"
                  placeholder="Nama folder..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="text-xs h-8"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8"
                  disabled={createProdiMutation.isPending || createMatkulMutation.isPending || createKelasMutation.isPending}
                >
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
