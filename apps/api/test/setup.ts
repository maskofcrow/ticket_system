/**
 * Test ortamı değişkenleri. Gerçek .env yüklenmeden önce çalışır; testler
 * ayrı bir veritabanı şemasına değil, geliştirme veritabanına karşı koşar ve
 * her dosya kendi verisini benzersiz e-posta/firma adlarıyla oluşturur.
 */
process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-ortami-icin-en-az-32-karakterlik-gizli-anahtar';
process.env.LICENSE_PEPPER ??= 'test-ortami-icin-en-az-32-karakterlik-pepper-x';
process.env.DATABASE_URL ??= 'postgresql://ticket:degistir-beni@localhost:5433/ticket_system';
process.env.S3_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_ACCESS_KEY ??= 'minioadmin';
process.env.S3_SECRET_KEY ??= 'minioadmin';
process.env.SMTP_HOST ??= '';
