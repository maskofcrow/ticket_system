# Devam Prompt'u

Aşağıdaki metni yeni bir oturuma olduğu gibi yapıştırın. Kendi içinde
yeterlidir — bu konuşmayı görmemiş birine (ya da bir AI'a) işi devretmek için
yazıldı.

Sadece bir sonraki fazı yaptırmak istiyorsanız, en alttaki **"Faz bazlı kısa
prompt'lar"** bölümünden ilgili olanı kullanın.

---

## 📋 TAM DEVİR PROMPT'U

```
Bir IT destek ticket sistemi üzerinde çalışıyorum. İş iki depoya yayılmış
durumda ve yarısı bitti. Kaldığı yerden devam etmeni istiyorum.

## Bağlam

Biz bir IT destek ekibiyiz. Müşterilerimiz masaüstü uygulamasından (.exe/.dmg)
destek talebi açıyor, biz de bunları kendi CRM'imizin (EstaCRM) panelinden
yönetiyoruz. Müşteriler firmalarına verdiğimiz lisans anahtarıyla kendi
hesaplarını açıyor — biz tek tek hesap oluşturmuyoruz.

Sistem önce bağımsız bir ürün olarak yazıldı, sonra CRM ile ciddi örtüşme
olduğu için (aynı firmalar, aynı personel, aynı yığın) CRM'in içine taşınmasına
karar verildi. Taşımanın API tarafı bitti, panel arayüzü ve masaüstü bağlantısı
kaldı.

## Depolar

- ~/github/estacrm — Next.js 15 (App Router) + Prisma + PostgreSQL + pnpm.
  Ana geliştirme burada. Dal: feat/destek-modulu
- ~/github/ticket_system — npm workspaces monorepo. Electron masaüstü
  uygulaması ve (silinecek olan) eski API + panel. Dal: feat/ticket-system

İlk iş olarak ~/github/ticket_system/ROADMAP.md dosyasını oku — mimari
kararlar, tamamlananlar, kalan işler ve yol boyunca öğrenilen tuzaklar orada.

## Şu an ne var

EstaCRM tarafında destek modülü şu dosyalarda:
  lib/destek/       lisans.ts, musteriAuth.ts, semalar.ts, depo.ts,
                    api.ts, sunum.ts, olaylar.ts, bildirim.ts
  app/api/destek/   auth/{aktivasyon,giris,yenile,cikis}, talepler,
                    talepler/[id], talepler/[id]/mesajlar, yukleme,
                    kategoriler, akis (SSE)
  prisma/schema.prisma  — Talep, TalepMesaji, TalepEki, TalepCihazBilgisi,
                          TalepKategori, MusteriKullanici, MusteriOturum
                          + Customer'a lisans alanları

Müşteri tarafı API'si tamamen çalışıyor ve gerçek sunucuda test edildi.

## Kalan işler (öncelik sırasıyla)

1. PANEL ARAYÜZÜ — app/(panel)/destek/ altında personel tarafı. Şu an HİÇ YOK.
   - Talep listesi (durum/öncelik/firma/atanan filtreleri, arama)
   - Talep detayı: mesaj akışı, iç not yazma, durum/öncelik/atama/kategori
     değiştirme, cihaz bilgisi paneli, dosya ekleri
   - Sidebar.tsx'e "Destek" menüsü
   - Müşteri kartına (app/(panel)/musteriler/[id]) lisans bölümü:
     anahtar üretme/yenileme, kullanıcı limiti, kullanıcı listesi
   - Kategori yönetimi
   - SSE ile canlı güncelleme

2. MASAÜSTÜNÜ CRM'E BAĞLAMA — ticket_system deposunda apps/api ve apps/web
   silinecek, packages/shared masaüstüne taşınacak, uygulama CRM adresine
   yönlenecek, Socket.IO istemcisi EventSource'a çevrilecek.

3. TESTLER — ticket_system/apps/api/test/isolation.test.ts içindeki 18 test
   CRM'e taşınacak (CRM'de test altyapısı yok, Vitest kurulacak).

4. ÜRETİME ALMA — Caddyfile'a dosya eki yolu, prod compose'a MinIO,
   güncelleme akışı, kod imzalama.

## Uymanı istediğim kurallar

- EstaCRM'in mevcut kalıplarına uy: Türkçe alan/değişken adları, Server
  Actions (route handler değil) panel işlemleri için, lib/auth.ts'teki
  getCurrentUser(), lib/db.ts'teki prisma, components/ui.tsx bileşenleri.
- Yorumlar NEDEN'i anlatsın, NE yaptığını değil.
- İş bitti demeden önce gerçekten çalıştırıp doğrula. "Muhtemelen çalışır"
  kabul etmiyorum.
- Yıkıcı bir şey yapmadan önce (veritabanı sıfırlama, dosya silme) bana sor.

## Asla bozulmaması gereken üç kural

1. İç notlar müşteriye ASLA gitmez — ne API cevabında, ne mesaj sayacında,
   ne de SSE akışında. Filtre WHERE içinde olmalı, cevap katmanında değil.
2. Bir firmanın müşterisi başka firmanın talebini göremez. Yetkisiz erişimde
   404 dönülür (403 değil — kaydın varlığını sızdırmamak için).
3. Müşteri jetonuyla CRM paneline girilemez. Müşteri jetonları AUTH_SECRET'tan
   türetilen FARKLI bir anahtarla imzalanıyor; bu tasarımı bozma.

## Bilinen engel

lib/appleSync.ts'te 3 tip hatası var ve next build'i düşürüyor (ics paketinin
EventAttributes tipi duration ya da end istiyor, kod ikisini de vermiyor).
Bu hata destek modülünden önce de vardı. Üretime çıkmadan düzeltilmeli.

## Ortamı ayağa kaldırma

EstaCRM:
  cd ~/github/estacrm && pnpm dev          # localhost:3000
  (PostgreSQL yerelde 5432'de, MinIO 9000'de çalışıyor olmalı)

Masaüstü:
  cd ~/github/ticket_system && npm run dev:desktop

Şununla başla: ROADMAP.md'yi oku, iki depodaki mevcut kodu incele, sonra bana
panel arayüzü için ne yapacağını anlat. Onaylayınca başla.
```

---

## Faz bazlı kısa prompt'lar

### Faz 4 — Panel arayüzü

```
~/github/estacrm deposunda (dal: feat/destek-modulu) destek modülünün panel
arayüzünü yaz. ~/github/ticket_system/ROADMAP.md'yi ve lib/destek/ altındaki
mevcut kodu önce oku.

app/(panel)/destek/ altında:
- Talep listesi: durum, öncelik, firma, atanan filtreleri + arama
- Talep detayı: mesaj akışı, iç not yazma (sarı arka plan, "müşteri görmez"
  etiketi), durum/öncelik/atama/kategori değiştirme, cihaz bilgisi paneli,
  dosya ekleri
- Sidebar.tsx'e "Destek" menüsü (açık talep sayacıyla)
- app/(panel)/musteriler/[id] sayfasına lisans bölümü: anahtar üretme (bir kez
  gösterilir, sonra hash'li saklandığı için okunamaz), yenileme, kullanıcı
  limiti, kayıtlı müşteri kullanıcıları
- Kategori yönetimi

CRM'in mevcut kalıplarına uy: Server Actions, getCurrentUser(), components/ui.tsx,
Türkçe adlandırma.

Kritik: iç notlar yalnızca personele görünür. Müşteri API'sinde filtre zaten
var (lib/destek/sunum.ts → mesajGorunurluk); personel tarafında iç notu
gösterirken müşteri tarafını bozmadığından emin ol.

Bitirince gerçekten çalıştırıp göster: talep aç, panelden yanıtla, iç not yaz
ve iç notun masaüstü API'sinde görünmediğini kanıtla.
```

### Faz 5 — Masaüstünü CRM'e bağlama

```
~/github/ticket_system deposunda masaüstü uygulamasını EstaCRM'e bağla.
ROADMAP.md'yi önce oku.

- apps/api ve apps/web'i sil (artık CRM'de yaşıyorlar)
- packages/shared içeriğini apps/desktop'a taşı ve EstaCRM'in
  lib/destek/semalar.ts dosyasıyla birebir aynı hale getir (Türkçe alan adları)
- API adresini ve uç adlarını güncelle:
    /auth/activate  -> /api/destek/auth/aktivasyon
    /auth/login     -> /api/destek/auth/giris
    /auth/refresh   -> /api/destek/auth/yenile
    /tickets        -> /api/destek/talepler
    /uploads/presign-> /api/destek/yukleme
- Socket.IO istemcisini EventSource'a çevir (SSE ucu: /api/destek/akis?jeton=...)
- Alan adlarını Türkçeleştir (title->baslik, body->aciklama, status->durum,
  priority->oncelik, comments->mesajlar, attachments->ekler,
  deviceInfo->cihazBilgisi)

Bitirince .dmg üret ve kurulu uygulamadan lisans anahtarıyla hesap açıp talep
açtığını göster.
```

### Faz 6 — Testler

```
~/github/estacrm'e otomatik test altyapısı kur ve
~/github/ticket_system/apps/api/test/isolation.test.ts içindeki 18 testi
taşı. CRM'de test yok, Vitest kur.

En kritik dördü mutlaka olsun:
1. İç not müşteri API'sinde görünmüyor (mesaj sayacı dahil)
2. Bir firmanın müşterisi başka firmanın talebini göremiyor (404)
3. Müşteri öncelik/atama değiştiremiyor (403), durumu yalnızca KAPALI yapabiliyor
4. Müşteri jetonuyla CRM paneline girilemiyor

Testler gerçek PostgreSQL'e ve gerçek HTTP katmanına karşı koşsun — mock'lanmış
veritabanıyla "iç notlar sızmıyor" garantisi vermek anlamsız, asıl filtre
Prisma sorgusunun içinde.
```
