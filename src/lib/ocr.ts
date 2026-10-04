import { auth } from './firebase';

export interface OcrFoto {
  angka: number | null;
  confidence: number;
  cluster: string | null;
  blok: string | null;
  pengguna: string | null;
  catatan?: string;
}

/**
 * Kirim foto (meteran + stiker) ke Vercel serverless /api/baca-meteran.
 * API key Gemini disimpan di server (env GEMINI_API_KEY), tidak pernah ada di browser.
 */
export async function bacaFotoMeteran(fotoBase64: string): Promise<OcrFoto> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/baca-meteran', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ fotoBase64, mimeType: 'image/jpeg' }),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* respons bukan JSON */
  }
  if (!res.ok) {
    throw new Error(data?.error || `Pembacaan foto gagal (HTTP ${res.status})`);
  }
  return data as OcrFoto;
}

export const preprocessMeterImage = (
  imageSource: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number
): { dataUrl: string; canvas: HTMLCanvasElement } => {
  const canvas = document.createElement('canvas');
  const targetWidth = Math.max(300, sourceWidth);
  const targetHeight = Math.max(100, sourceHeight);
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(imageSource, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    canvas,
  };
};

export const recognizeMeterNumber = async (
  imageDataUrl: string,
  _onProgress?: (progress: number, status?: string) => void
): Promise<{ text: string; confidence: number; detectedNumber: number | null }> => {
  try {
    const res = await bacaFotoMeteran(imageDataUrl);
    return {
      text: res.angka !== null ? String(res.angka) : '',
      confidence: res.confidence,
      detectedNumber: res.angka,
    };
  } catch {
    return {
      text: '',
      confidence: 0,
      detectedNumber: null,
    };
  }
};
