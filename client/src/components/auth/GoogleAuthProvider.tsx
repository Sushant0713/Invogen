import { useQuery } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import api from '@/api/client';

interface GoogleAuthConfig {
  enabled: boolean;
  clientId: string;
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['google-auth-config'],
    queryFn: async () => (await api.get('/auth/google/config')).data.data as GoogleAuthConfig,
    staleTime: 5 * 60 * 1000,
  });

  if (!data?.enabled || !data.clientId) {
    return <>{children}</>;
  }

  return <GoogleOAuthProvider clientId={data.clientId}>{children}</GoogleOAuthProvider>;
}
