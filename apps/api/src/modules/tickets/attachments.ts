import { ALLOWED_MIME_TYPES, type AttachmentRef } from '@ticket/shared';
import type { Prisma } from '@prisma/client';
import { env } from '../../env.js';
import { badRequest } from '../../lib/errors.js';
import { statObject, uploadScopePrefix } from '../../lib/storage.js';
import type { AuthenticatedUser } from '../../plugins/auth.js';

const allowed = new Set<string>(ALLOWED_MIME_TYPES);

/**
 * Presign ile yüklenmiş dosyaları ticket'a/yoruma bağlar.
 *
 * Anahtarlar istemciden geldiği için üç kontrol şart:
 *  1. Anahtar yükleyenin kendi alanında mı (başkasının dosyasını iliştiremesin)
 *  2. Obje gerçekten yüklendi mi (presign alıp yüklememiş olabilir)
 *  3. Gerçek boyut ve MIME tipi limitlere uyuyor mu — presign sırasında beyan
 *     edilen değerlere güvenilemez, S3'ün gördüğü değere bakılır
 */
export async function buildAttachmentRecords(args: {
  refs: AttachmentRef[];
  uploader: AuthenticatedUser;
}): Promise<Prisma.AttachmentCreateWithoutTicketInput[]> {
  const { refs, uploader } = args;
  if (refs.length === 0) return [];

  const prefix = uploadScopePrefix(uploader);
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  const records: Prisma.AttachmentCreateWithoutTicketInput[] = [];

  for (const { storageKey, filename } of refs) {
    if (!storageKey.startsWith(prefix)) {
      throw badRequest('Geçersiz dosya referansı');
    }

    const stat = await statObject(storageKey);
    if (!stat) {
      throw badRequest('Dosya yüklemesi tamamlanmamış görünüyor, tekrar deneyin');
    }
    if (stat.size > maxBytes) {
      throw badRequest(`Dosya boyutu ${env.MAX_UPLOAD_MB} MB sınırını aşıyor`);
    }
    if (!allowed.has(stat.mimeType)) {
      throw badRequest('Bu dosya tipi desteklenmiyor');
    }

    records.push({
      storageKey,
      filename: sanitizeFilename(filename),
      mimeType: stat.mimeType,
      size: stat.size,
      uploadedBy: { connect: { id: uploader.id } },
    });
  }

  return records;
}

/** Dosya adı yalnızca gösterim ve indirme için kullanılır; yol bileşeni taşımamalı. */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, '_').slice(0, 200) || 'dosya';
}
