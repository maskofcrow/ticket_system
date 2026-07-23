import { useState, type FormEvent } from 'react';
import type { LicenseKeyResponse } from '@ticket/shared';
import { useCreateOrg, useOrganizations, useRotateLicense, useUpdateOrg } from '../lib/queries';
import { ApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Spinner } from '../components/ui';

export function OrgsPage() {
  const orgs = useOrganizations();
  const createOrg = useCreateOrg();
  const updateOrg = useUpdateOrg();
  const rotate = useRotateLicense();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [seatLimit, setSeatLimit] = useState(10);
  const [contactEmail, setContactEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  /**
   * Ham lisans anahtarı sunucuda hash'li tutulduğu için yalnızca oluşturma ve
   * yenileme cevabında bir kez döner — bu yüzden ekranda kalıcı gösteriliyor.
   */
  const [issued, setIssued] = useState<LicenseKeyResponse | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      const result = await createOrg.mutateAsync({
        name: name.trim(),
        seatLimit,
        contactEmail: contactEmail.trim() || null,
      });
      setIssued(result);
      setShowForm(false);
      setName('');
      setContactEmail('');
      setSeatLimit(10);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {});
        setError(err.message);
      } else {
        setError('Firma oluşturulamadı');
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Firmalar</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Vazgeç' : '+ Yeni firma'}
        </Button>
      </div>

      {issued && (
        <Card className="border-l-4 border-l-emerald-500 p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {issued.organization.name} — lisans anahtarı
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Bu anahtarı müşteriye iletin. <strong>Bir daha gösterilmeyecek</strong> — veritabanında
            şifrelenmiş olarak saklanıyor.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-md bg-slate-900 px-3 py-2 font-mono text-sm text-emerald-300">
              {issued.licenseKey}
            </code>
            <Button
              variant="secondary"
              onClick={() => void navigator.clipboard.writeText(issued.licenseKey)}
            >
              Kopyala
            </Button>
            <Button variant="ghost" onClick={() => setIssued(null)}>
              Kapat
            </Button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <ErrorBanner message={error} />}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Firma adı" error={fieldErrors.name}>
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </Field>

              <Field label="Kullanıcı limiti" hint="Kaç kişi kayıt olabilir">
                <Input
                  type="number"
                  min={1}
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(Number(e.target.value))}
                  required
                />
              </Field>

              <Field label="İletişim e-postası" error={fieldErrors.contactEmail}>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="it@firma.com"
                />
              </Field>
            </div>

            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? 'Oluşturuluyor…' : 'Firma oluştur ve anahtar üret'}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        {orgs.isLoading ? (
          <Spinner />
        ) : orgs.data?.length ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Firma</th>
                <th className="px-4 py-2 font-medium">Lisans</th>
                <th className="px-4 py-2 font-medium">Kullanıcı</th>
                <th className="px-4 py-2 font-medium">Talep</th>
                <th className="px-4 py-2 font-medium">Eklendi</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.data.map((org) => (
                <tr key={org.id} className={org.isActive ? '' : 'bg-slate-50 text-slate-400'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{org.name}</p>
                    {org.contactEmail && <p className="text-xs text-slate-500">{org.contactEmail}</p>}
                    {!org.isActive && (
                      <span className="text-xs font-medium text-red-600">devre dışı</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    TCK-••••-••••-••••-{org.licenseSuffix}
                  </td>
                  <td className="px-4 py-3">
                    <span className={org.seatsUsed >= org.seatLimit ? 'font-medium text-orange-600' : ''}>
                      {org.seatsUsed} / {org.seatLimit}
                    </span>
                  </td>
                  <td className="px-4 py-3">{org.ticketCount}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(org.createdAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (
                          confirm(
                            `${org.name} için yeni lisans anahtarı üretilecek. Eski anahtar geçersiz olacak. Devam edilsin mi?`,
                          )
                        ) {
                          rotate.mutate(org.id, { onSuccess: setIssued });
                        }
                      }}
                    >
                      Anahtar yenile
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => updateOrg.mutate({ id: org.id, isActive: !org.isActive })}
                    >
                      {org.isActive ? 'Devre dışı bırak' : 'Etkinleştir'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="Henüz firma yok"
            description="Müşteri firmanızı ekleyin, sistem bir lisans anahtarı üretsin."
          />
        )}
      </Card>
    </div>
  );
}
