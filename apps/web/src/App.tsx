import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { OrgsPage } from './pages/OrgsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Spinner } from './components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Canlı güncelleme WebSocket'ten geldiği için agresif yeniden çekmeye gerek yok.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        {user.role === 'ADMIN' && <Route path="orgs" element={<OrgsPage />} />}
        {user.role === 'ADMIN' && <Route path="settings" element={<SettingsPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
