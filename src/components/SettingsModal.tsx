import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Save, 
  RotateCcw, 
  Database, 
  FileSpreadsheet, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { AppSettings } from '../types';
import { saveSettings, resetAllReadings, restoreDemoReadings } from '../lib/storage';

interface SettingsModalProps {
  settings: AppSettings;
  onClose: () => void;
  onSettingsSaved: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onSettingsSaved,
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(formData);
    onSettingsSaved(formData);
    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      onClose();
    }, 800);
  };

  const handleResetData = () => {
    if (confirm('Yakin ingin mereset seluruh catatan meteran air? Semua hasil scan periode ini akan dihapus.')) {
      resetAllReadings();
      alert('Semua data pencatatan berhasil direset.');
      onClose();
    }
  };

  const handleRestoreDemo = () => {
    if (confirm('Muat ulang data sampel demo (D-01, D-02, D-05 terisi contoh normal & anomali)?')) {
      restoreDemoReadings();
      alert('Data demo berhasil dimuat.');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-300" />
            <h3 className="font-extrabold text-base">Pengaturan Aplikasi</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Periode Aktif */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Periode Pencatatan:
            </label>
            <input
              type="text"
              value={formData.periodeAktif}
              onChange={(e) => setFormData({ ...formData, periodeAktif: e.target.value })}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Nama Petugas */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Nama Petugas Lapangan:
            </label>
            <input
              type="text"
              value={formData.namaPetugas}
              onChange={(e) => setFormData({ ...formData, namaPetugas: e.target.value })}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Tarif & Abonemen */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tarif Air per m³ (Rp):
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={formData.tarifPerM3}
                onChange={(e) => setFormData({ ...formData, tarifPerM3: parseInt(e.target.value, 10) || 0 })}
                className="w-full font-mono text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Biaya Abonemen (Rp):
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.biayaAbonemen}
                onChange={(e) => setFormData({ ...formData, biayaAbonemen: parseInt(e.target.value, 10) || 0 })}
                className="w-full font-mono text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Batas Lonjakan Anomali */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Batas Peringatan Lonjakan Anomali (m³):
            </label>
            <input
              type="number"
              min="5"
              value={formData.batasLonjakanM3}
              onChange={(e) => setFormData({ ...formData, batasLonjakanM3: parseInt(e.target.value, 10) || 30 })}
              className="w-full font-mono text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Sistem akan memunculkan tanda anomali jika pemakaian unit melebihi angka ini.
            </p>
          </div>

          {/* Danger Zone / Database Management */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Manajemen Data Lokal:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDemo}
                className="flex-1 py-2 px-2 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Muat Data Demo</span>
              </button>
              <button
                type="button"
                onClick={handleResetData}
                className="flex-1 py-2 px-2 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg flex items-center justify-center gap-1 border border-rose-200 dark:border-rose-900 transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
            >
              {isSavedNotice ? <Check className="w-4 h-4 text-emerald-200" /> : <Save className="w-4 h-4" />}
              <span>{isSavedNotice ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
