import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Inisialisasi Firestore dengan offline persistence multi-tab manager
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

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
