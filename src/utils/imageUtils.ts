/**
 * Converts any image data URL (including inline SVG sample rooms or large phone photos)
 * into a clean, resized JPEG data URL suitable for Gemini Vision analysis.
 */
export async function prepareImageForAnalysis(
  dataUrl: string,
  maxDimension = 1280,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const srcWidth = img.naturalWidth || img.width || 600;
      const srcHeight = img.naturalHeight || img.height || 400;

      const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
      const targetWidth = Math.max(1, Math.round(srcWidth * scale));
      const targetHeight = Math.max(1, Math.round(srcHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not initialize image canvas context.'));
        return;
      }

      // Fill white background so transparent PNGs or SVGs render cleanly in JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      reject(new Error('Failed to decode the selected image. Please try another photo.'));
    };
    img.src = dataUrl;
  });
}

/**
 * Creates a compact JPEG thumbnail data URL (< 250KB) for Firestore & localStorage persistence.
 */
export async function createThumbnailDataUrl(
  dataUrl: string,
  maxDimension = 480,
  quality = 0.72
): Promise<string> {
  try {
    let result = await prepareImageForAnalysis(dataUrl, maxDimension, quality);
    if (result.length > 220000) {
      result = await prepareImageForAnalysis(dataUrl, 320, 0.6);
    }
    return result;
  } catch {
    return dataUrl.slice(0, 220000);
  }
}
