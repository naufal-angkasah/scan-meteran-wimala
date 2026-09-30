import React from 'react';
import { 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Image as ImageIcon,
  User,
  Gauge,
  ArrowRight,
  TrendingUp,
  FileEdit
} from 'lucide-react';
import { UnitKavling, MeterReading } from '../types';

interface KavlingCardProps {
  unit: UnitKavling;
  reading?: MeterReading;
  onScanClick: (unit: UnitKavling) => void;
  onViewPhotoClick: (reading: MeterReading) => void;
}

export const KavlingCard: React.FC<KavlingCardProps> = ({
  unit,
  reading,
  onScanClick,
  onViewPhotoClick,
}) => {
  const isRecorded = !!reading;
  const isAnomaly = reading?.isAnomaly;

  return (
    <div 
      className={`bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border transition-all ${
        isAnomaly
          ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-200 dark:ring-rose-950'
          : isRecorded
          ? 'border-emerald-200 dark:border-emerald-950/80 bg-emerald-50/20 dark:bg-emerald-950/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
      }`}
    >
      {/* Top Header: Blok, Cluster, Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
            {unit.blok}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
            unit.cluster === 'Kamala' 
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' 
              : unit.cluster === 'Lily'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          }`}>
            {unit.cluster}
          </span>
          {unit.status === 'Booking' && (
            <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
              Booking
            </span>
          )}
        </div>

        {/* Status Badge */}
        {isAnomaly ? (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Anomali
          </span>
        ) : isRecorded ? (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sudah Dicatat
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            Belum
          </span>
        )}
      </div>

      {/* Resident & House Type */}
      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            {unit.nama}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 flex-shrink-0">
          {unit.tipe}
        </span>
      </div>

      {/* Meter Stats Box */}
      <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
            Stand Awal
          </span>
          <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
            {unit.standAwal} <span className="text-[10px] font-normal text-slate-400">m³</span>
          </span>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />

        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
            Stand Akhir
          </span>
          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
            {isRecorded ? (
              <>
                {reading.standAkhir} <span className="text-[10px] font-normal text-slate-400">m³</span>
              </>
            ) : (
              <span className="text-slate-400 font-normal italic">-</span>
            )}
          </span>
        </div>

        <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
            Pemakaian
          </span>
          <span className={`font-mono font-extrabold text-sm ${
            isRecorded 
              ? (reading.pemakaian > 30 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400')
              : 'text-slate-400 font-normal'
          }`}>
            {isRecorded ? (
              `+${reading.pemakaian} m³`
            ) : (
              '-'
            )}
          </span>
        </div>
      </div>

      {/* Recorded Details (If finished) */}
      {isRecorded && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>Kondisi: <strong>{reading.kondisiMeter}</strong></span>
          </div>
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">
            Rp {reading.estimasiBiayaAir.toLocaleString('id-ID')}
          </div>
        </div>
      )}

      {/* Anomaly Reason Alert */}
      {isAnomaly && reading?.anomalyReason && (
        <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{reading.anomalyReason}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onScanClick(unit)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            isRecorded
              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-500/20'
          }`}
        >
          {isRecorded ? (
            <>
              <FileEdit className="w-4 h-4" />
              <span>Edit Catatan</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Scan / Catat Meter</span>
            </>
          )}
        </button>

        {/* View Photo Button */}
        {reading?.fotoBukti && (
          <button
            onClick={() => onViewPhotoClick(reading)}
            title="Lihat Foto Bukti Meter"
            className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition-all"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
