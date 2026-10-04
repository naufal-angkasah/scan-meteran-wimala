import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  RotateCw, 
  Zap, 
  Droplet,
  Calculator,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UnitKavling, MeterReading, AppSettings, KondisiMeter } from '../types';
import { preprocessMeterImage, recognizeMeterNumber } from '../lib/ocr';
import { calculateUsageAndCost, saveReading } from '../lib/storage';

interface MeterScannerModalProps {
  unit: UnitKavling;
  currentReading?: MeterReading;
  settings: AppSettings;
  onClose: () => void;
  onSaved: () => void;
}

export const MeterScannerModal: React.FC<MeterScannerModalProps> = ({
  unit,
  currentReading,
  settings,
  onClose,
  onSaved,
}) => {
  const [mode, setMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [standAkhirInput, setStandAkhirInput] = useState<string>(
    currentReading ? currentReading.standAkhir.toString() : ''
  );
  const [kondisiMeter, setKondisiMeter] = useState<KondisiMeter>(
    currentReading?.kondisiMeter || 'Normal'
  );
  const [catatan, setCatatan] = useState<string>(currentReading?.catatanPetugas || '');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(
    currentReading?.fotoBukti || null
  );

  // Camera & OCR states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [detectedNumber, setDetectedNumber] = useState<number | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  // Start camera on mount if mode === 'camera'
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (mode === 'camera' && !capturedPhoto) {
      navigator.mediaDevices?.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
          setStreamActive(true);
        }
      })
      .catch((err) => {
        console.warn('Camera stream error, fallback to upload:', err);
        setMode('upload');
      });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mode, cameraFacing, capturedPhoto]);

  // Handle Capture & OCR from live video
  const handleCaptureVideo = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Create high-res snapshot
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 640;
    snapCanvas.height = video.videoHeight || 480;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    const photoDataUrl = snapCanvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(photoDataUrl);

    // Stop video
    if (video.srcObject) {
      const tracks = (video.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      setStreamActive(false);
    }

    // Run OCR on the center region (meter numbers)
    await runOcrOnImage(photoDataUrl);
  };

  // Handle Photo Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setCapturedPhoto(dataUrl);
      await runOcrOnImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Execute OCR
  const runOcrOnImage = async (dataUrl: string) => {
    setIsProcessingOcr(true);
    setOcrProgress(10);

    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = res));

      // Crop middle 50% for counter numbers
      const cropW = img.width * 0.7;
      const cropH = img.height * 0.35;
      const cropX = (img.width - cropW) / 2;
      const cropY = (img.height - cropH) / 2;

      const preprocessed = preprocessMeterImage(img, cropX, cropY, cropW, cropH);

      const ocrResult = await recognizeMeterNumber(preprocessed.dataUrl, (p: number) => {
        setOcrProgress(Math.max(10, p));
      });

      if (ocrResult.detectedNumber !== null) {
        setDetectedNumber(ocrResult.detectedNumber);
        // Automatically suggest stand akhir
        setStandAkhirInput(ocrResult.detectedNumber.toString());
      }
    } catch (err) {
      console.warn('OCR error:', err);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Recalculate
  const numStandAkhir = parseInt(standAkhirInput, 10);
  const isValidNumber = !isNaN(numStandAkhir) && numStandAkhir >= 0;

  const calculation = isValidNumber
    ? calculateUsageAndCost(unit.standAwal, numStandAkhir, settings)
    : { pemakaian: 0, estimasiBiaya: 0, isAnomaly: false, anomalyReason: undefined };

  // Save handler
  const handleSave = () => {
    if (!isValidNumber) {
      alert('Mohon masukkan angka Stand Meter Akhir yang valid!');
      return;
    }

    const newReading: MeterReading = {
      id: currentReading?.id || `rec-${Date.now()}`,
      unitNo: unit.no,
      blok: unit.blok,
      cluster: unit.cluster,
      namaKonsumen: unit.nama,
      periode: settings.periodeAktif,
      standAwal: unit.standAwal,
      standAkhir: numStandAkhir,
      pemakaian: calculation.pemakaian,
      estimasiBiayaAir: calculation.estimasiBiaya,
      kondisiMeter: kondisiMeter,
      fotoBukti: capturedPhoto || undefined,
      catatanPetugas: catatan.trim() || undefined,
      petugas: settings.namaPetugas,
      timestamp: new Date().toISOString(),
      isAnomaly: calculation.isAnomaly,
      anomalyReason: calculation.anomalyReason,
    };

    saveReading(newReading);

    // Trigger celebration confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#10b981', '#059669', '#34d399', '#0284c7'],
    });

    onSaved();
    onClose();
  };

  const kondisiOptions: KondisiMeter[] = [
    'Normal',
    'Kaca Buram / Berlumut',
    'Meter Macet / Rusak',
    'Pipa Bocor / Rembes',
    'Rumah Kosong',
    'Pintu / Pagar Terkunci',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Unit Info */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight">{unit.blok}</span>
              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-emerald-700 text-emerald-100">
                Cluster {unit.cluster}
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Penghuni: <strong className="text-white">{unit.nama}</strong> ({unit.tipe})
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              onClick={() => {
                setMode('camera');
                setCapturedPhoto(null);
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'camera' && !capturedPhoto
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Kamera OCR</span>
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Foto / Galeri</span>
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'manual'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Input Cepat</span>
            </button>
          </div>

          {/* Camera Viewfinder (if camera mode active) */}
          {mode === 'camera' && !capturedPhoto && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Box Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="w-4/5 h-20 border-2 border-dashed border-emerald-400/90 rounded-lg shadow-2xl relative flex items-center justify-center bg-black/20">
                  <div className="absolute -top-6 text-[11px] font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full">
                    Arahkan ke Angka Meteran
                  </div>
                  {/* Center Line Guide */}
                  <div className="w-full h-[1px] bg-emerald-400/40" />
                </div>
              </div>

              {/* Camera Controls Overlay */}
              <div className="absolute bottom-3 left-0 right-0 px-4 flex items-center justify-between pointer-events-auto">
                {/* Switch Camera */}
                <button
                  type="button"
                  onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                  className="p-2.5 rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 active:scale-95 transition-all"
                  title="Putar Kamera"
                >
                  <RotateCw className="w-5 h-5" />
                </button>

                {/* Shutter Button */}
                <button
                  type="button"
                  onClick={handleCaptureVideo}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 border-4 border-white shadow-xl flex items-center justify-center text-white active:scale-95 transition-all"
                  title="Ambil Foto & Scan OCR"
                >
                  <Camera className="w-6 h-6" />
                </button>

                <div className="w-10" />
              </div>
            </div>
          )}

          {/* Photo Upload Input (if upload mode) */}
          {mode === 'upload' && !capturedPhoto && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500 transition-all bg-slate-50 dark:bg-slate-800/40">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                id="file-meter-upload"
                className="hidden"
              />
              <label 
                htmlFor="file-meter-upload" 
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Ambil Foto / Pilih dari Galeri
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Sistem akan otomatis membaca angka meteran dengan AI OCR
                </span>
              </label>
            </div>
          )}

          {/* Photo Preview & OCR Detection Card */}
          {capturedPhoto && (
            <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
              <img 
                src={capturedPhoto} 
                alt="Foto Meteran" 
                className="w-full max-h-48 object-contain bg-black"
              />
              
              {/* Retake Button */}
              <button
                type="button"
                onClick={() => {
                  setCapturedPhoto(null);
                  setDetectedNumber(null);
                }}
                className="absolute top-2 right-2 px-2.5 py-1 text-xs font-semibold bg-black/70 hover:bg-black/90 text-white rounded-lg backdrop-blur flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Foto Ulang</span>
              </button>

              {/* OCR Processing Spinner */}
              {isProcessingOcr && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                  <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs font-bold text-emerald-300">
                    Membaca Angka Meteran... ({ocrProgress}%)
                  </span>
                </div>
              )}

              {/* Detected OCR Result Banner */}
              {!isProcessingOcr && detectedNumber !== null && (
                <div className="bg-emerald-900/90 text-white px-3 py-2 text-xs flex items-center justify-between border-t border-emerald-700">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    OCR Terdeteksi: <strong className="text-emerald-200 font-mono text-sm">{detectedNumber} m³</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setStandAkhirInput(detectedNumber.toString())}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[11px] font-bold"
                  >
                    Gunakan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stand Meter Comparison Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              {/* Stand Awal (Read-only) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Stand Awal (Bulan Lalu)
                </label>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono font-extrabold text-xl text-slate-700 dark:text-slate-300">
                    {unit.standAwal}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">m³</span>
                </div>
              </div>

              {/* Stand Akhir (Input Target) */}
              <div>
                <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>Stand Akhir</span>
                  <span className="text-[10px] text-slate-400 font-normal">Hasil Scan / Input</span>
                </label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={standAkhirInput}
                    onChange={(e) => setStandAkhirInput(e.target.value)}
                    placeholder="Contoh: 159"
                    className="w-full font-mono font-extrabold text-xl px-3 py-1.5 rounded-lg border-2 border-emerald-500 dark:border-emerald-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    m³
                  </span>
                </div>
              </div>
            </div>

            {/* Live Calculation Strip */}
            {isValidNumber && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Pemakaian Air
                  </span>
                  <span className={`font-mono font-extrabold text-sm ${
                    calculation.isAnomaly ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {calculation.pemakaian > 0 ? `+${calculation.pemakaian}` : calculation.pemakaian} m³
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Estimasi Tagihan Air
                  </span>
                  <span className="font-extrabold text-base text-emerald-700 dark:text-emerald-300">
                    Rp {calculation.estimasiBiaya.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Anomaly Alert Notice */}
          {calculation.anomalyReason && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
              calculation.isAnomaly 
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200' 
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200'
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <div>
                <strong className="block font-bold">
                  {calculation.isAnomaly ? 'Peringatan Anomali Meter!' : 'Catatan Khusus:'}
                </strong>
                <span>{calculation.anomalyReason}</span>
              </div>
            </div>
          )}

          {/* Kondisi Fisik Meteran */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Kondisi Fisik Meteran Air:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {kondisiOptions.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setKondisiMeter(opt)}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all ${
                    kondisiMeter === opt
                      ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan Petugas */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Catatan Petugas (Opsional):
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Posisi meter terhalang pot bunga, jarum meteran berputar normal..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValidNumber}
            className={`w-2/3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all ${
              isValidNumber
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Simpan Hasil Pencatatan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
