import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  FileSpreadsheet, 
  Printer, 
  DollarSign, 
  Database, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  Eye, 
  EyeOff,
  Lock, 
  UserPlus, 
  ShieldCheck, 
  LogOut, 
  RefreshCw,
  X,
  Save,
  Check,
  Building,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { sendPasswordResetEmail, getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db, firebaseConfig, callResetPasswordWorker } from '../lib/firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import { normalizeBlok, blokToId } from '../lib/blok';
import { Customer, Tariff, ReadingRecord, StatusRumah, ReadingStatus } from '../types';

type AdminTab = 'pelanggan' | 'pencatatan' | 'tarif' | 'cetak_qr' | 'worker';

export const AdminPage: React.FC = () => {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('pencatatan');

  // Global Period Filter
  const [selectedPeriode, setSelectedPeriode] = useState<string>(new Date().toISOString().slice(0, 7));

  // -------------------------------------------------------------
  // DATA STATES
  // -------------------------------------------------------------
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss feedback notice
  useEffect(() => {
    if (feedbackNotice) {
      const t = setTimeout(() => setFeedbackNotice(null), 3500);
      return () => clearTimeout(t);
    }
  }, [feedbackNotice]);

  // Load all core data
  const loadAllData = async () => {
    setLoadingData(true);
    try {
      // 1. Load Customers
      const custSnap = await getDocs(collection(db, 'customers'));
      const custList: Customer[] = [];
      custSnap.forEach((d) => custList.push({ id: d.id, ...d.data() } as Customer));
      custList.sort((a, b) => a.blok.localeCompare(b.blok, undefined, { numeric: true }));
      setCustomers(custList);

      // 2. Load Tariffs
      const tariffSnap = await getDocs(query(collection(db, 'tariffs'), orderBy('minM3', 'asc')));
      const tariffList: Tariff[] = [];
      tariffSnap.forEach((d) => tariffList.push({ id: d.id, ...d.data() } as Tariff));
      setTariffs(tariffList);

      // 3. Load Readings for active period
      const readSnap = await getDocs(query(collection(db, 'readings'), where('periode', '==', selectedPeriode)));
      const readList: ReadingRecord[] = [];
      readSnap.forEach((d) => {
        const x: any = d.data();
        readList.push({
          id: d.id,
          ...x,
          totalBiaya: x.totalBiaya ?? x.totalTagihan ?? 0,
          status: x.status ?? x.statusVerifikasi ?? 'normal',
          dicatatOleh: x.dicatatOleh ?? x.petugasNama ?? '',
        } as ReadingRecord);
      });
      setReadings(readList);

      // 4. Load Workers
      const userSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'worker')));
      const workerList: UserProfile[] = [];
      userSnap.forEach((d) => workerList.push({ uid: d.id, ...d.data() } as UserProfile));
      setWorkers(workerList);
    } catch (err: any) {
      console.error('Error saat memuat data admin:', err);
      setFeedbackNotice({ type: 'error', message: `Gagal memuat data: ${err.message}` });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedPeriode]);

  // -------------------------------------------------------------
  // TAB 1: DATA PELANGGAN (CRUD + STATUS RUMAH + IMPORT/EXPORT)
  // -------------------------------------------------------------
  const [custSearch, setCustSearch] = useState('');
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [custForm, setCustForm] = useState({
    cluster: '',
    blok: '',
    namaPemilik: '',
    nomorMeteran: '',
    angkaAwal: 0,
    statusRumah: 'terhuni' as StatusRumah,
  });

  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustForm({ cluster: '', blok: '', namaPemilik: '', nomorMeteran: '', angkaAwal: 0, statusRumah: 'terhuni' });
    setIsCustModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustForm({
      cluster: c.cluster || '',
      blok: c.blok,
      namaPemilik: c.namaPemilik,
      nomorMeteran: c.nomorMeteran || '',
      angkaAwal: c.angkaAwal || 0,
      statusRumah: c.statusRumah || 'terhuni',
    });
    setIsCustModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.blok.trim() || !custForm.namaPemilik.trim()) {
      alert('Blok dan Nama Pemilik wajib diisi.');
      return;
    }

    try {
      const blokBersih = normalizeBlok(custForm.blok);
      const cleanId = blokToId(blokBersih);
      const targetId = editingCustomer ? editingCustomer.id : cleanId;
      if (!editingCustomer && customers.some((c) => c.id === cleanId)) {
        alert(`Blok ${blokBersih} sudah ada. Edit data yang ada saja.`);
        return;
      }

      await setDoc(doc(db, 'customers', targetId), {
        id: targetId,
        cluster: custForm.cluster.trim(),
        blok: blokBersih,
        needsReview: false,
        sumber: editingCustomer?.sumber || 'admin',
        namaPemilik: custForm.namaPemilik.trim(),
        nomorMeteran: custForm.nomorMeteran.trim(),
        angkaAwal: Number(custForm.angkaAwal) || 0,
        statusRumah: custForm.statusRumah,
        updatedAt: serverTimestamp(),
        ...(editingCustomer ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });

      setFeedbackNotice({ type: 'success', message: `Data unit ${custForm.blok} berhasil disimpan.` });
      setIsCustModalOpen(false);
      loadAllData();
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    }
  };

  const handleDeleteCustomer = async (c: Customer) => {
    if (confirm(`Yakin ingin menghapus kavling ${c.blok} (${c.namaPemilik}) dari database?`)) {
      try {
        await deleteDoc(doc(db, 'customers', c.id));
        setFeedbackNotice({ type: 'success', message: `Unit ${c.blok} berhasil dihapus.` });
        loadAllData();
      } catch (err: any) {
        alert(`Gagal menghapus: ${err.message}`);
      }
    }
  };

  const handleTandaiSesuai = async (c: Customer) => {
    try {
      await updateDoc(doc(db, 'customers', c.id), { needsReview: false, updatedAt: serverTimestamp() });
      loadAllData();
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    }
  };

  // Unduh Template Excel Pelanggan
  const handleDownloadTemplate = () => {
    const templateRows = [
      { 'Cluster': 'Kamala', 'Blok': 'D-01', 'Nama Pemilik': 'Budi Santoso', 'Nomor Meteran': 'WM-001', 'Angka Awal': 142, 'Status Rumah': 'terhuni' },
      { 'Cluster': 'Kamala', 'Blok': 'D-02', 'Nama Pemilik': 'Siti Rahmawati', 'Nomor Meteran': 'WM-002', 'Angka Awal': 198, 'Status Rumah': 'renovasi' },
      { 'Cluster': 'Kamala', 'Blok': 'A-21', 'Nama Pemilik': 'Ahmad Fauzan', 'Nomor Meteran': 'WM-003', 'Angka Awal': 0, 'Status Rumah': 'booking' },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Template Pelanggan');
    XLSX.writeFile(wb, 'Template_Pelanggan_Wimala.xlsx');
  };

  // Import Excel Pelanggan
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

        if (rows.length === 0) {
          alert('File Excel kosong atau tidak sesuai format.');
          return;
        }

        let count = 0;
        for (const row of rows) {
          const blok = normalizeBlok(String(row['Blok'] || row['blok'] || ''));
          const cluster = String(row['Cluster'] || row['cluster'] || '').trim();
          const nama = String(row['Nama Pemilik'] || row['namaPemilik'] || row['Nama'] || '').trim();
          if (!blok || !nama) continue;

          const cleanId = blokToId(blok);
          const noMeter = String(row['Nomor Meteran'] || row['nomorMeteran'] || '').trim();
          const angkaAwal = Number(row['Angka Awal'] || row['angkaAwal'] || 0);
          const stRaw = String(row['Status Rumah'] || row['statusRumah'] || 'terhuni').toLowerCase();
          const statusRumah: StatusRumah = ['terhuni', 'dibangun', 'renovasi', 'booking', 'kosong'].includes(stRaw) 
            ? (stRaw as StatusRumah) : 'terhuni';

          await setDoc(doc(db, 'customers', cleanId), {
            id: cleanId,
            cluster,
            blok,
            needsReview: false,
            namaPemilik: nama,
            nomorMeteran: noMeter,
            angkaAwal,
            statusRumah,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          count++;
        }

        setFeedbackNotice({ type: 'success', message: `Berhasil mengimpor ${count} data pelanggan.` });
        loadAllData();
      } catch (err: any) {
        alert(`Gagal memproses file Excel: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (onlyReview && !c.needsReview) return false;
      if (!custSearch.trim()) return true;
      const q = custSearch.toLowerCase();
      return c.blok.toLowerCase().includes(q) || c.namaPemilik.toLowerCase().includes(q) || (c.cluster || '').toLowerCase().includes(q);
    });
  }, [customers, custSearch, onlyReview]);
  const reviewCount = useMemo(() => customers.filter((c) => c.needsReview).length, [customers]);

  // -------------------------------------------------------------
  // TAB 2: DATA PENCATATAN (TABEL, FILTER, EDIT ANGKA, TANDAI VALID)
  // -------------------------------------------------------------
  const [filterBlok, setFilterBlok] = useState('');
  const [filterWorker, setFilterWorker] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<{ url: string; blok: string; nama: string } | null>(null);
  
  // Edit Angka Modal State
  const [editingReading, setEditingReading] = useState<ReadingRecord | null>(null);
  const [editAngkaInput, setEditAngkaInput] = useState<string>('');

  const filteredReadings = useMemo(() => {
    return readings.filter((r) => {
      if (filterBlok && !r.blok.toLowerCase().includes(filterBlok.toLowerCase())) return false;
      if (filterWorker !== 'Semua' && r.dicatatOleh !== filterWorker) return false;
      if (filterStatus !== 'Semua' && r.status !== filterStatus) return false;
      return true;
    });
  }, [readings, filterBlok, filterWorker, filterStatus]);

  // Ubah Status Catatan ke 'Valid'
  const handleTandaiValid = async (r: ReadingRecord) => {
    try {
      await updateDoc(doc(db, 'readings', r.id), {
        status: 'valid',
        catatanAnomali: null,
        updatedAt: serverTimestamp(),
      });
      setFeedbackNotice({ type: 'success', message: `Catatan ${r.blok} ditandai VALID.` });
      loadAllData();
    } catch (err: any) {
      alert(`Gagal memvalidasi: ${err.message}`);
    }
  };

  // Simpan Edit Angka Manual Admin
  const handleSaveEditAngka = async () => {
    if (!editingReading) return;
    const num = Number(editAngkaInput);
    if (isNaN(num) || num < 0) {
      alert('Masukkan angka meter yang valid.');
      return;
    }

    try {
      const pemakaianM3 = Math.max(0, num - editingReading.angkaSebelumnya);
      
      // Hitung ulang tarif
      let totalBiaya = 0;
      if (tariffs.length > 0) {
        for (const t of tariffs) {
          if (pemakaianM3 > t.minM3) {
            const tierVol = Math.min(pemakaianM3, t.maxM3) - t.minM3;
            totalBiaya += tierVol * t.hargaPerM3;
          }
        }
      } else {
        totalBiaya = pemakaianM3 * 2700;
      }

      await updateDoc(doc(db, 'readings', editingReading.id), {
        angkaSekarang: num,
        pemakaianM3,
        totalBiaya: Math.round(totalBiaya),
        status: 'valid',
        catatanAnomali: `Diedit manual oleh Admin (${profile?.nama})`,
        updatedAt: serverTimestamp(),
      });

      setFeedbackNotice({ type: 'success', message: `Catatan ${editingReading.blok} berhasil diperbarui.` });
      setEditingReading(null);
      loadAllData();
    } catch (err: any) {
      alert(`Gagal memperbarui catatan: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // EXPORT LAPORAN PER PERIODE (EXCEL & CSV)
  // -------------------------------------------------------------
  const handleExportLaporan = (format: 'xlsx' | 'csv') => {
    if (readings.length === 0) {
      alert('Belum ada data pencatatan pada periode ini.');
      return;
    }

    const exportRows = filteredReadings.map((r, i) => {
      const cust = customers.find((c) => c.id === r.customerId || c.blok === r.blok);
      return {
        'No': i + 1,
        'Periode': r.periode,
        'Cluster': cust?.cluster || '-',
        'Blok': r.blok,
        'Nama Pemilik': r.namaPemilik,
        'No. Meteran': r.nomorMeteran || '-',
        'Angka Awal': r.angkaSebelumnya,
        'Angka Akhir': r.angkaSekarang,
        'Pemakaian (m³)': r.pemakaianM3,
        'Total Tagihan (Rp)': r.totalBiaya,
        'Status': r.status === 'valid' ? 'Valid' : r.status === 'perlu_cek' ? 'Perlu Cek' : 'Normal',
        'Catatan Anomali': r.catatanAnomali || '-',
        'Petugas': r.dicatatOleh,
        'Tanggal Catat': r.createdAt ? new Date(r.createdAt.toDate ? r.createdAt.toDate() : r.createdAt).toLocaleString('id-ID') : '-',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, `Laporan_${selectedPeriode}`);

    const fileName = `Laporan_Meteran_PDAM_Wimala_${selectedPeriode}.${format}`;
    if (format === 'csv') {
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
    }
  };

  // -------------------------------------------------------------
  // TAB 3: PENGATURAN TARIF BERTINGKAT (EDITABLE DARI UI)
  // -------------------------------------------------------------
  const [editableTariffs, setEditableTariffs] = useState<Tariff[]>([]);
  const [simulasiM3, setSimulasiM3] = useState<number>(18);

  useEffect(() => {
    setEditableTariffs([...tariffs]);
  }, [tariffs]);

  const handleUpdateTariffRow = (index: number, field: keyof Tariff, val: any) => {
    const updated = [...editableTariffs];
    updated[index] = { ...updated[index], [field]: val };
    setEditableTariffs(updated);
  };

  const handleSaveAllTariffs = async () => {
    try {
      for (const t of editableTariffs) {
        await setDoc(doc(db, 'tariffs', t.id), {
          minM3: Number(t.minM3) || 0,
          maxM3: Number(t.maxM3) || 0,
          hargaPerM3: Number(t.hargaPerM3) || 0,
          deskripsi: t.deskripsi || '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setFeedbackNotice({ type: 'success', message: 'Tingkatan tarif air berhasil disimpan ke database.' });
      loadAllData();
    } catch (err: any) {
      alert(`Gagal menyimpan tarif: ${err.message}`);
    }
  };

  // Hitung simulasi tarif
  const simulasiBiaya = useMemo(() => {
    let total = 0;
    for (const t of editableTariffs) {
      if (simulasiM3 > t.minM3) {
        const vol = Math.min(simulasiM3, t.maxM3) - t.minM3;
        total += vol * t.hargaPerM3;
      }
    }
    return total;
  }, [editableTariffs, simulasiM3]);

  // -------------------------------------------------------------
  // TAB 4: CETAK STIKER QR (A4 GRID PRINT-READY)
  // -------------------------------------------------------------
  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);

  // Toggle select all
  const isAllSelected = customers.length > 0 && selectedForPrint.length === customers.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedForPrint([]);
    } else {
      setSelectedForPrint(customers.map((c) => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    if (selectedForPrint.includes(id)) {
      setSelectedForPrint(selectedForPrint.filter((x) => x !== id));
    } else {
      setSelectedForPrint([...selectedForPrint, id]);
    }
  };

  const printStickersList = useMemo(() => {
    if (selectedForPrint.length === 0) return customers;
    return customers.filter((c) => selectedForPrint.includes(c.id));
  }, [customers, selectedForPrint]);

  // -------------------------------------------------------------
  // TAB 5: KELOLA 2 AKUN WORKER
  // -------------------------------------------------------------
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPassword, setWorkerPassword] = useState('');
  const [showWorkerPassword, setShowWorkerPassword] = useState(false);
  const [workerNama, setWorkerNama] = useState('');
  const [creatingWorker, setCreatingWorker] = useState(false);

  // Reset password worker state
  const [resetWorkerTarget, setResetWorkerTarget] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workers.length >= 2) {
      alert('Maksimal hanya 2 akun worker yang diizinkan sesuai aturan sistem. Hapus salah satu worker terlebih dahulu jika ingin mengganti.');
      return;
    }
    if (workerPassword.length < 6) {
      alert('Kata sandi minimal 6 karakter.');
      return;
    }
    setCreatingWorker(true);
    try {
      // 1. Buat user di Firebase Auth menggunakan secondary app agar sesi login admin tidak logout
      const secondaryApp = getApps().find((a) => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, workerEmail.trim(), workerPassword);
      await signOut(secondaryAuth);

      // 2. Simpan data worker di Firestore users/{uid}
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: workerEmail.trim(),
        nama: workerNama.trim(),
        role: 'worker',
        aktif: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setFeedbackNotice({ type: 'success', message: `Akun worker ${workerNama} berhasil dibuat.` });
      setWorkerEmail('');
      setWorkerPassword('');
      setWorkerNama('');
      loadAllData();
    } catch (err: any) {
      console.error('Error saat membuat akun worker:', err);
      alert(`Gagal membuat akun worker: ${err.message}`);
    } finally {
      setCreatingWorker(false);
    }
  };

  const handleDeleteWorker = async (w: UserProfile) => {
    if (confirm(`Yakin ingin menghapus akun worker ${w.nama} (${w.email})? Setelah dihapus, slot worker kosong dan Anda bisa menambahkan worker baru.`)) {
      try {
        await deleteDoc(doc(db, 'users', w.uid));
        setFeedbackNotice({ type: 'success', message: `Akun worker ${w.nama} berhasil dihapus.` });
        loadAllData();
      } catch (err: any) {
        alert(`Gagal menghapus akun worker: ${err.message}`);
      }
    }
  };

  // Edit nama worker state
  const [editingWorker, setEditingWorker] = useState<UserProfile | null>(null);
  const [workerNamaEdit, setWorkerNamaEdit] = useState('');

  const handleOpenEditWorker = (w: UserProfile) => {
    setEditingWorker(w);
    setWorkerNamaEdit(w.nama);
  };

  const handleSaveEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker || !workerNamaEdit.trim()) {
      alert('Nama petugas tidak boleh kosong.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', editingWorker.uid), {
        nama: workerNamaEdit.trim(),
        updatedAt: serverTimestamp(),
      });
      setFeedbackNotice({
        type: 'success',
        message: `Nama petugas berhasil diperbarui menjadi "${workerNamaEdit.trim()}".`,
      });
      setEditingWorker(null);
      loadAllData();
    } catch (err: any) {
      alert(`Gagal mengubah nama petugas: ${err.message}`);
    }
  };

  const handleToggleWorkerStatus = async (w: UserProfile) => {
    try {
      const nextAktif = !w.aktif;
      await updateDoc(doc(db, 'users', w.uid), {
        aktif: nextAktif,
        updatedAt: serverTimestamp(),
      });
      setFeedbackNotice({
        type: 'success',
        message: `Status akun ${w.nama} berhasil diubah menjadi ${nextAktif ? 'Aktif' : 'Nonaktif'}.`,
      });
      loadAllData();
    } catch (err: any) {
      alert(`Gagal mengubah status: ${err.message}`);
    }
  };

  const handleResetPassword = async () => {
    if (!resetWorkerTarget) return;
    try {
      await callResetPasswordWorker({
        workerId: resetWorkerTarget.uid,
        passwordBaru: newPasswordInput,
      });
      setFeedbackNotice({ type: 'success', message: `Kata sandi ${resetWorkerTarget.nama} berhasil direset.` });
      setResetWorkerTarget(null);
      setNewPasswordInput('');
    } catch (_cfErr: any) {
      try {
        await sendPasswordResetEmail(auth, resetWorkerTarget.email);
        alert(`Link tautan reset kata sandi telah dikirim ke email ${resetWorkerTarget.email}.`);
        setResetWorkerTarget(null);
        setNewPasswordInput('');
      } catch (emailErr: any) {
        alert(`Gagal reset password: ${emailErr.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Top Header - Alat Kerja Fungsional */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
            PDAM
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none text-white">
              Rekap Meteran Air PDAM • Wimala Land
            </h1>
            <span className="text-[11px] text-teal-400 font-mono mt-0.5 block">
              Panel Pengelola ({profile?.nama})
            </span>
          </div>
        </div>

        {/* Global Period Selector & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2.5 py-1">
            <span className="text-xs text-slate-400">Periode:</span>
            <input
              type="month"
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
              className="bg-transparent text-xs font-bold text-white border-none focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={loadAllData}
            title="Muat Ulang Data"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-teal-400' : ''}`} />
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation Menu */}
      <div className="no-print bg-white border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('pencatatan')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'pencatatan'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Pencatatan ({readings.length})</span>
          {readings.filter((r) => r.status === 'perlu_cek').length > 0 && (
            <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.2 rounded-full border border-rose-300 font-bold">
              {readings.filter((r) => r.status === 'perlu_cek').length} Perlu Cek
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pelanggan')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'pelanggan'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Data Pelanggan ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tarif')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'tarif'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Tarif Air ({tariffs.length} Tier)</span>
        </button>

        <button
          onClick={() => setActiveTab('cetak_qr')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'cetak_qr'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Stiker</span>
        </button>

        <button
          onClick={() => setActiveTab('worker')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'worker'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Kelola Worker ({workers.length}/2)</span>
        </button>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-4">
        {/* Feedback Alert Banner */}
        {feedbackNotice && (
          <div
            className={`no-print p-3 rounded text-xs font-bold flex items-center gap-2 border ${
              feedbackNotice.type === 'success'
                ? 'bg-teal-50 border-teal-300 text-teal-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {feedbackNotice.type === 'success' ? (
              <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackNotice.message}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 1: DATA PELANGGAN */}
        {/* ============================================================ */}
        {activeTab === 'pelanggan' && (
          <div className="bg-white border border-slate-300 rounded shadow-xs p-4 space-y-4">
            {/* Header Pelanggan & Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Cari Blok atau Nama..."
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  Total: <strong>{filteredCustomers.length}</strong> unit
                </span>
              </div>

              {/* Action Buttons: Add Customer, Import, Download Template */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  title="Unduh Template Excel"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Import Data Pelanggan dari Excel"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Excel</span>
                </button>

                <button
                  onClick={() => setOnlyReview(!onlyReview)}
                  title="Unit yang ditambahkan otomatis oleh petugas"
                  className={`px-3 py-1.5 border rounded text-xs font-bold flex items-center gap-1 ${
                    onlyReview ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Perlu Disesuaikan ({reviewCount})</span>
                </button>

                <button
                  onClick={handleOpenAddCustomer}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Unit</span>
                </button>
              </div>
            </div>

            {/* Tabel Pelanggan Rapat Informasi */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-2.5">No</th>
                    <th className="p-2.5">Cluster</th>
                    <th className="p-2.5">Blok</th>
                    <th className="p-2.5">Nama Pemilik</th>
                    <th className="p-2.5">No. Meteran</th>
                    <th className="p-2.5 text-right">Angka Awal</th>
                    <th className="p-2.5">Status Rumah</th>
                    <th className="p-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Tidak ada data pelanggan yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 text-slate-600">{c.cluster || '-'}</td>
                        <td className="p-2.5 font-bold font-mono text-teal-800">{c.blok}</td>
                        <td className="p-2.5 font-semibold text-slate-900">
                          {c.namaPemilik}
                          {c.needsReview && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-300 uppercase">
                              Dari petugas, cek data
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">{c.nomorMeteran || '-'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                          {c.angkaAwal || 0} m³
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              c.statusRumah === 'renovasi'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : c.statusRumah === 'dibangun'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : c.statusRumah === 'booking'
                                ? 'bg-purple-50 text-purple-800 border-purple-300'
                                : c.statusRumah === 'kosong'
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-teal-50 text-teal-800 border-teal-300'
                            }`}
                          >
                            {c.statusRumah || 'Terhuni'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center space-x-1">
                          {c.needsReview && (
                            <button
                              onClick={() => handleTandaiSesuai(c)}
                              title="Tandai sudah sesuai"
                              className="p-1 hover:bg-emerald-100 rounded text-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditCustomer(c)}
                            title="Edit Data"
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            title="Hapus Unit"
                            className="p-1 hover:bg-rose-100 rounded text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: DATA PENCATATAN METER (TABEL, FILTER, VERIFIKASI) */}
        {/* ============================================================ */}
        {activeTab === 'pencatatan' && (
          <div className="bg-white border border-slate-300 rounded shadow-xs p-4 space-y-4">
            {/* Filter Bar Rapat */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Filter Blok */}
                <input
                  type="text"
                  placeholder="Filter Blok..."
                  value={filterBlok}
                  onChange={(e) => setFilterBlok(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded w-28 focus:outline-none focus:border-teal-700"
                />

                {/* Filter Worker */}
                <select
                  value={filterWorker}
                  onChange={(e) => setFilterWorker(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="Semua">Semua Petugas</option>
                  {workers.map((w) => (
                    <option key={w.uid} value={w.nama}>
                      {w.nama}
                    </option>
                  ))}
                </select>

                {/* Filter Status */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-teal-700 font-bold"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="perlu_cek" className="text-rose-600 font-bold">
                    ⚠️ Perlu Cek
                  </option>
                  <option value="normal">Normal</option>
                  <option value="valid" className="text-teal-700 font-bold">
                    ✓ Valid
                  </option>
                </select>

                <span className="text-xs text-slate-500 ml-2">
                  Tercatat: <strong>{filteredReadings.length}</strong> / {customers.length} unit
                </span>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportLaporan('csv')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExportLaporan('xlsx')}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Tabel Pencatatan */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-2.5">No</th>
                    <th className="p-2.5">Blok</th>
                    <th className="p-2.5">Nama Pemilik</th>
                    <th className="p-2.5 text-right">Bulan Lalu</th>
                    <th className="p-2.5 text-right">Bulan Ini</th>
                    <th className="p-2.5 text-right">Pemakaian</th>
                    <th className="p-2.5 text-right">Tagihan</th>
                    <th className="p-2.5 text-center">Foto Bukti</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Petugas</th>
                    <th className="p-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredReadings.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        Belum ada catatan meteran pada periode {selectedPeriode} dengan filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredReadings.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50 ${
                          r.status === 'perlu_cek' ? 'bg-rose-50/60' : ''
                        }`}
                      >
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold font-mono text-teal-800">{r.blok}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{r.namaPemilik}</td>
                        <td className="p-2.5 text-right font-mono text-slate-500">{r.angkaSebelumnya} m³</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{r.angkaSekarang} m³</td>
                        <td className="p-2.5 text-right font-mono font-bold text-teal-700">
                          +{r.pemakaianM3} m³
                        </td>
                        <td className="p-2.5 text-right font-mono font-extrabold text-slate-900">
                          Rp {(r.totalBiaya ?? 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-center">
                          {r.fotoUrl ? (
                            <button
                              onClick={() =>
                                setPreviewPhotoUrl({
                                  url: r.fotoUrl,
                                  blok: r.blok,
                                  nama: r.namaPemilik,
                                })
                              }
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {r.status === 'perlu_cek' ? (
                            <div className="space-y-0.5">
                              <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Perlu Cek
                              </span>
                              {r.catatanAnomali && (
                                <p className="text-[10px] text-rose-700 leading-tight max-w-[180px]">
                                  {r.catatanAnomali}
                                </p>
                              )}
                            </div>
                          ) : r.status === 'valid' ? (
                            <span className="bg-teal-100 text-teal-800 border border-teal-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              ✓ Valid
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-1.5 py-0.5 rounded">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600">{r.dicatatOleh}</td>
                        <td className="p-2.5 text-center space-x-1 whitespace-nowrap">
                          {/* Edit Angka */}
                          <button
                            onClick={() => {
                              setEditingReading(r);
                              setEditAngkaInput(r.angkaSekarang.toString());
                            }}
                            title="Koreksi Angka"
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Cepat Tandai Valid */}
                          {r.status === 'perlu_cek' && (
                            <button
                              onClick={() => handleTandaiValid(r)}
                              title="Tandai Valid"
                              className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-[10px] font-bold"
                            >
                              Tandai Valid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: PENGATURAN TARIF AIR (EDITABLE UI + SIMULATOR) */}
        {/* ============================================================ */}
        {activeTab === 'tarif' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tabel Tier Tarif */}
            <div className="lg:col-span-2 bg-white border border-slate-300 rounded shadow-xs p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Skema Tingkatan Tarif Air PDAM</h2>
                  <p className="text-xs text-slate-500">
                    Nilai tarif di bawah ini digunakan oleh Cloud Function untuk kalkulasi tagihan.
                  </p>
                </div>
                <button
                  onClick={handleSaveAllTariffs}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan Tarif</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">Tier ID</th>
                      <th className="p-2.5">Min (m³)</th>
                      <th className="p-2.5">Maks (m³)</th>
                      <th className="p-2.5">Harga per m³ (Rp)</th>
                      <th className="p-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {editableTariffs.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-600">{t.id}</td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={t.minM3}
                            onChange={(e) => handleUpdateTariffRow(idx, 'minM3', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono font-bold"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={t.maxM3}
                            onChange={(e) => handleUpdateTariffRow(idx, 'maxM3', Number(e.target.value))}
                            className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-mono font-bold"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="100"
                            value={t.hargaPerM3}
                            onChange={(e) => handleUpdateTariffRow(idx, 'hargaPerM3', Number(e.target.value))}
                            className="w-28 px-2 py-1 text-xs border border-slate-300 rounded font-mono font-bold text-teal-800"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={t.deskripsi || ''}
                            onChange={(e) => handleUpdateTariffRow(idx, 'deskripsi', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Simulator Kalkulasi */}
            <div className="bg-white border border-slate-300 rounded shadow-xs p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                Simulator Kalkulasi Pemakaian
              </h3>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Masukkan Volume Air (m³):
                </label>
                <input
                  type="number"
                  min="0"
                  value={simulasiM3}
                  onChange={(e) => setSimulasiM3(Number(e.target.value) || 0)}
                  className="w-full font-mono text-xl font-bold px-3 py-2 border border-slate-300 rounded bg-slate-50 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Rincian Perhitungan */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">
                  Rincian Per Tier:
                </span>
                {editableTariffs.map((t) => {
                  if (simulasiM3 <= t.minM3) return null;
                  const vol = Math.min(simulasiM3, t.maxM3) - t.minM3;
                  const cost = vol * t.hargaPerM3;
                  return (
                    <div key={t.id} className="flex justify-between text-slate-700">
                      <span>{t.deskripsi || `Tier (${t.minM3}-${t.maxM3})`}:</span>
                      <span className="font-mono font-bold">
                        {vol} m³ × {t.hargaPerM3.toLocaleString('id-ID')} = Rp {cost.toLocaleString('id-ID')}
                      </span>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Total Tagihan:</span>
                  <span className="text-teal-800 font-mono">Rp {simulasiBiaya.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: CETAK STIKER TEKS (A4 PRINT GRID) */}
        {/* ============================================================ */}
        {activeTab === 'cetak_qr' && (
          <div className="space-y-4">
            {/* Toolbar Cetak */}
            <div className="no-print bg-white border border-slate-300 rounded p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700"
                >
                  {isAllSelected ? 'Batal Pilih Semua' : `Pilih Semua (${customers.length})`}
                </button>
                <span className="text-xs text-slate-600">
                  Terpilih: <strong>{printStickersList.length}</strong> stiker siap cetak
                </span>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar Stiker (Print A4)</span>
              </button>
            </div>

            {/* Sheet Container Stiker (Siap Print A4 3 Kolom) */}
            <div className="bg-white border border-slate-300 p-6 rounded print:border-none print:p-0 print:m-0 print:shadow-none">
              <div className="hidden print:block border-b-2 border-slate-900 pb-2 mb-4">
                <h1 className="text-base font-black uppercase">
                  WIMALA LAND • LEMBAR STIKER TEKS BOX METERAN AIR PDAM
                </h1>
                <p className="text-[10px] text-slate-600">
                  Total {printStickersList.length} Unit • Dicetak pada: {new Date().toLocaleDateString('id-ID')}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
                {printStickersList.map((c) => {
                  // Sesuai aturan: QR HANYA berisi ID pelanggan saja
                  const qrPayload = c.id;
                  const isChecked = selectedForPrint.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelectCustomer(c.id)}
                      className={`relative border-2 rounded-lg p-3 flex flex-col items-start justify-between cursor-pointer transition-all print:border-slate-800 print:rounded print:p-2 print:break-inside-avoid ${
                        isChecked
                          ? 'border-teal-600 bg-teal-50/20'
                          : 'border-slate-200 hover:border-slate-400 bg-white'
                      }`}
                    >
                      {/* Checkbox di pojok (hidden saat print) */}
                      <div className="no-print absolute top-2 right-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 text-teal-600 rounded"
                        />
                      </div>

                      {/* Stiker teks (tanpa barcode): Cluster / Blok / Pengguna */}
                      <div className="w-full text-sm leading-snug text-slate-900 py-2 space-y-0.5">
                        <div><span className="font-semibold">Cluster</span>: <span className="font-bold">{c.cluster || '-'}</span></div>
                        <div><span className="font-semibold">Blok</span>: <span className="font-mono font-black text-lg">{c.blok}</span></div>
                        <div><span className="font-semibold">Pengguna</span>: <span className="font-bold">{c.namaPemilik}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: KELOLA 2 AKUN WORKER */}
        {/* ============================================================ */}
        {activeTab === 'worker' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daftar Akun Worker */}
            <div className="lg:col-span-2 bg-white border border-slate-300 rounded shadow-xs p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Daftar Akun Petugas Lapangan (Worker)</h2>
                  <p className="text-xs text-slate-500">Maksimal 2 worker sesuai ketentuan arsitektur sistem.</p>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 border px-2 py-0.5 rounded">
                  {workers.length} / 2 Terdaftar
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">Nama Petugas</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {workers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">
                          Belum ada akun worker yang dibuat. Silakan tambahkan lewat form di sebelah kanan.
                        </td>
                      </tr>
                    ) : (
                      workers.map((w) => (
                        <tr key={w.uid} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{w.nama}</span>
                              <button
                                onClick={() => handleOpenEditWorker(w)}
                                title="Edit Nama Petugas"
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-teal-700 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">{w.email}</td>
                          <td className="p-2.5">
                            {w.aktif ? (
                              <span className="bg-teal-100 text-teal-800 border border-teal-300 text-[10px] font-bold px-2 py-0.5 rounded">
                                Aktif
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded">
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center space-x-2">
                            {/* Toggle Aktif/Nonaktifkan */}
                            <button
                              onClick={() => handleToggleWorkerStatus(w)}
                              className={`px-2 py-1 text-[11px] font-bold rounded border ${
                                w.aktif
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                  : 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'
                              }`}
                            >
                              {w.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResetWorkerTarget(w);
                                setNewPasswordInput('');
                              }}
                              className="px-2 py-1 text-[11px] font-bold rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 cursor-pointer"
                            >
                              Reset Sandi
                            </button>

                            {/* Hapus Worker */}
                            <button
                              onClick={() => handleDeleteWorker(w)}
                              title="Hapus Akun Worker"
                              className="px-2 py-1 text-[11px] font-bold rounded bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 cursor-pointer"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Tambah Worker */}
            <div className="bg-white border border-slate-300 rounded shadow-xs p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-teal-700" />
                Tambah Akun Worker Baru
              </h3>

              {workers.length >= 2 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
                  Batas kuota 2 worker telah terpenuhi. Nonaktifkan atau hapus worker jika ingin mengganti petugas.
                </div>
              ) : (
                <form onSubmit={handleCreateWorker} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nama Lengkap Petugas:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={workerNama}
                      onChange={(e) => setWorkerNama(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Email Login:
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="petugas1@wimalaland.id"
                      value={workerEmail}
                      onChange={(e) => setWorkerEmail(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Kata Sandi Awal:
                    </label>
                    <div className="relative">
                      <input
                        type={showWorkerPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Minimal 6 karakter"
                        value={workerPassword}
                        onChange={(e) => setWorkerPassword(e.target.value)}
                        className="w-full text-xs pl-3 pr-10 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWorkerPassword(!showWorkerPassword)}
                        className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                        title={showWorkerPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                        tabIndex={-1}
                      >
                        {showWorkerPassword ? (
                          <EyeOff className="w-4 h-4 text-slate-600" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingWorker}
                    className="w-full py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded text-xs font-bold transition-colors"
                  >
                    {creatingWorker ? 'Membuat Akun...' : 'Buat Akun Worker'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODAL: PREVIEW FOTO BUKTI METERAN */}
      {/* ============================================================ */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-lg w-full overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
              <div>
                <strong className="text-sm font-bold">Bukti Foto Meteran {previewPhotoUrl.blok}</strong>
                <p className="text-[11px] text-slate-400">{previewPhotoUrl.nama}</p>
              </div>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center p-2 min-h-[300px] max-h-[60vh]">
              <img
                src={previewPhotoUrl.url}
                alt="Foto Meteran"
                className="max-h-[55vh] object-contain"
              />
            </div>
            <div className="p-3 bg-slate-50 border-t flex justify-end">
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-700 rounded"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TAMBAH / EDIT PELANGGAN */}
      {/* ============================================================ */}
      {isCustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
              <strong className="text-sm font-bold">
                {editingCustomer ? `Edit Unit Kavling ${editingCustomer.blok}` : 'Tambah Unit Kavling Baru'}
              </strong>
              <button
                onClick={() => setIsCustModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cluster:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kamala"
                  value={custForm.cluster}
                  onChange={(e) => setCustForm({ ...custForm, cluster: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Blok & No Kavling:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: D-01"
                    value={custForm.blok}
                    onChange={(e) => setCustForm({ ...custForm, blok: e.target.value })}
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    No. Seri Meteran:
                  </label>
                  <input
                    type="text"
                    placeholder="WM-001"
                    value={custForm.nomorMeteran}
                    onChange={(e) => setCustForm({ ...custForm, nomorMeteran: e.target.value })}
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Pemilik / Penghuni:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap penghuni"
                  value={custForm.namaPemilik}
                  onChange={(e) => setCustForm({ ...custForm, namaPemilik: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Angka Meter Awal (m³):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={custForm.angkaAwal}
                    onChange={(e) => setCustForm({ ...custForm, angkaAwal: Number(e.target.value) || 0 })}
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Status Rumah:
                  </label>
                  <select
                    value={custForm.statusRumah}
                    onChange={(e) => setCustForm({ ...custForm, statusRumah: e.target.value as StatusRumah })}
                    className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:border-teal-700 font-bold"
                  >
                    <option value="terhuni">Terhuni</option>
                    <option value="dibangun">Sedang Dibangun</option>
                    <option value="renovasi">Sedang Renovasi</option>
                    <option value="booking">Booking</option>
                    <option value="kosong">Rumah Kosong</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCustModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded"
                >
                  Simpan Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: KOREKSI ANGKA PENCATATAN ADMIN */}
      {/* ============================================================ */}
      {editingReading && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
              <strong className="text-sm font-bold">Koreksi Angka {editingReading.blok}</strong>
              <button
                onClick={() => setEditingReading(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-600 space-y-1">
                <p>Penghuni: <strong>{editingReading.namaPemilik}</strong></p>
                <p>Stand Bulan Lalu: <strong>{editingReading.angkaSebelumnya} m³</strong></p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Koreksi Stand Akhir Bulan Ini (m³):
                </label>
                <input
                  type="number"
                  min="0"
                  value={editAngkaInput}
                  onChange={(e) => setEditAngkaInput(e.target.value)}
                  className="w-full font-mono text-xl font-bold px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingReading(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditAngka}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT NAMA WORKER */}
      {/* ============================================================ */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
              <strong className="text-sm font-bold">Edit Nama Petugas</strong>
              <button
                onClick={() => setEditingWorker(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditWorker} className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Email: <strong className="font-mono">{editingWorker.email}</strong>
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nama Lengkap Petugas:
                </label>
                <input
                  type="text"
                  required
                  value={workerNamaEdit}
                  onChange={(e) => setWorkerNamaEdit(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded cursor-pointer"
                >
                  Simpan Nama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: RESET PASSWORD WORKER */}
      {/* ============================================================ */}
      {resetWorkerTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
              <strong className="text-sm font-bold">Reset Kata Sandi Worker</strong>
              <button
                onClick={() => setResetWorkerTarget(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Reset kata sandi untuk petugas: <strong>{resetWorkerTarget.nama}</strong> ({resetWorkerTarget.email})
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kata Sandi Baru (Min. 6 Karakter):
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setResetWorkerTarget(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded"
                >
                  Simpan Sandi Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
