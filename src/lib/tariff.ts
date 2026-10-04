import { Tariff } from '../types';

/** Tarif bawaan jika koleksi tariffs di Firestore kosong */
const DEFAULT_TIERS = [
  { minM3: 0, maxM3: 10, hargaPerM3: 2700 },
  { minM3: 10, maxM3: 20, hargaPerM3: 5400 },
  { minM3: 20, maxM3: 30, hargaPerM3: 10800 },
  { minM3: 30, maxM3: 9999, hargaPerM3: 21600 },
];

/** Hitung biaya air bertingkat memakai tarif dari Firestore (sama dengan logika admin) */
export function hitungBiaya(pemakaianM3: number, tariffs: Pick<Tariff, 'minM3' | 'maxM3' | 'hargaPerM3'>[]): number {
  const tiers = tariffs.length > 0 ? tariffs : DEFAULT_TIERS;
  let total = 0;
  for (const t of tiers) {
    if (pemakaianM3 > t.minM3) {
      total += (Math.min(pemakaianM3, t.maxM3) - t.minM3) * t.hargaPerM3;
    }
  }
  return Math.round(total);
}
