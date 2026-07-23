import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testler gerçek bir PostgreSQL ve MinIO'ya karşı çalışır (docker compose).
    // Mock'lanmış bir veritabanıyla "iç notlar sızmıyor" garantisi vermek
    // anlamsız olurdu — asıl filtre Prisma sorgusunun içinde.
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Aynı veritabanını paylaştıkları için dosyalar sırayla çalışır.
    fileParallelism: false,
    setupFiles: ['./test/setup.ts'],
  },
});
