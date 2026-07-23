import type { AttachmentRef, PresignResponse } from '@ticket/shared';
import { apiFetch, ApiError } from './api';

/**
 * Dosya API üzerinden geçmez: önce imzalı adres alınır, dosya doğrudan
 * depolama servisine PUT edilir, sonra sadece anahtar ticket'a bağlanır.
 * Büyük ekran görüntüleri API sürecini meşgul etmesin diye.
 */
export async function uploadFile(file: File | Blob, filename: string): Promise<AttachmentRef> {
  const presign = await apiFetch<PresignResponse>('/uploads/presign', {
    method: 'POST',
    body: { filename, mimeType: file.type, size: file.size },
  });

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });

  if (!put.ok) {
    throw new ApiError(put.status, 'UPLOAD_FAILED', `"${filename}" yüklenemedi`);
  }

  return { storageKey: presign.storageKey, filename };
}

/** Ana süreçten gelen data: URI'yi yüklenebilir bir Blob'a çevirir. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function screenshotFilename(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `ekran-goruntusu-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}
