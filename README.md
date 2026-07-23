# IT Destek Ticket Sistemi

Müşterilerin masaüstü uygulamasından destek talebi açtığı, IT ekibinin web
panelinden yönettiği self-hosted ticket sistemi.

| Bileşen | Kim kullanır | Teknoloji |
|---|---|---|
| **Masaüstü uygulaması** (`.exe` / `.dmg`) | Müşteriler | Electron + React |
| **Web paneli** | IT ekibi | React + Vite |
| **API** | — | Fastify + Prisma + PostgreSQL |

Müşteriler firmalarına verilen **lisans anahtarıyla** kendi hesaplarını açar;
IT ekibi hesapları tek tek oluşturmak zorunda kalmaz.

---

## Hızlı başlangıç (geliştirme)

```bash
cp .env.example .env && npm install
```

```bash
npm run db:migrate && npm run db:seed
```

Sonrasında her şeyi tek komutla başlatın:

```bash
npm run dev
```

Bu komut sırayla: ortamı kontrol eder (port, Docker, `.env`), ortak paketi
derler, veritabanı ve dosya depolamayı ayağa kaldırır, sonra API ile web
panelini birlikte çalıştırır. Durdurmak için Ctrl+C — ikisi birden kapanır.

Masaüstü uygulaması ayrı bir pencere açtığı için ayrı çalışır:

```bash
npm run dev:desktop
```

> **npm kullanın, pnpm değil.** Proje npm workspaces üzerine kurulu; pnpm bu
> alanı tanımadığı için yalnızca kök bağımlılıkları kurar ve kurulumu bozar.
> CI ile iki Dockerfile da `npm ci` + `package-lock.json` bekliyor.

### Bir şey çalışmazsa

`npm run dev` başlamadan önce ortamı kontrol eder ve sorunu adıyla söyler —
dolu port, kapalı Docker, eksik `.env`. En sık karşılaşılan:

```bash
kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)
```

Panel "Sunucuya bağlanılamadı" diyorsa API çalışmıyordur; aynı terminalde
`npm run dev` çıktısına bakın.

| Adres | Ne |
|---|---|
| http://localhost:5173 | Web paneli (IT ekibi) |
| http://localhost:3000/docs | API dokümantasyonu |
| http://localhost:9001 | MinIO konsolu (dosya ekleri) |
| http://localhost:8025 | MailHog — giden e-postalar |

Seed ile gelen yönetici: `admin@firma.com` / `Admin1234!`
(`.env` içindeki `SEED_ADMIN_*` ile değiştirilebilir).

> **Not:** PostgreSQL container'ı **5433** portunda yayınlanır; makinede zaten
> çalışan bir PostgreSQL varsa çakışmasın diye. `POSTGRES_PORT` ile değiştirilebilir.

---

## İlk kurulum akışı

1. Panele yönetici olarak girin → **Firmalar → + Yeni firma**
2. Sistem `TCK-XXXX-XXXX-XXXX-XXXX` formatında bir anahtar üretir.
   **Bu anahtar yalnızca bir kez gösterilir** — veritabanında argon2 ile
   hash'lenmiş tutulduğu için sonradan okunamaz. Kaybolursa *Anahtar yenile*.
3. Anahtarı müşteriye iletin, masaüstü uygulamasını kurdurun.
4. Müşteri uygulamayı açıp anahtarı girer, kendi hesabını oluşturur.
5. Açtığı talepler panelde anında görünür.

---

## Mimari kararlar

**Monorepo.** `packages/shared` içindeki Zod şemaları hem API doğrulamasında hem
iki istemcide kullanılır; API sözleşmesi tek yerde durur.

**Lisans anahtarı iki kez hash'lenir.** Doğrulama için argon2id
(`licenseKeyHash`), arama için HMAC-SHA256 (`licenseLookup`, indeksli). Sadece
argon2 olsaydı doğrulama tüm firmaları taramak zorunda kalırdı. `LICENSE_PEPPER`
değiştirilirse **mevcut tüm anahtarlar bulunamaz hale gelir**.

**İç notlar sorgu seviyesinde filtrelenir.** Müşteri isteklerinde
`WHERE isInternal = false` uygulanır — cevabı biçimlendirirken değil. Yorum
sayacı da iç notları saymaz; aksi halde "göremediğim bir hareket var" bilgisi
sızardı. Canlı bildirimlerde iç notlar müşteri odasına hiç gönderilmez.

**Yetkisiz erişimde 404.** Başka firmanın talebi için 403 dönmek, o talebin var
olduğunu sızdırırdı.

**Dosyalar API'den geçmez.** İstemci imzalı adres alıp doğrudan depolamaya
yükler. Ek kaydı oluşturulurken boyut ve MIME tipi, istemcinin beyanına değil,
depolamanın bildirdiği gerçek değerlere göre doğrulanır.

