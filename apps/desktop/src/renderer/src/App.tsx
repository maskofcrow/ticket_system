import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from './lib/session';
import { useLiveUpdates } from './lib/notifications';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { TicketListScreen } from './screens/TicketListScreen';
import { NewTicketScreen } from './screens/NewTicketScreen';
import { TicketDetailScreen } from './screens/TicketDetailScreen';
import { EkipScreen } from './screens/EkipScreen';
import { Button, Spinner } from './components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

type View =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'detail'; ticketId: string }
  | { name: 'ekip' };

/** Üst çubuktaki bölüm sekmeleri hangi görünümde vurgulanacak. */
type Bolum = 'talepler' | 'ekip';

function Shell() {
  const { kullanici, yukleniyor, cikis } = useSession();
  const [view, setView] = useState<View>({ name: 'list' });

  useLiveUpdates(Boolean(kullanici), kullanici?.id);

  if (yukleniyor) return <Spinner />;
  if (!kullanici) return <WelcomeScreen />;

  const aktifBolum: Bolum = view.name === 'ekip' ? 'ekip' : 'talepler';

  return (
    <div className="flex h-full flex-col">
      <header
        className="titlebar-drag flex h-12 shrink-0 items-center gap-3 border-b border-slate-200
                   bg-white px-4 pl-20"
      >
        <span className="text-sm font-semibold text-slate-900">IT Destek</span>

        <nav className="ml-2 flex items-center gap-1">
          <SekmeButonu
            etkin={aktifBolum === 'talepler'}
            onClick={() => setView({ name: 'list' })}
          >
            Talepler
          </SekmeButonu>
          <SekmeButonu
            etkin={aktifBolum === 'ekip'}
            onClick={() => setView({ name: 'ekip' })}
          >
            Ekip
          </SekmeButonu>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500">{kullanici.firmaAdi}</span>
          <span className="text-xs text-slate-600">{kullanici.ad}</span>
          <Button variant="ghost" onClick={() => void cikis()}>
            Çıkış
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {view.name === 'list' && (
          <TicketListScreen
            onNew={() => setView({ name: 'new' })}
            onOpen={(ticketId) => setView({ name: 'detail', ticketId })}
          />
        )}

        {view.name === 'new' && (
          <NewTicketScreen
            onCancel={() => setView({ name: 'list' })}
            onCreated={(ticket) => setView({ name: 'detail', ticketId: ticket.id })}
          />
        )}

        {view.name === 'detail' && (
          <TicketDetailScreen
            ticketId={view.ticketId}
            onBack={() => setView({ name: 'list' })}
          />
        )}

        {view.name === 'ekip' && <EkipScreen />}
      </div>
    </div>
  );
}

function SekmeButonu({
  etkin,
  onClick,
  children,
}: {
  etkin: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        etkin
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </QueryClientProvider>
  );
}
