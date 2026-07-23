import { PrismaClient } from '@prisma/client';
import { hash, Algorithm } from '@node-rs/argon2';

/**
 * İlk kurulum verisi: bir yönetici hesabı ve varsayılan kategoriler.
 * Tekrar çalıştırılabilir (idempotent) — var olan kayıtlara dokunmaz.
 */
const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DEFAULT_CATEGORIES = [
  { name: 'Donanım', color: '#f97316' },
  { name: 'Yazılım', color: '#3b82f6' },
  { name: 'Ağ / İnternet', color: '#8b5cf6' },
  { name: 'E-posta', color: '#14b8a6' },
  { name: 'Hesap / Erişim', color: '#eab308' },
  { name: 'Diğer', color: '#64748b' },
];

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@firma.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';
  const name = process.env.SEED_ADMIN_NAME ?? 'Sistem Yöneticisi';

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      role: 'ADMIN',
      passwordHash: await hash(password, ARGON2_OPTIONS),
    },
  });

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  console.log('Seed tamamlandı.');
  console.log(`  Yönetici: ${admin.email}`);
  console.log(`  Şifre:    ${password}`);
  console.log(`  Kategori: ${DEFAULT_CATEGORIES.length} adet`);
  console.log('\nÜretime geçmeden önce bu şifreyi değiştirin.');
}

main()
  .catch((err: unknown) => {
    console.error('Seed başarısız:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
