import type { ImagePart } from './types';

/**
 * Downscales and re-encodes photos before sending them to a model.
 * A 12 MP phone photo is 3–6 MB; most providers cap request size, and vision models
 * do not read more detail than ~2000 px anyway. Output: JPEG, longest side ≤ 2048 px.
 */
const MAX_SIDE = 2048;
const QUALITY = 0.85;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible.'));
    };
    img.src = url;
  });

const readAsBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const prepareImage = async (file: File): Promise<ImagePart> => {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.fillStyle = '#ffffff'; // transparent PNGs → white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('encode failed');
    return { data: await readAsBase64(blob), mimeType: 'image/jpeg' };
  } catch {
    // Formats the browser cannot decode (e.g. HEIC on some devices): send as is.
    return { data: await readAsBase64(file), mimeType: file.type || 'image/jpeg' };
  }
};
