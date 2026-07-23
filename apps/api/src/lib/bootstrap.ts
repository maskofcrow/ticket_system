import type { FastifyBaseLogger } from 'fastify';
import { prisma } from './prisma.js';
import { hashPassword } from './password.js';

const DEFAULT_CATEGORIES = [
  { name: 'Donanım', color: '#f97316' },
  { name: 'Yazılım', color: '#3b82f6' },
  { name: 'Ağ / İnternet', color: '#8b5cf6' },
  { name: 'E-posta', color: '#14b8a6' },
  { name: 'Hesap / Erişim', color: '#eab308' },
  { name: 'Diğer', color: '#64748b' },
];

/**
 * Taze bir kurulumda ilk yöneticiyi ve varsayılan kategorileri oluşturur.
 *
 * Seed betiği `tsx` gerektirdiği için üretim imajında çalışmıyor; bu olmadan
 * yeni kurulan bir sunucuda panele giriş yapmanın hiçbir yolu kalmıyordu.
 *
 * Yalnızca sistemde HİÇ yönetici yokken çalışır — sonradan yönetici eklemek
 * veya var olanın şifresini geri almak için kullanılamaz.
 */
export async function bootstrapFirstAdmin(log: FastifyBaseLogger): Promise<void> {
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });

  if (adminCount === 0) {
    const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@firma.com').trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    const name = process.env.SEED_ADMIN_NAME ?? 'Sistem Yöneticisi';

    if (!password) {
      log.error(
        'Sistemde hiç yönetici yok ve SEED_ADMIN_PASSWORD tanımlı değil. ' +
          'Panele giriş yapabilmek için .env dosyasına SEED_ADMIN_EMAIL ve ' +
          'SEED_ADMIN_PASSWORD ekleyip servisi yeniden başlatın.',
      );
    } else {
      await prisma.user.create({
        data: { email, name, role: 'ADMIN', passwordHash: await hashPassword(password) },
      });
      log.warn(
        `İlk yönetici hesabı oluşturuldu: ${email} — ilk girişten sonra şifreyi ` +
          'değiştirin ve SEED_ADMIN_PASSWORD değerini .env dosyasından kaldırın.',
      );
    }
  }

  // Kategoriler ayrı ele alınır: yönetici zaten varken de eksikler tamamlanır,
  // ama kullanıcının sildiği kategoriler geri gelmesin diye yalnızca tablo
  // tamamen boşken doldurulur.
  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    await prisma.category.createMany({ data: DEFAULT_CATEGORIES });
    log.info(`${DEFAULT_CATEGORIES.length} varsayılan kategori oluşturuldu.`);
  }
}
