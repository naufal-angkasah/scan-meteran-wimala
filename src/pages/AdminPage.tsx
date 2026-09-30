import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { profile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto bg-white border border-slate-300 rounded p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Panel Administrator PDAM Wimala</h1>
            <p className="text-xs text-slate-500">Masuk sebagai: {profile?.nama} ({profile?.email})</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold text-slate-700"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Modul Administrator (CRUD Pelanggan, Cetak QR Stiker, Tarif, Data Pencatatan, Export Excel/CSV, dan Kelola 2 Worker) akan diaktifkan di Tahap 3.
        </p>
      </div>
    </div>
  );
};
