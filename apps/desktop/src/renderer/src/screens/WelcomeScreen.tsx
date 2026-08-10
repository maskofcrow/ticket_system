import { useEffect, useState, type FormEvent } from 'react';
import { LISANS_REGEX } from '../../../shared/sozlesme.js';
import { useSession } from '../lib/session';
import { ApiHatasi, getApiUrl, setApiUrl } from '../lib/api';
import { Button, Card, ErrorBanner, Field, Input, InfoBanner } from '../components/ui';

// Ana sekmeler: kurumsal e-posta ile kayıt (varsayılan) veya giriş.
// "Lisans anahtarı" yöntemi gizli bir yedektir (domaini olmayan firmalar için).
type Mode = 'kayit' | 'login' | 'lisans';
type KayitAdim = 'bilgi' | 'kod';

/**
 * İlk açılış ekranı. Yeni kullanıcı kurumsal e-postasıyla (firma domaini tanımlıysa)
 * anahtar GİRMEDEN hesap açar; e-postaya gelen 6 haneli kodu doğrular. Domaini
 * olmayan firmalar için "Lisans anahtarım var" bağlantısı eski yöntemi sunar.
 */
export function WelcomeScreen() {
  const { kayitBaslat, kayitDogrula, giris, aktivasyon } = useSession();
  const [mode, setMode] = useState<Mode>('kayit');
  const [kayitAdim, setKayitAdim] = useState<KayitAdim>('bilgi');
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  const [licenseKey, setLicenseKey] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [kod, setKod] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setServerUrl(getApiUrl());
  }, []);

  function sifirlaGeriBildirim(): void {
    setError(null);
    setBilgi(null);
    setFieldErrors({});
  }

  /** Yazarken otomatik biçimlendirme: kullanıcı tireleri elle yazmak zorunda kalmasın. */
  function handleLicenseChange(raw: string): void {
    const cleaned = raw
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/^ESTA/, '')
      .slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g) ?? [];
    setLicenseKey(cleaned ? `ESTA-${groups.join('-')}` : '');
  }

  function hataYakala(err: unknown): void {
    if (err instanceof ApiHatasi) {
      setError(err.message);
      setFieldErrors(err.alanlar ?? {});
    } else {
      setError('İşlem tamamlanamadı');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sifirlaGeriBildirim();
    setBusy(true);
    try {
      if (mode === 'login') {
        await giris(email.trim(), password);
      } else if (mode === 'lisans') {
        await aktivasyon({
          lisansAnahtari: licenseKey,
          eposta: email.trim(),
          ad: name.trim(),
          parola: password,
        });
      } else if (mode === 'kayit' && kayitAdim === 'bilgi') {
        await kayitBaslat({ eposta: email.trim(), ad: name.trim(), parola: password });
        setKayitAdim('kod');
        setKod('');
        setBilgi(`Doğrulama kodu ${email.trim()} adresine gönderildi.`);
      } else if (mode === 'kayit' && kayitAdim === 'kod') {
        await kayitDogrula(email.trim(), kod.trim());
      }
    } catch (err) {
      hataYakala(err);
    } finally {
      setBusy(false);
    }
  }

  async function koduTekrarGonder() {
    sifirlaGeriBildirim();
    setBusy(true);
    try {
      await kayitBaslat({ eposta: email.trim(), ad: name.trim(), parola: password });
      setBilgi(`Yeni kod ${email.trim()} adresine gönderildi.`);
    } catch (err) {
      hataYakala(err);
    } finally {
      setBusy(false);
    }
  }

  function modeDegistir(m: Mode): void {
    setMode(m);
    setKayitAdim('bilgi');
    sifirlaGeriBildirim();
  }

  const licenseValid = LISANS_REGEX.test(licenseKey);
  const kodAdimi = mode === 'kayit' && kayitAdim === 'kod';

  const baslik =
    mode === 'login'
      ? 'Hesabınızla giriş yapın.'
      : mode === 'lisans'
        ? 'Firma lisans anahtarınızla hesabınızı oluşturun.'
        : kodAdimi
          ? 'E-postanıza gelen 6 haneli kodu girin.'
          : 'Kurumsal e-postanızla hesabınızı oluşturun.';

  return (
    <div className="flex h-full flex-col">
      <div className="titlebar-drag h-8 shrink-0" />

      <div className="flex flex-1 items-center justify-center px-6 pb-8">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-lg font-semibold text-slate-900">IT Destek</h1>
          <p className="mt-1 text-sm text-slate-500">{baslik}</p>

          {/* Ana sekmeler yalnızca lisans (yedek) modda gizlenir. */}
          {mode !== 'lisans' && (
            <div className="mt-4 mb-5 flex rounded-md bg-slate-100 p-1">
              <TabButton active={mode === 'kayit'} onClick={() => modeDegistir('kayit')}>
                İlk kurulum
              </TabButton>
              <TabButton active={mode === 'login'} onClick={() => modeDegistir('login')}>
                Giriş yap
              </TabButton>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}
            {bilgi && <InfoBanner>{bilgi}</InfoBanner>}

            {/* Lisans (yedek) modu: anahtar alanı */}
            {mode === 'lisans' && (
              <Field
                label="Firma lisans anahtarı"
                hint="IT ekibinizden aldığınız anahtar"
                error={fieldErrors.lisansAnahtari}
              >
                <Input
                  value={licenseKey}
                  onChange={(e) => handleLicenseChange(e.target.value)}
                  placeholder="ESTA-XXXX-XXXX-XXXX-XXXX"
                  className={`font-mono tracking-wide ${
                    licenseKey && !licenseValid ? 'ring-amber-400' : ''
                  }`}
                  autoFocus
                  required
                />
              </Field>
            )}

            {/* Kod doğrulama adımı: yalnızca kod alanı */}
            {kodAdimi ? (
              <>
                <Field label="Doğrulama kodu" hint="6 haneli, 10 dakika geçerli" error={fieldErrors.kod}>
                  <Input
                    value={kod}
                    onChange={(e) => setKod(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="______"
                    inputMode="numeric"
                    className="text-center font-mono text-lg tracking-[0.5em]"
                    autoFocus
                    required
                  />
                </Field>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setKayitAdim('bilgi');
                      sifirlaGeriBildirim();
                    }}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    ← Bilgileri düzenle
                  </button>
                  <button
                    type="button"
                    onClick={koduTekrarGonder}
                    disabled={busy}
                    className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    Kodu tekrar gönder
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Kayıt/lisans: ad soyad alanı */}
                {mode !== 'login' && (
                  <Field label="Ad soyad" error={fieldErrors.ad}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </Field>
                )}

                <Field
                  label={mode === 'login' ? 'E-posta' : 'Kurumsal e-posta'}
                  hint={mode === 'kayit' ? 'Firmanızın tanımlı e-posta adresi (örn. ad@firma.com)' : undefined}
                  error={fieldErrors.eposta}
                >
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus={mode === 'login'}
                    required
                  />
                </Field>

                <Field
                  label="Şifre"
                  hint={mode !== 'login' ? 'En az 8 karakter' : undefined}
                  error={fieldErrors.parola}
                >
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={mode !== 'login' ? 8 : undefined}
                    required
                  />
                </Field>
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={busy || (mode === 'lisans' && !licenseValid)}
            >
              {busy
                ? 'Lütfen bekleyin…'
                : mode === 'login'
                  ? 'Giriş yap'
                  : mode === 'lisans'
                    ? 'Hesabımı oluştur'
                    : kodAdimi
                      ? 'Doğrula ve gir'
                      : 'Doğrulama kodu gönder'}
            </Button>
          </form>

          {/* Yöntem geçişi */}
          {mode === 'kayit' && kayitAdim === 'bilgi' && (
            <button
              onClick={() => modeDegistir('lisans')}
              className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              Lisans anahtarım var
            </button>
          )}
          {mode === 'lisans' && (
            <button
              onClick={() => modeDegistir('kayit')}
              className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              ← Kurumsal e-posta ile kayda dön
            </button>
          )}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <button
              onClick={() => setShowServerSettings((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {showServerSettings ? '− Sunucu ayarları' : '+ Sunucu ayarları'}
            </button>

            {showServerSettings && (
              <div className="mt-3 space-y-3">
                <InfoBanner>
                  Bu adres IT ekibinizin destek sunucusudur. Değiştirmeniz gerekmiyorsa dokunmayın.
                </InfoBanner>
                <div className="flex gap-2">
                  <Input
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://destek.firma.com"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void setApiUrl(serverUrl)}
                    disabled={!serverUrl.trim()}
                  >
                    Kaydet
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
