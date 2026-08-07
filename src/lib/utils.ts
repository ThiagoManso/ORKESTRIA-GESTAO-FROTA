import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Comprime uma imagem (File ou Blob) usando HTML5 Canvas e retorna uma Data URL (base64 leve JPEG),
 * garantindo que fique muito menor que o limite de 1MB do Firestore (geralmente entre 30KB e 60KB por foto).
 */
export function compressImageToDataUrl(file: Blob | File, maxWidth = 900, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        // Fundo branco em imagens com transparência convertidas para JPG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(event.target?.result as string);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Garante que um objeto de fotos (como referencePhotos) não contenha imagens base64 excessivamente grandes
 * que violariam o limite de documento (1MB) do Firestore.
 */
export async function ensureCompressedPhotos(photos: Record<string, string> = {}): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(photos)) {
    if (!value) continue;
    if (value.startsWith('data:image') && value.length > 300000) {
      try {
        const res = await fetch(value);
        const blob = await res.blob();
        result[key] = await compressImageToDataUrl(blob, 900, 0.75);
      } catch (e) {
        console.warn('Não foi possível recomprimir a foto na chave:', key, e);
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Faz o download de um arquivo de foto registado pelos motoristas,
 * nomeando o arquivo com o Número da OS ou Pedido previamente registrado.
 */
export async function downloadPhotoWithOSName(
  photoUrl?: string,
  orderNumber?: string | number,
  externalRequestId?: string,
  stopId?: string,
  typeLabel = 'COMPROVANTE'
): Promise<void> {
  if (!photoUrl) return;

  const rawNumber = orderNumber || externalRequestId || stopId || 'SEM_NUMERO';
  const rawStr = String(rawNumber).trim();
  const hasPrefix = /^OS/i.test(rawStr) || /^PEDIDO/i.test(rawStr);
  const safeNumber = rawStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = hasPrefix ? '' : 'OS_';
  const suffix = typeLabel ? `_${typeLabel}` : '';
  const ext = photoUrl.toLowerCase().includes('.png') || photoUrl.startsWith('data:image/png') ? '.png' : '.jpg';
  const filename = `${prefix}${safeNumber}${suffix}${ext}`;

  try {
    if (photoUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = photoUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const response = await fetch(photoUrl, { mode: 'cors' });
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.warn('Fallback download para foto (CORS):', err);
    const a = document.createElement('a');
    a.href = photoUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

