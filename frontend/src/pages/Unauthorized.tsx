import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F3E9] text-[#0D1B2A] px-4 relative overflow-hidden font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-lg shadow-sm relative overflow-hidden text-center p-8 space-y-6">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-600" />
        
        <div className="mx-auto p-3.5 bg-rose-50 text-rose-600 rounded-lg w-fit border border-rose-200/60 shadow-2xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-[#0D1B2A]">403: Akses Ditolak</h1>
          <p className="text-slate-600 text-xs leading-relaxed max-w-sm mx-auto">
            Akun Anda tidak memiliki hak akses yang cukup untuk membuka halaman ini. Silakan hubungi Administrator untuk penyesuaian wewenang.
          </p>
        </div>

        <Button
          onClick={() => navigate('/redirect')}
          variant="default"
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Dasbor Utama
        </Button>
      </div>
    </div>
  );
}
