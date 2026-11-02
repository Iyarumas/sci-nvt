import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

export function AuthGuard({ children, developerOnly = false, adminOnly = false }: { children: ReactNode; developerOnly?: boolean; adminOnly?: boolean }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role === 'sem_funcao') {
    return <Navigate to="/aguardando-funcao" replace />;
  }

  if (developerOnly && user?.role !== 'desenvolvedor') {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && user?.role !== 'admin' && user?.role !== 'desenvolvedor') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
