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

export const useSession = () => {
  return useQuery<SessionData>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${backendUrl}/api/auth/session`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
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
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Gagal melakukan logout');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(['session'], { user: null, rules: [] });
    },
  });
};

