// Vercel Serverless Function: baca angka meteran + stiker unit rumah dengan Gemini Vision.
// Env yang dibutuhkan di Vercel: GEMINI_API_KEY  (opsional: GEMINI_MODEL)

const FIREBASE_API_KEY =
  process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBfQfCuo7cqZXG7cWY1Xj_tjVrwBZjeMrI';

const PROMPT = `Kamu adalah pakar pembacaan meteran air PDAM di Indonesia (Wimala Land).
Foto ini berisi meteran air PDAM dan biasanya juga stiker atau tulisan identitas unit rumah di boks/tutup meteran.

ATURAN PENTING PDAM INDONESIA:
1. Rol angka utama memiliki angka HITAM dan seringkali angka MERAH di bagian belakangnya:
   - Angka HITAM di sebelah kiri adalah satuan METER KUBIK (m³). Ini adalah ANGKA UTAMA yang harus dicatat!
   - Angka MERAH di sebelah kanan (atau jarum putar merah kecil) adalah satuan LITER/desimal. ABAIKAN angka merah ini, JANGAN dimasukkan ke angka m³!
   - Contoh: jika rol menunjukkan '00315' hitam dan '837' merah, maka angka m³ adalah 315.
   - Contoh: jika rol menunjukkan '01258' hitam dan '050' merah, maka angka m³ adalah 1258.
   - Contoh: jika rol menunjukkan '02713' (semuanya hitam), maka angka m³ adalah 2713.
   - Contoh: jika rol menunjukkan '0058' hitam dan '8' merah, maka angka m³ adalah 58.
   - Hilangkan nol di depan (leading zeros) pada hasil akhir integer: 00315 -> 315.

2. Dari stiker atau tulisan identitas unit rumah di boks / tutup meteran:
   - "cluster": nama cluster perumahan jika tertulis (contoh: Kamala)
   - "blok": blok dan nomor unit/rumah/kavling (contoh: D-1, D-2, D-15, D15, Blok D No 1, Unit D-1, dll). Gunakan format huruf blok dan nomor tanpa nol di depan (contoh: D-1, D-2, bukan D-01).
   - "pengguna": nama pemilik/penghuni jika tertulis

3. "confidence": tingkat kepastian angka hitam (0.0 sampai 1.0).
4. "catatan": rincian digit hitam yang terbaca dan digit merah yang diabaikan.

Balas HANYA JSON persis format ini:
{"angka": number|null, "confidence": number, "cluster": string|null, "blok": string|null, "pengguna": string|null, "catatan": string}
Isi null jika tidak terlihat atau tidak terbaca.`;

async function verifyFirebaseToken(idToken: string): Promise<boolean> {
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!r.ok) return false;
    const d: any = await r.json();
    return Array.isArray(d.users) && d.users.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = String(req.headers?.authorization || '');
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!idToken || !(await verifyFirebaseToken(idToken))) {
    return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login ulang.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_FIREBASE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY belum diisi di Vercel (Settings > Environment Variables), lalu Redeploy.',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const mimeType = body.mimeType || 'image/jpeg';
  const data = String(body.fotoBase64 || '').replace(/^data:image\/[a-z]+;base64,/, '');
  if (!data) {
    return res.status(400).json({ error: 'Foto kosong.' });
  }

  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
  ].filter(Boolean) as string[];

  let lastError = 'Pembacaan AI gagal.';
  for (const model of models) {
    try {
      const g = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: PROMPT },
                  { inlineData: { mimeType, data } },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
        }
      );

      if (!g.ok) {
        lastError = `Gemini (${model}) HTTP ${g.status}`;
        if (g.status === 404 || g.status === 400 || g.status === 503 || g.status === 429) continue;
        break;
      }

      const j: any = await g.json();
      const text: string = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

      let angka: number | null = null;
      if (parsed.angka !== null && parsed.angka !== undefined) {
        const n = parseInt(String(parsed.angka).replace(/\D/g, ''), 10);
        if (!isNaN(n)) angka = n;
      }
      const conf = Number(parsed.confidence);
      const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);

      return res.status(200).json({
        angka,
        confidence: angka === null ? 0.2 : isNaN(conf) ? 0.6 : Math.min(1, Math.max(0, conf)),
        cluster: str(parsed.cluster),
        blok: str(parsed.blok),
        pengguna: str(parsed.pengguna),
        catatan: str(parsed.catatan) || '',
      });
    } catch (e: any) {
      lastError = e?.message || lastError;
    }
  }

  return res.status(502).json({ error: lastError });
}
