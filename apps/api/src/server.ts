import { buildApp } from './app.js';
import { env } from './env.js';
import { bootstrapFirstAdmin } from './lib/bootstrap.js';
import { prisma } from './lib/prisma.js';
import { closeRealtime, initRealtime } from './lib/realtime.js';
import { ensureBucket } from './lib/storage.js';

async function main(): Promise<void> {
  const app = await buildApp();

  // Bucket yoksa oluştur — ilk kurulumda elle MinIO konsoluna girmeye gerek kalmasın.
  try {
    await ensureBucket();
  } catch (err) {
    app.log.error({ err }, 'S3 bucket hazırlanamadı — dosya ekleri çalışmayabilir');
  }

  // Taze kurulumda ilk yönetici ve kategoriler.
  await bootstrapFirstAdmin(app.log);

  await app.listen({ port: env.API_PORT, host: env.API_HOST });

  // Socket.IO, Fastify'ın HTTP sunucusuna bağlanır; ayrı port gerekmez.
  initRealtime(app.server);
  app.log.info(`Realtime hazır: ws://${env.API_HOST}:${env.API_PORT}/realtime`);
  app.log.info(`API dokümantasyonu: http://localhost:${env.API_PORT}/docs`);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} alındı, kapatılıyor...`);
    await closeRealtime();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error('Sunucu başlatılamadı:', err);
  process.exit(1);
});
