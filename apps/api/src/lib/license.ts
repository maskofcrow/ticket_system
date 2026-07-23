import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { LICENSE_KEY_ALPHABET } from '@ticket/shared';
import { env } from '../env.js';
import { hashPassword, verifyPassword } from './password.js';

const GROUP_LENGTH = 4;
const GROUP_COUNT = 4;

/**
 * TCK-A7K2-9MRT-4XQP-B8ZW formatında anahtar üretir.
 * 16 karakter × 32 alfabe = 80 bit entropi — kaba kuvvete fazlasıyla yeter.
 *
 * Modulo bias'ı önlemek için alfabeye sığmayan baytlar atılır (rejection sampling);
 * alfabe 32 karakter olduğu için 256 % 32 == 0, yani pratikte bias zaten yok,
 * ama alfabe ileride değişirse diye maskeleme yerine bu yol seçildi.
 */
export function generateLicenseKey(): string {
  const total = GROUP_LENGTH * GROUP_COUNT;
  const chars: string[] = [];

  while (chars.length < total) {
    for (const byte of randomBytes(total)) {
      if (chars.length >= total) break;
      const index = byte % LICENSE_KEY_ALPHABET.length;
      if (byte - index + LICENSE_KEY_ALPHABET.length > 256) continue;
      chars.push(LICENSE_KEY_ALPHABET[index]!);
    }
  }

  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    groups.push(chars.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(''));
  }
  return `TCK-${groups.join('-')}`;
}

/**
 * Deterministik arama hash'i. Anahtar argon2 ile saklandığı için doğrudan
 * sorgulanamaz; bu HMAC indeksli tek sorguyla firmayı bulmayı sağlar.
 * LICENSE_PEPPER değişirse mevcut anahtarlar bulunamaz hale gelir.
 */
export function licenseLookupHash(licenseKey: string): string {
  return createHmac('sha256', env.LICENSE_PEPPER).update(normalize(licenseKey)).digest('hex');
}

export function licenseSuffix(licenseKey: string): string {
  return normalize(licenseKey).slice(-GROUP_LENGTH);
}

export function hashLicenseKey(licenseKey: string): Promise<string> {
  return hashPassword(normalize(licenseKey));
}

export function verifyLicenseKey(digest: string, licenseKey: string): Promise<boolean> {
  return verifyPassword(digest, normalize(licenseKey));
}

/** Yeni firma için üretilecek üç alanı tek seferde hazırlar. */
export async function issueLicenseKey() {
  const licenseKey = generateLicenseKey();
  return {
    licenseKey,
    licenseKeyHash: await hashLicenseKey(licenseKey),
    licenseLookup: licenseLookupHash(licenseKey),
    licenseSuffix: licenseSuffix(licenseKey),
  };
}

/** Sabit zamanlı hex karşılaştırma — lookup hash'i sızdırmamak için. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function normalize(licenseKey: string): string {
  return licenseKey.trim().toUpperCase();
}
