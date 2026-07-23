import type { FastifyContextConfig } from 'fastify';
import { env } from '../env.js';

const isTest = env.NODE_ENV === 'test';

/**
 * Testler tek IP'den yüzlerce istek atıyor ve gerçek limitlere takılıyordu.
 * Limitleri test ortamında kapatmak, üretimdeki değerleri gevşetmekten iyi —
 * kaba kuvvet koruması olduğu gibi kalır.
 */
export const globalRateLimit = {
  max: isTest ? 100_000 : 300,
  timeWindow: '1 minute',
};

/** Kimlik uçları: lisans anahtarı ve şifre denemelerini sınırlar. */
export const strictRateLimit: FastifyContextConfig = {
  rateLimit: isTest ? false : { max: 10, timeWindow: '5 minutes' },
};

/** Dosya yükleme adresi alma — normal kullanımda dakikada birkaç istek. */
export const uploadRateLimit: FastifyContextConfig = {
  rateLimit: isTest ? false : { max: 60, timeWindow: '1 minute' },
};
