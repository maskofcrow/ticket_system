import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from './lib/session';
import { useLiveUpdates } from './lib/notifications';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { TicketListScreen } from './screens/TicketListScreen';
import { NewTicketScreen } from './screens/NewTicketScreen';
import { TicketDetailScreen } from './screens/TicketDetailScreen';
import { Button, Spinner } from './components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

type View = { name: 'list' } | { name: 'new' } | { name: 'detail'; ticketId: string };

function Shell() {
  const { user, loading, logout } = useSession();
  const [view, setView] = useState<View>({ name: 'list' });

  useLiveUpdates(Boolean(user), user?.id);

  if (loading) return <Spinner />;
  if (!user) return <WelcomeScreen />;

  return (
    <div className="flex h-full flex-col">
      <header
        className="titlebar-drag flex h-12 shrink-0 items-center gap-3 border-b border-slate-200
                   bg-white px-4 pl-20"
      >
        <span className="text-sm font-semibold text-slate-900">IT Destek</span>
        <span className="text-xs text-slate-500">{user.orgName}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-600">{user.name}</span>
          <Button variant="ghost" onClick={() => void logout()}>
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
      </div>
    </div>
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
