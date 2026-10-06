import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useSession, useLogout } from './api/auth';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import PendingApproval from './pages/PendingApproval';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProdi from './pages/admin/Prodi';
import AdminKelas from './pages/admin/Kelas';
import AdminMatkul from './pages/admin/MataKuliah';
import AdminSeeding from './pages/admin/Seeding';
import AdminRepository from './pages/admin/Repository';
import AdminAnalytics from './pages/admin/Analytics';
import AdminAuditLogs from './pages/admin/AuditLogs';
import AdminAIConfig from './pages/admin/AIConfig';
import AdminAiPerformance from './pages/admin/AiPerformance';
import AdminQueueMonitor from './pages/admin/QueueMonitor';
import AdminUsers from './pages/admin/Users';
import AslabDashboard from './pages/aslab/Dashboard';
import AslabChecker from './pages/aslab/Checker';
import AslabDetail from './pages/aslab/Detail';
import AslabProfile from './pages/aslab/Profile';
import Welcome from './pages/Welcome';
import KepalaLabMatrix from './pages/kepala-lab/Matrix';
import KepalaLabDashboard from './pages/kepala-lab/Dashboard';
import { ProtectedRoute } from './components/route-guard';
import SidebarLayout from './components/SidebarLayout';
import LoadingSpinner from './components/ui/loading-spinner';


function RootRedirect() {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return <LoadingSpinner variant="fullpage" message="Menautkan autentikasi..." />;
  }

  const role = data?.user?.profil?.peran;
  const status = data?.user?.profil?.status_persetujuan;

  if (!data?.user) {
    return <Navigate to="/login" replace />;
  }

  if (status === 'PENDING' || status === 'REJECTED') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (role === 'ASLAB') {
    return <Navigate to="/aslab/dashboard" replace />;
  }
  if (role === 'KEPALA_LAB') {
    return <Navigate to="/kepala-lab/dashboard" replace />;
  }

  return <Navigate to="/unauthorized" replace />;
}

function ApprovalGuard() {
  const { data } = useSession();
  const status = data?.user?.profil?.status_persetujuan;

  if (status === 'PENDING' || status === 'REJECTED') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Outlet />;
}

function PendingApprovalWrapper() {
  const { data } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login');
  };

  return <PendingApproval user={data?.user} onLogout={handleLogout} />;
}

export default function App() {
  const { isLoading } = useSession();

  if (isLoading) {
    return <LoadingSpinner variant="fullpage" message="Menginisialisasi sistem keamanan..." />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rute Bebas */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/register-aslab" element={<Navigate to="/login?register=true" replace />} />
        <Route path="/pending-approval" element={<PendingApprovalWrapper />} />

        {/* Rute Root/Welcome Portal */}
        <Route path="/" element={<Welcome />} />
        <Route path="/redirect" element={<RootRedirect />} />

        {/* Rute Proteksi yang Butuh Persetujuan */}
        <Route element={<ApprovalGuard />}>
          {/* Rute Proteksi Admin */}
          <Route element={<ProtectedRoute action="manage" subject="all" />}>
            <Route element={<SidebarLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/prodi" element={<AdminProdi />} />
              <Route path="/admin/kelas" element={<AdminKelas />} />
              <Route path="/admin/matkul" element={<AdminMatkul />} />
              <Route path="/admin/seeding" element={<AdminSeeding />} />
              <Route path="/admin/repository" element={<AdminRepository />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/ai-config" element={<AdminAIConfig />} />
              <Route path="/admin/queue-monitor" element={<AdminQueueMonitor />} />
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>
            {/* Standalone Admin Page without Sidebar Layout */}
            <Route path="/admin/ai-performance" element={<AdminAiPerformance />} />
          </Route>

          {/* Rute Proteksi Aslab */}
          <Route element={<ProtectedRoute action="read" subject="AslabPanel" />}>
            <Route element={<SidebarLayout />}>
              <Route path="/aslab/dashboard" element={<AslabDashboard />} />
              <Route path="/aslab/checker" element={<AslabChecker />} />
              <Route path="/aslab/profile" element={<AslabProfile />} />
            </Route>
            <Route path="/aslab/view/:id" element={<AslabDetail />} />
          </Route>

          {/* Rute Proteksi Kepala Lab */}
          <Route element={<ProtectedRoute action="read" subject="KepalaLabPanel" />}>
            <Route element={<SidebarLayout />}>
              <Route path="/kepala-lab/dashboard" element={<KepalaLabDashboard />} />
              <Route path="/kepala-lab/matrix" element={<KepalaLabMatrix />} />
            </Route>
          </Route>

        </Route>

        {/* Rute Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
