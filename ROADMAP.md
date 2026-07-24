# IT Destek Ticket Sistemi — Yol Haritası

> Son güncelleme: 24 Temmuz 2026

## Ne inşa ediyoruz

Müşterilerin **masaüstü uygulamasından** (`.exe` / `.dmg`) destek talebi açtığı,
IT ekibinin **EstaCRM paneli üzerinden** yönettiği self-hosted destek sistemi.
Müşteriler firmalarına verilen **lisans anahtarıyla** kendi hesaplarını açar;
IT ekibi tek tek hesap oluşturmaz.

## Neden CRM'e taşındı

Ticket sistemi önce bağımsız bir ürün olarak yazıldı (Fastify API + React panel
+ Electron). Çalışır durumdaydı, ama EstaCRM ile ciddi biçimde örtüşüyordu:

| Ticket sistemi | EstaCRM | Sonuç |
|---|---|---|
| `Organization` (firma) | `Customer` (firmaAdi) | Aynı firma iki yerde |
| `User` (AGENT/ADMIN) | `User` (PATRON/TEKNISYEN) | Aynı kişiler, iki şifre |
| Prisma + PostgreSQL | Prisma + PostgreSQL | İki ayrı veritabanı |
| jose, zod, nodemailer | jose, zod, nodemailer | Aynı yığın |
| Docker + Caddy | Docker + Caddy | İki dağıtım |

Karar: **tam birleştirme.** Destek modülü EstaCRM'in içine taşınıyor; firma
kaydı olarak mevcut `Customer` kullanılıyor, teknisyenler kendi CRM hesabıyla
giriyor. Masaüstü uygulaması `ticket_system` deposunda kalıyor ve CRM'in
API'sine bağlanıyor.

---

## Depolar

| Depo | Dal | Rolü |
|---|---|---|
| `estacrm` | `feat/destek-modulu` | **Ana geliştirme.** API, veri modeli, panel |
| `ticket_system` | `feat/ticket-system` | Masaüstü istemcisi (+ arşivlenecek eski API/panel) |

Şu anki commitler:

```
estacrm        b27f868  Destek modülü: veri modeli, müşteri kimliği ve /api/destek uçları
               458f9eb  Apple takvim senkronizasyonu

ticket_system  99c09f0  API'den kullanılmayan electron bağımlılığını kaldır
               14589a9  Tek komutla geliştirme başlatma ve ortam ön kontrolü
               aacf9a6  Panelde ağ hatasını anlaşılır mesaja çevir
               f2e3154  Üretim dağıtımını yerel docker yığınında doğrula
               bbc3dc9  IT destek ticket sistemi: API, web paneli ve masaüstü
```

---

## Durum

### ✅ Faz 0 — Bağımsız sistem (tamamlandı, artık referans)

`ticket_system` deposunda çalışan tam sistem: Fastify API, React panel,
Electron uygulaması, 18 otomatik test, Docker + Caddy üretim yığını,
GitHub Actions ile `.dmg` + `.exe` üretimi. Üretim yığını yerelde HTTPS ile
uçtan uca doğrulandı.

Bu kod **CRM'e taşınırken referans** olarak kullanılıyor. Taşıma bitince
`apps/api` ve `apps/web` silinecek.

### ✅ Faz 1 — CRM veri modeli (tamamlandı)

`estacrm/prisma/schema.prisma` — migration `20260723152710_destek_modulu`.

- `Customer`'a lisans alanları: `lisansHash`, `lisansLookup`, `lisansSonEk`, `lisansLimit`
- Yeni: `MusteriKullanici`, `MusteriOturum`, `TalepKategori`, `Talep`,
  `TalepMesaji`, `TalepEki`, `TalepCihazBilgisi`

Migration yalnızca ekleme yapıyor — tek `DROP`/`TRUNCATE` yok, mevcut CRM
verisi etkilenmedi.

### ✅ Faz 2 — Müşteri kimliği ve güvenlik sınırı (tamamlandı)

- `lib/destek/lisans.ts` — anahtar üretimi, bcrypt doğrulama + HMAC arama özeti
- `lib/destek/musteriAuth.ts` — Bearer jeton, yenileme rotasyonu, oturum iptali
- `middleware.ts` — `/api/destek` bypass + audience koruması

**Kritik karar:** Müşteri jetonları `AUTH_SECRET`'tan *türetilen farklı bir
anahtarla* imzalanıyor. Aynı sırla imzalansaydı `middleware.ts`'teki
`jwtVerify` müşteri jetonunu geçerli sayar ve müşteri kendi jetonuyla
`/musteriler`, `/kasa`, `/raporlar` sayfalarına girebilirdi. Audience kontrolü
ikinci savunma hattı; asıl koruma imzanın tutmaması.

