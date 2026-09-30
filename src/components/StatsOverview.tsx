import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Droplet, Building2 } from 'lucide-react';
import { MeterReading, ClusterName } from '../types';
import { MASTER_UNITS } from '../data/units';

interface StatsOverviewProps {
  readings: MeterReading[];
  selectedCluster: ClusterName | 'Semua';
  onSelectCluster: (cluster: ClusterName | 'Semua') => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  readings,
  selectedCluster,
  onSelectCluster,
}) => {
  const readingsMap = new Map<string, MeterReading>();
  readings.forEach(r => readingsMap.set(r.blok, r));

  const totalUnits = MASTER_UNITS.length;
  const recordedCount = readings.length;
  const pendingCount = totalUnits - recordedCount;
  const anomalyCount = readings.filter(r => r.isAnomaly).length;
  
  const totalVolumeM3 = readings.reduce(
    (acc, r) => acc + (r.pemakaian > 0 ? r.pemakaian : 0),
    0
  );

  const percentComplete = Math.round((recordedCount / totalUnits) * 100);

  // Cluster calculations
  const clusters: { name: ClusterName; total: number }[] = [
    { name: 'Kamala', total: 35 },
    { name: 'Lily', total: 15 },
    { name: 'Bougenvile', total: 15 },
  ];

  return (
    <div className="space-y-4">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Sudah Dicatat */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-emerald-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sudah Dicatat
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {recordedCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ {totalUnits}</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              {percentComplete}% Selesai
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Belum Dicatat */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-amber-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Belum Dicatat
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {pendingCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">unit</span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Sisa rute jalan
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Total m3 Tercatat */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-blue-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Volume Air
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {totalVolumeM3.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-400 font-medium">m³</span>
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              Total pemakaian
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Droplet className="w-5 h-5" />
          </div>
        </div>

        {/* Anomali */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-rose-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Anomali / Periksa
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                {anomalyCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">unit</span>
            </div>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
              Lonjakan / Bocor
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Cluster Navigation Pills & Progress */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            Filter Rute Cluster:
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Progress Total: <strong className="text-emerald-600">{percentComplete}%</strong>
          </span>
        </div>

        {/* Overall Progress bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* Cluster Tabs */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => onSelectCluster('Semua')}
            className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition-all ${
              selectedCluster === 'Semua'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Semua ({totalUnits})
          </button>
          {clusters.map(c => {
            const clusterDone = MASTER_UNITS
              .filter(u => u.cluster === c.name)
              .filter(u => readingsMap.has(u.blok)).length;
            const isSelected = selectedCluster === c.name;

            return (
              <button
                key={c.name}
                onClick={() => onSelectCluster(c.name)}
                className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition-all flex flex-col items-center ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>{c.name}</span>
                <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {clusterDone}/{c.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
