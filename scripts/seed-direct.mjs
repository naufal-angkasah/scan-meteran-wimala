import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBfQfCuo7cqZXG7cWY1Xj_tjVrwBZjeMrI',
  authDomain: 'wimala-land.firebaseapp.com',
  projectId: 'wimala-land',
  storageBucket: 'wimala-land.firebasestorage.app',
  messagingSenderId: '36060666743',
  appId: '1:36060666743:web:d051d77b843b1a91aadf72',
  measurementId: 'G-V32P1W1RQ7',
};

console.log('🚀 Menghubungkan ke Firebase wimala-land...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 1. Data Tarif Bertingkat (Tariffs)
const tariffs = [
  { id: 'tier_1', minM3: 0,  maxM3: 10,  hargaPerM3: 2700, deskripsi: '0 - 10 m³' },
  { id: 'tier_2', minM3: 10, maxM3: 20,  hargaPerM3: 5400, deskripsi: '11 - 20 m³' },
  { id: 'tier_3', minM3: 20, maxM3: 30,  hargaPerM3: 10800, deskripsi: '21 - 30 m³ (atau acuan Rp 3.200)' },
  { id: 'tier_4', minM3: 30, maxM3: 9999,hargaPerM3: 21600, deskripsi: '> 30 m³' },
];

// 2. Data 65 Pelanggan Wimala Land
const customers = [
  // --- CLUSTER KAMALA (35 Unit) ---
  { blok: 'D-01', namaPemilik: 'Budi Santoso',      nomorMeteran: 'WM-001', angkaAwal: 142, statusRumah: 'terhuni' },
  { blok: 'D-02', namaPemilik: 'Siti Rahmawati',    nomorMeteran: 'WM-002', angkaAwal: 198, statusRumah: 'terhuni' },
  { blok: 'D-03', namaPemilik: 'Agus Prasetyo',     nomorMeteran: 'WM-003', angkaAwal: 85,  statusRumah: 'terhuni' },
  { blok: 'D-04', namaPemilik: 'Rini Anggraini',    nomorMeteran: 'WM-004', angkaAwal: 215, statusRumah: 'terhuni' },
  { blok: 'D-05', namaPemilik: 'Hendra Gunawan',    nomorMeteran: 'WM-005', angkaAwal: 164, statusRumah: 'renovasi' },
  { blok: 'D-06', namaPemilik: 'Dewi Lestari',      nomorMeteran: 'WM-006', angkaAwal: 110, statusRumah: 'terhuni' },
  { blok: 'D-07', namaPemilik: 'Fajar Nugraha',     nomorMeteran: 'WM-007', angkaAwal: 178, statusRumah: 'terhuni' },
  { blok: 'D-08', namaPemilik: 'Gita Savitri',      nomorMeteran: 'WM-008', angkaAwal: 95,  statusRumah: 'terhuni' },
  { blok: 'D-09', namaPemilik: 'Harry Reza',        nomorMeteran: 'WM-009', angkaAwal: 240, statusRumah: 'terhuni' },
  { blok: 'D-10', namaPemilik: 'Nurul Hidayah',     nomorMeteran: 'WM-010', angkaAwal: 133, statusRumah: 'terhuni' },
  { blok: 'D-11', namaPemilik: 'Eko Wahyudi',       nomorMeteran: 'WM-011', angkaAwal: 180, statusRumah: 'terhuni' },
  { blok: 'D-12', namaPemilik: 'Dian Permatasari',  nomorMeteran: 'WM-012', angkaAwal: 156, statusRumah: 'terhuni' },
  { blok: 'D-12B',namaPemilik: 'Rizky Pratama',     nomorMeteran: 'WM-013', angkaAwal: 12,  statusRumah: 'booking' },
  { blok: 'A-21', namaPemilik: 'Ahmad Fauzan',      nomorMeteran: 'WM-014', angkaAwal: 5,   statusRumah: 'booking' },
  { blok: 'A-22', namaPemilik: 'Ratna Kartika',     nomorMeteran: 'WM-015', angkaAwal: 204, statusRumah: 'terhuni' },
  { blok: 'A-25', namaPemilik: 'Tri Hartono',       nomorMeteran: 'WM-016', angkaAwal: 129, statusRumah: 'terhuni' },
  { blok: 'A-28', namaPemilik: 'Wulan Dari',        nomorMeteran: 'WM-017', angkaAwal: 173, statusRumah: 'terhuni' },
  { blok: 'A-32', namaPemilik: 'Yusuf Maulana',     nomorMeteran: 'WM-018', angkaAwal: 221, statusRumah: 'terhuni' },
  { blok: 'A-35', namaPemilik: 'Zainal Abidin',     nomorMeteran: 'WM-019', angkaAwal: 147, statusRumah: 'terhuni' },
  { blok: 'A-36', namaPemilik: 'Anisa Rahma',       nomorMeteran: 'WM-020', angkaAwal: 8,   statusRumah: 'booking' },
  { blok: 'A-40', namaPemilik: 'Bayu Saputra',      nomorMeteran: 'WM-021', angkaAwal: 190, statusRumah: 'terhuni' },
  { blok: 'A-45', namaPemilik: 'Cynthia Bella',     nomorMeteran: 'WM-022', angkaAwal: 105, statusRumah: 'terhuni' },
  { blok: 'A-50', namaPemilik: 'Danang Wijaya',     nomorMeteran: 'WM-023', angkaAwal: 15,  statusRumah: 'booking' },
  { blok: 'D-44', namaPemilik: 'Erwin Syahputra',   nomorMeteran: 'WM-024', angkaAwal: 6,   statusRumah: 'dibangun' },
  { blok: 'D-48', namaPemilik: 'Farida Utami',      nomorMeteran: 'WM-025', angkaAwal: 162, statusRumah: 'terhuni' },
  { blok: 'D-51', namaPemilik: 'Gilang Dirga',      nomorMeteran: 'WM-026', angkaAwal: 10,  statusRumah: 'booking' },
  { blok: 'D-30', namaPemilik: 'Hanny Puspita',     nomorMeteran: 'WM-027', angkaAwal: 234, statusRumah: 'terhuni' },
  { blok: 'D-38', namaPemilik: 'Indra Bekti',       nomorMeteran: 'WM-028', angkaAwal: 4,   statusRumah: 'booking' },
  { blok: 'C-01', namaPemilik: 'Joko Anwar',        nomorMeteran: 'WM-029', angkaAwal: 185, statusRumah: 'terhuni' },
  { blok: 'C-08', namaPemilik: 'Kartika Putri',     nomorMeteran: 'WM-030', angkaAwal: 9,   statusRumah: 'booking' },
  { blok: 'C-16', namaPemilik: 'Lukman Sardi',      nomorMeteran: 'WM-031', angkaAwal: 150, statusRumah: 'terhuni' },
  { blok: 'B-05', namaPemilik: 'Maudy Ayunda',      nomorMeteran: 'WM-032', angkaAwal: 194, statusRumah: 'terhuni' },
  { blok: 'B-15', namaPemilik: 'Nicholas Saputra',  nomorMeteran: 'WM-033', angkaAwal: 122, statusRumah: 'terhuni' },
  { blok: 'B-35', namaPemilik: 'Olla Ramlan',       nomorMeteran: 'WM-034', angkaAwal: 7,   statusRumah: 'booking' },
  { blok: 'B-46', namaPemilik: 'Prilly Latuconsina',nomorMeteran: 'WM-035', angkaAwal: 177, statusRumah: 'terhuni' },

  // --- CLUSTER LILY (15 Unit) ---
  { blok: 'C-02',  namaPemilik: 'Qory Amanda',        nomorMeteran: 'WM-036', angkaAwal: 168, statusRumah: 'terhuni' },
  { blok: 'C-09',  namaPemilik: 'Raditya Dika',       nomorMeteran: 'WM-037', angkaAwal: 11,  statusRumah: 'kosong' },
  { blok: 'C-15',  namaPemilik: 'Saskia Gotik',       nomorMeteran: 'WM-038', angkaAwal: 139, statusRumah: 'terhuni' },
  { blok: 'D-05L', namaPemilik: 'Taufik Hidayat',     nomorMeteran: 'WM-039', angkaAwal: 182, statusRumah: 'terhuni' },
  { blok: 'D-11L', namaPemilik: 'Umar Bakri',         nomorMeteran: 'WM-040', angkaAwal: 5,   statusRumah: 'booking' },
  { blok: 'D-13',  namaPemilik: 'Vino G. Bastian',    nomorMeteran: 'WM-041', angkaAwal: 211, statusRumah: 'terhuni' },
  { blok: 'D-20',  namaPemilik: 'Wulan Guritno',      nomorMeteran: 'WM-042', angkaAwal: 14,  statusRumah: 'kosong' },
  { blok: 'D-22',  namaPemilik: 'Xavier Danu',        nomorMeteran: 'WM-043', angkaAwal: 145, statusRumah: 'terhuni' },
  { blok: 'D-29',  namaPemilik: 'Yayan Ruhian',       nomorMeteran: 'WM-044', angkaAwal: 3,   statusRumah: 'dibangun' },
  { blok: 'B-03',  namaPemilik: 'Zaskia Adya Mecca',  nomorMeteran: 'WM-045', angkaAwal: 193, statusRumah: 'terhuni' },
  { blok: 'B-12A', namaPemilik: 'Arya Saloka',        nomorMeteran: 'WM-046', angkaAwal: 8,   statusRumah: 'booking' },
  { blok: 'B-25',  namaPemilik: 'Bunga Citra Lestari',nomorMeteran: 'WM-047', angkaAwal: 160, statusRumah: 'terhuni' },
  { blok: 'A-06',  namaPemilik: 'Chicco Jerikho',     nomorMeteran: 'WM-048', angkaAwal: 12,  statusRumah: 'booking' },
  { blok: 'A-18',  namaPemilik: 'Desta Mahendra',     nomorMeteran: 'WM-049', angkaAwal: 228, statusRumah: 'terhuni' },
  { blok: 'A-30',  namaPemilik: 'Enzy Storia',        nomorMeteran: 'WM-050', angkaAwal: 6,   statusRumah: 'booking' },

  // --- CLUSTER BOUGENVILE (15 Unit) ---
  { blok: 'E-01',  namaPemilik: 'Gading Marten',      nomorMeteran: 'WM-051', angkaAwal: 10,  statusRumah: 'kosong' },
  { blok: 'E-05',  namaPemilik: 'Hesti Purwadinata',   nomorMeteran: 'WM-052', angkaAwal: 175, statusRumah: 'terhuni' },
  { blok: 'E-10',  namaPemilik: 'Iqbaal Ramadhan',     nomorMeteran: 'WM-053', angkaAwal: 7,   statusRumah: 'booking' },
  { blok: 'E-16',  namaPemilik: 'Jefri Nichol',        nomorMeteran: 'WM-054', angkaAwal: 148, statusRumah: 'terhuni' },
  { blok: 'B-18',  namaPemilik: 'Kunto Aji',           nomorMeteran: 'WM-055', angkaAwal: 4,   statusRumah: 'dibangun' },
  { blok: 'B-24',  namaPemilik: 'Luna Maya',           nomorMeteran: 'WM-056', angkaAwal: 202, statusRumah: 'terhuni' },
  { blok: 'B-37',  namaPemilik: 'Marcel Chandrawinata',nomorMeteran: 'WM-057', angkaAwal: 167, statusRumah: 'terhuni' },
  { blok: 'B-42',  namaPemilik: 'Nadine Chandrawinata',nomorMeteran: 'WM-058', angkaAwal: 188, statusRumah: 'terhuni' },
  { blok: 'B-49',  namaPemilik: 'Onadio Leonardo',     nomorMeteran: 'WM-059', angkaAwal: 9,   statusRumah: 'booking' },
  { blok: 'A-10',  namaPemilik: 'Pevita Pearce',       nomorMeteran: 'WM-060', angkaAwal: 153, statusRumah: 'terhuni' },
  { blok: 'A-25B', namaPemilik: 'Raffi Ahmad',         nomorMeteran: 'WM-061', angkaAwal: 13,  statusRumah: 'booking' },
  { blok: 'A-45B', namaPemilik: 'Sule Sutisna',        nomorMeteran: 'WM-062', angkaAwal: 219, statusRumah: 'terhuni' },
  { blok: 'A-60',  namaPemilik: 'Tora Sudiro',         nomorMeteran: 'WM-063', angkaAwal: 5,   statusRumah: 'dibangun' },
  { blok: 'A-75',  namaPemilik: 'Uus Rizky',           nomorMeteran: 'WM-064', angkaAwal: 184, statusRumah: 'terhuni' },
  { blok: 'A-86',  namaPemilik: 'Vincent Rompies',     nomorMeteran: 'WM-065', angkaAwal: 8,   statusRumah: 'booking' },
];

async function run() {
  try {
    // 1. Seed Tariffs
    console.log(`Menyimpan ${tariffs.length} tingkatan tarif air...`);
    for (const t of tariffs) {
      await setDoc(doc(db, 'tariffs', t.id), {
        minM3: t.minM3,
        maxM3: t.maxM3,
        hargaPerM3: t.hargaPerM3,
        deskripsi: t.deskripsi,
      }, { merge: true });
    }
    console.log('✅ Tarif air tersimpan di Firestore.');

    // 2. Seed Customers
    console.log(`Menyimpan ${customers.length} data pelanggan (kavling)...`);
    for (const c of customers) {
      const customerId = c.blok.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'customers', customerId), {
        id: customerId,
        blok: c.blok,
        namaPemilik: c.namaPemilik,
        nomorMeteran: c.nomorMeteran,
        angkaAwal: c.angkaAwal,
        statusRumah: c.statusRumah,
      }, { merge: true });
    }
    console.log('✅ 65 pelanggan tersimpan di Firestore.');

    // 3. Buat / Login Akun Admin
    console.log('Membuat akun Admin pertama...');
    let adminUid = null;
    const adminEmail = 'admin@wimalaland.id';
    const adminPass = 'WimalaAdmin2026!';

    try {
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
      adminUid = cred.user.uid;
      await updateProfile(cred.user, { displayName: 'Super Admin Wimala' });
      console.log(`✅ Akun Admin berhasil dibuat baru (UID: ${adminUid})`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
        adminUid = cred.user.uid;
        console.log(`ℹ️ Akun Admin sudah ada, berhasil login (UID: ${adminUid})`);
      } else {
        throw e;
      }
    }

    if (adminUid) {
      await setDoc(doc(db, 'users', adminUid), {
        uid: adminUid,
        email: adminEmail,
        nama: 'Super Admin Wimala',
        role: 'admin',
        aktif: true,
      }, { merge: true });
      console.log('✅ Dokumen profil Admin tersimpan di users/{uid} dengan role: admin.');
    }

    // 4. Buat / Login Akun Worker 1
    console.log('Membuat akun Worker 1 (Petugas Lapangan)...');
    let workerUid = null;
    const workerEmail = 'petugas1@wimalaland.id';
    const workerPass = 'Petugas123!';

    try {
      const credW = await createUserWithEmailAndPassword(auth, workerEmail, workerPass);
      workerUid = credW.user.uid;
      await updateProfile(credW.user, { displayName: 'Ahmad Fauzi (Petugas 1)' });
      console.log(`✅ Akun Worker 1 berhasil dibuat (UID: ${workerUid})`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        const credW = await signInWithEmailAndPassword(auth, workerEmail, workerPass);
        workerUid = credW.user.uid;
        console.log(`ℹ️ Akun Worker 1 sudah ada, berhasil login (UID: ${workerUid})`);
      } else {
        throw e;
      }
    }

    if (workerUid) {
      await setDoc(doc(db, 'users', workerUid), {
        uid: workerUid,
        email: workerEmail,
        nama: 'Ahmad Fauzi (Petugas 1)',
        role: 'worker',
        aktif: true,
      }, { merge: true });
      console.log('✅ Dokumen profil Worker 1 tersimpan di users/{uid} dengan role: worker.');
    }

    // 5. Buat / Login Akun Worker 2
    console.log('Membuat akun Worker 2 (Petugas Lapangan)...');
    let worker2Uid = null;
    const worker2Email = 'petugas2@wimalaland.id';
    const worker2Pass = 'Petugas123!';

    try {
      const credW2 = await createUserWithEmailAndPassword(auth, worker2Email, worker2Pass);
      worker2Uid = credW2.user.uid;
      await updateProfile(credW2.user, { displayName: 'Bambang Sutrisno (Petugas 2)' });
      console.log(`✅ Akun Worker 2 berhasil dibuat (UID: ${worker2Uid})`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        const credW2 = await signInWithEmailAndPassword(auth, worker2Email, worker2Pass);
        worker2Uid = credW2.user.uid;
        console.log(`ℹ️ Akun Worker 2 sudah ada, berhasil login (UID: ${worker2Uid})`);
      } else {
        throw e;
      }
    }

    if (worker2Uid) {
      await setDoc(doc(db, 'users', worker2Uid), {
        uid: worker2Uid,
        email: worker2Email,
        nama: 'Bambang Sutrisno (Petugas 2)',
        role: 'worker',
        aktif: true,
      }, { merge: true });
      console.log('✅ Dokumen profil Worker 2 tersimpan di users/{uid} dengan role: worker.');
    }

    console.log('\n🎉 SEMUA DATA DATABASE & AKUN AUTH BERHASIL DI-SEED 100%!');
    console.log('\nKredensial Login:');
    console.log('1. ADMIN    : admin@wimalaland.id / WimalaAdmin2026!');
    console.log('2. WORKER 1 : petugas1@wimalaland.id / Petugas123!');
    console.log('3. WORKER 2 : petugas2@wimalaland.id / Petugas123!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal seeding:', error);
    process.exit(1);
  }
}

run();

