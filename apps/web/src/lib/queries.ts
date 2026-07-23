import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Category,
  CreateCommentRequest,
  CreateOrgRequest,
  CreateStaffRequest,
  DashboardStats,
  LicenseKeyResponse,
  Organization,
  TicketDetail,
  TicketListQuery,
  TicketSummary,
  UpdateOrgRequest,
  UpdateTicketRequest,
  User,
} from '@ticket/shared';
import { apiFetch } from './api';

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export const queryKeys = {
  tickets: (filters?: Partial<TicketListQuery>) => ['tickets', filters ?? {}] as const,
  ticket: (id: string) => ['ticket', id] as const,
  orgs: ['orgs'] as const,
  users: (role?: string) => ['users', role ?? 'all'] as const,
  categories: ['categories'] as const,
  stats: ['stats'] as const,
};

export function useTickets(filters: Partial<TicketListQuery>) {
  return useQuery({
    queryKey: queryKeys.tickets(filters),
    queryFn: () =>
      apiFetch<Paginated<TicketSummary>>('/tickets', {
        query: {
          status: filters.status as string[] | undefined,
          priority: filters.priority as string[] | undefined,
          orgId: filters.orgId,
          assignedToId: filters.assignedToId,
          categoryId: filters.categoryId,
          filter: filters.filter,
          q: filters.q,
          limit: 50,
        },
      }),
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ticket(id ?? ''),
    queryFn: () => apiFetch<TicketDetail>(`/tickets/${id}`),
    enabled: Boolean(id),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => apiFetch<DashboardStats>('/stats/dashboard'),
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.orgs,
    queryFn: () => apiFetch<Organization[]>('/orgs'),
  });
}

export function useStaff() {
  return useQuery({
    queryKey: queryKeys.users('staff'),
    queryFn: async () => {
      const [agents, admins] = await Promise.all([
        apiFetch<User[]>('/users', { query: { role: 'AGENT', isActive: 'true' } }),
        apiFetch<User[]>('/users', { query: { role: 'ADMIN', isActive: 'true' } }),
      ]);
      return [...admins, ...agents];
    },
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.users('all'),
    queryFn: () => apiFetch<User[]>('/users'),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>('/categories'),
  });
}

export function useUpdateTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTicketRequest) =>
      apiFetch<TicketSummary>(`/tickets/${ticketId}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useAddComment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCommentRequest) =>
      apiFetch(`/tickets/${ticketId}/comments`, { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrgRequest) =>
      apiFetch<LicenseKeyResponse>('/orgs', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.orgs }),
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateOrgRequest & { id: string }) =>
      apiFetch<Organization>(`/orgs/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.orgs }),
  });
}

export function useRotateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch<LicenseKeyResponse>(`/orgs/${orgId}/license/rotate`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.orgs }),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStaffRequest) => apiFetch<User>('/users', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; isActive?: boolean; role?: string }) =>
      apiFetch<User>(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      apiFetch<Category>('/categories', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}
