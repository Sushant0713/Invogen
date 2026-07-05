import { GoogleOAuthProvider } from '@react-oauth/google';
import { useGoogleAuthConfig } from '@/hooks/useGoogleAuthConfig';

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const { data } = useGoogleAuthConfig();

  if (!data?.enabled || !data.clientId) {
    return <>{children}</>;
  }

  return <GoogleOAuthProvider clientId={data.clientId}>{children}</GoogleOAuthProvider>;
}
