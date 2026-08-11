import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role === 'sem_funcao') {
    return <Navigate to="/aguardando-funcao" replace />;
  }

  return <>{children}</>;
}
