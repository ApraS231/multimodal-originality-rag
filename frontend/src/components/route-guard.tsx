import { Navigate, Outlet } from 'react-router-dom';
import { useAbility } from '@casl/react';
import { useSession } from '../api/auth';
import LoadingSpinner from './ui/loading-spinner';

interface ProtectedRouteProps {
  subject: string;
  action: string;
  allowedRoles?: Array<'ADMIN' | 'ASLAB' | 'KEPALA_LAB'>;
}

export const ProtectedRoute = ({ subject, action, allowedRoles }: ProtectedRouteProps) => {
  const { data: session, isLoading } = useSession();
  const ability = useAbility();

  // 1. Tampilkan loading spinner jika sesi autentikasi masih diverifikasi
  if (isLoading) {
    return <LoadingSpinner variant="fullpage" message="Memvalidasi wewenang akses..." />;
  }

  // 2. Jika belum login sama sekali, arahkan ke halaman Login (bukan 403)
  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Ekstrak peran pengguna secara toleran (profil.peran maupun user.role)
  const userRole = (session.user.profil?.peran || (session.user as any)?.role || '').toUpperCase() as 'ADMIN' | 'ASLAB' | 'KEPALA_LAB';

  // 4. Tentukan daftar peran yang diizinkan untuk subjek ini
  let rolesPermitted = allowedRoles;
  if (!rolesPermitted) {
    if (subject === 'all' || subject === 'AdminPanel') {
      rolesPermitted = ['ADMIN'];
    } else if (subject === 'AslabPanel') {
      rolesPermitted = ['ASLAB', 'ADMIN'];
    } else if (subject === 'KepalaLabPanel') {
      rolesPermitted = ['KEPALA_LAB', 'ADMIN'];
    }
  }

  const hasRoleAccess = rolesPermitted ? rolesPermitted.includes(userRole) : false;
  const hasCaslAccess = ability.can(action as any, subject as any);

  // 5. Tolak hanya jika peran tidak cocok DAN CASL juga menolak
  if (!hasRoleAccess && !hasCaslAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
