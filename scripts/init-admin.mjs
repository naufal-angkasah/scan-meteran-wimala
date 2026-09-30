/**
 * Script sekali jalan untuk membuat akun Admin pertama
 * Menetapkan Custom Claim: { role: 'admin' }
 * Menulis profil ke Firestore: users/{uid}
 *
 * Jalankan:
 * node scripts/init-admin.mjs [email] [password] [nama]
 * Contoh:
 * node scripts/init-admin.mjs admin@wimala.id AdminWimala2026! "Super Admin Wimala"
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inisialisasi Firebase Admin
// Cek file serviceAccountKey.json jika ada, atau gunakan default ADC / project id
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

const auth = getAuth();
const db = getFirestore();

async function main() {
  const email = process.argv[2] || 'admin@wimalaland.id';
  const password = process.argv[3] || 'WimalaAdmin2026!';
  const nama = process.argv[4] || 'Admin Utama Wimala';

  console.log(`\n--- MEMBUAT AKUN ADMIN PERTAMA ---`);
  console.log(`Email : ${email}`);
  console.log(`Nama  : ${nama}`);

  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`User dengan email ${email} sudah terdaftar (UID: ${user.uid}). Memperbarui password & role...`);
      await auth.updateUser(user.uid, { password, displayName: nama });
    } catch (e) {
      user = await auth.createUser({
        email,
        password,
        displayName: nama,
      });
      console.log(`Akun baru berhasil dibuat (UID: ${user.uid})!`);
    }

    // Pasang Custom Claim { role: 'admin' }
    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    console.log(`Custom claim { role: 'admin' } berhasil dipasang.`);

    // Simpan data di Firestore users/{uid}
    await db.collection('users').doc(user.uid).set({
      nama,
      email,
      role: 'admin',
      aktif: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`Dokumen users/${user.uid} tersimpan di Firestore.`);
    console.log(`\nSUKSES! Akun Admin siap digunakan untuk login.`);
  } catch (err) {
    console.error('Gagal membuat akun admin:', err);
    process.exit(1);
  }
}

main();
