import { Navigate, Outlet } from 'react-router-dom';
import { useAbility } from '@casl/react';

export const ProtectedRoute = ({ subject, action }: { subject: string, action: string }) => {
  const ability = useAbility();

  if (ability.cannot(action, subject)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
