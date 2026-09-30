# 📘 Petunjuk Setup & Deployment: Rekap Meteran Air PDAM Wimala

Panduan teknis konfigurasi Firebase, Secret Gemini Vision API, Akun Admin, Seeder Data, dan Deployment.

---

## 1. Konfigurasi Variabel Lingkungan (.env)

Buat file `.env` di root projek (atau salin dari `.env.example`):
```bash
cp .env.example .env
```

Pastikan variabel dengan prefix `VITE_` terisi sesuai Firebase Web App:
```env
VITE_FIREBASE_API_KEY=AIzaSyBfQfCuo7cqZXG7cWY1Xj_tjVrwBZjeMrI
VITE_FIREBASE_AUTH_DOMAIN=wimala-land.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=wimala-land
VITE_FIREBASE_STORAGE_BUCKET=wimala-land.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=36060666743
VITE_FIREBASE_APP_ID=1:36060666743:web:d051d77b843b1a91aadf72
VITE_FIREBASE_MEASUREMENT_ID=G-V32P1W1RQ7
```

---

## 2. Cara Menyimpan Secret Gemini API di Cloud Functions

API Key Gemini **wajib** disimpan sebagai Secret di Cloud Functions (tidak boleh dimasukkan ke dalam kode frontend):

Jalankan perintah berikut di terminal:
```bash
firebase functions:secrets:set GEMINI_API_KEY
```
Saat terminal meminta input, masukkan API Key Gemini Anda (didapat dari [Google AI Studio](https://aistudio.google.com/)).

---

## 3. Inisialisasi Akun Admin Pertama

Untuk membuat akun Admin pertama dengan Custom Claim `role: 'admin'`:

1. Unduh Service Account Key dari Firebase Console:
   - Masuk ke: **Project Settings** -> **Service accounts** -> Klik **Generate new private key**.
   - Simpan file tersebut dengan nama `serviceAccountKey.json` di root folder projek `scan-meteran-wimala/`.
2. Jalankan script inisialisasi:
   ```bash
   node scripts/init-admin.mjs admin@wimalaland.id WimalaAdmin2026! "Super Admin Wimala"
   ```

---

## 4. Seeding Data Pelanggan (65 Unit) & Tarif Bertingkat

Jalankan script seeder untuk mengisi 65 kavling Wimala Land dan 4 tingkatan tarif air PDAM ke Cloud Firestore:
```bash
node scripts/seed-tariffs-and-customers.mjs
```

---

## 5. Deployment Lengkap ke Firebase

Untuk mempublikasikan Security Rules, Indexes, Cloud Functions, Storage, dan Hosting sekaligus:
```bash
# 1. Build frontend client
npm run build

# 2. Build cloud functions
cd functions && npm run build && cd ..

# 3. Deploy seluruh resource
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```
