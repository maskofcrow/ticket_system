import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { Button, Card, ErrorBanner, Field, Input } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-slate-900">IT Destek — Yönetim Paneli</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">Destek ekibi girişi</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner message={error} />}

          <Field label="E-posta">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </Field>

          <Field label="Şifre">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
