import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * OWASP 2024 önerisi: argon2id, 19 MiB bellek, 2 tur, 1 paralellik.
 * Bellek maliyeti GPU saldırılarına karşı asıl koruma — turu değil onu artırın.
 */
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS);
  } catch {
    // Bozuk/eski format hash — doğrulama başarısız sayılır, süreç düşmez.
    return false;
  }
}
