import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Filter, Droplets } from 'lucide-react';
import { MASTER_UNITS } from '../data/units';
import { ClusterName } from '../types';

interface QrCodePrintSheetProps {
  onClose: () => void;
}

export const QrCodePrintSheet: React.FC<QrCodePrintSheetProps> = ({ onClose }) => {
  const [filterCluster, setFilterCluster] = useState<ClusterName | 'Semua'>('Semua');

  const filteredUnits = filterCluster === 'Semua'
    ? MASTER_UNITS
    : MASTER_UNITS.filter((u) => u.cluster === filterCluster);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col justify-start items-center p-2 sm:p-6 overflow-y-auto">
      {/* Control Bar (Hidden when printing) */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-4xl p-4 mb-4 flex items-center justify-between sticky top-2 z-10">
        <div>
          <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            Cetak Stiker QR Meteran Wimala Land
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tempel stiker QR ini pada boks meteran air di masing-masing rumah
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Cluster Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {(['Semua', 'Kamala', 'Lily', 'Bougenvile'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCluster(c)}
                className={`px-2 py-1 rounded-md transition-all ${
                  filterCluster === c
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Halaman (Print)</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-white text-slate-900 w-full max-w-4xl p-6 sm:p-8 rounded-2xl shadow-2xl print:p-0 print:shadow-none print:max-w-none print:w-full">
        {/* Print Header */}
        <div className="border-b-2 border-emerald-800 pb-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center p-1.5">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-emerald-900 uppercase tracking-tight">
                Wimala Land • Grand Tamansari
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Label QR Identifikasi Meteran Air • Cluster {filterCluster} ({filteredUnits.length} Unit)
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <span>Tahun 2026</span>
          </div>
        </div>

        {/* Sticker Cards Grid (Optimized for 3 columns on A4) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
          {filteredUnits.map((u) => {
            const qrPayload = `WIMALA:${u.blok}`;

            return (
              <div
                key={u.blok}
                className="border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-between bg-slate-50/50 print:border-solid print:border-slate-800 print:bg-white print:rounded-lg print:break-inside-avoid"
              >
                {/* Sticker Header */}
                <div className="w-full flex items-center justify-between text-[10px] font-bold text-emerald-800 uppercase border-b border-slate-200 pb-1 mb-2">
                  <span>WIMALA LAND</span>
                  <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                    {u.cluster}
                  </span>
                </div>

                {/* QR Code */}
                <div className="p-2 bg-white rounded-lg shadow-xs border border-slate-200 my-1">
                  <QRCodeSVG
                    value={qrPayload}
                    size={110}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                {/* Big Unit Code */}
                <div className="mt-1 text-center w-full">
                  <div className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                    {u.blok}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 truncate mt-0.5 max-w-[170px]">
                    {u.nama}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    ID: {qrPayload}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
