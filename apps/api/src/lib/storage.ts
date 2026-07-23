import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

const UPLOAD_URL_TTL = 300; // 5 dk — yükleme başlatmak için fazlasıyla yeterli
const DOWNLOAD_URL_TTL = 900; // 15 dk — ticket detayı açıkken geçerli kalsın

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  // MinIO virtual-host stilini desteklemez; path-style zorunlu.
  forcePathStyle: true,
});

/**
 * İndirme adresleri istemciye gidiyor; MinIO container içinde `minio:9000`
 * olarak erişilse bile tarayıcının çözebileceği adresle imzalanmalı.
 */
const publicS3 =
  env.S3_PUBLIC_ENDPOINT && env.S3_PUBLIC_ENDPOINT !== env.S3_ENDPOINT
    ? new S3Client({
        endpoint: env.S3_PUBLIC_ENDPOINT,
        region: env.S3_REGION,
        credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
        forcePathStyle: true,
      })
    : s3;

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

/**
 * Yükleyenin dosya alanı. Müşteriler firmalarının alanına, destek ekibi ortak
 * `staff` alanına yazar. Anahtar üretimi ve ek doğrulaması aynı fonksiyonu
 * kullanmalı — iki yerde ayrı hesaplanınca ekip ekleri reddediliyordu.
 */
export function uploadScopeId(user: { role: string; orgId: string | null }): string {
  return user.role === 'CUSTOMER' ? (user.orgId ?? 'unknown') : 'staff';
}

export function uploadScopePrefix(user: { role: string; orgId: string | null }): string {
  return `orgs/${uploadScopeId(user)}/`;
}

/**
 * Storage anahtarı sunucuda üretilir — istemciden gelen dosya adı asla yola
 * karışmaz (path traversal ve çakışma riski). Orijinal ad veritabanında durur.
 */
export function buildStorageKey(scopeId: string, filename: string): string {
  const ext = extname(filename).slice(0, 12).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `orgs/${scopeId}/${yyyymm}/${randomUUID()}${ext}`;
}

export function presignUpload(storageKey: string, mimeType: string): Promise<string> {
  return getSignedUrl(
    publicS3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey, ContentType: mimeType }),
    { expiresIn: UPLOAD_URL_TTL },
  );
}

export function presignDownload(storageKey: string, filename: string): Promise<string> {
  return getSignedUrl(
    publicS3,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
      // Tarayıcı dosyayı orijinal adıyla indirsin, uuid'li anahtarla değil.
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL },
  );
}

/**
 * Yükleme gerçekten yapıldı mı doğrular. İstemci presign alıp dosyayı hiç
 * yüklemeden anahtarı gönderebilir — o durumda ek kaydı oluşturmuyoruz.
 */
export async function statObject(
  storageKey: string,
): Promise<{ size: number; mimeType: string } | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
    return {
      size: head.ContentLength ?? 0,
      mimeType: head.ContentType ?? 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

export const UPLOAD_URL_TTL_SECONDS = UPLOAD_URL_TTL;
