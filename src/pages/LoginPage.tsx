import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Droplet, AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      await login(email, password);
      // AuthProvider will update user & role
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        // Default destination based on role will be handled or default to /worker
        navigate('/worker', { replace: true });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMsg('Email atau kata sandi tidak cocok.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMsg('Terlalu banyak percobaan gagal. Silakan coba lagi nanti.');
      } else {
        setErrorMsg(`Gagal masuk: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      {/* Container Alat Kerja */}
      <div className="w-full max-w-sm bg-white border border-slate-300 rounded-lg shadow-sm p-6 space-y-6">
        {/* Header Identitas Sistem */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="w-9 h-9 rounded bg-teal-700 flex items-center justify-center text-white flex-shrink-0">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Rekap Meteran Air PDAM
            </h1>
            <p className="text-xs text-slate-500">
              Pengelola Perumahan Wimala
            </p>
          </div>
        </div>

        {/* Peringatan Error */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Masuk */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Petugas / Admin
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@wimalaland.id"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-2.5 px-4 rounded text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors ${
              submitting
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900'
            }`}
          >
            {submitting ? (
              <span>Memverifikasi...</span>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Info Singkat */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Akses khusus 1 Admin & 2 Petugas Lapangan. Tidak ada pendaftaran mandiri.
          </p>
        </div>
      </div>
    </div>
  );
};
