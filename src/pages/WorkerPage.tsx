import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  Upload, 
  AlertTriangle, 
  Check, 
  History, 
  RefreshCw, 
  User, 
  MapPin, 
  Gauge, 
  LogOut,
  ChevronRight,
  Edit2,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, callBacaMeteran, callSimpanReading } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Customer, ReadingRecord, StatusRumah } from '../types';
import { compressMeterPhoto } from '../lib/imageCompression';

export const WorkerPage: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  // Current active period (YYYY-MM)
  const currentPeriode = new Date().toISOString().slice(0, 7); // e.g. "2026-09"

  // Step flow: 'scan_qr' | 'form_meter' | 'history'
  const [activeStep, setActiveStep] = useState<'scan_qr' | 'form_meter' | 'history'>('scan_qr');

  // Selected customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [angkaSebelumnya, setAngkaSebelumnya] = useState<number>(0);
  const [existingReading, setExistingReading] = useState<ReadingRecord | null>(null);
  const [customerAvgUsage, setCustomerAvgUsage] = useState<number>(0);

  // Meter form states
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [ocrConfidence, setOcrConfidence] = useState<number>(1);
  const [angkaSekarangInput, setAngkaSekarangInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // QR Scanner refs & states
  const qrRegionId = 'worker-qr-reader';
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [manualCustomerId, setManualCustomerId] = useState('');

  // Today's history state
  const [todayReadings, setTodayReadings] = useState<ReadingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // -------------------------------------------------------------
  // 1. QR Scanner Lifecycle
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    if (activeStep === 'scan_qr') {
      const startQr = async () => {
        try {
          // Check element existence
          const el = document.getElementById(qrRegionId);
          if (!el) return;

          const qr = new Html5Qrcode(qrRegionId, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
          });
          qrScannerRef.current = qr;

          await qr.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 240, height: 240 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (!isMounted) return;
              handleQrDetected(decodedText);
            },
            () => {}
          );
          if (isMounted) setIsScannerRunning(true);
        } catch (err: any) {
          console.warn('QR camera start failed, fallback to manual/upload:', err);
          if (isMounted) setIsScannerRunning(false);
        }
      };

      startQr();
    }

    return () => {
      isMounted = false;
      if (qrScannerRef.current?.isScanning) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, [activeStep]);

  // Stop QR scanner helper
  const stopQrScanner = async () => {
    if (qrScannerRef.current?.isScanning) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {}
      setIsScannerRunning(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Handle QR Code Detected & Load Customer
  // -------------------------------------------------------------
  const handleQrDetected = async (rawCode: string) => {
    await stopQrScanner();
    // Clean string: e.g. "WIMALA:D-01" or "d-01" or raw customerId
    const cleaned = rawCode.trim().replace(/^WIMALA:/i, '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    await loadCustomerData(cleaned);
  };

  const loadCustomerData = async (cId: string) => {
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      // 1. Ambil dokumen customer
      const custDoc = await getDoc(doc(db, 'customers', cId));
      if (!custDoc.exists()) {
        // Fallback: cari by blok
        const qCust = query(collection(db, 'customers'), where('blok', '==', cId.toUpperCase()), limit(1));
        const snap = await getDocs(qCust);
        if (snap.empty) {
          setErrorMessage(`Pelanggan dengan kode "${cId}" tidak ditemukan.`);
          setActiveStep('scan_qr');
          return;
        }
        processCustomerFound({ id: snap.docs[0].id, ...snap.docs[0].data() } as Customer);
        return;
      }

      processCustomerFound({ id: custDoc.id, ...custDoc.data() } as Customer);
    } catch (err: any) {
      console.error('Error saat memuat customer:', err);
      setErrorMessage(`Gagal mengambil data pelanggan: ${err.message}`);
    }
  };

  const processCustomerFound = async (customer: Customer) => {
    setSelectedCustomer(customer);

    // 2. Cek apakah sudah dicatat di periode berjalan
    const readingId = `${customer.id}_${currentPeriode}`;
    const readDoc = await getDoc(doc(db, 'readings', readingId));

    if (readDoc.exists()) {
      const rec = readDoc.data() as ReadingRecord;
      setExistingReading(rec);
      setAngkaSebelumnya(rec.angkaSebelumnya);
      setAngkaSekarangInput(rec.angkaSekarang.toString());
      setCapturedPhoto(rec.fotoUrl || null);
    } else {
      setExistingReading(null);
      setCapturedPhoto(null);
      setPhotoBlob(null);
      setAngkaSekarangInput('');

      // 3. Tentukan angka bulan lalu (ambil reading terakhir sebelum periode ini)
      const prevQuery = query(
        collection(db, 'readings'),
        where('customerId', '==', customer.id),
        where('periode', '<', currentPeriode),
        orderBy('periode', 'desc'),
        limit(1)
      );
      try {
        const prevSnap = await getDocs(prevQuery);
        if (!prevSnap.empty) {
          setAngkaSebelumnya(prevSnap.docs[0].data().angkaSekarang ?? customer.angkaAwal ?? 0);
        } else {
          setAngkaSebelumnya(customer.angkaAwal ?? 0);
        }
      } catch (e) {
        setAngkaSebelumnya(customer.angkaAwal ?? 0);
      }
    }

    // 4. Hitung rata-rata pemakaian historis pelanggan
    try {
      const histQuery = query(collection(db, 'readings'), where('customerId', '==', customer.id), limit(6));
      const histSnap = await getDocs(histQuery);
      if (!histSnap.empty) {
        const sum = histSnap.docs.reduce((acc, d) => acc + (d.data().pemakaianM3 || 0), 0);
        setCustomerAvgUsage(sum / histSnap.docs.length);
      } else {
        setCustomerAvgUsage(0);
      }
    } catch (e) {
      setCustomerAvgUsage(0);
    }

    setActiveStep('form_meter');
  };

  // -------------------------------------------------------------
  // 3. Foto Meteran & Kompresi & OCR Gemini Vision
  // -------------------------------------------------------------
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsProcessingOcr(true);

    try {
      // 1. Kompresi di client-side (maks 1MB)
      const compressed = await compressMeterPhoto(file, 1280, 1280, 0.8);
      setCapturedPhoto(compressed.base64);
      setPhotoBlob(compressed.blob);

      // 2. Panggil Cloud Function Gemini Vision OCR
      try {
        const res = await callBacaMeteran({
          fotoBase64: compressed.base64,
          mimeType: 'image/jpeg',
        });

        if (res.data.angka !== null) {
          setAngkaSekarangInput(res.data.angka.toString());
          setOcrConfidence(res.data.confidence ?? 0.9);
        } else {
          setOcrConfidence(0.3);
          setErrorMessage('Angka meteran buram/tidak terbaca otomatis. Silakan masukkan angka secara manual.');
        }
      } catch (ocrErr: any) {
        console.warn('Panggilan Cloud Function OCR gagal/belum tersedia:', ocrErr);
        // Fallback panggil Gemini Vision langsung dari client jika API Key disetel di environment
        const geminiApiKey = import.meta.env.VITE_FIREBASE_GEMINI_API_KEY;
        let ocrSukses = false;

        if (geminiApiKey) {
          try {
            const cleanBase64 = compressed.base64.replace(/^data:image\/[a-z]+;base64,/, '');
            const gRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      {
                        text: 'Analisis foto meteran air PDAM ini. Fokus HANYA pada roda angka meteran (angka hitam untuk m3 kubik bulat). Kembalikan JSON persis format: {"angka": 1234, "confidence": 0.95}. Jika buram atau tidak ada angka, kembalikan: {"angka": null, "confidence": 0.2}.'
                      },
                      {
                        inline_data: {
                          mime_type: 'image/jpeg',
                          data: cleanBase64
                        }
                      }
                    ]
                  }],
                  generationConfig: {
                    response_mime_type: 'application/json',
                    temperature: 0.1,
                  }
                })
              }
            );

            if (gRes.ok) {
              const gData = await gRes.json();
              const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(text);
                if (typeof parsed.angka === 'number') {
                  setAngkaSekarangInput(parsed.angka.toString());
                  setOcrConfidence(parsed.confidence ?? 0.9);
                  ocrSukses = true;
                }
              }
            }
          } catch (gErr) {
            console.warn('Direct Gemini API client call error:', gErr);
          }
        }

        if (!ocrSukses) {
          setOcrConfidence(0.5);
        }
      }
    } catch (err: any) {
      console.error('Error saat kompresi foto:', err);
      setErrorMessage(`Gagal memproses foto: ${err.message}`);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // -------------------------------------------------------------
  // 4. Kalkulasi & Validasi Anomali
  // -------------------------------------------------------------
  const parsedAngkaSekarang = parseInt(angkaSekarangInput, 10);
  const isValidNumber = !isNaN(parsedAngkaSekarang) && parsedAngkaSekarang >= 0;
  const pemakaianM3 = isValidNumber ? Math.max(0, parsedAngkaSekarang - angkaSebelumnya) : 0;

  // Cek kondisi anomali
  const isAngkaMundur = isValidNumber && parsedAngkaSekarang < angkaSebelumnya;
  const isConfidenceRendah = ocrConfidence < 0.7;
  const isLonjakanTinggi = customerAvgUsage > 0 && pemakaianM3 > 3 * customerAvgUsage;

  const hasAnomaly = isAngkaMundur || isConfidenceRendah || isLonjakanTinggi;

  // -------------------------------------------------------------
  // 5. Simpan Catatan ke Firebase
  // -------------------------------------------------------------
  const handleSimpan = async () => {
    if (!selectedCustomer) return;
    if (!isValidNumber) {
      setErrorMessage('Angka meteran wajib diisi dengan benar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalFotoUrl = capturedPhoto || '';

      // Upload file gambar ke Firebase Storage jika ada file baru
      if (photoBlob && user) {
        const fileName = `${selectedCustomer.id}_${currentPeriode}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `meter-photos/${user.uid}/${fileName}`);
        const snap = await uploadBytes(storageRef, photoBlob, {
          contentType: 'image/jpeg',
        });
        finalFotoUrl = await getDownloadURL(snap.ref);
      }

      // Coba panggil Cloud Function simpanReading, fallback langsung ke Firestore jika Cloud Function belum aktif
      try {
        await callSimpanReading({
          customerId: selectedCustomer.id,
          periode: currentPeriode,
          angka: parsedAngkaSekarang,
          fotoUrl: finalFotoUrl,
          ocrConfidence: ocrConfidence,
        });
      } catch (fnErr: any) {
        console.warn('Cloud Function simpanReading offline, menyimpan langsung ke Firestore:', fnErr);
        const readingId = `${selectedCustomer.id}_${currentPeriode}`;
        const anomalyReason = isAngkaMundur
          ? `Angka baru (${parsedAngkaSekarang}) lebih kecil dari angka sebelumnya (${angkaSebelumnya})`
          : isLonjakanTinggi
          ? `Lonjakan pemakaian tinggi (${pemakaianM3} m3 vs rata-rata ${customerAvgUsage.toFixed(1)} m3)`
          : isConfidenceRendah
          ? `Kualitas OCR rendah (${Math.round(ocrConfidence * 100)}%)`
          : null;

        // Hitung estimasi tagihan bertingkat PDAM Wimala
        let calculatedTagihan = 0;
        if (pemakaianM3 <= 10) {
          calculatedTagihan = pemakaianM3 * 2700;
        } else if (pemakaianM3 <= 20) {
          calculatedTagihan = 10 * 2700 + (pemakaianM3 - 10) * 5400;
        } else if (pemakaianM3 <= 30) {
          calculatedTagihan = 10 * 2700 + 10 * 5400 + (pemakaianM3 - 20) * 10800;
        } else {
          calculatedTagihan = 10 * 2700 + 10 * 5400 + 10 * 10800 + (pemakaianM3 - 30) * 21600;
        }

        await setDoc(doc(db, 'readings', readingId), {
          id: readingId,
          customerId: selectedCustomer.id,
          blok: selectedCustomer.blok,
          namaPemilik: selectedCustomer.namaPemilik,
          periode: currentPeriode,
          angkaSebelumnya: angkaSebelumnya,
          angkaSekarang: parsedAngkaSekarang,
          pemakaianM3: pemakaianM3,
          totalTagihan: calculatedTagihan,
          fotoUrl: finalFotoUrl,
          ocrConfidence: ocrConfidence,
          statusVerifikasi: hasAnomaly ? 'perlu_cek' : 'valid',
          catatanAnomali: anomalyReason,
          petugasId: user?.uid || 'petugas',
          petugasNama: profile?.nama || user?.email || 'Petugas Lapangan',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Update catatan terakhir di master pelanggan
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          lastReading: parsedAngkaSekarang,
          lastPeriode: currentPeriode,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      setSuccessNotice(`Catatan meteran ${selectedCustomer.blok} berhasil disimpan.`);
      
      // Reset form dan kembali ke kamera QR untuk unit selanjutnya
      setTimeout(() => {
        setSelectedCustomer(null);
        setExistingReading(null);
        setCapturedPhoto(null);
        setPhotoBlob(null);
        setAngkaSekarangInput('');
        setSuccessNotice(null);
        setActiveStep('scan_qr');
      }, 1200);

    } catch (err: any) {
      console.error('Error saat simpan reading:', err);
      setErrorMessage(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 6. Muat Riwayat Catatan Hari Ini
  // -------------------------------------------------------------
  const loadTodayHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    setActiveStep('history');

    try {
      // Query readings dicatat oleh worker pada periode ini
      const q = query(
        collection(db, 'readings'),
        where('dicatatOlehUid', '==', user.uid),
        where('periode', '==', currentPeriode),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snap = await getDocs(q);
      const items: ReadingRecord[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as ReadingRecord));
      setTodayReadings(items);
    } catch (e: any) {
      console.warn('Gagal memuat riwayat:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper render status rumah badge
  const renderStatusRumah = (st?: StatusRumah) => {
    switch (st) {
      case 'renovasi':
        return <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded">Sedang Renovasi</span>;
      case 'dibangun':
        return <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold px-2 py-0.5 rounded">Sedang Dibangun</span>;
      case 'booking':
        return <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold px-2 py-0.5 rounded">Booking</span>;
      case 'kosong':
        return <span className="bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">Rumah Kosong</span>;
      default:
        return <span className="bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-bold px-2 py-0.5 rounded">Terhuni</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between max-w-md mx-auto select-none">
      {/* Admin Quick Switcher Banner */}
      {(profile?.role === 'admin' || user?.email?.toLowerCase().includes('admin')) && (
        <div className="bg-amber-400 text-slate-950 px-3.5 py-2 text-xs font-bold flex items-center justify-between border-b border-amber-500 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-900 flex-shrink-0" />
            <span>Login sebagai Admin</span>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="bg-slate-950 hover:bg-slate-800 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1"
          >
            <span>Panel Admin</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      {/* Top Header: Petugas & Periode (Kontras Tinggi) */}
      <header className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-teal-400 font-bold block">
            PETUGAS LAPANGAN
          </span>
          <span className="text-sm font-bold text-white truncate max-w-[200px] block">
            {profile?.nama || 'Petugas'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded font-mono font-bold text-slate-200">
            {currentPeriode}
          </span>
          <button
            onClick={logout}
            title="Keluar"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 flex flex-col justify-start">
        {/* Notifikasi Sukses / Error */}
        {successNotice && (
          <div className="mb-3 p-3 bg-teal-900/90 border border-teal-400 rounded text-xs text-teal-100 font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-teal-300 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mb-3 p-3 bg-rose-950 border border-rose-500 rounded text-xs text-rose-200 font-bold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1: SCAN QR CODE KAVLING */}
        {/* ============================================================ */}
        {activeStep === 'scan_qr' && (
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <QrCode className="w-4 h-4" />
                  Arahkan ke QR Boks Meter
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">1/3 Scan Unit</span>
              </div>

              {/* Viewfinder Scanner */}
              <div className="relative rounded overflow-hidden bg-black aspect-square flex items-center justify-center border-2 border-dashed border-teal-500/60">
                <div id={qrRegionId} className="w-full h-full" />
                {!isScannerRunning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/80">
                    <QrCode className="w-10 h-10 text-slate-500 mb-2" />
                    <span className="text-xs text-slate-400 mb-2">Kamera scanner belum aktif atau HTTPS diperlukan.</span>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-3 py-1.5 bg-teal-700 text-white rounded text-xs font-bold"
                    >
                      Muat Ulang Kamera
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Input Manual / Fallback */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                Atau Ketik Kode / Blok Rumah:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Contoh: D-01 atau d_01"
                  value={manualCustomerId}
                  onChange={(e) => setManualCustomerId(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-bold bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={() => {
                    if (manualCustomerId.trim()) {
                      handleQrDetected(manualCustomerId.trim());
                    }
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded flex items-center gap-1"
                >
                  <span>Cari</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: FORM PENCATATAN METER (FOTO + OCR + KONFIRMASI) */}
        {/* ============================================================ */}
        {activeStep === 'form_meter' && selectedCustomer && (
          <div className="space-y-3 pb-6">
            {/* Banner Customer Info */}
            <div className="bg-slate-950 border-2 border-teal-600 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-2xl text-white tracking-tight">
                      {selectedCustomer.blok}
                    </span>
                    {renderStatusRumah(selectedCustomer.statusRumah)}
                  </div>
                  <p className="text-xs text-slate-300 font-semibold mt-0.5">
                    {selectedCustomer.namaPemilik}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">No. Meteran</span>
                  <span className="text-xs font-mono font-bold text-teal-400">
                    {selectedCustomer.nomorMeteran || '-'}
                  </span>
                </div>
              </div>

              {/* Notifikasi jika sudah pernah dicatat di periode ini */}
              {existingReading && (
                <div className="p-2 bg-amber-950/80 border border-amber-500 rounded text-xs text-amber-200 flex items-start gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Unit ini sudah dicatat bulan ini (Stand: <strong>{existingReading.angkaSekarang} m³</strong>). Anda sedang melakukan pembaruan/koreksi.
                  </span>
                </div>
              )}

              {/* Perbandingan Stand Awal */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Bulan Lalu
                  </span>
                  <span className="font-mono text-base font-extrabold text-slate-300">
                    {angkaSebelumnya} <span className="text-xs text-slate-500 font-normal">m³</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Rata-rata Historis
                  </span>
                  <span className="font-mono text-base font-bold text-slate-300">
                    {customerAvgUsage > 0 ? `${Math.round(customerAvgUsage)} m³` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tombol Ambil Foto Meteran & OCR */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block">
                Foto Angka Meteran:
              </span>

              {/* Input Kamera Native (Paling Stabil di HP Outdoor) */}
              <div className="flex gap-2">
                <label className="flex-1 py-3 px-3 rounded bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow">
                  <Camera className="w-5 h-5 text-teal-200" />
                  <span>{capturedPhoto ? 'Foto Ulang Meter' : 'Buka Kamera & Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Preview Foto */}
              {capturedPhoto && (
                <div className="relative rounded overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700 mt-2">
                  <img
                    src={capturedPhoto}
                    alt="Bukti Meteran"
                    className="w-full h-full object-contain"
                  />
                  {isProcessingOcr && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-teal-400 text-xs font-bold">
                      <RefreshCw className="w-6 h-6 animate-spin mb-1 text-teal-300" />
                      <span>Gemini AI membaca angka meter...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Angka Konfirmasi & Koreksi Manual */}
            <div className="bg-slate-950 border-2 border-slate-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-white uppercase tracking-wide">
                  Angka Meter Sekarang (m³):
                </label>
                {ocrConfidence < 0.7 && capturedPhoto && (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    OCR Rendah ({Math.round(ocrConfidence * 100)}%)
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ketik angka meter..."
                  value={angkaSekarangInput}
                  onChange={(e) => setAngkaSekarangInput(e.target.value)}
                  className="w-full font-mono text-2xl font-black px-3 py-2.5 bg-slate-900 border-2 border-teal-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Ringkasan Pemakaian Realtime */}
              {isValidNumber && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Selisih Pemakaian:</span>
                  <span className={`font-mono font-extrabold text-base ${isAngkaMundur ? 'text-rose-400' : 'text-teal-400'}`}>
                    {pemakaianM3} m³
                  </span>
                </div>
              )}
            </div>

            {/* Peringatan Anomali */}
            {hasAnomaly && (
              <div className="p-3 bg-rose-950/90 border border-rose-500 rounded text-xs text-rose-200 font-bold space-y-1">
                <div className="flex items-center gap-1 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>PERINGATAN ANOMALI (Status: PERLU CEK)</span>
                </div>
                {isAngkaMundur && (
                  <p className="font-normal text-rose-200">
                    • Angka baru ({parsedAngkaSekarang}) lebih kecil dari bulan lalu ({angkaSebelumnya}).
                  </p>
                )}
                {isConfidenceRendah && (
                  <p className="font-normal text-rose-200">
                    • Kualitas foto buram / confidence OCR rendah.
                  </p>
                )}
                {isLonjakanTinggi && (
                  <p className="font-normal text-rose-200">
                    • Pemakaian ({pemakaianM3} m³) melonjak lebih dari 3x rata-rata ({Math.round(customerAvgUsage)} m³).
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons: Tombol Besar Terbaca Terik Matahari */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleSimpan}
                disabled={!isValidNumber || isSubmitting}
                className={`w-full py-4 rounded-lg font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isValidNumber && !isSubmitting
                    ? 'bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 cursor-pointer'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <span>Menyimpan ke Sistem...</span>
                ) : (
                  <>
                    <Check className="w-6 h-6 stroke-[3]" />
                    <span>Konfirmasi & Simpan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setActiveStep('scan_qr');
                }}
                className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Batal / Ganti Unit
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: RIWAYAT CATATAN HARI INI */}
        {/* ============================================================ */}
        {activeStep === 'history' && (
          <div className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2 uppercase tracking-wide">
                <History className="w-4 h-4 text-teal-400" />
                Riwayat Catatan Hari Ini
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {todayReadings.length} Unit
              </span>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-500" />
                Memuat riwayat...
              </div>
            ) : todayReadings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded">
                Belum ada meteran yang Anda catat hari ini.
              </div>
            ) : (
              <div className="space-y-2">
                {todayReadings.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-white">{r.blok}</strong>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          r.status === 'perlu_cek'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700'
                            : 'bg-teal-950 text-teal-300 border border-teal-800'
                        }`}>
                          {r.status === 'perlu_cek' ? 'Perlu Cek' : 'Normal'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{r.namaPemilik}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-teal-400">
                        {r.angkaSekarang} m³
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        +{r.pemakaianM3} m³
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation (Khusus Worker di HP) */}
      <nav className="bg-slate-950 border-t border-slate-800 grid grid-cols-2 p-1">
        <button
          onClick={() => {
            setActiveStep('scan_qr');
            setSelectedCustomer(null);
          }}
          className={`py-3 flex flex-col items-center justify-center gap-1 font-bold text-xs ${
            activeStep === 'scan_qr' || activeStep === 'form_meter'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-slate-400'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>Scan Meteran</span>
        </button>
        <button
          onClick={loadTodayHistory}
          className={`py-3 flex flex-col items-center justify-center gap-1 font-bold text-xs ${
            activeStep === 'history'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-slate-400'
          }`}
        >
          <History className="w-5 h-5" />
          <span>Riwayat Hari Ini</span>
        </button>
      </nav>
    </div>
  );
};
