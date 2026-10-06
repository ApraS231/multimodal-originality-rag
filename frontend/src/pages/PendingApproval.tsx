import { Hourglass, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GroupedList, GroupedItem } from '../components/ui/grouped-list';
import StatusBadge from '../components/ui/status-badge';

interface PendingApprovalProps {
  user: any;
  onLogout: () => void;
}

export default function PendingApproval({ user, onLogout }: PendingApprovalProps) {
  const status = user?.profil?.status_persetujuan || 'PENDING';

  return (
    <div className="min-h-screen bg-[#F7F3E9] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-[#0D1B2A]">
      {/* Main Solid Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-lg p-8 shadow-sm relative z-10 text-center space-y-6">
        {/* Top accent line */}
        <div 
          className={`absolute top-0 left-0 w-full h-1 rounded-t-lg ${
            status === 'PENDING' ? 'bg-amber-500' : 'bg-rose-600'
          }`} 
        />

        {/* Status Icon */}
        <div className="flex justify-center">
          {status === 'PENDING' ? (
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
              <Hourglass className="w-7 h-7" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
          )}
        </div>

        {/* Header Title */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-[#0D1B2A]">
            {status === 'PENDING' ? 'Menunggu Persetujuan' : 'Pendaftaran Ditolak'}
          </h1>
          <p className="text-slate-600 text-xs leading-relaxed max-w-xs mx-auto">
            {status === 'PENDING' 
              ? 'Pendaftaran akun asisten laboratorium Anda sedang dalam antrean verifikasi oleh Administrator.'
              : 'Akses akun Anda ditolak oleh Administrator akademik.'
            }
          </p>
        </div>

        {/* Detail Akun Panel */}
        <GroupedList>
          <GroupedItem 
            label="Nama Lengkap" 
            action={<span className="font-semibold text-slate-800">{user?.nama || '-'}</span>} 
          />
          <GroupedItem 
            label="NIM" 
            action={<span className="font-mono text-slate-800">{user?.profil?.nim || '-'}</span>} 
          />
          <GroupedItem 
            label="Kode Asisten" 
            action={<span className="font-mono text-slate-800">{user?.profil?.kode_aslab || '-'}</span>} 
          />
          <GroupedItem 
            label="Status Otorisasi" 
            action={
              <StatusBadge status={status === 'PENDING' ? 'QUEUED' : 'FAILED'} />
            } 
          />
        </GroupedList>

        {/* Catatan / Panduan */}
        <div className="text-[11px] text-slate-700 leading-relaxed font-medium bg-slate-50/80 p-3.5 rounded-md border border-slate-200/80 text-left">
          {status === 'PENDING'
            ? 'Silakan berkoordinasi dengan Kepala Laboratorium atau Administrator Akademik untuk menyetujui akses akun Anda.'
            : 'Silakan hubungi Administrator jika terdapat kekeliruan dalam proses penolakan pendaftaran Anda.'
          }
        </div>

        {/* Action Button */}
        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full text-slate-700 hover:text-[#0D1B2A]"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Keluar dari Akun
        </Button>
      </div>
    </div>
  );
}
