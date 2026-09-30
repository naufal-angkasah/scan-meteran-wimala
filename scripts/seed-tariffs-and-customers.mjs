/**
 * Script Seeder Data Pelanggan Wimala (65 Unit) dan Tarif Air Bertingkat
 * Jalankan: node scripts/seed-tariffs-and-customers.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = resolve(__dirname, '../serviceAccountKey.json');
if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || 'wimala-land',
  });
} else {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'wimala-land',
  });
}

const db = getFirestore();

// 1. Data Tarif Bertingkat (Tariffs)
const tariffs = [
  { id: 'tier_1', minM3: 0,  maxM3: 10,  hargaPerM3: 2700, deskripsi: '0 - 10 m³' },
  { id: 'tier_2', minM3: 10, maxM3: 20,  hargaPerM3: 5400, deskripsi: '10 - 20 m³' },
  { id: 'tier_3', minM3: 20, maxM3: 30,  hargaPerM3: 10800, deskripsi: '20 - 30 m³ (atau tarif acuan Rp 3.200)' },
  { id: 'tier_4', minM3: 30, maxM3: 9999,hargaPerM3: 21600, deskripsi: '> 30 m³' },
];

// 2. Data 65 Pelanggan Wimala Land
const customers = [
  // --- CLUSTER KAMALA (35 Unit) ---
  { blok: 'D-01', namaPemilik: 'Budi Santoso',      nomorMeteran: 'WM-001', angkaAwal: 142 },
  { blok: 'D-02', namaPemilik: 'Siti Rahmawati',    nomorMeteran: 'WM-002', angkaAwal: 198 },
  { blok: 'D-03', namaPemilik: 'Agus Prasetyo',     nomorMeteran: 'WM-003', angkaAwal: 85 },
  { blok: 'D-04', namaPemilik: 'Rini Anggraini',    nomorMeteran: 'WM-004', angkaAwal: 215 },
  { blok: 'D-05', namaPemilik: 'Hendra Gunawan',    nomorMeteran: 'WM-005', angkaAwal: 164 },
  { blok: 'D-06', namaPemilik: 'Dewi Lestari',      nomorMeteran: 'WM-006', angkaAwal: 110 },
  { blok: 'D-07', namaPemilik: 'Fajar Nugraha',     nomorMeteran: 'WM-007', angkaAwal: 178 },
  { blok: 'D-08', namaPemilik: 'Gita Savitri',      nomorMeteran: 'WM-008', angkaAwal: 95 },
  { blok: 'D-09', namaPemilik: 'Harry Reza',        nomorMeteran: 'WM-009', angkaAwal: 240 },
  { blok: 'D-10', namaPemilik: 'Nurul Hidayah',     nomorMeteran: 'WM-010', angkaAwal: 133 },
  { blok: 'D-11', namaPemilik: 'Eko Wahyudi',       nomorMeteran: 'WM-011', angkaAwal: 180 },
  { blok: 'D-12', namaPemilik: 'Dian Permatasari',  nomorMeteran: 'WM-012', angkaAwal: 156 },
  { blok: 'D-12B',namaPemilik: 'Rizky Pratama',     nomorMeteran: 'WM-013', angkaAwal: 12 },
  { blok: 'A-21', namaPemilik: 'Ahmad Fauzan',      nomorMeteran: 'WM-014', angkaAwal: 5 },
  { blok: 'A-22', namaPemilik: 'Ratna Kartika',     nomorMeteran: 'WM-015', angkaAwal: 204 },
  { blok: 'A-25', namaPemilik: 'Tri Hartono',       nomorMeteran: 'WM-016', angkaAwal: 129 },
  { blok: 'A-28', namaPemilik: 'Wulan Dari',        nomorMeteran: 'WM-017', angkaAwal: 173 },
  { blok: 'A-32', namaPemilik: 'Yusuf Maulana',     nomorMeteran: 'WM-018', angkaAwal: 221 },
  { blok: 'A-35', namaPemilik: 'Zainal Abidin',     nomorMeteran: 'WM-019', angkaAwal: 147 },
  { blok: 'A-36', namaPemilik: 'Anisa Rahma',       nomorMeteran: 'WM-020', angkaAwal: 8 },
  { blok: 'A-40', namaPemilik: 'Bayu Saputra',      nomorMeteran: 'WM-021', angkaAwal: 190 },
  { blok: 'A-45', namaPemilik: 'Cynthia Bella',     nomorMeteran: 'WM-022', angkaAwal: 105 },
  { blok: 'A-50', namaPemilik: 'Danang Wijaya',     nomorMeteran: 'WM-023', angkaAwal: 15 },
  { blok: 'D-44', namaPemilik: 'Erwin Syahputra',   nomorMeteran: 'WM-024', angkaAwal: 6 },
  { blok: 'D-48', namaPemilik: 'Farida Utami',      nomorMeteran: 'WM-025', angkaAwal: 162 },
  { blok: 'D-51', namaPemilik: 'Gilang Dirga',      nomorMeteran: 'WM-026', angkaAwal: 10 },
  { blok: 'D-30', namaPemilik: 'Hanny Puspita',     nomorMeteran: 'WM-027', angkaAwal: 234 },
  { blok: 'D-38', namaPemilik: 'Indra Bekti',       nomorMeteran: 'WM-028', angkaAwal: 4 },
  { blok: 'C-01', namaPemilik: 'Joko Anwar',        nomorMeteran: 'WM-029', angkaAwal: 185 },
  { blok: 'C-08', namaPemilik: 'Kartika Putri',     nomorMeteran: 'WM-030', angkaAwal: 9 },
  { blok: 'C-16', namaPemilik: 'Lukman Sardi',      nomorMeteran: 'WM-031', angkaAwal: 150 },
  { blok: 'B-05', namaPemilik: 'Maudy Ayunda',      nomorMeteran: 'WM-032', angkaAwal: 194 },
  { blok: 'B-15', namaPemilik: 'Nicholas Saputra',  nomorMeteran: 'WM-033', angkaAwal: 122 },
  { blok: 'B-35', namaPemilik: 'Olla Ramlan',       nomorMeteran: 'WM-034', angkaAwal: 7 },
  { blok: 'B-46', namaPemilik: 'Prilly Latuconsina',nomorMeteran: 'WM-035', angkaAwal: 177 },

  // --- CLUSTER LILY (15 Unit) ---
  { blok: 'C-02',  namaPemilik: 'Qory Amanda',        nomorMeteran: 'WM-036', angkaAwal: 168 },
  { blok: 'C-09',  namaPemilik: 'Raditya Dika',       nomorMeteran: 'WM-037', angkaAwal: 11 },
  { blok: 'C-15',  namaPemilik: 'Saskia Gotik',       nomorMeteran: 'WM-038', angkaAwal: 139 },
  { blok: 'D-05L', namaPemilik: 'Taufik Hidayat',     nomorMeteran: 'WM-039', angkaAwal: 182 },
  { blok: 'D-11L', namaPemilik: 'Umar Bakri',         nomorMeteran: 'WM-040', angkaAwal: 5 },
  { blok: 'D-13',  namaPemilik: 'Vino G. Bastian',    nomorMeteran: 'WM-041', angkaAwal: 211 },
  { blok: 'D-20',  namaPemilik: 'Wulan Guritno',      nomorMeteran: 'WM-042', angkaAwal: 14 },
  { blok: 'D-22',  namaPemilik: 'Xavier Danu',        nomorMeteran: 'WM-043', angkaAwal: 145 },
  { blok: 'D-29',  namaPemilik: 'Yayan Ruhian',       nomorMeteran: 'WM-044', angkaAwal: 3 },
  { blok: 'B-03',  namaPemilik: 'Zaskia Adya Mecca',  nomorMeteran: 'WM-045', angkaAwal: 193 },
  { blok: 'B-12A', namaPemilik: 'Arya Saloka',        nomorMeteran: 'WM-046', angkaAwal: 8 },
  { blok: 'B-25',  namaPemilik: 'Bunga Citra Lestari',nomorMeteran: 'WM-047', angkaAwal: 160 },
  { blok: 'A-06',  namaPemilik: 'Chicco Jerikho',     nomorMeteran: 'WM-048', angkaAwal: 12 },
  { blok: 'A-18',  namaPemilik: 'Desta Mahendra',     nomorMeteran: 'WM-049', angkaAwal: 228 },
  { blok: 'A-30',  namaPemilik: 'Enzy Storia',        nomorMeteran: 'WM-050', angkaAwal: 6 },

  // --- CLUSTER BOUGENVILE (15 Unit) ---
  { blok: 'E-01',  namaPemilik: 'Gading Marten',      nomorMeteran: 'WM-051', angkaAwal: 10 },
  { blok: 'E-05',  namaPemilik: 'Hesti Purwadinata',   nomorMeteran: 'WM-052', angkaAwal: 175 },
  { blok: 'E-10',  namaPemilik: 'Iqbaal Ramadhan',     nomorMeteran: 'WM-053', angkaAwal: 7 },
  { blok: 'E-16',  namaPemilik: 'Jefri Nichol',        nomorMeteran: 'WM-054', angkaAwal: 148 },
  { blok: 'B-18',  namaPemilik: 'Kunto Aji',           nomorMeteran: 'WM-055', angkaAwal: 4 },
  { blok: 'B-24',  namaPemilik: 'Luna Maya',           nomorMeteran: 'WM-056', angkaAwal: 202 },
  { blok: 'B-37',  namaPemilik: 'Marcel Chandrawinata',nomorMeteran: 'WM-057', angkaAwal: 167 },
  { blok: 'B-42',  namaPemilik: 'Nadine Chandrawinata',nomorMeteran: 'WM-058', angkaAwal: 188 },
  { blok: 'B-49',  namaPemilik: 'Onadio Leonardo',     nomorMeteran: 'WM-059', angkaAwal: 9 },
  { blok: 'A-10',  namaPemilik: 'Pevita Pearce',       nomorMeteran: 'WM-060', angkaAwal: 153 },
  { blok: 'A-25B', namaPemilik: 'Raffi Ahmad',         nomorMeteran: 'WM-061', angkaAwal: 13 },
  { blok: 'A-45B', namaPemilik: 'Sule Sutisna',        nomorMeteran: 'WM-062', angkaAwal: 219 },
  { blok: 'A-60',  namaPemilik: 'Tora Sudiro',         nomorMeteran: 'WM-063', angkaAwal: 5 },
  { blok: 'A-75',  namaPemilik: 'Uus Rizky',           nomorMeteran: 'WM-064', angkaAwal: 184 },
  { blok: 'A-86',  namaPemilik: 'Vincent Rompies',     nomorMeteran: 'WM-065', angkaAwal: 8 },
];

async function seed() {
  console.log(`\n--- MEMULAI SEEDING DATABASE WIMALA LAND ---`);

  // Seed Tariffs
  console.log(`Menyimpan ${tariffs.length} tingkatan tarif air...`);
  const batch1 = db.batch();
  for (const t of tariffs) {
    const ref = db.collection('tariffs').doc(t.id);
    batch1.set(ref, {
      minM3: t.minM3,
      maxM3: t.maxM3,
      hargaPerM3: t.hargaPerM3,
      deskripsi: t.deskripsi,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch1.commit();
  console.log(`✅ Tarif air berhasil disimpan.`);

  // Seed Customers
  console.log(`Menyimpan ${customers.length} data pelanggan (kavling)...`);
  const batch2 = db.batch();
  for (const c of customers) {
    // Generate clean ID from blok (e.g. 'D-01' -> 'D-01')
    const customerId = c.blok.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const ref = db.collection('customers').doc(customerId);
    batch2.set(ref, {
      id: customerId,
      namaPemilik: c.namaPemilik,
      blok: c.blok,
      nomorMeteran: c.nomorMeteran,
      angkaAwal: c.angkaAwal,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch2.commit();
  console.log(`✅ 65 data pelanggan berhasil disimpan.`);
  console.log(`\n🎉 SEEDING SELESAI!`);
}

seed().catch(console.error);
