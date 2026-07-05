import { useQuery } from '@tanstack/react-query';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import api from '@/api/client';

interface GoogleSignInButtonProps {
  mode: 'signin' | 'signup';
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ mode, onCredential, disabled }: GoogleSignInButtonProps) {
  const { data: config } = useQuery({
    queryKey: ['google-auth-config'],
    queryFn: async () =>
      (await api.get('/auth/google/config')).data.data as { enabled: boolean; clientId: string },
    staleTime: 5 * 60 * 1000,
  });

  if (!config?.enabled) return null;

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <GoogleLogin
        onSuccess={(response: CredentialResponse) => {
          if (response.credential) onCredential(response.credential);
        }}
        onError={() => undefined}
        theme="outline"
        size="large"
        width="100%"
        text={mode === 'signup' ? 'signup_with' : 'signin_with'}
        shape="rectangular"
      />
    </div>
  );
}
