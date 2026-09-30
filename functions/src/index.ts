import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// ============================================================
// 1. CALLABLE: bacaMeteran (Gemini Vision OCR)
// ============================================================
export const bacaMeteran = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    // Verifikasi pemanggil login
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Anda harus login untuk memindai meteran.');
    }

    const { fotoBase64, mimeType = 'image/jpeg' } = request.data;
    if (!fotoBase64) {
      throw new HttpsError('invalid-argument', 'Foto meteran (base64) wajib disertakan.');
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY belum dikonfigurasi di Cloud Secret.');
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Clean base64 string
      const cleanBase64 = fotoBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      const prompt = 'Anda adalah sistem pembaca OCR khusus meteran air PDAM analog/digital.\n' +
        'Tugas:\n' +
        '1. Temukan odometer/counter digit penunjuk volume air meteran (angka hitam penunjuk m³).\n' +
        '2. Baca digit tersebut secara presisi. Abaikan angka merah (liter/desimal) jika ada.\n' +
        '3. Kembalikan HANYA format JSON valid tanpa format markdown:\n' +
        '{"angka": 142, "confidence": 0.95, "catatan": "Angka terbaca jelas"}\n' +
        'Jika meteran buram atau tidak terbaca:\n' +
        '{"angka": null, "confidence": 0, "catatan": "Angka meteran tidak terbaca jelas"}';

      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();

      // Clean possible markdown JSON wrappers
      const cleanJson = responseText
        .replace(/^```json/i, '')
        .replace(/^```/g, '')
        .replace(/```$/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
      return {
        angka: typeof parsed.angka === 'number' ? parsed.angka : null,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        catatan: parsed.catatan || '',
      };
    } catch (err: any) {
      console.error('Error saat memanggil Gemini Vision API:', err);
      throw new HttpsError('internal', `Gagal membaca meteran dengan Gemini: ${err.message}`);
    }
  }
);

// ============================================================
// 2. CALLABLE: simpanReading (Hitung Tarif, Validasi, Tulis DB)
// ============================================================
export const simpanReading = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Anda harus login untuk mencatat meteran.');
    }

    const { customerId, periode, angka, fotoUrl, ocrConfidence = 1 } = request.data;

    if (!customerId || !periode || typeof angka !== 'number' || !fotoUrl) {
      throw new HttpsError(
        'invalid-argument',
        'Parameter customerId, periode, angka, dan fotoUrl wajib diisi lengkap.'
      );
    }

    // 1. Ambil data pelanggan
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new HttpsError('not-found', 'Data pelanggan tidak ditemukan.');
    }
    const customer = customerDoc.data()!;

    // 2. Tentukan angka sebelumnya
    // Cari reading terakhir sebelum periode ini
    const prevReadingSnap = await db
      .collection('readings')
      .where('customerId', '==', customerId)
      .where('periode', '<', periode)
      .orderBy('periode', 'desc')
      .limit(1)
      .get();

    let angkaSebelumnya = customer.angkaAwal ?? 0;
    if (!prevReadingSnap.empty) {
      angkaSebelumnya = prevReadingSnap.docs[0].data().angkaSekarang ?? angkaSebelumnya;
    }

    // 3. Hitung pemakaian
    const pemakaianM3 = Math.max(0, angka - angkaSebelumnya);

    // 4. Hitung total biaya dari koleksi tariffs bertingkat
    const tariffsSnap = await db.collection('tariffs').orderBy('minM3', 'asc').get();
    let totalBiaya = 0;

    if (!tariffsSnap.empty) {
      for (const tDoc of tariffsSnap.docs) {
        const t = tDoc.data();
        const minM3 = t.minM3 ?? 0;
        const maxM3 = t.maxM3 ?? Infinity;
        const harga = t.hargaPerM3 ?? 0;

        if (pemakaianM3 > minM3) {
          const tierVolume = Math.min(pemakaianM3, maxM3) - minM3;
          totalBiaya += tierVolume * harga;
        }
      }
    } else {
      // Fallback default jika tabel tarif belum di-seed
      // 0-10 m3: 2.700, >10-20 m3: 5.400, >20-30: 10.800
      if (pemakaianM3 <= 10) {
        totalBiaya = pemakaianM3 * 2700;
      } else if (pemakaianM3 <= 20) {
        totalBiaya = 10 * 2700 + (pemakaianM3 - 10) * 5400;
      } else {
        totalBiaya = 10 * 2700 + 10 * 5400 + (pemakaianM3 - 20) * 10800;
      }
    }

    // 5. Cek rata-rata pemakaian historis pelanggan
    const historySnap = await db
      .collection('readings')
      .where('customerId', '==', customerId)
      .limit(6)
      .get();

    let avgUsage = 0;
    if (!historySnap.empty) {
      const sum = historySnap.docs.reduce((acc, doc) => acc + (doc.data().pemakaianM3 || 0), 0);
      avgUsage = sum / historySnap.docs.length;
    }

    // 6. Evaluasi Anomali
    let status: 'normal' | 'perlu_cek' | 'valid' = 'normal';
    let catatanAnomali: string | null = null;

    if (angka < angkaSebelumnya) {
      status = 'perlu_cek';
      catatanAnomali = `Angka baru (${angka}) lebih kecil dari bulan lalu (${angkaSebelumnya}).`;
    } else if (ocrConfidence < 0.7) {
      status = 'perlu_cek';
      catatanAnomali = `Confidence pembacaan OCR rendah (${Math.round(ocrConfidence * 100)}%).`;
    } else if (avgUsage > 0 && pemakaianM3 > 3 * avgUsage) {
      status = 'perlu_cek';
      catatanAnomali = `Pemakaian (${pemakaianM3} m³) lebih dari 3x rata-rata pelanggan (${Math.round(avgUsage)} m³).`;
    }

    // 7. Simpan ke Firestore dengan ID komposit customerId_periode
    const readingId = `${customerId}_${periode}`;
    const readingData = {
      customerId,
      blok: customer.blok || '',
      namaPemilik: customer.namaPemilik || '',
      nomorMeteran: customer.nomorMeteran || '',
      periode,
      angkaSebelumnya,
      angkaSekarang: angka,
      pemakaianM3,
      totalBiaya: Math.round(totalBiaya),
      fotoUrl,
      ocrConfidence,
      status,
      catatanAnomali: catatanAnomali || null,
      dicatatOleh: request.auth.token.name || request.auth.uid,
      dicatatOlehUid: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('readings').doc(readingId).set(readingData, { merge: true });

    return {
      success: true,
      readingId,
      pemakaianM3,
      totalBiaya,
      status,
      catatanAnomali,
    };
  }
);

// ============================================================
// 3. ADMIN CALLABLES: Kelola Akun Worker
// ============================================================

const verifikasiAdmin = (request: any) => {
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Hanya admin yang berhak melakukan operasi ini.');
  }
};

export const buatWorker = onCall({ cors: true }, async (request) => {
  verifikasiAdmin(request);
  const { email, password, nama } = request.data;
  if (!email || !password || !nama) {
    throw new HttpsError('invalid-argument', 'Email, password, dan nama wajib diisi.');
  }

  // Cek jumlah worker aktif (maksimal 2 worker sesuai aturan)
  const existingWorkers = await db.collection('users').where('role', '==', 'worker').get();
  if (existingWorkers.size >= 2) {
    throw new HttpsError('failed-precondition', 'Jumlah worker sudah mencapai batas maksimal (2 worker).');
  }

  const userRecord = await auth.createUser({
    email,
    password,
    displayName: nama,
  });

  // Pasang custom claim
  await auth.setCustomUserClaims(userRecord.uid, { role: 'worker' });

  // Simpan profil di koleksi users
  await db.collection('users').doc(userRecord.uid).set({
    nama,
    email,
    role: 'worker',
    aktif: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, uid: userRecord.uid, email, nama };
});

export const nonaktifkanWorker = onCall({ cors: true }, async (request) => {
  verifikasiAdmin(request);
  const { workerId, aktif } = request.data;
  if (!workerId || typeof aktif !== 'boolean') {
    throw new HttpsError('invalid-argument', 'workerId dan status aktif wajib diisi.');
  }

  await auth.updateUser(workerId, { disabled: !aktif });
  await db.collection('users').doc(workerId).update({
    aktif,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, workerId, aktif };
});

export const resetPasswordWorker = onCall({ cors: true }, async (request) => {
  verifikasiAdmin(request);
  const { workerId, passwordBaru } = request.data;
  if (!workerId || !passwordBaru || passwordBaru.length < 6) {
    throw new HttpsError('invalid-argument', 'workerId dan passwordBaru (min 6 karakter) wajib diisi.');
  }

  await auth.updateUser(workerId, { password: passwordBaru });
  return { success: true, workerId };
});
