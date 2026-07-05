import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export interface GoogleAuthConfig {
  enabled: boolean;
  clientId: string;
}

/** Client fallback when the API is unreachable — mirrors root `.env` `GOOGLE_CLIENT_ID`. */
const CLIENT_GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

async function fetchGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  try {
    const res = await api.get('/auth/google/config');
    const data = res.data.data as GoogleAuthConfig;
    const clientId = (data.clientId || CLIENT_GOOGLE_CLIENT_ID).trim();
    return {
      enabled: Boolean(clientId),
      clientId,
    };
  } catch {
    return {
      enabled: Boolean(CLIENT_GOOGLE_CLIENT_ID),
      clientId: CLIENT_GOOGLE_CLIENT_ID,
    };
  }
}

export function useGoogleAuthConfig() {
  return useQuery({
    queryKey: ['google-auth-config'],
    queryFn: fetchGoogleAuthConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
