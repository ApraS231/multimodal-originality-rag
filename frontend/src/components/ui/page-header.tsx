import React from 'react';
import { useLocation, Link } from 'react-router-dom';

interface PageHeaderProps {
  /** Judul halaman (bagian pertama) */
  title: string;
  /** Judul halaman (bagian highlight aksen) */
  titleAccent?: string;
  /** Deskripsi singkat di bawah judul */
  description?: string;
  /** Slot aksi di sisi kanan header */
  actions?: React.ReactNode;
  /** Apakah breadcrumb otomatis ditampilkan */
  showBreadcrumb?: boolean;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  admin: 'Admin',
  aslab: 'Asisten Lab',
  'kepala-lab': 'Kepala Lab',
  dashboard: 'Dasbor',
  prodi: 'Program Studi',
  kelas: 'Kelas',
  matkul: 'Mata Kuliah',
  seeding: 'Cloud Seeding',
  repository: 'Direktori Berkas',
  'ai-config': 'Konfigurasi AI',
  'ai-performance': 'Visualisasi AI',
  'queue-monitor': 'Antrean',
  'audit-logs': 'Audit Logs',
  analytics: 'Analitik',
  checker: 'Pengecekan',
  profile: 'Profil',
  matrix: 'Matriks',
};

export default function PageHeader({ 
  title, 
  titleAccent, 
  description, 
  actions,
  showBreadcrumb = true
}: PageHeaderProps) {
  const location = useLocation();

  // Generate breadcrumb dari path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, idx) => ({
    label: BREADCRUMB_LABELS[segment] || segment,
    path: '/' + pathSegments.slice(0, idx + 1).join('/'),
    isLast: idx === pathSegments.length - 1,
  }));

  return (
    <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3.5 sm:pb-5 space-y-1.5 sm:space-y-2.5">
      {/* Breadcrumb Nav */}
      {showBreadcrumb && breadcrumbs.length > 1 && (
        <nav className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 overflow-x-auto whitespace-nowrap pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
              {crumb.isLast ? (
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{crumb.label}</span>
              ) : (
                <Link 
                  to={crumb.path} 
                  className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title + Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-sans text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            {title}{' '}
            {titleAccent && <span className="text-[#0D1B2A] dark:text-[#D4AF37]">{titleAccent}</span>}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 line-clamp-2 sm:line-clamp-none">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto shrink-0 justify-start sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
