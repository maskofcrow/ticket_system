import { useState, type FormEvent } from 'react';
import { ROLE_LABELS } from '@ticket/shared';
import {
  useAllUsers,
  useCategories,
  useCreateCategory,
  useCreateStaff,
  useDeleteCategory,
  useUpdateUser,
} from '../lib/queries';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { Button, Card, ErrorBanner, Field, Input, Select, Spinner } from '../components/ui';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Ayarlar</h1>
      <StaffSection />
      <CategorySection />
    </div>
  );
}

function StaffSection() {
  const { user } = useAuth();
  const users = useAllUsers();
  const createStaff = useCreateStaff();
  const updateUser = useUpdateUser();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      await createStaff.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role as 'AGENT' | 'ADMIN',
      });
      setForm({ name: '', email: '', password: '', role: 'AGENT' });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {});
        setError(err.message);
      } else setError('Kullanıcı oluşturulamadı');
    }
  }

  const staff = users.data?.filter((u) => u.role !== 'CUSTOMER') ?? [];
  const customers = users.data?.filter((u) => u.role === 'CUSTOMER') ?? [];

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">Destek ekibi</h2>
      <p className="mt-1 mb-4 text-sm text-slate-500">
        Müşteri hesapları buradan açılmaz — onlar firmalarının lisans anahtarıyla masaüstü
        uygulamasından kendileri kaydolur.
      </p>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Ad soyad" error={fieldErrors.name}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="E-posta" error={fieldErrors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Geçici şifre" error={fieldErrors.password} hint="En az 8 karakter">
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="AGENT">Destek uzmanı</option>
              <option value="ADMIN">Yönetici</option>
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={createStaff.isPending}>
          {createStaff.isPending ? 'Ekleniyor…' : 'Ekip üyesi ekle'}
        </Button>
      </form>

      {users.isLoading ? (
        <Spinner />
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="py-2 font-medium">Ad</th>
              <th className="py-2 font-medium">E-posta</th>
              <th className="py-2 font-medium">Rol</th>
              <th className="py-2 font-medium">Durum</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((u) => (
              <tr key={u.id}>
                <td className="py-2 font-medium text-slate-900">{u.name}</td>
                <td className="py-2 text-slate-600">{u.email}</td>
                <td className="py-2 text-slate-600">{ROLE_LABELS[u.role]}</td>
                <td className="py-2">
                  {u.isActive ? (
                    <span className="text-emerald-600">aktif</span>
                  ) : (
                    <span className="text-slate-400">devre dışı</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {/* Kendi hesabını kapatmayı sunucu da reddediyor; butonu hiç göstermiyoruz. */}
                  {u.id !== user?.id && (
                    <Button
                      variant="ghost"
                      onClick={() => updateUser.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? 'Devre dışı bırak' : 'Etkinleştir'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {customers.length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Ayrıca {customers.length} müşteri hesabı kayıtlı.
        </p>
      )}
    </Card>
  );
}

function CategorySection() {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#64748b');

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Kategoriler</h2>

      <form
        className="mb-4 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createCategory.mutate({ name: name.trim(), color }, { onSuccess: () => setName('') });
        }}
      >
        <div className="flex-1">
          <Field label="Kategori adı">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div>
          <Field label="Renk">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-md ring-1 ring-slate-300"
            />
          </Field>
        </div>
        <Button type="submit" disabled={createCategory.isPending}>
          Ekle
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {categories.data?.map((category) => (
          <span
            key={category.id}
            className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5
                       text-sm ring-1 ring-inset ring-slate-200"
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
            {category.name}
            <button
              onClick={() => {
                if (confirm(`"${category.name}" silinsin mi? Talepler silinmez, kategorisiz kalır.`)) {
                  deleteCategory.mutate(category.id);
                }
              }}
              className="text-slate-400 hover:text-red-600"
              aria-label={`${category.name} kategorisini sil`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </Card>
  );
}
