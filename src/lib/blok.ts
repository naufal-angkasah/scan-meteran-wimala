/**
 * Normalisasi nomor blok dari berbagai tulisan (stiker cetak, tulisan spidol, hasil OCR).
 * "D15", "d-15", "Kamala D 15", "D-15 Naufal" -> "D-15"
 * "d12b" -> "D-12B"
 */
export function normalizeBlok(raw: string | null | undefined): string {
  const s = (raw || '').toUpperCase();
  // Hilangkan kata-kata umum seperti BLOK, UNIT, KAVLING, RUMAH, NOMOR, NO
  const sClean = s
    .replace(/\b(BLOK|BLOCK|UNIT|KAVLING|KAV|RUMAH|NOMOR|NO)\b/g, ' ')
    .replace(/[^A-Z0-9\s-]/g, ' ');

  // 1. Pola: Huruf Blok + Angka Nomor (contoh: D-15, D15, D 15, D12B)
  const m = sClean.match(/\b([A-Z])\s*-?\s*(\d{1,3})([A-Z])?\b/);
  if (m) {
    const num = m[2].length < 2 ? m[2].padStart(2, '0') : m[2];
    return `${m[1]}-${num}${m[3] || ''}`;
  }

  // 2. Pola: Hanya nomor unit tanpa huruf blok
  const mNum = sClean.match(/\b(\d{1,3})([A-Z])?\b/);
  if (mNum) {
    return `${mNum[1]}${mNum[2] || ''}`;
  }

  return s.replace(/\s+/g, ' ').trim();
}

/** ID dokumen Firestore dari blok: "D-12B" -> "d_12b" (sama dengan data seed) */
export function blokToId(blok: string): string {
  return normalizeBlok(blok).toLowerCase().replace(/[^a-z0-9]/g, '_');
}
