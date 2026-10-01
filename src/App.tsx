import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { WorkerPage } from './pages/WorkerPage';
import { AdminPage } from './pages/AdminPage';
import { Analytics } from '@vercel/analytics/react';

// Redirect cerdas berdasarkan sesi dan peran pengguna
const RootRedirect: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs font-semibold text-slate-400">Memeriksa hak akses...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin' || user.email?.toLowerCase().includes('admin')) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/worker" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rute Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rute Worker (Petugas Lapangan) */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['worker', 'admin']}>
                <WorkerPage />
              </ProtectedRoute>
            }
          />

          {/* Rute Admin (Pengelola / Bendahara) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Vercel Web Analytics */}
        <Analytics />
      </BrowserRouter>
    </AuthProvider>
  );
};
