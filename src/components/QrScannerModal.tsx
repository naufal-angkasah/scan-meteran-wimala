import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, QrCode, AlertCircle, Search } from 'lucide-react';
import { MASTER_UNITS } from '../data/units';
import { UnitKavling } from '../types';

interface QrScannerModalProps {
  onUnitDetected: (unit: UnitKavling) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  onUnitDetected,
  onClose,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const qrRegionId = 'qr-reader-region';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const qr = new Html5Qrcode(qrRegionId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        html5QrCodeRef.current = qr;

        await qr.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isMounted) return;
            handleQrCodeResult(decodedText);
          },
          (errorMessage) => {
            // normal frame scanning error, ignore
          }
        );
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || 'Tidak dapat mengakses kamera untuk scan QR');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleQrCodeResult = (text: string) => {
    // Normalise text: e.g. "WIMALA:D-01" or "D-01" or "Kamala D-01"
    const cleaned = text.trim().toUpperCase();

    const matched = MASTER_UNITS.find((u) => {
      const target = u.blok.toUpperCase();
      return (
        cleaned === target ||
        cleaned === `WIMALA:${target}` ||
        cleaned.includes(target)
      );
    });

    if (matched) {
      // Vibrate if mobile supported
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
      onUnitDetected(matched);
    } else {
      setErrorMsg(`QR Code "${text}" tidak cocok dengan data kavling Wimala Land.`);
    }
  };

  // Manual fallback filter
  const filteredUnits = manualQuery
    ? MASTER_UNITS.filter(
        (u) =>
          u.blok.toLowerCase().includes(manualQuery.toLowerCase()) ||
          u.nama.toLowerCase().includes(manualQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="font-extrabold text-base">Scan QR Kavling</h3>
              <p className="text-[11px] text-emerald-200">Arahkan kamera ke stiker QR di boks meteran</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Region */}
        <div className="p-4 space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center shadow-inner">
            <div id={qrRegionId} className="w-full h-full" />
          </div>

          {/* Error / Feedback Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Fallback Search if QR unreadable */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Atau Cari Manual Blok Kavling:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ketik Blok (misal: D-05) atau Nama..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Filtered Dropdown */}
            {filteredUnits.length > 0 && (
              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-md">
                {filteredUnits.map((u) => (
                  <button
                    key={u.blok}
                    onClick={() => {
                      if (html5QrCodeRef.current?.isScanning) {
                        html5QrCodeRef.current.stop().catch(() => {});
                      }
                      onUnitDetected(u);
                    }}
                    className="w-full p-2.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {u.blok}
                      </strong>
                      <span className="text-slate-600 dark:text-slate-400 ml-2">
                        {u.nama}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{u.cluster}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
