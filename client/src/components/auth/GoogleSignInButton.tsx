import { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useGoogleAuthConfig } from '@/hooks/useGoogleAuthConfig';

interface GoogleSignInButtonProps {
  mode: 'signin' | 'signup';
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ mode, onCredential, disabled }: GoogleSignInButtonProps) {
  const { data: config, isLoading, isError } = useGoogleAuthConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState(320);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const next = Math.floor(element.getBoundingClientRect().width);
      if (next > 0) setButtonWidth(next);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [config?.enabled]);

  if (isLoading) return null;

  if (!config?.enabled || !config.clientId) {
    if (isError && import.meta.env.DEV) {
      return (
        <p className="text-center text-xs text-amber-700">
          Google sign-in is unavailable. Set GOOGLE_CLIENT_ID in your server .env and restart the API.
        </p>
      );
    }
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <GoogleLogin
        onSuccess={(response: CredentialResponse) => {
          if (response.credential) onCredential(response.credential);
        }}
        onError={() => undefined}
        theme="outline"
        size="large"
        width={buttonWidth}
        text={mode === 'signup' ? 'signup_with' : 'signin_with'}
        shape="rectangular"
      />
    </div>
  );
}
