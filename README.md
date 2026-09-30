# 💧 Scan Meteran Wimala (WimalaMeter PWA)

Aplikasi web mobile-first berbasis Progressive Web App (PWA) untuk pemindaian dan pencatatan angka meteran air (water meter) di kawasan perumahan **Wimala Land / Grand Tamansari**.

Dirancang khusus untuk petugas lapangan (*meter reader*) agar proses pencatatan bulanan untuk 65 unit kavling (Cluster Kamala, Lily, dan Bougenvile) menjadi sangat cepat, presisi, minim salah ketik, dan bebas repot.

---

## 🌟 Fitur Utama

1. **Smart Meter Camera & AI OCR**:
   - Membuka kamera langsung dari HP dengan panduan bingkai bidik (*viewfinder*) khusus angka meteran air.
   - Algoritma pra-pemrosesan gambar (*grayscale*, penajaman kontras, dan binarisasi *thresholding*) via HTML5 Canvas.
   - Pembacaan angka otomatis (*Optical Character Recognition*) menggunakan Tesseract.js.
   - Pilihan ambil foto dari galeri / kamera native HP.
   - Keypad input manual super cepat jika kaca meteran buram/terhalang lumut.

2. **Scanner QR Code Box Meteran**:
   - Scan stiker QR yang terpasang di boks meteran rumah (misal: `WIMALA:D-01`) langsung membuka form pencatatan unit tersebut tanpa perlu mencari manual.

3. **Cetak Lembar Stiker QR (Ready to Print)**:
   - Modul generator & cetak label QR untuk seluruh 65 kavling lengkap dengan nama cluster dan nomor blok, siap dicetak di kertas stiker A4.

4. **Kalkulasi Otomatis & Deteksi Anomali**:
   - Stand Awal (Bulan Lalu) vs Stand Akhir (Bulan Ini).
   - Pemakaian air ($m^3$) dan estimasi tagihan otomatis (Tarif dasar + Abonemen).
   - **Peringatan Anomali Cerdas**:
     - 🔴 Stand Akhir lebih kecil dari Stand Awal (indikator meter reset/salah catat).
     - 🟡 Pemakaian melonjak tinggi (>30 $m^3$ - indikator pipa/toren bocor).
     - ⚪ Pemakaian 0 $m^3$ (rumah kosong atau meter macet).

5. **Offline-First & Penyimpanan Aman**:
   - Data otomatis tersimpan di LocalStorage / IndexedDB perangkat. Petugas tetap bisa bekerja lancar di sudut cluster yang sinyal internetnya lemah.

6. **Ekspor Excel (.xlsx) & CSV**:
   - Format file hasil ekspor disesuaikan persis dengan skema tagihan portal estate Wimala Land (`Data_Tagihan_IPL_Air_Siteplan_Tahap2_03-09-2026.xlsx`) untuk memudahkan rekonsiliasi dengan admin bendahara.

7. **Galeri Bukti Fisik Foto**:
   - Setiap pencatatan dapat melampirkan foto fisik meteran sebagai bukti otentik yang tidak terbantahkan jika ada komplain dari warga.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Mode Development
```bash
npm install
npm run dev
```
Akses di browser: `http://localhost:3001` (atau via IP LAN di HP: `http://[IP_KOMPUTER]:3001`).

### 2. Build Production
```bash
npm run build
npm run preview
```

---

## 📂 Struktur Data Unit

- **Cluster Kamala**: 35 Unit (D-01 s/d D-12B, A-21 s/d A-50, D-44 s/d D-38, C-01 s/d C-16, B-05 s/d B-46)
- **Cluster Lily**: 15 Unit (C-02 s/d C-15, D-05 s/d D-29, B-03 s/d B-25, A-06 s/d A-30)
- **Cluster Bougenvile**: 15 Unit (E-01 s/d E-16, B-18 s/d B-49, A-10 s/d A-86)
- **Total**: 65 Unit Kavling
