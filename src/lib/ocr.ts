import { createWorker } from 'tesseract.js';

/**
 * Pre-processes an image on an HTML5 canvas to optimize OCR for water meter counters.
 * Increases contrast, applies adaptive grayscale and thresholding to make numbers crisp.
 */
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
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  // Draw the cropped region
  ctx.drawImage(
    imageSource,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const d = imgData.data;

  // 1. Grayscale & contrast enhancement
  for (let i = 0; i < d.length; i += 4) {
    // Luminance
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    
    // High contrast curve
    const contrast = 1.4;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const highContrast = factor * (gray - 128) + 128;

    // Thresholding
    const val = highContrast > 135 ? 255 : 0;

    d[i] = val;     // R
    d[i + 1] = val; // G
    d[i + 2] = val; // B
  }

  ctx.putImageData(imgData, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    canvas,
  };
};

/**
 * Recognizes digits from an image / base64 using Tesseract.js
 */
export const recognizeMeterNumber = async (
  imageDataUrl: string,
  onProgress?: (progress: number, status: string) => void
): Promise<{ text: string; confidence: number; detectedNumber: number | null }> => {
  try {
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100), m.status);
        }
      }
    });

    // Whitelist only digits and comma/dot
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.,',
      tessedit_pageseg_mode: '7' as any, // Treat the image as a single text line
    });

    const ret = await worker.recognize(imageDataUrl);
    await worker.terminate();

    const rawText = ret.data.text.trim();
    const confidence = ret.data.confidence;

    // Clean numbers
    const cleanDigits = rawText.replace(/[^0-9]/g, '');
    const detectedNumber = cleanDigits.length > 0 ? parseInt(cleanDigits, 10) : null;

    return {
      text: rawText,
      confidence,
      detectedNumber,
    };
  } catch (error) {
    console.warn('Tesseract OCR error:', error);
    return {
      text: '',
      confidence: 0,
      detectedNumber: null,
    };
  }
};
