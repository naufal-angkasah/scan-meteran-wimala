/**
 * Normalisasi nomor blok dari berbagai tulisan (stiker cetak, tulisan spidol, hasil OCR).
 * "D15", "d-15", "Kamala D 15", "D-15 Naufal" -> "D-15"
 * "d12b" -> "D-12B"
 */
export function normalizeBlok(raw: string | null | undefined): string {
  const s = (raw || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ');
  const m = s.match(/\b([A-Z])\s*-?\s*(\d{1,3})([A-Z])?\b/);
  if (!m) return s.replace(/\s+/g, ' ').trim();
  const num = m[2].length < 2 ? m[2].padStart(2, '0') : m[2];
  return `${m[1]}-${num}${m[3] || ''}`;
}

/** ID dokumen Firestore dari blok: "D-12B" -> "d_12b" (sama dengan data seed) */
export function blokToId(blok: string): string {
  return normalizeBlok(blok).toLowerCase().replace(/[^a-z0-9]/g, '_');
}
