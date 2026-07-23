import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { initials } from '../lib/format';
import { Button } from './ui';

const NAV = [
  { to: '/', label: 'Panel', end: true },
  { to: '/tickets', label: 'Talepler' },
  { to: '/orgs', label: 'Firmalar', adminOnly: true },
  { to: '/settings', label: 'Ayarlar', adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();

  // Canlı güncelleme oturum açıkken aktif.
  useRealtime(Boolean(user));

  const visibleNav = NAV.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <span className="text-sm font-semibold text-slate-900">IT Destek</span>

          <nav className="flex items-center gap-1">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">
                {user?.role === 'ADMIN' ? 'Yönetici' : 'Destek uzmanı'}
              </p>
            </div>
            <div
              className="flex size-8 items-center justify-center rounded-full bg-blue-600
                         text-xs font-semibold text-white"
            >
              {initials(user?.name ?? '')}
            </div>
            <Button variant="ghost" onClick={() => void logout()}>
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
