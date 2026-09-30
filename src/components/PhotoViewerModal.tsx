import React from 'react';
import { X, Calendar, User, Gauge, Download } from 'lucide-react';
import { MeterReading } from '../types';

interface PhotoViewerModalProps {
  reading: MeterReading;
  onClose: () => void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({ reading, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <span>Bukti Fisik Meteran {reading.blok}</span>
              <span className="text-xs uppercase px-2 py-0.5 rounded bg-emerald-700 font-bold">
                {reading.cluster}
              </span>
            </h3>
            <p className="text-xs text-emerald-200 mt-0.5">
              Penghuni: {reading.namaKonsumen}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo Display */}
        <div className="p-3 bg-black flex items-center justify-center min-h-[260px] max-h-[55vh]">
          {reading.fotoBukti ? (
            <img 
              src={reading.fotoBukti} 
              alt={`Foto Meteran ${reading.blok}`} 
              className="max-h-[50vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
            />
          ) : (
            <div className="text-slate-500 text-xs italic">
              Tidak ada lampiran foto untuk kavling ini.
            </div>
          )}
        </div>

        {/* Meta Details */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 text-xs space-y-2 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Stand Akhir Tercatat
              </span>
              <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                {reading.standAkhir} m³
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Total Pemakaian
              </span>
              <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                +{reading.pemakaian} m³
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Waktu: <strong>{new Date(reading.timestamp).toLocaleString('id-ID')}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Petugas: <strong>{reading.petugas}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              <span>Kondisi Meter: <strong>{reading.kondisiMeter}</strong></span>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
