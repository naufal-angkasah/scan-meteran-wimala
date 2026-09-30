import React from 'react';
import { LayoutGrid, QrCode, Camera, Settings, Printer } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'list' | 'qr' | 'print' | 'settings';
  onSelectTab: (tab: 'list' | 'qr' | 'print' | 'settings') => void;
  onOpenQuickScan: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickScan,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe sm:hidden">
      <div className="grid grid-cols-5 items-center h-16 px-1">
        {/* Tab: Daftar Unit */}
        <button
          onClick={() => onSelectTab('list')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'list'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Daftar</span>
        </button>

        {/* Tab: Scan QR Box */}
        <button
          onClick={() => onSelectTab('qr')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'qr'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <QrCode className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Scan QR</span>
        </button>

        {/* FAB: Center Quick Scan Meteran */}
        <div className="flex items-center justify-center -mt-5">
          <button
            onClick={onOpenQuickScan}
            title="Scan Meteran Air"
            className="w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 border-4 border-slate-50 dark:border-slate-950 transition-all"
          >
            <Camera className="w-6 h-6" />
          </button>
        </div>

        {/* Tab: Cetak Label QR */}
        <button
          onClick={() => onSelectTab('print')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'print'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Printer className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Cetak QR</span>
        </button>

        {/* Tab: Settings */}
        <button
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'settings'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Setting</span>
        </button>
      </div>
    </nav>
  );
};
