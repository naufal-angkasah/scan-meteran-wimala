import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs font-semibold text-slate-500">Memuat sesi pengguna...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isEffectiveAdmin = role === 'admin' || !!user.email?.toLowerCase().includes('admin');
  const effectiveRole: UserRole = isEffectiveAdmin ? 'admin' : (role || 'worker');

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    // Redirect ke halaman default sesuai peran
    if (effectiveRole === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/worker" replace />;
    }
  }

  return <>{children}</>;
};
