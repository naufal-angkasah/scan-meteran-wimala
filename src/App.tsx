import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Camera, 
  QrCode, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Printer, 
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { UnitKavling, MeterReading, AppSettings, ClusterName } from './types';
import { MASTER_UNITS } from './data/units';
import { getSettings, getReadings, saveSettings } from './lib/storage';
import { exportToExcel } from './lib/exportExcel';

// Components
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { KavlingCard } from './components/KavlingCard';
import { MeterScannerModal } from './components/MeterScannerModal';
import { QrScannerModal } from './components/QrScannerModal';
import { QrCodePrintSheet } from './components/QrCodePrintSheet';
import { SettingsModal } from './components/SettingsModal';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { BottomNav } from './components/BottomNav';
import { Analytics } from '@vercel/analytics/react';

export const App: React.FC = () => {
  // Global States
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [readings, setReadings] = useState<MeterReading[]>(getReadings());
  const [isDark, setIsDark] = useState<boolean>(settings.darkMode);

  // Filters
  const [selectedCluster, setSelectedCluster] = useState<ClusterName | 'Semua'>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Belum' | 'Sudah' | 'Anomali'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [activeUnitForScan, setActiveUnitForScan] = useState<UnitKavling | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isQrPrintOpen, setIsQrPrintOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewingPhotoReading, setViewingPhotoReading] = useState<MeterReading | null>(null);

  // Sync Listeners
  useEffect(() => {
    const handleReadingsChange = () => setReadings(getReadings());
    const handleSettingsChange = () => {
      const s = getSettings();
      setSettings(s);
      setIsDark(s.darkMode);
    };

    window.addEventListener('wimala_readings_changed', handleReadingsChange);
    window.addEventListener('wimala_settings_changed', handleSettingsChange);

    return () => {
      window.removeEventListener('wimala_readings_changed', handleReadingsChange);
      window.removeEventListener('wimala_settings_changed', handleSettingsChange);
    };
  }, []);

  // Sync Dark Theme class to HTML
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const updated = { ...settings, darkMode: next };
    setSettings(updated);
    saveSettings(updated);
  };

  // Map readings by unit blok for quick O(1) lookup
  const readingsMap = useMemo(() => {
    const map = new Map<string, MeterReading>();
    readings.forEach((r) => map.set(r.blok, r));
    return map;
  }, [readings]);

  // Filtered unit list
  const filteredUnits = useMemo(() => {
    return MASTER_UNITS.filter((unit) => {
      // Cluster filter
      if (selectedCluster !== 'Semua' && unit.cluster !== selectedCluster) {
        return false;
      }

      // Status filter
      const r = readingsMap.get(unit.blok);
      if (statusFilter === 'Sudah' && (!r || r.isAnomaly)) return false;
      if (statusFilter === 'Belum' && r) return false;
      if (statusFilter === 'Anomali' && (!r || !r.isAnomaly)) return false;

      // Search query (blok or nama)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchBlok = unit.blok.toLowerCase().includes(q);
        const matchNama = unit.nama.toLowerCase().includes(q);
        if (!matchBlok && !matchNama) return false;
      }

      return true;
    });
  }, [selectedCluster, statusFilter, searchQuery, readingsMap]);

  // Handle Quick Scan (find the first unrecorded unit, or prompt QR)
  const handleQuickNextUnit = () => {
    const nextPending = MASTER_UNITS.find((u) => !readingsMap.has(u.blok));
    if (nextPending) {
      setActiveUnitForScan(nextPending);
    } else {
      alert('Selamat! Seluruh 65 kavling telah selesai dicatat.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 sm:pb-8">
      {/* Top Navbar */}
      <Navbar
        settings={settings}
        readings={readings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenQrPrint={() => setIsQrPrintOpen(true)}
        onToggleTheme={toggleTheme}
        isDark={isDark}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full flex-1 space-y-5">
        {/* Metric Cards & Cluster Tab Selector */}
        <StatsOverview
          readings={readings}
          selectedCluster={selectedCluster}
          onSelectCluster={(c) => setSelectedCluster(c)}
        />

        {/* Search & Status Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari Blok Kavling (e.g. D-05) atau Nama Penghuni..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('Semua')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                statusFilter === 'Semua'
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Semua ({MASTER_UNITS.length})
            </button>
            <button
              onClick={() => setStatusFilter('Belum')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                statusFilter === 'Belum'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Belum ({MASTER_UNITS.length - readings.length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('Sudah')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                statusFilter === 'Sudah'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Sudah ({readings.filter(r => !r.isAnomaly).length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('Anomali')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                statusFilter === 'Anomali'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Anomali ({readings.filter(r => r.isAnomaly).length})</span>
            </button>
          </div>

          {/* Scan QR Button on Desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Box</span>
            </button>
          </div>
        </div>

        {/* Results Counter & Actions */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            Menampilkan <strong>{filteredUnits.length}</strong> kavling
            {selectedCluster !== 'Semua' && ` di Cluster ${selectedCluster}`}
            {statusFilter !== 'Semua' && ` (Filter: ${statusFilter})`}
          </span>

          {filteredUnits.length > 0 && (
            <button
              onClick={handleQuickNextUnit}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Catat Unit Berikutnya</span>
            </button>
          )}
        </div>

        {/* Units Grid */}
        {filteredUnits.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
              Tidak ada kavling yang sesuai
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Coba ubah kata kunci pencarian atau sesuaikan filter status/cluster.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('Semua');
                setSelectedCluster('Semua');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredUnits.map((unit) => (
              <KavlingCard
                key={unit.blok}
                unit={unit}
                reading={readingsMap.get(unit.blok)}
                onScanClick={(u) => setActiveUnitForScan(u)}
                onViewPhotoClick={(r) => setViewingPhotoReading(r)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab="list"
        onSelectTab={(tab) => {
          if (tab === 'qr') setIsQrScannerOpen(true);
          if (tab === 'print') setIsQrPrintOpen(true);
          if (tab === 'settings') setIsSettingsOpen(true);
        }}
        onOpenQuickScan={handleQuickNextUnit}
      />

      {/* Floating Action Button for Desktop/Tablet */}
      <div className="fixed bottom-6 right-6 z-30 hidden sm:flex flex-col gap-2">
        <button
          onClick={() => setIsQrScannerOpen(true)}
          title="Scan QR Code Stiker Box Meter"
          className="w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all border border-slate-700"
        >
          <QrCode className="w-5 h-5 text-emerald-400" />
        </button>
        <button
          onClick={handleQuickNextUnit}
          title="Catat Unit Berikutnya"
          className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>

      {/* --- MODALS --- */}
      {/* 1. Meter Scanner & Form Modal */}
      {activeUnitForScan && (
        <MeterScannerModal
          unit={activeUnitForScan}
          currentReading={readingsMap.get(activeUnitForScan.blok)}
          settings={settings}
          onClose={() => setActiveUnitForScan(null)}
          onSaved={() => {
            setReadings(getReadings());
          }}
        />
      )}

      {/* 2. QR Code Scanner Modal */}
      {isQrScannerOpen && (
        <QrScannerModal
          onClose={() => setIsQrScannerOpen(false)}
          onUnitDetected={(unit) => {
            setIsQrScannerOpen(false);
            setActiveUnitForScan(unit);
          }}
        />
      )}

      {/* 3. QR Sticker Sheet Print Modal */}
      {isQrPrintOpen && (
        <QrCodePrintSheet onClose={() => setIsQrPrintOpen(false)} />
      )}

      {/* 4. Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onSettingsSaved={(newS) => {
            setSettings(newS);
          }}
        />
      )}

      {/* 5. Photo Viewer Modal */}
      {viewingPhotoReading && (
        <PhotoViewerModal
          reading={viewingPhotoReading}
          onClose={() => setViewingPhotoReading(null)}
        />
      )}

      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
};
