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
  ShieldCheck,
  Info,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Customer, ReadingRecord, StatusRumah, Tariff } from '../types';
import { compressMeterPhoto } from '../lib/imageCompression';
import { bacaFotoMeteran, OcrFoto } from '../lib/ocr';
import { normalizeBlok, blokToId } from '../lib/blok';
import { hitungBiaya } from '../lib/tariff';

export const WorkerPage: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  // Current active period (YYYY-MM)
  const currentPeriode = new Date().toISOString().slice(0, 7); // e.g. "2026-09"

  // Step flow: 'scan_qr' | 'form_meter' | 'history'
  const [activeStep, setActiveStep] = useState<'scan_qr' | 'unit_baru' | 'form_meter' | 'history'>('scan_qr');

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
  const [isManualVerified, setIsManualVerified] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Input blok manual
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [lastOcr, setLastOcr] = useState<OcrFoto | null>(null);

  // Rumah belum terdaftar (stiker terbaca tapi data belum ada) -> tambah otomatis
  const [newUnit, setNewUnit] = useState({ cluster: '', blok: '', nama: '', angkaAwal: '' });
  const [isSavingUnit, setIsSavingUnit] = useState(false);

  // Tarif air dari Firestore (diatur admin)
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  useEffect(() => {
    getDocs(query(collection(db, 'tariffs'), orderBy('minM3', 'asc')))
      .then((snap) => {
        const list: Tariff[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Tariff));
        setTariffs(list);
      })
      .catch((e) => console.warn('Gagal memuat tarif, memakai tarif bawaan:', e));
  }, []);

  // Today's history state
  const [todayReadings, setTodayReadings] = useState<ReadingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Kembali ke layar awal dan bersihkan semua state unit sebelumnya
  const resetToStart = () => {
    setSelectedCustomer(null);
    setExistingReading(null);
    setCapturedPhoto(null);
    setPhotoBlob(null);
    setAngkaSekarangInput('');
    setIsManualVerified(false);
    setOcrConfidence(1);
    setLastOcr(null);
    setManualCustomerId('');
    setErrorMessage(null);
    setActiveStep('scan_qr');
  };

  // -------------------------------------------------------------
  // 1. Cari unit rumah berdasarkan blok (dari stiker / ketik manual)
  const cariCustomerByBlok = async (raw: string): Promise<Customer | null> => {
    const blok = normalizeBlok(raw);
    if (!blok) return null;

    // 1. Cari by ID normalized (contoh: d_15)
    const byId = await getDoc(doc(db, 'customers', blokToId(blok)));
    if (byId.exists()) return { id: byId.id, ...byId.data() } as Customer;

    // 2. Cari by ID raw lowercase
    const byIdRaw = await getDoc(doc(db, 'customers', raw.trim().toLowerCase()));
    if (byIdRaw.exists()) return { id: byIdRaw.id, ...byIdRaw.data() } as Customer;

    // 3. Query field 'blok' normalized
    const snap = await getDocs(query(collection(db, 'customers'), where('blok', '==', blok), limit(1)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;

    // 4. Query field 'blok' raw uppercase
    const snapRaw = await getDocs(query(collection(db, 'customers'), where('blok', '==', raw.trim().toUpperCase()), limit(1)));
    if (!snapRaw.empty) return { id: snapRaw.docs[0].id, ...snapRaw.docs[0].data() } as Customer;

    return null;
  };

  const handleCariBlok = async (raw: string, keepPhoto = false, ocr: OcrFoto | null = null) => {
    setErrorMessage(null);
    setSuccessNotice(null);
    try {
      const found = await cariCustomerByBlok(raw);
      if (found) {
        await processCustomerFound(found, { keepPhoto });
        return;
      }
      // Belum terdaftar -> tawarkan tambah otomatis
      setNewUnit({
        cluster: ocr?.cluster || '',
        blok: normalizeBlok(raw),
        nama: ocr?.pengguna || '',
        angkaAwal: ocr?.angka !== null && ocr?.angka !== undefined ? String(ocr.angka) : '',
      });
      setActiveStep('unit_baru');
    } catch (err: any) {
      console.error('Error saat memuat customer:', err);
      setErrorMessage(`Gagal mengambil data pelanggan: ${err.message}`);
    }
  };

  // Petugas menambahkan unit baru dari stiker; admin menyesuaikan nanti
  const handleBuatUnitBaru = async () => {
    const blok = normalizeBlok(newUnit.blok);
    if (!blok) {
      setErrorMessage('Nomor blok wajib diisi.');
      return;
    }
    setIsSavingUnit(true);
    setErrorMessage(null);
    try {
      const id = blokToId(blok);
      const existing = await getDoc(doc(db, 'customers', id));
      let unit: Customer;
      if (existing.exists()) {
        unit = { id: existing.id, ...existing.data() } as Customer; // sudah dibuat orang lain, pakai saja
      } else {
        unit = {
          id,
          blok,
          cluster: newUnit.cluster.trim(),
          namaPemilik: newUnit.nama.trim() || 'Belum diisi',
          nomorMeteran: '',
          angkaAwal: Number(newUnit.angkaAwal) || 0,
          statusRumah: 'terhuni',
          needsReview: true,
          sumber: 'worker',
          dibuatOleh: profile?.nama || user?.email || 'Petugas',
        };
        await setDoc(doc(db, 'customers', id), {
          ...unit,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await processCustomerFound(unit, { keepPhoto: !!capturedPhoto });
    } catch (err: any) {
      console.error('Error saat menambah unit:', err);
      setErrorMessage(`Gagal menambah unit: ${err.message}`);
    } finally {
      setIsSavingUnit(false);
    }
  };

  const processCustomerFound = async (customer: Customer, opts: { keepPhoto?: boolean } = {}) => {
    setSelectedCustomer(customer);

    // Cek apakah sudah dicatat di periode berjalan
    const readingId = `${customer.id}_${currentPeriode}`;
    const readDoc = await getDoc(doc(db, 'readings', readingId));

    // Riwayat unit: satu query sederhana (tanpa composite index), olah di client
    let prevAngka = customer.angkaAwal ?? 0;
    let avg = 0;
    try {
      const histSnap = await getDocs(query(collection(db, 'readings'), where('customerId', '==', customer.id)));
      const past = histSnap.docs
        .map((d) => d.data() as any)
        .filter((r) => r.periode && r.periode < currentPeriode)
        .sort((a, b) => String(b.periode).localeCompare(String(a.periode)));
      if (past.length > 0) {
        prevAngka = past[0].angkaSekarang ?? prevAngka;
        const recent = past.slice(0, 6);
        avg = recent.reduce((s, r) => s + (r.pemakaianM3 || 0), 0) / recent.length;
      }
    } catch (e) {
      console.warn('Gagal memuat riwayat unit:', e);
    }
    setCustomerAvgUsage(avg);

    if (readDoc.exists()) {
      const rec = readDoc.data() as ReadingRecord;
      setExistingReading(rec);
      setAngkaSebelumnya(rec.angkaSebelumnya);
      if (!opts.keepPhoto) {
        setAngkaSekarangInput(rec.angkaSekarang.toString());
        setCapturedPhoto(rec.fotoUrl || null);
        setPhotoBlob(null);
        setIsManualVerified(true); // data lama sudah pernah disimpan
      }
    } else {
      setExistingReading(null);
      setAngkaSebelumnya(prevAngka);
      if (!opts.keepPhoto) {
        setCapturedPhoto(null);
        setPhotoBlob(null);
        setAngkaSekarangInput('');
        setIsManualVerified(false);
        setOcrConfidence(1);
      }
    }

    setActiveStep('form_meter');
  };

  // -------------------------------------------------------------
  // 3. Foto Meteran & Kompresi & OCR Gemini Vision (via /api/baca-meteran)
  // -------------------------------------------------------------

  // Foto pertama: baca BLOK dari stiker + ANGKA dari meteran sekaligus
  const handleStartPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setIsProcessingOcr(true);
    setIsManualVerified(false);
    setLastOcr(null);

    try {
      const compressed = await compressMeterPhoto(file, 960, 960, 0.65);
      setCapturedPhoto(compressed.base64);
      setPhotoBlob(compressed.blob);

      let ocr: OcrFoto | null = null;
      let ocrError: string | null = null;
      try {
        ocr = await bacaFotoMeteran(compressed.base64);
        setLastOcr(ocr);
        if (ocr.angka !== null) {
          setAngkaSekarangInput(String(ocr.angka));
          setOcrConfidence(ocr.confidence ?? 0.8);
        } else {
          setAngkaSekarangInput('');
          setOcrConfidence(0.3);
        }
      } catch (ocrErr: any) {
        setAngkaSekarangInput('');
        setOcrConfidence(0.3);
        ocrError = ocrErr.message || 'Pembacaan foto gagal';
      }

      if (ocr?.blok) {
        await handleCariBlok(ocr.blok, true, ocr);
      } else {
        setErrorMessage(
          ocrError
            ? `${ocrError}. Ketik nomor blok di bawah, foto tetap tersimpan.`
            : 'Blok di stiker tidak terbaca. Ketik nomor blok di bawah, foto tetap tersimpan.'
        );
      }
    } catch (err: any) {
      console.error('Error saat memproses foto:', err);
      setErrorMessage(`Gagal memproses foto: ${err.message}`);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Foto ulang di form: hanya membaca angka meteran
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setIsProcessingOcr(true);
    setIsManualVerified(false);

    try {
      const compressed = await compressMeterPhoto(file, 960, 960, 0.65);
      setCapturedPhoto(compressed.base64);
      setPhotoBlob(compressed.blob);

      try {
        const ocr = await bacaFotoMeteran(compressed.base64);
        if (ocr.angka !== null) {
          setAngkaSekarangInput(String(ocr.angka));
          setOcrConfidence(ocr.confidence ?? 0.8);
        } else {
          setOcrConfidence(0.3);
          setErrorMessage('Angka meteran tidak terbaca otomatis. Ketik angka hitam secara manual lalu tekan "Sesuai".');
        }
      } catch (ocrErr: any) {
        setOcrConfidence(0.3);
        setErrorMessage(`${ocrErr.message}. Ketik angka hitam secara manual lalu tekan "Sesuai".`);
      }
    } catch (err: any) {
      console.error('Error saat memproses foto:', err);
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
  const isConfidenceRendah = !isManualVerified && ocrConfidence < 0.7;
  const isLonjakanTinggi = customerAvgUsage > 0 && pemakaianM3 > 3 * customerAvgUsage;
  const isUnitBaru = !!selectedCustomer?.needsReview;

  const hasAnomaly = isAngkaMundur || isConfidenceRendah || isLonjakanTinggi || isUnitBaru;

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

      // Coba upload file gambar ke Firebase Storage dengan batas waktu 2 detik
      // Jika Storage belum diaktifkan di Firebase Console, otomatis simpan via data base64 tanpa macet!
      if (photoBlob && user) {
        try {
          const uploadPromise = async () => {
            const fileName = `${selectedCustomer.id}_${currentPeriode}_${Date.now()}.jpg`;
            const storageRef = ref(storage, `meter-photos/${user.uid}/${fileName}`);
            const snap = await uploadBytes(storageRef, photoBlob, {
              contentType: 'image/jpeg',
            });
            return await getDownloadURL(snap.ref);
          };

          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Storage timeout')), 2000)
          );

          finalFotoUrl = await Promise.race([uploadPromise(), timeoutPromise]);
        } catch (storageErr) {
          console.warn('Storage upload dilewati, menggunakan base64 langsung:', storageErr);
          finalFotoUrl = capturedPhoto || '';
        }
      }

      // Hitung tagihan bertingkat memakai tarif Firestore (yang diatur admin)
      const totalBiaya = hitungBiaya(pemakaianM3, tariffs);

      const readingId = `${selectedCustomer.id}_${currentPeriode}`;
      const catatan: string[] = [];
      if (isAngkaMundur) catatan.push(`Angka baru (${parsedAngkaSekarang}) lebih kecil dari angka sebelumnya (${angkaSebelumnya})`);
      if (isLonjakanTinggi) catatan.push(`Lonjakan pemakaian tinggi (${pemakaianM3} m3 vs rata-rata ${customerAvgUsage.toFixed(1)} m3)`);
      if (isConfidenceRendah) catatan.push(`Pembacaan foto kurang jelas (${Math.round(ocrConfidence * 100)}%), belum dikonfirmasi petugas`);
      if (isUnitBaru) catatan.push('Unit baru ditambahkan petugas dari stiker, data rumah perlu disesuaikan admin');

      const petugasNama = profile?.nama || user?.email || 'Petugas Lapangan';

      // Skema HARUS sama dengan ReadingRecord yang dibaca halaman admin
      await setDoc(doc(db, 'readings', readingId), {
        id: readingId,
        customerId: selectedCustomer.id,
        blok: selectedCustomer.blok,
        namaPemilik: selectedCustomer.namaPemilik,
        nomorMeteran: selectedCustomer.nomorMeteran || '',
        periode: currentPeriode,
        angkaSebelumnya: angkaSebelumnya,
        angkaSekarang: parsedAngkaSekarang,
        pemakaianM3: pemakaianM3,
        totalBiaya: totalBiaya,
        fotoUrl: finalFotoUrl,
        ocrConfidence: ocrConfidence,
        status: hasAnomaly ? 'perlu_cek' : 'normal',
        catatanAnomali: catatan.length > 0 ? catatan.join('; ') : null,
        dicatatOleh: petugasNama,
        dicatatOlehUid: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSuccessNotice(`Catatan meteran ${selectedCustomer.blok} berhasil disimpan.`);

      // Kembali ke awal untuk unit selanjutnya
      setTimeout(() => {
        resetToStart();
        setSuccessNotice(null);
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
      // Query sederhana (tanpa orderBy) agar tidak butuh composite index; urut & filter hari ini di client
      const q = query(
        collection(db, 'readings'),
        where('dicatatOlehUid', '==', user.uid),
        where('periode', '==', currentPeriode)
      );

      const snap = await getDocs(q);
      const today = new Date().toDateString();
      const items: ReadingRecord[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as ReadingRecord));

      const toMs = (r: any) => (r.createdAt?.toMillis ? r.createdAt.toMillis() : Date.now());
      const todayItems = items
        .filter((r: any) => !r.createdAt?.toDate || r.createdAt.toDate().toDateString() === today)
        .sort((a, b) => toMs(b) - toMs(a))
        .slice(0, 50);
      setTodayReadings(todayItems);
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
        {/* STEP 1: FOTO METERAN + STIKER (1 FOTO, AI BACA BLOK & ANGKA) */}
        {/* ============================================================ */}
        {activeStep === 'scan_qr' && (
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Camera className="w-4 h-4" />
                Foto Meteran + Stiker Blok
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Foto <strong className="text-slate-200">sekali saja</strong>: pastikan <strong className="text-slate-200">angka meteran</strong> dan{' '}
                <strong className="text-slate-200">stiker / tulisan blok</strong> di tutup boks sama-sama terlihat. AI akan membaca blok dan angkanya.
              </p>

              {capturedPhoto && !isProcessingOcr && (
                <div className="rounded overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                  <img src={capturedPhoto} alt="Foto meteran" className="w-full h-full object-contain" />
                </div>
              )}

              <label
                className={`w-full py-5 rounded-lg font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg ${
                  isProcessingOcr
                    ? 'bg-slate-700 text-slate-300 cursor-wait'
                    : 'bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white cursor-pointer'
                }`}
              >
                {isProcessingOcr ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>AI membaca foto...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6" />
                    <span>{capturedPhoto ? 'Foto Ulang' : 'Buka Kamera & Foto'}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={isProcessingOcr}
                  onChange={handleStartPhoto}
                  className="hidden"
                />
              </label>
            </div>

            {/* Input Manual Blok (jika stiker tidak terbaca) */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                {capturedPhoto ? 'Stiker tidak terbaca? Ketik blok / nomor unit rumah:' : 'Atau ketik blok / nomor unit rumah:'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Contoh: D-15 atau Unit 15"
                  value={manualCustomerId}
                  onChange={(e) => setManualCustomerId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualCustomerId.trim()) {
                      handleCariBlok(manualCustomerId.trim(), !!capturedPhoto, lastOcr);
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm font-bold bg-slate-900 border border-slate-700 rounded text-white uppercase focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={() => {
                    if (manualCustomerId.trim()) {
                      handleCariBlok(manualCustomerId.trim(), !!capturedPhoto, lastOcr);
                    }
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <span>Cari</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1B: RUMAH BELUM TERDAFTAR -> TAMBAH OTOMATIS */}
        {/* ============================================================ */}
        {activeStep === 'unit_baru' && (
          <div className="space-y-3 pb-6">
            <div className="bg-amber-950/70 border border-amber-500 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm">
                <UserPlus className="w-4 h-4 flex-shrink-0" />
                <span>Rumah belum terdaftar</span>
              </div>
              <p className="text-[11px] text-amber-100/90 leading-relaxed">
                Stiker terbaca tetapi unit ini belum ada di data. Cek isian di bawah, lalu tambahkan. Admin akan menyesuaikan datanya nanti.
              </p>
            </div>

            {capturedPhoto && (
              <div className="rounded overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                <img src={capturedPhoto} alt="Foto meteran" className="w-full h-full object-contain" />
              </div>
            )}

            <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cluster</label>
                  <input
                    type="text"
                    placeholder="Kamala"
                    value={newUnit.cluster}
                    onChange={(e) => setNewUnit({ ...newUnit, cluster: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Blok / No. Rumah</label>
                  <input
                    type="text"
                    placeholder="D-15"
                    value={newUnit.blok}
                    onChange={(e) => setNewUnit({ ...newUnit, blok: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm font-mono font-black bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nama Pengguna (boleh dikosongkan)</label>
                <input
                  type="text"
                  placeholder="Nama penghuni"
                  value={newUnit.nama}
                  onChange={(e) => setNewUnit({ ...newUnit, nama: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-bold bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Angka meter saat ini (jadi stand awal, m³)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Angka hitam meteran"
                  value={newUnit.angkaAwal}
                  onChange={(e) => setNewUnit({ ...newUnit, angkaAwal: e.target.value })}
                  className="w-full px-3 py-2 text-lg font-mono font-black bg-slate-900 border-2 border-teal-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleBuatUnitBaru}
              disabled={isSavingUnit || !newUnit.blok.trim()}
              className={`w-full py-4 rounded-lg font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 ${
                isSavingUnit || !newUnit.blok.trim()
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              <span>{isSavingUnit ? 'Menambahkan...' : 'Tambahkan & Lanjut Catat'}</span>
            </button>
            <button
              type="button"
              onClick={resetToStart}
              className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              Batal
            </button>
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
                  {selectedCustomer.cluster && (
                    <p className="text-[11px] text-slate-400 font-semibold">Cluster {selectedCustomer.cluster}</p>
                  )}
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

            {/* Panduan Jelas Pencatatan Angka Meteran */}
            <div className="bg-slate-950 border border-teal-800/80 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-teal-300 font-bold">
                <Info className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Petunjuk Ketik Manual (PDAM):</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                • <strong>HANYA masukkan ANGKA HITAM (m³)</strong>. Angka merah (liter/desimal) atau jarum putar merah <strong>diabaikan (jangan diketik)</strong>.
              </p>
              <p className="text-slate-400 text-[11px]">
                • Contoh: Jika di rol meteran tertulis <span className="font-mono text-white bg-slate-800 px-1 py-0.5 rounded">0000136</span>, cukup ketik <strong className="text-teal-300 font-mono">136</strong> (atau <span className="font-mono text-teal-300">0000136</span>).
              </p>
            </div>

            {/* Input Angka Konfirmasi & Koreksi Manual */}
            <div className="bg-slate-950 border-2 border-slate-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-white uppercase tracking-wide">
                  Angka Meter Sekarang (m³):
                </label>
                {isManualVerified ? (
                  <span className="text-[10px] text-teal-300 font-bold bg-teal-950 px-2 py-0.5 rounded border border-teal-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-400" />
                    Terverifikasi Petugas
                  </span>
                ) : ocrConfidence < 0.7 && capturedPhoto ? (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    Perlu Verifikasi Angka
                  </span>
                ) : capturedPhoto ? (
                  <span className="text-[10px] text-teal-300 font-bold bg-teal-950 px-2 py-0.5 rounded border border-teal-700">
                    OCR Otomatis ({Math.round(ocrConfidence * 100)}%)
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ketik angka hitam (m³)..."
                  value={angkaSekarangInput}
                  onChange={(e) => {
                    setAngkaSekarangInput(e.target.value);
                    setIsManualVerified(true);
                    setOcrConfidence(1.0);
                  }}
                  className="flex-1 font-mono text-2xl font-black px-3 py-2.5 bg-slate-900 border-2 border-teal-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                {angkaSekarangInput && !isManualVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualVerified(true);
                      setOcrConfidence(1.0);
                    }}
                    className="px-3.5 py-3 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs rounded border border-teal-500 flex items-center gap-1 shadow-sm whitespace-nowrap cursor-pointer"
                    title="Konfirmasi bahwa angka meteran ini sudah benar"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Sesuai</span>
                  </button>
                )}
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
                    • Kualitas foto buram / belum diverifikasi petugas. Klik tombol "Sesuai" atau edit angka untuk konfirmasi.
                  </p>
                )}
                {isUnitBaru && (
                  <p className="font-normal text-rose-200">
                    • Unit ini baru ditambahkan dari stiker. Admin akan menyesuaikan data rumahnya.
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
                onClick={resetToStart}
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
          onClick={resetToStart}
          className={`py-3 flex flex-col items-center justify-center gap-1 font-bold text-xs ${
            activeStep === 'scan_qr' || activeStep === 'unit_baru' || activeStep === 'form_meter'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-slate-400'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>Foto Meteran</span>
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