### ✅ Faz 3 — Müşteri API'si (tamamlandı)

`app/api/destek/` altında:

| Uç | İş |
|---|---|
| `POST /auth/aktivasyon` | Lisans anahtarıyla hesap açma |
| `POST /auth/giris` | E-posta + şifre |
| `POST /auth/yenile` | Jeton yenileme (rotasyonlu) |
| `POST /auth/cikis` | Oturum iptali |
| `GET/POST /talepler` | Liste / yeni talep |
| `GET/PATCH /talepler/[id]` | Detay / durum değiştirme |
| `POST /talepler/[id]/mesajlar` | Yanıt yazma |
| `POST /yukleme` | İmzalı dosya yükleme adresi |
| `GET /kategoriler` | Kategori listesi |
| `GET /akis` | Canlı akış (SSE) |

Destek katmanı: `api.ts` (hata/doğrulama/yetki), `sunum.ts` (serileştirme),
`depo.ts` (MinIO), `bildirim.ts` (e-posta), `olaylar.ts` (SSE yayını).

**Çalışan sunucuda doğrulananlar:**

- Aktivasyon ✓ · yanlış anahtar → 401 ✓
- Talep açma + cihaz bilgisi ✓
- Dosya eki: imzalı adres → MinIO → indirme, içerik birebir ✓
- **İç not müşteriye sızmıyor** — 4 mesajın 3'ü dönüyor, sayaç da 3 ✓
- **Firmalar arası izolasyon** — 404, liste boş, mesaj yazılamıyor ✓
- Müşteri öncelik/durum değiştiremiyor → 403 ✓
- Kullanıcı limiti → 3. kullanıcıda 403 ✓
- Talep otomatik yeniden açılıyor ✓
- **Müşteri jetonuyla panele girilemiyor** → `/giris`'e yönlendi ✓

---

## Kalan işler

### 🔲 Faz 4 — Panel arayüzü (sıradaki)

`app/(panel)/destek/` — personel tarafı henüz **hiç yok**.

- [ ] Talep listesi: durum/öncelik/firma/atanan filtreleri, arama
- [ ] Talep detayı: mesaj akışı, **iç not yazma** (sarı, müşteri görmez),
      durum/öncelik/atama/kategori değiştirme, cihaz bilgisi paneli, ekler
