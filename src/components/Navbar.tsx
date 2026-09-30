import React from 'react';
import { 
  Droplets, 
  Download, 
  QrCode, 
  Settings, 
  Moon, 
  Sun, 
  UserCheck,
  Calendar
} from 'lucide-react';
import { AppSettings, MeterReading } from '../types';
import { exportToExcel } from '../lib/exportExcel';

interface NavbarProps {
  settings: AppSettings;
  readings: MeterReading[];
  onOpenSettings: () => void;
  onOpenQrPrint: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  readings,
  onOpenSettings,
  onOpenQrPrint,
  onToggleTheme,
  isDark,
}) => {
  const handleExport = () => {
    exportToExcel(readings, settings);
  };

  return (
    <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md border-b border-emerald-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center p-1.5 shadow-inner border border-white/20">
              <img 
                src="/assets/wimala-logo.png" 
                alt="Wimala Logo" 
                className="w-full h-full object-contain filter brightness-0 invert"
                onError={(e) => {
                  // Fallback icon if logo not loaded yet
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <Droplets className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight leading-none">
                  Wimala<span className="text-emerald-300 font-medium">Meter</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-700/80 px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-100">
                  PWA 2026
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 font-medium flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 text-emerald-300" />
                Periode: <strong className="text-white font-semibold">{settings.periodeAktif}</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Export Excel */}
            <button
              onClick={handleExport}
              title="Ekspor Rekap Excel (.xlsx)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-900 text-white rounded-lg transition-all shadow-sm border border-emerald-500/30"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span className="hidden md:inline">Ekspor Excel</span>
            </button>

            {/* Print QR Sticker Sheet */}
            <button
              onClick={onOpenQrPrint}
              title="Cetak Label QR Box Meter"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition-all border border-white/20"
            >
              <QrCode className="w-4 h-4 text-emerald-200" />
              <span className="hidden md:inline">Cetak QR</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={onToggleTheme}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className="p-2 text-white/90 hover:bg-white/10 rounded-lg transition-all"
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-emerald-100" />}
            </button>

            {/* Settings Modal */}
            <button
              onClick={onOpenSettings}
              title="Pengaturan Aplikasi"
              className="p-2 text-white/90 hover:bg-white/10 rounded-lg transition-all"
            >
              <Settings className="w-5 h-5 text-emerald-100" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-bar on Mobile: Officer Name */}
      <div className="bg-emerald-900/60 px-4 py-1 text-[11px] text-emerald-200/90 flex items-center justify-between border-t border-emerald-700/40">
        <span className="flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          Petugas: <span className="font-semibold text-white">{settings.namaPetugas}</span>
        </span>
        <span className="font-mono text-emerald-300">
          Tarif: Rp {settings.tarifPerM3.toLocaleString('id-ID')}/m³
        </span>
      </div>
    </header>
  );
};
