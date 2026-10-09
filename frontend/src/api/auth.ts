import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ability } from '../components/providers';

export interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'ASLAB' | 'KEPALA_LAB';
  nama: string;
  profil?: {
    peran?: 'ADMIN' | 'ASLAB' | 'KEPALA_LAB';
    nama?: string;
    [key: string]: any;
  };
}

export interface SessionData {
  user: User | null;
  rules: any[];
}

export const getBackendUrl = () => {
  const url = import.meta.env.VITE_API_BACKEND_URL || '';
  return url.replace(/\/api\/?$/, '');
};

export const useSession = () => {
  return useQuery<SessionData>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const backendUrl = getBackendUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${backendUrl}/api/auth/session`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          ability.update([]);
          return { user: null, rules: [] };
        }
        const data = await res.json();
        if (data && data.rules) {
          ability.update(data.rules);
        }
        return data;
      } catch {
        return { user: null, rules: [] };
      }
    },
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        const backendUrl = getBackendUrl();
        await fetch(`${backendUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
      } catch (err) {
        console.warn('Gagal menghubungi endpoint logout server:', err);
      }
      return { success: true };
    },
    onSettled: () => {
      ability.update([]);
      queryClient.setQueryData(['session'], { user: null, rules: [] });
      queryClient.removeQueries({ queryKey: ['session'] });
    },
  });
};

