import { useEffect, useState, type FormEvent } from 'react';
import { LISANS_REGEX } from '../../../shared/sozlesme.js';
import { useSession } from '../lib/session';
import { ApiHatasi, getApiUrl, setApiUrl } from '../lib/api';
import { Button, Card, ErrorBanner, Field, Input, InfoBanner } from '../components/ui';

type Mode = 'activate' | 'login';

/**
 * İlk açılış ekranı. Yeni kullanıcı firmasının lisans anahtarıyla hesap açar;
 * daha önce kaydolmuş kullanıcı e-posta/şifre ile girer.
 */
export function WelcomeScreen() {
  const { aktivasyon, giris } = useSession();
  const [mode, setMode] = useState<Mode>('activate');
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  const [licenseKey, setLicenseKey] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setServerUrl(getApiUrl());
  }, []);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      if (mode === 'activate') {
        await aktivasyon({
          lisansAnahtari: licenseKey,
          eposta: email.trim(),
          ad: name.trim(),
          parola: password,
        });
      } else {
        await giris(email.trim(), password);
      }
    } catch (err) {
      if (err instanceof ApiHatasi) {
        setError(err.message);
        setFieldErrors(err.alanlar ?? {});
      } else {
        setError('İşlem tamamlanamadı');
      }
    } finally {
      setBusy(false);
    }
  }

  const licenseValid = LISANS_REGEX.test(licenseKey);

  return (
    <div className="flex h-full flex-col">
      <div className="titlebar-drag h-8 shrink-0" />

      <div className="flex flex-1 items-center justify-center px-6 pb-8">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-lg font-semibold text-slate-900">IT Destek</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'activate'
              ? 'Firmanızın lisans anahtarıyla hesabınızı oluşturun.'
              : 'Hesabınızla giriş yapın.'}
          </p>

          <div className="mt-4 mb-5 flex rounded-md bg-slate-100 p-1">
            <TabButton active={mode === 'activate'} onClick={() => setMode('activate')}>
              İlk kurulum
            </TabButton>
            <TabButton active={mode === 'login'} onClick={() => setMode('login')}>
              Giriş yap
            </TabButton>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}

            {mode === 'activate' && (
              <>
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

                <Field label="Ad soyad" error={fieldErrors.ad}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
              </>
            )}

            <Field label="E-posta" error={fieldErrors.eposta}>
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
              hint={mode === 'activate' ? 'En az 8 karakter' : undefined}
              error={fieldErrors.parola}
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'activate' ? 8 : undefined}
                required
              />
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={busy || (mode === 'activate' && !licenseValid)}
            >
              {busy
                ? 'Lütfen bekleyin…'
                : mode === 'activate'
                  ? 'Hesabımı oluştur'
                  : 'Giriş yap'}
            </Button>
          </form>

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