- [ ] Personel mesaj/güncelleme işlemleri (Server Actions — CRM'in mevcut kalıbı)
- [ ] `Sidebar.tsx`'e "Destek" menüsü + açık talep sayacı
- [ ] Müşteri kartına (`app/(panel)/musteriler/[id]`) lisans bölümü:
      anahtar üretme (bir kez gösterilir), yenileme, kullanıcı limiti, kullanıcı listesi
- [ ] Kategori yönetimi (Ayarlar)
- [ ] Panel tarafında canlı güncelleme (SSE dinleyicisi)

**Kabul ölçütü:** Teknisyen panelden talebi görüp yanıtlayabiliyor, iç not
yazabiliyor ve iç not masaüstü uygulamasında görünmüyor.

> Yetki notu: `lib/yetki.ts`'teki "para patronundur" kuralı destek modülünde
> geçerli değil — talepler operasyonel, `TEKNISYEN` de tam yetkili olmalı.
> Yalnızca lisans üretme/yenileme `PATRON`'a bırakılabilir.

### 🔲 Faz 5 — Masaüstü uygulamasını CRM'e bağlama

`ticket_system` deposunda:

- [ ] `apps/api` ve `apps/web` sil
- [ ] `packages/shared` içeriğini masaüstüne taşı, CRM'in Türkçe sözleşmesine
      uyarla (`lib/destek/semalar.ts` ile birebir aynı olmalı)
- [ ] `VITE_API_URL` → CRM adresi, uç adlarını güncelle
      (`/auth/activate` → `/api/destek/auth/aktivasyon` vb.)
- [ ] Socket.IO istemcisini SSE'ye (`EventSource`) çevir
- [ ] Depo adını değiştir (artık yalnızca masaüstü istemcisi)

**Kabul ölçütü:** `.dmg` kurulan bir makineden lisans anahtarıyla hesap
açılıyor, talep açılıyor, panelden yanıt yazıldığında native bildirim geliyor.

### 🔲 Faz 6 — Testler

- [ ] `ticket_system/apps/api/test/isolation.test.ts`'teki 18 testi CRM'e taşı
- [ ] En kritik dördü: iç not gizliliği, firma izolasyonu, müşteri yetki
      sınırları, **müşteri jetonuyla panele girilememesi**
- [ ] CRM'de test altyapısı yok — Vitest kurulacak

### 🔲 Faz 7 — Üretime alma

- [ ] `lib/appleSync.ts`'teki 3 tip hatasını düzelt (aşağıya bakın)
- [ ] `.env`: `LISANS_PEPPER`, `S3_*` üretim değerleri
- [ ] `Caddyfile`: dosya eki yolu (`/destek-ekleri/*` → minio, **önek
      kısaltılmadan**)
- [ ] `docker-compose.prod.yml`'e MinIO
- [ ] Masaüstü güncelleme akışı (`/updates` + `latest*.yml`)
- [ ] Kod imzalama sertifikaları (Windows + Apple Developer ID)

---

## Bilinen engeller

| Engel | Etki | Durum |
|---|---|---|
| `lib/appleSync.ts` — 3 tip hatası (`ics` `EventAttributes` `duration`/`end` istiyor) | **`next build` düşüyor**, üretime çıkılamaz | Destek modülünden önce de vardı; düzeltilmeli |
| Kod imzalama sertifikası yok | Windows SmartScreen, macOS "doğrulanamayan geliştirici" uyarısı | Sertifika alınınca yalnızca GitHub Secrets eklenecek, kod değişmeyecek |
| CRM'de otomatik test yok | Regresyon koruması yok | Faz 6 |

---

## Kararlar ve gerekçeleri

**Firma tablosu tek.** `Customer` hem CRM müşterisi hem destek firması. İkinci
bir tablo, iki listeyi senkron tutma derdi getirirdi.

**Müşteri hesapları ayrı tabloda.** `MusteriKullanici`, CRM `User`'ından ayrı.
Aynı tabloda olsalardı `lib/yetki.ts`'teki rol mantığı ve `PATRON`/`TEKNISYEN`
ayrımı iç içe geçerdi.

**Lisans anahtarı iki kez özetlenir.** bcrypt (doğrulama) + HMAC-SHA256
(indeksli arama). Sadece bcrypt olsaydı doğrulama tüm firmaları taramak
zorunda kalırdı. `LISANS_PEPPER` değişirse **mevcut tüm anahtarlar
doğrulanamaz hale gelir.**

**İç notlar sorgu seviyesinde elenir.** `WHERE icNot = false` — cevap
biçimlendirilirken değil. Mesaj sayacı da iç notları saymaz; aksi halde
"göremediğim bir hareket var" bilgisi sızardı.

**Yetkisiz erişimde 404.** 403 dönmek, kaydın var olduğunu sızdırırdı.

**Dosyalar sunucudan geçmez.** İmzalı adresle doğrudan MinIO'ya. Boyut ve MIME
tipi, istemcinin beyanına değil, deponun bildirdiği gerçek değere göre
doğrulanır.

**Socket.IO yerine SSE.** Next.js route handler'ıyla özel sunucu gerektirmeden
çalışıyor; ihtiyaç zaten tek yönlü (sunucu → istemci).

---

## Yol boyunca öğrenilen tuzaklar

Bunlar bir kez canımızı yaktı; tekrar yakmasın:

1. **S3 imzası istek yolunu kapsar.** Caddy'de `strip_prefix` ile önek
   kısaltmak her yüklemeyi 403 yapar. Yönlendirme bucket adıyla birebir aynı
   yol üzerinden olmalı.

2. **`POSTGRES_PASSWORD` yalnızca ilk açılışta yazılır.** Birim oluştuktan
   sonra `.env`'de değiştirmek işe yaramaz; `ALTER USER` gerekir.

3. **electron-builder caret aralığından sürüm hesaplayamaz.** `"^41.7.1"`
   yerine sabit `"41.7.1"` olmalı, yoksa "Cannot compute electron version".

4. **İki dmg aynı birim adıyla bağlanamaz.** `dmg.title`'a `${arch}` eklenmeli,
   yoksa `hdiutil detach` "resource busy" ile build'i yarıda keser.

5. **pnpm, npm workspaces'i tanımaz.** `ticket_system` npm ile kurulmalı
   (CI ve Dockerfile'lar `npm ci` bekliyor); `estacrm` pnpm kullanıyor.

6. **`server-only` modülleri betikten import edilemez.** Test/seed betikleri
   mantığı kendi içinde tekrarlamalı.

7. **Prisma `migrate dev` uyarı varsa TTY ister.** Otomasyonda
   `migrate diff` + `migrate deploy` ikilisi kullanılmalı.

8. **Electron sunucu bağımlılığı değildir.** `apps/api`'ye eklendiğinde üretim
   imajına ~300 MB bindiriyordu.
