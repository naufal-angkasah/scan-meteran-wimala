import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBfQfCuo7cqZXG7cWY1Xj_tjVrwBZjeMrI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'wimala-land.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'wimala-land',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'wimala-land.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '36060666743',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:36060666743:web:d051d77b843b1a91aadf72',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-V32P1W1RQ7',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

export const storage = getStorage(app);
export const functions = getFunctions(app);

// Callable Cloud Functions Helpers
export const callBacaMeteran = httpsCallable<{ fotoBase64: string; mimeType?: string }, {
  angka: number | null;
  confidence: number;
  catatan: string;
}>(functions, 'bacaMeteran');

export const callSimpanReading = httpsCallable<{
  customerId: string;
  periode: string;
  angka: number;
  fotoUrl: string;
  ocrConfidence?: number;
}, {
  success: boolean;
  readingId: string;
  pemakaianM3: number;
  totalBiaya: number;
  status: 'normal' | 'perlu_cek' | 'valid';
  catatanAnomali?: string;
}>(functions, 'simpanReading');

export const callBuatWorker = httpsCallable<{ email: string; password: string; nama: string }, {
  success: boolean;
  uid: string;
  email: string;
  nama: string;
}>(functions, 'buatWorker');

export const callNonaktifkanWorker = httpsCallable<{ workerId: string; aktif: boolean }, {
  success: boolean;
  workerId: string;
  aktif: boolean;
}>(functions, 'nonaktifkanWorker');

export const callResetPasswordWorker = httpsCallable<{ workerId: string; passwordBaru: string }, {
  success: boolean;
  workerId: string;
}>(functions, 'resetPasswordWorker');

export default app;
