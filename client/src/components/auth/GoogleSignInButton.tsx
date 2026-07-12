import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGoogleAuthConfig } from '@/hooks/useGoogleAuthConfig';
import { useGsiScriptLoaded } from '@/hooks/useGsiScriptLoaded';
import {
  currentOrigin,
  ensureGsiInitialized,
  renderGsiButton,
  setGsiCredentialHandler,
} from '@/lib/google-gsi';

interface GoogleSignInButtonProps {
  mode: 'signin' | 'signup';
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ mode, onCredential, disabled }: GoogleSignInButtonProps) {
  const { data: config, isLoading, isError } = useGoogleAuthConfig();
  const scriptLoaded = useGsiScriptLoaded(Boolean(config?.enabled && config?.clientId));
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const [buttonWidth, setButtonWidth] = useState(320);
  const [originBlocked, setOriginBlocked] = useState(false);

  onCredentialRef.current = onCredential;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const next = Math.floor(element.getBoundingClientRect().width);
      if (next > 0) setButtonWidth((prev) => (prev === next ? prev : next));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [config?.enabled]);

  useEffect(() => {
    setGsiCredentialHandler((credential) => onCredentialRef.current(credential));
    return () => setGsiCredentialHandler(null);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !config?.clientId || !containerRef.current) return;

    if (!ensureGsiInitialized(config.clientId)) return;

    renderGsiButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      width: buttonWidth,
    });
  }, [scriptLoaded, config?.clientId, mode, buttonWidth]);

  useEffect(() => {
    if (!import.meta.env.DEV || !scriptLoaded || !config?.clientId) return;

    const timer = window.setTimeout(() => {
      const hasIframe = Boolean(containerRef.current?.querySelector('iframe'));
      if (!hasIframe) setOriginBlocked(true);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [scriptLoaded, config?.clientId, buttonWidth]);

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
    <div className="w-full">
      <div
        ref={containerRef}
        className={`w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      />
      {originBlocked && import.meta.env.DEV && (
        <p className="mt-2 text-center text-xs text-amber-700">
          Google blocked this origin ({currentOrigin()}). Add it under Authorized JavaScript origins
          in Google Cloud Console for client ID {config.clientId}.
        </p>
      )}
    </div>
  );
}