**Tek Socket.IO odası.** Her kullanıcı bağlantı anında ya `agents` ya da
`org:{id}` odasına girer. Ticket bazlı ikinci bir oda, aynı olayın iki kez
gönderilmesine ve iç notların sızmasına yol açıyordu.

**Masaüstü tarafında token güvenliği.** Access token yalnızca bellekte; refresh
token ana süreçte `safeStorage` ile şifrelenip diske yazılır (macOS Keychain,
Windows DPAPI). Renderer `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true` ile çalışır ve yalnızca preload'daki izin listesine erişir.

---

## Testler

```bash
npm run --workspace @ticket/api test
```

Testler **gerçek** PostgreSQL ve HTTP katmanına karşı çalışır (`npm run infra:up`
gerekir). Mock'lanmış bir veritabanıyla "iç notlar sızmıyor" garantisi vermek
anlamsız olurdu — asıl filtre Prisma sorgusunun içinde.

Kapsam: iç not gizliliği, firmalar arası izolasyon, müşteri yetki sınırları,
lisans anahtarı doğrulama/limit/yenileme, oturum geçersizleştirme.

---

## Masaüstü uygulamasını paketleme

```bash
npm run --workspace @ticket/desktop pack:mac
```

```bash
npm run --workspace @ticket/desktop pack:win
```

Çıktılar `apps/desktop/release/` altına düşer. macOS'te `.exe`, Windows'ta
`.dmg` üretilemez — her ikisi için `desktop-v*` etiketi gönderin, GitHub Actions
iki platformda paralel derler:

```bash
git tag desktop-v0.1.0 && git push --tags
```

### Kod imzalama

Şu an imzasız üretiliyor: Windows'ta SmartScreen, macOS'te "doğrulanamayan
geliştirici" uyarısı çıkar. **Kurulum rehberinize bunu ekleyin.**

Sertifikalar alındığında yapılacak tek iş GitHub Secrets'a değerleri eklemek —
pipeline hazır, kod değişikliği gerekmez:

| Secret | Platform |
|---|---|
| `CSC_LINK` (base64 sertifika), `CSC_KEY_PASSWORD` | Windows + macOS |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization |

---

## Üretime alma

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`.env` içinde mutlaka değiştirin:

- `DOMAIN` — sisteminizin alan adı (Caddy otomatik HTTPS alır)
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `LICENSE_PEPPER` — `openssl rand -base64 48`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `SMTP_*` — gerçek e-posta sunucunuz (MailHog üretimde çalışmaz)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — ilk yönetici hesabı

Tek alan adı yeterli; her şey aynı domain altında servis edilir:

| Yol | Nereye |
|---|---|
| `/` | Web paneli |
| `/api/*` | API |
| `/realtime` | Canlı bağlantı (WebSocket) |
| `/ticket-attachments/*` | Dosya ekleri (imzalı adreslerle) |
| `/updates/*` | Masaüstü uygulama güncellemeleri |

### Dikkat edilecek üç nokta

**İlk yönetici otomatik oluşur.** Sistemde hiç yönetici yoksa API açılışta
`SEED_ADMIN_*` değerleriyle bir hesap yaratır ve log'a uyarı yazar. İlk girişten
sonra şifreyi panelden değiştirip `SEED_ADMIN_PASSWORD` satırını `.env`'den
silin. Yönetici varken bu mekanizma hiç çalışmaz — sonradan hesap ele geçirmek
için kullanılamaz.

**`POSTGRES_PASSWORD` yalnızca ilk açılışta yazılır.** Veritabanı birimi bir kez
oluştuktan sonra parolayı `.env`'de değiştirmek işe yaramaz; API "authentication
failed" ile döngüye girer. Değiştirmeniz gerekirse:

```bash
docker compose exec postgres psql -U ticket -c "ALTER USER ticket PASSWORD 'yeni-parola';"
```

**Dosya eki yolu bucket adıyla aynı olmalı.** S3 imzası istek yolunu da kapsar;
Caddy'de bu yolu kısaltmak (`strip_prefix`) her yüklemenin 403 dönmesine yol
açar. `S3_BUCKET` değerini değiştirirseniz Caddy'ye de aynı değeri geçirin —
compose bunu zaten yapıyor.

### Otomatik güncelleme

Release çıktılarını (`.dmg`, `.exe`, `latest*.yml`) sunucudaki `./updates`
dizinine kopyalayın; `UPDATE_FEED_URL` bunu `https://<DOMAIN>/updates` olarak
göstermeli. `latest*.yml` dosyaları olmadan güncelleme kontrolü çalışmaz.

---

## Kapsam dışı (bilinçli olarak MVP'de yok)

SLA takibi ve eskalasyon, gelen e-postadan ticket açma, bilgi bankası, SSO,
raporlama/dışa aktarma, çoklu dil. Veri modeli bunları sonradan eklemeyi
engellemiyor.
