/**
 * Utility untuk kompresi foto meteran air di sisi client (browser)
 * Memastikan ukuran file di bawah 1 MB sebelum diupload ke Firebase Storage
 */
export interface CompressedImage {
  blob: Blob;
  base64: string;
  sizeKb: number;
}

export const compressMeterPhoto = (
  fileOrBase64: File | string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8
): Promise<CompressedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Pertahankan aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Gagal membuat canvas context untuk kompresi'));
        return;
      }

      // Render gambar ke canvas dengan dimensi baru
      ctx.drawImage(img, 0, 0, width, height);

      // Export ke JPEG terkompresi
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengompresi gambar ke Blob'));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve({
              blob,
              base64,
              sizeKb: Math.round(blob.size / 1024),
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (e) => reject(new Error('Gagal memuat file gambar meteran'));

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    }
  });
};
